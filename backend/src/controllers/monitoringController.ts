import { Request, Response } from 'express';
import { monitoringService } from '../services/monitoringService';
import { CustomMetricsCollector } from '../middleware/monitoring';
import { getRequestId, getUserId } from '../middleware/logging';
import { logger } from '../services/loggerService';

/**
 * 監視APIコントローラー
 * システムメトリクス取得、アラート管理、監視設定機能を提供
 */
export class MonitoringController {

  /**
   * 現在のシステムメトリクスを取得
   * GET /api/monitoring/metrics
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    const userId = getUserId(req);

    try {
      const systemMetrics = await monitoringService.getCurrentMetrics();
      const customMetrics = CustomMetricsCollector.getMetrics();

      logger.info(
        'System metrics retrieved',
        { endpoint: '/api/monitoring/metrics' },
        requestId,
        userId
      );

      res.status(200).json({
        success: true,
        data: {
          system: systemMetrics,
          custom: customMetrics,
          timestamp: new Date().toISOString()
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

    } catch (error) {
      logger.error(
        'Failed to retrieve system metrics',
        error as Error,
        { endpoint: '/api/monitoring/metrics' },
        requestId,
        userId
      );

      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_ERROR',
          message: 'システムメトリクスの取得に失敗しました'
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }

  /**
   * 監視設定を取得
   * GET /api/monitoring/config
   */
  async getConfig(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    const userId = getUserId(req);

    try {
      const config = monitoringService.getConfig();

      logger.info(
        'Monitoring config retrieved',
        { endpoint: '/api/monitoring/config' },
        requestId,
        userId
      );

      res.status(200).json({
        success: true,
        data: config,
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

    } catch (error) {
      logger.error(
        'Failed to retrieve monitoring config',
        error as Error,
        { endpoint: '/api/monitoring/config' },
        requestId,
        userId
      );

      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: '監視設定の取得に失敗しました'
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }

  /**
   * 監視設定を更新
   * PUT /api/monitoring/config
   */
  async updateConfig(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    const userId = getUserId(req);

    try {
      const { monitoring, alerts } = req.body;

      // バリデーション
      if (monitoring && typeof monitoring !== 'object') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MONITORING_CONFIG',
            message: '監視設定が正しくありません'
          },
          metadata: {
            requestId,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        });
        return;
      }

      if (alerts && typeof alerts !== 'object') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ALERT_CONFIG',
            message: 'アラート設定が正しくありません'
          },
          metadata: {
            requestId,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        });
        return;
      }

      // 設定を更新
      const oldConfig = monitoringService.getConfig();
      const updateData: any = {};
      
      if (monitoring) {
        Object.assign(updateData, monitoring);
      }
      
      if (alerts) {
        updateData.alerts = alerts;
      }

      monitoringService.updateConfig(updateData);
      const newConfig = monitoringService.getConfig();

      logger.warn(
        'Monitoring configuration updated by user',
        {
          oldConfig,
          newConfig,
          endpoint: '/api/monitoring/config'
        },
        requestId,
        userId
      );

      res.status(200).json({
        success: true,
        data: {
          message: '監視設定を更新しました',
          oldConfig,
          newConfig
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

    } catch (error) {
      logger.error(
        'Failed to update monitoring config',
        error as Error,
        { endpoint: '/api/monitoring/config' },
        requestId,
        userId
      );

      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIG_UPDATE_ERROR',
          message: '監視設定の更新に失敗しました'
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }

  /**
   * 監視システムのヘルスチェック
   * GET /api/monitoring/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);

    try {
      const healthResult = await monitoringService.healthCheck();
      const statusCode = healthResult.status === 'healthy' ? 200 : 
                        healthResult.status === 'warning' ? 200 : 503;

      logger.info(
        `Monitoring health check: ${healthResult.status}`,
        {
          status: healthResult.status,
          endpoint: '/api/monitoring/health'
        },
        requestId
      );

      res.status(statusCode).json({
        success: true,
        data: healthResult,
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

    } catch (error) {
      logger.error(
        'Monitoring health check failed',
        error as Error,
        { endpoint: '/api/monitoring/health' },
        requestId
      );

      res.status(503).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: '監視システムのヘルスチェックに失敗しました'
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }

  /**
   * アラートテスト送信
   * POST /api/monitoring/test-alert
   */
  async testAlert(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    const userId = getUserId(req);

    // 本番環境では無効化
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        success: false,
        error: {
          code: 'NOT_ALLOWED_IN_PRODUCTION',
          message: 'アラートテストは本番環境では使用できません'
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
      return;
    }

    try {
      const { type = 'test', severity = 'warning', message = 'Test alert' } = req.body;

      // テストアラートを生成
      const testAlert = {
        type: type as 'cpu' | 'memory' | 'disk' | 'error',
        severity: severity as 'warning' | 'critical',
        message: `[TEST] ${message}`,
        value: 99.9,
        threshold: 80,
        timestamp: new Date()
      };

      // アラートを送信（内部メソッドを直接呼び出し）
      await monitoringService['sendAlert'](testAlert);

      logger.info(
        'Test alert sent',
        {
          alert: testAlert,
          endpoint: '/api/monitoring/test-alert'
        },
        requestId,
        userId
      );

      res.status(200).json({
        success: true,
        data: {
          message: 'テストアラートを送信しました',
          alert: testAlert
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

    } catch (error) {
      logger.error(
        'Failed to send test alert',
        error as Error,
        { endpoint: '/api/monitoring/test-alert' },
        requestId,
        userId
      );

      res.status(500).json({
        success: false,
        error: {
          code: 'TEST_ALERT_ERROR',
          message: 'テストアラートの送信に失敗しました'
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }

  /**
   * カスタムメトリクスをリセット
   * POST /api/monitoring/reset-metrics
   */
  async resetMetrics(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    const userId = getUserId(req);

    try {
      const oldMetrics = CustomMetricsCollector.getMetrics();
      CustomMetricsCollector.resetMetrics();

      logger.warn(
        'Custom metrics reset by user',
        {
          oldMetrics,
          endpoint: '/api/monitoring/reset-metrics'
        },
        requestId,
        userId
      );

      res.status(200).json({
        success: true,
        data: {
          message: 'カスタムメトリクスをリセットしました',
          resetMetrics: oldMetrics
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

    } catch (error) {
      logger.error(
        'Failed to reset custom metrics',
        error as Error,
        { endpoint: '/api/monitoring/reset-metrics' },
        requestId,
        userId
      );

      res.status(500).json({
        success: false,
        error: {
          code: 'RESET_METRICS_ERROR',
          message: 'カスタムメトリクスのリセットに失敗しました'
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }

  /**
   * システム統計情報を取得
   * GET /api/monitoring/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    const userId = getUserId(req);

    try {
      const systemMetrics = await monitoringService.getCurrentMetrics();
      const customMetrics = CustomMetricsCollector.getMetrics();
      const config = monitoringService.getConfig();

      // 統計情報を計算
      const stats = {
        system: {
          uptime: systemMetrics.process.uptime,
          pid: systemMetrics.process.pid,
          platform: process.platform,
          nodeVersion: process.version,
          cpuUsage: systemMetrics.cpu.usage,
          memoryUsage: systemMetrics.memory.usage,
          diskUsage: systemMetrics.disk.usage,
          heapUsage: systemMetrics.process.heapUsage
        },
        monitoring: {
          cloudWatchEnabled: config.monitoring.enableCloudWatch,
          alertsEnabled: config.alerts.enabled,
          metricsInterval: config.monitoring.metricsInterval,
          namespace: config.monitoring.namespace
        },
        alerts: {
          thresholds: config.alerts.thresholds,
          cooldownPeriod: config.alerts.cooldownPeriod,
          snsConfigured: !!config.alerts.snsTopicArn
        },
        custom: customMetrics
      };

      logger.info(
        'Monitoring stats retrieved',
        { endpoint: '/api/monitoring/stats' },
        requestId,
        userId
      );

      res.status(200).json({
        success: true,
        data: stats,
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

    } catch (error) {
      logger.error(
        'Failed to retrieve monitoring stats',
        error as Error,
        { endpoint: '/api/monitoring/stats' },
        requestId,
        userId
      );

      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: '監視統計情報の取得に失敗しました'
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }
}

// シングルトンインスタンスをエクスポート
export const monitoringController = new MonitoringController();