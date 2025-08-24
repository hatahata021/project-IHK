/**
 * URLキャッシュ管理コントローラー
 * キャッシュの統計情報取得、無効化、クリーンアップ機能を提供
 */

const URLCacheService = require('../services/urlCacheService');

class URLCacheController {
  constructor() {
    this.cacheService = new URLCacheService();
  }

  /**
   * キャッシュ統計情報を取得
   * GET /api/cache/stats
   */
  async getCacheStatistics(req, res) {
    try {
      const stats = await this.cacheService.getCacheStatistics();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('キャッシュ統計取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CACHE_STATS_ERROR',
          message: 'キャッシュ統計情報の取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * 指定URLのキャッシュを無効化
   * DELETE /api/cache/invalidate
   */
  async invalidateCache(req, res) {
    try {
      const { url } = req.body;

      // URLの検証
      if (!url) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_URL',
            message: 'URLが指定されていません'
          }
        });
      }

      // URL形式の検証
      try {
        new URL(url);
      } catch {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_URL',
            message: '無効なURL形式です'
          }
        });
      }

      const success = await this.cacheService.invalidateCache(url);

      if (success) {
        res.json({
          success: true,
          message: 'キャッシュを無効化しました',
          data: { url }
        });
      } else {
        res.status(404).json({
          success: false,
          error: {
            code: 'CACHE_NOT_FOUND',
            message: '指定されたURLのキャッシュが見つかりません'
          }
        });
      }
    } catch (error) {
      console.error('キャッシュ無効化エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CACHE_INVALIDATION_ERROR',
          message: 'キャッシュの無効化に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * 複数URLのキャッシュを一括無効化
   * DELETE /api/cache/bulk-invalidate
   */
  async bulkInvalidateCache(req, res) {
    try {
      const { urls } = req.body;

      // URLsの検証
      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_URLS',
            message: 'URL配列が指定されていません'
          }
        });
      }

      // URL数の制限
      if (urls.length > 100) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TOO_MANY_URLS',
            message: '一度に無効化できるURLは100個までです'
          }
        });
      }

      // 各URLの形式検証
      const invalidUrls = [];
      for (const url of urls) {
        try {
          new URL(url);
        } catch {
          invalidUrls.push(url);
        }
      }

      if (invalidUrls.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_URL_FORMAT',
            message: '無効なURL形式が含まれています',
            details: { invalidUrls }
          }
        });
      }

      // 一括無効化実行
      const results = await Promise.allSettled(
        urls.map(url => this.cacheService.invalidateCache(url))
      );

      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
      const failureCount = results.length - successCount;

      res.json({
        success: true,
        message: `${successCount}件のキャッシュを無効化しました`,
        data: {
          total: urls.length,
          success: successCount,
          failure: failureCount
        }
      });
    } catch (error) {
      console.error('一括キャッシュ無効化エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'BULK_INVALIDATION_ERROR',
          message: '一括キャッシュ無効化に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * 期限切れキャッシュをクリーンアップ
   * POST /api/cache/cleanup
   */
  async cleanupExpiredCache(req, res) {
    try {
      const deletedCount = await this.cacheService.cleanupExpiredCache();

      res.json({
        success: true,
        message: `${deletedCount}件の期限切れキャッシュを削除しました`,
        data: { deletedCount }
      });
    } catch (error) {
      console.error('キャッシュクリーンアップエラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: 'キャッシュクリーンアップに失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * キャッシュ設定情報を取得
   * GET /api/cache/config
   */
  async getCacheConfig(req, res) {
    try {
      const config = {
        defaultTTL: 24,
        maxTTL: 168,
        minTTL: 1,
        ttlByUrlType: {
          'aws.amazon.com': 72,
          'github.com': 48,
          'stackoverflow.com': 12,
          'default': 24
        },
        features: {
          automaticCleanup: true,
          bulkOperations: true,
          statisticsTracking: true
        }
      };

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('キャッシュ設定取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'キャッシュ設定の取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * キャッシュヘルスチェック
   * GET /api/cache/health
   */
  async healthCheck(req, res) {
    try {
      const stats = await this.cacheService.getCacheStatistics();
      const isHealthy = !stats.error;

      res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        data: {
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          cacheAvailable: isHealthy,
          details: stats
        }
      });
    } catch (error) {
      console.error('キャッシュヘルスチェックエラー:', error);
      res.status(503).json({
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          cacheAvailable: false,
          error: error.message
        }
      });
    }
  }
}

module.exports = URLCacheController;