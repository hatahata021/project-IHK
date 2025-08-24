/**
 * 設定管理統合サービス
 * Secrets ManagerとParameter Storeを統合した設定管理を提供
 */

import { secretsService, SecretsService } from './secretsService';
import { parameterService, ParameterService } from './parameterService';

// 統合設定型定義
export interface ApplicationConfig {
  // アプリケーション基本設定
  app: {
    region: string;
    logLevel: string;
    environment: string;
    projectName: string;
  };
  
  // データベース設定
  database: {
    tablePrefix: string;
    endpoint?: string; // 開発環境用
  };
  
  // ストレージ設定
  storage: {
    s3BucketName: string;
    region: string;
  };
  
  // 翻訳設定
  translation: {
    sourceLanguages: string[];
    region: string;
  };
  
  // 認証設定
  auth: {
    cognito: {
      userPoolId: string;
      clientId: string;
    };
    jwt: {
      signingKey: string;
      refreshKey: string;
    };
  };
  
  // 外部API設定
  externalAPIs: {
    github?: {
      apiKey: string;
      endpoint: string;
    };
    twitter?: {
      apiKey: string;
      apiSecret: string;
      bearerToken?: string;
    };
    linkedin?: {
      clientId: string;
      clientSecret: string;
    };
  };
  
  // メール設定
  email: {
    smtpHost: string;
    smtpUser: string;
    smtpPassword: string;
    fromAddress: string;
  };
}

// エラークラス
export class ConfigServiceError extends Error {
  constructor(message: string, public readonly configKey?: string) {
    super(message);
    this.name = 'ConfigServiceError';
  }
}

/**
 * 設定管理統合サービスクラス
 */
export class ConfigService {
  private secretsService: SecretsService;
  private parameterService: ParameterService;
  private configCache: ApplicationConfig | null = null;
  private cacheExpiry: number = 0;
  private readonly cacheTimeout: number = 5 * 60 * 1000; // 5分間キャッシュ

  constructor(
    secretsService?: SecretsService,
    parameterService?: ParameterService
  ) {
    this.secretsService = secretsService || new SecretsService();
    this.parameterService = parameterService || new ParameterService();
  }

  /**
   * 統合設定を取得
   */
  async getConfig(): Promise<ApplicationConfig> {
    // キャッシュチェック
    if (this.configCache && this.cacheExpiry > Date.now()) {
      return this.configCache;
    }

    try {
      // 並列で設定を取得
      const [
        appConfig,
        cognitoConfig,
        jwtKeys,
        emailConfig
      ] = await Promise.all([
        this.parameterService.getAppConfig(),
        this.parameterService.getCognitoConfig(),
        this.secretsService.getJWTKeys(),
        this.secretsService.getEmailConfig()
      ]);

      // 外部API設定を取得（オプショナル）
      const externalAPIs: ApplicationConfig['externalAPIs'] = {};
      
      try {
        const githubAPI = await this.secretsService.getGitHubAPICredentials();
        externalAPIs.github = {
          apiKey: githubAPI.apiKey,
          endpoint: githubAPI.endpoint || 'https://api.github.com'
        };
      } catch (error) {
        console.warn('GitHub API credentials not available:', error);
      }

      try {
        const twitterAPI = await this.secretsService.getTwitterAPICredentials();
        externalAPIs.twitter = {
          apiKey: twitterAPI.apiKey!,
          apiSecret: twitterAPI.apiSecret!,
          bearerToken: twitterAPI.bearerToken
        };
      } catch (error) {
        console.warn('Twitter API credentials not available:', error);
      }

      try {
        const linkedinAPI = await this.secretsService.getLinkedInAPICredentials();
        externalAPIs.linkedin = {
          clientId: linkedinAPI.clientId!,
          clientSecret: linkedinAPI.clientSecret!
        };
      } catch (error) {
        console.warn('LinkedIn API credentials not available:', error);
      }

      // 統合設定を構築
      const config: ApplicationConfig = {
        app: {
          region: appConfig.region,
          logLevel: appConfig.logLevel,
          environment: process.env.ENVIRONMENT || 'dev',
          projectName: process.env.PROJECT_NAME || 'multilingual-community'
        },
        database: {
          tablePrefix: appConfig.dynamodbTablePrefix,
          endpoint: process.env.DYNAMODB_ENDPOINT // 開発環境用
        },
        storage: {
          s3BucketName: appConfig.s3BucketName,
          region: appConfig.region
        },
        translation: {
          sourceLanguages: appConfig.translateSourceLanguages,
          region: appConfig.region
        },
        auth: {
          cognito: {
            userPoolId: cognitoConfig.userPoolId,
            clientId: cognitoConfig.clientId
          },
          jwt: {
            signingKey: jwtKeys.signingKey,
            refreshKey: jwtKeys.refreshKey
          }
        },
        externalAPIs,
        email: {
          smtpHost: emailConfig.smtpHost,
          smtpUser: emailConfig.smtpUser,
          smtpPassword: emailConfig.smtpPassword,
          fromAddress: emailConfig.fromAddress
        }
      };

      // キャッシュに保存
      this.configCache = config;
      this.cacheExpiry = Date.now() + this.cacheTimeout;

      return config;
    } catch (error) {
      throw new ConfigServiceError(
        `Failed to load application configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 特定の設定セクションを取得
   */
  async getAppConfig(): Promise<ApplicationConfig['app']> {
    const config = await this.getConfig();
    return config.app;
  }

  async getDatabaseConfig(): Promise<ApplicationConfig['database']> {
    const config = await this.getConfig();
    return config.database;
  }

  async getStorageConfig(): Promise<ApplicationConfig['storage']> {
    const config = await this.getConfig();
    return config.storage;
  }

  async getTranslationConfig(): Promise<ApplicationConfig['translation']> {
    const config = await this.getConfig();
    return config.translation;
  }

  async getAuthConfig(): Promise<ApplicationConfig['auth']> {
    const config = await this.getConfig();
    return config.auth;
  }

  async getExternalAPIsConfig(): Promise<ApplicationConfig['externalAPIs']> {
    const config = await this.getConfig();
    return config.externalAPIs;
  }

  async getEmailConfig(): Promise<ApplicationConfig['email']> {
    const config = await this.getConfig();
    return config.email;
  }

  /**
   * 設定の再読み込み
   */
  async reloadConfig(): Promise<ApplicationConfig> {
    this.clearCache();
    return this.getConfig();
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.configCache = null;
    this.cacheExpiry = 0;
    this.secretsService.clearCache();
    this.parameterService.clearCache();
  }

  /**
   * 設定の検証
   */
  async validateConfig(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const config = await this.getConfig();

      // 必須設定の検証
      if (!config.app.region) {
        errors.push('App region is not configured');
      }

      if (!config.database.tablePrefix) {
        errors.push('Database table prefix is not configured');
      }

      if (!config.storage.s3BucketName) {
        errors.push('S3 bucket name is not configured');
      }

      if (!config.auth.cognito.userPoolId) {
        errors.push('Cognito User Pool ID is not configured');
      }

      if (!config.auth.cognito.clientId) {
        errors.push('Cognito Client ID is not configured');
      }

      if (!config.auth.jwt.signingKey) {
        errors.push('JWT signing key is not configured');
      }

      if (!config.email.smtpHost) {
        errors.push('Email SMTP host is not configured');
      }

      // 翻訳設定の検証
      if (!config.translation.sourceLanguages || config.translation.sourceLanguages.length === 0) {
        errors.push('Translation source languages are not configured');
      }

    } catch (error) {
      errors.push(`Configuration loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 設定情報の概要を取得（機密情報を除く）
   */
  async getConfigSummary(): Promise<Record<string, any>> {
    try {
      const config = await this.getConfig();
      
      return {
        app: config.app,
        database: {
          tablePrefix: config.database.tablePrefix,
          hasEndpoint: !!config.database.endpoint
        },
        storage: config.storage,
        translation: config.translation,
        auth: {
          cognito: config.auth.cognito,
          jwt: {
            hasSigningKey: !!config.auth.jwt.signingKey,
            hasRefreshKey: !!config.auth.jwt.refreshKey
          }
        },
        externalAPIs: {
          github: !!config.externalAPIs.github,
          twitter: !!config.externalAPIs.twitter,
          linkedin: !!config.externalAPIs.linkedin
        },
        email: {
          smtpHost: config.email.smtpHost,
          fromAddress: config.email.fromAddress,
          hasCredentials: !!(config.email.smtpUser && config.email.smtpPassword)
        }
      };
    } catch (error) {
      throw new ConfigServiceError(
        `Failed to get configuration summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// シングルトンインスタンス
export const configService = new ConfigService(secretsService, parameterService);