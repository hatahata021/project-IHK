/**
 * ConfigService テスト
 */

import { ConfigService, ConfigServiceError } from '../configService';
import { SecretsService } from '../secretsService';
import { ParameterService } from '../parameterService';

// サービスのモック
jest.mock('../secretsService');
jest.mock('../parameterService');

const MockSecretsService = SecretsService as jest.MockedClass<typeof SecretsService>;
const MockParameterService = ParameterService as jest.MockedClass<typeof ParameterService>;

describe('ConfigService', () => {
  let configService: ConfigService;
  let mockSecretsService: jest.Mocked<SecretsService>;
  let mockParameterService: jest.Mocked<ParameterService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // モックインスタンスを作成
    mockSecretsService = {
      getJWTKeys: jest.fn(),
      getEmailConfig: jest.fn(),
      getGitHubAPICredentials: jest.fn(),
      getTwitterAPICredentials: jest.fn(),
      getLinkedInAPICredentials: jest.fn(),
      clearCache: jest.fn(),
      healthCheck: jest.fn(),
      secretExists: jest.fn(),
    } as any;

    mockParameterService = {
      getAppConfig: jest.fn(),
      getCognitoConfig: jest.fn(),
      clearCache: jest.fn(),
      healthCheck: jest.fn(),
      parameterExists: jest.fn(),
      getCacheStats: jest.fn(),
    } as any;

    configService = new ConfigService(mockSecretsService, mockParameterService);

    // 環境変数をモック
    process.env.ENVIRONMENT = 'test';
    process.env.PROJECT_NAME = 'test-project';
  });

  afterEach(() => {
    delete process.env.ENVIRONMENT;
    delete process.env.PROJECT_NAME;
  });

  describe('getConfig', () => {
    it('統合設定を正常に取得できる', async () => {
      // モックデータの設定
      mockParameterService.getAppConfig.mockResolvedValue({
        region: 'ap-northeast-1',
        logLevel: 'info',
        dynamodbTablePrefix: 'test-prefix',
        s3BucketName: 'test-bucket',
        translateSourceLanguages: ['ja', 'en']
      });

      mockParameterService.getCognitoConfig.mockResolvedValue({
        userPoolId: 'test-pool-id',
        clientId: 'test-client-id'
      });

      mockSecretsService.getJWTKeys.mockResolvedValue({
        signingKey: 'test-signing-key',
        refreshKey: 'test-refresh-key'
      });

      mockSecretsService.getEmailConfig.mockResolvedValue({
        smtpHost: 'smtp.example.com',
        smtpUser: 'test@example.com',
        smtpPassword: 'password',
        fromAddress: 'noreply@example.com'
      });

      // 外部APIは利用不可として設定
      mockSecretsService.getGitHubAPICredentials.mockRejectedValue(new Error('Not available'));
      mockSecretsService.getTwitterAPICredentials.mockRejectedValue(new Error('Not available'));
      mockSecretsService.getLinkedInAPICredentials.mockRejectedValue(new Error('Not available'));

      const result = await configService.getConfig();

      expect(result).toEqual({
        app: {
          region: 'ap-northeast-1',
          logLevel: 'info',
          environment: 'test',
          projectName: 'test-project'
        },
        database: {
          tablePrefix: 'test-prefix',
          endpoint: undefined
        },
        storage: {
          s3BucketName: 'test-bucket',
          region: 'ap-northeast-1'
        },
        translation: {
          sourceLanguages: ['ja', 'en'],
          region: 'ap-northeast-1'
        },
        auth: {
          cognito: {
            userPoolId: 'test-pool-id',
            clientId: 'test-client-id'
          },
          jwt: {
            signingKey: 'test-signing-key',
            refreshKey: 'test-refresh-key'
          }
        },
        externalAPIs: {},
        email: {
          smtpHost: 'smtp.example.com',
          smtpUser: 'test@example.com',
          smtpPassword: 'password',
          fromAddress: 'noreply@example.com'
        }
      });
    });

    it('外部API設定が利用可能な場合は含める', async () => {
      // 基本設定のモック
      mockParameterService.getAppConfig.mockResolvedValue({
        region: 'ap-northeast-1',
        logLevel: 'info',
        dynamodbTablePrefix: 'test-prefix',
        s3BucketName: 'test-bucket',
        translateSourceLanguages: ['ja', 'en']
      });

      mockParameterService.getCognitoConfig.mockResolvedValue({
        userPoolId: 'test-pool-id',
        clientId: 'test-client-id'
      });

      mockSecretsService.getJWTKeys.mockResolvedValue({
        signingKey: 'test-signing-key',
        refreshKey: 'test-refresh-key'
      });

      mockSecretsService.getEmailConfig.mockResolvedValue({
        smtpHost: 'smtp.example.com',
        smtpUser: 'test@example.com',
        smtpPassword: 'password',
        fromAddress: 'noreply@example.com'
      });

      // 外部API設定のモック
      mockSecretsService.getGitHubAPICredentials.mockResolvedValue({
        apiKey: 'github-api-key',
        endpoint: 'https://api.github.com'
      });

      mockSecretsService.getTwitterAPICredentials.mockResolvedValue({
        apiKey: 'twitter-api-key',
        apiSecret: 'twitter-api-secret',
        bearerToken: 'twitter-bearer-token'
      });

      mockSecretsService.getLinkedInAPICredentials.mockRejectedValue(new Error('Not available'));

      const result = await configService.getConfig();

      expect(result.externalAPIs).toEqual({
        github: {
          apiKey: 'github-api-key',
          endpoint: 'https://api.github.com'
        },
        twitter: {
          apiKey: 'twitter-api-key',
          apiSecret: 'twitter-api-secret',
          bearerToken: 'twitter-bearer-token'
        }
      });
    });

    it('設定取得エラーの場合適切にエラーを投げる', async () => {
      mockParameterService.getAppConfig.mockRejectedValue(new Error('Parameter error'));

      await expect(configService.getConfig())
        .rejects
        .toThrow(ConfigServiceError);
    });
  });

  describe('validateConfig', () => {
    it('有効な設定の場合validationが成功する', async () => {
      // 有効な設定をモック
      mockParameterService.getAppConfig.mockResolvedValue({
        region: 'ap-northeast-1',
        logLevel: 'info',
        dynamodbTablePrefix: 'test-prefix',
        s3BucketName: 'test-bucket',
        translateSourceLanguages: ['ja', 'en']
      });

      mockParameterService.getCognitoConfig.mockResolvedValue({
        userPoolId: 'test-pool-id',
        clientId: 'test-client-id'
      });

      mockSecretsService.getJWTKeys.mockResolvedValue({
        signingKey: 'test-signing-key',
        refreshKey: 'test-refresh-key'
      });

      mockSecretsService.getEmailConfig.mockResolvedValue({
        smtpHost: 'smtp.example.com',
        smtpUser: 'test@example.com',
        smtpPassword: 'password',
        fromAddress: 'noreply@example.com'
      });

      mockSecretsService.getGitHubAPICredentials.mockRejectedValue(new Error('Not available'));
      mockSecretsService.getTwitterAPICredentials.mockRejectedValue(new Error('Not available'));
      mockSecretsService.getLinkedInAPICredentials.mockRejectedValue(new Error('Not available'));

      const result = await configService.validateConfig();

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('無効な設定の場合エラーを返す', async () => {
      // 無効な設定をモック（必須項目が空）
      mockParameterService.getAppConfig.mockResolvedValue({
        region: '', // 空の値
        logLevel: 'info',
        dynamodbTablePrefix: '',
        s3BucketName: '',
        translateSourceLanguages: []
      });

      mockParameterService.getCognitoConfig.mockResolvedValue({
        userPoolId: '',
        clientId: ''
      });

      mockSecretsService.getJWTKeys.mockResolvedValue({
        signingKey: '',
        refreshKey: 'test-refresh-key'
      });

      mockSecretsService.getEmailConfig.mockResolvedValue({
        smtpHost: '',
        smtpUser: 'test@example.com',
        smtpPassword: 'password',
        fromAddress: 'noreply@example.com'
      });

      mockSecretsService.getGitHubAPICredentials.mockRejectedValue(new Error('Not available'));
      mockSecretsService.getTwitterAPICredentials.mockRejectedValue(new Error('Not available'));
      mockSecretsService.getLinkedInAPICredentials.mockRejectedValue(new Error('Not available'));

      const result = await configService.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('App region is not configured');
      expect(result.errors).toContain('Database table prefix is not configured');
      expect(result.errors).toContain('S3 bucket name is not configured');
    });
  });

  describe('healthCheck', () => {
    it('全サービスが正常な場合healthyを返す', async () => {
      mockSecretsService.healthCheck.mockResolvedValue({
        status: 'healthy',
        message: 'Secrets Manager is healthy',
        timestamp: Date.now()
      });

      mockParameterService.healthCheck.mockResolvedValue({
        status: 'healthy',
        message: 'Parameter Store is healthy',
        timestamp: Date.now()
      });

      const result = await configService.healthCheck();

      expect(result.overall).toBe('healthy');
      expect(result.services.secretsManager.status).toBe('healthy');
      expect(result.services.parameterStore.status).toBe('healthy');
    });

    it('いずれかのサービスが異常な場合unhealthyを返す', async () => {
      mockSecretsService.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        message: 'Secrets Manager connection failed',
        timestamp: Date.now()
      });

      mockParameterService.healthCheck.mockResolvedValue({
        status: 'healthy',
        message: 'Parameter Store is healthy',
        timestamp: Date.now()
      });

      const result = await configService.healthCheck();

      expect(result.overall).toBe('unhealthy');
      expect(result.services.secretsManager.status).toBe('unhealthy');
      expect(result.services.parameterStore.status).toBe('healthy');
    });
  });

  describe('initializeEnvironment', () => {
    it('全ての必須設定が存在する場合initializedがtrueになる', async () => {
      mockSecretsService.secretExists.mockResolvedValue(true);
      mockParameterService.parameterExists.mockResolvedValue(true);

      const result = await configService.initializeEnvironment();

      expect(result.initialized).toBe(true);
      expect(result.missingSecrets).toEqual([]);
      expect(result.missingParameters).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('必須設定が不足している場合initializedがfalseになる', async () => {
      mockSecretsService.secretExists.mockImplementation((secretType) => {
        return Promise.resolve(secretType !== 'jwt-keys'); // jwt-keysのみ存在しない
      });

      mockParameterService.parameterExists.mockImplementation((paramPath) => {
        return Promise.resolve(paramPath !== '/app/region'); // /app/regionのみ存在しない
      });

      const result = await configService.initializeEnvironment();

      expect(result.initialized).toBe(false);
      expect(result.missingSecrets).toContain('jwt-keys');
      expect(result.missingParameters).toContain('/app/region');
    });
  });

  describe('clearCache', () => {
    it('全てのキャッシュを正常にクリアできる', () => {
      configService.clearCache();

      expect(mockSecretsService.clearCache).toHaveBeenCalled();
      expect(mockParameterService.clearCache).toHaveBeenCalled();
    });
  });
});