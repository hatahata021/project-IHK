import { Request, Response, NextFunction } from 'express';

/**
 * レート制限設定
 */
interface RateLimitConfig {
  windowMs: number;  // 時間窓（ミリ秒）
  max: number;       // 最大リクエスト数
  message?: string;  // カスタムエラーメッセージ
  skipSuccessfulRequests?: boolean; // 成功したリクエストをカウントしないか
  skipFailedRequests?: boolean;     // 失敗したリクエストをカウントしないか
}

/**
 * レート制限情報
 */
interface RateLimitInfo {
  count: number;
  resetTime: number;
  windowStart: number;
}

/**
 * レート制限エラーレスポンス
 */
interface RateLimitErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: {
      limit: number;
      windowMs: number;
      resetTime: number;
      retryAfter: number;
    };
  };
  metadata: {
    timestamp: Date;
    version: string;
  };
}

/**
 * インメモリレート制限ストア
 * 本番環境ではRedisを使用することを推奨
 */
class MemoryStore {
  private store: Map<string, RateLimitInfo> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 5分ごとに期限切れエントリをクリーンアップ
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * レート制限情報を取得・更新
   */
  hit(key: string, windowMs: number): RateLimitInfo {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || now - existing.windowStart >= windowMs) {
      // 新しい時間窓を開始
      const info: RateLimitInfo = {
        count: 1,
        resetTime: now + windowMs,
        windowStart: now
      };
      this.store.set(key, info);
      return info;
    } else {
      // 既存の時間窓内でカウントを増加
      existing.count++;
      this.store.set(key, existing);
      return existing;
    }
  }

  /**
   * 期限切れエントリのクリーンアップ
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, info] of this.store.entries()) {
      if (now >= info.resetTime) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.store.delete(key);
    });

    if (keysToDelete.length > 0) {
      console.log(`レート制限ストアから${keysToDelete.length}件の期限切れエントリを削除しました`);
    }
  }

  /**
   * リソースクリーンアップ
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// グローバルストアインスタンス
const globalStore = new MemoryStore();

/**
 * レート制限ミドルウェア
 */
export function rateLimitMiddleware(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    message = 'リクエスト数が制限を超えました。しばらく待ってから再試行してください。',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    // クライアント識別子を生成（IPアドレス + ユーザーID）
    const clientId = getClientIdentifier(req);
    const key = `rate_limit:${clientId}:${req.route?.path || req.path}`;

    // レート制限チェック
    const rateLimitInfo = globalStore.hit(key, windowMs);

    // レスポンスヘッダーを設定
    res.set({
      'X-RateLimit-Limit': max.toString(),
      'X-RateLimit-Remaining': Math.max(0, max - rateLimitInfo.count).toString(),
      'X-RateLimit-Reset': new Date(rateLimitInfo.resetTime).toISOString(),
      'X-RateLimit-Window': windowMs.toString()
    });

    // 制限を超えた場合
    if (rateLimitInfo.count > max) {
      const retryAfter = Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000);
      
      res.set('Retry-After', retryAfter.toString());

      const response: RateLimitErrorResponse = {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          details: {
            limit: max,
            windowMs,
            resetTime: rateLimitInfo.resetTime,
            retryAfter
          }
        },
        metadata: {
          timestamp: new Date(),
          version: '1.0.0'
        }
      };

      console.warn(`レート制限超過: ${clientId}, パス: ${req.path}, カウント: ${rateLimitInfo.count}/${max}`);
      res.status(429).json(response);
      return;
    }

    // 成功/失敗時のカウント調整
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalSend = res.send;
      res.send = function(body) {
        const statusCode = res.statusCode;
        const isSuccess = statusCode >= 200 && statusCode < 300;
        const isFailure = statusCode >= 400;

        // カウントを調整（必要に応じて減算）
        if ((skipSuccessfulRequests && isSuccess) || (skipFailedRequests && isFailure)) {
          const currentInfo = globalStore.hit(key, windowMs);
          if (currentInfo.count > 0) {
            currentInfo.count--;
          }
        }

        return originalSend.call(this, body);
      };
    }

    next();
  };
}

/**
 * クライアント識別子を生成
 */
function getClientIdentifier(req: Request): string {
  // ユーザーIDがある場合は使用
  const userId = (req as any).user?.id || (req as any).userId;
  if (userId) {
    return `user:${userId}`;
  }

  // IPアドレスを使用（プロキシ経由の場合も考慮）
  const forwarded = req.get('X-Forwarded-For');
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || req.connection.remoteAddress;
  
  return `ip:${ip}`;
}

/**
 * 特定のクライアントのレート制限をリセット
 */
export function resetRateLimit(clientId: string, path?: string): void {
  const key = path ? `rate_limit:${clientId}:${path}` : `rate_limit:${clientId}`;
  
  if (path) {
    // 特定のパスのみリセット
    globalStore['store'].delete(key);
  } else {
    // 該当クライアントの全パスをリセット
    const keysToDelete: string[] = [];
    for (const storeKey of globalStore['store'].keys()) {
      if (storeKey.startsWith(`rate_limit:${clientId}:`)) {
        keysToDelete.push(storeKey);
      }
    }
    keysToDelete.forEach(k => globalStore['store'].delete(k));
  }
}

/**
 * 全レート制限をクリア（テスト用）
 */
export function clearAllRateLimits(): void {
  globalStore['store'].clear();
}

/**
 * レート制限統計情報を取得
 */
export function getRateLimitStats(): { totalClients: number; totalEntries: number } {
  const store = globalStore['store'];
  const clients = new Set<string>();
  
  for (const key of store.keys()) {
    const clientId = key.split(':')[1];
    if (clientId) {
      clients.add(clientId);
    }
  }

  return {
    totalClients: clients.size,
    totalEntries: store.size
  };
}

// プロセス終了時のクリーンアップ
process.on('SIGTERM', () => {
  globalStore.destroy();
});

process.on('SIGINT', () => {
  globalStore.destroy();
});