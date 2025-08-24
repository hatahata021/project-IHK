# URLプレビューAPI仕様書

## 概要

URLプレビュー機能を提供する統合APIです。URLメタデータ取得、キャッシュ機能、品質向上処理を組み合わせて、高品質なURLプレビューを効率的に生成します。

## 基本情報

- **ベースURL**: `/api/preview`
- **認証**: 必要（実装時に追加）
- **レスポンス形式**: JSON
- **文字エンコーディング**: UTF-8
- **レート制限**: あり（詳細は各エンドポイント参照）

## 主要機能

- **単一URLプレビュー**: 1つのURLのプレビューを取得
- **バッチプレビュー**: 最大10個のURLを一括処理
- **キャッシュ統合**: 高速レスポンスとコスト削減
- **品質向上**: プレビューデータの最適化
- **AWS特化**: AWS公式サイトの特別処理
- **レート制限**: API保護とリソース管理

## エンドポイント一覧

### 1. 単一URLプレビュー取得

指定されたURLのプレビューを取得します。

**エンドポイント**: `GET /api/preview`

**クエリパラメータ**:
- `url` (required): プレビューを取得するURL
- `forceRefresh` (optional): キャッシュを無視して新規取得 (default: false)
- `enhance` (optional): 品質向上処理を実行 (default: true)

**レート制限**: 15分間に100リクエスト

**リクエスト例**:
```
GET /api/preview?url=https://docs.aws.amazon.com/lambda/&forceRefresh=false&enhance=true
```

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "url": "https://docs.aws.amazon.com/lambda/",
    "title": "AWS Lambda Developer Guide",
    "description": "AWS Lambda lets you run code without provisioning or managing servers. You pay only for the compute time you consume.",
    "image": "https://docs.aws.amazon.com/lambda/latest/dg/images/lambda-logo.png",
    "siteName": "Amazon Web Services",
    "type": "website",
    "isAWSOfficial": true,
    "awsService": "Lambda",
    "awsEnhancements": {
      "serviceCategory": "Compute",
      "serviceIcon": "https://aws-icons.s3.amazonaws.com/lambda.png",
      "documentationType": "User Guide"
    },
    "cached": true,
    "source": "cache",
    "qualityScore": 95,
    "responseTime": 45,
    "previewGenerated": "2024-01-15T10:30:00.000Z"
  },
  "meta": {
    "url": "https://docs.aws.amazon.com/lambda/",
    "requestTime": "2024-01-15T10:30:00.000Z",
    "cached": true,
    "source": "cache"
  }
}
```

**エラーレスポンス**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_URL",
    "message": "無効なURL形式です"
  }
}
```

### 2. バッチプレビュー取得

複数URLのプレビューを一括で取得します。

**エンドポイント**: `POST /api/preview/batch`

**レート制限**: 15分間に20リクエスト

**リクエストボディ**:
```json
{
  "urls": [
    "https://docs.aws.amazon.com/lambda/",
    "https://github.com/aws/aws-lambda-nodejs-runtime",
    "https://stackoverflow.com/questions/tagged/aws-lambda"
  ],
  "options": {
    "forceRefresh": false,
    "enhance": true,
    "timeout": 15000
  }
}
```

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "total": 3,
    "valid": 3,
    "invalid": 0,
    "previews": [
      {
        "url": "https://docs.aws.amazon.com/lambda/",
        "title": "AWS Lambda Developer Guide",
        "description": "AWS Lambda documentation",
        "qualityScore": 95,
        "cached": true,
        "isAWSOfficial": true
      },
      {
        "url": "https://github.com/aws/aws-lambda-nodejs-runtime",
        "title": "AWS Lambda Node.js Runtime",
        "description": "Official Node.js runtime for AWS Lambda",
        "qualityScore": 88,
        "cached": false
      },
      {
        "url": "https://stackoverflow.com/questions/tagged/aws-lambda",
        "title": "AWS Lambda Questions - Stack Overflow",
        "description": "Questions about AWS Lambda development",
        "qualityScore": 75,
        "cached": true
      }
    ]
  },
  "meta": {
    "requestTime": "2024-01-15T10:30:00.000Z",
    "responseTime": 2500,
    "batchSize": 3
  }
}
```

**制限事項**:
- 一度に処理できるURLは最大10個
- 無効なURLは結果に含まれるがエラー情報付き

### 3. プレビュー品質向上

既存のプレビューデータの品質を向上させます。

**エンドポイント**: `POST /api/preview/enhance`

**レート制限**: 15分間に100リクエスト

**リクエストボディ**:
```json
{
  "preview": {
    "url": "https://example.com",
    "title": "Example Site",
    "description": "This is a very long description that might need to be optimized for better display and user experience in various contexts",
    "image": "http://example.com/image.jpg",
    "qualityScore": 60
  }
}
```

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "title": "Example Site",
    "description": "This is a very long description that might need to be optimized for better display and user experience...",
    "image": "https://example.com/image.jpg",
    "qualityScore": 85,
    "previewGenerated": "2024-01-15T10:30:00.000Z"
  },
  "meta": {
    "originalQuality": 60,
    "enhancedQuality": 85,
    "improvement": 25
  }
}
```

### 4. 統計情報取得

プレビューサービスの統計情報を取得します。

**エンドポイント**: `GET /api/preview/stats`

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "service": "URLPreviewService",
    "version": "1.0.0",
    "config": {
      "maxBatchSize": 10,
      "timeout": 15000,
      "retryAttempts": 2
    },
    "cache": {
      "totalCacheItems": 2500,
      "hitRate": 0.87,
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### 5. ヘルスチェック

プレビューサービスの稼働状況を確認します。

**エンドポイント**: `GET /api/preview/health`

**正常時のレスポンス**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "service": "URLPreviewService",
    "version": "1.0.0",
    "dependencies": {
      "cache": true,
      "metadata": true
    }
  }
}
```

**異常時のレスポンス** (HTTP 503):
```json
{
  "success": false,
  "data": {
    "status": "unhealthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "error": "Cache service unavailable"
  }
}
```

### 6. 設定情報取得

プレビューサービスの設定情報を取得します。

**エンドポイント**: `GET /api/preview/config`

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "maxBatchSize": 10,
    "timeout": 15000,
    "retryAttempts": 2,
    "cacheEnabled": true,
    "enhancementEnabled": true,
    "rateLimits": {
      "single": {
        "windowMs": 900000,
        "max": 100
      },
      "batch": {
        "windowMs": 900000,
        "max": 20
      }
    },
    "supportedFeatures": [
      "single-preview",
      "batch-preview",
      "cache-integration",
      "quality-enhancement",
      "aws-optimization",
      "rate-limiting"
    ]
  }
}
```

## プレビューデータ構造

### 基本プレビューオブジェクト

```json
{
  "url": "https://example.com",
  "title": "ページタイトル",
  "description": "ページの説明文",
  "image": "https://example.com/image.jpg",
  "siteName": "サイト名",
  "type": "website",
  "cached": false,
  "source": "fresh",
  "qualityScore": 85,
  "responseTime": 150,
  "previewGenerated": "2024-01-15T10:30:00.000Z"
}
```

### AWS特化プレビューオブジェクト

```json
{
  "url": "https://docs.aws.amazon.com/lambda/",
  "title": "AWS Lambda Developer Guide",
  "description": "AWS Lambda documentation",
  "image": "https://docs.aws.amazon.com/lambda/images/lambda-logo.png",
  "siteName": "Amazon Web Services",
  "type": "website",
  "isAWSOfficial": true,
  "awsService": "Lambda",
  "awsEnhancements": {
    "serviceCategory": "Compute",
    "serviceIcon": "https://aws-icons.s3.amazonaws.com/lambda.png",
    "documentationType": "User Guide"
  },
  "cached": true,
  "qualityScore": 95
}
```

### エラープレビューオブジェクト

```json
{
  "url": "https://invalid-site.com",
  "title": "invalid-site.com",
  "description": "プレビューを取得できませんでした",
  "error": "Connection timeout",
  "cached": false,
  "qualityScore": 0,
  "previewGenerated": "2024-01-15T10:30:00.000Z"
}
```

## 品質スコア算出

プレビューの品質は0-100のスコアで評価されます：

| 要素 | 配点 | 条件 |
|------|------|------|
| タイトル | 30点 | 存在する場合 |
| タイトル品質 | +10点 | 10-60文字の適切な長さ |
| 説明文 | 25点 | 存在する場合 |
| 説明文品質 | +10点 | 50-200文字の適切な長さ |
| 画像 | 20点 | 存在する場合 |
| サイト名 | 10点 | 存在する場合 |
| AWS特化 | +5点 | AWS公式サイトの場合 |

## キャッシュ戦略

### TTL設定

| URL種別 | TTL | 理由 |
|---------|-----|------|
| aws.amazon.com | 72時間 | 公式ドキュメントは安定 |
| github.com | 48時間 | リポジトリ情報は比較的安定 |
| stackoverflow.com | 12時間 | 質問・回答は変動する |
| その他 | 24時間 | 一般的なサイト |

### キャッシュヘッダー

- **キャッシュヒット**: `X-Cache: HIT`, `Cache-Control: public, max-age=3600`
- **キャッシュミス**: `X-Cache: MISS`, `Cache-Control: public, max-age=300`

## レート制限

### 制限値

| エンドポイント | 制限 | ウィンドウ |
|----------------|------|------------|
| 単一プレビュー | 100リクエスト | 15分 |
| バッチプレビュー | 20リクエスト | 15分 |
| その他 | 100リクエスト | 15分 |

### 制限超過時のレスポンス

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "リクエスト制限を超えました。しばらく待ってから再試行してください。"
  }
}
```

## エラーコード一覧

| コード | 説明 |
|--------|------|
| MISSING_URL | URLパラメータが必要です |
| INVALID_URL | 無効なURL形式です |
| INVALID_URLS | URL配列が必要です |
| TOO_MANY_URLS | 一度に処理できるURL数を超えています |
| INVALID_PREVIEW_DATA | プレビューデータが必要です |
| PREVIEW_ERROR | プレビューの取得に失敗しました |
| BATCH_PREVIEW_ERROR | バッチプレビューの取得に失敗しました |
| ENHANCEMENT_ERROR | プレビューの品質向上に失敗しました |
| STATS_ERROR | 統計情報の取得に失敗しました |
| CONFIG_ERROR | 設定情報の取得に失敗しました |
| RATE_LIMIT_EXCEEDED | リクエスト制限を超えました |
| BATCH_RATE_LIMIT_EXCEEDED | バッチ処理のリクエスト制限を超えました |
| INTERNAL_SERVER_ERROR | サーバー内部エラーが発生しました |

## 使用例

### JavaScript (fetch API)

```javascript
// 単一URLプレビュー
const preview = await fetch('/api/preview?url=https://example.com')
  .then(res => res.json());

// バッチプレビュー
const batchResult = await fetch('/api/preview/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    urls: [
      'https://docs.aws.amazon.com/lambda/',
      'https://github.com/aws/aws-lambda-nodejs-runtime'
    ],
    options: {
      enhance: true,
      forceRefresh: false
    }
  })
}).then(res => res.json());

// プレビュー品質向上
const enhanced = await fetch('/api/preview/enhance', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    preview: {
      url: 'https://example.com',
      title: 'Example',
      description: 'Long description...'
    }
  })
}).then(res => res.json());
```

### curl

```bash
# 単一プレビュー
curl "http://localhost:3000/api/preview?url=https://docs.aws.amazon.com/lambda/"

# バッチプレビュー
curl -X POST http://localhost:3000/api/preview/batch \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://docs.aws.amazon.com/lambda/",
      "https://github.com/aws/aws-lambda-nodejs-runtime"
    ],
    "options": {
      "enhance": true
    }
  }'

# ヘルスチェック
curl http://localhost:3000/api/preview/health

# 統計情報
curl http://localhost:3000/api/preview/stats
```

## パフォーマンス考慮事項

### 最適化戦略

1. **キャッシュ活用**: 頻繁にアクセスされるURLのキャッシュヒット率向上
2. **並行処理**: バッチ処理での並行実行
3. **リトライ機能**: 一時的な障害への対応
4. **タイムアウト制御**: 応答性の確保

### 監視指標

- **レスポンス時間**: 平均・95パーセンタイル
- **キャッシュヒット率**: 効率性の指標
- **エラー率**: 信頼性の指標
- **品質スコア分布**: プレビュー品質の傾向

## セキュリティ考慮事項

- **レート制限**: DDoS攻撃の防止
- **入力検証**: URL形式の厳密なチェック
- **タイムアウト制御**: リソース枯渇の防止
- **ログ記録**: 監査証跡の確保
- **HTTPS強制**: セキュアな通信の確保