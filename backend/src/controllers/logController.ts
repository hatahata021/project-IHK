import { Request, Response } from 'express';
import { logger, LogLevel } from '../services/loggerService';
import { getLogStats, setLogLevel } from '../utils/logUtils';
import { getRequestId, getUserId } from '../middleware/logging';

/**
 * ログ管理APIコントローラー
 * ログレベル変更、統計情報取得、ヘルスチェック機能を提供
 */
export class LogController {

  /**
   * ログ統計情報を取得
   * GET /api/logs/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    const userId = getUserId(req);

    try {
      const stats = getLogStats();
      
      logger.info(
        'Log stats retrieved',
        { endpoint: '/api/logs/stats' },
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
        'Failed to retrieve log stats',
        error as Error,
        { endpoint: '/api/logs/stats' },
        requestId,
        userId
      );

      res.status(500).json({
        success: false,
        error: {
          code: 'LOG_STATS_ERROR',
          message: 'ログ統計情報の取得に失敗しました'
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
   * ログレベルを変更
   * PUT /api/logs/level
   */
  async setLogLevel(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    const userId = getUserId(req);

    try {
      const { level } = req.body;

      // バリデーション
      if (!level || typeof level !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_LOG_LEVEL',
            message: 'ログレベルが指定されていません'
          },
          metadata: {
            requestId,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        });
        return;
      }

      const upperLevel = level.toUpperCase();
      if (!Object.values(LogLevel).includes(upperLevel as LogLevel)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_LOG_LEVEL',
            message: `無効なログレベルです: ${level}`,
            details: {
              validLevels: Object.values(LogLevel)
            }
          },
          metadata: {
            requestId,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        });
        return;
      }

      // ログレベルを変更
      const oldConfig = logger.getConfig();
      setLogLevel(upperLevel as LogLevel);
      const newConfig = logger.getConfig();

      logger.warn(
        `Log level changed by user`,
        {
          oldLevel: oldConfig.logLevel,
          newLevel: newConfig.logLevel,
          endpoint: '/api/logs/level'
        },
        requestId,
        userId
      );

      res.status(200).json({
        success: true,
        data: {
          oldLevel: oldConfig.logLevel,
          newLevel: newConfig.logLevel,
          message: `ログレベルを${newConfig.logLevel}に変更しました`
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

    } catch (error) {
      logger.error(
        'Failed to set log level',
        error as Error,
        { endpoint: '/api/logs/level' },
        requestId,
        userId
      );

      res.status(500).json({
        success: false,
        error: {
          code: 'LOG_LEVEL_ERROR',
          message: 'ログレベルの変更に失敗しました'
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
   * ログを手動でフラッシュ
   * POST /api/logs/flush
   */
  async flushLogs(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    const userId = getUserId(req);

    try {
      await logger.flush();

      logger.info(
        'Logs manually flushed',
        { endpoint: '/api/logs/flush' },
        requestId,
        userId
      );

      res.status(200).json({
        success: true,
        data: {
          message: 'ログを正常にフラッシュしました'
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

    } catch (error) {
      logger.error(
        'Failed to flush logs',
        error as Error,
        { endpoint: '/api/logs/flush' },
        requestId,
        userId
      );

      res.status(500).json({
        success: false,
        error: {
          code: 'LOG_FLUSH_ERROR',
          message: 'ログのフラッシュに失敗しました'
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
   * ログシステムのヘルスチェック
   * GET /api/logs/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);

    try {
      const config = logger.getConfig();
      const memoryUsage = process.memoryUsage();
      
      // ヘルスチェック項目
      const checks = {
        loggerService: true,
        cloudWatchEnabled: config.enableCloudWatch,
        consoleEnabled: config.enableConsole,
        memoryUsage: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          usage: (memoryUsage.heapUsed / memoryUsage.heapTotal * 100).toFixed(2) + '%'
        }
      };

      // メモリ使用量が90%を超えている場合は警告
      const memoryWarning = (memoryUsage.heapUsed / memoryUsage.heapTotal) > 0.9;
      
      const status = memoryWarning ? 'warning' : 'healthy';
      const statusCode = memoryWarning ? 200 : 200; // 警告でも200を返す

      logger.info(
        `Log system health check: ${status}`,
        {
          checks,
          memoryWarning,
          endpoint: '/api/logs/health'
        },
        requestId
      );

      res.status(statusCode).json({
        success: true,
        data: {
          status,
          checks,
          warnings: memoryWarning ? ['High memory usage detected'] : [],
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
        'Log health check failed',
        error as Error,
        { endpoint: '/api/logs/health' },
        requestId
      );

      res.status(503).json({
        success: false,
        error: {
          code: 'LOG_HEALTH_CHECK_ERROR',
          message: 'ログシステムのヘルスチェックに失敗しました'
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
   * テストログを出力（開発・テスト用）
   * POST /api/logs/test
   */
  async testLogs(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    const userId = getUserId(req);

    // 本番環境では無効化
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        success: false,
        error: {
          code: 'NOT_ALLOWED_IN_PRODUCTION',
          message: 'テストログは本番環境では使用できません'
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
      const { level = 'info', message = 'Test log message', count = 1 } = req.body;

      // バリデーション
      if (count > 100) {
        res.status(400).json({
          success: false,
          error: {
            code: 'TOO_MANY_TEST_LOGS',
            message: 'テストログは最大100件までです'
          },
          metadata: {
            requestId,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        });
        return;
      }

      // テストログを出力
      for (let i = 0; i < count; i++) {
        const testMessage = `${message} (${i + 1}/${count})`;
        const metadata = {
          testLog: true,
          index: i + 1,
          total: count,
          endpoint: '/api/logs/test'
        };

        switch (level.toLowerCase()) {
          case 'error':
            logger.error(testMessage, new Error('Test error'), metadata, requestId, userId);
            break;
          case 'warn':
            logger.warn(testMessage, metadata, requestId, userId);
            break;
          case 'debug':
            logger.debug(testMessage, metadata, requestId, userId);
            break;
          default:
            logger.info(testMessage, metadata, requestId, userId);
        }
      }

      logger.info(
        `Generated ${count} test logs`,
        {
          level,
          message,
          count,
          endpoint: '/api/logs/test'
        },
        requestId,
        userId
      );

      res.status(200).json({
        success: true,
        data: {
          message: `${count}件のテストログを出力しました`,
          level,
          count
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

    } catch (error) {
      logger.error(
        'Failed to generate test logs',
        error as Error,
        { endpoint: '/api/logs/test' },
        requestId,
        userId
      );

      res.status(500).json({
        success: false,
        error: {
          code: 'TEST_LOG_ERROR',
          message: 'テストログの生成に失敗しました'
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
export const logController = new LogController();