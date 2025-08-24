/**
 * SecretsService テスト
 */

import { SecretsService, SecretsManagerError } from '../secretsService';
import { SecretsManagerClient, GetSecretValueCommand, ListSecretsCommand } from '@aws-sdk/client-secrets-manager';

// AWS SDK のモック
jest.mock('@aws-sdk/client-secrets-manager');

const mockSecretsManagerClient = SecretsManagerClient as jest.MockedClass<typeof SecretsManagerClient>;
const mockSend = jest.fn();

describe('SecretsService', () => {
  let secretsService: SecretsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSecretsManagerClient.mockImplementation(() => ({
      send: mockSend,
    } as any));

    // 環境変数をモック
    process.env.PROJECT_NAME = 'test-project';
    process.env.ENVIRONMENT = 'test';
    process.env.AWS_REGION = 'ap-northeast-1';

    secretsService = new SecretsService();
  });

  afterEach(() => {
    delete process.env.PROJECT_NAME;
    delete process.env.ENVIRONMENT;
    delete process.env.AWS_REGION;
  });

  describe('getSecret', () => {
    it('シークレットを正常に取得できる', async () => {
      const mockSecret = { apiKey: 'test-api-key', endpoint: 'https://api.example.com' };
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify(mockSecret)
      });

      const result = await secretsService.getSecret('test-secret');

      expect(result).toEqual(mockSecret);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            SecretId: 'test-project/test/test-secret'
          }
        })
      );
    });

    it('キャッシュされたシークレットを返す', async () => {
      const mockSecret = { apiKey: 'cached-key' };
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify(mockSecret)
      });

      // 最初の呼び出し
      await secretsService.getSecret('cached-secret');
      
      // 2回目の呼び出し（キャッシュから取得）
      const result = await secretsService.getSecret('cached-secret');

      expect(result).toEqual(mockSecret);
      expect(mockSend).toHaveBeenCalledTimes(1); // キャッシュにより1回のみ
    });

    it('シークレットが存在しない場合エラーを投げる', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: undefined
      });

      await expect(secretsService.getSecret('nonexistent-secret'))
        .rejects
        .toThrow(SecretsManagerError);
    });

    it('AWS APIエラーの場合適切にエラーを投げる', async () => {
      const awsError = new Error('ResourceNotFoundException');
      mockSend.mockRejectedValueOnce(awsError);

      await expect(secretsService.getSecret('error-secret'))
        .rejects
        .toThrow(SecretsManagerError);
    });
  });

  describe('getJWTKeys', () => {
    it('JWT キーを正常に取得できる', async () => {
      const mockJWTKeys = {
        signingKey: 'signing-key',
        refreshKey: 'refresh-key'
      };
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify(mockJWTKeys)
      });

      const result = await secretsService.getJWTKeys();

      expect(result).toEqual(mockJWTKeys);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            SecretId: 'test-project/test/jwt-keys'
          }
        })
      );
    });
  });

  describe('listAvailableSecrets', () => {
    it('利用可能なシークレット一覧を取得できる', async () => {
      mockSend.mockResolvedValueOnce({
        SecretList: [
          { Name: 'test-project/test/jwt-keys' },
          { Name: 'test-project/test/github-api' },
          { Name: 'test-project/test/email-config' }
        ]
      });

      const result = await secretsService.listAvailableSecrets();

      expect(result).toEqual(['jwt-keys', 'github-api', 'email-config']);
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(ListSecretsCommand)
      );
    });

    it('空のリストを正常に処理できる', async () => {
      mockSend.mockResolvedValueOnce({
        SecretList: []
      });

      const result = await secretsService.listAvailableSecrets();

      expect(result).toEqual([]);
    });
  });

  describe('healthCheck', () => {
    it('正常な場合healthyを返す', async () => {
      mockSend.mockResolvedValueOnce({
        SecretList: []
      });

      const result = await secretsService.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.message).toBe('Secrets Manager connection is healthy');
      expect(typeof result.timestamp).toBe('number');
    });

    it('エラーの場合unhealthyを返す', async () => {
      const error = new Error('Connection failed');
      mockSend.mockRejectedValueOnce(error);

      const result = await secretsService.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('Connection failed');
      expect(typeof result.timestamp).toBe('number');
    });
  });

  describe('secretExists', () => {
    it('シークレットが存在する場合trueを返す', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({ key: 'value' })
      });

      const result = await secretsService.secretExists('existing-secret');

      expect(result).toBe(true);
    });

    it('シークレットが存在しない場合falseを返す', async () => {
      mockSend.mockRejectedValueOnce(new Error('ResourceNotFoundException'));

      const result = await secretsService.secretExists('nonexistent-secret');

      expect(result).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('キャッシュを正常にクリアできる', async () => {
      // キャッシュにデータを追加
      const mockSecret = { key: 'value' };
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify(mockSecret)
      });
      await secretsService.getSecret('test-secret');

      // キャッシュをクリア
      secretsService.clearCache();

      // キャッシュ統計を確認
      const stats = secretsService.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.entries).toEqual([]);
    });
  });

  describe('getEnvironmentInfo', () => {
    it('環境情報を正常に取得できる', () => {
      const info = secretsService.getEnvironmentInfo();

      expect(info).toEqual({
        projectName: 'test-project',
        environment: 'test',
        region: 'ap-northeast-1'
      });
    });
  });
});