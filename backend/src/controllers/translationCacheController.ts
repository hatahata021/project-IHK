import { Request, Response } from 'express';
import { translationCacheService } from '../services/translationCacheService';
import { getLocalizedErrorMessage } from '../utils/translationUtils';

/**
 * 翻訳キャッシュ管理用のコントローラー
 */
export class TranslationCacheController {
  /**
   * キャッシュ統計情報を取得
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const statistics = await translationCacheService.getStatistics();
      
      res.json({
        success: true,
        data: statistics,
        metadata: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    } catch (error) {
      console.error('キャッシュ統計取得エラー:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CACHE_STATISTICS_ERROR',
          message: 'キャッシュ統計情報の取得に失敗しました',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }

  /**
   * 言語ペア別のキャッシュエントリを取得
   */
  async getByLanguagePair(req: Request, res: Response): Promise<void> {
    try {
      const { sourceLanguage, targetLanguage } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      if (!sourceLanguage || !targetLanguage) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: '言語パラメータが不足しています',
            details: 'sourceLanguage と targetLanguage が必要です'
          },
          metadata: {
            requestId: req.headers['x-request-id'] || 'unknown',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        });
        return;
      }

      const entries = await translationCacheService.getByLanguagePair(
        sourceLanguage,
        targetLanguage,
        limit
      );

      res.json({
        success: true,
        data: {
          entries,
          count: entries.length,
          sourceLanguage,
          targetLanguage,
          limit
        },
        metadata: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    } catch (error) {
      console.error('言語ペア別キャッシュ取得エラー:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CACHE_RETRIEVAL_ERROR',
          message: '言語ペア別キャッシュの取得に失敗しました',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }

  /**
   * 特定のキャッシュエントリを削除
   */
  async deleteEntry(req: Request, res: Response): Promise<void> {
    try {
      const { originalText, sourceLanguage, targetLanguage } = req.body;

      if (!originalText || !sourceLanguage || !targetLanguage) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: '必要なパラメータが不足しています',
            details: 'originalText, sourceLanguage, targetLanguage が必要です'
          },
          metadata: {
            requestId: req.headers['x-request-id'] || 'unknown',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        });
        return;
      }

      const result = await translationCacheService.delete(
        originalText,
        sourceLanguage,
        targetLanguage
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            message: 'キャッシュエントリを削除しました',
            originalText,
            sourceLanguage,
            targetLanguage
          },
          metadata: {
            requestId: req.headers['x-request-id'] || 'unknown',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'CACHE_DELETE_ERROR',
            message: result.error || 'キャッシュエントリの削除に失敗しました'
          },
          metadata: {
            requestId: req.headers['x-request-id'] || 'unknown',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        });
      }
    } catch (error) {
      console.error('キャッシュ削除エラー:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CACHE_DELETE_ERROR',
          message: 'キャッシュエントリの削除に失敗しました',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }

  /**
   * 期限切れキャッシュエントリをクリーンアップ
   */
  async cleanupExpired(req: Request, res: Response): Promise<void> {
    try {
      const deletedCount = await translationCacheService.cleanupExpiredEntries();

      res.json({
        success: true,
        data: {
          message: '期限切れキャッシュエントリをクリーンアップしました',
          deletedCount
        },
        metadata: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    } catch (error) {
      console.error('キャッシュクリーンアップエラー:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CACHE_CLEANUP_ERROR',
          message: 'キャッシュクリーンアップに失敗しました',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }

  /**
   * 全キャッシュエントリを削除（管理者用）
   */
  async clearAll(req: Request, res: Response): Promise<void> {
    try {
      // 管理者権限チェック（実装は認証システムに依存）
      const isAdmin = req.headers['x-admin-token'] === process.env.ADMIN_TOKEN;
      
      if (!isAdmin) {
        res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: '管理者権限が必要です'
          },
          metadata: {
            requestId: req.headers['x-request-id'] || 'unknown',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        });
        return;
      }

      const result = await translationCacheService.clearAll();

      if (result.success) {
        res.json({
          success: true,
          data: {
            message: '全キャッシュエントリを削除しました'
          },
          metadata: {
            requestId: req.headers['x-request-id'] || 'unknown',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'CACHE_CLEAR_ERROR',
            message: result.error || '全キャッシュクリアに失敗しました'
          },
          metadata: {
            requestId: req.headers['x-request-id'] || 'unknown',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        });
      }
    } catch (error) {
      console.error('全キャッシュクリアエラー:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CACHE_CLEAR_ERROR',
          message: '全キャッシュクリアに失敗しました',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }

  /**
   * キャッシュ設定を取得
   */
  async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = translationCacheService.getConfig();

      res.json({
        success: true,
        data: config,
        metadata: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    } catch (error) {
      console.error('キャッシュ設定取得エラー:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIG_RETRIEVAL_ERROR',
          message: 'キャッシュ設定の取得に失敗しました',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }

  /**
   * キャッシュヘルスチェック
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = await translationCacheService.healthCheck();

      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'disabled' ? 200 : 503;

      res.status(statusCode).json({
        success: health.status === 'healthy' || health.status === 'disabled',
        data: health,
        metadata: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    } catch (error) {
      console.error('キャッシュヘルスチェックエラー:', error);
      
      res.status(503).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: 'キャッシュヘルスチェックに失敗しました',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  }
}

// シングルトンインスタンスをエクスポート
export const translationCacheController = new TranslationCacheController();