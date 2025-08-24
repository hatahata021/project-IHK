/**
 * URLプレビュールート
 * URLプレビュー機能のエンドポイント定義
 */

const express = require('express');
const URLPreviewController = require('../controllers/urlPreviewController');

const router = express.Router();
const previewController = new URLPreviewController();

/**
 * 単一URLのプレビューを取得
 * GET /api/preview?url=https://example.com&forceRefresh=false&enhance=true
 * 
 * クエリパラメータ:
 * - url (required): プレビューを取得するURL
 * - forceRefresh (optional): キャッシュを無視して新規取得 (default: false)
 * - enhance (optional): 品質向上処理を実行 (default: true)
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "url": "https://example.com",
 *     "title": "Example Site",
 *     "description": "This is an example website",
 *     "image": "https://example.com/image.jpg",
 *     "siteName": "Example",
 *     "type": "website",
 *     "cached": true,
 *     "qualityScore": 85,
 *     "responseTime": 150
 *   },
 *   "meta": {
 *     "url": "https://example.com",
 *     "requestTime": "2024-01-15T10:30:00.000Z",
 *     "cached": true,
 *     "source": "cache"
 *   }
 * }
 */
router.get('/', previewController.getRateLimiter(), async (req, res) => {
  await previewController.getPreview(req, res);
});

/**
 * 複数URLのプレビューを一括取得
 * POST /api/preview/batch
 * 
 * リクエストボディ:
 * {
 *   "urls": [
 *     "https://example1.com",
 *     "https://example2.com"
 *   ],
 *   "options": {
 *     "forceRefresh": false,
 *     "enhance": true,
 *     "timeout": 15000
 *   }
 * }
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "total": 2,
 *     "valid": 2,
 *     "invalid": 0,
 *     "previews": [
 *       {
 *         "url": "https://example1.com",
 *         "title": "Example 1",
 *         "description": "First example",
 *         "qualityScore": 80
 *       },
 *       {
 *         "url": "https://example2.com",
 *         "title": "Example 2",
 *         "description": "Second example",
 *         "qualityScore": 75
 *       }
 *     ]
 *   },
 *   "meta": {
 *     "requestTime": "2024-01-15T10:30:00.000Z",
 *     "responseTime": 2500,
 *     "batchSize": 2
 *   }
 * }
 */
router.post('/batch', previewController.getBatchRateLimiter(), async (req, res) => {
  await previewController.getBatchPreviews(req, res);
});

/**
 * プレビューの品質向上処理
 * POST /api/preview/enhance
 * 
 * リクエストボディ:
 * {
 *   "preview": {
 *     "url": "https://example.com",
 *     "title": "Example",
 *     "description": "Basic description",
 *     "image": "http://example.com/image.jpg"
 *   }
 * }
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "url": "https://example.com",
 *     "title": "Example",
 *     "description": "Enhanced description with better formatting",
 *     "image": "https://example.com/image.jpg",
 *     "qualityScore": 90
 *   },
 *   "meta": {
 *     "originalQuality": 60,
 *     "enhancedQuality": 90,
 *     "improvement": 30
 *   }
 * }
 */
router.post('/enhance', previewController.getRateLimiter(), async (req, res) => {
  await previewController.enhancePreview(req, res);
});

/**
 * プレビューサービスの統計情報を取得
 * GET /api/preview/stats
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "service": "URLPreviewService",
 *     "version": "1.0.0",
 *     "config": {
 *       "maxBatchSize": 10,
 *       "timeout": 15000,
 *       "retryAttempts": 2
 *     },
 *     "cache": {
 *       "totalCacheItems": 1250,
 *       "hitRate": 0.85
 *     },
 *     "timestamp": "2024-01-15T10:30:00.000Z"
 *   }
 * }
 */
router.get('/stats', async (req, res) => {
  await previewController.getStatistics(req, res);
});

/**
 * プレビューサービスのヘルスチェック
 * GET /api/preview/health
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "status": "healthy",
 *     "timestamp": "2024-01-15T10:30:00.000Z",
 *     "service": "URLPreviewService",
 *     "version": "1.0.0",
 *     "dependencies": {
 *       "cache": true,
 *       "metadata": true
 *     }
 *   }
 * }
 */
router.get('/health', async (req, res) => {
  await previewController.healthCheck(req, res);
});

/**
 * プレビュー設定情報を取得
 * GET /api/preview/config
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "maxBatchSize": 10,
 *     "timeout": 15000,
 *     "retryAttempts": 2,
 *     "cacheEnabled": true,
 *     "enhancementEnabled": true,
 *     "rateLimits": {
 *       "single": {
 *         "windowMs": 900000,
 *         "max": 100
 *       },
 *       "batch": {
 *         "windowMs": 900000,
 *         "max": 20
 *       }
 *     },
 *     "supportedFeatures": [
 *       "single-preview",
 *       "batch-preview",
 *       "cache-integration",
 *       "quality-enhancement",
 *       "aws-optimization",
 *       "rate-limiting"
 *     ]
 *   }
 * }
 */
router.get('/config', async (req, res) => {
  await previewController.getConfig(req, res);
});

// エラーハンドリングミドルウェア
router.use((error, req, res, next) => {
  console.error('URLプレビュールートエラー:', error);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'サーバー内部エラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }
  });
});

module.exports = router;