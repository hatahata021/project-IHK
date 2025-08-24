import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  DeleteCommand,
  ScanCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb';
import { generateContentHash } from '../utils/translationUtils';

/**
 * 翻訳キャッシュエントリの型定義
 */
export interface TranslationCacheEntry {
  contentHash: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence?: number;
  qualityScore?: number;
  createdAt: string;
  expiresAt: number; // TTL用のUnixタイムスタンプ
  hitCount: number;
  lastAccessedAt: string;
}

/**
 * キャッシュ統計情報の型定義
 */
export interface CacheStatistics {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  oldestEntry?: string;
  newestEntry?: string;
}

/**
 * 翻訳キャッシュのDynamoDBモデル
 */
export class TranslationCacheModel {
  private client: DynamoDBDocumentClient;
  private tableName: string;
  private defaultTtl: number; // 秒単位

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-northeast-1'
    });
    
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.TRANSLATION_CACHE_TABLE || 'TranslationCache';
    this.defaultTtl = parseInt(process.env.TRANSLATION_CACHE_TTL || '86400'); // 24時間
  }

  /**
   * キャッシュエントリを保存
   */
  async put(
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string,
    confidence?: number,
    qualityScore?: number,
    customTtl?: number
  ): Promise<TranslationCacheEntry> {
    const contentHash = generateContentHash(originalText, sourceLanguage, targetLanguage);
    const now = new Date();
    const ttl = customTtl || this.defaultTtl;
    const expiresAt = Math.floor(now.getTime() / 1000) + ttl;

    const entry: TranslationCacheEntry = {
      contentHash,
      originalText,
      translatedText,
      sourceLanguage,
      targetLanguage,
      confidence,
      qualityScore,
      createdAt: now.toISOString(),
      expiresAt,
      hitCount: 0,
      lastAccessedAt: now.toISOString()
    };

    try {
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: entry
      }));

      console.log(`翻訳キャッシュを保存しました: ${contentHash}`);
      return entry;
    } catch (error) {
      console.error('翻訳キャッシュの保存に失敗:', error);
      throw new Error(`キャッシュ保存エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * キャッシュエントリを取得
   */
  async get(
    originalText: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationCacheEntry | null> {
    const contentHash = generateContentHash(originalText, sourceLanguage, targetLanguage);

    try {
      const response = await this.client.send(new GetCommand({
        TableName: this.tableName,
        Key: { contentHash }
      }));

      if (!response.Item) {
        return null;
      }

      const entry = response.Item as TranslationCacheEntry;

      // TTLチェック（DynamoDBのTTLが有効でない場合の手動チェック）
      const now = Math.floor(Date.now() / 1000);
      if (entry.expiresAt && entry.expiresAt < now) {
        console.log(`期限切れのキャッシュエントリを削除: ${contentHash}`);
        await this.delete(contentHash);
        return null;
      }

      // ヒット数を更新
      await this.updateHitCount(contentHash, entry.hitCount + 1);
      entry.hitCount += 1;
      entry.lastAccessedAt = new Date().toISOString();

      console.log(`翻訳キャッシュヒット: ${contentHash}`);
      return entry;
    } catch (error) {
      console.error('翻訳キャッシュの取得に失敗:', error);
      return null;
    }
  }

  /**
   * キャッシュエントリを削除
   */
  async delete(contentHash: string): Promise<void> {
    try {
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { contentHash }
      }));

      console.log(`翻訳キャッシュを削除しました: ${contentHash}`);
    } catch (error) {
      console.error('翻訳キャッシュの削除に失敗:', error);
      throw new Error(`キャッシュ削除エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * ヒット数を更新
   */
  private async updateHitCount(contentHash: string, newHitCount: number): Promise<void> {
    try {
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          contentHash,
          hitCount: newHitCount,
          lastAccessedAt: new Date().toISOString()
        },
        // 既存のアイテムの一部のみを更新
        ConditionExpression: 'attribute_exists(contentHash)'
      }));
    } catch (error) {
      // ヒット数の更新に失敗してもキャッシュ取得は継続
      console.warn('ヒット数の更新に失敗:', error);
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
    try {
      const response = await this.client.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'sourceLanguage = :source AND targetLanguage = :target',
        ExpressionAttributeValues: {
          ':source': sourceLanguage,
          ':target': targetLanguage
        },
        Limit: limit
      }));

      return (response.Items || []) as TranslationCacheEntry[];
    } catch (error) {
      console.error('言語ペア別キャッシュ取得に失敗:', error);
      return [];
    }
  }

  /**
   * 期限切れのキャッシュエントリをクリーンアップ
   */
  async cleanupExpiredEntries(): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    let deletedCount = 0;

    try {
      const response = await this.client.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'expiresAt < :now',
        ExpressionAttributeValues: {
          ':now': now
        }
      }));

      const expiredEntries = response.Items || [];

      for (const entry of expiredEntries) {
        await this.delete(entry.contentHash);
        deletedCount++;
      }

      console.log(`期限切れキャッシュエントリを${deletedCount}件削除しました`);
      return deletedCount;
    } catch (error) {
      console.error('期限切れキャッシュのクリーンアップに失敗:', error);
      return 0;
    }
  }

  /**
   * キャッシュ統計情報を取得
   */
  async getStatistics(): Promise<CacheStatistics> {
    try {
      const response = await this.client.send(new ScanCommand({
        TableName: this.tableName,
        Select: 'ALL_ATTRIBUTES'
      }));

      const entries = (response.Items || []) as TranslationCacheEntry[];
      const totalEntries = entries.length;
      const totalHits = entries.reduce((sum, entry) => sum + (entry.hitCount || 0), 0);
      
      // ヒット率の計算（簡易版）
      const hitRate = totalEntries > 0 ? totalHits / totalEntries : 0;

      // 最古・最新エントリの検索
      let oldestEntry: string | undefined;
      let newestEntry: string | undefined;

      if (entries.length > 0) {
        const sortedByCreated = entries.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        oldestEntry = sortedByCreated[0].createdAt;
        newestEntry = sortedByCreated[sortedByCreated.length - 1].createdAt;
      }

      return {
        totalEntries,
        hitCount: totalHits,
        missCount: 0, // 実際のミス数は別途追跡が必要
        hitRate,
        oldestEntry,
        newestEntry
      };
    } catch (error) {
      console.error('キャッシュ統計情報の取得に失敗:', error);
      return {
        totalEntries: 0,
        hitCount: 0,
        missCount: 0,
        hitRate: 0
      };
    }
  }

  /**
   * キャッシュサイズを制限（最も古いエントリから削除）
   */
  async limitCacheSize(maxEntries: number): Promise<number> {
    try {
      const response = await this.client.send(new ScanCommand({
        TableName: this.tableName,
        Select: 'ALL_ATTRIBUTES'
      }));

      const entries = (response.Items || []) as TranslationCacheEntry[];

      if (entries.length <= maxEntries) {
        return 0;
      }

      // 最後にアクセスされた時間でソート（古い順）
      const sortedEntries = entries.sort((a, b) => 
        new Date(a.lastAccessedAt).getTime() - new Date(b.lastAccessedAt).getTime()
      );

      const entriesToDelete = sortedEntries.slice(0, entries.length - maxEntries);
      let deletedCount = 0;

      for (const entry of entriesToDelete) {
        await this.delete(entry.contentHash);
        deletedCount++;
      }

      console.log(`キャッシュサイズ制限により${deletedCount}件のエントリを削除しました`);
      return deletedCount;
    } catch (error) {
      console.error('キャッシュサイズ制限処理に失敗:', error);
      return 0;
    }
  }

  /**
   * 全キャッシュエントリを削除（テスト用）
   */
  async clearAll(): Promise<void> {
    try {
      const response = await this.client.send(new ScanCommand({
        TableName: this.tableName,
        ProjectionExpression: 'contentHash'
      }));

      const entries = response.Items || [];

      for (const entry of entries) {
        await this.delete(entry.contentHash);
      }

      console.log(`全キャッシュエントリ（${entries.length}件）を削除しました`);
    } catch (error) {
      console.error('全キャッシュクリアに失敗:', error);
      throw new Error(`キャッシュクリアエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// シングルトンインスタンスをエクスポート
export const translationCacheModel = new TranslationCacheModel();