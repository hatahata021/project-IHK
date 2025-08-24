import { Router } from 'express';
import { translationController } from '../controllers/translationController';
import { authMiddleware } from '../middleware/auth';
import { validationMiddleware } from '../middleware/validation';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

/**
 * 翻訳API ルート定義
 * 
 * 全てのエンドポイントに認証が必要
 * レート制限を適用してサービス保護
 */

/**
 * 単一テキスト翻訳
 * POST /api/translate
 * 
 * Body:
 * {
 *   "text": "翻訳したいテキスト",
 *   "targetLanguage": "en",
 *   "sourceLanguage": "ja" (optional)
 * }
 */
router.post(
  '/',
  authMiddleware, // 認証必須
  rateLimitMiddleware({ windowMs: 60000, max: 100 }), // 1分間に100回まで
  validationMiddleware.validateTranslationRequest,
  translationController.translateText.bind(translationController)
);

/**
 * バッチ翻訳（複数テキストの一括翻訳）
 * POST /api/translate/batch
 * 
 * Body:
 * {
 *   "texts": ["テキスト1", "テキスト2", ...],
 *   "targetLanguage": "en",
 *   "sourceLanguage": "ja" (optional),
 *   "maxConcurrency": 5 (optional),
 *   "preserveOrder": true (optional)
 * }
 */
router.post(
  '/batch',
  authMiddleware, // 認証必須
  rateLimitMiddleware({ windowMs: 300000, max: 10 }), // 5分間に10回まで（重い処理のため制限強化）
  validationMiddleware.validateBatchTranslationRequest,
  translationController.translateBatch.bind(translationController)
);

/**
 * 言語検出
 * POST /api/translate/detect
 * 
 * Body:
 * {
 *   "text": "言語を検出したいテキスト"
 * }
 */
router.post(
  '/detect',
  authMiddleware, // 認証必須
  rateLimitMiddleware({ windowMs: 60000, max: 50 }), // 1分間に50回まで
  validationMiddleware.validateLanguageDetectionRequest,
  translationController.detectLanguage.bind(translationController)
);

/**
 * サポート言語一覧取得
 * GET /api/translate/languages
 * 
 * レスポンス:
 * {
 *   "success": true,
 *   "data": {
 *     "languages": [
 *       { "code": "ja", "name": "日本語" },
 *       { "code": "en", "name": "English" }
 *     ]
 *   }
 * }
 */
router.get(
  '/languages',
  authMiddleware, // 認証必須
  rateLimitMiddleware({ windowMs: 60000, max: 20 }), // 1分間に20回まで
  translationController.getSupportedLanguages.bind(translationController)
);

/**
 * 翻訳サービスヘルスチェック
 * GET /api/translate/health
 * 
 * 認証不要（監視用）
 */
router.get(
  '/health',
  rateLimitMiddleware({ windowMs: 60000, max: 10 }), // 1分間に10回まで
  translationController.healthCheck.bind(translationController)
);

export default router;