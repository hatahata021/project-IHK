/**
 * 翻訳関連の型定義
 */

/**
 * サポートされている言語コード
 */
export type SupportedLanguage = 
  | 'ja'    // 日本語
  | 'en'    // 英語
  | 'zh'    // 中国語
  | 'ko'    // 韓国語
  | 'es'    // スペイン語
  | 'fr'    // フランス語
  | 'de'    // ドイツ語
  | 'it'    // イタリア語
  | 'pt'    // ポルトガル語
  | 'ru'    // ロシア語
  | 'ar'    // アラビア語
  | 'hi';   // ヒンディー語

/**
 * 翻訳リクエストの基本型
 */
export interface BaseTranslationRequest {
  text: string;
  targetLanguage: SupportedLanguage;
  sourceLanguage?: SupportedLanguage;
}

/**
 * 拡張翻訳リクエスト（オプション付き）
 */
export interface ExtendedTranslationRequest extends BaseTranslationRequest {
  preserveFormatting?: boolean;  // フォーマット保持
  useCache?: boolean;           // キャッシュ使用
  priority?: 'low' | 'normal' | 'high'; // 優先度
  metadata?: Record<string, any>; // メタデータ
}

/**
 * 翻訳結果の基本型
 */
export interface BaseTranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  timestamp: Date;
}

/**
 * 拡張翻訳結果（詳細情報付き）
 */
export interface ExtendedTranslationResult extends BaseTranslationResult {
  confidence?: number;          // 言語検出の信頼度
  qualityScore?: number;        // 翻訳品質スコア
  processingTime?: number;      // 処理時間（ミリ秒）
  fromCache?: boolean;          // キャッシュから取得したか
  chunkCount?: number;          // 分割された場合のチャンク数
  metadata?: Record<string, any>; // メタデータ
}

/**
 * バッチ翻訳リクエスト
 */
export interface BatchTranslationRequest {
  texts: string[];
  targetLanguage: SupportedLanguage;
  sourceLanguage?: SupportedLanguage;
  preserveOrder?: boolean;      // 順序保持
  maxConcurrency?: number;      // 最大同時実行数
}

/**
 * バッチ翻訳結果
 */
export interface BatchTranslationResult {
  results: ExtendedTranslationResult[];
  totalProcessingTime: number;
  successCount: number;
  errorCount: number;
  errors?: TranslationError[];
}

/**
 * 言語検出結果
 */
export interface LanguageDetectionResult {
  languageCode: SupportedLanguage;
  confidence: number;
  alternatives?: Array<{
    languageCode: SupportedLanguage;
    confidence: number;
  }>;
}

/**
 * 翻訳エラーの詳細情報
 */
export interface TranslationError {
  code: string;
  message: string;
  originalText?: string;
  sourceLanguage?: SupportedLanguage;
  targetLanguage?: SupportedLanguage;
  timestamp: Date;
  retryable: boolean;
  details?: Record<string, any>;
}

/**
 * API レスポンス用の翻訳結果
 */
export interface TranslationApiResponse {
  success: boolean;
  data?: ExtendedTranslationResult;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata: {
    requestId: string;
    timestamp: Date;
    processingTime: number;
    version: string;
  };
}