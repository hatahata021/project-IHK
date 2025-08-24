# AWSサービスカテゴリ管理API仕様書

## 概要

AWSサービスのカテゴリ分類と管理機能を提供するAPIです。階層構造でのカテゴリ管理、サービスの自動分類、統計情報の取得などの機能を含みます。

## 基本情報

- **ベースURL**: `/api/aws-categories`
- **認証**: 必要（実装時に追加）
- **レスポンス形式**: JSON
- **文字エンコーディング**: UTF-8

## 主要機能

- **階層カテゴリ管理**: 親子関係を持つカテゴリ構造
- **サービス自動分類**: ルールベースでのサービス分類
- **多言語対応**: 日本語・英語でのカテゴリ名・説明
- **統計情報**: カテゴリ・サービスの分布統計
- **整合性チェック**: データの整合性検証
- **検索機能**: カテゴリ・サービスの検索

## エンドポイント一覧

### 1. デフォルトカテゴリ初期化

システムのデフォルトカテゴリを初期化します。

**エンドポイント**: `POST /api/aws-categories/initialize`

**レスポンス例**:
```json
{
  "success": true,
  "message": "8個のカテゴリを作成しました",
  "data": {
    "created": [
      {
        "categoryId": "cat_12345678",
        "name": "Compute",
        "nameJa": "コンピューティング",
        "color": "#FF9900",
        "displayOrder": 1
      }
    ],
    "skipped": ["Storage"],
    "errors": []
  }
}
```

### 2. カテゴリ階層構造取得

カテゴリの階層構造を取得します。

**エンドポイント**: `GET /api/aws-categories/hierarchy`

**クエリパラメータ**:
- `includeServiceCount` (optional): サービス数を含める

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "hierarchy": [
      {
        "categoryId": "cat_12345678",
        "name": "Compute",
        "nameJa": "コンピューティング",
        "description": "Virtual servers, containers, and serverless computing",
        "descriptionJa": "仮想サーバー、コンテナ、サーバーレスコンピューティング",
        "level": 0,
        "displayOrder": 1,
        "color": "#FF9900",
        "icon": "compute",
        "serviceCount": 15,
        "actualServiceCount": 15,
        "children": [
          {
            "categoryId": "cat_87654321",
            "name": "Serverless",
            "nameJa": "サーバーレス",
            "level": 1,
            "displayOrder": 1,
            "serviceCount": 5,
            "children": []
          }
        ]
      }
    ],
    "totalCategories": 12,
    "maxLevel": 2
  }
}
```

### 3. カテゴリ作成

新しいカテゴリを作成します。

**エンドポイント**: `POST /api/aws-categories`

**リクエストボディ**:
```json
{
  "name": "Mobile",
  "nameJa": "モバイル",
  "description": "Mobile app development services",
  "descriptionJa": "モバイルアプリ開発サービス",
  "parentCategoryId": null,
  "color": "#FF6B6B",
  "icon": "mobile",
  "displayOrder": 9
}
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "カテゴリを作成しました",
  "data": {
    "categoryId": "cat_12345678",
    "name": "Mobile",
    "nameJa": "モバイル",
    "description": "Mobile app development services",
    "descriptionJa": "モバイルアプリ開発サービス",
    "level": 0,
    "displayOrder": 9,
    "color": "#FF6B6B",
    "icon": "mobile",
    "serviceCount": 0,
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. カテゴリ別サービス一覧取得

指定されたカテゴリのサービス一覧を取得します。

**エンドポイント**: `GET /api/aws-categories/:categoryId/services`

**パスパラメータ**:
- `categoryId`: カテゴリID

**クエリパラメータ**:
- `sortBy` (optional): ソート方法 ('name' | 'popularity' | 'created')
- `activeOnly` (optional): アクティブなサービスのみ (default: true)

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "category": {
      "categoryId": "cat_12345678",
      "name": "Compute",
      "nameJa": "コンピューティング",
      "description": "Virtual servers and computing services",
      "color": "#FF9900",
      "icon": "compute"
    },
    "services": [
      {
        "serviceId": "svc_12345678",
        "serviceName": "EC2",
        "serviceNameJa": "EC2",
        "displayName": "Amazon Elastic Compute Cloud",
        "displayNameJa": "Amazon Elastic Compute Cloud",
        "description": "Scalable virtual servers in the cloud",
        "descriptionJa": "クラウド上のスケーラブルな仮想サーバー",
        "serviceType": "service",
        "isActive": true,
        "isNew": false,
        "popularityScore": 95,
        "documentationUrl": "https://docs.aws.amazon.com/ec2/",
        "consoleUrl": "https://console.aws.amazon.com/ec2/"
      }
    ],
    "childCategories": [
      {
        "categoryId": "cat_87654321",
        "name": "Serverless",
        "nameJa": "サーバーレス",
        "serviceCount": 5
      }
    ],
    "serviceCount": 15,
    "childCategoryCount": 1
  }
}
```

### 5. カテゴリ更新

既存のカテゴリを更新します。

**エンドポイント**: `PUT /api/aws-categories/:categoryId`

**リクエストボディ**:
```json
{
  "nameJa": "更新されたカテゴリ名",
  "descriptionJa": "更新された説明",
  "color": "#FF0000",
  "displayOrder": 5,
  "isActive": true
}
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "カテゴリを更新しました",
  "data": {
    "categoryId": "cat_12345678",
    "name": "Compute",
    "nameJa": "更新されたカテゴリ名",
    "descriptionJa": "更新された説明",
    "color": "#FF0000",
    "displayOrder": 5,
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 6. カテゴリ削除

カテゴリを削除します。

**エンドポイント**: `DELETE /api/aws-categories/:categoryId`

**制限事項**:
- 子カテゴリが存在する場合は削除不可
- サービスが割り当てられている場合は削除不可

**レスポンス例**:
```json
{
  "success": true,
  "message": "カテゴリを削除しました"
}
```

### 7. サービス割り当て

サービスをカテゴリに割り当てます。

**エンドポイント**: `POST /api/aws-categories/:categoryId/assign-service`

**リクエストボディ**:
```json
{
  "serviceId": "svc_12345678"
}
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "サービスをカテゴリに割り当てました",
  "data": {
    "serviceId": "svc_12345678",
    "categoryId": "cat_12345678",
    "oldCategoryId": "cat_87654321"
  }
}
```

### 8. カテゴリ検索

カテゴリを検索します。

**エンドポイント**: `GET /api/aws-categories/search`

**クエリパラメータ**:
- `q` (required): 検索語
- `language` (optional): 言語 ('en' | 'ja')
- `includeServiceCount` (optional): サービス数を含める

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "searchTerm": "compute",
    "language": "en",
    "resultCount": 2,
    "categories": [
      {
        "categoryId": "cat_12345678",
        "name": "Compute",
        "nameJa": "コンピューティング",
        "description": "Virtual servers and computing services",
        "actualServiceCount": 15
      }
    ]
  }
}
```

### 9. 統計情報取得

カテゴリとサービスの統計情報を取得します。

**エンドポイント**: `GET /api/aws-categories/statistics`

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "categories": {
      "totalCategories": 12,
      "activeCategories": 12,
      "inactiveCategories": 0,
      "rootCategories": 8,
      "levelDistribution": {
        "0": 8,
        "1": 4
      }
    },
    "services": {
      "totalServices": 200,
      "activeServices": 195,
      "newServices": 15,
      "previewServices": 8,
      "deprecatedServices": 2,
      "serviceTypeDistribution": {
        "service": 180,
        "feature": 15,
        "tool": 5
      }
    },
    "categoryServiceDistribution": {
      "cat_12345678": {
        "categoryName": "Compute",
        "categoryNameJa": "コンピューティング",
        "serviceCount": 25,
        "activeServices": 24,
        "newServices": 3
      }
    },
    "summary": {
      "totalCategories": 12,
      "totalServices": 200,
      "averageServicesPerCategory": 17,
      "uncategorizedServices": 5
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### 10. 未分類サービス取得

カテゴリに割り当てられていないサービスを取得します。

**エンドポイント**: `GET /api/aws-categories/uncategorized-services`

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "count": 5,
    "services": [
      {
        "serviceId": "svc_12345678",
        "serviceName": "AWS AppSync",
        "displayName": "AWS AppSync",
        "description": "Managed GraphQL service",
        "suggestedCategory": {
          "categoryId": "cat_87654321",
          "categoryName": "Mobile",
          "categoryNameJa": "モバイル"
        }
      }
    ]
  }
}
```

### 11. サービス自動分類

サービス名から推奨カテゴリを取得します。

**エンドポイント**: `POST /api/aws-categories/classify-service`

**リクエストボディ**:
```json
{
  "serviceName": "AWS Lambda"
}
```

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "serviceName": "AWS Lambda",
    "suggestedCategory": {
      "categoryId": "cat_12345678",
      "categoryName": "Compute",
      "categoryNameJa": "コンピューティング",
      "confidence": "high"
    }
  }
}
```

### 12. カテゴリ順序更新

カテゴリの表示順序を更新します。

**エンドポイント**: `PUT /api/aws-categories/order`

**リクエストボディ**:
```json
{
  "categoryOrders": [
    { "categoryId": "cat_12345678", "displayOrder": 1 },
    { "categoryId": "cat_87654321", "displayOrder": 2 },
    { "categoryId": "cat_11111111", "displayOrder": 3 }
  ]
}
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "3個のカテゴリの順序を更新しました",
  "data": {
    "updated": ["cat_12345678", "cat_87654321", "cat_11111111"],
    "errors": []
  }
}
```

### 13. 整合性チェック

カテゴリとサービスのデータ整合性をチェックします。

**エンドポイント**: `GET /api/aws-categories/validate`

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "isValid": false,
    "issues": {
      "orphanedServices": [
        {
          "serviceId": "svc_12345678",
          "serviceName": "Lambda",
          "invalidCategoryId": "cat_nonexistent"
        }
      ],
      "invalidParentReferences": [],
      "serviceCountMismatches": [
        {
          "categoryId": "cat_87654321",
          "categoryName": "Storage",
          "recordedCount": 10,
          "actualCount": 8,
          "difference": -2
        }
      ]
    },
    "summary": {
      "orphanedServices": 1,
      "invalidParentReferences": 0,
      "serviceCountMismatches": 1
    }
  },
  "message": "カテゴリの整合性に問題が見つかりました"
}
```

## データ構造

### カテゴリオブジェクト

```json
{
  "categoryId": "cat_12345678",
  "name": "Compute",
  "nameJa": "コンピューティング",
  "description": "Virtual servers, containers, and serverless computing",
  "descriptionJa": "仮想サーバー、コンテナ、サーバーレスコンピューティング",
  "parentCategoryId": null,
  "level": 0,
  "displayOrder": 1,
  "color": "#FF9900",
  "icon": "compute",
  "isActive": true,
  "serviceCount": 15,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "createdBy": "system",
  "metadata": {}
}
```

### サービスオブジェクト

```json
{
  "serviceId": "svc_12345678",
  "serviceName": "EC2",
  "serviceNameJa": "EC2",
  "displayName": "Amazon Elastic Compute Cloud",
  "displayNameJa": "Amazon Elastic Compute Cloud",
  "description": "Scalable virtual servers in the cloud",
  "descriptionJa": "クラウド上のスケーラブルな仮想サーバー",
  "categoryId": "cat_12345678",
  "subcategoryId": null,
  "serviceType": "service",
  "launchDate": "2006-08-24",
  "region": "global",
  "pricingModel": "pay-as-you-go",
  "icon": "ec2",
  "color": "#FF9900",
  "logoUrl": "https://aws-icons.s3.amazonaws.com/ec2.png",
  "documentationUrl": "https://docs.aws.amazon.com/ec2/",
  "consoleUrl": "https://console.aws.amazon.com/ec2/",
  "apiReferenceUrl": "https://docs.aws.amazon.com/AWSEC2/latest/APIReference/",
  "features": ["virtual-machines", "auto-scaling", "load-balancing"],
  "tags": ["compute", "infrastructure", "virtual-server"],
  "keywords": ["ec2", "virtual", "server", "compute"],
  "relatedServices": ["svc_87654321", "svc_11111111"],
  "popularityScore": 95,
  "usageCount": 0,
  "isActive": true,
  "isNew": false,
  "isPreview": false,
  "isDeprecated": false,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "createdBy": "system",
  "metadata": {}
}
```

## デフォルトカテゴリ

システムには以下のデフォルトカテゴリが用意されています：

| カテゴリ名 | 日本語名 | 説明 | 色 |
|------------|----------|------|-----|
| Compute | コンピューティング | 仮想サーバー、コンテナ、サーバーレス | #FF9900 |
| Storage | ストレージ | オブジェクトストレージ、ファイルシステム | #3F48CC |
| Database | データベース | リレーショナル、NoSQL、インメモリ | #C925D1 |
| Networking | ネットワーキング | VPC、ロードバランシング、CDN | #7AA116 |
| Security | セキュリティ | アイデンティティ、コンプライアンス | #D13212 |
| Analytics | アナリティクス | ビッグデータ、データレイク、BI | #8C4FFF |
| Machine Learning | 機械学習 | AIサービス、MLプラットフォーム | #01A88D |
| Management | 管理・ガバナンス | モニタリング、自動化、リソース管理 | #FF4B4B |

## 自動分類ルール

サービス名に基づく自動分類ルール：

```javascript
{
  'Compute': ['ec2', 'lambda', 'ecs', 'eks', 'fargate', 'batch', 'lightsail'],
  'Storage': ['s3', 'ebs', 'efs', 'fsx', 'glacier', 'backup'],
  'Database': ['rds', 'dynamodb', 'redshift', 'aurora', 'documentdb', 'neptune'],
  'Networking': ['vpc', 'cloudfront', 'route53', 'elb', 'api-gateway'],
  'Security': ['iam', 'cognito', 'kms', 'secrets-manager', 'waf'],
  'Analytics': ['athena', 'emr', 'kinesis', 'glue', 'quicksight'],
  'Machine Learning': ['sagemaker', 'rekognition', 'comprehend', 'translate'],
  'Management': ['cloudwatch', 'cloudformation', 'systems-manager', 'config']
}
```

## エラーコード一覧

| コード | 説明 |
|--------|------|
| MISSING_REQUIRED_FIELD | 必須フィールドが不足しています |
| CATEGORY_EXISTS | カテゴリが既に存在します |
| CATEGORY_NOT_FOUND | カテゴリが見つかりません |
| CATEGORY_IN_USE | カテゴリが使用中のため削除できません |
| RESOURCE_NOT_FOUND | リソースが見つかりません |
| MISSING_SEARCH_TERM | 検索語が必要です |
| MISSING_SERVICE_ID | サービスIDが必要です |
| MISSING_SERVICE_NAME | サービス名が必要です |
| NO_UPDATE_DATA | 更新するデータが指定されていません |
| INVALID_ORDER_DATA | カテゴリ順序データが必要です |
| INVALID_ORDER_FORMAT | カテゴリIDと表示順序が必要です |
| INITIALIZATION_ERROR | 初期化に失敗しました |
| CREATION_ERROR | 作成に失敗しました |
| UPDATE_ERROR | 更新に失敗しました |
| DELETE_ERROR | 削除に失敗しました |
| ASSIGNMENT_ERROR | 割り当てに失敗しました |
| SEARCH_ERROR | 検索に失敗しました |
| STATISTICS_ERROR | 統計情報の取得に失敗しました |
| CLASSIFICATION_ERROR | 自動分類に失敗しました |
| VALIDATION_ERROR | 整合性チェックに失敗しました |
| HIERARCHY_ERROR | 階層構造の取得に失敗しました |
| FETCH_ERROR | データ取得に失敗しました |
| ORDER_UPDATE_ERROR | 順序更新に失敗しました |
| UNCATEGORIZED_FETCH_ERROR | 未分類サービス取得に失敗しました |
| INTERNAL_SERVER_ERROR | サーバー内部エラーが発生しました |

## 使用例

### JavaScript (fetch API)

```javascript
// デフォルトカテゴリ初期化
const initResult = await fetch('/api/aws-categories/initialize', {
  method: 'POST'
}).then(res => res.json());

// 階層構造取得
const hierarchy = await fetch('/api/aws-categories/hierarchy?includeServiceCount=true')
  .then(res => res.json());

// カテゴリ作成
const newCategory = await fetch('/api/aws-categories', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'IoT',
    nameJa: 'IoT',
    description: 'Internet of Things services',
    color: '#4CAF50'
  })
}).then(res => res.json());

// サービス割り当て
const assignment = await fetch('/api/aws-categories/cat_12345678/assign-service', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    serviceId: 'svc_87654321'
  })
}).then(res => res.json());

// カテゴリ検索
const searchResult = await fetch('/api/aws-categories/search?q=compute&language=ja')
  .then(res => res.json());
```

### curl

```bash
# デフォルトカテゴリ初期化
curl -X POST http://localhost:3000/api/aws-categories/initialize

# 階層構造取得
curl "http://localhost:3000/api/aws-categories/hierarchy?includeServiceCount=true"

# カテゴリ作成
curl -X POST http://localhost:3000/api/aws-categories \
  -H "Content-Type: application/json" \
  -d '{
    "name": "IoT",
    "nameJa": "IoT",
    "description": "Internet of Things services",
    "color": "#4CAF50"
  }'

# 統計情報取得
curl http://localhost:3000/api/aws-categories/statistics

# 整合性チェック
curl http://localhost:3000/api/aws-categories/validate
```

## パフォーマンス考慮事項

### 最適化戦略

1. **階層構造キャッシュ**: 頻繁にアクセスされる階層構造のキャッシュ
2. **統計情報キャッシュ**: 重い統計計算結果のキャッシュ
3. **インデックス最適化**: DynamoDBのGSI活用
4. **バッチ処理**: 大量データ処理の最適化

### 監視指標

- **API レスポンス時間**: 平均・95パーセンタイル
- **カテゴリ階層の深さ**: 管理性の指標
- **未分類サービス数**: データ品質の指標
- **自動分類精度**: 分類システムの効果

## セキュリティ考慮事項

- **入力検証**: カテゴリ名・説明の適切な検証
- **権限管理**: カテゴリ管理権限の制御
- **監査ログ**: カテゴリ変更の記録
- **データ整合性**: 定期的な整合性チェック