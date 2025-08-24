import { Request, Response, NextFunction } from 'express';
import { monitoringService } from '../services/monitoringService';
import { logger } from '../services/loggerService';

/**
 * 監視ミドルウェア
 * リクエスト数とエラー数をカウントして監視サービスに送信
 */
export function monitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
  // リクエスト数をインクリメント
  monitoringService.incrementRequestCount();

  // レスポンス完了時にエラーチェック
  const originalSend = res.send;
  res.send = function(body) {
    // エラーレスポンスの場合はエラー数をインクリメント
    if (res.statusCode >= 400) {
      monitoringService.incrementErrorCount();
    }

    return originalSend.call(this, body);
  };

  next();
}

/**
 * システムリソース監視ミドルウェア
 * 重いリクエストを検出してアラートを発生
 */
export function resourceMonitoringMiddleware(threshold: number = 2000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    // レスポンス完了時にリソース使用量をチェック
    const originalSend = res.send;
    res.send = function(body) {
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;

      // 閾値を超えた場合は警告ログ
      if (duration > threshold) {
        logger.warn(
          `Heavy request detected: ${req.method} ${req.originalUrl}`,
          {
            duration,
            threshold,
            memoryDiff,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          }
        );
      }

      // メモリ使用量が大幅に増加した場合も警告
      if (memoryDiff > 50 * 1024 * 1024) { // 50MB以上
        logger.warn(
          `High memory usage request: ${req.method} ${req.originalUrl}`,
          {
            duration,
            memoryDiff: `${(memoryDiff / 1024 / 1024).toFixed(2)} MB`,
            statusCode: res.statusCode
          }
        );
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * ヘルスチェック用のメトリクス収集ミドルウェア
 */
export function healthMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // ヘルスチェックエンドポイントの場合は詳細メトリクスを追加
  if (req.path === '/health' || req.path.includes('/health')) {
    const originalSend = res.send;
    res.send = function(body) {
      // レスポンスにシステムメトリクスを追加
      if (res.statusCode === 200 && typeof body === 'string') {
        try {
          const responseData = JSON.parse(body);
          
          // 基本的なシステム情報を追加
          responseData.system = {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            pid: process.pid,
            platform: process.platform,
            nodeVersion: process.version
          };

          return originalSend.call(this, JSON.stringify(responseData));
        } catch (error) {
          // JSON解析に失敗した場合はそのまま返す
          return originalSend.call(this, body);
        }
      }

      return originalSend.call(this, body);
    };
  }

  next();
}

/**
 * アラート条件チェックミドルウェア
 */
export function alertCheckMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 特定の条件でアラートをチェック
  const originalSend = res.send;
  res.send = function(body) {
    const statusCode = res.statusCode;

    // 重大なエラーの場合は即座にアラートチェック
    if (statusCode >= 500) {
      setImmediate(async () => {
        try {
          const metrics = await monitoringService.getCurrentMetrics();
          await monitoringService.checkAndSendAlerts(metrics);
        } catch (error) {
          logger.error('Failed to check alerts after server error', error as Error);
        }
      });
    }

    // 認証エラーが多発している場合の検出
    if (statusCode === 401 || statusCode === 403) {
      // 簡易的な認証エラー検出（実際の実装ではより詳細な分析が必要）
      logger.warn(
        'Authentication/Authorization error detected',
        {
          statusCode,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }
      );
    }

    return originalSend.call(this, body);
  };

  next();
}

/**
 * カスタムメトリクス収集ミドルウェア
 */
export class CustomMetricsCollector {
  private static metrics: Map<string, number> = new Map();

  /**
   * カスタムメトリクスを記録
   */
  static recordMetric(name: string, value: number): void {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
  }

  /**
   * カスタムメトリクスを取得
   */
  static getMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.metrics.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * カスタムメトリクスをリセット
   */
  static resetMetrics(): void {
    this.metrics.clear();
  }

  /**
   * 特定のエンドポイントの使用量を記録するミドルウェア
   */
  static endpointUsageMiddleware(req: Request, res: Response, next: NextFunction): void {
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    
    // エンドポイント使用回数をカウント
    CustomMetricsCollector.recordMetric(`endpoint.${endpoint}.count`, 1);

    const startTime = Date.now();
    const originalSend = res.send;
    
    res.send = function(body) {
      const duration = Date.now() - startTime;
      
      // レスポンス時間を記録
      CustomMetricsCollector.recordMetric(`endpoint.${endpoint}.duration`, duration);
      
      // ステータスコード別カウント
      const statusGroup = Math.floor(res.statusCode / 100) * 100;
      CustomMetricsCollector.recordMetric(`endpoint.${endpoint}.status.${statusGroup}`, 1);

      return originalSend.call(this, body);
    };

    next();
  }
}

/**
 * 監視データを定期的にログ出力するヘルパー
 */
export class MonitoringReporter {
  private static reportTimer?: NodeJS.Timeout;

  /**
   * 定期レポートを開始
   */
  static startPeriodicReporting(intervalMinutes: number = 5): void {
    if (this.reportTimer) {
      return;
    }

    logger.info('Starting periodic monitoring reports', { intervalMinutes });

    this.reportTimer = setInterval(async () => {
      try {
        // システムメトリクスを取得
        const systemMetrics = await monitoringService.getCurrentMetrics();
        
        // カスタムメトリクスを取得
        const customMetrics = CustomMetricsCollector.getMetrics();

        // レポートをログ出力
        logger.info('Periodic monitoring report', {
          system: {
            cpu: `${systemMetrics.cpu.usage.toFixed(1)}%`,
            memory: `${systemMetrics.memory.usage.toFixed(1)}%`,
            disk: `${systemMetrics.disk.usage.toFixed(1)}%`,
            heap: `${systemMetrics.process.heapUsage.toFixed(1)}%`,
            uptime: `${Math.floor(systemMetrics.process.uptime / 60)} minutes`
          },
          custom: customMetrics
        });

        // カスタムメトリクスをリセット
        CustomMetricsCollector.resetMetrics();

      } catch (error) {
        logger.error('Failed to generate monitoring report', error as Error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * 定期レポートを停止
   */
  static stopPeriodicReporting(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = undefined;
      logger.info('Periodic monitoring reports stopped');
    }
  }
}

/**
 * 緊急時のシステム状態ダンプ
 */
export async function emergencySystemDump(): Promise<void> {
  try {
    logger.error('EMERGENCY: System state dump initiated', {
      timestamp: new Date().toISOString(),
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      loadAverage: require('os').loadavg(),
      platform: process.platform,
      nodeVersion: process.version
    });

    // システムメトリクスも記録
    const metrics = await monitoringService.getCurrentMetrics();
    logger.error('EMERGENCY: Current system metrics', { metrics });

    // カスタムメトリクスも記録
    const customMetrics = CustomMetricsCollector.getMetrics();
    logger.error('EMERGENCY: Custom metrics', { customMetrics });

  } catch (error) {
    logger.error('Failed to generate emergency system dump', error as Error);
  }
}

// プロセス終了時のクリーンアップ
process.on('SIGTERM', () => {
  MonitoringReporter.stopPeriodicReporting();
});

process.on('SIGINT', () => {
  MonitoringReporter.stopPeriodicReporting();
});

// 未処理の例外やPromise拒否時の緊急ダンプ
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception detected', error);
  await emergencySystemDump();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Promise Rejection detected', reason as Error, { promise });
  await emergencySystemDump();
});