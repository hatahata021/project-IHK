import crypto from 'crypto';

/**
 * 翻訳関連のユーティリティ関数
 */

/**
 * テキストのハッシュ値を生成（キャッシュキー用）
 */
export function generateContentHash(text: string, sourceLanguage: string, targetLanguage: string): string {
  const content = `${text}|${sourceLanguage}|${targetLanguage}`;
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * 言語コードの正規化
 */
export function normalizeLanguageCode(languageCode: string): string {
  // 言語コードを小文字に変換し、地域コードを除去
  return languageCode.toLowerCase().split('-')[0];
}

/**
 * サポートされている言語かどうかをチェック
 */
export function isSupportedLanguage(languageCode: string, supportedLanguages: string[]): boolean {
  const normalized = normalizeLanguageCode(languageCode);
  return supportedLanguages.includes(normalized);
}

/**
 * テキストの文字数をカウント（マルチバイト文字対応）
 */
export function getTextLength(text: string): number {
  // Unicode文字を正確にカウント
  return Array.from(text).length;
}

/**
 * テキストを指定された長さで分割
 */
export function splitTextByLength(text: string, maxLength: number): string[] {
  if (getTextLength(text) <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  
  // 文を単位として分割を試行
  const sentences = text.split(/[。！？\.\!\?]\s*/);
  
  for (const sentence of sentences) {
    const sentenceWithPunctuation = sentence + (sentence.match(/[。！？\.\!\?]$/) ? '' : '。');
    
    if (getTextLength(currentChunk + sentenceWithPunctuation) <= maxLength) {
      currentChunk += sentenceWithPunctuation;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // 単一の文が長すぎる場合は強制的に分割
      if (getTextLength(sentenceWithPunctuation) > maxLength) {
        const words = sentenceWithPunctuation.split(/\s+/);
        let wordChunk = '';
        
        for (const word of words) {
          if (getTextLength(wordChunk + ' ' + word) <= maxLength) {
            wordChunk += (wordChunk ? ' ' : '') + word;
          } else {
            if (wordChunk) {
              chunks.push(wordChunk.trim());
              wordChunk = word;
            } else {
              // 単語自体が長すぎる場合は文字単位で分割
              const chars = Array.from(word);
              let charChunk = '';
              
              for (const char of chars) {
                if (getTextLength(charChunk + char) <= maxLength) {
                  charChunk += char;
                } else {
                  if (charChunk) {
                    chunks.push(charChunk);
                    charChunk = char;
                  }
                }
              }
              
              if (charChunk) {
                wordChunk = charChunk;
              }
            }
          }
        }
        
        if (wordChunk) {
          currentChunk = wordChunk;
        }
      } else {
        currentChunk = sentenceWithPunctuation;
      }
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [text];
}

/**
 * 翻訳結果を結合
 */
export function mergeTranslationResults(chunks: string[]): string {
  return chunks.join(' ').trim();
}

/**
 * 言語検出の信頼度を評価
 */
export function evaluateConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

/**
 * HTMLタグを除去（翻訳前の前処理用）
 */
export function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

/**
 * マークダウン記法を一時的に置換（翻訳時の保護用）
 */
export function protectMarkdown(text: string): { text: string; placeholders: Map<string, string> } {
  const placeholders = new Map<string, string>();
  let counter = 0;
  
  // コードブロック、インラインコード、リンクなどを保護
  const patterns = [
    /```[\s\S]*?```/g,  // コードブロック
    /`[^`]+`/g,         // インラインコード
    /\[([^\]]+)\]\(([^)]+)\)/g,  // リンク
    /!\[([^\]]*)\]\(([^)]+)\)/g, // 画像
    /\*\*([^*]+)\*\*/g, // 太字
    /\*([^*]+)\*/g,     // イタリック
  ];
  
  let protectedText = text;
  
  for (const pattern of patterns) {
    protectedText = protectedText.replace(pattern, (match) => {
      const placeholder = `__PROTECTED_${counter++}__`;
      placeholders.set(placeholder, match);
      return placeholder;
    });
  }
  
  return { text: protectedText, placeholders };
}

/**
 * 保護されたマークダウンを復元
 */
export function restoreMarkdown(text: string, placeholders: Map<string, string>): string {
  let restoredText = text;
  
  for (const [placeholder, original] of placeholders) {
    restoredText = restoredText.replace(placeholder, original);
  }
  
  return restoredText;
}

/**
 * 翻訳エラーメッセージを日本語化
 */
export function getLocalizedErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    'EMPTY_TEXT': 'テキストが入力されていません',
    'TEXT_TOO_LONG': 'テキストが長すぎます',
    'MISSING_TARGET_LANGUAGE': '翻訳先の言語が指定されていません',
    'UNSUPPORTED_LANGUAGE_PAIR': 'サポートされていない言語の組み合わせです',
    'LANGUAGE_DETECTION_FAILED': '言語の自動検出に失敗しました',
    'TRANSLATION_SERVICE_ERROR': '翻訳サービスでエラーが発生しました',
    'DETECTION_SERVICE_ERROR': '言語検出サービスでエラーが発生しました',
    'TEXT_SIZE_LIMIT_EXCEEDED': 'テキストサイズが制限を超えています',
    'EMPTY_TRANSLATION_RESULT': '翻訳結果が取得できませんでした'
  };
  
  return errorMessages[errorCode] || '不明なエラーが発生しました';
}

/**
 * 翻訳品質のスコアを計算（簡易版）
 */
export function calculateTranslationQuality(
  originalText: string,
  translatedText: string,
  confidence?: number
): number {
  let score = 0.5; // ベーススコア
  
  // 言語検出の信頼度を考慮
  if (confidence !== undefined) {
    score += confidence * 0.3;
  }
  
  // 長さの比率を考慮（極端に短い/長い翻訳は品質が低い可能性）
  const lengthRatio = translatedText.length / originalText.length;
  if (lengthRatio >= 0.3 && lengthRatio <= 3.0) {
    score += 0.2;
  }
  
  // 翻訳結果が元のテキストと同じでない場合は加点
  if (originalText !== translatedText) {
    score += 0.1;
  }
  
  return Math.min(1.0, Math.max(0.0, score));
}