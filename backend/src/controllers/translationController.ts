import { Request, Response } from 'express';
import { translationService } from '../services/translationService';
import { 
  BaseTranslationRequest, 
  ExtendedTranslationRequest,
  BatchTranslationRequest,
  TranslationApiResponse,
  SupportedLanguage 
} from '../types/translation';
import { v4 as uuidv4 } from 'uuid';

/**
 * 翻訳APIコントローラー
 * 翻訳リクエスト処理、バッチ翻訳、キャッシュ管理のAPIエンドポイントを提供
 */
export class TranslationController {

  /**
   * 単一テキストの翻訳
   * POST /api/translate
   */
  async translateText(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const { text, sourceLanguage, targetLanguage, useCache = true }: ExtendedTranslationRequest = req.body;

      // 入力値検証
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        const response: TranslationApiResponse = {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '翻訳対象のテキストが必要です'
          },
          metadata: {
            requestId,
            timestamp: new Date(),
            processingTime: Date.now() - startTime,
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
        return;
      }

      if (!targetLanguage || typeof targetLanguage !== 'string') {
        const response: TranslationApiResponse = {
          success: false,
          error: {
            code: 'INVALID_TARGET_LANGUAGE',
            message: '翻訳先言語が必要です'
          },
          metadata: {
            requestId,
            timestamp: new Date(),
            processingTime: Date.now() - startTime,
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
        return;
      }

      // 翻訳実行
      const result = await translationService.translateText({
        text: text.trim(),
        sourceLanguage: sourceLanguage as SupportedLanguage,
        targetLanguage: targetLanguage as SupportedLanguage
      });

      const processingTime = Date.now() - startTime;

      const response: TranslationApiResponse = {
        success: true,
        data: {
          originalText: result.originalText,
          translatedText: result.translatedText,
          sourceLanguage: result.sourceLanguage as SupportedLanguage,
          targetLanguage: result.targetLanguage as SupportedLanguage,
          timestamp: new Date(),
          confidence: result.confidence,
          processingTime: result.processingTime,
          fromCache: result.fromCache
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTime,
          version: '1.0.0'
        }
      };

      console.log(`翻訳API完了 [${requestId}]: ${processingTime}ms, キャッシュ: ${result.fromCache}`);
      res.status(200).json(response);

    } catch (error) {
      console.error(`翻訳APIエラー [${requestId}]:`, error);
      
      const processingTime = Date.now() - startTime;
      const response: TranslationApiResponse = {
        success: false,
        error: {
          code: error instanceof Error && 'code' in error ? (error as any).code : 'TRANSLATION_ERROR',
          message: error instanceof Error ? error.message : '翻訳中にエラーが発生しました',
          details: error instanceof Error && 'originalError' in error ? { originalError: (error as any).originalError?.message } : undefined
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTime,
          version: '1.0.0'
        }
      };

      const statusCode = this.getErrorStatusCode(error);
      res.status(statusCode).json(response);
    }
  }

  /**
   * バッチ翻訳（複数テキストの一括翻訳）
   * POST /api/translate/batch
   */
  async translateBatch(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const { 
        texts, 
        sourceLanguage, 
        targetLanguage, 
        preserveOrder = true,
        maxConcurrency = 5 
      }: BatchTranslationRequest = req.body;

      // 入力値検証
      if (!Array.isArray(texts) || texts.length === 0) {
        const response: TranslationApiResponse = {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '翻訳対象のテキスト配列が必要です'
          },
          metadata: {
            requestId,
            timestamp: new Date(),
            processingTime: Date.now() - startTime,
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
        return;
      }

      if (texts.length > 100) {
        const response: TranslationApiResponse = {
          success: false,
          error: {
            code: 'TOO_MANY_TEXTS',
            message: 'バッチ翻訳は最大100件までです'
          },
          metadata: {
            requestId,
            timestamp: new Date(),
            processingTime: Date.now() - startTime,
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
        return;
      }

      if (!targetLanguage) {
        const response: TranslationApiResponse = {
          success: false,
          error: {
            code: 'INVALID_TARGET_LANGUAGE',
            message: '翻訳先言語が必要です'
          },
          metadata: {
            requestId,
            timestamp: new Date(),
            processingTime: Date.now() - startTime,
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
        return;
      }

      // バッチ翻訳実行
      const results = await this.executeBatchTranslation(
        texts,
        sourceLanguage as SupportedLanguage,
        targetLanguage as SupportedLanguage,
        maxConcurrency,
        preserveOrder
      );

      const processingTime = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.length - successCount;

      const response = {
        success: true,
        data: {
          results: results.map(r => r.result).filter(r => r !== null),
          totalProcessingTime: processingTime,
          successCount,
          errorCount,
          errors: results.filter(r => !r.success).map(r => r.error).filter(e => e !== null)
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTime,
          version: '1.0.0'
        }
      };

      console.log(`バッチ翻訳API完了 [${requestId}]: ${processingTime}ms, 成功: ${successCount}/${texts.length}`);
      res.status(200).json(response);

    } catch (error) {
      console.error(`バッチ翻訳APIエラー [${requestId}]:`, error);
      
      const processingTime = Date.now() - startTime;
      const response: TranslationApiResponse = {
        success: false,
        error: {
          code: 'BATCH_TRANSLATION_ERROR',
          message: error instanceof Error ? error.message : 'バッチ翻訳中にエラーが発生しました'
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTime,
          version: '1.0.0'
        }
      };

      res.status(500).json(response);
    }
  }

  /**
   * 言語検出
   * POST /api/translate/detect
   */
  async detectLanguage(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const { text } = req.body;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        const response: TranslationApiResponse = {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '言語検出対象のテキストが必要です'
          },
          metadata: {
            requestId,
            timestamp: new Date(),
            processingTime: Date.now() - startTime,
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
        return;
      }

      const result = await translationService.detectLanguage(text.trim());
      const processingTime = Date.now() - startTime;

      const response = {
        success: true,
        data: {
          languageCode: result.languageCode,
          confidence: result.score,
          text: text.trim()
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTime,
          version: '1.0.0'
        }
      };

      console.log(`言語検出API完了 [${requestId}]: ${processingTime}ms, 検出言語: ${result.languageCode}`);
      res.status(200).json(response);

    } catch (error) {
      console.error(`言語検出APIエラー [${requestId}]:`, error);
      
      const processingTime = Date.now() - startTime;
      const response: TranslationApiResponse = {
        success: false,
        error: {
          code: 'LANGUAGE_DETECTION_ERROR',
          message: error instanceof Error ? error.message : '言語検出中にエラーが発生しました'
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTime,
          version: '1.0.0'
        }
      };

      const statusCode = this.getErrorStatusCode(error);
      res.status(statusCode).json(response);
    }
  }

  /**
   * サポート言語一覧取得
   * GET /api/translate/languages
   */
  async getSupportedLanguages(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const languages = await translationService.getSupportedLanguages();
      
      const languageList = languages.map(code => ({
        code,
        name: translationService.getLanguageName(code)
      }));

      const processingTime = Date.now() - startTime;

      const response = {
        success: true,
        data: {
          languages: languageList,
          count: languageList.length
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTime,
          version: '1.0.0'
        }
      };

      console.log(`サポート言語取得API完了 [${requestId}]: ${processingTime}ms`);
      res.status(200).json(response);

    } catch (error) {
      console.error(`サポート言語取得APIエラー [${requestId}]:`, error);
      
      const processingTime = Date.now() - startTime;
      const response: TranslationApiResponse = {
        success: false,
        error: {
          code: 'LANGUAGE_LIST_ERROR',
          message: error instanceof Error ? error.message : 'サポート言語取得中にエラーが発生しました'
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTime,
          version: '1.0.0'
        }
      };

      res.status(500).json(response);
    }
  }

  /**
   * 翻訳サービスのヘルスチェック
   * GET /api/translate/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const healthResult = await translationService.healthCheck();
      const processingTime = Date.now() - startTime;

      const response = {
        success: true,
        data: {
          status: healthResult.status,
          message: healthResult.message,
          timestamp: new Date()
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTime,
          version: '1.0.0'
        }
      };

      const statusCode = healthResult.status === 'healthy' ? 200 : 503;
      console.log(`翻訳ヘルスチェックAPI完了 [${requestId}]: ${processingTime}ms, ステータス: ${healthResult.status}`);
      res.status(statusCode).json(response);

    } catch (error) {
      console.error(`翻訳ヘルスチェックAPIエラー [${requestId}]:`, error);
      
      const processingTime = Date.now() - startTime;
      const response: TranslationApiResponse = {
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: error instanceof Error ? error.message : 'ヘルスチェック中にエラーが発生しました'
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTime,
          version: '1.0.0'
        }
      };

      res.status(500).json(response);
    }
  }

  /**
   * バッチ翻訳の実行（内部メソッド）
   */
  private async executeBatchTranslation(
    texts: string[],
    sourceLanguage: SupportedLanguage | undefined,
    targetLanguage: SupportedLanguage,
    maxConcurrency: number,
    preserveOrder: boolean
  ): Promise<Array<{ success: boolean; result: any; error: any; index?: number }>> {
    const results: Array<{ success: boolean; result: any; error: any; index?: number }> = [];
    
    // 同時実行数を制限するためのセマフォ
    const semaphore = new Array(maxConcurrency).fill(null);
    let currentIndex = 0;

    const executeTranslation = async (text: string, index: number) => {
      try {
        const result = await translationService.translateText({
          text: text.trim(),
          sourceLanguage,
          targetLanguage
        });

        return {
          success: true,
          result: {
            originalText: result.originalText,
            translatedText: result.translatedText,
            sourceLanguage: result.sourceLanguage as SupportedLanguage,
            targetLanguage: result.targetLanguage as SupportedLanguage,
            timestamp: new Date(),
            confidence: result.confidence,
            processingTime: result.processingTime,
            fromCache: result.fromCache
          },
          error: null,
          index: preserveOrder ? index : undefined
        };
      } catch (error) {
        return {
          success: false,
          result: null,
          error: {
            code: error instanceof Error && 'code' in error ? (error as any).code : 'TRANSLATION_ERROR',
            message: error instanceof Error ? error.message : '翻訳中にエラーが発生しました',
            originalText: text,
            index: preserveOrder ? index : undefined
          },
          index: preserveOrder ? index : undefined
        };
      }
    };

    // 並列実行
    const promises = texts.map((text, index) => executeTranslation(text, index));
    const allResults = await Promise.all(promises);

    // 順序保持が必要な場合はソート
    if (preserveOrder) {
      allResults.sort((a, b) => (a.index || 0) - (b.index || 0));
    }

    return allResults;
  }

  /**
   * エラーに応じたHTTPステータスコードを取得
   */
  private getErrorStatusCode(error: any): number {
    if (error && typeof error === 'object' && 'code' in error) {
      switch (error.code) {
        case 'EMPTY_TEXT':
        case 'MISSING_TARGET_LANGUAGE':
        case 'TEXT_TOO_LONG':
          return 400; // Bad Request
        case 'UNSUPPORTED_LANGUAGE_PAIR':
          return 422; // Unprocessable Entity
        case 'TRANSLATION_SERVICE_ERROR':
        case 'DETECTION_SERVICE_ERROR':
          return 503; // Service Unavailable
        default:
          return 500; // Internal Server Error
      }
    }
    return 500;
  }
}

// シングルトンインスタンスをエクスポート
export const translationController = new TranslationController();