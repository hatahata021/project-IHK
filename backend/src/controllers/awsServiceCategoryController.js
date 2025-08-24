/**
 * AWSサービスカテゴリ管理コントローラー
 * AWSサービスカテゴリのCRUD操作とサービス割り当て機能を提供
 */

const AWSServiceCategoryService = require('../services/awsServiceCategoryService');

class AWSServiceCategoryController {
  constructor() {
    this.categoryService = new AWSServiceCategoryService();
  }

  /**
   * デフォルトカテゴリを初期化
   * POST /api/aws-categories/initialize
   */
  async initializeDefaultCategories(req, res) {
    try {
      const result = await this.categoryService.initializeDefaultCategories();
      
      res.json({
        success: true,
        message: result.message,
        data: result.details
      });
    } catch (error) {
      console.error('デフォルトカテゴリ初期化エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INITIALIZATION_ERROR',
          message: 'デフォルトカテゴリの初期化に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * カテゴリを作成
   * POST /api/aws-categories
   */
  async createCategory(req, res) {
    try {
      const categoryData = req.body;

      // 必須フィールドの検証
      if (!categoryData.name) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'カテゴリ名が必要です'
          }
        });
      }

      const result = await this.categoryService.createCategory(categoryData);
      
      res.status(201).json({
        success: true,
        message: 'カテゴリを作成しました',
        data: result.category
      });
    } catch (error) {
      console.error('カテゴリ作成エラー:', error);
      
      const statusCode = error.message.includes('既に存在') ? 409 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 409 ? 'CATEGORY_EXISTS' : 'CREATION_ERROR',
          message: error.message
        }
      });
    }
  }

  /**
   * カテゴリ階層構造を取得
   * GET /api/aws-categories/hierarchy
   */
  async getCategoryHierarchy(req, res) {
    try {
      const { includeServiceCount } = req.query;
      
      const options = {
        includeServiceCount: includeServiceCount === 'true'
      };

      const hierarchy = await this.categoryService.getCategoryHierarchy(options);
      
      res.json({
        success: true,
        data: hierarchy
      });
    } catch (error) {
      console.error('階層構造取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'HIERARCHY_ERROR',
          message: '階層構造の取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * カテゴリ別サービス一覧を取得
   * GET /api/aws-categories/:categoryId/services
   */
  async getCategoryWithServices(req, res) {
    try {
      const { categoryId } = req.params;
      const { sortBy, activeOnly } = req.query;

      const options = {
        sortBy: sortBy || 'name',
        activeOnly: activeOnly !== 'false'
      };

      const result = await this.categoryService.getCategoryWithServices(categoryId, options);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('カテゴリ別サービス取得エラー:', error);
      
      const statusCode = error.message.includes('見つかりません') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'CATEGORY_NOT_FOUND' : 'FETCH_ERROR',
          message: error.message
        }
      });
    }
  }

  /**
   * カテゴリを更新
   * PUT /api/aws-categories/:categoryId
   */
  async updateCategory(req, res) {
    try {
      const { categoryId } = req.params;
      const updateData = req.body;

      // 更新データの検証
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_UPDATE_DATA',
            message: '更新するデータが指定されていません'
          }
        });
      }

      const result = await this.categoryService.categoryModel.updateCategory(categoryId, updateData);
      
      res.json({
        success: true,
        message: 'カテゴリを更新しました',
        data: result.category
      });
    } catch (error) {
      console.error('カテゴリ更新エラー:', error);
      
      const statusCode = error.message.includes('見つかりません') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'CATEGORY_NOT_FOUND' : 'UPDATE_ERROR',
          message: error.message
        }
      });
    }
  }

  /**
   * カテゴリを削除
   * DELETE /api/aws-categories/:categoryId
   */
  async deleteCategory(req, res) {
    try {
      const { categoryId } = req.params;

      const success = await this.categoryService.categoryModel.deleteCategory(categoryId);
      
      if (success) {
        res.json({
          success: true,
          message: 'カテゴリを削除しました'
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'DELETE_ERROR',
            message: 'カテゴリの削除に失敗しました'
          }
        });
      }
    } catch (error) {
      console.error('カテゴリ削除エラー:', error);
      
      let statusCode = 500;
      let errorCode = 'DELETE_ERROR';
      
      if (error.message.includes('見つからない')) {
        statusCode = 404;
        errorCode = 'CATEGORY_NOT_FOUND';
      } else if (error.message.includes('子カテゴリが存在') || error.message.includes('サービスが割り当て')) {
        statusCode = 409;
        errorCode = 'CATEGORY_IN_USE';
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: error.message
        }
      });
    }
  }

  /**
   * サービスをカテゴリに割り当て
   * POST /api/aws-categories/:categoryId/assign-service
   */
  async assignServiceToCategory(req, res) {
    try {
      const { categoryId } = req.params;
      const { serviceId } = req.body;

      if (!serviceId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SERVICE_ID',
            message: 'サービスIDが必要です'
          }
        });
      }

      const result = await this.categoryService.assignServiceToCategory(serviceId, categoryId);
      
      res.json({
        success: true,
        message: result.message,
        data: {
          serviceId: result.serviceId,
          categoryId: result.categoryId,
          oldCategoryId: result.oldCategoryId
        }
      });
    } catch (error) {
      console.error('サービス割り当てエラー:', error);
      
      const statusCode = error.message.includes('見つかりません') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'RESOURCE_NOT_FOUND' : 'ASSIGNMENT_ERROR',
          message: error.message
        }
      });
    }
  }

  /**
   * カテゴリを検索
   * GET /api/aws-categories/search
   */
  async searchCategories(req, res) {
    try {
      const { q: searchTerm, language, includeServiceCount } = req.query;

      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SEARCH_TERM',
            message: '検索語が必要です'
          }
        });
      }

      const options = {
        language: language || 'en',
        includeServiceCount: includeServiceCount === 'true'
      };

      const categories = await this.categoryService.searchCategories(searchTerm, options);
      
      res.json({
        success: true,
        data: {
          searchTerm,
          language: options.language,
          resultCount: categories.length,
          categories
        }
      });
    } catch (error) {
      console.error('カテゴリ検索エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: 'カテゴリ検索に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * カテゴリ統計情報を取得
   * GET /api/aws-categories/statistics
   */
  async getCategoryStatistics(req, res) {
    try {
      const statistics = await this.categoryService.getCategoryStatistics();
      
      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('統計情報取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'STATISTICS_ERROR',
          message: '統計情報の取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * カテゴリの並び順を更新
   * PUT /api/aws-categories/order
   */
  async updateCategoryOrder(req, res) {
    try {
      const { categoryOrders } = req.body;

      if (!Array.isArray(categoryOrders) || categoryOrders.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ORDER_DATA',
            message: 'カテゴリ順序データが必要です'
          }
        });
      }

      // データ形式の検証
      const isValidFormat = categoryOrders.every(item => 
        item.categoryId && typeof item.displayOrder === 'number'
      );

      if (!isValidFormat) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ORDER_FORMAT',
            message: 'カテゴリIDと表示順序が必要です'
          }
        });
      }

      const result = await this.categoryService.updateCategoryOrder(categoryOrders);
      
      res.json({
        success: result.success,
        message: result.message,
        data: result.details
      });
    } catch (error) {
      console.error('カテゴリ順序更新エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ORDER_UPDATE_ERROR',
          message: 'カテゴリ順序の更新に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * 未分類サービスを取得
   * GET /api/aws-categories/uncategorized-services
   */
  async getUncategorizedServices(req, res) {
    try {
      const uncategorizedServices = await this.categoryService.getUncategorizedServices();
      
      res.json({
        success: true,
        data: {
          count: uncategorizedServices.length,
          services: uncategorizedServices
        }
      });
    } catch (error) {
      console.error('未分類サービス取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UNCATEGORIZED_FETCH_ERROR',
          message: '未分類サービスの取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * サービス自動分類
   * POST /api/aws-categories/classify-service
   */
  async classifyService(req, res) {
    try {
      const { serviceName } = req.body;

      if (!serviceName) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SERVICE_NAME',
            message: 'サービス名が必要です'
          }
        });
      }

      const suggestedCategoryId = await this.categoryService.classifyService(serviceName);
      
      if (suggestedCategoryId) {
        const category = await this.categoryService.categoryModel.getCategory(suggestedCategoryId);
        res.json({
          success: true,
          data: {
            serviceName,
            suggestedCategory: {
              categoryId: suggestedCategoryId,
              categoryName: category.name,
              categoryNameJa: category.nameJa,
              confidence: 'high' // 簡易実装
            }
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            serviceName,
            suggestedCategory: null,
            message: '適切なカテゴリが見つかりませんでした'
          }
        });
      }
    } catch (error) {
      console.error('サービス自動分類エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CLASSIFICATION_ERROR',
          message: 'サービス自動分類に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * カテゴリ整合性チェック
   * GET /api/aws-categories/validate
   */
  async validateCategoryIntegrity(req, res) {
    try {
      const validationResult = await this.categoryService.validateCategoryIntegrity();
      
      const statusCode = validationResult.isValid ? 200 : 422;
      
      res.status(statusCode).json({
        success: validationResult.isValid,
        data: validationResult,
        message: validationResult.isValid 
          ? 'カテゴリの整合性に問題はありません'
          : 'カテゴリの整合性に問題が見つかりました'
      });
    } catch (error) {
      console.error('整合性チェックエラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '整合性チェックに失敗しました',
          details: error.message
        }
      });
    }
  }
}

module.exports = AWSServiceCategoryController;