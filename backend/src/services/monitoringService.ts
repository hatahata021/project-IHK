import { CloudWatchClient, PutMetricDataCommand, MetricDatum, Dimension } from '@aws-sdk/client-cloudwatch';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from './loggerService';
import * as os from 'os';
import * as fs from 'fs';

/**
 * メトリクスの型定義
 */
export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  process: {
    heapTotal: number;
    heapUsed: number;
    heapUsage: number;
    uptime: number;
    pid: number;
  };
}

/**
 * アラート設定の型定義
 */
export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    errorRate: number;
  };
  snsTopicArn?: string;
  cooldownPeriod: number; // 秒
}

/**
 * アラート情報の型定義
 */
export interface AlertInfo {
  type: 'cpu' | 'memory' | 'disk' | 'error';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

/**
 * 監視サービス設定の型定義
 */
interface MonitoringConfig {
  serviceName: string;
  environment: string;
  enableCloudWatch: boolean;
  enableAlerts: boolean;
  metricsInterval: number; // 秒
  region: string;
  namespace: string;
}

/**
 * CloudWatch監視サービス
 * システムメトリクスの収集、CloudWatch送信、アラート機能を提供
 */
export class MonitoringService {
  private cloudWatchClient: CloudWatchClient;
  private snsClient: SNSClient;
  private config: MonitoringConfig;
  private alertConfig: AlertConfig;
  private metricsTimer?: NodeJS.Timeout;
  private lastAlerts: Map<string, number> = new Map();
  private errorCount: number = 0;
  private requestCount: number = 0;

  constructor() {
    // 設定の初期化
    this.config = {
      serviceName: process.env.SERVICE_NAME || 'multilingual-community',
      environment: process.env.NODE_ENV || 'development',
      enableCloudWatch: process.env.ENABLE_CLOUDWATCH_METRICS === 'true',
      enableAlerts: process.env.ENABLE_ALERTS === 'true',
      metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60'), // 1分間隔
      region: process.env.AWS_REGION || 'ap-northeast-1',
      namespace: process.env.CLOUDWATCH_NAMESPACE || 'MultilingualCommunity'
    };

    // アラート設定の初期化
    this.alertConfig = {
      enabled: process.env.ENABLE_ALERTS === 'true',
      thresholds: {
        cpuUsage: parseFloat(process.env.CPU_THRESHOLD || '80'), // 80%
        memoryUsage: parseFloat(process.env.MEMORY_THRESHOLD || '85'), // 85%
        diskUsage: parseFloat(process.env.DISK_THRESHOLD || '90'), // 90%
        errorRate: parseFloat(process.env.ERROR_RATE_THRESHOLD || '5') // 5%
      },
      snsTopicArn: process.env.SNS_TOPIC_ARN,
      cooldownPeriod: parseInt(process.env.ALERT_COOLDOWN || '300') // 5分
    };

    // AWSクライアントの初期化
    this.cloudWatchClient = new CloudWatchClient({
      region: this.config.region
    });

    this.snsClient = new SNSClient({
      region: this.config.region
    });

    // 定期メトリクス収集を開始
    this.startMetricsCollection();

    // プロセス終了時のクリーンアップ
    process.on('SIGTERM', () => this.stop());
    process.on('SIGINT', () => this.stop());
  }

  /**
   * システムメトリクスを収集
   */
  async collectSystemMetrics(): Promise<SystemMetrics> {
    try {
      // CPU使用率の計算
      const cpuUsage = await this.getCpuUsage();
      const loadAverage = os.loadavg();

      // メモリ使用量の計算
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsage = (usedMemory / totalMemory) * 100;

      // ディスク使用量の計算
      const diskStats = await this.getDiskUsage();

      // プロセスメモリ使用量
      const processMemory = process.memoryUsage();
      const heapUsage = (processMemory.heapUsed / processMemory.heapTotal) * 100;

      const metrics: SystemMetrics = {
        cpu: {
          usage: cpuUsage,
          loadAverage
        },
        memory: {
          total: totalMemory,
          used: usedMemory,
          free: freeMemory,
          usage: memoryUsage
        },
        disk: {
          total: diskStats.total,
          used: diskStats.used,
          free: diskStats.free,
          usage: diskStats.usage
        },
        process: {
          heapTotal: processMemory.heapTotal,
          heapUsed: processMemory.heapUsed,
          heapUsage,
          uptime: process.uptime(),
          pid: process.pid
        }
      };

      logger.debug('System metrics collected', { metrics });
      return metrics;

    } catch (error) {
      logger.error('Failed to collect system metrics', error as Error);
      throw error;
    }
  }

  /**
   * CPU使用率を取得（簡易版）
   */
  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        
        const totalTime = (endTime - startTime) * 1000; // マイクロ秒に変換
        const cpuTime = endUsage.user + endUsage.system;
        const cpuUsage = (cpuTime / totalTime) * 100;

        resolve(Math.min(cpuUsage, 100)); // 100%を上限とする
      }, 100);
    });
  }

  /**
   * ディスク使用量を取得
   */
  private async getDiskUsage(): Promise<{ total: number; used: number; free: number; usage: number }> {
    try {
      const stats = await fs.promises.statfs('./');
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      const used = total - free;
      const usage = (used / total) * 100;

      return { total, used, free, usage };
    } catch (error) {
      // ファイルシステム情報が取得できない場合のフォールバック
      logger.warn('Failed to get disk usage, using fallback', { error: (error as Error).message });
      return { total: 0, used: 0, free: 0, usage: 0 };
    }
  }

  /**
   * CloudWatchにメトリクスを送信
   */
  async sendMetricsToCloudWatch(metrics: SystemMetrics): Promise<void> {
    if (!this.config.enableCloudWatch) {
      return;
    }

    try {
      const timestamp = new Date();
      const dimensions: Dimension[] = [
        { Name: 'Service', Value: this.config.serviceName },
        { Name: 'Environment', Value: this.config.environment },
        { Name: 'InstanceId', Value: `${os.hostname()}-${process.pid}` }
      ];

      const metricData: MetricDatum[] = [
        // CPU メトリクス
        {
          MetricName: 'CPUUtilization',
          Value: metrics.cpu.usage,
          Unit: 'Percent',
          Timestamp: timestamp,
          Dimensions: dimensions
        },
        {
          MetricName: 'LoadAverage1m',
          Value: metrics.cpu.loadAverage[0],
          Unit: 'Count',
          Timestamp: timestamp,
          Dimensions: dimensions
        },
        // メモリメトリクス
        {
          MetricName: 'MemoryUtilization',
          Value: metrics.memory.usage,
          Unit: 'Percent',
          Timestamp: timestamp,
          Dimensions: dimensions
        },
        {
          MetricName: 'MemoryUsed',
          Value: metrics.memory.used,
          Unit: 'Bytes',
          Timestamp: timestamp,
          Dimensions: dimensions
        },
        // ディスクメトリクス
        {
          MetricName: 'DiskUtilization',
          Value: metrics.disk.usage,
          Unit: 'Percent',
          Timestamp: timestamp,
          Dimensions: dimensions
        },
        // プロセスメトリクス
        {
          MetricName: 'HeapUtilization',
          Value: metrics.process.heapUsage,
          Unit: 'Percent',
          Timestamp: timestamp,
          Dimensions: dimensions
        },
        {
          MetricName: 'ProcessUptime',
          Value: metrics.process.uptime,
          Unit: 'Seconds',
          Timestamp: timestamp,
          Dimensions: dimensions
        },
        // エラー率メトリクス
        {
          MetricName: 'ErrorRate',
          Value: this.calculateErrorRate(),
          Unit: 'Percent',
          Timestamp: timestamp,
          Dimensions: dimensions
        },
        // リクエスト数メトリクス
        {
          MetricName: 'RequestCount',
          Value: this.requestCount,
          Unit: 'Count',
          Timestamp: timestamp,
          Dimensions: dimensions
        }
      ];

      const command = new PutMetricDataCommand({
        Namespace: this.config.namespace,
        MetricData: metricData
      });

      await this.cloudWatchClient.send(command);
      
      logger.debug('Metrics sent to CloudWatch', { 
        namespace: this.config.namespace,
        metricCount: metricData.length 
      });

      // カウンターをリセット
      this.resetCounters();

    } catch (error) {
      logger.error('Failed to send metrics to CloudWatch', error as Error);
    }
  }

  /**
   * アラートをチェックして通知
   */
  async checkAndSendAlerts(metrics: SystemMetrics): Promise<void> {
    if (!this.alertConfig.enabled) {
      return;
    }

    const alerts: AlertInfo[] = [];

    // CPU使用率チェック
    if (metrics.cpu.usage > this.alertConfig.thresholds.cpuUsage) {
      alerts.push({
        type: 'cpu',
        severity: metrics.cpu.usage > 95 ? 'critical' : 'warning',
        message: `CPU使用率が高くなっています: ${metrics.cpu.usage.toFixed(1)}%`,
        value: metrics.cpu.usage,
        threshold: this.alertConfig.thresholds.cpuUsage,
        timestamp: new Date()
      });
    }

    // メモリ使用率チェック
    if (metrics.memory.usage > this.alertConfig.thresholds.memoryUsage) {
      alerts.push({
        type: 'memory',
        severity: metrics.memory.usage > 95 ? 'critical' : 'warning',
        message: `メモリ使用率が高くなっています: ${metrics.memory.usage.toFixed(1)}%`,
        value: metrics.memory.usage,
        threshold: this.alertConfig.thresholds.memoryUsage,
        timestamp: new Date()
      });
    }

    // ディスク使用率チェック
    if (metrics.disk.usage > this.alertConfig.thresholds.diskUsage) {
      alerts.push({
        type: 'disk',
        severity: metrics.disk.usage > 98 ? 'critical' : 'warning',
        message: `ディスク使用率が高くなっています: ${metrics.disk.usage.toFixed(1)}%`,
        value: metrics.disk.usage,
        threshold: this.alertConfig.thresholds.diskUsage,
        timestamp: new Date()
      });
    }

    // エラー率チェック
    const errorRate = this.calculateErrorRate();
    if (errorRate > this.alertConfig.thresholds.errorRate) {
      alerts.push({
        type: 'error',
        severity: errorRate > 20 ? 'critical' : 'warning',
        message: `エラー率が高くなっています: ${errorRate.toFixed(1)}%`,
        value: errorRate,
        threshold: this.alertConfig.thresholds.errorRate,
        timestamp: new Date()
      });
    }

    // アラートを送信
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  /**
   * アラートを送信
   */
  private async sendAlert(alert: AlertInfo): Promise<void> {
    const alertKey = `${alert.type}-${alert.severity}`;
    const now = Date.now();
    const lastAlert = this.lastAlerts.get(alertKey);

    // クールダウン期間中はアラートを送信しない
    if (lastAlert && (now - lastAlert) < (this.alertConfig.cooldownPeriod * 1000)) {
      return;
    }

    try {
      // ログに記録
      logger.warn(`Alert: ${alert.message}`, {
        type: alert.type,
        severity: alert.severity,
        value: alert.value,
        threshold: alert.threshold
      });

      // SNS通知（設定されている場合）
      if (this.alertConfig.snsTopicArn) {
        const message = {
          service: this.config.serviceName,
          environment: this.config.environment,
          alert: alert,
          timestamp: alert.timestamp.toISOString(),
          hostname: os.hostname(),
          pid: process.pid
        };

        const command = new PublishCommand({
          TopicArn: this.alertConfig.snsTopicArn,
          Subject: `[${alert.severity.toUpperCase()}] ${this.config.serviceName} - ${alert.type} Alert`,
          Message: JSON.stringify(message, null, 2)
        });

        await this.snsClient.send(command);
        logger.info('Alert sent via SNS', { alertType: alert.type, severity: alert.severity });
      }

      // 最後のアラート時刻を記録
      this.lastAlerts.set(alertKey, now);

    } catch (error) {
      logger.error('Failed to send alert', error as Error, { alert });
    }
  }

  /**
   * エラー率を計算
   */
  private calculateErrorRate(): number {
    if (this.requestCount === 0) {
      return 0;
    }
    return (this.errorCount / this.requestCount) * 100;
  }

  /**
   * カウンターをリセット
   */
  private resetCounters(): void {
    this.errorCount = 0;
    this.requestCount = 0;
  }

  /**
   * リクエスト数をインクリメント
   */
  incrementRequestCount(): void {
    this.requestCount++;
  }

  /**
   * エラー数をインクリメント
   */
  incrementErrorCount(): void {
    this.errorCount++;
  }

  /**
   * 定期メトリクス収集を開始
   */
  private startMetricsCollection(): void {
    if (this.metricsTimer) {
      return;
    }

    logger.info('Starting metrics collection', {
      interval: this.config.metricsInterval,
      cloudWatchEnabled: this.config.enableCloudWatch,
      alertsEnabled: this.alertConfig.enabled
    });

    this.metricsTimer = setInterval(async () => {
      try {
        const metrics = await this.collectSystemMetrics();
        
        // CloudWatchに送信
        await this.sendMetricsToCloudWatch(metrics);
        
        // アラートチェック
        await this.checkAndSendAlerts(metrics);

      } catch (error) {
        logger.error('Error in metrics collection cycle', error as Error);
      }
    }, this.config.metricsInterval * 1000);
  }

  /**
   * 監視を停止
   */
  stop(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
      logger.info('Metrics collection stopped');
    }
  }

  /**
   * 設定を取得
   */
  getConfig(): { monitoring: MonitoringConfig; alerts: AlertConfig } {
    return {
      monitoring: { ...this.config },
      alerts: { ...this.alertConfig }
    };
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<MonitoringConfig & { alerts: Partial<AlertConfig> }>): void {
    if (newConfig.alerts) {
      this.alertConfig = { ...this.alertConfig, ...newConfig.alerts };
      delete newConfig.alerts;
    }
    
    this.config = { ...this.config, ...newConfig };
    
    // メトリクス収集間隔が変更された場合は再起動
    if (newConfig.metricsInterval !== undefined) {
      this.stop();
      this.startMetricsCollection();
    }

    logger.info('Monitoring configuration updated', { config: this.config, alerts: this.alertConfig });
  }

  /**
   * 現在のメトリクスを取得（API用）
   */
  async getCurrentMetrics(): Promise<SystemMetrics> {
    return await this.collectSystemMetrics();
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<{ status: string; message: string; metrics?: SystemMetrics }> {
    try {
      const metrics = await this.collectSystemMetrics();
      
      // 重要なメトリクスをチェック
      const issues: string[] = [];
      
      if (metrics.cpu.usage > 90) {
        issues.push(`High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`);
      }
      
      if (metrics.memory.usage > 90) {
        issues.push(`High memory usage: ${metrics.memory.usage.toFixed(1)}%`);
      }
      
      if (metrics.disk.usage > 95) {
        issues.push(`High disk usage: ${metrics.disk.usage.toFixed(1)}%`);
      }

      const status = issues.length > 0 ? 'warning' : 'healthy';
      const message = issues.length > 0 
        ? `System issues detected: ${issues.join(', ')}`
        : 'All systems operating normally';

      return { status, message, metrics };

    } catch (error) {
      logger.error('Monitoring health check failed', error as Error);
      return {
        status: 'unhealthy',
        message: `Monitoring system error: ${(error as Error).message}`
      };
    }
  }
}

// シングルトンインスタンスをエクスポート
export const monitoringService = new MonitoringService();