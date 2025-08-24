import { Request, Response, NextFunction } from 'express';
import { SupportedLanguage } from '../types/translation';

/**
 * バリデーションエラーレスポンス
 */
interface ValidationErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  metadata: {
    timestamp: Date;
    version: string;
  };
}

/**
 * バリデーションミドルウェア
 */
export class ValidationMiddleware {
  
  /**
   * サポートされている言語コードのリスト
   */
  private static readonly SUPPORTED_LANGUAGES: SupportedLanguage[] = [
    'ja', 'en', 'zh', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar', 'hi'
  ];

  /**
   * 翻訳リクエストのバリデーション
   */
  static validateTranslationRequest(req: Request, res: Response, next: NextFunction): void {
    const errors: Record<string, string[]> = {};
    const { text, targetLanguage, sourceLanguage } = req.body;

    // テキストの検証
    if (!text) {
      errors.text = ['翻訳対象のテキストが必要です'];
    } else if (typeof text !== 'string') {
      errors.text = ['テキストは文字列である必要があります'];
    } else if (text.trim().length === 0) {
      errors.text = ['テキストが空です'];
    } else if (text.length > 5000) {
      errors.text = ['テキストは5000文字以下である必要があります'];
    }

    // 翻訳先言語の検証
    if (!targetLanguage) {
      errors.targetLanguage = ['翻訳先言語が必要です'];
    } else if (typeof targetLanguage !== 'string') {
      errors.targetLanguage = ['翻訳先言語は文字列である必要があります'];
    } else if (!ValidationMiddleware.SUPPORTED_LANGUAGES.includes(targetLanguage as SupportedLanguage)) {
      errors.targetLanguage = [`サポートされていない言語です: ${targetLanguage}`];
    }

    // 翻訳元言語の検証（オプション）
    if (sourceLanguage !== undefined) {
      if (typeof sourceLanguage !== 'string') {
        errors.sourceLanguage = ['翻訳元言語は文字列である必要があります'];
      } else if (!ValidationMiddleware.SUPPORTED_LANGUAGES.includes(sourceLanguage as SupportedLanguage)) {
        errors.sourceLanguage = [`サポートされていない言語です: ${sourceLanguage}`];
      }
    }

    if (Object.keys(errors).length > 0) {
      const response: ValidationErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値に問題があります',
          details: errors
        },
        metadata: {
          timestamp: new Date(),
          version: '1.0.0'
        }
      };
      res.status(400).json(response);
      return;
    }

    next();
  }

  /**
   * バッチ翻訳リクエストのバリデーション
   */
  static validateBatchTranslationRequest(req: Request, res: Response, next: NextFunction): void {
    const errors: Record<string, string[]> = {};
    const { texts, targetLanguage, sourceLanguage, maxConcurrency, preserveOrder } = req.body;

    // テキスト配列の検証
    if (!texts) {
      errors.texts = ['翻訳対象のテキスト配列が必要です'];
    } else if (!Array.isArray(texts)) {
      errors.texts = ['textsは配列である必要があります'];
    } else if (texts.length === 0) {
      errors.texts = ['テキスト配列が空です'];
    } else if (texts.length > 100) {
      errors.texts = ['バッチ翻訳は最大100件までです'];
    } else {
      // 各テキストの検証
      const textErrors: string[] = [];
      texts.forEach((text, index) => {
        if (typeof text !== 'string') {
          textErrors.push(`インデックス${index}: テキストは文字列である必要があります`);
        } else if (text.trim().length === 0) {
          textErrors.push(`インデックス${index}: テキストが空です`);
        } else if (text.length > 5000) {
          textErrors.push(`インデックス${index}: テキストは5000文字以下である必要があります`);
        }
      });
      if (textErrors.length > 0) {
        errors.texts = textErrors;
      }
    }

    // 翻訳先言語の検証
    if (!targetLanguage) {
      errors.targetLanguage = ['翻訳先言語が必要です'];
    } else if (typeof targetLanguage !== 'string') {
      errors.targetLanguage = ['翻訳先言語は文字列である必要があります'];
    } else if (!ValidationMiddleware.SUPPORTED_LANGUAGES.includes(targetLanguage as SupportedLanguage)) {
      errors.targetLanguage = [`サポートされていない言語です: ${targetLanguage}`];
    }

    // 翻訳元言語の検証（オプション）
    if (sourceLanguage !== undefined) {
      if (typeof sourceLanguage !== 'string') {
        errors.sourceLanguage = ['翻訳元言語は文字列である必要があります'];
      } else if (!ValidationMiddleware.SUPPORTED_LANGUAGES.includes(sourceLanguage as SupportedLanguage)) {
        errors.sourceLanguage = [`サポートされていない言語です: ${sourceLanguage}`];
      }
    }

    // 最大同時実行数の検証（オプション）
    if (maxConcurrency !== undefined) {
      if (typeof maxConcurrency !== 'number') {
        errors.maxConcurrency = ['最大同時実行数は数値である必要があります'];
      } else if (maxConcurrency < 1 || maxConcurrency > 10) {
        errors.maxConcurrency = ['最大同時実行数は1〜10の範囲で指定してください'];
      }
    }

    // 順序保持フラグの検証（オプション）
    if (preserveOrder !== undefined && typeof preserveOrder !== 'boolean') {
      errors.preserveOrder = ['順序保持フラグはboolean値である必要があります'];
    }

    if (Object.keys(errors).length > 0) {
      const response: ValidationErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値に問題があります',
          details: errors
        },
        metadata: {
          timestamp: new Date(),
          version: '1.0.0'
        }
      };
      res.status(400).json(response);
      return;
    }

    next();
  }

  /**
   * 言語検出リクエストのバリデーション
   */
  static validateLanguageDetectionRequest(req: Request, res: Response, next: NextFunction): void {
    const errors: Record<string, string[]> = {};
    const { text } = req.body;

    // テキストの検証
    if (!text) {
      errors.text = ['言語検出対象のテキストが必要です'];
    } else if (typeof text !== 'string') {
      errors.text = ['テキストは文字列である必要があります'];
    } else if (text.trim().length === 0) {
      errors.text = ['テキストが空です'];
    } else if (text.length > 1000) {
      errors.text = ['言語検出用テキストは1000文字以下である必要があります'];
    }

    if (Object.keys(errors).length > 0) {
      const response: ValidationErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値に問題があります',
          details: errors
        },
        metadata: {
          timestamp: new Date(),
          version: '1.0.0'
        }
      };
      res.status(400).json(response);
      return;
    }

    next();
  }

  /**
   * 共通のリクエストボディサイズ制限
   */
  static validateRequestSize(req: Request, res: Response, next: NextFunction): void {
    const contentLength = req.get('content-length');
    
    if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB制限
      const response: ValidationErrorResponse = {
        success: false,
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: 'リクエストサイズが大きすぎます（最大1MB）'
        },
        metadata: {
          timestamp: new Date(),
          version: '1.0.0'
        }
      };
      res.status(413).json(response);
      return;
    }

    next();
  }

  /**
   * Content-Typeの検証
   */
  static validateContentType(req: Request, res: Response, next: NextFunction): void {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const contentType = req.get('content-type');
      
      if (!contentType || !contentType.includes('application/json')) {
        const response: ValidationErrorResponse = {
          success: false,
          error: {
            code: 'INVALID_CONTENT_TYPE',
            message: 'Content-Typeはapplication/jsonである必要があります'
          },
          metadata: {
            timestamp: new Date(),
            version: '1.0.0'
          }
        };
        res.status(415).json(response);
        return;
      }
    }

    next();
  }
}

// 名前付きエクスポート
export const validationMiddleware = ValidationMiddleware;