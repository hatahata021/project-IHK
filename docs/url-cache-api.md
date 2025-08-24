# URLキャッシュAPI仕様書

## 概要

URLメタデータのキャッシュ管理機能を提供するAPIです。DynamoDBを使用してURLメタデータをキャッシュし、パフォーマンスの向上とコスト削減を実現します。

## 基本情報

- **ベースURL**: `/api/cache`
- **認証**: 必要（実装時に追加）
- **レスポンス形式**: JSON
- **文字エンコーディング**: UTF-8

## エンドポイント一覧

### 1. キャッシュ統計情報取得

キャッシュの統計情報を取得します。

**エンドポイント**: `GET /api/cache/stats`

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "totalCacheItems": 1250,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "config": {
      "defaultTTL": 24,
      "maxTTL": 168,
      "ttlByUrlType": {
        "aws.amazon.com": 72,
        "github.com": 48,
        "stackoverflow.com": 12,
        "default": 24
      }
    }
  }
}
```

**エラーレスポンス**:
```json
{
  "success": false,
  "error": {
    "code": "CACHE_STATS_ERROR",
    "message": "キャッシュ統計情報の取得に失敗しました",
    "details": "Database connection timeout"
  }
}
```

### 2. キャッシュ無効化

指定されたURLのキャッシュを無効化します。

**エンドポイント**: `DELETE /api/cache/invalidate`

**リクエストボディ**:
```json
{
  "url": "https://example.com/page"
}
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "キャッシュを無効化しました",
  "data": {
    "url": "https://example.com/page"
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

### 3. 一括キャッシュ無効化

複数URLのキャッシュを一括で無効化します。

**エンドポイント**: `DELETE /api/cache/bulk-invalidate`

**リクエストボディ**:
```json
{
  "urls": [
    "https://example1.com",
    "https://example2.com",
    "https://example3.com"
  ]
}
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "3件のキャッシュを無効化しました",
  "data": {
    "total": 3,
    "success": 3,
    "failure": 0
  }
}
```

**制限事項**:
- 一度に処理できるURLは最大100個
- 無効なURL形式が含まれる場合はエラー

### 4. 期限切れキャッシュクリーンアップ

期限切れのキャッシュを手動で削除します。

**エンドポイント**: `POST /api/cache/cleanup`

**レスポンス例**:
```json
{
  "success": true,
  "message": "25件の期限切れキャッシュを削除しました",
  "data": {
    "deletedCount": 25
  }
}
```

**注意事項**:
- 通常はDynamoDBのTTL機能で自動削除されます
- このエンドポイントは手動クリーンアップ用です

### 5. キャッシュ設定情報取得

キャッシュシステムの設定情報を取得します。

**エンドポイント**: `GET /api/cache/config`

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "defaultTTL": 24,
    "maxTTL": 168,
    "minTTL": 1,
    "ttlByUrlType": {
      "aws.amazon.com": 72,
      "github.com": 48,
      "stackoverflow.com": 12,
      "default": 24
    },
    "features": {
      "automaticCleanup": true,
      "bulkOperations": true,
      "statisticsTracking": true
    }
  }
}
```

### 6. ヘルスチェック

キャッシュシステムの稼働状況を確認します。

**エンドポイント**: `GET /api/cache/health`

**正常時のレスポンス**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "cacheAvailable": true,
    "details": {
      "totalCacheItems": 1250,
      "timestamp": "2024-01-15T10:30:00.000Z"
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
    "cacheAvailable": false,
    "error": "Database connection failed"
  }
}
```

## キャッシュ仕様

### TTL（Time To Live）設定

| URL種別 | TTL（時間） | 説明 |
|---------|-------------|------|
| aws.amazon.com | 72 | AWS公式ドキュメント（3日間） |
| github.com | 48 | GitHubリポジトリ（2日間） |
| stackoverflow.com | 12 | Stack Overflow（12時間） |
| その他 | 24 | 一般的なサイト（1日間） |

### キャッシュキー生成

- URLのSHA-256ハッシュ値をパーティションキーとして使用
- 同一URLは同一キーでキャッシュされる
- 大文字小文字やクエリパラメータも区別される

### キャッシュ対象外

以下の条件に該当するメタデータはキャッシュされません：

- エラーが発生したメタデータ
- 最低限の情報（title、description、image）がないメタデータ
- 動的コンテンツとマークされたメタデータ

## エラーコード一覧

| コード | 説明 |
|--------|------|
| MISSING_URL | URLが指定されていません |
| INVALID_URL | 無効なURL形式です |
| INVALID_URLS | URL配列が指定されていません |
| TOO_MANY_URLS | 一度に処理できるURL数を超えています |
| INVALID_URL_FORMAT | 無効なURL形式が含まれています |
| CACHE_NOT_FOUND | 指定されたURLのキャッシュが見つかりません |
| CACHE_STATS_ERROR | キャッシュ統計情報の取得に失敗しました |
| CACHE_INVALIDATION_ERROR | キャッシュの無効化に失敗しました |
| BULK_INVALIDATION_ERROR | 一括キャッシュ無効化に失敗しました |
| CLEANUP_ERROR | キャッシュクリーンアップに失敗しました |
| CONFIG_ERROR | キャッシュ設定の取得に失敗しました |
| INTERNAL_SERVER_ERROR | サーバー内部エラーが発生しました |

## 使用例

### JavaScript (fetch API)

```javascript
// キャッシュ統計取得
const stats = await fetch('/api/cache/stats')
  .then(res => res.json());

// キャッシュ無効化
await fetch('/api/cache/invalidate', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://example.com'
  })
});

// 一括無効化
await fetch('/api/cache/bulk-invalidate', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    urls: [
      'https://example1.com',
      'https://example2.com'
    ]
  })
});

// ヘルスチェック
const health = await fetch('/api/cache/health')
  .then(res => res.json());
```

### curl

```bash
# キャッシュ統計取得
curl -X GET http://localhost:3000/api/cache/stats

# キャッシュ無効化
curl -X DELETE http://localhost:3000/api/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# 期限切れキャッシュクリーンアップ
curl -X POST http://localhost:3000/api/cache/cleanup

# ヘルスチェック
curl -X GET http://localhost:3000/api/cache/health
```

## パフォーマンス考慮事項

### キャッシュヒット率の向上

- 適切なTTL設定により、頻繁にアクセスされるURLのキャッシュヒット率を向上
- URL種別に応じた最適なTTL設定

### DynamoDB最適化

- パーティションキーの分散によりホットパーティションを回避
- TTL機能による自動削除でストレージコストを削減
- アクセス頻度の追跡による人気コンテンツの把握

### 監視とメンテナンス

- ヘルスチェックエンドポイントによる稼働監視
- 統計情報による使用状況の把握
- 手動クリーンアップ機能による緊急時対応

## セキュリティ考慮事項

- 認証機能の実装（実装時に追加）
- レート制限の実装
- 入力値の検証とサニタイゼーション
- ログ記録による監査証跡の確保