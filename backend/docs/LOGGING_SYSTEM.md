# ログシステム仕様書

## 概要

AWSエンジニア向け多言語対応コミュニティサイトのログシステム仕様です。構造化ログ出力、CloudWatch Logs連携、パフォーマンス監視機能を提供します。

## 基本情報

- **ログ形式**: JSON構造化ログ
- **出力先**: コンソール + CloudWatch Logs
- **ログレベル**: ERROR, WARN, INFO, DEBUG
- **自動フラッシュ**: 30秒間隔またはバッファ満杯時

## ログエントリ構造

### 基本構造
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "INFO",
  "service": "multilingual-community",
  "function": "translateText",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-123",
  "message": "Translation completed successfully",
  "metadata": {
    "sourceLanguage": "ja",
    "targetLanguage": "en",
    "textLength": 50
  },
  "performance": {
    "duration": 150,
    "memoryUsage": {
      "rss": 67108864,
      "heapTotal": 29360128,
      "heapUsed": 20971520,
      "external": 1048576,
      "arrayBuffers": 524288
    }
  },
  "error": {
    "name": "TranslationError",
    "message": "Translation service unavailable",
    "stack": "Error: Translation service unavailable\n    at ..."
  }
}
```

### フィールド説明

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| timestamp | string | ✓ | ISO 8601形式のタイムスタンプ |
| level | string | ✓ | ログレベル（ERROR/WARN/INFO/DEBUG） |
| service | string | ✓ | サービス名 |
| function | string | ✓ | 呼び出し元の関数名 |
| requestId | string | - | リクエスト識別子 |
| userId | string | - | ユーザー識別子 |
| message | string | ✓ | ログメッセージ |
| metadata | object | - | 追加のメタデータ |
| performance | object | - | パフォーマンス情報 |
| error | object | - | エラー情報（エラーログのみ） |

## ログレベル

### ERROR
- システムエラー
- 例外発生
- 重要な処理失敗

### WARN
- 警告事項
- 非推奨機能の使用
- リソース不足警告

### INFO
- 一般的な情報
- 処理完了通知
- システム状態変更

### DEBUG
- デバッグ情報
- 詳細な処理フロー
- 開発時の詳細情報

## ログ種別

### 1. アクセスログ
HTTPリクエストのアクセス情報を記録

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "INFO",
  "service": "multilingual-community",
  "function": "access",
  "requestId": "req-123",
  "userId": "user-456",
  "message": "GET /api/translate 200",
  "metadata": {
    "method": "GET",
    "url": "/api/translate",
    "statusCode": 200,
    "userAgent": "Mozilla/5.0..."
  },
  "performance": {
    "duration": 150
  }
}
```

### 2. エラーログ
システムエラーと例外を記録

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "ERROR",
  "service": "multilingual-community",
  "function": "translateText",
  "requestId": "req-123",
  "userId": "user-456",
  "message": "Translation service error",
  "error": {
    "name": "TranslationError",
    "message": "Service unavailable",
    "stack": "Error: Service unavailable\n    at ..."
  },
  "metadata": {
    "sourceLanguage": "ja",
    "targetLanguage": "en"
  }
}
```

### 3. パフォーマンスログ
処理時間とリソース使用量を記録

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "INFO",
  "service": "multilingual-community",
  "function": "translateBatch",
  "requestId": "req-123",
  "userId": "user-456",
  "message": "Performance: Batch translation completed in 2500ms",
  "performance": {
    "duration": 2500,
    "memoryUsage": {
      "rss": 67108864,
      "heapTotal": 29360128,
      "heapUsed": 20971520
    }
  },
  "metadata": {
    "batchSize": 50,
    "successCount": 48,
    "errorCount": 2
  }
}
```

### 4. セキュリティログ
セキュリティ関連イベントを記録

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "WARN",
  "service": "multilingual-community",
  "function": "authMiddleware",
  "requestId": "req-123",
  "message": "Security event: Authentication failed",
  "metadata": {
    "event": "auth_failure",
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "reason": "invalid_token"
  }
}
```

### 5. ビジネスログ
ビジネスロジック関連の重要イベントを記録

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "INFO",
  "service": "multilingual-community",
  "function": "createPost",
  "requestId": "req-123",
  "userId": "user-456",
  "message": "New post created",
  "metadata": {
    "postId": "post-789",
    "categoryId": "category-ec2",
    "language": "ja",
    "hasImages": true,
    "tagCount": 3
  }
}
```

## CloudWatch Logs連携

### 設定
```typescript
// 環境変数
ENABLE_CLOUDWATCH_LOGS=true
CLOUDWATCH_LOG_GROUP=/aws/ecs/multilingual-community
CLOUDWATCH_LOG_STREAM=api-${timestamp}
AWS_REGION=ap-northeast-1
```

### ログストリーム構造
```
/aws/ecs/multilingual-community/
├── api-1704067200000/          # APIサーバーログ
├── worker-1704067200000/       # バックグラウンドワーカーログ
└── scheduler-1704067200000/    # スケジューラーログ
```

### 自動フラッシュ
- **間隔**: 30秒
- **バッファサイズ**: 100エントリ
- **最大バッファ**: 1000エントリ（メモリ保護）

## ログ管理API

### 1. ログ統計情報取得
**GET** `/api/logs/stats`

```bash
curl -X GET "https://api.example.com/api/logs/stats" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "config": {
      "serviceName": "multilingual-community",
      "environment": "production",
      "logLevel": "INFO",
      "enableCloudWatch": true,
      "enableConsole": false
    },
    "memoryUsage": {
      "rss": "64.00 MB",
      "heapTotal": "28.00 MB",
      "heapUsed": "20.00 MB"
    },
    "uptime": 3600,
    "pid": 1234,
    "version": "v18.17.0",
    "platform": "linux"
  }
}
```

### 2. ログレベル変更
**PUT** `/api/logs/level`

```bash
curl -X PUT "https://api.example.com/api/logs/level" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"level": "DEBUG"}'
```

### 3. ログ手動フラッシュ
**POST** `/api/logs/flush`

```bash
curl -X POST "https://api.example.com/api/logs/flush" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 4. ログシステムヘルスチェック
**GET** `/api/logs/health`

```bash
curl -X GET "https://api.example.com/api/logs/health"
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "checks": {
      "loggerService": true,
      "cloudWatchEnabled": true,
      "consoleEnabled": false,
      "memoryUsage": {
        "heapUsed": 20971520,
        "heapTotal": 29360128,
        "usage": "71.42%"
      }
    },
    "warnings": [],
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## 使用方法

### 基本的なログ出力

```typescript
import { logger } from '../services/loggerService';

// 情報ログ
logger.info('User logged in', { userId: 'user-123' }, requestId, userId);

// エラーログ
try {
  // 何らかの処理
} catch (error) {
  logger.error('Process failed', error, { context: 'user-login' }, requestId, userId);
}

// パフォーマンスログ
const startTime = Date.now();
// 処理実行
const duration = Date.now() - startTime;
logger.performance('Database query', duration, { query: 'SELECT * FROM users' }, requestId, userId);
```

### ミドルウェアでの自動ログ

```typescript
import { accessLogMiddleware, errorLogMiddleware } from '../middleware/logging';

// Express アプリケーションに適用
app.use(accessLogMiddleware);        // アクセスログ
app.use(errorLogMiddleware);         // エラーログ
```

### ビジネスログの記録

```typescript
import { BusinessLogger } from '../middleware/logging';

// ユーザー認証ログ
BusinessLogger.logUserAuthentication('user-123', 'email', true, requestId);

// データアクセスログ
BusinessLogger.logDataAccess('CREATE', 'posts', userId, requestId, { postId: 'post-456' });

// 翻訳処理ログ
BusinessLogger.logTranslation('ja', 'en', 100, false, 150, userId, requestId);
```

### デコレータを使用した自動ログ

```typescript
import { logExecutionTime } from '../utils/logUtils';

class TranslationService {
  @logExecutionTime
  async translateText(text: string): Promise<string> {
    // 翻訳処理
    return translatedText;
  }
}
```

## 設定

### 環境変数

| 変数名 | デフォルト値 | 説明 |
|--------|-------------|------|
| SERVICE_NAME | multilingual-community | サービス名 |
| LOG_LEVEL | INFO | ログレベル |
| ENABLE_CLOUDWATCH_LOGS | false | CloudWatch Logs有効化 |
| ENABLE_CONSOLE_LOGS | true | コンソール出力有効化 |
| CLOUDWATCH_LOG_GROUP | /aws/ecs/multilingual-community | ロググループ名 |
| CLOUDWATCH_LOG_STREAM | api-${timestamp} | ログストリーム名 |
| AWS_REGION | ap-northeast-1 | AWSリージョン |

### 動的設定変更

```typescript
import { logger } from '../services/loggerService';

// ログレベル変更
logger.updateConfig({ logLevel: LogLevel.DEBUG });

// CloudWatch Logs有効化
logger.updateConfig({ enableCloudWatch: true });

// 設定確認
const config = logger.getConfig();
console.log('Current config:', config);
```

## パフォーマンス考慮事項

### バッファリング
- ログはメモリ内でバッファリング
- 30秒間隔または100エントリで自動フラッシュ
- メモリ使用量を制限（最大1000エントリ）

### 非同期処理
- CloudWatch Logs送信は非同期
- アプリケーションのパフォーマンスに影響しない
- エラー時の適切なフォールバック

### ログレベルフィルタリング
- 設定されたレベル以下のログのみ出力
- 本番環境ではINFO以上を推奨
- デバッグ時はDEBUGレベルを使用

## セキュリティ

### 機密情報の保護
- パスワード、APIキーは自動マスク
- 個人情報の適切な匿名化
- ログ出力前のデータサニタイズ

### アクセス制御
- ログ管理APIは管理者権限必須
- CloudWatch Logsへの適切なIAM権限
- ログファイルの暗号化

### 監査ログ
- 重要な操作は必ずログ記録
- ユーザー操作の追跡可能性
- セキュリティイベントの詳細記録

## トラブルシューティング

### よくある問題

1. **CloudWatch Logs接続エラー**
   - IAM権限を確認
   - ネットワーク接続を確認
   - リージョン設定を確認

2. **メモリ使用量増加**
   - ログレベルを調整
   - バッファサイズを確認
   - 定期フラッシュの動作確認

3. **ログが出力されない**
   - ログレベル設定を確認
   - コンソール出力設定を確認
   - エラーログを確認

### デバッグ方法

```typescript
// ログ統計情報の確認
const stats = getLogStats();
console.log('Log stats:', stats);

// メモリ使用量の確認
logMemoryUsage('after-translation');

// ログレベルの一時変更
setLogLevel(LogLevel.DEBUG);
```

## 監視・アラート

### CloudWatch メトリクス
- ログエラー率
- ログ出力量
- メモリ使用量
- レスポンス時間

### アラート設定
- エラーログ急増時
- メモリ使用量90%超過時
- CloudWatch Logs送信失敗時

### ダッシュボード
- リアルタイムログ監視
- エラー傾向分析
- パフォーマンス推移
- ユーザー行動分析

## 今後の拡張予定

### 機能追加
- ログ検索・フィルタリング機能
- ログ分析・レポート機能
- 異常検知・自動アラート
- ログ保存期間管理

### パフォーマンス改善
- ログ圧縮機能
- バッチ送信最適化
- インデックス機能
- 分散ログ処理