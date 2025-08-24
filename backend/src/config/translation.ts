import { SupportedLanguage } from '../types/translation';

/**
 * 翻訳サービスの設定定数
 */
export const TRANSLATION_CONFIG = {
  // Amazon Translate の制限
  MAX_TEXT_LENGTH: 5000,
  MAX_BATCH_SIZE: 25,
  
  // デフォルト設定
  DEFAULT_CONFIDENCE_THRESHOLD: 0.7,
  DEFAULT_CACHE_TTL: 86400, // 24時間（秒）
  DEFAULT_RETRY_ATTEMPTS: 3,
  DEFAULT_RETRY_DELAY: 1000, // 1秒（ミリ秒）
  DEFAULT_RATE_LIMIT: 10, // 1秒あたりのリクエスト数
  
  // サポート言語
  SUPPORTED_LANGUAGES: [
    'ja', 'en', 'zh', 'ko', 'es', 'fr', 
    'de', 'it', 'pt', 'ru', 'ar', 'hi'
  ] as SupportedLanguage[],
  
  // 言語名マッピング
  LANGUAGE_NAMES: {
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
  } as Record<SupportedLanguage, string>,
  
  // エラーメッセージ
  ERROR_MESSAGES: {
    'EMPTY_TEXT': 'テキストが入力されていません',
    'TEXT_TOO_LONG': 'テキストが長すぎます',
    'MISSING_TARGET_LANGUAGE': '翻訳先の言語が指定されていません',
    'UNSUPPORTED_LANGUAGE_PAIR': 'サポートされていない言語の組み合わせです',
    'LANGUAGE_DETECTION_FAILED': '言語の自動検出に失敗しました',
    'TRANSLATION_SERVICE_ERROR': '翻訳サービスでエラーが発生しました',
    'DETECTION_SERVICE_ERROR': '言語検出サービスでエラーが発生しました',
    'TEXT_SIZE_LIMIT_EXCEEDED': 'テキストサイズが制限を超えています',
    'EMPTY_TRANSLATION_RESULT': '翻訳結果が取得できませんでした'
  } as Record<string, string>,
  
  // AWS Parameter Store のパラメータ名
  PARAMETER_NAMES: {
    REGION: '/multilingual-community/prod/app/region',
    SUPPORTED_LANGUAGES: '/multilingual-community/prod/translate/source-languages',
    CONFIDENCE_THRESHOLD: '/multilingual-community/prod/translate/confidence-threshold',
    CACHE_TTL: '/multilingual-community/prod/translate/cache-ttl',
    MAX_TEXT_LENGTH: '/multilingual-community/prod/translate/max-text-length',
    RATE_LIMIT: '/multilingual-community/prod/translate/rate-limit'
  },
  
  // AWS Secrets Manager のシークレット名
  SECRET_NAMES: {
    TRANSLATE_API: 'prod/multilingual-community/translate-api',
    DATABASE: 'prod/multilingual-community/database',
    JWT_KEYS: 'prod/multilingual-community/jwt-keys'
  }
} as const;

/**
 * 環境変数から設定を取得するヘルパー関数
 */
export function getTranslationConfig() {
  return {
    region: process.env.AWS_REGION || 'ap-northeast-1',
    maxTextLength: parseInt(process.env.TRANSLATE_MAX_TEXT_LENGTH || '5000'),
    confidenceThreshold: parseFloat(process.env.TRANSLATE_CONFIDENCE_THRESHOLD || '0.7'),
    cacheEnabled: process.env.TRANSLATE_CACHE_ENABLED !== 'false',
    cacheTtl: parseInt(process.env.TRANSLATE_CACHE_TTL || '86400'),
    retryAttempts: parseInt(process.env.TRANSLATE_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.TRANSLATE_RETRY_DELAY || '1000'),
    rateLimit: parseInt(process.env.TRANSLATE_RATE_LIMIT || '10')
  };
}

/**
 * 言語ペアがサポートされているかチェック
 */
export function isSupportedLanguagePair(
  sourceLanguage: string, 
  targetLanguage: string
): boolean {
  const supported = TRANSLATION_CONFIG.SUPPORTED_LANGUAGES;
  return supported.includes(sourceLanguage as SupportedLanguage) && 
         supported.includes(targetLanguage as SupportedLanguage);
}

/**
 * 翻訳コストを計算（概算）
 */
export function calculateTranslationCost(characterCount: number): number {
  // Amazon Translate の料金（2024年時点）
  const costPerCharacter = 0.000015; // $15 per million characters
  return characterCount * costPerCharacter;
}