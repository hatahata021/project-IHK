/**
 * URLキャッシュ管理ルート
 * キャッシュの統計、無効化、クリーンアップ機能のエンドポイント
 */

const express = require('express');
const URLCacheController = require('../controllers/urlCacheController');

const router = express.Router();
const cacheController = new URLCacheController();

/**
 * キャッシュ統計情報を取得
 * GET /api/cache/stats
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "totalCacheItems": 150,
 *     "timestamp": "2024-01-15T10:30:00.000Z",
 *     "config": {
 *       "defaultTTL": 24,
 *       "maxTTL": 168
 *     }
 *   }
 * }
 */
router.get('/stats', async (req, res) => {
  await cacheController.getCacheStatistics(req, res);
});

/**
 * 指定URLのキャッシュを無効化
 * DELETE /api/cache/invalidate
 * 
 * リクエストボディ:
 * {
 *   "url": "https://example.com"
 * }
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "キャッシュを無効化しました",
 *   "data": {
 *     "url": "https://example.com"
 *   }
 * }
 */
router.delete('/invalidate', async (req, res) => {
  await cacheController.invalidateCache(req, res);
});

/**
 * 複数URLのキャッシュを一括無効化
 * DELETE /api/cache/bulk-invalidate
 * 
 * リクエストボディ:
 * {
 *   "urls": [
 *     "https://example1.com",
 *     "https://example2.com"
 *   ]
 * }
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "2件のキャッシュを無効化しました",
 *   "data": {
 *     "total": 2,
 *     "success": 2,
 *     "failure": 0
 *   }
 * }
 */
router.delete('/bulk-invalidate', async (req, res) => {
  await cacheController.bulkInvalidateCache(req, res);
});

/**
 * 期限切れキャッシュをクリーンアップ
 * POST /api/cache/cleanup
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "15件の期限切れキャッシュを削除しました",
 *   "data": {
 *     "deletedCount": 15
 *   }
 * }
 */
router.post('/cleanup', async (req, res) => {
  await cacheController.cleanupExpiredCache(req, res);
});

/**
 * キャッシュ設定情報を取得
 * GET /api/cache/config
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "defaultTTL": 24,
 *     "maxTTL": 168,
 *     "ttlByUrlType": {
 *       "aws.amazon.com": 72,
 *       "github.com": 48
 *     }
 *   }
 * }
 */
router.get('/config', async (req, res) => {
  await cacheController.getCacheConfig(req, res);
});

/**
 * キャッシュヘルスチェック
 * GET /api/cache/health
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "status": "healthy",
 *     "timestamp": "2024-01-15T10:30:00.000Z",
 *     "cacheAvailable": true
 *   }
 * }
 */
router.get('/health', async (req, res) => {
  await cacheController.healthCheck(req, res);
});

// エラーハンドリングミドルウェア
router.use((error, req, res, next) => {
  console.error('URLキャッシュルートエラー:', error);
  
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