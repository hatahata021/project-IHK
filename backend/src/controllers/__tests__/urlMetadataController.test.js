/**
 * URLメタデータコントローラーの統合テスト
 */

const request = require('supertest');
const express = require('express');
const URLMetadataController = require('../urlMetadataController');
const URLMetadataService = require('../../services/urlMetadataService');

// URLMetadataServiceをモック化
jest.mock('../../services/urlMetadataService');

describe('URLMetadataController', () => {
  let app;
  let mockUrlMetadataService;

  beforeEach(() => {
    // Expressアプリケーションのセットアップ
    app = express();
    app.use(express.json());
    
    // リクエストIDミドルウェア（テスト用）
    app.use((req, res, next) => {
      req.requestId = 'test-request-id';
      next();
    });

    // コントローラーのセットアップ
    const controller = new URLMetadataController();
    
    // ルートの設定
    app.get('/metadata', (req, res) => controller.getMetadata(req, res));
    app.post('/metadata/batch', (req, res) => controller.getBatchMetadata(req, res));
    app.get('/metadata/aws-service', (req, res) => controller.getAwsServiceInfo(req, res));
    app.get('/metadata/health', (req, res) => controller.healthCheck(req, res));

    // モックサービスのセットアップ
    mockUrlMetadataService = {
      isValidUrl: jest.fn(),
      extractMetadata: jest.fn(),
      extractMultipleMetadata: jest.fn(),
      isAwsOfficialUrl: jest.fn(),
      extractAwsService: jest.fn()
    };

    URLMetadataService.mockImplementation(() => mockUrlMetadataService);

    jest.clearAllMocks();
  });

  describe('GET /metadata', () => {
    test('有効なURLでメタデータを正常に取得する', async () => {
      const mockMetadata = {
        title: 'Test Site',
        description: 'Test description',
        imageUrl: 'https://example.com/image.jpg',
        contentHash: 'abc123'
      };

      mockUrlMetadataService.isValidUrl.mockReturnValue(true);
      mockUrlMetadataService.extractMetadata.mockResolvedValue(mockMetadata);

      const response = await request(app)
        .get('/metadata')
        .query({ url: 'https://example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.url).toBe('https://example.com');
      expect(response.body.data.metadata).toEqual(mockMetadata);
      expect(response.body.data.extractedAt).toBeDefined();
    });

    test('URLパラメータが不足している場合は400エラーを返す', async () => {
      const response = await request(app)
        .get('/metadata');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_URL');
      expect(response.body.error.message).toBe('URLパラメータが必要です');
    });

    test('無効なURL形式の場合は400エラーを返す', async () => {
      mockUrlMetadataService.isValidUrl.mockReturnValue(false);

      const response = await request(app)
        .get('/metadata')
        .query({ url: 'invalid-url' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_URL');
      expect(response.body.error.message).toBe('有効なURL形式ではありません');
    });

    test('メタデータ取得でエラーが発生した場合は500エラーを返す', async () => {
      mockUrlMetadataService.isValidUrl.mockReturnValue(true);
      mockUrlMetadataService.extractMetadata.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .get('/metadata')
        .query({ url: 'https://example.com' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('METADATA_EXTRACTION_ERROR');
    });
  });

  describe('POST /metadata/batch', () => {
    test('複数URLのメタデータを正常に取得する', async () => {
      const mockResults = [
        {
          url: 'https://example1.com',
          metadata: { title: 'Site 1', contentHash: 'abc123' }
        },
        {
          url: 'https://example2.com',
          metadata: { title: 'Site 2', contentHash: 'def456' }
        }
      ];

      mockUrlMetadataService.isValidUrl.mockReturnValue(true);
      mockUrlMetadataService.extractMultipleMetadata.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/metadata/batch')
        .send({
          urls: ['https://example1.com', 'https://example2.com']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toEqual(mockResults);
      expect(response.body.data.totalCount).toBe(2);
    });

    test('urlsが配列でない場合は400エラーを返す', async () => {
      const response = await request(app)
        .post('/metadata/batch')
        .send({
          urls: 'not-an-array'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_URLS_ARRAY');
    });

    test('URL数が上限を超える場合は400エラーを返す', async () => {
      const urls = Array(11).fill('https://example.com');

      const response = await request(app)
        .post('/metadata/batch')
        .send({ urls });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOO_MANY_URLS');
    });

    test('空の配列の場合は400エラーを返す', async () => {
      const response = await request(app)
        .post('/metadata/batch')
        .send({ urls: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMPTY_URLS_ARRAY');
    });

    test('無効なURLが含まれる場合は400エラーを返す', async () => {
      mockUrlMetadataService.isValidUrl
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const response = await request(app)
        .post('/metadata/batch')
        .send({
          urls: ['https://example.com', 'invalid-url']
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_URLS');
      expect(response.body.error.details.invalidUrls).toEqual(['invalid-url']);
    });
  });

  describe('GET /metadata/aws-service', () => {
    test('AWS公式URLのサービス情報を正常に取得する', async () => {
      mockUrlMetadataService.isAwsOfficialUrl.mockReturnValue(true);
      mockUrlMetadataService.extractAwsService.mockReturnValue('EC2');

      const response = await request(app)
        .get('/metadata/aws-service')
        .query({ url: 'https://docs.aws.amazon.com/ec2/' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.url).toBe('https://docs.aws.amazon.com/ec2/');
      expect(response.body.data.isAwsOfficial).toBe(true);
      expect(response.body.data.awsService).toBe('EC2');
    });

    test('非AWS URLの場合は適切なレスポンスを返す', async () => {
      mockUrlMetadataService.isAwsOfficialUrl.mockReturnValue(false);

      const response = await request(app)
        .get('/metadata/aws-service')
        .query({ url: 'https://example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isAwsOfficial).toBe(false);
      expect(response.body.data.awsService).toBe(null);
    });

    test('URLパラメータが不足している場合は400エラーを返す', async () => {
      const response = await request(app)
        .get('/metadata/aws-service');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_URL');
    });
  });

  describe('GET /metadata/health', () => {
    test('サービスが正常な場合はhealthyを返す', async () => {
      mockUrlMetadataService.extractMetadata.mockResolvedValue({
        title: 'AWS',
        contentHash: 'test-hash'
      });

      const response = await request(app)
        .get('/metadata/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.responseTime).toMatch(/^\d+ms$/);
      expect(response.body.data.timestamp).toBeDefined();
    });

    test('サービスに問題がある場合は503エラーを返す', async () => {
      mockUrlMetadataService.extractMetadata.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/metadata/health');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SERVICE_UNHEALTHY');
    });
  });

  describe('エラーハンドリング', () => {
    test('予期しないエラーが発生した場合は適切にハンドリングする', async () => {
      mockUrlMetadataService.isValidUrl.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .get('/metadata')
        .query({ url: 'https://example.com' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('METADATA_EXTRACTION_ERROR');
      expect(response.body.error.requestId).toBe('test-request-id');
    });

    test('レスポンスに適切なタイムスタンプが含まれる', async () => {
      const response = await request(app)
        .get('/metadata');

      expect(response.body.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});