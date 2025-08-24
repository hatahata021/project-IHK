# URLメタデータAPI仕様書

## 概要

URLメタデータAPIは、投稿に含まれるURLから自動的にプレビュー情報を取得する機能を提供します。Open Graphプロトコルに対応し、AWS公式ドキュメントの特別処理も含みます。

## 機能

### 主要機能
- **Open Graphメタデータ抽出**: タイトル、説明、画像、サイト名の取得
- **Twitter Cardサポート**: Twitter Card形式のメタデータにも対応
- **AWS特化機能**: AWS公式URLの特別処理とサービス名抽出
- **フォールバック処理**: エラー時の代替メタデータ生成
- **バッチ処理**: 複数URLの並行処理
- **キャッシュ対応**: コンテンツハッシュによるキャッシュキー生成

### セキュリティ機能
- **レート制限**: 過度なリクエストを防止
- **URL検証**: 有効なHTTP/HTTPSのURLのみ受け付け
- **タイムアウト制御**: 長時間のリクエストを防止
- **コンテンツサイズ制限**: 大きすぎるレスポンスを制限

## API エンドポイント

### 1. 単一URLメタデータ取得

```http
GET /api/url-metadata?url={url}
```

#### パラメータ
| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| url | string | ✓ | 取得対象のURL（HTTP/HTTPS） |

#### レスポンス例

**成功時（200 OK）:**
```json
{
  "success": true,
  "data": {
    "url": "https://docs.aws.amazon.com/ec2/",
    "metadata": {
      "title": "Amazon EC2 Documentation",
      "description": "Amazon EC2の公式ドキュメント",
      "imageUrl": "https://aws.amazon.com/favicon.ico",
      "siteName": "AWS Documentation",
      "type": "website",
      "url": "https://docs.aws.amazon.com/ec2/",
      "isAwsOfficial": true,
      "awsService": "EC2",
      "contentHash": "abc123..."
    },
    "extractedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**エラー時（400 Bad Request）:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_URL",
    "message": "有効なURL形式ではありません",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req-123"
  }
}
```

### 2. バッチURLメタデータ取得

```http
POST /api/url-metadata/batch
```

#### リクエストボディ
```json
{
  "urls": [
    "https://docs.aws.amazon.com/ec2/",
    "https://docs.aws.amazon.com/lambda/",
    "https://example.com"
  ]
}
```

#### レスポンス例

**成功時（200 OK）:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "url": "https://docs.aws.amazon.com/ec2/",
        "metadata": {
          "title": "Amazon EC2 Documentation",
          "description": "Amazon EC2の公式ドキュメント",
          "isAwsOfficial": true,
          "awsService": "EC2",
          "contentHash": "abc123..."
        }
      },
      {
        "url": "https://docs.aws.amazon.com/lambda/",
        "metadata": {
          "title": "AWS Lambda Documentation",
          "description": "AWS Lambdaの公式ドキュメント",
          "isAwsOfficial": true,
          "awsService": "LAMBDA",
          "contentHash": "def456..."
        }
      },
      {
        "url": "https://example.com",
        "metadata": {
          "title": "Example Site",
          "description": "Example description",
          "contentHash": "ghi789..."
        }
      }
    ],
    "extractedAt": "2024-01-01T12:00:00.000Z",
    "totalCount": 3
  }
}
```

### 3. AWSサービス情報取得

```http
GET /api/url-metadata/aws-service?url={url}
```

#### レスポンス例

**AWS公式URL（200 OK）:**
```json
{
  "success": true,
  "data": {
    "url": "https://docs.aws.amazon.com/ec2/",
    "isAwsOfficial": true,
    "awsService": "EC2"
  }
}
```

**非AWS URL（200 OK）:**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "isAwsOfficial": false,
    "awsService": null
  }
}
```

### 4. ヘルスチェック

```http
GET /api/url-metadata/health
```

#### レスポンス例

**正常時（200 OK）:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "responseTime": "250ms",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**異常時（503 Service Unavailable）:**
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNHEALTHY",
    "message": "URLメタデータサービスが利用できません",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req-123"
  }
}
```

## エラーコード

| コード | HTTPステータス | 説明 |
|--------|---------------|------|
| MISSING_URL | 400 | URLパラメータが不足 |
| INVALID_URL | 400 | 無効なURL形式 |
| INVALID_URLS_ARRAY | 400 | urls配列が無効 |
| TOO_MANY_URLS | 400 | URL数が上限を超過（最大10個） |
| EMPTY_URLS_ARRAY | 400 | 空のURL配列 |
| INVALID_URLS | 400 | 無効なURLが配列に含まれる |
| RATE_LIMIT_EXCEEDED | 429 | レート制限超過 |
| BATCH_RATE_LIMIT_EXCEEDED | 429 | バッチ処理のレート制限超過 |
| METADATA_EXTRACTION_ERROR | 500 | メタデータ取得エラー |
| BATCH_METADATA_EXTRACTION_ERROR | 500 | バッチメタデータ取得エラー |
| AWS_SERVICE_INFO_ERROR | 500 | AWSサービス情報取得エラー |
| SERVICE_UNHEALTHY | 503 | サービス利用不可 |

## レート制限

### 通常のメタデータ取得
- **制限**: 15分間に100リクエスト
- **対象**: GET /api/url-metadata, GET /api/url-metadata/aws-service

### バッチ処理
- **制限**: 15分間に20リクエスト
- **対象**: POST /api/url-metadata/batch

## 認証

全てのエンドポイント（ヘルスチェックを除く）でJWTトークンによる認証が必要です。

```http
Authorization: Bearer <jwt-token>
```

## 使用例

### JavaScript/Node.js

```javascript
// 単一URLのメタデータ取得
const response = await fetch('/api/url-metadata?url=https://docs.aws.amazon.com/ec2/', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data.data.metadata);

// バッチ処理
const batchResponse = await fetch('/api/url-metadata/batch', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    urls: [
      'https://docs.aws.amazon.com/ec2/',
      'https://docs.aws.amazon.com/lambda/'
    ]
  })
});

const batchData = await batchResponse.json();
console.log(batchData.data.results);
```

### React Hook例

```javascript
import { useState, useEffect } from 'react';

const useUrlMetadata = (url) => {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) return;

    const fetchMetadata = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/url-metadata?url=${encodeURIComponent(url)}`, {
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        
        if (data.success) {
          setMetadata(data.data.metadata);
        } else {
          setError(data.error.message);
        }
      } catch (err) {
        setError('メタデータの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [url]);

  return { metadata, loading, error };
};
```

## パフォーマンス考慮事項

### タイムアウト設定
- **HTTPリクエスト**: 10秒
- **最大コンテンツサイズ**: 5MB

### キャッシュ戦略
- コンテンツハッシュを使用してキャッシュキーを生成
- 同じURL+メタデータの組み合わせは同じハッシュを生成
- 外部キャッシュシステム（Redis等）との連携を想定

### エラーハンドリング
- ネットワークエラー時はフォールバックメタデータを返却
- 部分的な失敗でも利用可能な情報は返却
- 詳細なエラーログを記録

## セキュリティ考慮事項

### SSRF対策
- 内部IPアドレスへのアクセス制限（今後実装予定）
- プライベートネットワークへのアクセス制限

### データ検証
- 取得したHTMLコンテンツのサニタイゼーション
- メタデータの長さ制限
- 悪意のあるコンテンツの検出

### プライバシー保護
- User-Agentでボット識別
- robots.txtの尊重（今後実装予定）
- 取得データの適切な保持期間設定