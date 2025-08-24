import { Router } from 'express';
import { translationCacheController } from '../controllers/translationCacheController';

const router = Router();

/**
 * 翻訳キャッシュ管理用のルート
 */

// キャッシュ統計情報を取得
router.get('/statistics', translationCacheController.getStatistics.bind(translationCacheController));

// 言語ペア別のキャッシュエントリを取得
router.get('/entries/:sourceLanguage/:targetLanguage', translationCacheController.getByLanguagePair.bind(translationCacheController));

// 特定のキャッシュエントリを削除
router.delete('/entries', translationCacheController.deleteEntry.bind(translationCacheController));

// 期限切れキャッシュエントリをクリーンアップ
router.post('/cleanup', translationCacheController.cleanupExpired.bind(translationCacheController));

// 全キャッシュエントリを削除（管理者用）
router.delete('/all', translationCacheController.clearAll.bind(translationCacheController));

// キャッシュ設定を取得
router.get('/config', translationCacheController.getConfig.bind(translationCacheController));

// キャッシュヘルスチェック
router.get('/health', translationCacheController.healthCheck.bind(translationCacheController));

export default router;