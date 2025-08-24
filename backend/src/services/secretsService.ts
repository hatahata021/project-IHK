/**
 * AWS Secrets Manager連携サービス
 * シークレット情報の取得とキャッシュ機能を提供
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// シークレット型定義
export interface DatabaseSecret {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname: string;
}

export interface JWTSecret {
  signingKey: string;
  refreshKey: string;
}

export interface ExternalAPISecret {
  apiKey: string;
  secretKey?: string;
  endpoint?: string;
  bearerToken?: string;
}

export interface SNSProviderSecret {
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  apiSecret?: string;
  bearerToken?: string;
}

export interface EmailSecret {
  smtpHost: string;
  smtpUser: string;
  smtpPassword: string;
  fromAddress: string;
}

// キャッシュエントリ型
interface CacheEntry<T> {
  value: T;
  expiry: number;
}

// エラークラス
export class SecretsManagerError extends Error {
  constructor(message: string, public readonly secretName?: string) {
    super(message);
    this.name = 'SecretsManagerError';
  }
}

/**
 * AWS Secrets Manager サービスクラス
 */
export class SecretsService {
  private client: SecretsManagerClient;
  private cache: Map<string, CacheEntry<any>>;
  private readonly cacheTimeout: number;
  private readonly projectName: string;
  private readonly environment: string;

  constructor() {
    this.client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'ap-northeast-1'
    });
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5分間キャッシュ
    this.projectName = process.env.PROJECT_NAME || 'multilingual-community';
    this.environment = process.env.ENVIRONMENT || 'dev';
  }

  /**
   * シークレット名を生成
   */
  private getSecretName(secretType: string): string {
    return `${this.projectName}/${this.environment}/${secretType}`;
  }

  /**
   * キャッシュから値を取得
   */
  private getCachedValue<T>(secretName: string): T | null {
    const cached = this.cache.get(secretName);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }
    return null;
  }

  /**
   * 値をキャッシュに保存
   */
  private setCachedValue<T>(secretName: string, value: T): void {
    this.cache.set(secretName, {
      value,
      expiry: Date.now() + this.cacheTimeout
    });
  }

  /**
   * シークレットを取得（汎用）
   */
  async getSecret<T>(secretType: string): Promise<T> {
    const secretName = this.getSecretName(secretType);
    
    // キャッシュチェック
    const cached = this.getCachedValue<T>(secretName);
    if (cached) {
      return cached;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });
      
      const response = await this.client.send(command);
      
      if (!response.SecretString) {
        throw new SecretsManagerError(
          `Secret string is empty for secret: ${secretName}`,
          secretName
        );
      }

      const secret = JSON.parse(response.SecretString) as T;
      
      // キャッシュに保存
      this.setCachedValue(secretName, secret);
      
      return secret;
    } catch (error) {
      if (error instanceof SecretsManagerError) {
        throw error;
      }
      
      throw new SecretsManagerError(
        `Failed to retrieve secret: ${secretName}. ${error instanceof Error ? error.message : 'Unknown error'}`,
        secretName
      );
    }
  }

  /**
   * JWT署名キーを取得
   */
  async getJWTKeys(): Promise<JWTSecret> {
    return this.getSecret<JWTSecret>('jwt-keys');
  }

  /**
   * GitHub API認証情報を取得
   */
  async getGitHubAPICredentials(): Promise<ExternalAPISecret> {
    return this.getSecret<ExternalAPISecret>('github-api');
  }

  /**
   * Twitter API認証情報を取得
   */
  async getTwitterAPICredentials(): Promise<SNSProviderSecret> {
    return this.getSecret<SNSProviderSecret>('twitter-api');
  }

  /**
   * LinkedIn API認証情報を取得
   */
  async getLinkedInAPICredentials(): Promise<SNSProviderSecret> {
    return this.getSecret<SNSProviderSecret>('linkedin-api');
  }

  /**
   * メール設定を取得
   */
  async getEmailConfig(): Promise<EmailSecret> {
    return this.getSecret<EmailSecret>('email-config');
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 特定のシークレットのキャッシュをクリア
   */
  clearSecretCache(secretType: string): void {
    const secretName = this.getSecretName(secretType);
    this.cache.delete(secretName);
  }

  /**
   * キャッシュ統計を取得
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// シングルトンインスタンス
export const secretsService = new SecretsService();