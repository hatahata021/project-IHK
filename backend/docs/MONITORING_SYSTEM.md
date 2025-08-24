# 監視システム仕様書

## 概要

AWSエンジニア向け多言語対応コミュニティサイトの監視システム仕様です。CloudWatch メトリクス送信、システムリソース監視、アラート機能を提供します。

## 基本情報

- **メトリクス送信先**: Amazon CloudWatch
- **アラート通知**: Amazon SNS
- **監視間隔**: 60秒（設定可能）
- **アラート閾値**: CPU 80%, メモリ 85%, ディスク 90%

## 監視対象メトリクス

### システムメトリクス

#### CPU メトリクス
- **CPUUtilization**: CPU使用率（%）
- **LoadAverage1m**: 1分間のロードアベレージ

#### メモリメトリクス
- **MemoryUtilization**: メモリ使用率（%）
- **MemoryUsed**: 使用メモリ量（Bytes）

#### ディスクメトリクス
- **DiskUtilization**: ディスク使用率（%）

#### プロセスメトリクス
- **HeapUtilization**: ヒープメモリ使用率（%）
- **ProcessUptime**: プロセス稼働時間（秒）

#### アプリケーションメトリクス
- **RequestCount**: リクエスト数
- **ErrorRate**: エラー率（%）

### カスタムメトリクス

#### エンドポイント使用量
- **endpoint.{METHOD} {PATH}.count**: エンドポイント呼び出し回数
- **endpoint.{METHOD} {PATH}.duration**: エンドポイント平均レスポンス時間
- **endpoint.{METHOD} {PATH}.status.{STATUS}**: ステータスコード別カウント

## CloudWatch 設定

### メトリクス送信設定

```typescript
// 環境変数
ENABLE_CLOUDWATCH_METRICS=true
CLOUDWATCH_NAMESPACE=MultilingualCommunity
METRICS_INTERVAL=60
AWS_REGION=ap-northeast-1
```

### ディメンション構造

```json
{
  "Service": "multilingual-community",
  "Environment": "production",
  "InstanceId": "hostname-pid"
}
```

### メトリクス例

```json
{
  "MetricName": "CPUUtilization",
  "Value": 75.5,
  "Unit": "Percent",
  "Timestamp": "2024-01-01T12:00:00.000Z",
  "Dimensions": [
    { "Name": "Service", "Value": "multilingual-community" },
    { "Name": "Environment", "Value": "production" },
    { "Name": "InstanceId", "Value": "web-server-1234" }
  ]
}
```

## アラート機能

### アラート設定

```typescript
// 環境変数
ENABLE_ALERTS=true
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
DISK_THRESHOLD=90
ERROR_RATE_THRESHOLD=5
SNS_TOPIC_ARN=arn:aws:sns:ap-northeast-1:123456789012:alerts
ALERT_COOLDOWN=300
```

### アラート種別

#### CPU アラート
- **警告**: CPU使用率 > 80%
- **重大**: CPU使用率 > 95%

#### メモリアラート
- **警告**: メモリ使用率 > 85%
- **重大**: メモリ使用率 > 95%

#### ディスクアラート
- **警告**: ディスク使用率 > 90%
- **重大**: ディスク使用率 > 98%

#### エラー率アラート
- **警告**: エラー率 > 5%
- **重大**: エラー率 > 20%

### アラート通知形式

```json
{
  "service": "multilingual-community",
  "environment": "production",
  "alert": {
    "type": "cpu",
    "severity": "warning",
    "message": "CPU使用率が高くなっています: 85.2%",
    "value": 85.2,
    "threshold": 80,
    "timestamp": "2024-01-01T12:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z",
  "hostname": "web-server-01",
  "pid": 1234
}
```

## 監視API

### 1. システムメトリクス取得
**GET** `/api/monitoring/metrics`

```bash
curl -X GET "https://api.example.com/api/monitoring/metrics" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "system": {
      "cpu": {
        "usage": 45.2,
        "loadAverage": [1.5, 1.2, 1.0]
      },
      "memory": {
        "total": 8589934592,
        "used": 3221225472,
        "free": 5368709120,
        "usage": 37.5
      },
      "disk": {
        "total": 107374182400,
        "used": 32212254720,
        "free": 75161927680,
        "usage": 30.0
      },
      "process": {
        "heapTotal": 29360128,
        "heapUsed": 20971520,
        "heapUsage": 71.4,
        "uptime": 3600,
        "pid": 1234
      }
    },
    "custom": {
      "endpoint.GET /api/translate.count": 150,
      "endpoint.GET /api/translate.duration": 2250,
      "endpoint.GET /api/translate.status.200": 145,
      "endpoint.GET /api/translate.status.400": 5
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### 2. 監視設定取得
**GET** `/api/monitoring/config`

```bash
curl -X GET "https://api.example.com/api/monitoring/config" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "monitoring": {
      "serviceName": "multilingual-community",
      "environment": "production",
      "enableCloudWatch": true,
      "enableAlerts": true,
      "metricsInterval": 60,
      "region": "ap-northeast-1",
      "namespace": "MultilingualCommunity"
    },
    "alerts": {
      "enabled": true,
      "thresholds": {
        "cpuUsage": 80,
        "memoryUsage": 85,
        "diskUsage": 90,
        "errorRate": 5
      },
      "snsTopicArn": "arn:aws:sns:ap-northeast-1:123456789012:alerts",
      "cooldownPeriod": 300
    }
  }
}
```

### 3. 監視設定更新
**PUT** `/api/monitoring/config`

```bash
curl -X PUT "https://api.example.com/api/monitoring/config" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "monitoring": {
      "enableCloudWatch": true,
      "metricsInterval": 30
    },
    "alerts": {
      "enabled": true,
      "thresholds": {
        "cpuUsage": 85,
        "memoryUsage": 90
      }
    }
  }'
```

### 4. 監視ヘルスチェック
**GET** `/api/monitoring/health`

```bash
curl -X GET "https://api.example.com/api/monitoring/health"
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "message": "All systems operating normally",
    "metrics": {
      "cpu": { "usage": 45.2 },
      "memory": { "usage": 37.5 },
      "disk": { "usage": 30.0 }
    }
  }
}
```

### 5. 監視統計情報
**GET** `/api/monitoring/stats`

```bash
curl -X GET "https://api.example.com/api/monitoring/stats" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 6. テストアラート送信
**POST** `/api/monitoring/test-alert`

```bash
curl -X POST "https://api.example.com/api/monitoring/test-alert" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "cpu",
    "severity": "warning",
    "message": "Test CPU alert"
  }'
```

## 使用方法

### 基本的な監視設定

```typescript
import { monitoringService } from '../services/monitoringService';

// 現在のメトリクスを取得
const metrics = await monitoringService.getCurrentMetrics();
console.log('CPU Usage:', metrics.cpu.usage);

// 設定を更新
monitoringService.updateConfig({
  enableCloudWatch: true,
  metricsInterval: 30,
  alerts: {
    enabled: true,
    thresholds: {
      cpuUsage: 85,
      memoryUsage: 90
    }
  }
});
```

### ミドルウェアでの自動監視

```typescript
import { 
  monitoringMiddleware, 
  resourceMonitoringMiddleware,
  CustomMetricsCollector 
} from '../middleware/monitoring';

// Express アプリケーションに適用
app.use(monitoringMiddleware);                    // リクエスト/エラー数カウント
app.use(resourceMonitoringMiddleware(2000));      // 重いリクエスト検出
app.use(CustomMetricsCollector.endpointUsageMiddleware); // エンドポイント使用量記録
```

### カスタムメトリクスの記録

```typescript
import { CustomMetricsCollector } from '../middleware/monitoring';

// カスタムメトリクスを記録
CustomMetricsCollector.recordMetric('translation.count', 1);
CustomMetricsCollector.recordMetric('translation.duration', 150);
CustomMetricsCollector.recordMetric('cache.hit', 1);

// メトリクスを取得
const metrics = CustomMetricsCollector.getMetrics();
console.log('Translation count:', metrics['translation.count']);
```

### 定期レポート

```typescript
import { MonitoringReporter } from '../middleware/monitoring';

// 5分間隔で定期レポートを開始
MonitoringReporter.startPeriodicReporting(5);

// レポートを停止
MonitoringReporter.stopPeriodicReporting();
```

## 設定

### 環境変数

| 変数名 | デフォルト値 | 説明 |
|--------|-------------|------|
| ENABLE_CLOUDWATCH_METRICS | false | CloudWatch メトリクス送信有効化 |
| ENABLE_ALERTS | false | アラート機能有効化 |
| METRICS_INTERVAL | 60 | メトリクス収集間隔（秒） |
| CLOUDWATCH_NAMESPACE | MultilingualCommunity | CloudWatch 名前空間 |
| CPU_THRESHOLD | 80 | CPU使用率アラート閾値（%） |
| MEMORY_THRESHOLD | 85 | メモリ使用率アラート閾値（%） |
| DISK_THRESHOLD | 90 | ディスク使用率アラート閾値（%） |
| ERROR_RATE_THRESHOLD | 5 | エラー率アラート閾値（%） |
| SNS_TOPIC_ARN | - | SNS トピック ARN |
| ALERT_COOLDOWN | 300 | アラートクールダウン期間（秒） |

### 動的設定変更

```typescript
// 監視間隔を変更
monitoringService.updateConfig({ metricsInterval: 30 });

// アラート閾値を変更
monitoringService.updateConfig({
  alerts: {
    thresholds: {
      cpuUsage: 90,
      memoryUsage: 95
    }
  }
});
```

## CloudWatch ダッシュボード

### 推奨ウィジェット

#### システムリソース監視
```json
{
  "type": "metric",
  "properties": {
    "metrics": [
      ["MultilingualCommunity", "CPUUtilization", "Service", "multilingual-community"],
      [".", "MemoryUtilization", ".", "."],
      [".", "DiskUtilization", ".", "."]
    ],
    "period": 300,
    "stat": "Average",
    "region": "ap-northeast-1",
    "title": "System Resource Usage"
  }
}
```

#### アプリケーション監視
```json
{
  "type": "metric",
  "properties": {
    "metrics": [
      ["MultilingualCommunity", "RequestCount", "Service", "multilingual-community"],
      [".", "ErrorRate", ".", "."]
    ],
    "period": 300,
    "stat": "Sum",
    "region": "ap-northeast-1",
    "title": "Application Metrics"
  }
}
```

## アラート設定

### CloudWatch アラーム例

#### CPU使用率アラーム
```json
{
  "AlarmName": "HighCPUUtilization",
  "ComparisonOperator": "GreaterThanThreshold",
  "EvaluationPeriods": 2,
  "MetricName": "CPUUtilization",
  "Namespace": "MultilingualCommunity",
  "Period": 300,
  "Statistic": "Average",
  "Threshold": 80.0,
  "ActionsEnabled": true,
  "AlarmActions": [
    "arn:aws:sns:ap-northeast-1:123456789012:cpu-alerts"
  ],
  "AlarmDescription": "CPU使用率が80%を超えています",
  "Dimensions": [
    {
      "Name": "Service",
      "Value": "multilingual-community"
    }
  ]
}
```

#### エラー率アラーム
```json
{
  "AlarmName": "HighErrorRate",
  "ComparisonOperator": "GreaterThanThreshold",
  "EvaluationPeriods": 1,
  "MetricName": "ErrorRate",
  "Namespace": "MultilingualCommunity",
  "Period": 300,
  "Statistic": "Average",
  "Threshold": 5.0,
  "ActionsEnabled": true,
  "AlarmActions": [
    "arn:aws:sns:ap-northeast-1:123456789012:error-alerts"
  ],
  "AlarmDescription": "エラー率が5%を超えています"
}
```

## トラブルシューティング

### よくある問題

1. **CloudWatch メトリクス送信エラー**
   - IAM権限を確認
   - ネットワーク接続を確認
   - リージョン設定を確認

2. **アラートが送信されない**
   - SNS トピック ARN を確認
   - SNS 権限を確認
   - アラート設定を確認

3. **メトリクス収集エラー**
   - システムリソースアクセス権限を確認
   - ディスク容量を確認
   - プロセス権限を確認

### デバッグ方法

```typescript
// 現在の設定を確認
const config = monitoringService.getConfig();
console.log('Monitoring config:', config);

// ヘルスチェックを実行
const health = await monitoringService.healthCheck();
console.log('Health status:', health);

// 手動でメトリクスを収集
const metrics = await monitoringService.getCurrentMetrics();
console.log('Current metrics:', metrics);
```

## セキュリティ

### IAM 権限

#### CloudWatch メトリクス送信
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData"
      ],
      "Resource": "*"
    }
  ]
}
```

#### SNS アラート送信
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "arn:aws:sns:ap-northeast-1:123456789012:alerts"
    }
  ]
}
```

### アクセス制御
- 監視API は管理者権限必須
- ヘルスチェックのみ認証不要
- 適切なレート制限を適用

## パフォーマンス考慮事項

### メトリクス収集
- 非同期処理でアプリケーションに影響しない
- バッファリングで効率的な送信
- エラー時の適切なフォールバック

### リソース使用量
- CPU使用率計算は軽量な実装
- メモリ使用量監視はオーバーヘッド最小
- ディスク I/O は最小限に抑制

### アラート制御
- クールダウン期間でスパム防止
- 重要度に応じた通知頻度調整
- バッチ処理で効率的な通知

## 今後の拡張予定

### 機能追加
- カスタムダッシュボード作成
- 異常検知機能
- 予測アラート機能
- ログ分析連携

### 監視対象拡張
- データベース監視
- 外部API監視
- ネットワーク監視
- セキュリティ監視