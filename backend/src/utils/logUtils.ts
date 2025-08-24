import { logger, LogLevel } from '../services/loggerService';

/**
 * ログユーティリティ関数
 */

/**
 * 実行時間を測定してログに記録するデコレータ
 */
export function logExecutionTime(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const startTime = Date.now();
    const className = target.constructor.name;
    const methodName = `${className}.${propertyName}`;

    try {
      logger.debug(`Starting ${methodName}`, { args: args.length });
      
      const result = await method.apply(this, args);
      const duration = Date.now() - startTime;
      
      logger.performance(
        `Method execution completed: ${methodName}`,
        duration,
        { 
          className,
          methodName,
          argsCount: args.length,
          success: true
        }
      );
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(
        `Method execution failed: ${methodName}`,
        error as Error,
        {
          className,
          methodName,
          argsCount: args.length,
          duration
        }
      );
      
      throw error;
    }
  };

  return descriptor;
}

/**
 * 非同期処理のエラーをキャッチしてログに記録
 */
export async function logAsyncError<T>(
  operation: string,
  asyncFunction: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T | null> {
  try {
    logger.debug(`Starting async operation: ${operation}`, metadata);
    const result = await asyncFunction();
    logger.debug(`Async operation completed: ${operation}`, metadata);
    return result;
  } catch (error) {
    logger.error(
      `Async operation failed: ${operation}`,
      error as Error,
      metadata
    );
    return null;
  }
}

/**
 * 条件付きログ出力
 */
export function logIf(condition: boolean, level: LogLevel, message: string, metadata?: Record<string, any>): void {
  if (!condition) return;

  switch (level) {
    case LogLevel.ERROR:
      logger.error(message, undefined, metadata);
      break;
    case LogLevel.WARN:
      logger.warn(message, metadata);
      break;
    case LogLevel.INFO:
      logger.info(message, metadata);
      break;
    case LogLevel.DEBUG:
      logger.debug(message, metadata);
      break;
  }
}

/**
 * オブジェクトの変更をログに記録
 */
export function logObjectChange(
  objectName: string,
  oldValue: any,
  newValue: any,
  userId?: string,
  requestId?: string
): void {
  const changes: Record<string, { old: any; new: any }> = {};
  
  // 変更された属性を特定
  const allKeys = new Set([...Object.keys(oldValue || {}), ...Object.keys(newValue || {})]);
  
  for (const key of allKeys) {
    const oldVal = oldValue?.[key];
    const newVal = newValue?.[key];
    
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal, new: newVal };
    }
  }

  if (Object.keys(changes).length > 0) {
    logger.info(
      `Object changed: ${objectName}`,
      {
        objectName,
        changes,
        changeCount: Object.keys(changes).length
      },
      requestId,
      userId
    );
  }
}

/**
 * 配列の変更をログに記録
 */
export function logArrayChange(
  arrayName: string,
  oldArray: any[],
  newArray: any[],
  userId?: string,
  requestId?: string
): void {
  const metadata = {
    arrayName,
    oldLength: oldArray?.length || 0,
    newLength: newArray?.length || 0,
    added: newArray?.filter(item => !oldArray?.includes(item)) || [],
    removed: oldArray?.filter(item => !newArray?.includes(item)) || []
  };

  logger.info(
    `Array changed: ${arrayName}`,
    metadata,
    requestId,
    userId
  );
}

/**
 * メモリ使用量をログに記録
 */
export function logMemoryUsage(operation?: string): void {
  const memoryUsage = process.memoryUsage();
  const formatBytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

  logger.info(
    `Memory usage${operation ? ` after ${operation}` : ''}`,
    {
      rss: formatBytes(memoryUsage.rss),
      heapTotal: formatBytes(memoryUsage.heapTotal),
      heapUsed: formatBytes(memoryUsage.heapUsed),
      external: formatBytes(memoryUsage.external),
      arrayBuffers: formatBytes(memoryUsage.arrayBuffers)
    }
  );
}

/**
 * CPU使用率をログに記録（簡易版）
 */
export function logCpuUsage(operation?: string): void {
  const cpuUsage = process.cpuUsage();
  
  logger.info(
    `CPU usage${operation ? ` after ${operation}` : ''}`,
    {
      user: cpuUsage.user,
      system: cpuUsage.system,
      total: cpuUsage.user + cpuUsage.system
    }
  );
}

/**
 * データベース操作をログに記録
 */
export function logDatabaseOperation(
  operation: string,
  table: string,
  duration: number,
  success: boolean,
  recordCount?: number,
  error?: Error,
  userId?: string,
  requestId?: string
): void {
  const message = `Database ${operation} on ${table} ${success ? 'succeeded' : 'failed'}`;
  const metadata = {
    operation,
    table,
    duration,
    recordCount,
    success
  };

  if (success) {
    logger.info(message, metadata, requestId, userId);
  } else {
    logger.error(message, error, metadata, requestId, userId);
  }
}

/**
 * 外部API呼び出しをログに記録
 */
export function logExternalApiCall(
  service: string,
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number,
  success: boolean,
  error?: Error,
  userId?: string,
  requestId?: string
): void {
  const message = `External API call to ${service} ${success ? 'succeeded' : 'failed'}`;
  const metadata = {
    service,
    endpoint,
    method,
    duration,
    statusCode,
    success
  };

  if (success) {
    logger.info(message, metadata, requestId, userId);
  } else {
    logger.error(message, error, metadata, requestId, userId);
  }
}

/**
 * キャッシュ操作をログに記録
 */
export function logCacheOperation(
  operation: 'hit' | 'miss' | 'set' | 'delete' | 'clear',
  key: string,
  duration?: number,
  size?: number,
  userId?: string,
  requestId?: string
): void {
  logger.debug(
    `Cache ${operation}: ${key}`,
    {
      operation,
      key,
      duration,
      size
    },
    requestId,
    userId
  );
}

/**
 * セキュリティイベントをログに記録
 */
export function logSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, any>,
  userId?: string,
  requestId?: string
): void {
  const message = `Security event: ${event}`;
  const metadata = {
    event,
    severity,
    ...details
  };

  switch (severity) {
    case 'critical':
    case 'high':
      logger.error(message, undefined, metadata, requestId, userId);
      break;
    case 'medium':
      logger.warn(message, metadata, requestId, userId);
      break;
    default:
      logger.info(message, metadata, requestId, userId);
  }
}

/**
 * ビジネスメトリクスをログに記録
 */
export function logBusinessMetric(
  metric: string,
  value: number,
  unit: string,
  metadata?: Record<string, any>,
  userId?: string,
  requestId?: string
): void {
  logger.info(
    `Business metric: ${metric} = ${value} ${unit}`,
    {
      metric,
      value,
      unit,
      ...metadata
    },
    requestId,
    userId
  );
}

/**
 * ログレベルを動的に変更
 */
export function setLogLevel(level: LogLevel): void {
  logger.updateConfig({ logLevel: level });
  logger.info(`Log level changed to ${level}`);
}

/**
 * ログ統計情報を取得
 */
export function getLogStats(): Record<string, any> {
  const config = logger.getConfig();
  const memoryUsage = process.memoryUsage();
  
  return {
    config,
    memoryUsage: {
      rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + ' MB',
      heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
      heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB'
    },
    uptime: process.uptime(),
    pid: process.pid,
    version: process.version,
    platform: process.platform
  };
}