/**
 * AWSサービスタグ管理ルート
 * AWSサービスタグのCRUD操作とタグベース検索機能のエンドポイント
 */

const express = require('express');
const AWSServiceTagController = require('../controllers/awsServiceTagController');

const router = express.Router();
const tagController = new AWSServiceTagController();

/**
 * デフォルトタグを初期化
 * POST /api/aws-tags/initialize
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "20個のタグを作成しました",
 *   "data": {
 *     "created": [...],
 *     "skipped": [...],
 *     "errors": []
 *   }
 * }
 */
router.post('/initialize', async (req, res) => {
  await tagController.initializeDefaultTags(req, res);
});

/**
 * 全タグを取得
 * GET /api/aws-tags?category=technical&type=technology&sortBy=popularity
 * 
 * クエリパラメータ:
 * - category (optional): タグカテゴリ ('technical' | 'business' | 'general' | 'region')
 * - type (optional): タグタイプ ('feature' | 'technology' | 'use-case' | 'industry')
 * - isOfficial (optional): 公式タグのみ
 * - sortBy (optional): ソート方法 ('name' | 'popularity' | 'usage')
 * - activeOnly (optional): アクティブなタグのみ (default: true)
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "tags": [
 *       {
 *         "tagId": "tag_12345678",
 *         "name": "serverless",
 *         "nameJa": "サーバーレス",
 *         "category": "technical",
 *         "type": "technology",
 *         "color": "#FF9900",
 *         "usageCount": 25,
 *         "isOfficial": true
 *       }
 *     ],
 *     "totalCount": 50,
 *     "filters": {...}
 *   }
 * }
 */
router.get('/', async (req, res) => {
  await tagController.getAllTags(req, res);
});

/**
 * タグを検索
 * GET /api/aws-tags/search?q=serverless&language=ja
 * 
 * クエリパラメータ:
 * - q (required): 検索語
 * - language (optional): 言語 ('en' | 'ja')
 * - activeOnly (optional): アクティブなタグのみ
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "searchTerm": "serverless",
 *     "language": "ja",
 *     "resultCount": 3,
 *     "tags": [...]
 *   }
 * }
 */
router.get('/search', async (req, res) => {
  await tagController.searchTags(req, res);
});

/**
 * 人気タグを取得
 * GET /api/aws-tags/popular?limit=20&category=technical
 * 
 * クエリパラメータ:
 * - limit (optional): 取得件数 (default: 20)
 * - category (optional): カテゴリフィルタ
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "tags": [...],
 *     "totalCount": 20,
 *     "limit": 20,
 *     "category": "technical"
 *   }
 * }
 */
router.get('/popular', async (req, res) => {
  await tagController.getPopularTags(req, res);
});

/**
 * タグクラウドを取得
 * GET /api/aws-tags/cloud?limit=50&minUsage=2
 * 
 * クエリパラメータ:
 * - limit (optional): 取得件数 (default: 50)
 * - minUsage (optional): 最小使用回数 (default: 1)
 * - category (optional): カテゴリフィルタ
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "success": true,
 *     "tagCloud": [
 *       {
 *         "tagId": "tag_12345678",
 *         "name": "serverless",
 *         "nameJa": "サーバーレス",
 *         "usageCount": 25,
 *         "sizeLevel": 5,
 *         "color": "#FF9900"
 *       }
 *     ],
 *     "totalTags": 45,
 *     "options": {...}
 *   }
 * }
 */
router.get('/cloud', async (req, res) => {
  await tagController.getTagCloud(req, res);
});

/**
 * タグ統計情報を取得
 * GET /api/aws-tags/statistics
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "tags": {
 *       "totalTags": 100,
 *       "activeTags": 95,
 *       "officialTags": 20,
 *       "categoryDistribution": {...}
 *     },
 *     "relations": {
 *       "totalRelations": 500,
 *       "averageTagsPerService": 3.2
 *     },
 *     "summary": {...}
 *   }
 * }
 */
router.get('/statistics', async (req, res) => {
  await tagController.getTagStatistics(req, res);
});

/**
 * タグ整合性チェック
 * GET /api/aws-tags/validate
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "isValid": false,
 *     "issues": {
 *       "orphanedServiceRelations": [...],
 *       "orphanedTagRelations": [...],
 *       "usageCountMismatches": [...]
 *     },
 *     "summary": {...}
 *   }
 * }
 */
router.get('/validate', async (req, res) => {
  await tagController.validateTagIntegrity(req, res);
});

/**
 * タグを作成
 * POST /api/aws-tags
 * 
 * リクエストボディ:
 * {
 *   "name": "edge-computing",
 *   "nameJa": "エッジコンピューティング",
 *   "description": "Edge computing services",
 *   "descriptionJa": "エッジコンピューティングサービス",
 *   "category": "technical",
 *   "type": "technology",
 *   "color": "#4CAF50",
 *   "aliases": ["edge", "edge-compute"]
 * }
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "タグを作成しました",
 *   "data": {
 *     "tagId": "tag_12345678",
 *     "name": "edge-computing",
 *     "nameJa": "エッジコンピューティング",
 *     "category": "technical",
 *     "usageCount": 0,
 *     "createdAt": "2024-01-15T10:30:00.000Z"
 *   }
 * }
 */
router.post('/', async (req, res) => {
  await tagController.createTag(req, res);
});

/**
 * サービスにタグを割り当て
 * POST /api/aws-tags/assign
 * 
 * リクエストボディ:
 * {
 *   "serviceId": "svc_12345678",
 *   "tagIds": ["tag_12345678", "tag_87654321"],
 *   "assignmentType": "manual"
 * }
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "2個のタグを割り当て、1個のタグを削除しました",
 *   "data": {
 *     "serviceId": "svc_12345678",
 *     "results": {
 *       "added": [...],
 *       "removed": [...],
 *       "errors": []
 *     }
 *   }
 * }
 */
router.post('/assign', async (req, res) => {
  await tagController.assignTagsToService(req, res);
});

/**
 * タグベースでサービスを検索
 * POST /api/aws-tags/search
 * 
 * リクエストボディ:
 * {
 *   "tagIds": ["tag_12345678", "tag_87654321"],
 *   "matchType": "any",
 *   "minMatches": 1
 * }
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "success": true,
 *     "searchTags": ["tag_12345678", "tag_87654321"],
 *     "totalResults": 15,
 *     "services": [
 *       {
 *         "serviceId": "svc_12345678",
 *         "serviceName": "Lambda",
 *         "matchedTags": 2,
 *         "totalTags": 2,
 *         "matchRatio": 1.0
 *       }
 *     ]
 *   }
 * }
 */
router.post('/search', async (req, res) => {
  await tagController.searchServicesByTags(req, res);
});

/**
 * サービスの自動タグ付け
 * POST /api/aws-tags/auto-tag/:serviceId
 * 
 * パスパラメータ:
 * - serviceId: サービスID
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "3個のタグを自動割り当てしました",
 *   "data": {
 *     "assignedTags": [...],
 *     "failedTags": [],
 *     "suggestedTags": [
 *       {
 *         "tagId": "tag_12345678",
 *         "tagName": "serverless",
 *         "confidence": 0.9,
 *         "reason": "auto-generated"
 *       }
 *     ]
 *   }
 * }
 */
router.post('/auto-tag/:serviceId', async (req, res) => {
  await tagController.autoTagService(req, res);
});

/**
 * サービスのタグ一覧を取得
 * GET /api/aws-tags/service/:serviceId?assignmentType=manual
 * 
 * パスパラメータ:
 * - serviceId: サービスID
 * 
 * クエリパラメータ:
 * - assignmentType (optional): 割り当てタイプ ('manual' | 'auto' | 'suggested')
 * - activeOnly (optional): アクティブなタグのみ
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "service": {...},
 *     "tags": [
 *       {
 *         "tagId": "tag_12345678",
 *         "name": "serverless",
 *         "nameJa": "サーバーレス",
 *         "relation": {
 *           "assignmentType": "manual",
 *           "confidence": 1.0,
 *           "assignedBy": "user123"
 *         }
 *       }
 *     ],
 *     "tagCount": 5,
 *     "tagsByCategory": {...},
 *     "tagsByType": {...}
 *   }
 * }
 */
router.get('/service/:serviceId', async (req, res) => {
  await tagController.getServiceWithTags(req, res);
});

/**
 * 関連タグを取得
 * GET /api/aws-tags/:tagId/related?limit=10
 * 
 * パスパラメータ:
 * - tagId: タグID
 * 
 * クエリパラメータ:
 * - limit (optional): 取得件数 (default: 10)
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "tagId": "tag_12345678",
 *     "relatedTags": [
 *       {
 *         "tagId": "tag_87654321",
 *         "name": "api-gateway",
 *         "nameJa": "APIゲートウェイ",
 *         "relationCount": 15,
 *         "relationStrength": 0.75
 *       }
 *     ],
 *     "totalCount": 8
 *   }
 * }
 */
router.get('/:tagId/related', async (req, res) => {
  await tagController.getRelatedTags(req, res);
});

/**
 * タグを更新
 * PUT /api/aws-tags/:tagId
 * 
 * パスパラメータ:
 * - tagId: タグID
 * 
 * リクエストボディ:
 * {
 *   "nameJa": "更新されたタグ名",
 *   "descriptionJa": "更新された説明",
 *   "color": "#FF0000",
 *   "aliases": ["new-alias"]
 * }
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "タグを更新しました",
 *   "data": {
 *     "tagId": "tag_12345678",
 *     "name": "serverless",
 *     "nameJa": "更新されたタグ名",
 *     "updatedAt": "2024-01-15T10:30:00.000Z"
 *   }
 * }
 */
router.put('/:tagId', async (req, res) => {
  await tagController.updateTag(req, res);
});

/**
 * タグを削除
 * DELETE /api/aws-tags/:tagId
 * 
 * パスパラメータ:
 * - tagId: タグID
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "タグを削除しました"
 * }
 */
router.delete('/:tagId', async (req, res) => {
  await tagController.deleteTag(req, res);
});

// エラーハンドリングミドルウェア
router.use((error, req, res, next) => {
  console.error('AWSサービスタグルートエラー:', error);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'サーバー内部エラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }
  });
});

module.exports = router;