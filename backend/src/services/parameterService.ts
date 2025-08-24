/**
 * AWS Systems Manager Parameter Store連携サービス
 * 非機密設定値の取得とキャッシュ機能を提供
 */

import { SSMClient, GetParameterCommand, GetParametersCommand, DescribeParametersCommand } from '@aws-sdk/client-ssm';

// パラメータ型定義
export interface AppConfig {
  region: string;
  logLevel: string;
  dynamodbTablePrefix: string;
  s3BucketName: string;
  translateSourceLanguages: string[];
}

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
}

// キャッシュエントリ型
interface ParameterCacheEntry {
  value: string;
  expiry: number;
}

// エラークラス
export class ParameterStoreError extends Error {
  constructor(message: string, public readonly parameterName?: string) {
    super(message);
    this.name = 'ParameterStoreError';
  }
}

/**
 * AWS Systems Manager Parameter Store サービスクラス
 */
export class ParameterService {
  private client: SSMClient;
  private cache: Map<string, ParameterCacheEntry>;
  private readonly cacheTimeout: number;
  private readonly parameterPrefix: string;

  constructor() {
    this.client = new SSMClient({
      region: process.env.AWS_REGION || 'ap-northeast-1'
    });
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10分間キャッシュ（非機密情報のため長め）
    
    const projectName = process.env.PROJECT_NAME || 'multilingual-community';
    const environment = process.env.ENVIRONMENT || 'dev';
    this.parameterPrefix = `/${projectName}/${environment}`;
  }

  /**
   * パラメータ名を生成
   */
  private getParameterName(parameterPath: string): string {
    return `${this.parameterPrefix}${parameterPath}`;
  }

  /**
   * キャッシュから値を取得
   */
  private getCachedValue(parameterName: string): string | null {
    const cached = this.cache.get(parameterName);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }
    return null;
  }

  /**
   * 値をキャッシュに保存
   */
  private setCachedValue(parameterName: string, value: string): void {
    this.cache.set(parameterName, {
      value,
      expiry: Date.now() + this.cacheTimeout
    });
  }

  /**
   * 単一パラメータを取得
   */
  async getParameter(parameterPath: string): Promise<string> {
    const parameterName = this.getParameterName(parameterPath);
    
    // キャッシュチェック
    const cached = this.getCachedValue(parameterName);
    if (cached) {
      return cached;
    }

    try {
      const command = new GetParameterCommand({
        Name: parameterName,
        WithDecryption: false // 非機密情報のため暗号化なし
      });
      
      const response = await this.client.send(command);
      
      if (!response.Parameter?.Value) {
        throw new ParameterStoreError(
          `Parameter value is empty for parameter: ${parameterName}`,
          parameterName
        );
      }

      const value = response.Parameter.Value;
      
      // キャッシュに保存
      this.setCachedValue(parameterName, value);
      
      return value;
    } catch (error) {
      if (error instanceof ParameterStoreError) {
        throw error;
      }
      
      throw new ParameterStoreError(
        `Failed to retrieve parameter: ${parameterName}. ${error instanceof Error ? error.message : 'Unknown error'}`,
        parameterName
      );
    }
  }

  /**
   * 複数パラメータを一括取得
   */
  async getParameters(parameterPaths: string[]): Promise<Record<string, string>> {
    const parameterNames = parameterPaths.map(path => this.getParameterName(path));
    const result: Record<string, string> = {};
    const uncachedNames: string[] = [];
    const pathToNameMap: Record<string, string> = {};

    // キャッシュチェック
    parameterPaths.forEach((path, index) => {
      const parameterName = parameterNames[index];
      pathToNameMap[parameterName] = path;
      
      const cached = this.getCachedValue(parameterName);
      if (cached) {
        result[path] = cached;
      } else {
        uncachedNames.push(parameterName);
      }
    });

    // キャッシュにないパラメータを取得
    if (uncachedNames.length > 0) {
      try {
        const command = new GetParametersCommand({
          Names: uncachedNames,
          WithDecryption: false
        });
        
        const response = await this.client.send(command);
        
        // 取得成功したパラメータを処理
        response.Parameters?.forEach(param => {
          if (param.Name && param.Value) {
            const path = pathToNameMap[param.Name];
            result[path] = param.Value;
            this.setCachedValue(param.Name, param.Value);
          }
        });

        // 取得失敗したパラメータをチェック
        const invalidParameters = response.InvalidParameters || [];
        if (invalidParameters.length > 0) {
          throw new ParameterStoreError(
            `Invalid parameters: ${invalidParameters.join(', ')}`
          );
        }
      } catch (error) {
        if (error instanceof ParameterStoreError) {
          throw error;
        }
        
        throw new ParameterStoreError(
          `Failed to retrieve parameters: ${uncachedNames.join(', ')}. ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return result;
  }

  /**
   * アプリケーション設定を取得
   */
  async getAppConfig(): Promise<AppConfig> {
    const parameters = await this.getParameters([
      '/app/region',
      '/app/log-level',
      '/dynamodb/table-prefix',
      '/s3/bucket-name',
      '/translate/source-languages'
    ]);

    return {
      region: parameters['/app/region'],
      logLevel: parameters['/app/log-level'],
      dynamodbTablePrefix: parameters['/dynamodb/table-prefix'],
      s3BucketName: parameters['/s3/bucket-name'],
      translateSourceLanguages: parameters['/translate/source-languages'].split(',')
    };
  }

  /**
   * Cognito設定を取得
   */
  async getCognitoConfig(): Promise<CognitoConfig> {
    const parameters = await this.getParameters([
      '/cognito/user-pool-id',
      '/cognito/client-id'
    ]);

    return {
      userPoolId: parameters['/cognito/user-pool-id'],
      clientId: parameters['/cognito/client-id']
    };
  }

  /**
   * 文字列リストパラメータを取得
   */
  async getStringListParameter(parameterPath: string): Promise<string[]> {
    const value = await this.getParameter(parameterPath);
    return value.split(',').map(item => item.trim());
  }

  /**
   * 数値パラメータを取得
   */
  async getNumberParameter(parameterPath: string): Promise<number> {
    const value = await this.getParameter(parameterPath);
    const number = parseInt(value, 10);
    
    if (isNaN(number)) {
      throw new ParameterStoreError(
        `Parameter value is not a valid number: ${value}`,
        this.getParameterName(parameterPath)
      );
    }
    
    return number;
  }

  /**
   * ブール値パラメータを取得
   */
  async getBooleanParameter(parameterPath: string): Promise<boolean> {
    const value = await this.getParameter(parameterPath);
    const lowerValue = value.toLowerCase();
    
    if (lowerValue === 'true' || lowerValue === '1') {
      return true;
    } else if (lowerValue === 'false' || lowerValue === '0') {
      return false;
    }
    
    throw new ParameterStoreError(
      `Parameter value is not a valid boolean: ${value}`,
      this.getParameterName(parameterPath)
    );
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 特定のパラメータのキャッシュをクリア
   */
  clearParameterCache(parameterPath: string): void {
    const parameterName = this.getParameterName(parameterPath);
    this.cache.delete(parameterName);
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

  /**
   * パラメータプレフィックスを取得
   */
  getParameterPrefix(): string {
    return this.parameterPrefix;
  }

  /**
   * 利用可能なパラメータ一覧を取得
   */
  async listAvailableParameters(): Promise<string[]> {
    try {
      const command = new DescribeParametersCommand({
        ParameterFilters: [
          {
            Key: 'Name',
            Option: 'BeginsWith',
            Values: [this.parameterPrefix]
          }
        ]
      });
      
      const response = await this.client.send(command);
      
      return response.Parameters?.map(param => {
        if (param.Name) {
          // プレフィックスを除去してパラメータパスのみを返す
          return param.Name.replace(this.parameterPrefix, '');
        }
        return '';
      }).filter(name => name !== '') || [];
    } catch (error) {
      throw new ParameterStoreError(
        `Failed to list parameters: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parameter Storeの接続テスト
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string; timestamp: number }> {
    try {
      // 軽量なリスト操作でヘルスチェック
      await this.client.send(new DescribeParametersCommand({ MaxResults: 1 }));
      
      return {
        status: 'healthy',
        message: 'Parameter Store connection is healthy',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Parameter Store connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 環境情報を取得
   */
  getEnvironmentInfo(): { parameterPrefix: string; region: string } {
    return {
      parameterPrefix: this.parameterPrefix,
      region: process.env.AWS_REGION || 'ap-northeast-1'
    };
  }

  /**
   * パラメータの存在確認
   */
  async parameterExists(parameterPath: string): Promise<boolean> {
    try {
      await this.getParameter(parameterPath);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// シングルトンインスタンス
export const parameterService = new ParameterService();