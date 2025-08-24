import { Router } from 'express';
import { logController } from '../controllers/logController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

/**
 * ログ管理API ルート定義
 * 
 * 管理者権限が必要（ヘルスチェック以外）
 * レート制限を適用してサービス保護
 */

/**
 * ログ統計情報取得
 * GET /api/logs/stats
 * 
 * 管理者権限必須
 */
router.get(
  '/stats',
  authMiddleware,
  adminMiddleware,
  rateLimitMiddleware({ windowMs: 60000, max: 20 }), // 1分間に20回まで
  logController.getStats.bind(logController)
);

/**
 * ログレベル変更
 * PUT /api/logs/level
 * 
 * Body:
 * {
 *   "level": "DEBUG" | "INFO" | "WARN" | "ERROR"
 * }
 * 
 * 管理者権限必須
 */
router.put(
  '/level',
  authMiddleware,
  adminMiddleware,
  rateLimitMiddleware({ windowMs: 300000, max: 5 }), // 5分間に5回まで
  logController.setLogLevel.bind(logController)
);

/**
 * ログ手動フラッシュ
 * POST /api/logs/flush
 * 
 * 管理者権限必須
 */
router.post(
  '/flush',
  authMiddleware,
  adminMiddleware,
  rateLimitMiddleware({ windowMs: 60000, max: 10 }), // 1分間に10回まで
  logController.flushLogs.bind(logController)
);

/**
 * ログシステムヘルスチェック
 * GET /api/logs/health
 * 
 * 認証不要（監視用）
 */
router.get(
  '/health',
  rateLimitMiddleware({ windowMs: 60000, max: 30 }), // 1分間に30回まで
  logController.healthCheck.bind(logController)
);

/**
 * テストログ生成（開発・テスト用）
 * POST /api/logs/test
 * 
 * Body:
 * {
 *   "level": "info" | "warn" | "error" | "debug",
 *   "message": "Test message",
 *   "count": 1
 * }
 * 
 * 管理者権限必須、本番環境では無効
 */
router.post(
  '/test',
  authMiddleware,
  adminMiddleware,
  rateLimitMiddleware({ windowMs: 300000, max: 3 }), // 5分間に3回まで
  logController.testLogs.bind(logController)
);

export default router;