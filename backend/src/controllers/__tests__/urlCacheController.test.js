/**
 * URLキャッシュコントローラーのテスト
 */

const URLCacheController = require('../urlCacheController');
const URLCacheService = require('../../services/urlCacheService');

// URLCacheServiceをモック化
jest.mock('../../services/urlCacheService');

describe('URLCacheController', () => {
  let controller;
  let mockCacheService;
  let req, res;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // URLCacheServiceのモックインスタンスを作成
    mockCacheService = {
      getCacheStatistics: jest.fn(),
      invalidateCache: jest.fn(),
      cleanupExpiredCache: jest.fn()
    };
    
    URLCacheService.mockImplementation(() => mockCacheService);
    
    controller = new URLCacheController();
    
    // リクエスト・レスポンスオブジェクトのモック
    req = {
      body: {},
      params: {},
      query: {}
    };
    
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
  });

  describe('getCacheStatistics', () => {
    it('キャッシュ統計情報を正常に取得する', async () => {
      const mockStats = {
        totalCacheItems: 100,
        timestamp: '2024-01-15T10:30:00.000Z',
        config: {
          defaultTTL: 24,
          maxTTL: 168
        }
      };

      mockCacheService.getCacheStatistics.mockResolvedValue(mockStats);

      await controller.getCacheStatistics(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('統計取得エラー時に500エラーを返す', async () => {
      const error = new Error('Database connection failed');
      mockCacheService.getCacheStatistics.mockRejectedValue(error);

      await controller.getCacheStatistics(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CACHE_STATS_ERROR',
          message: 'キャッシュ統計情報の取得に失敗しました',
          details: 'Database connection failed'
        }
      });
    });
  });

  describe('invalidateCache', () => {
    it('有効なURLのキャッシュを正常に無効化する', async () => {
      req.body = { url: 'https://example.com' };
      mockCacheService.invalidateCache.mockResolvedValue(true);

      await controller.invalidateCache(req, res);

      expect(mockCacheService.invalidateCache).toHaveBeenCalledWith('https://example.com');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'キャッシュを無効化しました',
        data: { url: 'https://example.com' }
      });
    });

    it('URLが指定されていない場合に400エラーを返す', async () => {
      req.body = {};

      await controller.invalidateCache(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_URL',
          message: 'URLが指定されていません'
        }
      });
      expect(mockCacheService.invalidateCache).not.toHaveBeenCalled();
    });

    it('無効なURL形式の場合に400エラーを返す', async () => {
      req.body = { url: 'invalid-url' };

      await controller.invalidateCache(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: '無効なURL形式です'
        }
      });
      expect(mockCacheService.invalidateCache).not.toHaveBeenCalled();
    });

    it('キャッシュが見つからない場合に404エラーを返す', async () => {
      req.body = { url: 'https://example.com' };
      mockCacheService.invalidateCache.mockResolvedValue(false);

      await controller.invalidateCache(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CACHE_NOT_FOUND',
          message: '指定されたURLのキャッシュが見つかりません'
        }
      });
    });

    it('無効化処理でエラーが発生した場合に500エラーを返す', async () => {
      req.body = { url: 'https://example.com' };
      const error = new Error('Cache service error');
      mockCacheService.invalidateCache.mockRejectedValue(error);

      await controller.invalidateCache(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CACHE_INVALIDATION_ERROR',
          message: 'キャッシュの無効化に失敗しました',
          details: 'Cache service error'
        }
      });
    });
  });

  describe('bulkInvalidateCache', () => {
    it('複数URLのキャッシュを正常に一括無効化する', async () => {
      req.body = {
        urls: ['https://example1.com', 'https://example2.com']
      };
      mockCacheService.invalidateCache
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await controller.bulkInvalidateCache(req, res);

      expect(mockCacheService.invalidateCache).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '2件のキャッシュを無効化しました',
        data: {
          total: 2,
          success: 2,
          failure: 0
        }
      });
    });

    it('URL配列が指定されていない場合に400エラーを返す', async () => {
      req.body = {};

      await controller.bulkInvalidateCache(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_URLS',
          message: 'URL配列が指定されていません'
        }
      });
    });

    it('URL数が制限を超える場合に400エラーを返す', async () => {
      req.body = {
        urls: new Array(101).fill('https://example.com')
      };

      await controller.bulkInvalidateCache(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOO_MANY_URLS',
          message: '一度に無効化できるURLは100個までです'
        }
      });
    });

    it('無効なURL形式が含まれる場合に400エラーを返す', async () => {
      req.body = {
        urls: ['https://example.com', 'invalid-url']
      };

      await controller.bulkInvalidateCache(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_URL_FORMAT',
          message: '無効なURL形式が含まれています',
          details: { invalidUrls: ['invalid-url'] }
        }
      });
    });

    it('一部のURL無効化が失敗した場合も結果を返す', async () => {
      req.body = {
        urls: ['https://example1.com', 'https://example2.com']
      };
      mockCacheService.invalidateCache
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await controller.bulkInvalidateCache(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '1件のキャッシュを無効化しました',
        data: {
          total: 2,
          success: 1,
          failure: 1
        }
      });
    });
  });

  describe('cleanupExpiredCache', () => {
    it('期限切れキャッシュを正常にクリーンアップする', async () => {
      mockCacheService.cleanupExpiredCache.mockResolvedValue(15);

      await controller.cleanupExpiredCache(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '15件の期限切れキャッシュを削除しました',
        data: { deletedCount: 15 }
      });
    });

    it('クリーンアップでエラーが発生した場合に500エラーを返す', async () => {
      const error = new Error('Cleanup failed');
      mockCacheService.cleanupExpiredCache.mockRejectedValue(error);

      await controller.cleanupExpiredCache(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: 'キャッシュクリーンアップに失敗しました',
          details: 'Cleanup failed'
        }
      });
    });
  });

  describe('getCacheConfig', () => {
    it('キャッシュ設定情報を正常に取得する', async () => {
      await controller.getCacheConfig(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          defaultTTL: 24,
          maxTTL: 168,
          minTTL: 1,
          ttlByUrlType: expect.objectContaining({
            'aws.amazon.com': 72,
            'github.com': 48
          }),
          features: expect.objectContaining({
            automaticCleanup: true,
            bulkOperations: true
          })
        })
      });
    });
  });

  describe('healthCheck', () => {
    it('キャッシュが正常な場合にhealthyステータスを返す', async () => {
      const mockStats = {
        totalCacheItems: 100,
        timestamp: '2024-01-15T10:30:00.000Z'
      };
      mockCacheService.getCacheStatistics.mockResolvedValue(mockStats);

      await controller.healthCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          status: 'healthy',
          timestamp: expect.any(String),
          cacheAvailable: true,
          details: mockStats
        }
      });
    });

    it('キャッシュにエラーがある場合にunhealthyステータスを返す', async () => {
      const mockStats = {
        error: 'Database connection failed'
      };
      mockCacheService.getCacheStatistics.mockResolvedValue(mockStats);

      await controller.healthCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: expect.any(String),
          cacheAvailable: false,
          details: mockStats
        }
      });
    });

    it('統計取得でエラーが発生した場合にunhealthyステータスを返す', async () => {
      const error = new Error('Service unavailable');
      mockCacheService.getCacheStatistics.mockRejectedValue(error);

      await controller.healthCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: expect.any(String),
          cacheAvailable: false,
          error: 'Service unavailable'
        }
      });
    });
  });
});