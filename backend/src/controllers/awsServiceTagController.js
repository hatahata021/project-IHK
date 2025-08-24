/**
 * AWSサービスタグ管理コントローラー
 * AWSサービスタグのCRUD操作とタグベース検索機能を提供
 */

const AWSServiceTagService = require('../services/awsServiceTagService');

class AWSServiceTagController {
  constructor() {
    this.tagService = new AWSServiceTagService();
  }

  /**
   * デフォルトタグを初期化
   * POST /api/aws-tags/initialize
   */
  async initializeDefaultTags(req, res) {
    try {
      const result = await this.tagService.initializeDefaultTags();
      
      res.json({
        success: true,
        message: result.message,
        data: result.details
      });
    } catch (error) {
      console.error('デフォルトタグ初期化エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INITIALIZATION_ERROR',
          message: 'デフォルトタグの初期化に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * タグを作成
   * POST /api/aws-tags
   */
  async createTag(req, res) {
    try {
      const tagData = req.body;

      // 必須フィールドの検証
      if (!tagData.name) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'タグ名が必要です'
          }
        });
      }

      const result = await this.tagService.createTag(tagData);
      
      res.status(201).json({
        success: true,
        message: 'タグを作成しました',
        data: result.tag
      });
    } catch (error) {
      console.error('タグ作成エラー:', error);
      
      const statusCode = error.message.includes('既に存在') ? 409 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 409 ? 'TAG_EXISTS' : 'CREATION_ERROR',
          message: error.message
        }
      });
    }
  }

  /**
   * 全タグを取得
   * GET /api/aws-tags
   */
  async getAllTags(req, res) {
    try {
      const { category, type, isOfficial, sortBy, activeOnly } = req.query;

      const options = {
        category,
        type,
        isOfficial: isOfficial === 'true' ? true : isOfficial === 'false' ? false : undefined,
        sortBy: sortBy || 'name',
        activeOnly: activeOnly !== 'false'
      };

      const tags = await this.tagService.tagModel.getAllTags(options);
      
      res.json({
        success: true,
        data: {
          tags,
          totalCount: tags.length,
          filters: options
        }
      });
    } catch (error) {
      console.error('全タグ取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'タグ一覧の取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * タグを更新
   * PUT /api/aws-tags/:tagId
   */
  async updateTag(req, res) {
    try {
      const { tagId } = req.params;
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

      const result = await this.tagService.tagModel.updateTag(tagId, updateData);
      
      res.json({
        success: true,
        message: 'タグを更新しました',
        data: result.tag
      });
    } catch (error) {
      console.error('タグ更新エラー:', error);
      
      const statusCode = error.message.includes('見つかりません') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'TAG_NOT_FOUND' : 'UPDATE_ERROR',
          message: error.message
        }
      });
    }
  }

  /**
   * タグを削除
   * DELETE /api/aws-tags/:tagId
   */
  async deleteTag(req, res) {
    try {
      const { tagId } = req.params;

      const success = await this.tagService.tagModel.deleteTag(tagId);
      
      if (success) {
        res.json({
          success: true,
          message: 'タグを削除しました'
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'DELETE_ERROR',
            message: 'タグの削除に失敗しました'
          }
        });
      }
    } catch (error) {
      console.error('タグ削除エラー:', error);
      
      let statusCode = 500;
      let errorCode = 'DELETE_ERROR';
      
      if (error.message.includes('見つからない')) {
        statusCode = 404;
        errorCode = 'TAG_NOT_FOUND';
      } else if (error.message.includes('使用中')) {
        statusCode = 409;
        errorCode = 'TAG_IN_USE';
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
   * サービスにタグを割り当て
   * POST /api/aws-tags/assign
   */
  async assignTagsToService(req, res) {
    try {
      const { serviceId, tagIds, assignmentType } = req.body;

      // 必須フィールドの検証
      if (!serviceId || !Array.isArray(tagIds)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'サービスIDとタグID配列が必要です'
          }
        });
      }

      const options = {
        assignmentType: assignmentType || 'manual',
        assignedBy: req.user?.id || 'anonymous'
      };

      const result = await this.tagService.assignTagsToService(serviceId, tagIds, options);
      
      res.json({
        success: result.success,
        message: `${result.results.added.length}個のタグを割り当て、${result.results.removed.length}個のタグを削除しました`,
        data: result
      });
    } catch (error) {
      console.error('タグ割り当てエラー:', error);
      
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
   * サービスの自動タグ付け
   * POST /api/aws-tags/auto-tag/:serviceId
   */
  async autoTagService(req, res) {
    try {
      const { serviceId } = req.params;

      const result = await this.tagService.autoTagService(serviceId);
      
      res.json({
        success: true,
        message: result.message,
        data: {
          assignedTags: result.assignedTags || [],
          failedTags: result.failedTags || [],
          suggestedTags: result.suggestedTags || []
        }
      });
    } catch (error) {
      console.error('自動タグ付けエラー:', error);
      
      const statusCode = error.message.includes('見つかりません') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'SERVICE_NOT_FOUND' : 'AUTO_TAG_ERROR',
          message: error.message
        }
      });
    }
  }

  /**
   * タグベースでサービスを検索
   * POST /api/aws-tags/search
   */
  async searchServicesByTags(req, res) {
    try {
      const { tagIds, matchType, minMatches } = req.body;

      // 必須フィールドの検証
      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_TAG_IDS',
            message: 'タグID配列が必要です'
          }
        });
      }

      const options = {
        matchType: matchType || 'any', // any, all
        minMatches: minMatches || 1
      };

      const result = await this.tagService.searchServicesByTags(tagIds, options);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('タグ検索エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: 'タグによるサービス検索に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * サービスのタグ一覧を取得
   * GET /api/aws-tags/service/:serviceId
   */
  async getServiceWithTags(req, res) {
    try {
      const { serviceId } = req.params;
      const { assignmentType, activeOnly } = req.query;

      const options = {
        assignmentType,
        activeOnly: activeOnly !== 'false'
      };

      const result = await this.tagService.getServiceWithTags(serviceId, options);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('サービスタグ取得エラー:', error);
      
      const statusCode = error.message.includes('見つかりません') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'SERVICE_NOT_FOUND' : 'FETCH_ERROR',
          message: error.message
        }
      });
    }
  }

  /**
   * タグを検索
   * GET /api/aws-tags/search
   */
  async searchTags(req, res) {
    try {
      const { q: searchTerm, language, activeOnly } = req.query;

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
        activeOnly: activeOnly !== 'false'
      };

      const tags = await this.tagService.tagModel.searchTags(searchTerm, options);
      
      res.json({
        success: true,
        data: {
          searchTerm,
          language: options.language,
          resultCount: tags.length,
          tags
        }
      });
    } catch (error) {
      console.error('タグ検索エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: 'タグ検索に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * 人気タグを取得
   * GET /api/aws-tags/popular
   */
  async getPopularTags(req, res) {
    try {
      const { limit, category } = req.query;

      const options = {
        category
      };

      const tags = await this.tagService.tagModel.getPopularTags(
        parseInt(limit) || 20, 
        options
      );
      
      res.json({
        success: true,
        data: {
          tags,
          totalCount: tags.length,
          limit: parseInt(limit) || 20,
          category: category || 'all'
        }
      });
    } catch (error) {
      console.error('人気タグ取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'POPULAR_TAGS_ERROR',
          message: '人気タグの取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * タグクラウドを取得
   * GET /api/aws-tags/cloud
   */
  async getTagCloud(req, res) {
    try {
      const { limit, minUsage, category } = req.query;

      const options = {
        limit: parseInt(limit) || 50,
        minUsage: parseInt(minUsage) || 1,
        category
      };

      const result = await this.tagService.getTagCloud(options);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('タグクラウド取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'TAG_CLOUD_ERROR',
          message: 'タグクラウドの取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * 関連タグを取得
   * GET /api/aws-tags/:tagId/related
   */
  async getRelatedTags(req, res) {
    try {
      const { tagId } = req.params;
      const { limit } = req.query;

      const relatedTags = await this.tagService.getRelatedTags(
        tagId, 
        parseInt(limit) || 10
      );
      
      res.json({
        success: true,
        data: {
          tagId,
          relatedTags,
          totalCount: relatedTags.length
        }
      });
    } catch (error) {
      console.error('関連タグ取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'RELATED_TAGS_ERROR',
          message: '関連タグの取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * タグ統計情報を取得
   * GET /api/aws-tags/statistics
   */
  async getTagStatistics(req, res) {
    try {
      const statistics = await this.tagService.getTagStatistics();
      
      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('タグ統計取得エラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'STATISTICS_ERROR',
          message: 'タグ統計情報の取得に失敗しました',
          details: error.message
        }
      });
    }
  }

  /**
   * タグ整合性チェック
   * GET /api/aws-tags/validate
   */
  async validateTagIntegrity(req, res) {
    try {
      const validationResult = await this.tagService.validateTagIntegrity();
      
      const statusCode = validationResult.isValid ? 200 : 422;
      
      res.status(statusCode).json({
        success: validationResult.isValid,
        data: validationResult,
        message: validationResult.isValid 
          ? 'タグの整合性に問題はありません'
          : 'タグの整合性に問題が見つかりました'
      });
    } catch (error) {
      console.error('タグ整合性チェックエラー:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'タグ整合性チェックに失敗しました',
          details: error.message
        }
      });
    }
  }
}

module.exports = AWSServiceTagController;