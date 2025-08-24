/**
 * URLキャッシュモデル
 * DynamoDBでのURLメタデータキャッシュ管理
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

class URLCacheModel {
  constructor() {
    // DynamoDBクライアントの初期化
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-northeast-1',
      ...(process.env.NODE_ENV === 'development' && {
        endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
      })
    });
    
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.URL_CACHE_TABLE_NAME || 'URLCache';
  }

  /**
   * URLキャッシュを保存
   * @param {string} url - キャッシュするURL
   * @param {Object} metadata - URLメタデータ
   * @param {number} ttlHours - キャッシュ有効期限（時間）
   * @returns {Promise<Object>} 保存結果
   */
  async saveCache(url, metadata, ttlHours = 24) {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (ttlHours * 60 * 60 * 1000));
      
      const cacheItem = {
        url: url,
        urlHash: this.generateUrlHash(url), // URLのハッシュ値をパーティションキーに使用
        metadata: metadata,
        createdAt: now.toISOString(),
        expiresAt: Math.floor(expiresAt.getTime() / 1000), // TTL用のUnixタイムスタンプ
        lastAccessed: now.toISOString(),
        accessCount: 1
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: cacheItem
      });

      await this.docClient.send(command);
      return { success: true, item: cacheItem };
    } catch (error) {
      console.error('URLキャッシュ保存エラー:', error);
      throw new Error(`キャッシュ保存に失敗しました: ${error.message}`);
    }
  }

  /**
   * URLキャッシュを取得
   * @param {string} url - 取得するURL
   * @returns {Promise<Object|null>} キャッシュされたメタデータまたはnull
   */
  async getCache(url) {
    try {
      const urlHash = this.generateUrlHash(url);
      
      const command = new GetCommand({
        TableName: this.tableName,
        Key: {
          urlHash: urlHash
        }
      });

      const result = await this.docClient.send(command);
      
      if (!result.Item) {
        return null;
      }

      // アクセス情報を更新
      await this.updateAccessInfo(urlHash);
      
      return result.Item;
    } catch (error) {
      console.error('URLキャッシュ取得エラー:', error);
      return null; // エラー時はキャッシュなしとして扱う
    }
  }

  /**
   * URLキャッシュを削除
   * @param {string} url - 削除するURL
   * @returns {Promise<boolean>} 削除成功可否
   */
  async deleteCache(url) {
    try {
      const urlHash = this.generateUrlHash(url);
      
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: {
          urlHash: urlHash
        }
      });

      await this.docClient.send(command);
      return true;
    } catch (error) {
      console.error('URLキャッシュ削除エラー:', error);
      return false;
    }
  }

  /**
   * 期限切れキャッシュを手動削除（通常はTTLで自動削除）
   * @returns {Promise<number>} 削除されたアイテム数
   */
  async cleanExpiredCache() {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      // 期限切れアイテムをスキャン（実際の運用では別の方法を推奨）
      const command = new QueryCommand({
        TableName: this.tableName,
        FilterExpression: 'expiresAt < :now',
        ExpressionAttributeValues: {
          ':now': now
        }
      });

      const result = await this.docClient.send(command);
      let deletedCount = 0;

      // 期限切れアイテムを削除
      for (const item of result.Items || []) {
        await this.deleteCache(item.url);
        deletedCount++;
      }

      return deletedCount;
    } catch (error) {
      console.error('期限切れキャッシュ削除エラー:', error);
      return 0;
    }
  }

  /**
   * アクセス情報を更新
   * @param {string} urlHash - URLハッシュ
   * @private
   */
  async updateAccessInfo(urlHash) {
    try {
      const command = new PutCommand({
        TableName: this.tableName,
        Key: {
          urlHash: urlHash
        },
        UpdateExpression: 'SET lastAccessed = :now, accessCount = accessCount + :inc',
        ExpressionAttributeValues: {
          ':now': new Date().toISOString(),
          ':inc': 1
        }
      });

      await this.docClient.send(command);
    } catch (error) {
      // アクセス情報更新の失敗は致命的ではないのでログのみ
      console.warn('アクセス情報更新失敗:', error);
    }
  }

  /**
   * URLのハッシュ値を生成
   * @param {string} url - ハッシュ化するURL
   * @returns {string} ハッシュ値
   * @private
   */
  generateUrlHash(url) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(url).digest('hex');
  }

  /**
   * キャッシュ統計情報を取得
   * @returns {Promise<Object>} 統計情報
   */
  async getCacheStats() {
    try {
      // 実際の実装では、より効率的な統計取得方法を使用
      const command = new QueryCommand({
        TableName: this.tableName,
        Select: 'COUNT'
      });

      const result = await this.docClient.send(command);
      
      return {
        totalCacheItems: result.Count || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('キャッシュ統計取得エラー:', error);
      return {
        totalCacheItems: 0,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

module.exports = URLCacheModel;