/**
 * AWSサービスモデル
 * DynamoDBでのAWSサービス情報管理
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

class AWSServiceModel {
  constructor() {
    // DynamoDBクライアントの初期化
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-northeast-1',
      ...(process.env.NODE_ENV === 'development' && {
        endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
      })
    });
    
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.AWS_SERVICE_TABLE_NAME || 'AWSServices';
  }

  /**
   * AWSサービスを作成
   * @param {Object} serviceData - サービスデータ
   * @returns {Promise<Object>} 作成結果
   */
  async createService(serviceData) {
    try {
      const now = new Date().toISOString();
      const serviceId = this.generateServiceId(serviceData.serviceName);
      
      const service = {
        serviceId: serviceId,
        serviceName: serviceData.serviceName,
        serviceNameJa: serviceData.serviceNameJa || serviceData.serviceName,
        displayName: serviceData.displayName || serviceData.serviceName,
        displayNameJa: serviceData.displayNameJa || serviceData.displayName || serviceData.serviceName,
        description: serviceData.description || '',
        descriptionJa: serviceData.descriptionJa || serviceData.description || '',
        categoryId: serviceData.categoryId,
        subcategoryId: serviceData.subcategoryId || null,
        
        // サービス詳細情報
        serviceType: serviceData.serviceType || 'service', // service, feature, tool
        launchDate: serviceData.launchDate || null,
        region: serviceData.region || 'global',
        pricingModel: serviceData.pricingModel || 'pay-as-you-go',
        
        // UI表示用
        icon: serviceData.icon || null,
        color: serviceData.color || '#FF9900',
        logoUrl: serviceData.logoUrl || null,
        
        // ドキュメントリンク
        documentationUrl: serviceData.documentationUrl || null,
        consoleUrl: serviceData.consoleUrl || null,
        apiReferenceUrl: serviceData.apiReferenceUrl || null,
        
        // 特徴・タグ
        features: serviceData.features || [],
        tags: serviceData.tags || [],
        keywords: serviceData.keywords || [],
        
        // 関連サービス
        relatedServices: serviceData.relatedServices || [],
        
        // 統計情報
        popularityScore: serviceData.popularityScore || 0,
        usageCount: 0,
        
        // メタデータ
        isActive: serviceData.isActive !== false,
        isNew: serviceData.isNew || false,
        isPreview: serviceData.isPreview || false,
        isDeprecated: serviceData.isDeprecated || false,
        
        createdAt: now,
        updatedAt: now,
        createdBy: serviceData.createdBy || 'system',
        metadata: serviceData.metadata || {}
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: service,
        ConditionExpression: 'attribute_not_exists(serviceId)'
      });

      await this.docClient.send(command);
      return { success: true, service };
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('サービスが既に存在します');
      }
      console.error('サービス作成エラー:', error);
      throw new Error(`サービスの作成に失敗しました: ${error.message}`);
    }
  }

  /**
   * サービスを取得
   * @param {string} serviceId - サービスID
   * @returns {Promise<Object|null>} サービスデータまたはnull
   */
  async getService(serviceId) {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { serviceId }
      });

      const result = await this.docClient.send(command);
      return result.Item || null;
    } catch (error) {
      console.error('サービス取得エラー:', error);
      throw new Error(`サービスの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * カテゴリ別サービス一覧を取得
   * @param {string} categoryId - カテゴリID
   * @param {Object} options - 取得オプション
   * @returns {Promise<Object[]>} サービス配列
   */
  async getServicesByCategory(categoryId, options = {}) {
    try {
      const params = {
        TableName: this.tableName,
        FilterExpression: 'categoryId = :categoryId',
        ExpressionAttributeValues: {
          ':categoryId': categoryId
        }
      };

      // アクティブなサービスのみ
      if (options.activeOnly !== false) {
        params.FilterExpression += ' AND isActive = :active';
        params.ExpressionAttributeValues[':active'] = true;
      }

      const command = new ScanCommand(params);
      const result = await this.docClient.send(command);
      
      let services = result.Items || [];

      // ソート
      if (options.sortBy === 'popularity') {
        services.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));
      } else if (options.sortBy === 'name') {
        services.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
      } else {
        // デフォルト: 作成日順
        services.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      return services;
    } catch (error) {
      console.error('カテゴリ別サービス取得エラー:', error);
      throw new Error(`カテゴリ別サービスの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * 全サービスを取得
   * @param {Object} options - 取得オプション
   * @returns {Promise<Object[]>} サービス配列
   */
  async getAllServices(options = {}) {
    try {
      const params = {
        TableName: this.tableName
      };

      // フィルタ条件
      const filterExpressions = [];
      const expressionAttributeValues = {};

      if (options.activeOnly !== false) {
        filterExpressions.push('isActive = :active');
        expressionAttributeValues[':active'] = true;
      }

      if (options.serviceType) {
        filterExpressions.push('serviceType = :serviceType');
        expressionAttributeValues[':serviceType'] = options.serviceType;
      }

      if (options.isNew) {
        filterExpressions.push('isNew = :isNew');
        expressionAttributeValues[':isNew'] = true;
      }

      if (filterExpressions.length > 0) {
        params.FilterExpression = filterExpressions.join(' AND ');
        params.ExpressionAttributeValues = expressionAttributeValues;
      }

      const command = new ScanCommand(params);
      const result = await this.docClient.send(command);
      
      return result.Items || [];
    } catch (error) {
      console.error('全サービス取得エラー:', error);
      throw new Error(`サービス一覧の取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * サービスを更新
   * @param {string} serviceId - サービスID
   * @param {Object} updateData - 更新データ
   * @returns {Promise<Object>} 更新結果
   */
  async updateService(serviceId, updateData) {
    try {
      const now = new Date().toISOString();
      
      // 更新可能なフィールド
      const allowedFields = [
        'serviceNameJa', 'displayName', 'displayNameJa', 'description', 'descriptionJa',
        'categoryId', 'subcategoryId', 'serviceType', 'launchDate', 'region', 'pricingModel',
        'icon', 'color', 'logoUrl', 'documentationUrl', 'consoleUrl', 'apiReferenceUrl',
        'features', 'tags', 'keywords', 'relatedServices', 'popularityScore',
        'isActive', 'isNew', 'isPreview', 'isDeprecated', 'metadata'
      ];
      
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = { ':updatedAt': now };

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          updateExpression.push(`#${field} = :${field}`);
          expressionAttributeNames[`#${field}`] = field;
          expressionAttributeValues[`:${field}`] = updateData[field];
        }
      });

      if (updateExpression.length === 0) {
        throw new Error('更新するフィールドが指定されていません');
      }

      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { serviceId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(serviceId)',
        ReturnValues: 'ALL_NEW'
      });

      const result = await this.docClient.send(command);
      return { success: true, service: result.Attributes };
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('サービスが見つかりません');
      }
      console.error('サービス更新エラー:', error);
      throw new Error(`サービスの更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * サービスを削除
   * @param {string} serviceId - サービスID
   * @returns {Promise<boolean>} 削除成功可否
   */
  async deleteService(serviceId) {
    try {
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: { serviceId },
        ConditionExpression: 'attribute_exists(serviceId)'
      });

      await this.docClient.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('サービスが見つかりません');
      }
      console.error('サービス削除エラー:', error);
      throw new Error(`サービスの削除に失敗しました: ${error.message}`);
    }
  }

  /**
   * サービス検索
   * @param {string} searchTerm - 検索語
   * @param {Object} options - 検索オプション
   * @returns {Promise<Object[]>} 検索結果
   */
  async searchServices(searchTerm, options = {}) {
    try {
      const language = options.language || 'en';
      
      const params = {
        TableName: this.tableName,
        FilterExpression: language === 'ja'
          ? 'contains(serviceNameJa, :term) OR contains(displayNameJa, :term) OR contains(descriptionJa, :term)'
          : 'contains(serviceName, :term) OR contains(displayName, :term) OR contains(description, :term)',
        ExpressionAttributeValues: {
          ':term': searchTerm
        }
      };

      // アクティブなサービスのみ
      if (options.activeOnly !== false) {
        params.FilterExpression += ' AND isActive = :active';
        params.ExpressionAttributeValues[':active'] = true;
      }

      const command = new ScanCommand(params);
      const result = await this.docClient.send(command);
      
      let services = result.Items || [];

      // 関連度でソート（簡易実装）
      services.sort((a, b) => {
        const aScore = this.calculateRelevanceScore(a, searchTerm, language);
        const bScore = this.calculateRelevanceScore(b, searchTerm, language);
        return bScore - aScore;
      });

      return services;
    } catch (error) {
      console.error('サービス検索エラー:', error);
      throw new Error(`サービス検索に失敗しました: ${error.message}`);
    }
  }

  /**
   * 人気サービスを取得
   * @param {number} limit - 取得件数
   * @returns {Promise<Object[]>} 人気サービス配列
   */
  async getPopularServices(limit = 10) {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'isActive = :active',
        ExpressionAttributeValues: {
          ':active': true
        }
      });

      const result = await this.docClient.send(command);
      const services = result.Items || [];

      // 人気度でソート
      services.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));

      return services.slice(0, limit);
    } catch (error) {
      console.error('人気サービス取得エラー:', error);
      throw new Error(`人気サービスの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * サービス統計情報を取得
   * @returns {Promise<Object>} 統計情報
   */
  async getServiceStatistics() {
    try {
      const allServices = await this.getAllServices({ activeOnly: false });
      
      const stats = {
        totalServices: allServices.length,
        activeServices: allServices.filter(s => s.isActive).length,
        newServices: allServices.filter(s => s.isNew).length,
        previewServices: allServices.filter(s => s.isPreview).length,
        deprecatedServices: allServices.filter(s => s.isDeprecated).length,
        serviceTypeDistribution: {},
        categoryDistribution: {},
        timestamp: new Date().toISOString()
      };

      // サービスタイプ別分布
      allServices.forEach(service => {
        const type = service.serviceType || 'service';
        stats.serviceTypeDistribution[type] = (stats.serviceTypeDistribution[type] || 0) + 1;
      });

      // カテゴリ別分布
      allServices.forEach(service => {
        const categoryId = service.categoryId || 'uncategorized';
        stats.categoryDistribution[categoryId] = (stats.categoryDistribution[categoryId] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('サービス統計取得エラー:', error);
      throw new Error(`サービス統計の取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * サービスIDを生成
   * @param {string} serviceName - サービス名
   * @returns {string} サービスID
   * @private
   */
  generateServiceId(serviceName) {
    const crypto = require('crypto');
    const normalized = serviceName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hash = crypto.createHash('md5').update(normalized + Date.now()).digest('hex').substring(0, 8);
    return `svc_${hash}`;
  }

  /**
   * 検索関連度スコアを計算
   * @param {Object} service - サービスデータ
   * @param {string} searchTerm - 検索語
   * @param {string} language - 言語
   * @returns {number} 関連度スコア
   * @private
   */
  calculateRelevanceScore(service, searchTerm, language) {
    let score = 0;
    const term = searchTerm.toLowerCase();
    
    const fields = language === 'ja' 
      ? [service.serviceNameJa, service.displayNameJa, service.descriptionJa]
      : [service.serviceName, service.displayName, service.description];

    fields.forEach((field, index) => {
      if (field && field.toLowerCase().includes(term)) {
        // フィールドの重要度に応じてスコア調整
        const weight = [3, 2, 1][index] || 1;
        score += weight;
        
        // 完全一致の場合はボーナス
        if (field.toLowerCase() === term) {
          score += 5;
        }
      }
    });

    // 人気度も考慮
    score += (service.popularityScore || 0) * 0.1;

    return score;
  }
}

module.exports = AWSServiceModel;