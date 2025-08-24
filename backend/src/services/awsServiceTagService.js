/**
 * AWSサービスタグ管理サービス
 * AWSサービスのタグ管理と検索機能を提供
 */

const AWSServiceTagModel = require('../models/awsServiceTag');
const ServiceTagRelationModel = require('../models/serviceTagRelation');
const AWSServiceModel = require('../models/awsService');

class AWSServiceTagService {
  constructor() {
    this.tagModel = new AWSServiceTagModel();
    this.relationModel = new ServiceTagRelationModel();
    this.serviceModel = new AWSServiceModel();
    
    // デフォルトタグ定義
    this.defaultTags = [
      // 技術カテゴリ
      { name: 'serverless', nameJa: 'サーバーレス', category: 'technical', type: 'technology', color: '#FF9900' },
      { name: 'container', nameJa: 'コンテナ', category: 'technical', type: 'technology', color: '#3F48CC' },
      { name: 'microservices', nameJa: 'マイクロサービス', category: 'technical', type: 'architecture', color: '#C925D1' },
      { name: 'api', nameJa: 'API', category: 'technical', type: 'interface', color: '#7AA116' },
      { name: 'database', nameJa: 'データベース', category: 'technical', type: 'technology', color: '#D13212' },
      { name: 'storage', nameJa: 'ストレージ', category: 'technical', type: 'technology', color: '#8C4FFF' },
      { name: 'networking', nameJa: 'ネットワーキング', category: 'technical', type: 'technology', color: '#01A88D' },
      { name: 'security', nameJa: 'セキュリティ', category: 'technical', type: 'feature', color: '#FF4B4B' },
      
      // 用途カテゴリ
      { name: 'web-application', nameJa: 'Webアプリケーション', category: 'business', type: 'use-case', color: '#4CAF50' },
      { name: 'mobile-app', nameJa: 'モバイルアプリ', category: 'business', type: 'use-case', color: '#FF6B6B' },
      { name: 'data-analytics', nameJa: 'データ分析', category: 'business', type: 'use-case', color: '#9C27B0' },
      { name: 'machine-learning', nameJa: '機械学習', category: 'business', type: 'use-case', color: '#00BCD4' },
      { name: 'iot', nameJa: 'IoT', category: 'business', type: 'use-case', color: '#795548' },
      { name: 'gaming', nameJa: 'ゲーミング', category: 'business', type: 'industry', color: '#607D8B' },
      
      // 特徴カテゴリ
      { name: 'managed', nameJa: 'マネージド', category: 'general', type: 'feature', color: '#FFC107' },
      { name: 'scalable', nameJa: 'スケーラブル', category: 'general', type: 'feature', color: '#FF5722' },
      { name: 'high-availability', nameJa: '高可用性', category: 'general', type: 'feature', color: '#3F51B5' },
      { name: 'cost-effective', nameJa: 'コスト効率', category: 'general', type: 'feature', color: '#009688' },
      { name: 'real-time', nameJa: 'リアルタイム', category: 'general', type: 'feature', color: '#E91E63' },
      { name: 'global', nameJa: 'グローバル', category: 'region', type: 'feature', color: '#2196F3' }
    ];

    // 自動タグ付けルール
    this.autoTaggingRules = {
      // サービス名ベース
      serviceNameRules: {
        'lambda': ['serverless', 'compute', 'event-driven'],
        'ec2': ['compute', 'virtual-machine', 'scalable'],
        's3': ['storage', 'object-storage', 'scalable'],
        'rds': ['database', 'managed', 'relational'],
        'dynamodb': ['database', 'nosql', 'managed', 'serverless'],
        'api-gateway': ['api', 'managed', 'serverless'],
        'cloudfront': ['cdn', 'global', 'performance'],
        'ecs': ['container', 'managed', 'scalable'],
        'eks': ['kubernetes', 'container', 'managed']
      },
      
      // 説明文ベース
      descriptionRules: {
        'serverless': ['serverless', 'event-driven'],
        'container': ['container', 'docker'],
        'kubernetes': ['kubernetes', 'container'],
        'machine learning': ['machine-learning', 'ai'],
        'artificial intelligence': ['ai', 'machine-learning'],
        'real-time': ['real-time', 'streaming'],
        'analytics': ['data-analytics', 'big-data'],
        'mobile': ['mobile-app', 'mobile'],
        'iot': ['iot', 'device'],
        'gaming': ['gaming', 'game']
      }
    };
  }

  /**
   * デフォルトタグを初期化
   * @returns {Promise<Object>} 初期化結果
   */
  async initializeDefaultTags() {
    try {
      const results = {
        created: [],
        skipped: [],
        errors: []
      };

      for (const tagData of this.defaultTags) {
        try {
          const result = await this.tagModel.createTag({
            ...tagData,
            isOfficial: true,
            createdBy: 'system'
          });
          results.created.push(result.tag);
        } catch (error) {
          if (error.message.includes('既に存在')) {
            results.skipped.push(tagData.name);
          } else {
            results.errors.push({
              tag: tagData.name,
              error: error.message
            });
          }
        }
      }

      return {
        success: true,
        message: `${results.created.length}個のタグを作成しました`,
        details: results
      };
    } catch (error) {
      console.error('デフォルトタグ初期化エラー:', error);
      throw new Error(`デフォルトタグの初期化に失敗しました: ${error.message}`);
    }
  }

  /**
   * タグを作成
   * @param {Object} tagData - タグデータ
   * @returns {Promise<Object>} 作成結果
   */
  async createTag(tagData) {
    try {
      const result = await this.tagModel.createTag(tagData);
      return result;
    } catch (error) {
      console.error('タグ作成エラー:', error);
      throw error;
    }
  }

  /**
   * サービスにタグを割り当て
   * @param {string} serviceId - サービスID
   * @param {string[]} tagIds - タグID配列
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 割り当て結果
   */
  async assignTagsToService(serviceId, tagIds, options = {}) {
    try {
      // サービスの存在確認
      const service = await this.serviceModel.getService(serviceId);
      if (!service) {
        throw new Error('サービスが見つかりません');
      }

      // タグの存在確認
      const tagPromises = tagIds.map(tagId => this.tagModel.getTag(tagId));
      const tags = await Promise.all(tagPromises);
      
      const invalidTags = tags.map((tag, index) => tag ? null : tagIds[index]).filter(Boolean);
      if (invalidTags.length > 0) {
        throw new Error(`無効なタグが含まれています: ${invalidTags.join(', ')}`);
      }

      // タグを一括更新
      const result = await this.relationModel.updateServiceTags(serviceId, tagIds, options);

      // タグの使用回数を更新
      for (const tagId of result.results.added.map(r => r.tagId)) {
        await this.tagModel.updateUsageCount(tagId, 1);
      }

      for (const tagId of result.results.removed) {
        await this.tagModel.updateUsageCount(tagId, -1);
      }

      return result;
    } catch (error) {
      console.error('タグ割り当てエラー:', error);
      throw error;
    }
  }

  /**
   * サービスの自動タグ付け
   * @param {string} serviceId - サービスID
   * @returns {Promise<Object>} 自動タグ付け結果
   */
  async autoTagService(serviceId) {
    try {
      const service = await this.serviceModel.getService(serviceId);
      if (!service) {
        throw new Error('サービスが見つかりません');
      }

      const suggestedTags = await this.generateAutoTags(service);
      
      if (suggestedTags.length === 0) {
        return {
          success: true,
          message: '推奨タグが見つかりませんでした',
          suggestedTags: []
        };
      }

      // 推奨タグを実際に割り当て（信頼度付き）
      const assignmentPromises = suggestedTags.map(async (tagSuggestion) => {
        try {
          return await this.relationModel.assignTagToService(serviceId, tagSuggestion.tagId, {
            assignmentType: 'auto',
            confidence: tagSuggestion.confidence,
            assignedBy: 'auto-tagger'
          });
        } catch (error) {
          return { error: error.message, tagId: tagSuggestion.tagId };
        }
      });

      const results = await Promise.all(assignmentPromises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => r.error);

      // 成功したタグの使用回数を更新
      for (const result of successful) {
        await this.tagModel.updateUsageCount(result.relation.tagId, 1);
      }

      return {
        success: true,
        message: `${successful.length}個のタグを自動割り当てしました`,
        assignedTags: successful.map(r => r.relation),
        failedTags: failed,
        suggestedTags
      };
    } catch (error) {
      console.error('自動タグ付けエラー:', error);
      throw error;
    }
  }

  /**
   * タグベースでサービスを検索
   * @param {string[]} tagIds - タグID配列
   * @param {Object} options - 検索オプション
   * @returns {Promise<Object>} 検索結果
   */
  async searchServicesByTags(tagIds, options = {}) {
    try {
      // タグによるサービス検索
      const searchResults = await this.relationModel.findServicesByTags(tagIds, options);
      
      // サービス詳細情報を取得
      const servicePromises = searchResults.map(async (result) => {
        const service = await this.serviceModel.getService(result.serviceId);
        return {
          ...service,
          matchedTags: result.matchedTags,
          totalTags: tagIds.length,
          matchRatio: result.matchedTags / tagIds.length,
          tagRelations: result.relations
        };
      });

      const services = await Promise.all(servicePromises);
      
      // nullを除外
      const validServices = services.filter(Boolean);

      return {
        success: true,
        searchTags: tagIds,
        totalResults: validServices.length,
        services: validServices
      };
    } catch (error) {
      console.error('タグ検索エラー:', error);
      throw error;
    }
  }

  /**
   * サービスのタグ一覧を取得
   * @param {string} serviceId - サービスID
   * @param {Object} options - オプション
   * @returns {Promise<Object>} サービスタグ情報
   */
  async getServiceWithTags(serviceId, options = {}) {
    try {
      const service = await this.serviceModel.getService(serviceId);
      if (!service) {
        throw new Error('サービスが見つかりません');
      }

      const tagRelations = await this.relationModel.getServiceTags(serviceId, options);
      
      // タグ詳細情報を取得
      const tagPromises = tagRelations.map(async (relation) => {
        const tag = await this.tagModel.getTag(relation.tagId);
        return {
          ...tag,
          relation: {
            assignmentType: relation.assignmentType,
            confidence: relation.confidence,
            priority: relation.priority,
            assignedBy: relation.assignedBy,
            createdAt: relation.createdAt
          }
        };
      });

      const tags = await Promise.all(tagPromises);
      const validTags = tags.filter(Boolean);

      return {
        service,
        tags: validTags,
        tagCount: validTags.length,
        tagsByCategory: this.groupTagsByCategory(validTags),
        tagsByType: this.groupTagsByType(validTags)
      };
    } catch (error) {
      console.error('サービスタグ取得エラー:', error);
      throw error;
    }
  }

  /**
   * タグクラウドデータを取得
   * @param {Object} options - オプション
   * @returns {Promise<Object>} タグクラウドデータ
   */
  async getTagCloud(options = {}) {
    try {
      const tagCloudData = await this.tagModel.getTagCloudData(options);
      
      return {
        success: true,
        tagCloud: tagCloudData,
        totalTags: tagCloudData.length,
        options: {
          limit: options.limit || 50,
          minUsage: options.minUsage || 1,
          category: options.category
        }
      };
    } catch (error) {
      console.error('タグクラウド取得エラー:', error);
      throw error;
    }
  }

  /**
   * タグ統計情報を取得
   * @returns {Promise<Object>} 統計情報
   */
  async getTagStatistics() {
    try {
      const tagStats = await this.tagModel.getTagStatistics();
      const relationStats = await this.relationModel.getRelationStatistics();
      
      return {
        tags: tagStats,
        relations: relationStats,
        summary: {
          totalTags: tagStats.totalTags,
          totalRelations: relationStats.totalRelations,
          averageTagsPerService: relationStats.averageTagsPerService,
          averageServicesPerTag: relationStats.averageServicesPerTag,
          tagUtilizationRate: tagStats.activeTags > 0 
            ? Math.round((tagStats.totalUsage / tagStats.activeTags) * 100) / 100
            : 0
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('タグ統計取得エラー:', error);
      throw error;
    }
  }

  /**
   * 関連タグを取得
   * @param {string} tagId - タグID
   * @param {number} limit - 取得件数
   * @returns {Promise<Object[]>} 関連タグ配列
   */
  async getRelatedTags(tagId, limit = 10) {
    try {
      // 指定タグが割り当てられたサービスを取得
      const tagServices = await this.relationModel.getTagServices(tagId);
      const serviceIds = tagServices.map(relation => relation.serviceId);

      if (serviceIds.length === 0) {
        return [];
      }

      // 同じサービスに割り当てられた他のタグを取得
      const relatedTagCounts = {};
      
      for (const serviceId of serviceIds) {
        const serviceTags = await this.relationModel.getServiceTags(serviceId);
        serviceTags.forEach(relation => {
          if (relation.tagId !== tagId) {
            relatedTagCounts[relation.tagId] = (relatedTagCounts[relation.tagId] || 0) + 1;
          }
        });
      }

      // 関連度でソート
      const sortedRelatedTags = Object.entries(relatedTagCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, limit);

      // タグ詳細情報を取得
      const relatedTagPromises = sortedRelatedTags.map(async ([tagId, count]) => {
        const tag = await this.tagModel.getTag(tagId);
        return {
          ...tag,
          relationCount: count,
          relationStrength: count / serviceIds.length // 関連度（0-1）
        };
      });

      const relatedTags = await Promise.all(relatedTagPromises);
      return relatedTags.filter(Boolean);
    } catch (error) {
      console.error('関連タグ取得エラー:', error);
      throw error;
    }
  }

  /**
   * データ整合性をチェック
   * @returns {Promise<Object>} チェック結果
   */
  async validateTagIntegrity() {
    try {
      // 全サービスとタグを取得
      const allServices = await this.serviceModel.getAllServices({ activeOnly: false });
      const allTags = await this.tagModel.getAllTags({ activeOnly: false });
      
      const validServiceIds = allServices.map(s => s.serviceId);
      const validTagIds = allTags.map(t => t.tagId);

      // 孤立した関連付けを検出
      const orphanedResult = await this.relationModel.findOrphanedRelations(validServiceIds, validTagIds);

      // タグ使用回数の整合性チェック
      const usageCountIssues = [];
      for (const tag of allTags) {
        const actualUsage = await this.relationModel.getTagServices(tag.tagId);
        const recordedUsage = tag.usageCount || 0;
        const actualCount = actualUsage.length;

        if (actualCount !== recordedUsage) {
          usageCountIssues.push({
            tagId: tag.tagId,
            tagName: tag.name,
            recordedUsage,
            actualUsage: actualCount,
            difference: actualCount - recordedUsage
          });
        }
      }

      return {
        isValid: orphanedResult.invalidServiceRelations === 0 && 
                orphanedResult.invalidTagRelations === 0 && 
                usageCountIssues.length === 0,
        issues: {
          orphanedServiceRelations: orphanedResult.orphanedRelations.invalidServices,
          orphanedTagRelations: orphanedResult.orphanedRelations.invalidTags,
          usageCountMismatches: usageCountIssues
        },
        summary: {
          totalRelations: orphanedResult.totalRelations,
          validRelations: orphanedResult.validRelations,
          orphanedServiceRelations: orphanedResult.invalidServiceRelations,
          orphanedTagRelations: orphanedResult.invalidTagRelations,
          usageCountMismatches: usageCountIssues.length
        }
      };
    } catch (error) {
      console.error('タグ整合性チェックエラー:', error);
      throw error;
    }
  }

  /**
   * サービスから自動タグを生成
   * @param {Object} service - サービス情報
   * @returns {Promise<Object[]>} 推奨タグ配列
   * @private
   */
  async generateAutoTags(service) {
    try {
      const suggestedTagNames = new Set();
      
      // サービス名ベースの推奨
      const serviceName = service.serviceName.toLowerCase();
      Object.entries(this.autoTaggingRules.serviceNameRules).forEach(([keyword, tags]) => {
        if (serviceName.includes(keyword)) {
          tags.forEach(tag => suggestedTagNames.add(tag));
        }
      });

      // 説明文ベースの推奨
      const description = (service.description || '').toLowerCase();
      Object.entries(this.autoTaggingRules.descriptionRules).forEach(([keyword, tags]) => {
        if (description.includes(keyword)) {
          tags.forEach(tag => suggestedTagNames.add(tag));
        }
      });

      // 既存のタグから推奨タグを検索
      const allTags = await this.tagModel.getAllTags({ activeOnly: true });
      const suggestedTags = [];

      for (const tagName of suggestedTagNames) {
        const matchingTag = allTags.find(tag => 
          tag.name === tagName || 
          (tag.aliases && tag.aliases.includes(tagName))
        );
        
        if (matchingTag) {
          suggestedTags.push({
            tagId: matchingTag.tagId,
            tagName: matchingTag.name,
            confidence: this.calculateTagConfidence(service, matchingTag),
            reason: 'auto-generated'
          });
        }
      }

      // 信頼度でソート
      suggestedTags.sort((a, b) => b.confidence - a.confidence);

      return suggestedTags;
    } catch (error) {
      console.error('自動タグ生成エラー:', error);
      return [];
    }
  }

  /**
   * タグの信頼度を計算
   * @param {Object} service - サービス情報
   * @param {Object} tag - タグ情報
   * @returns {number} 信頼度（0-1）
   * @private
   */
  calculateTagConfidence(service, tag) {
    let confidence = 0.5; // ベース信頼度

    // サービス名での完全一致
    if (service.serviceName.toLowerCase().includes(tag.name)) {
      confidence += 0.3;
    }

    // 説明文での一致
    if (service.description && service.description.toLowerCase().includes(tag.name)) {
      confidence += 0.2;
    }

    // 公式タグの場合はボーナス
    if (tag.isOfficial) {
      confidence += 0.1;
    }

    // 人気タグの場合はボーナス
    if (tag.usageCount > 10) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * タグをカテゴリ別にグループ化
   * @param {Object[]} tags - タグ配列
   * @returns {Object} カテゴリ別タグ
   * @private
   */
  groupTagsByCategory(tags) {
    const grouped = {};
    tags.forEach(tag => {
      const category = tag.category || 'general';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(tag);
    });
    return grouped;
  }

  /**
   * タグをタイプ別にグループ化
   * @param {Object[]} tags - タグ配列
   * @returns {Object} タイプ別タグ
   * @private
   */
  groupTagsByType(tags) {
    const grouped = {};
    tags.forEach(tag => {
      const type = tag.type || 'feature';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(tag);
    });
    return grouped;
  }
}

module.exports = AWSServiceTagService;