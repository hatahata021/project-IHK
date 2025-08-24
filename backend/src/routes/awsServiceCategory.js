/**
 * AWSサービスカテゴリ管理ルート
 * AWSサービスカテゴリのCRUD操作とサービス割り当て機能のエンドポイント
 */

const express = require('express');
const AWSServiceCategoryController = require('../controllers/awsServiceCategoryController');

const router = express.Router();
const categoryController = new AWSServiceCategoryController();

/**
 * デフォルトカテゴリを初期化
 * POST /api/aws-categories/initialize
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "8個のカテゴリを作成しました",
 *   "data": {
 *     "created": [...],
 *     "skipped": [...],
 *     "errors": []
 *   }
 * }
 */
router.post('/initialize', async (req, res) => {
  await categoryController.initializeDefaultCategories(req, res);
});

/**
 * カテゴリ階層構造を取得
 * GET /api/aws-categories/hierarchy?includeServiceCount=true
 * 
 * クエリパラメータ:
 * - includeServiceCount (optional): サービス数を含める
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "hierarchy": [
 *       {
 *         "categoryId": "cat_12345678",
 *         "name": "Compute",
 *         "nameJa": "コンピューティング",
 *         "children": [...],
 *         "actualServiceCount": 15
 *       }
 *     ],
 *     "totalCategories": 8,
 *     "maxLevel": 2
 *   }
 * }
 */
router.get('/hierarchy', async (req, res) => {
  await categoryController.getCategoryHierarchy(req, res);
});

/**
 * カテゴリを検索
 * GET /api/aws-categories/search?q=compute&language=ja&includeServiceCount=true
 * 
 * クエリパラメータ:
 * - q (required): 検索語
 * - language (optional): 言語 ('en' | 'ja')
 * - includeServiceCount (optional): サービス数を含める
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "searchTerm": "compute",
 *     "language": "ja",
 *     "resultCount": 2,
 *     "categories": [...]
 *   }
 * }
 */
router.get('/search', async (req, res) => {
  await categoryController.searchCategories(req, res);
});

/**
 * カテゴリ統計情報を取得
 * GET /api/aws-categories/statistics
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "categories": {
 *       "totalCategories": 8,
 *       "activeCategories": 8,
 *       "rootCategories": 8
 *     },
 *     "services": {
 *       "totalServices": 150,
 *       "activeServices": 145
 *     },
 *     "summary": {
 *       "averageServicesPerCategory": 18,
 *       "uncategorizedServices": 5
 *     }
 *   }
 * }
 */
router.get('/statistics', async (req, res) => {
  await categoryController.getCategoryStatistics(req, res);
});

/**
 * 未分類サービスを取得
 * GET /api/aws-categories/uncategorized-services
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "count": 5,
 *     "services": [
 *       {
 *         "serviceId": "svc_12345678",
 *         "serviceName": "AWS AppSync",
 *         "suggestedCategory": {
 *           "categoryId": "cat_87654321",
 *           "categoryName": "Mobile",
 *           "categoryNameJa": "モバイル"
 *         }
 *       }
 *     ]
 *   }
 * }
 */
router.get('/uncategorized-services', async (req, res) => {
  await categoryController.getUncategorizedServices(req, res);
});

/**
 * カテゴリ整合性チェック
 * GET /api/aws-categories/validate
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "isValid": true,
 *     "issues": {
 *       "orphanedServices": [],
 *       "invalidParentReferences": [],
 *       "serviceCountMismatches": []
 *     },
 *     "summary": {
 *       "orphanedServices": 0,
 *       "invalidParentReferences": 0,
 *       "serviceCountMismatches": 0
 *     }
 *   },
 *   "message": "カテゴリの整合性に問題はありません"
 * }
 */
router.get('/validate', async (req, res) => {
  await categoryController.validateCategoryIntegrity(req, res);
});

/**
 * カテゴリを作成
 * POST /api/aws-categories
 * 
 * リクエストボディ:
 * {
 *   "name": "Mobile",
 *   "nameJa": "モバイル",
 *   "description": "Mobile app development services",
 *   "descriptionJa": "モバイルアプリ開発サービス",
 *   "parentCategoryId": null,
 *   "color": "#FF6B6B",
 *   "icon": "mobile",
 *   "displayOrder": 9
 * }
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "カテゴリを作成しました",
 *   "data": {
 *     "categoryId": "cat_12345678",
 *     "name": "Mobile",
 *     "nameJa": "モバイル",
 *     "level": 0,
 *     "serviceCount": 0,
 *     "createdAt": "2024-01-15T10:30:00.000Z"
 *   }
 * }
 */
router.post('/', async (req, res) => {
  await categoryController.createCategory(req, res);
});

/**
 * カテゴリの並び順を更新
 * PUT /api/aws-categories/order
 * 
 * リクエストボディ:
 * {
 *   "categoryOrders": [
 *     { "categoryId": "cat_12345678", "displayOrder": 1 },
 *     { "categoryId": "cat_87654321", "displayOrder": 2 }
 *   ]
 * }
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "2個のカテゴリの順序を更新しました",
 *   "data": {
 *     "updated": ["cat_12345678", "cat_87654321"],
 *     "errors": []
 *   }
 * }
 */
router.put('/order', async (req, res) => {
  await categoryController.updateCategoryOrder(req, res);
});

/**
 * サービス自動分類
 * POST /api/aws-categories/classify-service
 * 
 * リクエストボディ:
 * {
 *   "serviceName": "AWS Lambda"
 * }
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "serviceName": "AWS Lambda",
 *     "suggestedCategory": {
 *       "categoryId": "cat_12345678",
 *       "categoryName": "Compute",
 *       "categoryNameJa": "コンピューティング",
 *       "confidence": "high"
 *     }
 *   }
 * }
 */
router.post('/classify-service', async (req, res) => {
  await categoryController.classifyService(req, res);
});

/**
 * カテゴリ別サービス一覧を取得
 * GET /api/aws-categories/:categoryId/services?sortBy=popularity&activeOnly=true
 * 
 * パスパラメータ:
 * - categoryId: カテゴリID
 * 
 * クエリパラメータ:
 * - sortBy (optional): ソート方法 ('name' | 'popularity' | 'created')
 * - activeOnly (optional): アクティブなサービスのみ (default: true)
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "data": {
 *     "category": {
 *       "categoryId": "cat_12345678",
 *       "name": "Compute",
 *       "nameJa": "コンピューティング"
 *     },
 *     "services": [...],
 *     "childCategories": [...],
 *     "serviceCount": 15,
 *     "childCategoryCount": 2
 *   }
 * }
 */
router.get('/:categoryId/services', async (req, res) => {
  await categoryController.getCategoryWithServices(req, res);
});

/**
 * サービスをカテゴリに割り当て
 * POST /api/aws-categories/:categoryId/assign-service
 * 
 * パスパラメータ:
 * - categoryId: カテゴリID
 * 
 * リクエストボディ:
 * {
 *   "serviceId": "svc_12345678"
 * }
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "サービスをカテゴリに割り当てました",
 *   "data": {
 *     "serviceId": "svc_12345678",
 *     "categoryId": "cat_12345678",
 *     "oldCategoryId": "cat_87654321"
 *   }
 * }
 */
router.post('/:categoryId/assign-service', async (req, res) => {
  await categoryController.assignServiceToCategory(req, res);
});

/**
 * カテゴリを更新
 * PUT /api/aws-categories/:categoryId
 * 
 * パスパラメータ:
 * - categoryId: カテゴリID
 * 
 * リクエストボディ:
 * {
 *   "nameJa": "更新されたカテゴリ名",
 *   "descriptionJa": "更新された説明",
 *   "color": "#FF0000",
 *   "displayOrder": 5
 * }
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "カテゴリを更新しました",
 *   "data": {
 *     "categoryId": "cat_12345678",
 *     "name": "Compute",
 *     "nameJa": "更新されたカテゴリ名",
 *     "updatedAt": "2024-01-15T10:30:00.000Z"
 *   }
 * }
 */
router.put('/:categoryId', async (req, res) => {
  await categoryController.updateCategory(req, res);
});

/**
 * カテゴリを削除
 * DELETE /api/aws-categories/:categoryId
 * 
 * パスパラメータ:
 * - categoryId: カテゴリID
 * 
 * レスポンス例:
 * {
 *   "success": true,
 *   "message": "カテゴリを削除しました"
 * }
 */
router.delete('/:categoryId', async (req, res) => {
  await categoryController.deleteCategory(req, res);
});

// エラーハンドリングミドルウェア
router.use((error, req, res, next) => {
  console.error('AWSサービスカテゴリルートエラー:', error);
  
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