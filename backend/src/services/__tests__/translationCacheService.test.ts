import { TranslationCacheService } from '../translationCacheService';
import { TranslationCacheModel } from '../../models/translationCache';

// DynamoDB関連のモック
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('../../models/translationCache');

describe('TranslationCacheService', () => {
  let cacheService: TranslationCacheService;
  let mockCacheModel: jest.Mocked<TranslationCacheModel>;

  beforeEach(() => {
    // 環境変数をモック
    process.env.TRANSLATION_CACHE_ENABLED = 'true';
    process.env.TRANSLATION_CACHE_TTL = '3600';
    process.env.TRANSLATION_CACHE_MAX_ENTRIES = '1000';
    process.env.TRANSLATION_CACHE_CLEANUP_INTERVAL = '1800';
    process.env.TRANSLATION_CACHE_QUALITY_THRESHOLD = '0.7';

    cacheService = new TranslationCacheService();
    mockCacheModel = new TranslationCacheModel() as jest.Mocked<TranslationCacheModel>;
  });

  afterEach(() => {
    jest.clearAllMocks();
    cacheService.stopPeriodicCleanup();
  });

  describe('キャッシュ取得機能', () => {
    it('キャッシュヒット時に正しい結果を返す', async () => {
      const mockEntry = {
        contentHash: 'test-hash',
        originalText: 'Hello',
        translatedText: 'こんにちは',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        confidence: 0.9,
        qualityScore: 0.8,
        createdAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        hitCount: 1,
        lastAccessedAt: new Date().toISOString()
      };

      mockCacheModel.get = jest.fn().mockResolvedValue(mockEntry);

      const result = await cacheService.get('Hello', 'en', 'ja');

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
      expect(result.entry).toEqual(mockEntry);
    });

    it('キャッシュミス時に適切な結果を返す', async () => {
      mockCacheModel.get = jest.fn().mockResolvedValue(null);

      const result = await cacheService.get('Hello', 'en', 'ja');

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);
      expect(result.entry).toBeUndefined();
    });

    it('キャッシュが無効な場合は処理をスキップする', async () => {
      process.env.TRANSLATION_CACHE_ENABLED = 'false';
      const disabledCacheService = new TranslationCacheService();

      const result = await disabledCacheService.get('Hello', 'en', 'ja');

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);
    });
  });

  describe('キャッシュ保存機能', () => {
    it('高品質な翻訳結果を正常に保存する', async () => {
      const mockEntry = {
        contentHash: 'test-hash',
        originalText: 'Hello',
        translatedText: 'こんにちは',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        confidence: 0.9,
        qualityScore: 0.8,
        createdAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        hitCount: 0,
        lastAccessedAt: new Date().toISOString()
      };

      mockCacheModel.put = jest.fn().mockResolvedValue(mockEntry);
      mockCacheModel.limitCacheSize = jest.fn().mockResolvedValue(0);

      const result = await cacheService.put('Hello', 'こんにちは', 'en', 'ja', 0.9);

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);
      expect(result.entry).toEqual(mockEntry);
      expect(mockCacheModel.put).toHaveBeenCalled();
    });

    it('低品質な翻訳結果は保存しない', async () => {
      // 品質スコアが低い翻訳（短すぎる、信頼度が低い等）
      const result = await cacheService.put('Hi', 'Hi', 'en', 'ja', 0.3);

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);
      expect(mockCacheModel.put).not.toHaveBeenCalled();
    });
  });

  describe('キャッシュ削除機能', () => {
    it('指定されたエントリを正常に削除する', async () => {
      mockCacheModel.delete = jest.fn().mockResolvedValue(undefined);

      const result = await cacheService.delete('Hello', 'en', 'ja');

      expect(result.success).toBe(true);
      expect(mockCacheModel.delete).toHaveBeenCalled();
    });
  });

  describe('統計情報機能', () => {
    it('キャッシュ統計情報を正常に取得する', async () => {
      const mockStats = {
        totalEntries: 100,
        hitCount: 80,
        missCount: 20,
        hitRate: 0.8,
        oldestEntry: '2024-01-01T00:00:00Z',
        newestEntry: '2024-01-02T00:00:00Z'
      };

      mockCacheModel.getStatistics = jest.fn().mockResolvedValue(mockStats);

      const stats = await cacheService.getStatistics();

      expect(stats).toEqual(mockStats);
    });
  });

  describe('クリーンアップ機能', () => {
    it('期限切れエントリを正常にクリーンアップする', async () => {
      mockCacheModel.cleanupExpiredEntries = jest.fn().mockResolvedValue(5);

      const deletedCount = await cacheService.cleanupExpiredEntries();

      expect(deletedCount).toBe(5);
      expect(mockCacheModel.cleanupExpiredEntries).toHaveBeenCalled();
    });
  });

  describe('設定管理機能', () => {
    it('キャッシュ設定を正常に取得する', () => {
      const config = cacheService.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.ttl).toBe(3600);
      expect(config.maxEntries).toBe(1000);
    });

    it('キャッシュ設定を正常に更新する', () => {
      const newConfig = {
        ttl: 7200,
        maxEntries: 2000
      };

      cacheService.updateConfig(newConfig);
      const updatedConfig = cacheService.getConfig();

      expect(updatedConfig.ttl).toBe(7200);
      expect(updatedConfig.maxEntries).toBe(2000);
    });
  });

  describe('ヘルスチェック機能', () => {
    it('キャッシュが有効な場合は健全性をチェックする', async () => {
      const mockStats = {
        totalEntries: 100,
        hitCount: 80,
        missCount: 20,
        hitRate: 0.8
      };

      mockCacheModel.getStatistics = jest.fn().mockResolvedValue(mockStats);

      const health = await cacheService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.statistics).toEqual(mockStats);
    });

    it('キャッシュが無効な場合は無効状態を返す', async () => {
      process.env.TRANSLATION_CACHE_ENABLED = 'false';
      const disabledCacheService = new TranslationCacheService();

      const health = await disabledCacheService.healthCheck();

      expect(health.status).toBe('disabled');
      expect(health.message).toContain('無効');
    });
  });
});