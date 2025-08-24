/**
 * ヘルスチェックエンドポイント
 * システム全体の健全性を確認
 */

import { Router, Request, Response } from 'express';
import { configService } from '../services/configService';

const router = Router();

/**
 * 基本ヘルスチェック
 * GET /health
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const health = await configService.healthCheck();
    
    const statusCode = health.overall === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      status: health.overall,
      timestamp: health.timestamp,
      services: health.services
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 詳細ヘルスチェック
 * GET /health/detailed
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const [health, validation, initialization, stats] = await Promise.all([
      configService.healthCheck(),
      configService.validateConfig(),
      configService.initializeEnvironment(),
      configService.getServiceStats()
    ]);
    
    const statusCode = health.overall === 'healthy' && validation.valid && initialization.initialized ? 200 : 503;
    
    res.status(statusCode).json({
      status: health.overall,
      timestamp: health.timestamp,
      services: health.services,
      configuration: {
        valid: validation.valid,
        errors: validation.errors
      },
      environment: {
        initialized: initialization.initialized,
        missingSecrets: initialization.missingSecrets,
        missingParameters: initialization.missingParameters,
        errors: initialization.errors
      },
      cache: stats
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 設定概要取得
 * GET /health/config
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const configSummary = await configService.getConfigSummary();
    
    res.json({
      status: 'success',
      timestamp: Date.now(),
      config: configSummary
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * キャッシュクリア
 * POST /health/cache/clear
 */
router.post('/cache/clear', async (req: Request, res: Response) => {
  try {
    configService.clearCache();
    
    res.json({
      status: 'success',
      timestamp: Date.now(),
      message: 'All caches cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 設定再読み込み
 * POST /health/config/reload
 */
router.post('/config/reload', async (req: Request, res: Response) => {
  try {
    const config = await configService.reloadConfig();
    
    res.json({
      status: 'success',
      timestamp: Date.now(),
      message: 'Configuration reloaded successfully',
      config: await configService.getConfigSummary()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;