import { TranslationCacheModel, TranslationCacheEntry, CacheStatistics } from '../models/translationCache';
import { generateContentHash, calculateTranslationQuality } from '../utils/translationUtils';

/**
 * キャッシュ設定の型定義
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // 秒単位
  maxEntries: number;
  cleanupInterval: number; // 秒単位
  qualityThreshold: number; // 品質スコアの閾値
}

/**
 * キャッシュ操作結果の型定義
 */
export interface CacheOperationResult {
  success: boolean;
  fromCache: boolean;
  entry?: TranslationCacheEntry;
  error?: string;
}

/**
 * 翻訳キャッシュサービス
 * DynamoDBを使用した翻訳結果のキャッシュ機能を提供
 */
export class TranslationCacheService {
  private cacheModel: TranslationCacheModel;
  private config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    this.cacheModel = new TranslationCacheModel();
    
    // 設定の初期化
    this.config = {
      enabled: process.env.TRANSLATION_CACHE_ENABLED !== 'false',
      ttl: parseInt(process.env.TRANSLATION_CACHE_TTL || '86400'), // 24時間
      maxEntries: parseInt(process.env.TRANSLATION_CACHE_MAX_ENTRIES || '10000'),
      cleanupInterval: parseInt(process.env.TRANSLATION_CACHE_CLEANUP_INTERVAL || '3600'), // 1時間
      qualityThreshold: parseFloat(process.env.TRANSLATION_CACHE_QUALITY_THRESHOLD || '0.7')
    };

    // 定期クリーンアップの開始
    this.startPeriodicCleanup();
  }

  /**
   * キャッシュから翻訳結果を取得
   */
  async get(
    originalText: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<CacheOperationResult> {
    if (!this.config.enabled) {
      return {
        success: true,
        fromCache: false
      };
    }

    try {
      const entry = await this.cacheModel.get(originalText, sourceLanguage, targetLanguage);
      
      if (entry) {
        console.log(`翻訳キャッシュヒット: ${generateContentHash(originalText, sourceLanguage, targetLanguage)}`);
        return {
          success: true,
          fromCache: true,
          entry
        };
      } else {
        console.log(`翻訳キャッシュミス: ${generateContentHash(originalText, sourceLanguage, targetLanguage)}`);
        return {
          success: true,
          fromCache: false
        };
      }
    } catch (error) {
      console.error('キャッシュ取得エラー:', error);
      return {
        success: false,
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown cache error'
      };
    }
  }

  /**
   * 翻訳結果をキャッシュに保存
   */
  async put(
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string,
    confidence?: number,
    customTtl?: number
  ): Promise<CacheOperationResult> {
    if (!this.config.enabled) {
      return {
        success: true,
        fromCache: false
      };
    }

    try {
      // 翻訳品質を評価
      const qualityScore = calculateTranslationQuality(originalText, translatedText, confidence);
      
      // 品質が閾値を下回る場合はキャッシュしない
      if (qualityScore < this.config.qualityThreshold) {
        console.log(`翻訳品質が低いためキャッシュしません: ${qualityScore} < ${this.config.qualityThreshold}`);
        return {
          success: true,
          fromCache: false
        };
      }

      const entry = await this.cacheModel.put(
        originalText,
        translatedText,
        sourceLanguage,
        targetLanguage,
        confidence,
        qualityScore,
        customTtl || this.config.ttl
      );

      console.log(`翻訳結果をキャッシュに保存: ${entry.contentHash}`);
      
      // キャッシュサイズ制限をチェック
      await this.enforceCacheSizeLimit();

      return {
        success: true,
        fromCache: false,
        entry
      };
    } catch (error) {
      console.error('キャッシュ保存エラー:', error);
      return {
        success: false,
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown cache error'
      };
    }
  }

  /**
   * 特定のキャッシュエントリを削除
   */
  async delete(
    originalText: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<CacheOperationResult> {
    if (!this.config.enabled) {
      return {
        success: true,
        fromCache: false
      };
    }

    try {
      const contentHash = generateContentHash(originalText, sourceLanguage, targetLanguage);
      await this.cacheModel.delete(contentHash);

      console.log(`キャッシュエントリを削除: ${contentHash}`);
      return {
        success: true,
        fromCache: false
      };
    } catch (error) {
      console.error('キャッシュ削除エラー:', error);
      return {
        success: false,
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown cache error'
      };
    }
  }

  /**
   * 言語ペア別のキャッシュエントリを取得
   */
  async getByLanguagePair(
    sourceLanguage: string,
    targetLanguage: string,
    limit: number = 100
  ): Promise<TranslationCacheEntry[]> {
    if (!this.config.enabled) {
      return [];
    }

    try {
      return await this.cacheModel.getByLanguagePair(sourceLanguage, targetLanguage, limit);
    } catch (error) {
      console.error('言語ペア別キャッシュ取得エラー:', error);
      return [];
    }
  }

  /**
   * キャッシュ統計情報を取得
   */
  async getStatistics(): Promise<CacheStatistics> {
    if (!this.config.enabled) {
      return {
        totalEntries: 0,
        hitCount: 0,
        missCount: 0,
        hitRate: 0
      };
    }

    try {
      return await this.cacheModel.getStatistics();
    } catch (error) {
      console.error('キャッシュ統計取得エラー:', error);
      return {
        totalEntries: 0,
        hitCount: 0,
        missCount: 0,
        hitRate: 0
      };
    }
  }

  /**
   * 期限切れエントリのクリーンアップ
   */
  async cleanupExpiredEntries(): Promise<number> {
    if (!this.config.enabled) {
      return 0;
    }

    try {
      const deletedCount = await this.cacheModel.cleanupExpiredEntries();
      console.log(`期限切れキャッシュエントリを${deletedCount}件削除しました`);
      return deletedCount;
    } catch (error) {
      console.error('期限切れキャッシュクリーンアップエラー:', error);
      return 0;
    }
  }

  /**
   * キャッシュサイズ制限の実行
   */
  private async enforceCacheSizeLimit(): Promise<void> {
    try {
      const deletedCount = await this.cacheModel.limitCacheSize(this.config.maxEntries);
      if (deletedCount > 0) {
        console.log(`キャッシュサイズ制限により${deletedCount}件のエントリを削除しました`);
      }
    } catch (error) {
      console.error('キャッシュサイズ制限エラー:', error);
    }
  }

  /**
   * 定期クリーンアップの開始
   */
  private startPeriodicCleanup(): void {
    if (!this.config.enabled || this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        console.log('定期キャッシュクリーンアップを開始します');
        const deletedCount = await this.cleanupExpiredEntries();
        await this.enforceCacheSizeLimit();
        console.log(`定期キャッシュクリーンアップが完了しました（削除: ${deletedCount}件）`);
      } catch (error) {
        console.error('定期キャッシュクリーンアップエラー:', error);
      }
    }, this.config.cleanupInterval * 1000);

    console.log(`定期キャッシュクリーンアップを開始しました（間隔: ${this.config.cleanupInterval}秒）`);
  }

  /**
   * 定期クリーンアップの停止
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      console.log('定期キャッシュクリーンアップを停止しました');
    }
  }

  /**
   * 全キャッシュエントリを削除（テスト用）
   */
  async clearAll(): Promise<CacheOperationResult> {
    if (!this.config.enabled) {
      return {
        success: true,
        fromCache: false
      };
    }

    try {
      await this.cacheModel.clearAll();
      console.log('全キャッシュエントリを削除しました');
      return {
        success: true,
        fromCache: false
      };
    } catch (error) {
      console.error('全キャッシュクリアエラー:', error);
      return {
        success: false,
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown cache error'
      };
    }
  }

  /**
   * キャッシュ設定を取得
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * キャッシュ設定を更新
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // クリーンアップ間隔が変更された場合は再起動
    if (newConfig.cleanupInterval !== undefined) {
      this.stopPeriodicCleanup();
      this.startPeriodicCleanup();
    }

    console.log('キャッシュ設定を更新しました:', this.config);
  }

  /**
   * キャッシュの健全性をチェック
   */
  async healthCheck(): Promise<{ status: string; message: string; statistics?: CacheStatistics }> {
    if (!this.config.enabled) {
      return {
        status: 'disabled',
        message: 'キャッシュは無効になっています'
      };
    }

    try {
      const statistics = await this.getStatistics();
      
      return {
        status: 'healthy',
        message: 'キャッシュは正常に動作しています',
        statistics
      };
    } catch (error) {
      console.error('キャッシュヘルスチェックエラー:', error);
      return {
        status: 'unhealthy',
        message: `キャッシュでエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// シングルトンインスタンスをエクスポート
export const translationCacheService = new TranslationCacheService();