import { CloudWatchLogsClient, PutLogEventsCommand, CreateLogGroupCommand, CreateLogStreamCommand } from '@aws-sdk/client-cloudwatch-logs';

/**
 * ログレベルの定義
 */
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

/**
 * ログエントリの型定義
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  function: string;
  requestId?: string;
  userId?: string;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
  performance?: {
    duration: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
}

/**
 * ログ設定の型定義
 */
interface LoggerConfig {
  serviceName: string;
  environment: string;
  logLevel: LogLevel;
  enableCloudWatch: boolean;
  enableConsole: boolean;
  cloudWatchLogGroup: string;
  cloudWatchLogStream: string;
  region: string;
}

/**
 * 構造化ログサービス
 * CloudWatch Logs連携とローカルログ出力を提供
 */
export class LoggerService {
  private cloudWatchClient: CloudWatchLogsClient;
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    // 設定の初期化
    this.config = {
      serviceName: process.env.SERVICE_NAME || 'multilingual-community',
      environment: process.env.NODE_ENV || 'development',
      logLevel: this.parseLogLevel(process.env.LOG_LEVEL || 'INFO'),
      enableCloudWatch: process.env.ENABLE_CLOUDWATCH_LOGS === 'true',
      enableConsole: process.env.ENABLE_CONSOLE_LOGS !== 'false',
      cloudWatchLogGroup: process.env.CLOUDWATCH_LOG_GROUP || '/aws/ecs/multilingual-community',
      cloudWatchLogStream: process.env.CLOUDWATCH_LOG_STREAM || `${process.env.SERVICE_NAME || 'api'}-${Date.now()}`,
      region: process.env.AWS_REGION || 'ap-northeast-1'
    };

    // CloudWatch Logsクライアントの初期化
    this.cloudWatchClient = new CloudWatchLogsClient({
      region: this.config.region
    });

    // 定期的なログフラッシュを開始
    this.startPeriodicFlush();

    // プロセス終了時のクリーンアップ
    process.on('SIGTERM', () => this.flush());
    process.on('SIGINT', () => this.flush());
    process.on('beforeExit', () => this.flush());
  }

  /**
   * エラーログを出力
   */
  error(message: string, error?: Error, metadata?: Record<string, any>, requestId?: string, userId?: string): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      service: this.config.serviceName,
      function: this.getCallerFunction(),
      requestId,
      userId,
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      metadata
    };

    this.writeLog(logEntry);
  }

  /**
   * 警告ログを出力
   */
  warn(message: string, metadata?: Record<string, any>, requestId?: string, userId?: string): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      service: this.config.serviceName,
      function: this.getCallerFunction(),
      requestId,
      userId,
      message,
      metadata
    };

    this.writeLog(logEntry);
  }

  /**
   * 情報ログを出力
   */
  info(message: string, metadata?: Record<string, any>, requestId?: string, userId?: string): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      service: this.config.serviceName,
      function: this.getCallerFunction(),
      requestId,
      userId,
      message,
      metadata
    };

    this.writeLog(logEntry);
  }

  /**
   * デバッグログを出力
   */
  debug(message: string, metadata?: Record<string, any>, requestId?: string, userId?: string): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      service: this.config.serviceName,
      function: this.getCallerFunction(),
      requestId,
      userId,
      message,
      metadata
    };

    this.writeLog(logEntry);
  }

  /**
   * アクセスログを出力
   */
  access(method: string, url: string, statusCode: number, duration: number, requestId?: string, userId?: string, userAgent?: string): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      service: this.config.serviceName,
      function: 'access',
      requestId,
      userId,
      message: `${method} ${url} ${statusCode}`,
      metadata: {
        method,
        url,
        statusCode,
        userAgent
      },
      performance: {
        duration
      }
    };

    this.writeLog(logEntry);
  }

  /**
   * パフォーマンスログを出力
   */
  performance(operation: string, duration: number, metadata?: Record<string, any>, requestId?: string, userId?: string): void {
    const memoryUsage = process.memoryUsage();
    
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      service: this.config.serviceName,
      function: this.getCallerFunction(),
      requestId,
      userId,
      message: `Performance: ${operation} completed in ${duration}ms`,
      metadata,
      performance: {
        duration,
        memoryUsage
      }
    };

    this.writeLog(logEntry);
  }

  /**
   * ログエントリを書き込み
   */
  private writeLog(logEntry: LogEntry): void {
    // ログレベルフィルタリング
    if (!this.shouldLog(logEntry.level)) {
      return;
    }

    // コンソール出力
    if (this.config.enableConsole) {
      this.writeToConsole(logEntry);
    }

    // CloudWatch Logs出力
    if (this.config.enableCloudWatch) {
      this.bufferForCloudWatch(logEntry);
    }
  }

  /**
   * コンソールにログを出力
   */
  private writeToConsole(logEntry: LogEntry): void {
    const logString = JSON.stringify(logEntry, null, this.config.environment === 'development' ? 2 : 0);
    
    switch (logEntry.level) {
      case LogLevel.ERROR:
        console.error(logString);
        break;
      case LogLevel.WARN:
        console.warn(logString);
        break;
      case LogLevel.DEBUG:
        console.debug(logString);
        break;
      default:
        console.log(logString);
    }
  }

  /**
   * CloudWatch Logs用にバッファリング
   */
  private bufferForCloudWatch(logEntry: LogEntry): void {
    this.logBuffer.push(logEntry);

    // バッファサイズが制限に達した場合は即座にフラッシュ
    if (this.logBuffer.length >= 100) {
      this.flush();
    }
  }

  /**
   * バッファされたログをCloudWatch Logsに送信
   */
  async flush(): Promise<void> {
    if (!this.config.enableCloudWatch || this.logBuffer.length === 0) {
      return;
    }

    try {
      // ログストリームの存在確認・作成
      await this.ensureLogStream();

      // ログイベントの準備
      const logEvents = this.logBuffer.map(entry => ({
        timestamp: new Date(entry.timestamp).getTime(),
        message: JSON.stringify(entry)
      }));

      // CloudWatch Logsに送信
      const command = new PutLogEventsCommand({
        logGroupName: this.config.cloudWatchLogGroup,
        logStreamName: this.config.cloudWatchLogStream,
        logEvents
      });

      await this.cloudWatchClient.send(command);
      
      console.log(`CloudWatch Logsに${this.logBuffer.length}件のログを送信しました`);
      
      // バッファをクリア
      this.logBuffer = [];

    } catch (error) {
      console.error('CloudWatch Logsへのログ送信に失敗しました:', error);
      
      // エラー時はバッファサイズを制限してメモリリークを防ぐ
      if (this.logBuffer.length > 1000) {
        this.logBuffer = this.logBuffer.slice(-500);
      }
    }
  }

  /**
   * ログストリームの存在確認・作成
   */
  private async ensureLogStream(): Promise<void> {
    try {
      // ロググループの作成を試行
      try {
        await this.cloudWatchClient.send(new CreateLogGroupCommand({
          logGroupName: this.config.cloudWatchLogGroup
        }));
      } catch (error: any) {
        // ロググループが既に存在する場合は無視
        if (error.name !== 'ResourceAlreadyExistsException') {
          throw error;
        }
      }

      // ログストリームの作成を試行
      try {
        await this.cloudWatchClient.send(new CreateLogStreamCommand({
          logGroupName: this.config.cloudWatchLogGroup,
          logStreamName: this.config.cloudWatchLogStream
        }));
      } catch (error: any) {
        // ログストリームが既に存在する場合は無視
        if (error.name !== 'ResourceAlreadyExistsException') {
          throw error;
        }
      }
    } catch (error) {
      console.error('CloudWatch Logsの初期化に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 定期的なログフラッシュを開始
   */
  private startPeriodicFlush(): void {
    // 30秒ごとにフラッシュ
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        console.error('定期ログフラッシュでエラーが発生しました:', error);
      });
    }, 30000);
  }

  /**
   * ログレベルの文字列をパース
   */
  private parseLogLevel(level: string): LogLevel {
    const upperLevel = level.toUpperCase();
    if (Object.values(LogLevel).includes(upperLevel as LogLevel)) {
      return upperLevel as LogLevel;
    }
    return LogLevel.INFO;
  }

  /**
   * ログレベルフィルタリング
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const logLevelIndex = levels.indexOf(level);
    
    return logLevelIndex <= currentLevelIndex;
  }

  /**
   * 呼び出し元の関数名を取得
   */
  private getCallerFunction(): string {
    const stack = new Error().stack;
    if (!stack) return 'unknown';

    const lines = stack.split('\n');
    // スタックトレースから適切な呼び出し元を特定
    for (let i = 3; i < lines.length; i++) {
      const line = lines[i];
      if (line && !line.includes('LoggerService') && !line.includes('node_modules')) {
        const match = line.match(/at\s+(.+?)\s+\(/);
        return match ? match[1] : 'unknown';
      }
    }
    
    return 'unknown';
  }

  /**
   * 設定を取得
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('ログ設定を更新しました:', this.config);
  }

  /**
   * リソースクリーンアップ
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // 残りのログをフラッシュ
    this.flush().catch(error => {
      console.error('最終ログフラッシュでエラーが発生しました:', error);
    });
  }
}

// シングルトンインスタンスをエクスポート
export const logger = new LoggerService();