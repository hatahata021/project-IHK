/**
 * ParameterService テスト
 */

import { ParameterService, ParameterStoreError } from '../parameterService';
import { SSMClient, GetParameterCommand, GetParametersCommand, DescribeParametersCommand } from '@aws-sdk/client-ssm';

// AWS SDK のモック
jest.mock('@aws-sdk/client-ssm');

const mockSSMClient = SSMClient as jest.MockedClass<typeof SSMClient>;
const mockSend = jest.fn();

describe('ParameterService', () => {
  let parameterService: ParameterService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSSMClient.mockImplementation(() => ({
      send: mockSend,
    } as any));

    // 環境変数をモック
    process.env.PROJECT_NAME = 'test-project';
    process.env.ENVIRONMENT = 'test';
    process.env.AWS_REGION = 'ap-northeast-1';

    parameterService = new ParameterService();
  });

  afterEach(() => {
    delete process.env.PROJECT_NAME;
    delete process.env.ENVIRONMENT;
    delete process.env.AWS_REGION;
  });

  describe('getParameter', () => {
    it('パラメータを正常に取得できる', async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: {
          Value: 'test-value'
        }
      });

      const result = await parameterService.getParameter('/app/test-param');

      expect(result).toBe('test-value');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Name: '/test-project/test/app/test-param',
            WithDecryption: false
          }
        })
      );
    });

    it('キャッシュされたパラメータを返す', async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: {
          Value: 'cached-value'
        }
      });

      // 最初の呼び出し
      await parameterService.getParameter('/app/cached-param');
      
      // 2回目の呼び出し（キャッシュから取得）
      const result = await parameterService.getParameter('/app/cached-param');

      expect(result).toBe('cached-value');
      expect(mockSend).toHaveBeenCalledTimes(1); // キャッシュにより1回のみ
    });

    it('パラメータが存在しない場合エラーを投げる', async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: {
          Value: undefined
        }
      });

      await expect(parameterService.getParameter('/app/nonexistent'))
        .rejects
        .toThrow(ParameterStoreError);
    });

    it('AWS APIエラーの場合適切にエラーを投げる', async () => {
      const awsError = new Error('ParameterNotFound');
      mockSend.mockRejectedValueOnce(awsError);

      await expect(parameterService.getParameter('/app/error-param'))
        .rejects
        .toThrow(ParameterStoreError);
    });
  });

  describe('getParameters', () => {
    it('複数のパラメータを正常に取得できる', async () => {
      mockSend.mockResolvedValueOnce({
        Parameters: [
          { Name: '/test-project/test/app/param1', Value: 'value1' },
          { Name: '/test-project/test/app/param2', Value: 'value2' }
        ],
        InvalidParameters: []
      });

      const result = await parameterService.getParameters(['/app/param1', '/app/param2']);

      expect(result).toEqual({
        '/app/param1': 'value1',
        '/app/param2': 'value2'
      });
    });

    it('無効なパラメータがある場合エラーを投げる', async () => {
      mockSend.mockResolvedValueOnce({
        Parameters: [],
        InvalidParameters: ['/test-project/test/app/invalid']
      });

      await expect(parameterService.getParameters(['/app/invalid']))
        .rejects
        .toThrow(ParameterStoreError);
    });
  });

  describe('getAppConfig', () => {
    it('アプリケーション設定を正常に取得できる', async () => {
      mockSend.mockResolvedValueOnce({
        Parameters: [
          { Name: '/test-project/test/app/region', Value: 'ap-northeast-1' },
          { Name: '/test-project/test/app/log-level', Value: 'info' },
          { Name: '/test-project/test/dynamodb/table-prefix', Value: 'test-prefix' },
          { Name: '/test-project/test/s3/bucket-name', Value: 'test-bucket' },
          { Name: '/test-project/test/translate/source-languages', Value: 'ja,en,ko' }
        ],
        InvalidParameters: []
      });

      const result = await parameterService.getAppConfig();

      expect(result).toEqual({
        region: 'ap-northeast-1',
        logLevel: 'info',
        dynamodbTablePrefix: 'test-prefix',
        s3BucketName: 'test-bucket',
        translateSourceLanguages: ['ja', 'en', 'ko']
      });
    });
  });

  describe('getNumberParameter', () => {
    it('数値パラメータを正常に取得できる', async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: {
          Value: '42'
        }
      });

      const result = await parameterService.getNumberParameter('/app/number-param');

      expect(result).toBe(42);
    });

    it('無効な数値の場合エラーを投げる', async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: {
          Value: 'not-a-number'
        }
      });

      await expect(parameterService.getNumberParameter('/app/invalid-number'))
        .rejects
        .toThrow(ParameterStoreError);
    });
  });

  describe('getBooleanParameter', () => {
    it('真偽値パラメータを正常に取得できる', async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: {
          Value: 'true'
        }
      });

      const result = await parameterService.getBooleanParameter('/app/boolean-param');

      expect(result).toBe(true);
    });

    it('falseを正常に処理できる', async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: {
          Value: 'false'
        }
      });

      const result = await parameterService.getBooleanParameter('/app/boolean-param');

      expect(result).toBe(false);
    });

    it('無効な真偽値の場合エラーを投げる', async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: {
          Value: 'maybe'
        }
      });

      await expect(parameterService.getBooleanParameter('/app/invalid-boolean'))
        .rejects
        .toThrow(ParameterStoreError);
    });
  });

  describe('listAvailableParameters', () => {
    it('利用可能なパラメータ一覧を取得できる', async () => {
      mockSend.mockResolvedValueOnce({
        Parameters: [
          { Name: '/test-project/test/app/region' },
          { Name: '/test-project/test/app/log-level' },
          { Name: '/test-project/test/database/table-prefix' }
        ]
      });

      const result = await parameterService.listAvailableParameters();

      expect(result).toEqual(['/app/region', '/app/log-level', '/database/table-prefix']);
    });
  });

  describe('healthCheck', () => {
    it('正常な場合healthyを返す', async () => {
      mockSend.mockResolvedValueOnce({
        Parameters: []
      });

      const result = await parameterService.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.message).toBe('Parameter Store connection is healthy');
      expect(typeof result.timestamp).toBe('number');
    });

    it('エラーの場合unhealthyを返す', async () => {
      const error = new Error('Connection failed');
      mockSend.mockRejectedValueOnce(error);

      const result = await parameterService.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('Connection failed');
      expect(typeof result.timestamp).toBe('number');
    });
  });

  describe('parameterExists', () => {
    it('パラメータが存在する場合trueを返す', async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: {
          Value: 'exists'
        }
      });

      const result = await parameterService.parameterExists('/app/existing-param');

      expect(result).toBe(true);
    });

    it('パラメータが存在しない場合falseを返す', async () => {
      mockSend.mockRejectedValueOnce(new Error('ParameterNotFound'));

      const result = await parameterService.parameterExists('/app/nonexistent-param');

      expect(result).toBe(false);
    });
  });

  describe('getEnvironmentInfo', () => {
    it('環境情報を正常に取得できる', () => {
      const info = parameterService.getEnvironmentInfo();

      expect(info).toEqual({
        parameterPrefix: '/test-project/test',
        region: 'ap-northeast-1'
      });
    });
  });
});