/**
 * URLキャッシュサービス
 * URLメタデータのキャッシュ管理を行う
 */

const URLCacheModel = require('../models/urlCache');

class URLCacheService {
  constructor() {
    this.cacheModel = new URLCacheModel();
    
    // キャッシュ設定
    this.config = {
      defaultTTL: 24, // デフォルト24時間
      maxTTL: 168, // 最大7日間
      minTTL: 1, // 最小1時間
      
      // URL種別ごとのTTL設定
      ttlByUrlType: {
        'aws.amazon.com': 72, // AWS公式は3日間
        'github.com': 48, // GitHubは2日間
        'stackoverflow.com': 12, // Stack Overflowは12時間
        'default': 24 // その他は24時間
      }
    };
  }

  /**
   * キャッシュからメタデータを取得
   * @param {string} url - 取得するURL
   * @returns {Promise<Object|null>} キャッシュされたメタデータまたはnull
   */
  async getCachedMetadata(url) {
    try {
      if (!this.isValidUrl(url)) {
        return null;
      }

      const cachedItem = await this.cacheModel.getCache(url);
      
      if (!cachedItem) {
        return null;
      }

      // 期限チェック（TTLで自動削除されるが、念のため）
      if (this.isExpired(cachedItem)) {
        await this.cacheModel.deleteCache(url);
        return null;
      }

      return {
        ...cachedItem.metadata,
        cached: true,
        cacheInfo: {
          createdAt: cachedItem.createdAt,
          lastAccessed: cachedItem.lastAccessed,
          accessCount: cachedItem.accessCount
        }
      };
    } catch (error) {
      console.error('キャッシュ取得エラー:', error);
      return null;
    }
  }

  /**
   * メタデータをキャッシュに保存
   * @param {string} url - キャッシュするURL
   * @param {Object} metadata - URLメタデータ
   * @param {Object} options - キャッシュオプション
   * @returns {Promise<boolean>} 保存成功可否
   */
  async cacheMetadata(url, metadata, options = {}) {
    try {
      if (!this.isValidUrl(url) || !metadata) {
        return false;
      }

      // TTLを決定
      const ttl = this.determineTTL(url, options.ttl);
      
      // キャッシュ可能なメタデータかチェック
      if (!this.isCacheable(metadata)) {
        return false;
      }

      // メタデータを最適化（不要な情報を除去）
      const optimizedMetadata = this.optimizeMetadata(metadata);

      await this.cacheModel.saveCache(url, optimizedMetadata, ttl);
      return true;
    } catch (error) {
      console.error('キャッシュ保存エラー:', error);
      return false;
    }
  }

  /**
   * キャッシュを無効化
   * @param {string} url - 無効化するURL
   * @returns {Promise<boolean>} 無効化成功可否
   */
  async invalidateCache(url) {
    try {
      return await this.cacheModel.deleteCache(url);
    } catch (error) {
      console.error('キャッシュ無効化エラー:', error);
      return false;
    }
  }

  /**
   * 複数URLのキャッシュを一括取得
   * @param {string[]} urls - 取得するURL配列
   * @returns {Promise<Object>} URL別キャッシュ結果
   */
  async getBulkCachedMetadata(urls) {
    const results = {};
    
    const promises = urls.map(async (url) => {
      const cached = await this.getCachedMetadata(url);
      results[url] = cached;
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * キャッシュ統計情報を取得
   * @returns {Promise<Object>} 統計情報
   */
  async getCacheStatistics() {
    try {
      const stats = await this.cacheModel.getCacheStats();
      
      return {
        ...stats,
        config: {
          defaultTTL: this.config.defaultTTL,
          maxTTL: this.config.maxTTL,
          ttlByUrlType: this.config.ttlByUrlType
        }
      };
    } catch (error) {
      console.error('キャッシュ統計取得エラー:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 期限切れキャッシュを手動クリーンアップ
   * @returns {Promise<number>} 削除されたアイテム数
   */
  async cleanupExpiredCache() {
    try {
      return await this.cacheModel.cleanExpiredCache();
    } catch (error) {
      console.error('キャッシュクリーンアップエラー:', error);
      return 0;
    }
  }

  /**
   * URLに応じたTTLを決定
   * @param {string} url - URL
   * @param {number} customTTL - カスタムTTL
   * @returns {number} TTL（時間）
   * @private
   */
  determineTTL(url, customTTL) {
    // カスタムTTLが指定されている場合
    if (customTTL && customTTL >= this.config.minTTL && customTTL <= this.config.maxTTL) {
      return customTTL;
    }

    // URL種別に応じたTTL
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      for (const [domain, ttl] of Object.entries(this.config.ttlByUrlType)) {
        if (domain !== 'default' && hostname.includes(domain)) {
          return ttl;
        }
      }
    } catch (error) {
      console.warn('URL解析エラー:', error);
    }

    return this.config.ttlByUrlType.default;
  }

  /**
   * メタデータがキャッシュ可能かチェック
   * @param {Object} metadata - メタデータ
   * @returns {boolean} キャッシュ可能可否
   * @private
   */
  isCacheable(metadata) {
    // エラーメタデータはキャッシュしない
    if (metadata.error) {
      return false;
    }

    // 最低限の情報が含まれているかチェック
    if (!metadata.title && !metadata.description && !metadata.image) {
      return false;
    }

    // 動的コンテンツの場合はキャッシュしない
    if (metadata.isDynamic) {
      return false;
    }

    return true;
  }

  /**
   * メタデータを最適化（サイズ削減）
   * @param {Object} metadata - 元のメタデータ
   * @returns {Object} 最適化されたメタデータ
   * @private
   */
  optimizeMetadata(metadata) {
    const optimized = {
      title: metadata.title,
      description: metadata.description,
      image: metadata.image,
      url: metadata.url,
      siteName: metadata.siteName,
      type: metadata.type
    };

    // AWS特化情報
    if (metadata.isAWSOfficial) {
      optimized.isAWSOfficial = metadata.isAWSOfficial;
      optimized.awsService = metadata.awsService;
    }

    // 不要な情報を除去（大きなデータやデバッグ情報など）
    return optimized;
  }

  /**
   * キャッシュアイテムが期限切れかチェック
   * @param {Object} cachedItem - キャッシュアイテム
   * @returns {boolean} 期限切れかどうか
   * @private
   */
  isExpired(cachedItem) {
    const now = Math.floor(Date.now() / 1000);
    return cachedItem.expiresAt < now;
  }

  /**
   * 有効なURLかチェック
   * @param {string} url - チェックするURL
   * @returns {boolean} 有効なURLかどうか
   * @private
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = URLCacheService;