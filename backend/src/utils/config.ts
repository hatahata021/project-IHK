/**
 * 設定管理ユーティリティ
 * AWS Secrets Manager・Parameter Storeから設定値を取得
 */
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SSMClient, GetParameterCommand, GetParametersCommand } from '@aws-sdk/client-ssm';

// 環境変数
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const PROJECT_NAME = process.env.PROJECT_NAME || 'multilingual-community';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

// AWSクライアント
const secretsManagerClient = new SecretsManagerClient({
  region: AWS_REGION,
  endpoint: process.env.SECRETS_MANAGER_ENDPOINT, // ローカル開発用
});

const ssmClient = new SSMClient({
  region: AWS_REGION,
  endpoint: process.env.SSM_ENDPOINT, // ローカル開発用
});

// キャッシュ
const secretsCache = new Map<string, any>();
const parametersCache = new Map<string, string>();
const CACHE_TTL = 5 * 60 * 1000; // 5分

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

/**
 * シークレットを取得
 */
export async function getSecret(secretName: string): Promise<any> {
  const fullSecretName = `${PROJECT_NAME}/${ENVIRONMENT}/${secretName}`;
  
  // キャッシュチェック
  const cached = secretsCache.get(fullSecretName) as CacheEntry<any>;
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  try {
    const command = new GetSecretValueCommand({
      SecretId: fullSecretName,
    });
    
    const response = await secretsManagerClient.send(command);
    
    if (!response.SecretString) {
      throw new Error(`Secret not found: ${fullSecretName}`);
    }

    const secretValue = JSON.parse(response.SecretString);
    
    // キャッシュに保存
    secretsCache.set(fullSecretName, {
      value: secretValue,
      timestamp: Date.now(),
    });

    return secretValue;
  } catch (error) {
    console.error(`Failed to get secret: ${fullSecretName}`, error);
    throw error;
  }
}

/**
 * パラメータを取得
 */
export async function getParameter(parameterName: string): Promise<string> {
  const fullParameterName = `/${PROJECT_NAME}/${ENVIRONMENT}/${parameterName}`;
  
  // キャッシュチェック
  const cached = parametersCache.get(fullParameterName) as CacheEntry<string>;
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  try {
    const command = new GetParameterCommand({
      Name: fullParameterName,
    });
    
    const response = await ssmClient.send(command);
    
    if (!response.Parameter?.Value) {
      throw new Error(`Parameter not found: ${fullParameterName}`);
    }

    const parameterValue = response.Parameter.Value;
    
    // キャッシュに保存
    parametersCache.set(fullParameterName, {
      value: parameterValue,
      timestamp: Date.now(),
    });

    return parameterValue;
  } catch (error) {
    console.error(`Failed to get parameter: ${fullParameterName}`, error);
    throw error;
  }
}

/**
 * 複数のパラメータを一括取得
 */
export async function getParameters(parameterNames: string[]): Promise<Record<string, string>> {
  const fullParameterNames = parameterNames.map(
    name => `/${PROJECT_NAME}/${ENVIRONMENT}/${name}`
  );

  try {
    const command = new GetParametersCommand({
      Names: fullParameterNames,
    });
    
    const response = await ssmClient.send(command);
    
    const result: Record<string, string> = {};
    
    response.Parameters?.forEach(param => {
      if (param.Name && param.Value) {
        // フルパスから相対パスに変換
        const relativeName = param.Name.replace(`/${PROJECT_NAME}/${ENVIRONMENT}/`, '');
        result[relativeName] = param.Value;
        
        // キャッシュに保存
        parametersCache.set(param.Name, {
          value: param.Value,
          timestamp: Date.now(),
        });
      }
    });

    return result;
  } catch (error) {
    console.error('Failed to get parameters:', parameterNames, error);
    throw error;
  }
}

/**
 * 設定クラス
 */
export class Config {
  private static instance: Config;
  private _jwtSecret?: string;
  private _databaseConfig?: any;
  private _translationConfig?: any;
  private _appConfig?: Record<string, string>;

  private constructor() {}

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /**
   * JWT設定を取得
   */
  async getJWTSecret(): Promise<string> {
    if (!this._jwtSecret) {
      const secret = await getSecret('jwt-secret');
      this._jwtSecret = secret.secret;
    }
    return this._jwtSecret;
  }

  /**
   * データベース設定を取得
   */
  async getDatabaseConfig(): Promise<any> {
    if (!this._databaseConfig) {
      this._databaseConfig = await getSecret('database-credentials');
    }
    return this._databaseConfig;
  }

  /**
   * 翻訳サービス設定を取得
   */
  async getTranslationConfig(): Promise<any> {
    if (!this._translationConfig) {
      this._translationConfig = await getSecret('translation-api-keys');
    }
    return this._translationConfig;
  }

  /**
   * アプリケーション設定を取得
   */
  async getAppConfig(): Promise<Record<string, string>> {
    if (!this._appConfig) {
      this._appConfig = await getParameters([
        'app/name',
        'app/version',
        'app/port',
        'auth/jwt-expires-in',
        'auth/refresh-token-expires-in',
        'translation/default-language',
        'translation/cache-enabled',
        'translation/cache-ttl',
        'logging/level',
        'monitoring/enabled'
      ]);
    }
    return this._appConfig;
  }

  /**
   * 機能フラグを取得
   */
  async getFeatureFlags(): Promise<Record<string, boolean>> {
    const flags = await getParameters([
      'feature-flags/translation',
      'feature-flags/image-upload',
      'feature-flags/github-integration'
    ]);

    return Object.entries(flags).reduce((acc, [key, value]) => {
      const flagName = key.replace('feature-flags/', '');
      acc[flagName] = value.toLowerCase() === 'true';
      return acc;
    }, {} as Record<string, boolean>);
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    secretsCache.clear();
    parametersCache.clear();
    this._jwtSecret = undefined;
    this._databaseConfig = undefined;
    this._translationConfig = undefined;
    this._appConfig = undefined;
  }
}

/**
 * 設定インスタンスを取得
 */
export const config = Config.getInstance();

/**
 * 環境変数から基本設定を取得
 */
export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  ENVIRONMENT,
  PROJECT_NAME,
  AWS_REGION,
  PORT: parseInt(process.env.PORT || '3001', 10),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
} as const;

/**
 * 設定の初期化（アプリケーション起動時に呼び出し）
 */
export async function initializeConfig(): Promise<void> {
  try {
    console.log('🔧 設定を初期化中...');
    
    // 基本設定を事前読み込み
    await config.getAppConfig();
    
    console.log('✅ 設定の初期化が完了しました');
  } catch (error) {
    console.error('❌ 設定の初期化に失敗しました:', error);
    throw error;
  }
}