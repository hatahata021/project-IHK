/**
 * URLキャッシュサービスのテスト
 */

const URLCacheService = require('../urlCacheService');
const URLCacheModel = require('../../models/urlCache');

// URLCacheModelをモック化
jest.mock('../../models/urlCache');

describe('URLCacheService', () => {
  let cacheService;
  let mockCacheModel;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // URLCacheModelのモックインスタンスを作成
    mockCacheModel = {
      getCache: jest.fn(),
      saveCache: jest.fn(),
      deleteCache: jest.fn(),
      getCacheStats: jest.fn(),
      cleanExpiredCache: jest.fn()
    };
    
    URLCacheModel.mockImplementation(() => mockCacheModel);
    
    cacheService = new URLCacheService();
  });

  describe('getCachedMetadata', () => {
    it('有効なキャッシュが存在する場合、メタデータを返す', async () => {
      const testUrl = 'https://example.com';
      const mockCachedItem = {
        metadata: {
          title: 'Test Title',
          description: 'Test Description',
          image: 'https://example.com/image.jpg'
        },
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 1,
        expiresAt: Math.floor(Date.now() / 1000) + 3600 // 1時間後
      };

      mockCacheModel.getCache.mockResolvedValue(mockCachedItem);

      const result = await cacheService.getCachedMetadata(testUrl);

      expect(result).toEqual({
        title: 'Test Title',
        description: 'Test Description',
        image: 'https://example.com/image.jpg',
        cached: true,
        cacheInfo: {
          createdAt: mockCachedItem.createdAt,
          lastAccessed: mockCachedItem.lastAccessed,
          accessCount: mockCachedItem.accessCount
        }
      });
      expect(mockCacheModel.getCache).toHaveBeenCalledWith(testUrl);
    });

    it('キャッシュが存在しない場合、nullを返す', async () => {
      const testUrl = 'https://example.com';
      mockCacheModel.getCache.mockResolvedValue(null);

      const result = await cacheService.getCachedMetadata(testUrl);

      expect(result).toBeNull();
      expect(mockCacheModel.getCache).toHaveBeenCalledWith(testUrl);
    });

    it('期限切れキャッシュの場合、削除してnullを返す', async () => {
      const testUrl = 'https://example.com';
      const expiredCachedItem = {
        metadata: { title: 'Expired' },
        expiresAt: Math.floor(Date.now() / 1000) - 3600 // 1時間前（期限切れ）
      };

      mockCacheModel.getCache.mockResolvedValue(expiredCachedItem);
      mockCacheModel.deleteCache.mockResolvedValue(true);

      const result = await cacheService.getCachedMetadata(testUrl);

      expect(result).toBeNull();
      expect(mockCacheModel.deleteCache).toHaveBeenCalledWith(testUrl);
    });

    it('無効なURLの場合、nullを返す', async () => {
      const invalidUrl = 'invalid-url';

      const result = await cacheService.getCachedMetadata(invalidUrl);

      expect(result).toBeNull();
      expect(mockCacheModel.getCache).not.toHaveBeenCalled();
    });
  });

  describe('cacheMetadata', () => {
    it('有効なメタデータをキャッシュに保存する', async () => {
      const testUrl = 'https://example.com';
      const testMetadata = {
        title: 'Test Title',
        description: 'Test Description',
        image: 'https://example.com/image.jpg'
      };

      mockCacheModel.saveCache.mockResolvedValue({ success: true });

      const result = await cacheService.cacheMetadata(testUrl, testMetadata);

      expect(result).toBe(true);
      expect(mockCacheModel.saveCache).toHaveBeenCalledWith(
        testUrl,
        expect.objectContaining({
          title: 'Test Title',
          description: 'Test Description',
          image: 'https://example.com/image.jpg'
        }),
        24 // デフォルトTTL
      );
    });

    it('AWS公式URLの場合、長いTTLを使用する', async () => {
      const awsUrl = 'https://docs.aws.amazon.com/lambda/';
      const testMetadata = {
        title: 'AWS Lambda Documentation',
        description: 'AWS Lambda guide'
      };

      mockCacheModel.saveCache.mockResolvedValue({ success: true });

      const result = await cacheService.cacheMetadata(awsUrl, testMetadata);

      expect(result).toBe(true);
      expect(mockCacheModel.saveCache).toHaveBeenCalledWith(
        awsUrl,
        expect.any(Object),
        72 // AWS公式用の長いTTL
      );
    });

    it('エラーメタデータはキャッシュしない', async () => {
      const testUrl = 'https://example.com';
      const errorMetadata = {
        error: 'Failed to fetch',
        title: 'Error'
      };

      const result = await cacheService.cacheMetadata(testUrl, errorMetadata);

      expect(result).toBe(false);
      expect(mockCacheModel.saveCache).not.toHaveBeenCalled();
    });

    it('無効なURLはキャッシュしない', async () => {
      const invalidUrl = 'invalid-url';
      const testMetadata = { title: 'Test' };

      const result = await cacheService.cacheMetadata(invalidUrl, testMetadata);

      expect(result).toBe(false);
      expect(mockCacheModel.saveCache).not.toHaveBeenCalled();
    });
  });

  describe('invalidateCache', () => {
    it('指定されたURLのキャッシュを削除する', async () => {
      const testUrl = 'https://example.com';
      mockCacheModel.deleteCache.mockResolvedValue(true);

      const result = await cacheService.invalidateCache(testUrl);

      expect(result).toBe(true);
      expect(mockCacheModel.deleteCache).toHaveBeenCalledWith(testUrl);
    });

    it('削除に失敗した場合、falseを返す', async () => {
      const testUrl = 'https://example.com';
      mockCacheModel.deleteCache.mockRejectedValue(new Error('Delete failed'));

      const result = await cacheService.invalidateCache(testUrl);

      expect(result).toBe(false);
    });
  });

  describe('getBulkCachedMetadata', () => {
    it('複数URLのキャッシュを一括取得する', async () => {
      const urls = ['https://example1.com', 'https://example2.com'];
      const mockCachedItem1 = {
        metadata: { title: 'Title 1' },
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 1,
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      };

      mockCacheModel.getCache
        .mockResolvedValueOnce(mockCachedItem1)
        .mockResolvedValueOnce(null);

      const result = await cacheService.getBulkCachedMetadata(urls);

      expect(result).toEqual({
        'https://example1.com': expect.objectContaining({
          title: 'Title 1',
          cached: true
        }),
        'https://example2.com': null
      });
    });
  });

  describe('getCacheStatistics', () => {
    it('キャッシュ統計情報を取得する', async () => {
      const mockStats = {
        totalCacheItems: 100,
        timestamp: new Date().toISOString()
      };

      mockCacheModel.getCacheStats.mockResolvedValue(mockStats);

      const result = await cacheService.getCacheStatistics();

      expect(result).toEqual({
        ...mockStats,
        config: expect.objectContaining({
          defaultTTL: 24,
          maxTTL: 168
        })
      });
    });
  });

  describe('determineTTL', () => {
    it('AWS公式URLに対して適切なTTLを返す', () => {
      const awsUrl = 'https://docs.aws.amazon.com/lambda/';
      const ttl = cacheService.determineTTL(awsUrl);
      expect(ttl).toBe(72);
    });

    it('GitHubURLに対して適切なTTLを返す', () => {
      const githubUrl = 'https://github.com/user/repo';
      const ttl = cacheService.determineTTL(githubUrl);
      expect(ttl).toBe(48);
    });

    it('一般的なURLに対してデフォルトTTLを返す', () => {
      const generalUrl = 'https://example.com';
      const ttl = cacheService.determineTTL(generalUrl);
      expect(ttl).toBe(24);
    });

    it('カスタムTTLが指定された場合、それを使用する', () => {
      const url = 'https://example.com';
      const customTTL = 12;
      const ttl = cacheService.determineTTL(url, customTTL);
      expect(ttl).toBe(12);
    });

    it('範囲外のカスタムTTLは無視される', () => {
      const url = 'https://example.com';
      const invalidTTL = 200; // maxTTLを超える
      const ttl = cacheService.determineTTL(url, invalidTTL);
      expect(ttl).toBe(24); // デフォルトTTLが使用される
    });
  });

  describe('isCacheable', () => {
    it('有効なメタデータはキャッシュ可能', () => {
      const validMetadata = {
        title: 'Test Title',
        description: 'Test Description'
      };
      expect(cacheService.isCacheable(validMetadata)).toBe(true);
    });

    it('エラーメタデータはキャッシュ不可', () => {
      const errorMetadata = {
        error: 'Failed to fetch',
        title: 'Error'
      };
      expect(cacheService.isCacheable(errorMetadata)).toBe(false);
    });

    it('空のメタデータはキャッシュ不可', () => {
      const emptyMetadata = {};
      expect(cacheService.isCacheable(emptyMetadata)).toBe(false);
    });

    it('動的コンテンツはキャッシュ不可', () => {
      const dynamicMetadata = {
        title: 'Dynamic Content',
        isDynamic: true
      };
      expect(cacheService.isCacheable(dynamicMetadata)).toBe(false);
    });
  });

  describe('optimizeMetadata', () => {
    it('必要な情報のみを保持する', () => {
      const fullMetadata = {
        title: 'Test Title',
        description: 'Test Description',
        image: 'https://example.com/image.jpg',
        url: 'https://example.com',
        siteName: 'Example Site',
        type: 'website',
        isAWSOfficial: true,
        awsService: 'Lambda',
        // 以下は除去される
        debugInfo: 'debug data',
        largeData: new Array(1000).fill('data'),
        internalId: '12345'
      };

      const optimized = cacheService.optimizeMetadata(fullMetadata);

      expect(optimized).toEqual({
        title: 'Test Title',
        description: 'Test Description',
        image: 'https://example.com/image.jpg',
        url: 'https://example.com',
        siteName: 'Example Site',
        type: 'website',
        isAWSOfficial: true,
        awsService: 'Lambda'
      });

      expect(optimized.debugInfo).toBeUndefined();
      expect(optimized.largeData).toBeUndefined();
      expect(optimized.internalId).toBeUndefined();
    });
  });
});