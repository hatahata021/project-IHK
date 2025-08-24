# 翻訳API仕様書

## 概要

AWSエンジニア向け多言語対応コミュニティサイトの翻訳API仕様です。Amazon Translateを使用した自動翻訳機能とキャッシュ機能を提供します。

## 基本情報

- **ベースURL**: `/api/translate`
- **認証**: JWT Bearer Token（ヘルスチェック以外）
- **レスポンス形式**: JSON
- **文字エンコーディング**: UTF-8

## 共通レスポンス形式

### 成功レスポンス
```json
{
  "success": true,
  "data": {
    // APIごとの具体的なデータ
  },
  "metadata": {
    "requestId": "uuid",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "processingTime": 150,
    "version": "1.0.0"
  }
}
```

### エラーレスポンス
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": {
      // 詳細情報（バリデーションエラー等）
    }
  },
  "metadata": {
    "requestId": "uuid",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "processingTime": 50,
    "version": "1.0.0"
  }
}
```

## エンドポイント

### 1. 単一テキスト翻訳

**POST** `/api/translate`

単一のテキストを指定した言語に翻訳します。

#### リクエスト

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "text": "翻訳したいテキスト",
  "targetLanguage": "en",
  "sourceLanguage": "ja"  // オプション（未指定時は自動検出）
}
```

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| text | string | ✓ | 翻訳対象のテキスト（最大5000文字） |
| targetLanguage | string | ✓ | 翻訳先言語コード |
| sourceLanguage | string | - | 翻訳元言語コード（未指定時は自動検出） |

#### レスポンス例

**成功時 (200):**
```json
{
  "success": true,
  "data": {
    "originalText": "こんにちは、世界！",
    "translatedText": "Hello, world!",
    "sourceLanguage": "ja",
    "targetLanguage": "en",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "confidence": 0.95,
    "processingTime": 150,
    "fromCache": false
  },
  "metadata": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "processingTime": 200,
    "version": "1.0.0"
  }
}
```

**エラー時 (400):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力値に問題があります",
    "details": {
      "text": ["翻訳対象のテキストが必要です"]
    }
  },
  "metadata": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "processingTime": 10,
    "version": "1.0.0"
  }
}
```

#### レート制限
- **制限**: 1分間に100回
- **ヘッダー**: `X-RateLimit-*`

---

### 2. バッチ翻訳

**POST** `/api/translate/batch`

複数のテキストを一括で翻訳します。

#### リクエスト

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "texts": ["テキスト1", "テキスト2", "テキスト3"],
  "targetLanguage": "en",
  "sourceLanguage": "ja",  // オプション
  "maxConcurrency": 5,     // オプション（デフォルト: 5）
  "preserveOrder": true    // オプション（デフォルト: true）
}
```

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| texts | string[] | ✓ | 翻訳対象のテキスト配列（最大100件） |
| targetLanguage | string | ✓ | 翻訳先言語コード |
| sourceLanguage | string | - | 翻訳元言語コード |
| maxConcurrency | number | - | 最大同時実行数（1-10、デフォルト: 5） |
| preserveOrder | boolean | - | 順序保持フラグ（デフォルト: true） |

#### レスポンス例

**成功時 (200):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "originalText": "こんにちは",
        "translatedText": "Hello",
        "sourceLanguage": "ja",
        "targetLanguage": "en",
        "timestamp": "2024-01-01T12:00:00.000Z",
        "confidence": 0.95,
        "processingTime": 100,
        "fromCache": false
      },
      {
        "originalText": "世界",
        "translatedText": "World",
        "sourceLanguage": "ja",
        "targetLanguage": "en",
        "timestamp": "2024-01-01T12:00:00.000Z",
        "confidence": 0.90,
        "processingTime": 120,
        "fromCache": true
      }
    ],
    "totalProcessingTime": 250,
    "successCount": 2,
    "errorCount": 0,
    "errors": []
  },
  "metadata": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "processingTime": 300,
    "version": "1.0.0"
  }
}
```

#### レート制限
- **制限**: 5分間に10回
- **理由**: 重い処理のため制限を強化

---

### 3. 言語検出

**POST** `/api/translate/detect`

テキストの言語を自動検出します。

#### リクエスト

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "text": "言語を検出したいテキスト"
}
```

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| text | string | ✓ | 言語検出対象のテキスト（最大1000文字） |

#### レスポンス例

**成功時 (200):**
```json
{
  "success": true,
  "data": {
    "languageCode": "ja",
    "confidence": 0.95,
    "text": "こんにちは、世界！"
  },
  "metadata": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "processingTime": 80,
    "version": "1.0.0"
  }
}
```

#### レート制限
- **制限**: 1分間に50回

---

### 4. サポート言語一覧

**GET** `/api/translate/languages`

翻訳でサポートされている言語の一覧を取得します。

#### リクエスト

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

#### レスポンス例

**成功時 (200):**
```json
{
  "success": true,
  "data": {
    "languages": [
      { "code": "ja", "name": "日本語" },
      { "code": "en", "name": "English" },
      { "code": "zh", "name": "中文" },
      { "code": "ko", "name": "한국어" },
      { "code": "es", "name": "Español" },
      { "code": "fr", "name": "Français" }
    ],
    "count": 6
  },
  "metadata": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "processingTime": 20,
    "version": "1.0.0"
  }
}
```

#### レート制限
- **制限**: 1分間に20回

---

### 5. ヘルスチェック

**GET** `/api/translate/health`

翻訳サービスの健全性をチェックします。

#### リクエスト

**認証不要**

#### レスポンス例

**正常時 (200):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "message": "翻訳サービスは正常に動作しています",
    "timestamp": "2024-01-01T12:00:00.000Z"
  },
  "metadata": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "processingTime": 100,
    "version": "1.0.0"
  }
}
```

**異常時 (503):**
```json
{
  "success": true,
  "data": {
    "status": "unhealthy",
    "message": "翻訳サービスでエラーが発生しました: Connection timeout",
    "timestamp": "2024-01-01T12:00:00.000Z"
  },
  "metadata": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "processingTime": 5000,
    "version": "1.0.0"
  }
}
```

#### レート制限
- **制限**: 1分間に10回

## サポート言語

| コード | 言語名 |
|--------|--------|
| ja | 日本語 |
| en | English |
| zh | 中文 |
| ko | 한국어 |
| es | Español |
| fr | Français |
| de | Deutsch |
| it | Italiano |
| pt | Português |
| ru | Русский |
| ar | العربية |
| hi | हिन्दी |

## エラーコード

| コード | 説明 | HTTPステータス |
|--------|------|----------------|
| VALIDATION_ERROR | 入力値バリデーションエラー | 400 |
| INVALID_INPUT | 無効な入力値 | 400 |
| INVALID_TARGET_LANGUAGE | 無効な翻訳先言語 | 400 |
| TEXT_TOO_LONG | テキストが長すぎる | 400 |
| TOO_MANY_TEXTS | バッチ翻訳のテキスト数超過 | 400 |
| MISSING_AUTH_HEADER | 認証ヘッダーなし | 401 |
| INVALID_TOKEN | 無効なトークン | 401 |
| TOKEN_EXPIRED | トークン期限切れ | 401 |
| RATE_LIMIT_EXCEEDED | レート制限超過 | 429 |
| UNSUPPORTED_LANGUAGE_PAIR | サポートされていない言語ペア | 422 |
| TRANSLATION_SERVICE_ERROR | 翻訳サービスエラー | 503 |
| LANGUAGE_DETECTION_ERROR | 言語検出エラー | 503 |

## 使用例

### cURL

```bash
# 単一テキスト翻訳
curl -X POST "https://api.example.com/api/translate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "こんにちは、世界！",
    "targetLanguage": "en"
  }'

# バッチ翻訳
curl -X POST "https://api.example.com/api/translate/batch" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "texts": ["こんにちは", "世界"],
    "targetLanguage": "en",
    "maxConcurrency": 2
  }'

# 言語検出
curl -X POST "https://api.example.com/api/translate/detect" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "こんにちは、世界！"
  }'

# サポート言語一覧
curl -X GET "https://api.example.com/api/translate/languages" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# ヘルスチェック
curl -X GET "https://api.example.com/api/translate/health"
```

### JavaScript (fetch)

```javascript
// 単一テキスト翻訳
const translateText = async (text, targetLanguage, sourceLanguage) => {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      targetLanguage,
      sourceLanguage
    })
  });
  
  return await response.json();
};

// バッチ翻訳
const translateBatch = async (texts, targetLanguage) => {
  const response = await fetch('/api/translate/batch', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      texts,
      targetLanguage,
      maxConcurrency: 5
    })
  });
  
  return await response.json();
};

// 使用例
const result = await translateText('こんにちは', 'en');
console.log(result.data.translatedText); // "Hello"
```

## パフォーマンス最適化

### キャッシュ機能
- 翻訳結果は自動的にキャッシュされます
- キャッシュヒット時は高速レスポンス（通常50ms以下）
- キャッシュTTL: 24時間（設定可能）

### バッチ翻訳の最適化
- 並列処理による高速化
- 同時実行数制限によるリソース保護
- 順序保持オプション

### レート制限
- IPアドレス + ユーザーIDベースの制限
- 適切なRetry-Afterヘッダー
- 段階的な制限強化

## セキュリティ

### 認証
- JWT Bearer Token認証
- トークン有効期限チェック
- 適切なエラーレスポンス

### 入力検証
- 厳密なバリデーション
- SQLインジェクション対策
- XSS対策

### レート制限
- DDoS攻撃対策
- リソース保護
- 公平な利用促進

## 監視・ログ

### メトリクス
- リクエスト数・レスポンス時間
- エラー率・成功率
- キャッシュヒット率

### ログ
- 構造化ログ出力
- リクエストID追跡
- エラー詳細記録

## トラブルシューティング

### よくある問題

1. **認証エラー**
   - JWTトークンの有効期限を確認
   - Authorizationヘッダーの形式を確認

2. **レート制限エラー**
   - Retry-Afterヘッダーを確認
   - 適切な間隔でリトライ

3. **翻訳品質の問題**
   - 元テキストの品質を確認
   - 適切な言語ペアを使用

4. **パフォーマンスの問題**
   - バッチ翻訳の活用
   - キャッシュ機能の確認