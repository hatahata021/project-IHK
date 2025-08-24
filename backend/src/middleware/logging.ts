import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/loggerService';
import { v4 as uuidv4 } from 'uuid';

/**
 * 拡張されたRequestオブジェクト（ログ用）
 */
export interface LoggingRequest extends Request {
  requestId: string;
  startTime: number;
}

/**
 * アクセスログミドルウェア
 * 全てのHTTPリクエストのアクセスログを記録
 */
export function accessLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const loggingReq = req as LoggingRequest;
  
  // リクエストIDを生成
  loggingReq.requestId = uuidv4();
  loggingReq.startTime = Date.now();

  // レスポンス完了時にアクセスログを出力
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - loggingReq.startTime;
    const userId = (req as any).user?.id;
    const userAgent = req.get('User-Agent');

    logger.access(
      req.method,
      req.originalUrl,
      res.statusCode,
      duration,
      loggingReq.requestId,
      userId,
      userAgent
    );

    return originalSend.call(this, body);
  };

  // リクエスト開始ログ
  logger.info(
    `Request started: ${req.method} ${req.originalUrl}`,
    {
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      headers: {
        'content-type': req.get('Content-Type'),
        'content-length': req.get('Content-Length')
      }
    },
    loggingReq.requestId,
    (req as any).user?.id
  );

  next();
}

/**
 * エラーログミドルウェア
 * 未処理のエラーをキャッチしてログに記録
 */
export function errorLogMiddleware(error: any, req: Request, res: Response, next: NextFunction): void {
  const loggingReq = req as LoggingRequest;
  const userId = (req as any).user?.id;

  // エラーログを出力
  logger.error(
    `Unhandled error in ${req.method} ${req.originalUrl}`,
    error,
    {
      method: req.method,
      url: req.originalUrl,
      statusCode: error.status || 500,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      body: req.body,
      params: req.params,
      query: req.query
    },
    loggingReq.requestId,
    userId
  );

  // エラーレスポンスを送信
  const statusCode = error.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : error.message;

  res.status(statusCode).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message,
      requestId: loggingReq.requestId
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: loggingReq.requestId
    }
  });
}

/**
 * パフォーマンスログミドルウェア
 * 遅いリクエストを検出してログに記録
 */
export function performanceLogMiddleware(threshold: number = 1000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const loggingReq = req as LoggingRequest;
    
    // レスポンス完了時にパフォーマンスをチェック
    const originalSend = res.send;
    res.send = function(body) {
      const duration = Date.now() - loggingReq.startTime;
      
      // 閾値を超えた場合はパフォーマンスログを出力
      if (duration > threshold) {
        const userId = (req as any).user?.id;
        
        logger.performance(
          `Slow request: ${req.method} ${req.originalUrl}`,
          duration,
          {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            threshold,
            memoryUsage: process.memoryUsage()
          },
          loggingReq.requestId,
          userId
        );
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * セキュリティログミドルウェア
 * セキュリティ関連のイベントをログに記録
 */
export function securityLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const loggingReq = req as LoggingRequest;
  const userId = (req as any).user?.id;

  // 認証失敗の検出
  const originalStatus = res.status;
  res.status = function(code: number) {
    if (code === 401 || code === 403) {
      logger.warn(
        `Security event: ${code === 401 ? 'Authentication' : 'Authorization'} failed`,
        {
          method: req.method,
          url: req.originalUrl,
          statusCode: code,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          authHeader: req.get('Authorization') ? 'present' : 'missing'
        },
        loggingReq.requestId,
        userId
      );
    }
    
    return originalStatus.call(this, code);
  };

  // 疑わしいリクエストの検出
  const suspiciousPatterns = [
    /\.\./,           // パストラバーサル
    /<script/i,       // XSS
    /union.*select/i, // SQLインジェクション
    /javascript:/i    // JavaScript URL
  ];

  const requestData = JSON.stringify({
    url: req.originalUrl,
    body: req.body,
    query: req.query
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      logger.warn(
        'Security event: Suspicious request pattern detected',
        {
          pattern: pattern.toString(),
          method: req.method,
          url: req.originalUrl,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          matchedData: requestData.substring(0, 500) // 最初の500文字のみ
        },
        loggingReq.requestId,
        userId
      );
      break;
    }
  }

  next();
}

/**
 * ビジネスログ用のヘルパー関数
 */
export class BusinessLogger {
  
  /**
   * ユーザー認証ログ
   */
  static logUserAuthentication(userId: string, method: string, success: boolean, requestId?: string, metadata?: Record<string, any>): void {
    const message = `User authentication ${success ? 'succeeded' : 'failed'}: ${method}`;
    
    if (success) {
      logger.info(message, { method, userId, ...metadata }, requestId, userId);
    } else {
      logger.warn(message, { method, userId, ...metadata }, requestId, userId);
    }
  }

  /**
   * データアクセスログ
   */
  static logDataAccess(operation: string, resource: string, userId?: string, requestId?: string, metadata?: Record<string, any>): void {
    logger.info(
      `Data access: ${operation} ${resource}`,
      { operation, resource, ...metadata },
      requestId,
      userId
    );
  }

  /**
   * 翻訳処理ログ
   */
  static logTranslation(sourceLanguage: string, targetLanguage: string, textLength: number, fromCache: boolean, duration: number, userId?: string, requestId?: string): void {
    logger.info(
      `Translation completed: ${sourceLanguage} -> ${targetLanguage}`,
      {
        sourceLanguage,
        targetLanguage,
        textLength,
        fromCache,
        duration
      },
      requestId,
      userId
    );
  }

  /**
   * ファイルアップロードログ
   */
  static logFileUpload(fileName: string, fileSize: number, fileType: string, success: boolean, userId?: string, requestId?: string, error?: string): void {
    const message = `File upload ${success ? 'succeeded' : 'failed'}: ${fileName}`;
    
    const metadata = {
      fileName,
      fileSize,
      fileType,
      error
    };

    if (success) {
      logger.info(message, metadata, requestId, userId);
    } else {
      logger.error(message, new Error(error || 'File upload failed'), metadata, requestId, userId);
    }
  }

  /**
   * API使用量ログ
   */
  static logApiUsage(endpoint: string, method: string, userId?: string, requestId?: string, metadata?: Record<string, any>): void {
    logger.info(
      `API usage: ${method} ${endpoint}`,
      { endpoint, method, ...metadata },
      requestId,
      userId
    );
  }

  /**
   * システムイベントログ
   */
  static logSystemEvent(event: string, severity: 'info' | 'warn' | 'error', metadata?: Record<string, any>): void {
    const message = `System event: ${event}`;
    
    switch (severity) {
      case 'error':
        logger.error(message, undefined, metadata);
        break;
      case 'warn':
        logger.warn(message, metadata);
        break;
      default:
        logger.info(message, metadata);
    }
  }
}

/**
 * リクエストIDを取得するヘルパー関数
 */
export function getRequestId(req: Request): string {
  return (req as LoggingRequest).requestId || 'unknown';
}

/**
 * ユーザーIDを取得するヘルパー関数
 */
export function getUserId(req: Request): string | undefined {
  return (req as any).user?.id;
}