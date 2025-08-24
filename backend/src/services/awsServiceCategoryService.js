/**
 * AWSサービスカテゴリ管理サービス
 * AWSサービスのカテゴリ分類と管理機能を提供
 */

const AWSServiceCategoryModel = require('../models/awsServiceCategory');
const AWSServiceModel = require('../models/awsService');

class AWSServiceCategoryService {
  constructor() {
    this.categoryModel = new AWSServiceCategoryModel();
    this.serviceModel = new AWSServiceModel();
    
    // デフォルトカテゴリ定義
    this.defaultCategories = [
      {
        name: 'Compute',
        nameJa: 'コンピューティング',
        description: 'Virtual servers, containers, and serverless computing',
        descriptionJa: '仮想サーバー、コンテナ、サーバーレスコンピューティング',
        color: '#FF9900',
        icon: 'compute',
        displayOrder: 1
      },
      {
        name: 'Storage',
        nameJa: 'ストレージ',
        description: 'Object storage, file systems, and data archiving',
        descriptionJa: 'オブジェクトストレージ、ファイルシステム、データアーカイブ',
        color: '#3F48CC',
        icon: 'storage',
        displayOrder: 2
      },
      {
        name: 'Database',
        nameJa: 'データベース',
        description: 'Relational, NoSQL, and in-memory databases',
        descriptionJa: 'リレーショナル、NoSQL、インメモリデータベース',
        color: '#C925D1',
        icon: 'database',
        displayOrder: 3
      },
      {
        name: 'Networking',
        nameJa: 'ネットワーキング',
        description: 'VPC, load balancing, and content delivery',
        descriptionJa: 'VPC、ロードバランシング、コンテンツ配信',
        color: '#7AA116',
        icon: 'networking',
        displayOrder: 4
      },
      {
        name: 'Security',
        nameJa: 'セキュリティ',
        description: 'Identity, compliance, and data protection',
        descriptionJa: 'アイデンティティ、コンプライアンス、データ保護',
        color: '#D13212',
        icon: 'security',
        displayOrder: 5
      },
      {
        name: 'Analytics',
        nameJa: 'アナリティクス',
        description: 'Big data, data lakes, and business intelligence',
        descriptionJa: 'ビッグデータ、データレイク、ビジネスインテリジェンス',
        color: '#8C4FFF',
        icon: 'analytics',
        displayOrder: 6
      },
      {
        name: 'Machine Learning',
        nameJa: '機械学習',
        description: 'AI services, ML platforms, and data science tools',
        descriptionJa: 'AIサービス、MLプラットフォーム、データサイエンスツール',
        color: '#01A88D',
        icon: 'ml',
        displayOrder: 7
      },
      {
        name: 'Management',
        nameJa: '管理・ガバナンス',
        description: 'Monitoring, automation, and resource management',
        descriptionJa: 'モニタリング、自動化、リソース管理',
        color: '#FF4B4B',
        icon: 'management',
        displayOrder: 8
      }
    ];

    // サービス自動分類ルール
    this.classificationRules = {
      'Compute': ['ec2', 'lambda', 'ecs', 'eks', 'fargate', 'batch', 'lightsail'],
      'Storage': ['s3', 'ebs', 'efs', 'fsx', 'glacier', 'backup'],
      'Database': ['rds', 'dynamodb', 'redshift', 'aurora', 'documentdb', 'neptune', 'timestream'],
      'Networking': ['vpc', 'cloudfront', 'route53', 'elb', 'api-gateway', 'direct-connect'],
      'Security': ['iam', 'cognito', 'kms', 'secrets-manager', 'certificate-manager', 'waf'],
      'Analytics': ['athena', 'emr', 'kinesis', 'glue', 'quicksight', 'elasticsearch'],
      'Machine Learning': ['sagemaker', 'rekognition', 'comprehend', 'translate', 'polly', 'lex'],
      'Management': ['cloudwatch', 'cloudformation', 'systems-manager', 'config', 'cloudtrail']
    };
  }

  /**
   * デフォルトカテゴリを初期化
   * @returns {Promise<Object>} 初期化結果
   */
  async initializeDefaultCategories() {
    try {
      const results = {
        created: [],
        skipped: [],
        errors: []
      };

      for (const categoryData of this.defaultCategories) {
        try {
          const result = await this.categoryModel.createCategory(categoryData);
          results.created.push(result.category);
        } catch (error) {
          if (error.message.includes('既に存在')) {
            results.skipped.push(categoryData.name);
          } else {
            results.errors.push({
              category: categoryData.name,
              error: error.message
            });
          }
        }
      }

      return {
        success: true,
        message: `${results.created.length}個のカテゴリを作成しました`,
        details: results
      };
    } catch (error) {
      console.error('デフォルトカテゴリ初期化エラー:', error);
      throw new Error(`デフォルトカテゴリの初期化に失敗しました: ${error.message}`);
    }
  }

  /**
   * カテゴリを作成
   * @param {Object} categoryData - カテゴリデータ
   * @returns {Promise<Object>} 作成結果
   */
  async createCategory(categoryData) {
    try {
      // 親カテゴリが指定されている場合は存在確認
      if (categoryData.parentCategoryId) {
        const parentCategory = await this.categoryModel.getCategory(categoryData.parentCategoryId);
        if (!parentCategory) {
          throw new Error('指定された親カテゴリが存在しません');
        }
        // 子カテゴリのレベルを設定
        categoryData.level = (parentCategory.level || 0) + 1;
      }

      const result = await this.categoryModel.createCategory(categoryData);
      return result;
    } catch (error) {
      console.error('カテゴリ作成エラー:', error);
      throw error;
    }
  }

  /**
   * カテゴリ階層構造を取得
   * @param {Object} options - 取得オプション
   * @returns {Promise<Object>} 階層構造データ
   */
  async getCategoryHierarchy(options = {}) {
    try {
      const hierarchy = await this.categoryModel.getCategoryHierarchy();
      
      // サービス数を含める場合
      if (options.includeServiceCount) {
        await this.enrichWithServiceCounts(hierarchy.hierarchy);
      }

      return hierarchy;
    } catch (error) {
      console.error('階層構造取得エラー:', error);
      throw error;
    }
  }

  /**
   * カテゴリ別サービス一覧を取得
   * @param {string} categoryId - カテゴリID
   * @param {Object} options - 取得オプション
   * @returns {Promise<Object>} カテゴリとサービス情報
   */
  async getCategoryWithServices(categoryId, options = {}) {
    try {
      const category = await this.categoryModel.getCategory(categoryId);
      if (!category) {
        throw new Error('カテゴリが見つかりません');
      }

      const services = await this.serviceModel.getServicesByCategory(categoryId, options);
      
      // 子カテゴリも取得
      const childCategories = await this.categoryModel.getChildCategories(categoryId);

      return {
        category,
        services,
        childCategories,
        serviceCount: services.length,
        childCategoryCount: childCategories.length
      };
    } catch (error) {
      console.error('カテゴリ別サービス取得エラー:', error);
      throw error;
    }
  }

  /**
   * サービスを自動分類
   * @param {string} serviceName - サービス名
   * @returns {Promise<string|null>} 推奨カテゴリID
   */
  async classifyService(serviceName) {
    try {
      const normalizedName = serviceName.toLowerCase().replace(/[^a-z0-9-]/g, '');
      
      // ルールベース分類
      for (const [categoryName, keywords] of Object.entries(this.classificationRules)) {
        for (const keyword of keywords) {
          if (normalizedName.includes(keyword)) {
            // カテゴリ名からカテゴリIDを取得
            const categories = await this.categoryModel.getAllCategories({ activeOnly: true });
            const category = categories.find(c => c.name === categoryName);
            return category ? category.categoryId : null;
          }
        }
      }

      return null; // 分類できない場合
    } catch (error) {
      console.error('サービス自動分類エラー:', error);
      return null;
    }
  }

  /**
   * サービスをカテゴリに割り当て
   * @param {string} serviceId - サービスID
   * @param {string} categoryId - カテゴリID
   * @returns {Promise<Object>} 割り当て結果
   */
  async assignServiceToCategory(serviceId, categoryId) {
    try {
      // サービスとカテゴリの存在確認
      const service = await this.serviceModel.getService(serviceId);
      if (!service) {
        throw new Error('サービスが見つかりません');
      }

      const category = await this.categoryModel.getCategory(categoryId);
      if (!category) {
        throw new Error('カテゴリが見つかりません');
      }

      const oldCategoryId = service.categoryId;

      // サービスのカテゴリを更新
      await this.serviceModel.updateService(serviceId, { categoryId });

      // カテゴリのサービス数を更新
      if (oldCategoryId && oldCategoryId !== categoryId) {
        await this.categoryModel.updateServiceCount(oldCategoryId, -1);
      }
      if (!oldCategoryId || oldCategoryId !== categoryId) {
        await this.categoryModel.updateServiceCount(categoryId, 1);
      }

      return {
        success: true,
        message: 'サービスをカテゴリに割り当てました',
        serviceId,
        categoryId,
        oldCategoryId
      };
    } catch (error) {
      console.error('サービス割り当てエラー:', error);
      throw error;
    }
  }

  /**
   * カテゴリを検索
   * @param {string} searchTerm - 検索語
   * @param {Object} options - 検索オプション
   * @returns {Promise<Object[]>} 検索結果
   */
  async searchCategories(searchTerm, options = {}) {
    try {
      const language = options.language || 'en';
      const categories = await this.categoryModel.searchCategories(searchTerm, language);
      
      // サービス数を含める場合
      if (options.includeServiceCount) {
        for (const category of categories) {
          const services = await this.serviceModel.getServicesByCategory(category.categoryId);
          category.actualServiceCount = services.length;
        }
      }

      return categories;
    } catch (error) {
      console.error('カテゴリ検索エラー:', error);
      throw error;
    }
  }

  /**
   * カテゴリ統計情報を取得
   * @returns {Promise<Object>} 統計情報
   */
  async getCategoryStatistics() {
    try {
      const categoryStats = await this.categoryModel.getCategoryStatistics();
      const serviceStats = await this.serviceModel.getServiceStatistics();
      
      // カテゴリ別サービス分布の詳細を取得
      const categories = await this.categoryModel.getAllCategories({ activeOnly: true });
      const detailedDistribution = {};
      
      for (const category of categories) {
        const services = await this.serviceModel.getServicesByCategory(category.categoryId);
        detailedDistribution[category.categoryId] = {
          categoryName: category.name,
          categoryNameJa: category.nameJa,
          serviceCount: services.length,
          activeServices: services.filter(s => s.isActive).length,
          newServices: services.filter(s => s.isNew).length
        };
      }

      return {
        categories: categoryStats,
        services: serviceStats,
        categoryServiceDistribution: detailedDistribution,
        summary: {
          totalCategories: categoryStats.totalCategories,
          totalServices: serviceStats.totalServices,
          averageServicesPerCategory: Math.round(serviceStats.totalServices / categoryStats.activeCategories),
          uncategorizedServices: serviceStats.categoryDistribution.uncategorized || 0
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('統計情報取得エラー:', error);
      throw error;
    }
  }

  /**
   * カテゴリの並び順を更新
   * @param {Array} categoryOrders - カテゴリ順序配列
   * @returns {Promise<Object>} 更新結果
   */
  async updateCategoryOrder(categoryOrders) {
    try {
      const results = {
        updated: [],
        errors: []
      };

      for (const { categoryId, displayOrder } of categoryOrders) {
        try {
          await this.categoryModel.updateCategory(categoryId, { displayOrder });
          results.updated.push(categoryId);
        } catch (error) {
          results.errors.push({
            categoryId,
            error: error.message
          });
        }
      }

      return {
        success: results.errors.length === 0,
        message: `${results.updated.length}個のカテゴリの順序を更新しました`,
        details: results
      };
    } catch (error) {
      console.error('カテゴリ順序更新エラー:', error);
      throw error;
    }
  }

  /**
   * 未分類サービスを取得
   * @returns {Promise<Object[]>} 未分類サービス配列
   */
  async getUncategorizedServices() {
    try {
      const allServices = await this.serviceModel.getAllServices({ activeOnly: true });
      const uncategorizedServices = allServices.filter(service => !service.categoryId);
      
      // 自動分類の推奨を追加
      for (const service of uncategorizedServices) {
        const suggestedCategoryId = await this.classifyService(service.serviceName);
        if (suggestedCategoryId) {
          const category = await this.categoryModel.getCategory(suggestedCategoryId);
          service.suggestedCategory = {
            categoryId: suggestedCategoryId,
            categoryName: category.name,
            categoryNameJa: category.nameJa
          };
        }
      }

      return uncategorizedServices;
    } catch (error) {
      console.error('未分類サービス取得エラー:', error);
      throw error;
    }
  }

  /**
   * 階層構造にサービス数を追加
   * @param {Array} categories - カテゴリ配列
   * @private
   */
  async enrichWithServiceCounts(categories) {
    for (const category of categories) {
      const services = await this.serviceModel.getServicesByCategory(category.categoryId);
      category.actualServiceCount = services.length;
      
      if (category.children && category.children.length > 0) {
        await this.enrichWithServiceCounts(category.children);
      }
    }
  }

  /**
   * カテゴリの整合性をチェック
   * @returns {Promise<Object>} チェック結果
   */
  async validateCategoryIntegrity() {
    try {
      const issues = {
        orphanedServices: [],
        invalidParentReferences: [],
        serviceCountMismatches: []
      };

      // 全サービスとカテゴリを取得
      const allServices = await this.serviceModel.getAllServices({ activeOnly: false });
      const allCategories = await this.categoryModel.getAllCategories({ activeOnly: false });
      const categoryIds = new Set(allCategories.map(c => c.categoryId));

      // 孤立したサービスをチェック
      for (const service of allServices) {
        if (service.categoryId && !categoryIds.has(service.categoryId)) {
          issues.orphanedServices.push({
            serviceId: service.serviceId,
            serviceName: service.serviceName,
            invalidCategoryId: service.categoryId
          });
        }
      }

      // 無効な親参照をチェック
      for (const category of allCategories) {
        if (category.parentCategoryId && !categoryIds.has(category.parentCategoryId)) {
          issues.invalidParentReferences.push({
            categoryId: category.categoryId,
            categoryName: category.name,
            invalidParentId: category.parentCategoryId
          });
        }
      }

      // サービス数の不整合をチェック
      for (const category of allCategories) {
        const actualServices = await this.serviceModel.getServicesByCategory(category.categoryId);
        const actualCount = actualServices.length;
        const recordedCount = category.serviceCount || 0;
        
        if (actualCount !== recordedCount) {
          issues.serviceCountMismatches.push({
            categoryId: category.categoryId,
            categoryName: category.name,
            recordedCount,
            actualCount,
            difference: actualCount - recordedCount
          });
        }
      }

      return {
        isValid: Object.values(issues).every(arr => arr.length === 0),
        issues,
        summary: {
          orphanedServices: issues.orphanedServices.length,
          invalidParentReferences: issues.invalidParentReferences.length,
          serviceCountMismatches: issues.serviceCountMismatches.length
        }
      };
    } catch (error) {
      console.error('整合性チェックエラー:', error);
      throw error;
    }
  }
}

module.exports = AWSServiceCategoryService;