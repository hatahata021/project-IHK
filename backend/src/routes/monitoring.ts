import { Router } from 'express';
import { monitoringController } from '../controllers/monitoringController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

/**
 * 監視API ルート定義
 * 
 * 管理者権限が必要（ヘルスチェック以外）
 * レート制限を適用してサービス保護
 */

/**
 * 現在のシステムメトリクス取得
 * GET /api/monitoring/metrics
 * 
 * 管理者権限必須
 */
router.get(
  '/metrics',
  authMiddleware,
  adminMiddleware,
  rateLimitMiddleware({ windowMs: 60000, max: 30 }), // 1分間に30回まで
  monitoringController.getMetrics.bind(monitoringController)
);

/**
 * 監視設定取得
 * GET /api/monitoring/config
 * 
 * 管理者権限必須
 */
router.get(
  '/config',
  authMiddleware,
  adminMiddleware,
  rateLimitMiddleware({ windowMs: 60000, max: 20 }), // 1分間に20回まで
  monitoringController.getConfig.bind(monitoringController)
);

/**
 * 監視設定更新
 * PUT /api/monitoring/config
 * 
 * Body:
 * {
 *   "monitoring": {
 *     "enableCloudWatch": true,
 *     "metricsInterval": 60
 *   },
 *   "alerts": {
 *     "enabled": true,
 *     "thresholds": {
 *       "cpuUsage": 80,
 *       "memoryUsage": 85
 *     }
 *   }
 * }
 * 
 * 管理者権限必須
 */
router.put(
  '/config',
  authMiddleware,
  adminMiddleware,
  rateLimitMiddleware({ windowMs: 300000, max: 5 }), // 5分間に5回まで
  monitoringController.updateConfig.bind(monitoringController)
);

/**
 * 監視システムヘルスチェック
 * GET /api/monitoring/health
 * 
 * 認証不要（監視用）
 */
router.get(
  '/health',
  rateLimitMiddleware({ windowMs: 60000, max: 60 }), // 1分間に60回まで
  monitoringController.healthCheck.bind(monitoringController)
);

/**
 * 監視統計情報取得
 * GET /api/monitoring/stats
 * 
 * 管理者権限必須
 */
router.get(
  '/stats',
  authMiddleware,
  adminMiddleware,
  rateLimitMiddleware({ windowMs: 60000, max: 20 }), // 1分間に20回まで
  monitoringController.getStats.bind(monitoringController)
);

/**
 * テストアラート送信（開発・テスト用）
 * POST /api/monitoring/test-alert
 * 
 * Body:
 * {
 *   "type": "cpu" | "memory" | "disk" | "error",
 *   "severity": "warning" | "critical",
 *   "message": "Test alert message"
 * }
 * 
 * 管理者権限必須、本番環境では無効
 */
router.post(
  '/test-alert',
  authMiddleware,
  adminMiddleware,
  rateLimitMiddleware({ windowMs: 300000, max: 3 }), // 5分間に3回まで
  monitoringController.testAlert.bind(monitoringController)
);

/**
 * カスタムメトリクスリセット
 * POST /api/monitoring/reset-metrics
 * 
 * 管理者権限必須
 */
router.post(
  '/reset-metrics',
  authMiddleware,
  adminMiddleware,
  rateLimitMiddleware({ windowMs: 300000, max: 5 }), // 5分間に5回まで
  monitoringController.resetMetrics.bind(monitoringController)
);

export default router;