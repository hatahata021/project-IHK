/**
 * URLメタデータ取得サービス
 * Open Graphプロトコルに対応したメタデータ抽出機能を提供
 * キャッシュ機能統合版
 */

const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const URLCacheService = require('./urlCacheService');

class URLMetadataService {
  constructor() {
    this.timeout = 10000; // 10秒タイムアウト
    this.maxContentLength = 5 * 1024 * 1024; // 5MB制限
    this.userAgent = 'Mozilla/5.0 (compatible; AWS-Community-Bot/1.0)';
    
    // キャッシュサービスを初期化
    this.cacheService = new URLCacheService();
  }

  /**
   * URLからOpen Graphメタデータを取得（キャッシュ対応）
   * @param {string} url - 取得対象のURL
   * @param {Object} options - オプション設定
   * @returns {Promise<Object>} メタデータオブジェクト
   */
  async extractMetadata(url, options = {}) {
    try {
      // URL形式の検証
      if (!this.isValidUrl(url)) {
        throw new Error('Invalid URL format');
      }

      // キャッシュから取得を試行（強制更新でない場合）
      if (!options.forceRefresh) {
        const cachedMetadata = await this.cacheService.getCachedMetadata(url);
        if (cachedMetadata) {
          console.log(`キャッシュからメタデータを取得: ${url}`);
          return cachedMetadata;
        }
      }

      console.log(`新規メタデータ取得開始: ${url}`);

      // HTTPリクエストでHTMLを取得
      const response = await this.fetchHtml(url);
      
      // HTMLからメタデータを抽出
      const metadata = this.parseMetadata(response.data, url);
      
      // メタデータの後処理
      const processedMetadata = this.processMetadata(metadata, url);
      
      // キャッシュに保存（バックグラウンドで実行）
      this.cacheService.cacheMetadata(url, processedMetadata, options)
        .catch(error => console.warn('キャッシュ保存失敗:', error));
      
      return processedMetadata;
      
    } catch (error) {
      console.error(`URLメタデータ取得エラー: ${url}`, error);
      
      // エラー時のフォールバック
      return this.createFallbackMetadata(url, error.message);
    }
  }

  /**
   * URL形式の検証
   * @param {string} url - 検証対象のURL
   * @returns {boolean} 有効なURLかどうか
   */
  isValidUrl(url) {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * HTMLコンテンツを取得
   * @param {string} url - 取得対象のURL
   * @returns {Promise<Object>} axiosレスポンス
   */
  async fetchHtml(url) {
    const config = {
      method: 'GET',
      url: url,
      timeout: this.timeout,
      maxContentLength: this.maxContentLength,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      validateStatus: (status) => status < 400, // 4xx, 5xxエラーを例外として扱う
    };

    return await axios(config);
  }

  /**
   * HTMLからメタデータを解析
   * @param {string} html - HTMLコンテンツ
   * @param {string} url - 元のURL
   * @returns {Object} 抽出されたメタデータ
   */
  parseMetadata(html, url) {
    const $ = cheerio.load(html);
    const metadata = {};

    // Open Graphメタデータを優先的に取得
    metadata.title = this.extractTitle($);
    metadata.description = this.extractDescription($);
    metadata.imageUrl = this.extractImage($, url);
    metadata.siteName = this.extractSiteName($);
    metadata.type = this.extractType($);
    metadata.url = this.extractCanonicalUrl($, url);

    return metadata;
  }

  /**
   * タイトルを抽出
   * @param {Object} $ - cheerioオブジェクト
   * @returns {string|null} タイトル
   */
  extractTitle($) {
    // Open Graphタイトルを優先
    let title = $('meta[property="og:title"]').attr('content');
    
    if (!title) {
      // Twitter Cardタイトル
      title = $('meta[name="twitter:title"]').attr('content');
    }
    
    if (!title) {
      // HTMLタイトルタグ
      title = $('title').text();
    }

    return title ? title.trim().substring(0, 200) : null;
  }

  /**
   * 説明文を抽出
   * @param {Object} $ - cheerioオブジェクト
   * @returns {string|null} 説明文
   */
  extractDescription($) {
    // Open Graph説明文を優先
    let description = $('meta[property="og:description"]').attr('content');
    
    if (!description) {
      // Twitter Card説明文
      description = $('meta[name="twitter:description"]').attr('content');
    }
    
    if (!description) {
      // HTML meta description
      description = $('meta[name="description"]').attr('content');
    }

    return description ? description.trim().substring(0, 500) : null;
  }

  /**
   * 画像URLを抽出
   * @param {Object} $ - cheerioオブジェクト
   * @param {string} baseUrl - ベースURL
   * @returns {string|null} 画像URL
   */
  extractImage($, baseUrl) {
    // Open Graph画像を優先
    let imageUrl = $('meta[property="og:image"]').attr('content');
    
    if (!imageUrl) {
      // Twitter Card画像
      imageUrl = $('meta[name="twitter:image"]').attr('content');
    }
    
    if (!imageUrl) {
      // favicon
      imageUrl = $('link[rel="icon"]').attr('href') || 
                 $('link[rel="shortcut icon"]').attr('href');
    }

    if (imageUrl) {
      // 相対URLを絶対URLに変換
      return this.resolveUrl(imageUrl, baseUrl);
    }

    return null;
  }

  /**
   * サイト名を抽出
   * @param {Object} $ - cheerioオブジェクト
   * @returns {string|null} サイト名
   */
  extractSiteName($) {
    // Open Graphサイト名を優先
    let siteName = $('meta[property="og:site_name"]').attr('content');
    
    if (!siteName) {
      // Twitter Cardサイト名
      siteName = $('meta[name="twitter:site"]').attr('content');
    }

    return siteName ? siteName.trim().substring(0, 100) : null;
  }

  /**
   * コンテンツタイプを抽出
   * @param {Object} $ - cheerioオブジェクト
   * @returns {string|null} コンテンツタイプ
   */
  extractType($) {
    const type = $('meta[property="og:type"]').attr('content');
    return type ? type.trim() : 'website';
  }

  /**
   * 正規URLを抽出
   * @param {Object} $ - cheerioオブジェクト
   * @param {string} originalUrl - 元のURL
   * @returns {string} 正規URL
   */
  extractCanonicalUrl($, originalUrl) {
    // Open Graph URL
    let canonicalUrl = $('meta[property="og:url"]').attr('content');
    
    if (!canonicalUrl) {
      // canonical link
      canonicalUrl = $('link[rel="canonical"]').attr('href');
    }

    if (canonicalUrl) {
      return this.resolveUrl(canonicalUrl, originalUrl);
    }

    return originalUrl;
  }

  /**
   * 相対URLを絶対URLに変換
   * @param {string} url - 変換対象のURL
   * @param {string} baseUrl - ベースURL
   * @returns {string} 絶対URL
   */
  resolveUrl(url, baseUrl) {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }

  /**
   * メタデータの後処理
   * @param {Object} metadata - 生のメタデータ
   * @param {string} url - 元のURL
   * @returns {Object} 処理済みメタデータ
   */
  processMetadata(metadata, url) {
    // AWS公式ドキュメントの特別処理
    if (this.isAwsOfficialUrl(url)) {
      metadata.isAwsOfficial = true;
      metadata.awsService = this.extractAwsService(url);
    }

    // メタデータのクリーンアップ
    Object.keys(metadata).forEach(key => {
      if (metadata[key] === null || metadata[key] === undefined || metadata[key] === '') {
        delete metadata[key];
      }
    });

    // 必須フィールドの設定
    if (!metadata.title) {
      metadata.title = this.extractDomainFromUrl(url);
    }

    // コンテンツハッシュの生成（キャッシュ用）
    metadata.contentHash = this.generateContentHash(url, metadata);

    return metadata;
  }

  /**
   * AWS公式URLかどうかを判定
   * @param {string} url - 判定対象のURL
   * @returns {boolean} AWS公式URLかどうか
   */
  isAwsOfficialUrl(url) {
    const awsDomains = [
      'aws.amazon.com',
      'docs.aws.amazon.com',
      'console.aws.amazon.com',
      'aws.amazon.co.jp'
    ];

    try {
      const urlObj = new URL(url);
      return awsDomains.some(domain => 
        urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
      );
    } catch {
      return false;
    }
  }

  /**
   * URLからAWSサービス名を抽出
   * @param {string} url - AWS公式URL
   * @returns {string|null} AWSサービス名
   */
  extractAwsService(url) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part);
      
      // docs.aws.amazon.com/service-name/ の形式
      if (urlObj.hostname === 'docs.aws.amazon.com' && pathParts.length > 0) {
        return pathParts[0].toUpperCase();
      }
      
      // console.aws.amazon.com/service-name の形式
      if (urlObj.hostname.includes('console.aws.amazon.com') && pathParts.length > 0) {
        return pathParts[0].toUpperCase();
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * URLからドメイン名を抽出
   * @param {string} url - 対象URL
   * @returns {string} ドメイン名
   */
  extractDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'Unknown Site';
    }
  }

  /**
   * コンテンツハッシュを生成
   * @param {string} url - 元のURL
   * @param {Object} metadata - メタデータ
   * @returns {string} SHA256ハッシュ
   */
  generateContentHash(url, metadata) {
    const content = JSON.stringify({
      url,
      title: metadata.title,
      description: metadata.description
    });
    
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * エラー時のフォールバックメタデータを作成
   * @param {string} url - 元のURL
   * @param {string} errorMessage - エラーメッセージ
   * @returns {Object} フォールバックメタデータ
   */
  createFallbackMetadata(url, errorMessage) {
    return {
      url: url,
      title: this.extractDomainFromUrl(url),
      description: 'プレビューを取得できませんでした',
      error: errorMessage,
      contentHash: this.generateContentHash(url, { title: url })
    };
  }

  /**
   * 複数URLのメタデータを並行取得（キャッシュ対応）
   * @param {string[]} urls - URL配列
   * @param {Object} options - オプション設定
   * @returns {Promise<Object[]>} メタデータ配列
   */
  async extractMultipleMetadata(urls, options = {}) {
    // まずキャッシュから一括取得
    const cachedResults = await this.cacheService.getBulkCachedMetadata(urls);
    
    // キャッシュにないURLのみ新規取得
    const uncachedUrls = urls.filter(url => !cachedResults[url] || options.forceRefresh);
    
    const promises = uncachedUrls.map(url => this.extractMetadata(url, options));
    const newResults = await Promise.allSettled(promises);
    
    // 結果をマージ
    return urls.map(url => {
      const cached = cachedResults[url];
      if (cached && !options.forceRefresh) {
        return { url, metadata: cached };
      }
      
      const index = uncachedUrls.indexOf(url);
      const result = newResults[index];
      return {
        url,
        metadata: result.status === 'fulfilled' 
          ? result.value 
          : this.createFallbackMetadata(url, result.reason?.message || 'Unknown error')
      };
    });
  }

  /**
   * キャッシュを無効化
   * @param {string} url - 無効化するURL
   * @returns {Promise<boolean>} 無効化成功可否
   */
  async invalidateCache(url) {
    return await this.cacheService.invalidateCache(url);
  }

  /**
   * キャッシュ統計情報を取得
   * @returns {Promise<Object>} 統計情報
   */
  async getCacheStatistics() {
    return await this.cacheService.getCacheStatistics();
  }

  /**
   * 期限切れキャッシュをクリーンアップ
   * @returns {Promise<number>} 削除されたアイテム数
   */
  async cleanupExpiredCache() {
    return await this.cacheService.cleanupExpiredCache();
  }
}

module.exports = URLMetadataService;