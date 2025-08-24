/**
 * URLメタデータ関連のルート定義
 */

const express = require('express');
const URLMetadataController = require('../controllers/urlMetadataController');
const { validateRequest } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const urlMetadataController = new URLMetadataController();

// レート制限設定（URLメタデータ取得は負荷が高いため制限を設ける）
const urlMetadataRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 最大100リクエスト
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'リクエスト制限を超えました。しばらく待ってから再試行してください。'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// バッチ処理用のより厳しいレート制限
const batchRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 20, // 最大20リクエスト
  message: {
    success: false,
    error: {
      code: 'BATCH_RATE_LIMIT_EXCEEDED',
      message: 'バッチ処理のリクエスト制限を超えました。しばらく待ってから再試行してください。'
    }
  }
});

// バリデーションスキーマ
const urlQuerySchema = {
  type: 'object',
  properties: {
    url: {
      type: 'string',
      format: 'uri',
      pattern: '^https?://'
    }
  },
  required: ['url'],
  additionalProperties: false
};

const batchUrlsSchema = {
  type: 'object',
  properties: {
    urls: {
      type: 'array',
      items: {
        type: 'string',
        format: 'uri',
        pattern: '^https?://'
      },
      minItems: 1,
      maxItems: 10
    }
  },
  required: ['urls'],
  additionalProperties: false
};

/**
 * @route GET /api/url-metadata
 * @desc 単一URLのメタデータを取得
 * @access Private（認証必要）
 * @param {string} url - 取得対象のURL
 * @returns {Object} URLメタデータ
 */
router.get('/', 
  urlMetadataRateLimit,
  authenticateToken,
  validateRequest({ query: urlQuerySchema }),
  async (req, res) => {
    await urlMetadataController.getMetadata(req, res);
  }
);

/**
 * @route POST /api/url-metadata/batch
 * @desc 複数URLのメタデータを一括取得
 * @access Private（認証必要）
 * @param {string[]} urls - 取得対象のURL配列（最大10個）
 * @returns {Object[]} URLメタデータ配列
 */
router.post('/batch',
  batchRateLimit,
  authenticateToken,
  validateRequest({ body: batchUrlsSchema }),
  async (req, res) => {
    await urlMetadataController.getBatchMetadata(req, res);
  }
);

/**
 * @route GET /api/url-metadata/aws-service
 * @desc URLからAWSサービス情報を取得
 * @access Private（認証必要）
 * @param {string} url - 判定対象のURL
 * @returns {Object} AWSサービス情報
 */
router.get('/aws-service',
  urlMetadataRateLimit,
  authenticateToken,
  validateRequest({ query: urlQuerySchema }),
  async (req, res) => {
    await urlMetadataController.getAwsServiceInfo(req, res);
  }
);

/**
 * @route GET /api/url-metadata/health
 * @desc URLメタデータサービスのヘルスチェック
 * @access Public
 * @returns {Object} サービス状態
 */
router.get('/health',
  async (req, res) => {
    await urlMetadataController.healthCheck(req, res);
  }
);

module.exports = router;