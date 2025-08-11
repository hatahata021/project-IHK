/**
 * URLメタデータサービスのユニットテスト
 */

const URLMetadataService = require('../urlMetadataService');
const axios = require('axios');

// axiosをモック化
jest.mock('axios');
const mockedAxios = axios;

describe('URLMetadataService', () => {
  let service;

  beforeEach(() => {
    service = new URLMetadataService();
    jest.clearAllMocks();
  });

  describe('isValidUrl', () => {
    test('有効なHTTPSのURLを正しく判定する', () => {
      expect(service.isValidUrl('https://example.com')).toBe(true);
      expect(service.isValidUrl('https://docs.aws.amazon.com/ec2/')).toBe(true);
    });

    test('有効なHTTPのURLを正しく判定する', () => {
      expect(service.isValidUrl('http://example.com')).toBe(true);
    });

    test('無効なURLを正しく判定する', () => {
      expect(service.isValidUrl('invalid-url')).toBe(false);
      expect(service.isValidUrl('ftp://example.com')).toBe(false);
      expect(service.isValidUrl('')).toBe(false);
      expect(service.isValidUrl(null)).toBe(false);
    });
  });

  describe('extractMetadata', () => {
    test('Open Graphメタデータを正しく抽出する', async () => {
      const mockHtml = `
        <html>
          <head>
            <meta property="og:title" content="AWS EC2 Documentation" />
            <meta property="og:description" content="Amazon EC2の公式ドキュメント" />
            <meta property="og:image" content="https://aws.amazon.com/favicon.ico" />
            <meta property="og:site_name" content="AWS Documentation" />
            <meta property="og:type" content="website" />
            <meta property="og:url" content="https://docs.aws.amazon.com/ec2/" />
            <title>EC2 Documentation</title>
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.mockResolvedValue({
        data: mockHtml,
        status: 200
      });

      const result = await service.extractMetadata('https://docs.aws.amazon.com/ec2/');

      expect(result).toMatchObject({
        title: 'AWS EC2 Documentation',
        description: 'Amazon EC2の公式ドキュメント',
        imageUrl: 'https://aws.amazon.com/favicon.ico',
        siteName: 'AWS Documentation',
        type: 'website',
        url: 'https://docs.aws.amazon.com/ec2/',
        isAwsOfficial: true,
        awsService: 'EC2'
      });
      expect(result.contentHash).toBeDefined();
    });

    test('HTMLタイトルタグからメタデータを抽出する', async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Example Site - Home Page</title>
            <meta name="description" content="This is an example site" />
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.mockResolvedValue({
        data: mockHtml,
        status: 200
      });

      const result = await service.extractMetadata('https://example.com');

      expect(result).toMatchObject({
        title: 'Example Site - Home Page',
        description: 'This is an example site',
        type: 'website',
        url: 'https://example.com'
      });
    });

    test('Twitter Cardメタデータを抽出する', async () => {
      const mockHtml = `
        <html>
          <head>
            <meta name="twitter:title" content="Twitter Card Title" />
            <meta name="twitter:description" content="Twitter Card Description" />
            <meta name="twitter:image" content="https://example.com/image.jpg" />
            <meta name="twitter:site" content="@example" />
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.mockResolvedValue({
        data: mockHtml,
        status: 200
      });

      const result = await service.extractMetadata('https://example.com');

      expect(result).toMatchObject({
        title: 'Twitter Card Title',
        description: 'Twitter Card Description',
        imageUrl: 'https://example.com/image.jpg',
        siteName: '@example'
      });
    });

    test('HTTPリクエストエラー時にフォールバックメタデータを返す', async () => {
      mockedAxios.mockRejectedValue(new Error('Network error'));

      const result = await service.extractMetadata('https://example.com');

      expect(result).toMatchObject({
        url: 'https://example.com',
        title: 'example.com',
        description: 'プレビューを取得できませんでした',
        error: 'Network error'
      });
      expect(result.contentHash).toBeDefined();
    });

    test('無効なURL形式の場合にフォールバックメタデータを返す', async () => {
      const result = await service.extractMetadata('invalid-url');

      expect(result).toMatchObject({
        url: 'invalid-url',
        title: 'Unknown Site',
        description: 'プレビューを取得できませんでした',
        error: 'Invalid URL format'
      });
    });
  });

  describe('isAwsOfficialUrl', () => {
    test('AWS公式URLを正しく判定する', () => {
      expect(service.isAwsOfficialUrl('https://aws.amazon.com')).toBe(true);
      expect(service.isAwsOfficialUrl('https://docs.aws.amazon.com/ec2/')).toBe(true);
      expect(service.isAwsOfficialUrl('https://console.aws.amazon.com/ec2')).toBe(true);
      expect(service.isAwsOfficialUrl('https://aws.amazon.co.jp')).toBe(true);
    });

    test('非AWS URLを正しく判定する', () => {
      expect(service.isAwsOfficialUrl('https://example.com')).toBe(false);
      expect(service.isAwsOfficialUrl('https://github.com/aws')).toBe(false);
    });
  });

  describe('extractAwsService', () => {
    test('AWS DocsのURLからサービス名を抽出する', () => {
      expect(service.extractAwsService('https://docs.aws.amazon.com/ec2/')).toBe('EC2');
      expect(service.extractAwsService('https://docs.aws.amazon.com/lambda/latest/dg/')).toBe('LAMBDA');
      expect(service.extractAwsService('https://docs.aws.amazon.com/s3/latest/userguide/')).toBe('S3');
    });

    test('AWSコンソールのURLからサービス名を抽出する', () => {
      expect(service.extractAwsService('https://console.aws.amazon.com/ec2')).toBe('EC2');
      expect(service.extractAwsService('https://console.aws.amazon.com/lambda')).toBe('LAMBDA');
    });

    test('サービス名が抽出できない場合はnullを返す', () => {
      expect(service.extractAwsService('https://aws.amazon.com')).toBe(null);
      expect(service.extractAwsService('https://docs.aws.amazon.com')).toBe(null);
    });
  });

  describe('resolveUrl', () => {
    test('相対URLを絶対URLに変換する', () => {
      expect(service.resolveUrl('/path/to/resource', 'https://example.com')).toBe('https://example.com/path/to/resource');
      expect(service.resolveUrl('image.jpg', 'https://example.com/page/')).toBe('https://example.com/page/image.jpg');
    });

    test('絶対URLはそのまま返す', () => {
      expect(service.resolveUrl('https://example.com/image.jpg', 'https://other.com')).toBe('https://example.com/image.jpg');
    });

    test('無効なURLの場合は元のURLを返す', () => {
      expect(service.resolveUrl('invalid-url', 'https://example.com')).toBe('invalid-url');
    });
  });

  describe('extractMultipleMetadata', () => {
    test('複数URLのメタデータを並行取得する', async () => {
      const mockHtml1 = '<html><head><title>Site 1</title></head></html>';
      const mockHtml2 = '<html><head><title>Site 2</title></head></html>';

      mockedAxios
        .mockResolvedValueOnce({ data: mockHtml1, status: 200 })
        .mockResolvedValueOnce({ data: mockHtml2, status: 200 });

      const urls = ['https://example1.com', 'https://example2.com'];
      const results = await service.extractMultipleMetadata(urls);

      expect(results).toHaveLength(2);
      expect(results[0].url).toBe('https://example1.com');
      expect(results[0].metadata.title).toBe('Site 1');
      expect(results[1].url).toBe('https://example2.com');
      expect(results[1].metadata.title).toBe('Site 2');
    });

    test('一部のURLでエラーが発生してもフォールバックメタデータを返す', async () => {
      const mockHtml = '<html><head><title>Success Site</title></head></html>';

      mockedAxios
        .mockResolvedValueOnce({ data: mockHtml, status: 200 })
        .mockRejectedValueOnce(new Error('Network error'));

      const urls = ['https://success.com', 'https://error.com'];
      const results = await service.extractMultipleMetadata(urls);

      expect(results).toHaveLength(2);
      expect(results[0].metadata.title).toBe('Success Site');
      expect(results[1].metadata.title).toBe('error.com');
      expect(results[1].metadata.error).toBeDefined();
    });
  });

  describe('generateContentHash', () => {
    test('同じ内容に対して同じハッシュを生成する', () => {
      const url = 'https://example.com';
      const metadata = { title: 'Test', description: 'Test description' };
      
      const hash1 = service.generateContentHash(url, metadata);
      const hash2 = service.generateContentHash(url, metadata);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256ハッシュの形式
    });

    test('異なる内容に対して異なるハッシュを生成する', () => {
      const url = 'https://example.com';
      const metadata1 = { title: 'Test 1', description: 'Description 1' };
      const metadata2 = { title: 'Test 2', description: 'Description 2' };
      
      const hash1 = service.generateContentHash(url, metadata1);
      const hash2 = service.generateContentHash(url, metadata2);
      
      expect(hash1).not.toBe(hash2);
    });
  });
});