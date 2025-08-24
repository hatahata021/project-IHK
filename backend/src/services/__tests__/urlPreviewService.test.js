/**
 * URLプレビューサービスのテスト
 */

const URLPreviewService = require('../urlPreviewService');
const URLMetadataService = require('../urlMetadataService');
const URLCacheService = require('../urlCacheService');

// 依存サービスをモック化
jest.mock('../urlMetadataService');
jest.mock('../urlCacheService');

describe('URLPreviewService', () => {
  let previewService;
  let mockMetadataService;
  let mockCacheService;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // URLMetadataServiceのモック
    mockMetadataService = {
      extractMetadata: jest.fn()
    };
    URLMetadataService.mockImplementation(() => mockMetadataService);
    
    // URLCacheServiceのモック
    mockCacheService = {
      getCachedMetadata: jest.fn(),
      cacheMetadata: jest.fn(),
      getCacheStatistics: jest.fn()
    };
    URLCacheService.mockImplementation(() => mockCacheService);
    
    previewService = new URLPreviewService();
  });

  describe('getPreview', () => {
    it('有効なURLのプレビューを正常に取得する', async () => {
      const testUrl = 'https://example.com';
      const mockMetadata = {
        url: testUrl,
        title: 'Example Site',
        description: 'This is an example website',
        image: 'https://example.com/image.jpg',
        siteName: 'Example'
      };

      mockCacheService.getCachedMetadata.mockResolvedValue(null);
      mockMetadataService.extractMetadata.mockResolvedValue(mockMetadata);
      mockCacheService.cacheMetadata.mockResolvedValue(true);

      const result = await previewService.getPreview(testUrl);

      expect(result).toEqual(expect.objectContaining({
        url: testUrl,
        title: 'Example Site',
        description: 'This is an example website',
        image: 'https://example.com/image.jpg',
        siteName: 'Example',
        cached: false,
        source: 'fresh'
      }));
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.qualityScore).toBeGreaterThan(0);
    });

    it('キャッシュからプレビューを取得する', async () => {
      const testUrl = 'https://example.com';
      const cachedPreview = {
        url: testUrl,
        title: 'Cached Title',
        description: 'Cached description',
        cached: true,
        cacheInfo: {
          createdAt: '2024-01-15T10:00:00.000Z',
          accessCount: 5
        }
      };

      mockCacheService.getCachedMetadata.mockResolvedValue(cachedPreview);

      const result = await previewService.getPreview(testUrl);

      expect(result).toEqual(expect.objectContaining({
        url: testUrl,
        title: 'Cached Title',
        cached: true,
        source: 'cache'
      }));
      expect(mockMetadataService.extractMetadata).not.toHaveBeenCalled();
    });

    it('強制更新時はキャッシュを無視する', async () => {
      const testUrl = 'https://example.com';
      const mockMetadata = {
        url: testUrl,
        title: 'Fresh Title',
        description: 'Fresh description'
      };

      mockCacheService.getCachedMetadata.mockResolvedValue({
        title: 'Cached Title'
      });
      mockMetadataService.extractMetadata.mockResolvedValue(mockMetadata);
      mockCacheService.cacheMetadata.mockResolvedValue(true);

      const result = await previewService.getPreview(testUrl, { forceRefresh: true });

      expect(result.title).toBe('Fresh Title');
      expect(result.source).toBe('fresh');
      expect(mockMetadataService.extractMetadata).toHaveBeenCalled();
    });

    it('無効なURLの場合はエラープレビューを返す', async () => {
      const invalidUrl = 'invalid-url';

      const result = await previewService.getPreview(invalidUrl);

      expect(result).toEqual(expect.objectContaining({
        url: invalidUrl,
        error: 'Invalid URL format',
        qualityScore: 0
      }));
    });

    it('メタデータ取得エラー時はリトライする', async () => {
      const testUrl = 'https://example.com';
      
      mockCacheService.getCachedMetadata.mockResolvedValue(null);
      mockMetadataService.extractMetadata
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          url: testUrl,
          title: 'Success after retry'
        });
      mockCacheService.cacheMetadata.mockResolvedValue(true);

      const result = await previewService.getPreview(testUrl);

      expect(result.title).toBe('Success after retry');
      expect(mockMetadataService.extractMetadata).toHaveBeenCalledTimes(2);
    });
  });

  describe('getBatchPreviews', () => {
    it('複数URLのプレビューを一括取得する', async () => {
      const urls = ['https://example1.com', 'https://example2.com'];
      
      mockCacheService.getCachedMetadata.mockResolvedValue(null);
      mockMetadataService.extractMetadata
        .mockResolvedValueOnce({
          url: urls[0],
          title: 'Example 1'
        })
        .mockResolvedValueOnce({
          url: urls[1],
          title: 'Example 2'
        });
      mockCacheService.cacheMetadata.mockResolvedValue(true);

      const result = await previewService.getBatchPreviews(urls);

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.valid).toBe(2);
      expect(result.invalid).toBe(0);
      expect(result.previews).toHaveLength(2);
      expect(result.previews[0].title).toBe('Example 1');
      expect(result.previews[1].title).toBe('Example 2');
    });

    it('無効なURLを含む場合は適切に処理する', async () => {
      const urls = ['https://example.com', 'invalid-url'];
      
      mockCacheService.getCachedMetadata.mockResolvedValue(null);
      mockMetadataService.extractMetadata.mockResolvedValue({
        url: urls[0],
        title: 'Valid Example'
      });
      mockCacheService.cacheMetadata.mockResolvedValue(true);

      const result = await previewService.getBatchPreviews(urls);

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.valid).toBe(1);
      expect(result.invalid).toBe(1);
      expect(result.previews).toHaveLength(2);
      expect(result.previews[0].title).toBe('Valid Example');
      expect(result.previews[1].error).toBe('Invalid URL format');
    });

    it('URL配列が空の場合はエラーを返す', async () => {
      const result = await previewService.getBatchPreviews([]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('URLs array is required');
    });

    it('URL数が制限を超える場合はエラーを返す', async () => {
      const urls = new Array(15).fill('https://example.com');

      const result = await previewService.getBatchPreviews(urls);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum 10 URLs allowed');
    });
  });

  describe('enhancePreview', () => {
    it('プレビューの品質を向上させる', async () => {
      const originalPreview = {
        url: 'https://example.com',
        title: 'Example',
        description: 'This is a very long description that exceeds the maximum length limit and should be truncated to improve readability and user experience',
        image: 'http://example.com/image.jpg'
      };

      const enhanced = await previewService.enhancePreview(originalPreview);

      expect(enhanced.description.length).toBeLessThanOrEqual(300);
      expect(enhanced.description).toContain('...');
      expect(enhanced.image).toBe('https://example.com/image.jpg'); // HTTP -> HTTPS
      expect(enhanced.qualityScore).toBeGreaterThan(0);
    });

    it('AWS公式サイトの場合は特化情報を追加する', async () => {
      const awsPreview = {
        url: 'https://docs.aws.amazon.com/lambda/',
        title: 'AWS Lambda Documentation',
        isAWSOfficial: true,
        awsService: 'Lambda'
      };

      const enhanced = await previewService.enhancePreview(awsPreview);

      expect(enhanced.awsEnhancements).toBeDefined();
      expect(enhanced.awsEnhancements.serviceCategory).toBe('Compute');
      expect(enhanced.awsEnhancements.serviceIcon).toContain('lambda');
    });
  });

  describe('calculateQualityScore', () => {
    it('完全なプレビューデータに高いスコアを付ける', () => {
      const completePreview = {
        title: 'Perfect Title Length',
        description: 'This is a well-sized description that provides good information about the content',
        image: 'https://example.com/image.jpg',
        siteName: 'Example Site',
        isAWSOfficial: true
      };

      const score = previewService.calculateQualityScore(completePreview);

      expect(score).toBeGreaterThan(80);
    });

    it('不完全なプレビューデータに低いスコアを付ける', () => {
      const incompletePreview = {
        title: 'Title'
      };

      const score = previewService.calculateQualityScore(incompletePreview);

      expect(score).toBeLessThan(50);
    });

    it('スコアが100を超えないようにする', () => {
      const perfectPreview = {
        title: 'Perfect Title That Is Just Right Length',
        description: 'Perfect description that is informative and well-sized for optimal user experience',
        image: 'https://example.com/image.jpg',
        siteName: 'Perfect Site',
        isAWSOfficial: true
      };

      const score = previewService.calculateQualityScore(perfectPreview);

      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('getStatistics', () => {
    it('統計情報を正常に取得する', async () => {
      const mockCacheStats = {
        totalCacheItems: 1000,
        hitRate: 0.85
      };

      mockCacheService.getCacheStatistics.mockResolvedValue(mockCacheStats);

      const stats = await previewService.getStatistics();

      expect(stats).toEqual(expect.objectContaining({
        service: 'URLPreviewService',
        version: '1.0.0',
        config: expect.objectContaining({
          maxBatchSize: 10,
          timeout: 15000
        }),
        cache: mockCacheStats
      }));
    });

    it('キャッシュ統計取得エラー時はエラー情報を含む', async () => {
      const error = new Error('Cache service unavailable');
      mockCacheService.getCacheStatistics.mockRejectedValue(error);

      const stats = await previewService.getStatistics();

      expect(stats).toEqual(expect.objectContaining({
        service: 'URLPreviewService',
        error: 'Cache service unavailable'
      }));
    });
  });

  describe('optimizeDescription', () => {
    it('長すぎる説明文を切り詰める', () => {
      const longDescription = 'A'.repeat(400);
      const optimized = previewService.optimizeDescription(longDescription);

      expect(optimized.length).toBeLessThanOrEqual(300);
      expect(optimized).toEndWith('...');
    });

    it('適切な長さの説明文はそのまま返す', () => {
      const goodDescription = 'This is a good description';
      const optimized = previewService.optimizeDescription(goodDescription);

      expect(optimized).toBe(goodDescription);
    });

    it('余分な空白を整理する', () => {
      const messyDescription = 'This  has   multiple    spaces\n\nand\tlines';
      const optimized = previewService.optimizeDescription(messyDescription);

      expect(optimized).toBe('This has multiple spaces and lines');
    });

    it('空の説明文は空文字を返す', () => {
      expect(previewService.optimizeDescription('')).toBe('');
      expect(previewService.optimizeDescription(null)).toBe('');
      expect(previewService.optimizeDescription(undefined)).toBe('');
    });
  });

  describe('getAWSServiceCategory', () => {
    it('既知のAWSサービスの正しいカテゴリを返す', () => {
      expect(previewService.getAWSServiceCategory('Lambda')).toBe('Compute');
      expect(previewService.getAWSServiceCategory('S3')).toBe('Storage');
      expect(previewService.getAWSServiceCategory('DynamoDB')).toBe('Database');
    });

    it('未知のサービスはOtherカテゴリを返す', () => {
      expect(previewService.getAWSServiceCategory('UnknownService')).toBe('Other');
    });
  });

  describe('isValidUrl', () => {
    it('有効なURLでtrueを返す', () => {
      expect(previewService.isValidUrl('https://example.com')).toBe(true);
      expect(previewService.isValidUrl('http://example.com')).toBe(true);
      expect(previewService.isValidUrl('https://example.com/path?query=1')).toBe(true);
    });

    it('無効なURLでfalseを返す', () => {
      expect(previewService.isValidUrl('invalid-url')).toBe(false);
      expect(previewService.isValidUrl('not a url')).toBe(false);
      expect(previewService.isValidUrl('')).toBe(false);
      expect(previewService.isValidUrl(null)).toBe(false);
    });
  });
});