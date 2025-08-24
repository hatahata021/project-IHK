/**
 * URLプレビューコントローラー
 * URLプレビュー機能のAPIエンドポイントを提供
 */

const URLPreviewService = require('../services/urlPreviewService');
const rateLimit = require('express-rate-limit');

class URLPreviewController {
  constructor() {
    this.previewService = new URLPreviewService();
    
    // レート制限設定
    this.rateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15分
      max: 100, // 最大100リクエスト
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'リクエスト制限を超えました。しばらく待ってから再試行してください。'
        }
      },
      standardHeaders: true,
      legacyHeaders: false
    });

    // バッチ処理用のより厳しい制限
    this.batchRateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15分
      max: 20, // 最大20リクエスト
      message: {
        success: false,
        error: {
          code: 'BATCH_RATE_LIMIT_EXCEEDED',
          message: 'バッチ処理のリクエスト制限を超えました。'
        }
      }
    });
  }

  /**
   * 単一URLのプレビューを取得
   * GET /api/preview?url=https://example.com
   */
  async getPreview(req, res) {
    try {
      const { url, forceRefresh, enhance } = req.query;

      // URLパラメータの検証
      if (!url) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_URL',
            message: 'URLパラメータが必要です'
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

      // オプションの設定
      const options = {
        forceRefresh: forceRefresh === 'true',
        enhance: enhance !== 'false' // デフォルトで品質向上を有効
      };

      // プレビューを取得
      const preview = await this.previewService.getPreview(url, options);

      // レスポンスの構築
      const response = {
        success: true,
        data: preview,
        meta: {
          url: url,
          requestTime: new Date().toISOString(),
          cached: preview.cached || false,
          source: preview.source || 'unknown'
        }
      };

      // キャッシュヘッダーの設定
      if (preview.cached) {
        res.set('X-Cache', 'HIT');
        res.set('Cache-Control', 'public, max-age=3600'); // 1時間キャッシュ
      } else {
        res.set('X-Cache', 'MISS');
        res.set('Cache-Control', 'public, max-age=300'); // 5分キャッシュ
      }

      res.json(response);
    } catch (error) {
      console.error('プレビュー取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PREVIEW_ERROR',
          message: 'プレビューの取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * 複数URLのプレビューを一括取得
   * POST /api/preview/batch
   */
  async getBatchPreviews(req, res) {
    try {
      const { urls, options = {} } = req.body;

      // リクエストボディの検証
      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_URLS',
            message: 'URL配列が必要です'
          }
        });
      }

      // URL数の制限チェック
      if (urls.length > 10) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TOO_MANY_URLS',
            message: '一度に処理できるURLは10個までです'
          }
        });
      }

      // バッチプレビューを取得
      const result = await this.previewService.getBatchPreviews(urls, options);

      // レスポンスの構築
      const response = {
        success: result.success,
        data: {
          total: result.total,
          valid: result.valid,
          invalid: result.invalid,
          previews: result.previews
        },
        meta: {
          requestTime: new Date().toISOString(),
          responseTime: result.responseTime,
          batchSize: urls.length
        }
      };

      if (!result.success) {
        response.error = {
          code: 'BATCH_PREVIEW_ERROR',
          message: result.error
        };
      }

      res.json(response);
    } catch (error) {
      console.error('バッチプレビュー取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'BATCH_PREVIEW_ERROR',
          message: 'バッチプレビューの取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * プレビューの品質向上処理
   * POST /api/preview/enhance
   */
  async enhancePreview(req, res) {
    try {
      const { preview } = req.body;

      // プレビューデータの検証
      if (!preview || typeof preview !== 'object') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PREVIEW_DATA',
            message: 'プレビューデータが必要です'
          }
        });
      }

      // 品質向上処理
      const enhancedPreview = await this.previewService.enhancePreview(preview);

      res.json({
        success: true,
        data: enhancedPreview,
        meta: {
          originalQuality: preview.qualityScore || 0,
          enhancedQuality: enhancedPreview.qualityScore || 0,
          improvement: (enhancedPreview.qualityScore || 0) - (preview.qualityScore || 0)
        }
      });
    } catch (error) {
      console.error('プレビュー品質向上エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ENHANCEMENT_ERROR',
          message: 'プレビューの品質向上に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * プレビューサービスの統計情報を取得
   * GET /api/preview/stats
   */
  async getStatistics(req, res) {
    try {
      const stats = await this.previewService.getStatistics();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('統計情報取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: '統計情報の取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * プレビューサービスのヘルスチェック
   * GET /api/preview/health
   */
  async healthCheck(req, res) {
    try {
      const stats = await this.previewService.getStatistics();
      const isHealthy = !stats.error;

      const healthData = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'URLPreviewService',
        version: '1.0.0',
        dependencies: {
          cache: stats.cache ? !stats.cache.error : false,
          metadata: true // メタデータサービスの状態
        }
      };

      res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        data: healthData
      });
    } catch (error) {
      console.error('ヘルスチェックエラー:', error);
      res.status(503).json({
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        }
      });
    }
  }

  /**
   * プレビュー設定情報を取得
   * GET /api/preview/config
   */
  async getConfig(req, res) {
    try {
      const config = {
        maxBatchSize: 10,
        timeout: 15000,
        retryAttempts: 2,
        cacheEnabled: true,
        enhancementEnabled: true,
        rateLimits: {
          single: {
            windowMs: 15 * 60 * 1000,
            max: 100
          },
          batch: {
            windowMs: 15 * 60 * 1000,
            max: 20
          }
        },
        supportedFeatures: [
          'single-preview',
          'batch-preview',
          'cache-integration',
          'quality-enhancement',
          'aws-optimization',
          'rate-limiting'
        ]
      };

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('設定取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: '設定情報の取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * レート制限ミドルウェアを取得
   * @returns {Function} レート制限ミドルウェア
   */
  getRateLimiter() {
    return this.rateLimiter;
  }

  /**
   * バッチ処理用レート制限ミドルウェアを取得
   * @returns {Function} バッチ用レート制限ミドルウェア
   */
  getBatchRateLimiter() {
    return this.batchRateLimiter;
  }
}

module.exports = URLPreviewController;