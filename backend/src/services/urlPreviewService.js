/**
 * URLプレビューサービス
 * URLメタデータ取得とキャッシュ機能を統合したプレビューサービス
 */

const URLMetadataService = require('./urlMetadataService');
const URLCacheService = require('./urlCacheService');

class URLPreviewService {
  constructor() {
    this.metadataService = new URLMetadataService();
    this.cacheService = new URLCacheService();
    
    // プレビュー設定
    this.config = {
      maxBatchSize: 10, // 一度に処理できる最大URL数
      timeout: 15000, // 15秒タイムアウト
      retryAttempts: 2, // リトライ回数
      
      // プレビュー品質設定
      minImageSize: 100, // 最小画像サイズ（px）
      maxDescriptionLength: 300, // 説明文の最大長
      
      // キャッシュ設定
      enableCache: true,
      cacheOnError: false // エラー時はキャッシュしない
    };
  }

  /**
   * 単一URLのプレビューを取得
   * @param {string} url - プレビューを取得するURL
   * @param {Object} options - オプション設定
   * @returns {Promise<Object>} プレビューデータ
   */
  async getPreview(url, options = {}) {
    try {
      // URL形式の検証
      if (!this.isValidUrl(url)) {
        throw new Error('Invalid URL format');
      }

      const startTime = Date.now();
      
      // オプションのマージ
      const mergedOptions = {
        ...this.config,
        ...options
      };

      // キャッシュから取得を試行（強制更新でない場合）
      let preview = null;
      if (mergedOptions.enableCache && !mergedOptions.forceRefresh) {
        preview = await this.getCachedPreview(url);
        if (preview) {
          preview.responseTime = Date.now() - startTime;
          preview.source = 'cache';
          return preview;
        }
      }

      // 新規取得
      preview = await this.fetchFreshPreview(url, mergedOptions);
      preview.responseTime = Date.now() - startTime;
      preview.source = 'fresh';

      return preview;
    } catch (error) {
      console.error(`URLプレビュー取得エラー: ${url}`, error);
      return this.createErrorPreview(url, error.message);
    }
  }

  /**
   * 複数URLのプレビューを一括取得
   * @param {string[]} urls - プレビューを取得するURL配列
   * @param {Object} options - オプション設定
   * @returns {Promise<Object[]>} プレビューデータ配列
   */
  async getBatchPreviews(urls, options = {}) {
    try {
      // URL数の検証
      if (!Array.isArray(urls) || urls.length === 0) {
        throw new Error('URLs array is required');
      }

      if (urls.length > this.config.maxBatchSize) {
        throw new Error(`Maximum ${this.config.maxBatchSize} URLs allowed per batch`);
      }

      // 無効なURLを除外
      const validUrls = urls.filter(url => this.isValidUrl(url));
      const invalidUrls = urls.filter(url => !this.isValidUrl(url));

      const startTime = Date.now();
      
      // 並行処理でプレビューを取得
      const previewPromises = validUrls.map(url => 
        this.getPreview(url, options).catch(error => 
          this.createErrorPreview(url, error.message)
        )
      );

      const previews = await Promise.all(previewPromises);

      // 無効なURLのエラープレビューを追加
      const invalidPreviews = invalidUrls.map(url => 
        this.createErrorPreview(url, 'Invalid URL format')
      );

      const allPreviews = [...previews, ...invalidPreviews];
      const totalTime = Date.now() - startTime;

      return {
        success: true,
        total: urls.length,
        valid: validUrls.length,
        invalid: invalidUrls.length,
        responseTime: totalTime,
        previews: allPreviews
      };
    } catch (error) {
      console.error('バッチプレビュー取得エラー:', error);
      return {
        success: false,
        error: error.message,
        total: urls?.length || 0,
        previews: []
      };
    }
  }

  /**
   * プレビューの品質を向上
   * @param {Object} preview - 元のプレビューデータ
   * @returns {Object} 品質向上されたプレビューデータ
   */
  async enhancePreview(preview) {
    try {
      const enhanced = { ...preview };

      // 説明文の最適化
      if (enhanced.description) {
        enhanced.description = this.optimizeDescription(enhanced.description);
      }

      // 画像の検証と最適化
      if (enhanced.image) {
        enhanced.image = await this.validateAndOptimizeImage(enhanced.image);
      }

      // AWS特化情報の追加
      if (enhanced.isAWSOfficial) {
        enhanced.awsEnhancements = await this.addAWSEnhancements(enhanced);
      }

      // プレビュー品質スコアの計算
      enhanced.qualityScore = this.calculateQualityScore(enhanced);

      return enhanced;
    } catch (error) {
      console.warn('プレビュー品質向上エラー:', error);
      return preview; // エラー時は元のプレビューを返す
    }
  }

  /**
   * キャッシュからプレビューを取得
   * @param {string} url - URL
   * @returns {Promise<Object|null>} キャッシュされたプレビューまたはnull
   * @private
   */
  async getCachedPreview(url) {
    try {
      const cached = await this.cacheService.getCachedMetadata(url);
      if (cached) {
        return {
          ...cached,
          cached: true,
          cacheInfo: cached.cacheInfo
        };
      }
      return null;
    } catch (error) {
      console.warn('キャッシュ取得エラー:', error);
      return null;
    }
  }

  /**
   * 新規プレビューを取得
   * @param {string} url - URL
   * @param {Object} options - オプション
   * @returns {Promise<Object>} プレビューデータ
   * @private
   */
  async fetchFreshPreview(url, options) {
    let attempt = 0;
    let lastError;

    while (attempt <= options.retryAttempts) {
      try {
        // メタデータを取得
        const metadata = await this.metadataService.extractMetadata(url, {
          forceRefresh: options.forceRefresh,
          timeout: options.timeout
        });

        // プレビューデータに変換
        let preview = this.convertToPreview(metadata);

        // 品質向上処理
        preview = await this.enhancePreview(preview);

        // キャッシュに保存（エラーでない場合）
        if (options.enableCache && !preview.error) {
          this.cacheService.cacheMetadata(url, preview, {
            ttl: options.cacheTTL
          }).catch(error => console.warn('キャッシュ保存失敗:', error));
        }

        return preview;
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt <= options.retryAttempts) {
          console.warn(`プレビュー取得リトライ ${attempt}/${options.retryAttempts}: ${url}`);
          await this.delay(1000 * attempt); // 指数バックオフ
        }
      }
    }

    throw lastError;
  }

  /**
   * メタデータをプレビュー形式に変換
   * @param {Object} metadata - メタデータ
   * @returns {Object} プレビューデータ
   * @private
   */
  convertToPreview(metadata) {
    return {
      url: metadata.url,
      title: metadata.title,
      description: metadata.description,
      image: metadata.image,
      siteName: metadata.siteName,
      type: metadata.type || 'website',
      
      // AWS特化情報
      isAWSOfficial: metadata.isAWSOfficial || false,
      awsService: metadata.awsService,
      
      // プレビュー固有情報
      previewGenerated: new Date().toISOString(),
      cached: false,
      error: metadata.error
    };
  }

  /**
   * 説明文を最適化
   * @param {string} description - 元の説明文
   * @returns {string} 最適化された説明文
   * @private
   */
  optimizeDescription(description) {
    if (!description) return '';

    // 長すぎる場合は切り詰め
    if (description.length > this.config.maxDescriptionLength) {
      return description.substring(0, this.config.maxDescriptionLength - 3) + '...';
    }

    // 改行や余分な空白を整理
    return description.replace(/\s+/g, ' ').trim();
  }

  /**
   * 画像URLを検証・最適化
   * @param {string} imageUrl - 画像URL
   * @returns {Promise<string>} 最適化された画像URL
   * @private
   */
  async validateAndOptimizeImage(imageUrl) {
    try {
      // 相対URLを絶対URLに変換
      if (imageUrl.startsWith('/')) {
        // 実際の実装では元のURLのドメインを使用
        return imageUrl;
      }

      // HTTPSに変換（可能な場合）
      if (imageUrl.startsWith('http://')) {
        const httpsUrl = imageUrl.replace('http://', 'https://');
        return httpsUrl;
      }

      return imageUrl;
    } catch (error) {
      console.warn('画像URL最適化エラー:', error);
      return imageUrl;
    }
  }

  /**
   * AWS特化情報を追加
   * @param {Object} preview - プレビューデータ
   * @returns {Promise<Object>} AWS特化情報
   * @private
   */
  async addAWSEnhancements(preview) {
    const enhancements = {};

    if (preview.awsService) {
      enhancements.serviceCategory = this.getAWSServiceCategory(preview.awsService);
      enhancements.serviceIcon = this.getAWSServiceIcon(preview.awsService);
      enhancements.documentationType = this.getAWSDocumentationType(preview.url);
    }

    return enhancements;
  }

  /**
   * プレビュー品質スコアを計算
   * @param {Object} preview - プレビューデータ
   * @returns {number} 品質スコア（0-100）
   * @private
   */
  calculateQualityScore(preview) {
    let score = 0;

    // タイトルの存在と品質
    if (preview.title) {
      score += 30;
      if (preview.title.length > 10 && preview.title.length < 60) {
        score += 10;
      }
    }

    // 説明文の存在と品質
    if (preview.description) {
      score += 25;
      if (preview.description.length > 50 && preview.description.length < 200) {
        score += 10;
      }
    }

    // 画像の存在
    if (preview.image) {
      score += 20;
    }

    // サイト名の存在
    if (preview.siteName) {
      score += 10;
    }

    // AWS特化情報
    if (preview.isAWSOfficial) {
      score += 5;
    }

    return Math.min(score, 100);
  }

  /**
   * AWSサービスカテゴリを取得
   * @param {string} serviceName - サービス名
   * @returns {string} カテゴリ名
   * @private
   */
  getAWSServiceCategory(serviceName) {
    const categories = {
      'Lambda': 'Compute',
      'EC2': 'Compute',
      'S3': 'Storage',
      'DynamoDB': 'Database',
      'RDS': 'Database',
      'CloudFormation': 'Management',
      'CloudWatch': 'Management'
    };
    return categories[serviceName] || 'Other';
  }

  /**
   * AWSサービスアイコンを取得
   * @param {string} serviceName - サービス名
   * @returns {string} アイコンURL
   * @private
   */
  getAWSServiceIcon(serviceName) {
    return `https://aws-icons.s3.amazonaws.com/${serviceName.toLowerCase()}.png`;
  }

  /**
   * AWSドキュメントタイプを判定
   * @param {string} url - URL
   * @returns {string} ドキュメントタイプ
   * @private
   */
  getAWSDocumentationType(url) {
    if (url.includes('/userguide/')) return 'User Guide';
    if (url.includes('/api/')) return 'API Reference';
    if (url.includes('/cli/')) return 'CLI Reference';
    if (url.includes('/getting-started/')) return 'Getting Started';
    return 'Documentation';
  }

  /**
   * エラープレビューを作成
   * @param {string} url - URL
   * @param {string} errorMessage - エラーメッセージ
   * @returns {Object} エラープレビュー
   * @private
   */
  createErrorPreview(url, errorMessage) {
    return {
      url: url,
      title: this.extractDomainFromUrl(url),
      description: 'プレビューを取得できませんでした',
      error: errorMessage,
      cached: false,
      qualityScore: 0,
      previewGenerated: new Date().toISOString()
    };
  }

  /**
   * URLからドメインを抽出
   * @param {string} url - URL
   * @returns {string} ドメイン名
   * @private
   */
  extractDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
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

  /**
   * 指定時間待機
   * @param {number} ms - 待機時間（ミリ秒）
   * @returns {Promise} 待機Promise
   * @private
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * プレビューサービスの統計情報を取得
   * @returns {Promise<Object>} 統計情報
   */
  async getStatistics() {
    try {
      const cacheStats = await this.cacheService.getCacheStatistics();
      
      return {
        service: 'URLPreviewService',
        version: '1.0.0',
        config: {
          maxBatchSize: this.config.maxBatchSize,
          timeout: this.config.timeout,
          retryAttempts: this.config.retryAttempts
        },
        cache: cacheStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('統計情報取得エラー:', error);
      return {
        service: 'URLPreviewService',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = URLPreviewService;