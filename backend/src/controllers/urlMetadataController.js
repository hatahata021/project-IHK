/**
 * URLメタデータコントローラー
 * URLプレビュー機能のAPIエンドポイントを提供
 */

const URLMetadataService = require('../services/urlMetadataService');

class URLMetadataController {
  constructor() {
    this.urlMetadataService = new URLMetadataService();
  }

  /**
   * 単一URLのメタデータを取得
   * GET /api/url-metadata?url=https://example.com
   */
  async getMetadata(req, res) {
    try {
      const { url } = req.query;

      // URLパラメータの検証
      if (!url) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_URL',
            message: 'URLパラメータが必要です',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
      }

      // URLの形式検証
      if (!this.urlMetadataService.isValidUrl(url)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_URL',
            message: '有効なURL形式ではありません',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
      }

      // メタデータ取得
      const metadata = await this.urlMetadataService.extractMetadata(url);

      // 成功レスポンス
      res.json({
        success: true,
        data: {
          url: url,
          metadata: metadata,
          extractedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('URLメタデータ取得エラー:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'METADATA_EXTRACTION_ERROR',
          message: 'メタデータの取得に失敗しました',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
    }
  }

  /**
   * 複数URLのメタデータを一括取得
   * POST /api/url-metadata/batch
   * Body: { urls: ["https://example1.com", "https://example2.com"] }
   */
  async getBatchMetadata(req, res) {
    try {
      const { urls } = req.body;

      // リクエストボディの検証
      if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_URLS_ARRAY',
            message: 'urlsは配列である必要があります',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
      }

      // URL数の制限チェック（最大10個）
      if (urls.length > 10) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TOO_MANY_URLS',
            message: '一度に処理できるURLは最大10個です',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
      }

      // 空の配列チェック
      if (urls.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMPTY_URLS_ARRAY',
            message: '少なくとも1つのURLが必要です',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
      }

      // 各URLの形式検証
      const invalidUrls = urls.filter(url => !this.urlMetadataService.isValidUrl(url));
      if (invalidUrls.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_URLS',
            message: '無効なURL形式が含まれています',
            details: { invalidUrls },
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
      }

      // 複数URLのメタデータを並行取得
      const results = await this.urlMetadataService.extractMultipleMetadata(urls);

      // 成功レスポンス
      res.json({
        success: true,
        data: {
          results: results,
          extractedAt: new Date().toISOString(),
          totalCount: results.length
        }
      });

    } catch (error) {
      console.error('バッチURLメタデータ取得エラー:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'BATCH_METADATA_EXTRACTION_ERROR',
          message: 'バッチメタデータの取得に失敗しました',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
    }
  }

  /**
   * URLからAWSサービス情報を取得
   * GET /api/url-metadata/aws-service?url=https://docs.aws.amazon.com/ec2/
   */
  async getAwsServiceInfo(req, res) {
    try {
      const { url } = req.query;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_URL',
            message: 'URLパラメータが必要です',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
      }

      // AWS公式URLかどうかチェック
      const isAwsOfficial = this.urlMetadataService.isAwsOfficialUrl(url);
      
      if (!isAwsOfficial) {
        return res.json({
          success: true,
          data: {
            url: url,
            isAwsOfficial: false,
            awsService: null
          }
        });
      }

      // AWSサービス名を抽出
      const awsService = this.urlMetadataService.extractAwsService(url);

      res.json({
        success: true,
        data: {
          url: url,
          isAwsOfficial: true,
          awsService: awsService
        }
      });

    } catch (error) {
      console.error('AWSサービス情報取得エラー:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'AWS_SERVICE_INFO_ERROR',
          message: 'AWSサービス情報の取得に失敗しました',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
    }
  }

  /**
   * URLプレビューのヘルスチェック
   * GET /api/url-metadata/health
   */
  async healthCheck(req, res) {
    try {
      // 簡単なテストURLでメタデータ取得をテスト
      const testUrl = 'https://aws.amazon.com';
      const startTime = Date.now();
      
      await this.urlMetadataService.extractMetadata(testUrl);
      
      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          status: 'healthy',
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('URLメタデータサービスヘルスチェックエラー:', error);
      
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNHEALTHY',
          message: 'URLメタデータサービスが利用できません',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
    }
  }
}

module.exports = URLMetadataController;