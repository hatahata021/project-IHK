/**
 * URLプレビューコントローラーのテスト
 */

const URLPreviewController = require('../urlPreviewController');
const URLPreviewService = require('../../services/urlPreviewService');

// URLPreviewServiceをモック化
jest.mock('../../services/urlPreviewService');

describe('URLPreviewController', () => {
  let controller;
  let mockPreviewService;
  let req, res;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // URLPreviewServiceのモックインスタンスを作成
    mockPreviewService = {
      getPreview: jest.fn(),
      getBatchPreviews: jest.fn(),
      enhancePreview: jest.fn(),
      getStatistics: jest.fn()
    };
    
    URLPreviewService.mockImplementation(() => mockPreviewService);
    
    controller = new URLPreviewController();
    
    // リクエスト・レスポンスオブジェクトのモック
    req = {
      query: {},
      body: {},
      params: {}
    };
    
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };
  });

  describe('getPreview', () => {
    it('有効なURLのプレビューを正常に取得する', async () => {
      req.query = { url: 'https://example.com' };
      const mockPreview = {
        url: 'https://example.com',
        title: 'Example Site',
        description: 'Example description',
        cached: false,
        source: 'fresh',
        responseTime: 150
      };

      mockPreviewService.getPreview.mockResolvedValue(mockPreview);

      await controller.getPreview(req, res);

      expect(mockPreviewService.getPreview).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          forceRefresh: false,
          enhance: true
        })
      );

      expect(res.set).toHaveBeenCalledWith('X-Cache', 'MISS');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockPreview,
        meta: expect.objectContaining({
          url: 'https://example.com',
          cached: false,
          source: 'fresh'
        })
      });
    });

    it('キャッシュヒット時は適切なヘッダーを設定する', async () => {
      req.query = { url: 'https://example.com' };
      const cachedPreview = {
        url: 'https://example.com',
        title: 'Cached Site',
        cached: true,
        source: 'cache'
      };

      mockPreviewService.getPreview.mockResolvedValue(cachedPreview);

      await controller.getPreview(req, res);

      expect(res.set).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');
    });

    it('URLパラメータが不足している場合は400エラーを返す', async () => {
      req.query = {};

      await controller.getPreview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_URL',
          message: 'URLパラメータが必要です'
        }
      });
      expect(mockPreviewService.getPreview).not.toHaveBeenCalled();
    });

    it('無効なURL形式の場合は400エラーを返す', async () => {
      req.query = { url: 'invalid-url' };

      await controller.getPreview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: '無効なURL形式です'
        }
      });
      expect(mockPreviewService.getPreview).not.toHaveBeenCalled();
    });

    it('forceRefreshパラメータを正しく処理する', async () => {
      req.query = { 
        url: 'https://example.com',
        forceRefresh: 'true',
        enhance: 'false'
      };

      mockPreviewService.getPreview.mockResolvedValue({
        url: 'https://example.com',
        title: 'Fresh Site'
      });

      await controller.getPreview(req, res);

      expect(mockPreviewService.getPreview).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          forceRefresh: true,
          enhance: false
        })
      );
    });

    it('プレビューサービスでエラーが発生した場合は500エラーを返す', async () => {
      req.query = { url: 'https://example.com' };
      const error = new Error('Service unavailable');
      mockPreviewService.getPreview.mockRejectedValue(error);

      await controller.getPreview(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PREVIEW_ERROR',
          message: 'プレビューの取得に失敗しました',
          details: 'Service unavailable'
        }
      });
    });
  });

  describe('getBatchPreviews', () => {
    it('複数URLのプレビューを正常に一括取得する', async () => {
      req.body = {
        urls: ['https://example1.com', 'https://example2.com'],
        options: { forceRefresh: false }
      };

      const mockResult = {
        success: true,
        total: 2,
        valid: 2,
        invalid: 0,
        responseTime: 2500,
        previews: [
          { url: 'https://example1.com', title: 'Example 1' },
          { url: 'https://example2.com', title: 'Example 2' }
        ]
      };

      mockPreviewService.getBatchPreviews.mockResolvedValue(mockResult);

      await controller.getBatchPreviews(req, res);

      expect(mockPreviewService.getBatchPreviews).toHaveBeenCalledWith(
        ['https://example1.com', 'https://example2.com'],
        { forceRefresh: false }
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          total: 2,
          valid: 2,
          invalid: 0,
          previews: mockResult.previews
        },
        meta: expect.objectContaining({
          responseTime: 2500,
          batchSize: 2
        })
      });
    });

    it('URL配列が空の場合は400エラーを返す', async () => {
      req.body = { urls: [] };

      await controller.getBatchPreviews(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_URLS',
          message: 'URL配列が必要です'
        }
      });
      expect(mockPreviewService.getBatchPreviews).not.toHaveBeenCalled();
    });

    it('URL配列が指定されていない場合は400エラーを返す', async () => {
      req.body = {};

      await controller.getBatchPreviews(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_URLS',
          message: 'URL配列が必要です'
        }
      });
    });

    it('URL数が制限を超える場合は400エラーを返す', async () => {
      req.body = {
        urls: new Array(15).fill('https://example.com')
      };

      await controller.getBatchPreviews(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOO_MANY_URLS',
          message: '一度に処理できるURLは10個までです'
        }
      });
    });

    it('バッチ処理でエラーが発生した場合はエラー情報を含む', async () => {
      req.body = {
        urls: ['https://example1.com', 'https://example2.com']
      };

      const mockResult = {
        success: false,
        error: 'Batch processing failed',
        total: 2,
        previews: []
      };

      mockPreviewService.getBatchPreviews.mockResolvedValue(mockResult);

      await controller.getBatchPreviews(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        data: expect.objectContaining({
          total: 2,
          previews: []
        }),
        error: {
          code: 'BATCH_PREVIEW_ERROR',
          message: 'Batch processing failed'
        },
        meta: expect.any(Object)
      });
    });

    it('サービスで例外が発生した場合は500エラーを返す', async () => {
      req.body = {
        urls: ['https://example.com']
      };

      const error = new Error('Service error');
      mockPreviewService.getBatchPreviews.mockRejectedValue(error);

      await controller.getBatchPreviews(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BATCH_PREVIEW_ERROR',
          message: 'バッチプレビューの取得に失敗しました',
          details: 'Service error'
        }
      });
    });
  });

  describe('enhancePreview', () => {
    it('プレビューの品質向上を正常に実行する', async () => {
      const originalPreview = {
        url: 'https://example.com',
        title: 'Example',
        description: 'Basic description',
        qualityScore: 60
      };

      const enhancedPreview = {
        ...originalPreview,
        description: 'Enhanced description',
        qualityScore: 90
      };

      req.body = { preview: originalPreview };
      mockPreviewService.enhancePreview.mockResolvedValue(enhancedPreview);

      await controller.enhancePreview(req, res);

      expect(mockPreviewService.enhancePreview).toHaveBeenCalledWith(originalPreview);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: enhancedPreview,
        meta: {
          originalQuality: 60,
          enhancedQuality: 90,
          improvement: 30
        }
      });
    });

    it('プレビューデータが指定されていない場合は400エラーを返す', async () => {
      req.body = {};

      await controller.enhancePreview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_PREVIEW_DATA',
          message: 'プレビューデータが必要です'
        }
      });
      expect(mockPreviewService.enhancePreview).not.toHaveBeenCalled();
    });

    it('無効なプレビューデータの場合は400エラーを返す', async () => {
      req.body = { preview: 'invalid-data' };

      await controller.enhancePreview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_PREVIEW_DATA',
          message: 'プレビューデータが必要です'
        }
      });
    });

    it('品質向上処理でエラーが発生した場合は500エラーを返す', async () => {
      req.body = {
        preview: { url: 'https://example.com', title: 'Example' }
      };

      const error = new Error('Enhancement failed');
      mockPreviewService.enhancePreview.mockRejectedValue(error);

      await controller.enhancePreview(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ENHANCEMENT_ERROR',
          message: 'プレビューの品質向上に失敗しました',
          details: 'Enhancement failed'
        }
      });
    });
  });

  describe('getStatistics', () => {
    it('統計情報を正常に取得する', async () => {
      const mockStats = {
        service: 'URLPreviewService',
        version: '1.0.0',
        config: {
          maxBatchSize: 10,
          timeout: 15000
        },
        cache: {
          totalCacheItems: 1000,
          hitRate: 0.85
        }
      };

      mockPreviewService.getStatistics.mockResolvedValue(mockStats);

      await controller.getStatistics(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });

    it('統計取得でエラーが発生した場合は500エラーを返す', async () => {
      const error = new Error('Stats unavailable');
      mockPreviewService.getStatistics.mockRejectedValue(error);

      await controller.getStatistics(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: '統計情報の取得に失敗しました',
          details: 'Stats unavailable'
        }
      });
    });
  });

  describe('healthCheck', () => {
    it('サービスが正常な場合はhealthyステータスを返す', async () => {
      const mockStats = {
        service: 'URLPreviewService',
        cache: { totalCacheItems: 1000 }
      };

      mockPreviewService.getStatistics.mockResolvedValue(mockStats);

      await controller.healthCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'healthy',
          service: 'URLPreviewService',
          version: '1.0.0',
          dependencies: expect.objectContaining({
            cache: true,
            metadata: true
          })
        })
      });
    });

    it('サービスにエラーがある場合はunhealthyステータスを返す', async () => {
      const mockStats = {
        error: 'Service unavailable'
      };

      mockPreviewService.getStatistics.mockResolvedValue(mockStats);

      await controller.healthCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        data: expect.objectContaining({
          status: 'unhealthy'
        })
      });
    });

    it('統計取得で例外が発生した場合はunhealthyステータスを返す', async () => {
      const error = new Error('Health check failed');
      mockPreviewService.getStatistics.mockRejectedValue(error);

      await controller.healthCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        data: expect.objectContaining({
          status: 'unhealthy',
          error: 'Health check failed'
        })
      });
    });
  });

  describe('getConfig', () => {
    it('設定情報を正常に取得する', async () => {
      await controller.getConfig(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          maxBatchSize: 10,
          timeout: 15000,
          retryAttempts: 2,
          cacheEnabled: true,
          enhancementEnabled: true,
          rateLimits: expect.objectContaining({
            single: expect.any(Object),
            batch: expect.any(Object)
          }),
          supportedFeatures: expect.arrayContaining([
            'single-preview',
            'batch-preview',
            'cache-integration',
            'quality-enhancement',
            'aws-optimization',
            'rate-limiting'
          ])
        })
      });
    });
  });

  describe('レート制限', () => {
    it('レート制限ミドルウェアを取得できる', () => {
      const rateLimiter = controller.getRateLimiter();
      expect(rateLimiter).toBeDefined();
      expect(typeof rateLimiter).toBe('function');
    });

    it('バッチ用レート制限ミドルウェアを取得できる', () => {
      const batchRateLimiter = controller.getBatchRateLimiter();
      expect(batchRateLimiter).toBeDefined();
      expect(typeof batchRateLimiter).toBe('function');
    });
  });
});