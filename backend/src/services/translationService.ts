import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { translationCacheService } from './translationCacheService';

/**
 * 翻訳サービスのエラークラス
 */
export class TranslationError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'TranslationError';
  }
}

/**
 * 翻訳リクエストの型定義
 */
export interface TranslationRequest {
  text: string;
  sourceLanguage?: string; // 未指定の場合は自動検出
  targetLanguage: string;
}

/**
 * 翻訳結果の型定義
 */
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence?: number; // 言語検出の信頼度
  fromCache?: boolean; // キャッシュから取得したか
  processingTime?: number; // 処理時間（ミリ秒）
}

/**
 * 言語検出結果の型定義
 */
export interface LanguageDetectionResult {
  languageCode: string;
  score: number;
}

/**
 * 翻訳サービス設定の型定義
 */
interface TranslationConfig {
  region: string;
  supportedLanguages: string[];
  maxTextLength: number;
  confidenceThreshold: number;
}

/**
 * Amazon Translateを使用した翻訳サービス
 * 言語検出、翻訳実行、エラーハンドリングを提供
 */
export class TranslationService {
  private translateClient: TranslateClient;
  private secretsClient: SecretsManagerClient;
  private ssmClient: SSMClient;
  private config: TranslationConfig | null = null;

  constructor() {
    // AWS クライアントの初期化
    const region = process.env.AWS_REGION || 'ap-northeast-1';
    
    this.translateClient = new TranslateClient({ region });
    this.secretsClient = new SecretsManagerClient({ region });
    this.ssmClient = new SSMClient({ region });
  }

  /**
   * 設定を初期化（Parameter Storeから取得）
   */
  private async initializeConfig(): Promise<void> {
    if (this.config) return;

    try {
      // Parameter Storeから設定を取得
      const regionParam = await this.getParameter('/multilingual-community/prod/app/region');
      const languagesParam = await this.getParameter('/multilingual-community/prod/translate/source-languages');
      
      this.config = {
        region: regionParam || 'ap-northeast-1',
        supportedLanguages: languagesParam ? languagesParam.split(',') : ['ja', 'en', 'zh', 'ko'],
        maxTextLength: 5000, // Amazon Translateの制限
        confidenceThreshold: 0.7 // 言語検出の信頼度閾値
      };

      console.log('翻訳サービス設定を初期化しました:', this.config);
    } catch (error) {
      console.error('翻訳サービス設定の初期化に失敗しました:', error);
      
      // フォールバック設定
      this.config = {
        region: 'ap-northeast-1',
        supportedLanguages: ['ja', 'en', 'zh', 'ko'],
        maxTextLength: 5000,
        confidenceThreshold: 0.7
      };
    }
  }

  /**
   * Parameter Storeからパラメータを取得
   */
  private async getParameter(name: string): Promise<string | null> {
    try {
      const command = new GetParameterCommand({
        Name: name,
        WithDecryption: false
      });
      
      const response = await this.ssmClient.send(command);
      return response.Parameter?.Value || null;
    } catch (error) {
      console.warn(`パラメータ取得に失敗: ${name}`, error);
      return null;
    }
  }

  /**
   * テキストの言語を検出（簡易版）
   */
  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    await this.initializeConfig();

    if (!text || text.trim().length === 0) {
      throw new TranslationError(
        '言語検出用のテキストが空です',
        'EMPTY_TEXT'
      );
    }

    if (text.length > this.config!.maxTextLength) {
      throw new TranslationError(
        `テキストが長すぎます（最大${this.config!.maxTextLength}文字）`,
        'TEXT_TOO_LONG'
      );
    }

    try {
      // 簡易的な言語検出（実際の実装ではAWS Comprehendを使用することを推奨）
      const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
      const koreanPattern = /[\uAC00-\uD7AF]/;
      const chinesePattern = /[\u4E00-\u9FFF]/;
      
      if (japanesePattern.test(text)) {
        return { languageCode: 'ja', score: 0.8 };
      } else if (koreanPattern.test(text)) {
        return { languageCode: 'ko', score: 0.8 };
      } else if (chinesePattern.test(text)) {
        return { languageCode: 'zh', score: 0.7 };
      } else {
        // デフォルトは英語と仮定
        return { languageCode: 'en', score: 0.6 };
      }
    } catch (error) {
      console.error('言語検出エラー:', error);
      throw new TranslationError(
        '言語検出中にエラーが発生しました',
        'DETECTION_SERVICE_ERROR',
        error as Error
      );
    }
  }

  /**
   * テキストを翻訳（キャッシュ機能付き）
   */
  async translateText(request: TranslationRequest): Promise<TranslationResult> {
    const startTime = Date.now();
    await this.initializeConfig();

    // 入力値検証
    if (!request.text || request.text.trim().length === 0) {
      throw new TranslationError(
        '翻訳対象のテキストが空です',
        'EMPTY_TEXT'
      );
    }

    if (!request.targetLanguage) {
      throw new TranslationError(
        '翻訳先言語が指定されていません',
        'MISSING_TARGET_LANGUAGE'
      );
    }

    if (request.text.length > this.config!.maxTextLength) {
      throw new TranslationError(
        `テキストが長すぎます（最大${this.config!.maxTextLength}文字）`,
        'TEXT_TOO_LONG'
      );
    }

    let sourceLanguage = request.sourceLanguage;
    let confidence: number | undefined;

    // 言語が指定されていない場合は自動検出
    if (!sourceLanguage) {
      try {
        const detection = await this.detectLanguage(request.text);
        sourceLanguage = detection.languageCode;
        confidence = detection.score;

        // 信頼度が低い場合は警告
        if (confidence < this.config!.confidenceThreshold) {
          console.warn(`言語検出の信頼度が低いです: ${confidence} (閾値: ${this.config!.confidenceThreshold})`);
        }
      } catch (error) {
        console.error('言語検出に失敗、デフォルト言語を使用:', error);
        sourceLanguage = 'auto'; // Amazon Translateの自動検出を使用
      }
    }

    // 同じ言語の場合は翻訳をスキップ
    if (sourceLanguage === request.targetLanguage) {
      const processingTime = Date.now() - startTime;
      return {
        originalText: request.text,
        translatedText: request.text,
        sourceLanguage: sourceLanguage,
        targetLanguage: request.targetLanguage,
        confidence,
        fromCache: false,
        processingTime
      };
    }

    // キャッシュから翻訳結果を取得を試行
    const cacheResult = await translationCacheService.get(
      request.text,
      sourceLanguage,
      request.targetLanguage
    );

    if (cacheResult.success && cacheResult.fromCache && cacheResult.entry) {
      const processingTime = Date.now() - startTime;
      console.log(`キャッシュから翻訳結果を取得: ${processingTime}ms`);
      
      return {
        originalText: cacheResult.entry.originalText,
        translatedText: cacheResult.entry.translatedText,
        sourceLanguage: cacheResult.entry.sourceLanguage,
        targetLanguage: cacheResult.entry.targetLanguage,
        confidence: cacheResult.entry.confidence,
        fromCache: true,
        processingTime
      };
    }

    // キャッシュにない場合はAmazon Translateで翻訳
    try {
      const command = new TranslateTextCommand({
        Text: request.text,
        SourceLanguageCode: sourceLanguage,
        TargetLanguageCode: request.targetLanguage
      });

      const response = await this.translateClient.send(command);

      if (!response.TranslatedText) {
        throw new TranslationError(
          '翻訳結果が空です',
          'EMPTY_TRANSLATION_RESULT'
        );
      }

      const translatedText = response.TranslatedText;
      const finalSourceLanguage = response.SourceLanguageCode || sourceLanguage;
      const finalTargetLanguage = response.TargetLanguageCode || request.targetLanguage;
      const processingTime = Date.now() - startTime;

      // 翻訳結果をキャッシュに保存
      await translationCacheService.put(
        request.text,
        translatedText,
        finalSourceLanguage,
        finalTargetLanguage,
        confidence
      );

      console.log(`Amazon Translateで翻訳完了: ${processingTime}ms`);

      return {
        originalText: request.text,
        translatedText,
        sourceLanguage: finalSourceLanguage,
        targetLanguage: finalTargetLanguage,
        confidence,
        fromCache: false,
        processingTime
      };
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }

      console.error('翻訳エラー:', error);
      
      // AWS Translateの特定エラーをハンドリング
      if (error instanceof Error) {
        if (error.message.includes('UnsupportedLanguagePairException')) {
          throw new TranslationError(
            `サポートされていない言語ペアです: ${sourceLanguage} → ${request.targetLanguage}`,
            'UNSUPPORTED_LANGUAGE_PAIR',
            error
          );
        }
        
        if (error.message.includes('TextSizeLimitExceededException')) {
          throw new TranslationError(
            'テキストサイズが制限を超えています',
            'TEXT_SIZE_LIMIT_EXCEEDED',
            error
          );
        }
      }

      throw new TranslationError(
        '翻訳中にエラーが発生しました',
        'TRANSLATION_SERVICE_ERROR',
        error as Error
      );
    }
  }

  /**
   * サポートされている言語のリストを取得
   */
  async getSupportedLanguages(): Promise<string[]> {
    await this.initializeConfig();
    return this.config!.supportedLanguages;
  }

  /**
   * 言語コードから言語名を取得（表示用）
   */
  getLanguageName(languageCode: string): string {
    const languageNames: Record<string, string> = {
      'ja': '日本語',
      'en': 'English',
      'zh': '中文',
      'ko': '한국어',
      'es': 'Español',
      'fr': 'Français',
      'de': 'Deutsch',
      'it': 'Italiano',
      'pt': 'Português',
      'ru': 'Русский',
      'ar': 'العربية',
      'hi': 'हिन्दी'
    };

    return languageNames[languageCode] || languageCode;
  }

  /**
   * 翻訳サービスの健全性をチェック
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      await this.initializeConfig();
      
      // 簡単な翻訳テストを実行
      const testResult = await this.translateText({
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'ja'
      });

      if (testResult.translatedText) {
        return {
          status: 'healthy',
          message: '翻訳サービスは正常に動作しています'
        };
      } else {
        return {
          status: 'unhealthy',
          message: '翻訳サービスのテストに失敗しました'
        };
      }
    } catch (error) {
      console.error('翻訳サービスヘルスチェックエラー:', error);
      return {
        status: 'unhealthy',
        message: `翻訳サービスでエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// シングルトンインスタンスをエクスポート
export const translationService = new TranslationService();