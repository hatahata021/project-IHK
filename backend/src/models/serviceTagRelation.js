/**
 * サービス・タグ関連付けモデル
 * DynamoDBでのサービスとタグの多対多関係管理
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand, QueryCommand, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

class ServiceTagRelationModel {
  constructor() {
    // DynamoDBクライアントの初期化
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-northeast-1',
      ...(process.env.NODE_ENV === 'development' && {
        endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
      })
    });
    
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.SERVICE_TAG_RELATION_TABLE_NAME || 'ServiceTagRelations';
  }

  /**
   * サービスにタグを割り当て
   * @param {string} serviceId - サービスID
   * @param {string} tagId - タグID
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 割り当て結果
   */
  async assignTagToService(serviceId, tagId, options = {}) {
    try {
      const now = new Date().toISOString();
      const relationId = `${serviceId}#${tagId}`;
      
      const relation = {
        relationId: relationId,
        serviceId: serviceId,
        tagId: tagId,
        
        // 関連付け情報
        assignedBy: options.assignedBy || 'system',
        assignmentType: options.assignmentType || 'manual', // manual, auto, suggested
        confidence: options.confidence || 1.0, // 0.0-1.0の信頼度
        
        // メタデータ
        isActive: options.isActive !== false,
        priority: options.priority || 0, // 表示優先度
        
        createdAt: now,
        updatedAt: now,
        metadata: options.metadata || {}
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: relation,
        ConditionExpression: 'attribute_not_exists(relationId)'
      });

      await this.docClient.send(command);
      return { success: true, relation };
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('タグは既にサービスに割り当てられています');
      }
      console.error('タグ割り当てエラー:', error);
      throw new Error(`タグの割り当てに失敗しました: ${error.message}`);
    }
  }

  /**
   * サービスからタグを削除
   * @param {string} serviceId - サービスID
   * @param {string} tagId - タグID
   * @returns {Promise<boolean>} 削除成功可否
   */
  async removeTagFromService(serviceId, tagId) {
    try {
      const relationId = `${serviceId}#${tagId}`;
      
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: { relationId },
        ConditionExpression: 'attribute_exists(relationId)'
      });

      await this.docClient.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('関連付けが見つかりません');
      }
      console.error('タグ削除エラー:', error);
      throw new Error(`タグの削除に失敗しました: ${error.message}`);
    }
  }

  /**
   * サービスのタグ一覧を取得
   * @param {string} serviceId - サービスID
   * @param {Object} options - オプション
   * @returns {Promise<Object[]>} タグ一覧
   */
  async getServiceTags(serviceId, options = {}) {
    try {
      const params = {
        TableName: this.tableName,
        FilterExpression: 'serviceId = :serviceId',
        ExpressionAttributeValues: {
          ':serviceId': serviceId
        }
      };

      // アクティブな関連付けのみ
      if (options.activeOnly !== false) {
        params.FilterExpression += ' AND isActive = :active';
        params.ExpressionAttributeValues[':active'] = true;
      }

      // 割り当てタイプでフィルタ
      if (options.assignmentType) {
        params.FilterExpression += ' AND assignmentType = :assignmentType';
        params.ExpressionAttributeValues[':assignmentType'] = options.assignmentType;
      }

      const command = new ScanCommand(params);
      const result = await this.docClient.send(command);
      
      let relations = result.Items || [];

      // 優先度でソート
      relations.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      return relations;
    } catch (error) {
      console.error('サービスタグ取得エラー:', error);
      throw new Error(`サービスのタグ取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * タグが割り当てられたサービス一覧を取得
   * @param {string} tagId - タグID
   * @param {Object} options - オプション
   * @returns {Promise<Object[]>} サービス一覧
   */
  async getTagServices(tagId, options = {}) {
    try {
      const params = {
        TableName: this.tableName,
        FilterExpression: 'tagId = :tagId',
        ExpressionAttributeValues: {
          ':tagId': tagId
        }
      };

      // アクティブな関連付けのみ
      if (options.activeOnly !== false) {
        params.FilterExpression += ' AND isActive = :active';
        params.ExpressionAttributeValues[':active'] = true;
      }

      const command = new ScanCommand(params);
      const result = await this.docClient.send(command);
      
      return result.Items || [];
    } catch (error) {
      console.error('タグサービス取得エラー:', error);
      throw new Error(`タグのサービス取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * 複数タグでサービスを検索
   * @param {string[]} tagIds - タグID配列
   * @param {Object} options - 検索オプション
   * @returns {Promise<Object[]>} サービス一覧
   */
  async findServicesByTags(tagIds, options = {}) {
    try {
      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return [];
      }

      // 各タグのサービスを取得
      const tagServicePromises = tagIds.map(tagId => this.getTagServices(tagId, options));
      const tagServiceResults = await Promise.all(tagServicePromises);

      // サービスIDごとにマッチしたタグ数をカウント
      const serviceTagCounts = {};
      tagServiceResults.forEach((services, tagIndex) => {
        services.forEach(relation => {
          const serviceId = relation.serviceId;
          if (!serviceTagCounts[serviceId]) {
            serviceTagCounts[serviceId] = {
              serviceId,
              matchedTags: 0,
              relations: []
            };
          }
          serviceTagCounts[serviceId].matchedTags++;
          serviceTagCounts[serviceId].relations.push(relation);
        });
      });

      // 結果を配列に変換
      let results = Object.values(serviceTagCounts);

      // フィルタリング
      if (options.matchType === 'all') {
        // 全てのタグにマッチするサービスのみ
        results = results.filter(item => item.matchedTags === tagIds.length);
      } else if (options.minMatches) {
        // 最小マッチ数でフィルタ
        results = results.filter(item => item.matchedTags >= options.minMatches);
      }

      // ソート（マッチしたタグ数の降順）
      results.sort((a, b) => b.matchedTags - a.matchedTags);

      return results;
    } catch (error) {
      console.error('タグ検索エラー:', error);
      throw new Error(`タグによるサービス検索に失敗しました: ${error.message}`);
    }
  }

  /**
   * サービスのタグを一括更新
   * @param {string} serviceId - サービスID
   * @param {string[]} tagIds - 新しいタグID配列
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 更新結果
   */
  async updateServiceTags(serviceId, tagIds, options = {}) {
    try {
      // 現在のタグを取得
      const currentRelations = await this.getServiceTags(serviceId, { activeOnly: false });
      const currentTagIds = currentRelations.map(r => r.tagId);

      // 追加するタグと削除するタグを特定
      const tagsToAdd = tagIds.filter(tagId => !currentTagIds.includes(tagId));
      const tagsToRemove = currentTagIds.filter(tagId => !tagIds.includes(tagId));

      const results = {
        added: [],
        removed: [],
        errors: []
      };

      // タグを追加
      for (const tagId of tagsToAdd) {
        try {
          const result = await this.assignTagToService(serviceId, tagId, options);
          results.added.push(result.relation);
        } catch (error) {
          results.errors.push({
            action: 'add',
            tagId,
            error: error.message
          });
        }
      }

      // タグを削除
      for (const tagId of tagsToRemove) {
        try {
          await this.removeTagFromService(serviceId, tagId);
          results.removed.push(tagId);
        } catch (error) {
          results.errors.push({
            action: 'remove',
            tagId,
            error: error.message
          });
        }
      }

      return {
        success: results.errors.length === 0,
        serviceId,
        results
      };
    } catch (error) {
      console.error('サービスタグ一括更新エラー:', error);
      throw new Error(`サービスタグの一括更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * 関連付け統計を取得
   * @returns {Promise<Object>} 統計情報
   */
  async getRelationStatistics() {
    try {
      const command = new ScanCommand({
        TableName: this.tableName
      });

      const result = await this.docClient.send(command);
      const relations = result.Items || [];

      const stats = {
        totalRelations: relations.length,
        activeRelations: relations.filter(r => r.isActive).length,
        
        assignmentTypeDistribution: {},
        confidenceDistribution: {
          high: 0, // 0.8以上
          medium: 0, // 0.5-0.8
          low: 0 // 0.5未満
        },
        
        averageTagsPerService: 0,
        averageServicesPerTag: 0,
        
        timestamp: new Date().toISOString()
      };

      // 割り当てタイプ別分布
      relations.forEach(relation => {
        const type = relation.assignmentType || 'manual';
        stats.assignmentTypeDistribution[type] = (stats.assignmentTypeDistribution[type] || 0) + 1;
      });

      // 信頼度分布
      relations.forEach(relation => {
        const confidence = relation.confidence || 1.0;
        if (confidence >= 0.8) {
          stats.confidenceDistribution.high++;
        } else if (confidence >= 0.5) {
          stats.confidenceDistribution.medium++;
        } else {
          stats.confidenceDistribution.low++;
        }
      });

      // サービス・タグごとの平均計算
      const serviceTagCounts = {};
      const tagServiceCounts = {};

      relations.forEach(relation => {
        // サービスごとのタグ数
        serviceTagCounts[relation.serviceId] = (serviceTagCounts[relation.serviceId] || 0) + 1;
        // タグごとのサービス数
        tagServiceCounts[relation.tagId] = (tagServiceCounts[relation.tagId] || 0) + 1;
      });

      const serviceCount = Object.keys(serviceTagCounts).length;
      const tagCount = Object.keys(tagServiceCounts).length;

      if (serviceCount > 0) {
        const totalTagsAssigned = Object.values(serviceTagCounts).reduce((sum, count) => sum + count, 0);
        stats.averageTagsPerService = Math.round((totalTagsAssigned / serviceCount) * 10) / 10;
      }

      if (tagCount > 0) {
        const totalServicesTagged = Object.values(tagServiceCounts).reduce((sum, count) => sum + count, 0);
        stats.averageServicesPerTag = Math.round((totalServicesTagged / tagCount) * 10) / 10;
      }

      return stats;
    } catch (error) {
      console.error('関連付け統計取得エラー:', error);
      throw new Error(`関連付け統計の取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * 孤立した関連付けを検出
   * @param {string[]} validServiceIds - 有効なサービスID配列
   * @param {string[]} validTagIds - 有効なタグID配列
   * @returns {Promise<Object>} 孤立した関連付け情報
   */
  async findOrphanedRelations(validServiceIds, validTagIds) {
    try {
      const command = new ScanCommand({
        TableName: this.tableName
      });

      const result = await this.docClient.send(command);
      const relations = result.Items || [];

      const orphanedRelations = {
        invalidServices: [],
        invalidTags: [],
        validRelations: []
      };

      relations.forEach(relation => {
        const hasValidService = validServiceIds.includes(relation.serviceId);
        const hasValidTag = validTagIds.includes(relation.tagId);

        if (!hasValidService) {
          orphanedRelations.invalidServices.push(relation);
        } else if (!hasValidTag) {
          orphanedRelations.invalidTags.push(relation);
        } else {
          orphanedRelations.validRelations.push(relation);
        }
      });

      return {
        totalRelations: relations.length,
        validRelations: orphanedRelations.validRelations.length,
        invalidServiceRelations: orphanedRelations.invalidServices.length,
        invalidTagRelations: orphanedRelations.invalidTags.length,
        orphanedRelations
      };
    } catch (error) {
      console.error('孤立関連付け検出エラー:', error);
      throw new Error(`孤立した関連付けの検出に失敗しました: ${error.message}`);
    }
  }

  /**
   * 孤立した関連付けを削除
   * @param {Object[]} orphanedRelations - 孤立した関連付け配列
   * @returns {Promise<number>} 削除された関連付け数
   */
  async cleanupOrphanedRelations(orphanedRelations) {
    try {
      let deletedCount = 0;

      // バッチ削除で効率化
      const batchSize = 25; // DynamoDBの制限
      for (let i = 0; i < orphanedRelations.length; i += batchSize) {
        const batch = orphanedRelations.slice(i, i + batchSize);
        
        const deleteRequests = batch.map(relation => ({
          DeleteRequest: {
            Key: { relationId: relation.relationId }
          }
        }));

        const command = new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: deleteRequests
          }
        });

        await this.docClient.send(command);
        deletedCount += batch.length;
      }

      return deletedCount;
    } catch (error) {
      console.error('孤立関連付け削除エラー:', error);
      throw new Error(`孤立した関連付けの削除に失敗しました: ${error.message}`);
    }
  }
}

module.exports = ServiceTagRelationModel;