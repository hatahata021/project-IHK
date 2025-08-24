# AWSサービスタグ管理API仕様書

## 概要

AWSサービスのタグ管理機能を提供するAPIです。柔軟なタグシステムによるサービス分類、自動タグ付け、タグベース検索、タグクラウド機能などを含みます。

## 基本情報

- **ベースURL**: `/api/aws-tags`
- **認証**: 必要（実装時に追加）
- **レスポンス形式**: JSON
- **文字エンコーディング**: UTF-8

## 主要機能

- **柔軟なタグシステム**: カテゴリ・タイプ別のタグ分類
- **自動タグ付け**: ルールベースでのサービス自動タグ付け
- **タグベース検索**: 複数タグによるサービス検索・フィルタ
- **タグクラウド**: 人気タグの可視化
- **関連タグ**: タグ間の関連性分析
- **多言語対応**: 日本語・英語でのタグ名・説明

## タグ分類システム

### カテゴリ (category)
- `technical`: 技術的な特徴
- `business`: ビジネス用途
- `general`: 一般的な特徴
- `region`: 地域・リージョン関連

### タイプ (type)
- `feature`: 機能・特徴
- `technology`: 技術・テクノロジー
- `use-case`: 用途・ユースケース
- `industry`: 業界・産業
- `architecture`: アーキテクチャパターン
- `interface`: インターフェース

## エンドポイント一覧

### 1. デフォルトタグ初期化

システムのデフォルトタグを初期化します。

**エンドポイント**: `POST /api/aws-tags/initialize`

**レスポンス例**:
```json
{
  "success": true,
  "message": "20個のタグを作成しました",
  "data": {
    "created": [
      {
        "tagId": "tag_12345678",
        "name": "serverless",
        "nameJa": "サーバーレス",
        "category": "technical",
        "type": "technology",
        "color": "#FF9900",
        "isOfficial": true
      }
    ],
    "skipped": ["container"],
    "errors": []
  }
}
```##
# 2. 全タグ取得

全タグを取得します。

**エンドポイント**: `GET /api/aws-tags`

**クエリパラメータ**:
- `category` (optional): タグカテゴリ
- `type` (optional): タグタイプ
- `isOfficial` (optional): 公式タグのみ
- `sortBy` (optional): ソート方法 ('name' | 'popularity' | 'usage')
- `activeOnly` (optional): アクティブなタグのみ (default: true)

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "tags": [
      {
        "tagId": "tag_12345678",
        "name": "serverless",
        "nameJa": "サーバーレス",
        "description": "Serverless computing services",
        "descriptionJa": "サーバーレスコンピューティングサービス",
        "category": "technical",
        "type": "technology",
        "color": "#FF9900",
        "usageCount": 25,
        "popularityScore": 85,
        "isOfficial": true,
        "aliases": ["serverless-computing", "faas"]
      }
    ],
    "totalCount": 50,
    "filters": {
      "category": "technical",
      "sortBy": "popularity"
    }
  }
}
```

### 3. タグ作成

新しいタグを作成します。

**エンドポイント**: `POST /api/aws-tags`

**リクエストボディ**:
```json
{
  "name": "edge-computing",
  "nameJa": "エッジコンピューティング",
  "description": "Edge computing services and technologies",
  "descriptionJa": "エッジコンピューティングサービスと技術",
  "category": "technical",
  "type": "technology",
  "color": "#4CAF50",
  "aliases": ["edge", "edge-compute"],
  "relatedTags": ["tag_12345678"]
}
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "タグを作成しました",
  "data": {
    "tagId": "tag_87654321",
    "name": "edge-computing",
    "nameJa": "エッジコンピューティング",
    "category": "technical",
    "type": "technology",
    "color": "#4CAF50",
    "usageCount": 0,
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```#
## 4. サービスタグ割り当て

サービスにタグを割り当てます。

**エンドポイント**: `POST /api/aws-tags/assign`

**リクエストボディ**:
```json
{
  "serviceId": "svc_12345678",
  "tagIds": ["tag_12345678", "tag_87654321", "tag_11111111"],
  "assignmentType": "manual"
}
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "2個のタグを割り当て、1個のタグを削除しました",
  "data": {
    "serviceId": "svc_12345678",
    "results": {
      "added": [
        {
          "tagId": "tag_12345678",
          "assignmentType": "manual",
          "confidence": 1.0
        }
      ],
      "removed": ["tag_old"],
      "errors": []
    }
  }
}
```

### 5. 自動タグ付け

サービスの自動タグ付けを実行します。

**エンドポイント**: `POST /api/aws-tags/auto-tag/:serviceId`

**レスポンス例**:
```json
{
  "success": true,
  "message": "3個のタグを自動割り当てしました",
  "data": {
    "assignedTags": [
      {
        "tagId": "tag_12345678",
        "assignmentType": "auto",
        "confidence": 0.9
      }
    ],
    "failedTags": [],
    "suggestedTags": [
      {
        "tagId": "tag_12345678",
        "tagName": "serverless",
        "confidence": 0.9,
        "reason": "auto-generated"
      }
    ]
  }
}
```

### 6. タグベース検索

タグを使用してサービスを検索します。

**エンドポイント**: `POST /api/aws-tags/search`

**リクエストボディ**:
```json
{
  "tagIds": ["tag_12345678", "tag_87654321"],
  "matchType": "any",
  "minMatches": 1
}
```

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "searchTags": ["tag_12345678", "tag_87654321"],
    "totalResults": 15,
    "services": [
      {
        "serviceId": "svc_12345678",
        "serviceName": "Lambda",
        "displayName": "AWS Lambda",
        "matchedTags": 2,
        "totalTags": 2,
        "matchRatio": 1.0,
        "tagRelations": [...]
      }
    ]
  }
}
```### 7.
 タグクラウド取得

タグクラウドデータを取得します。

**エンドポイント**: `GET /api/aws-tags/cloud`

**クエリパラメータ**:
- `limit` (optional): 取得件数 (default: 50)
- `minUsage` (optional): 最小使用回数 (default: 1)
- `category` (optional): カテゴリフィルタ

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "tagCloud": [
      {
        "tagId": "tag_12345678",
        "name": "serverless",
        "nameJa": "サーバーレス",
        "usageCount": 25,
        "sizeLevel": 5,
        "color": "#FF9900",
        "category": "technical",
        "type": "technology"
      }
    ],
    "totalTags": 45,
    "options": {
      "limit": 50,
      "minUsage": 1
    }
  }
}
```

### 8. 人気タグ取得

人気タグを取得します。

**エンドポイント**: `GET /api/aws-tags/popular`

**クエリパラメータ**:
- `limit` (optional): 取得件数 (default: 20)
- `category` (optional): カテゴリフィルタ

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "tags": [
      {
        "tagId": "tag_12345678",
        "name": "serverless",
        "nameJa": "サーバーレス",
        "usageCount": 25,
        "popularityScore": 85,
        "category": "technical"
      }
    ],
    "totalCount": 20,
    "limit": 20,
    "category": "all"
  }
}
```

### 9. サービスタグ一覧取得

サービスに割り当てられたタグ一覧を取得します。

**エンドポイント**: `GET /api/aws-tags/service/:serviceId`

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "service": {
      "serviceId": "svc_12345678",
      "serviceName": "Lambda",
      "displayName": "AWS Lambda"
    },
    "tags": [
      {
        "tagId": "tag_12345678",
        "name": "serverless",
        "nameJa": "サーバーレス",
        "category": "technical",
        "relation": {
          "assignmentType": "manual",
          "confidence": 1.0,
          "assignedBy": "user123",
          "createdAt": "2024-01-15T10:30:00.000Z"
        }
      }
    ],
    "tagCount": 5,
    "tagsByCategory": {
      "technical": [...],
      "business": [...]
    },
    "tagsByType": {
      "technology": [...],
      "feature": [...]
    }
  }
}
```### 1
0. 関連タグ取得

指定タグの関連タグを取得します。

**エンドポイント**: `GET /api/aws-tags/:tagId/related`

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "tagId": "tag_12345678",
    "relatedTags": [
      {
        "tagId": "tag_87654321",
        "name": "api-gateway",
        "nameJa": "APIゲートウェイ",
        "relationCount": 15,
        "relationStrength": 0.75,
        "category": "technical"
      }
    ],
    "totalCount": 8
  }
}
```

### 11. タグ統計情報取得

タグシステムの統計情報を取得します。

**エンドポイント**: `GET /api/aws-tags/statistics`

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "tags": {
      "totalTags": 100,
      "activeTags": 95,
      "officialTags": 20,
      "autoGeneratedTags": 30,
      "categoryDistribution": {
        "technical": 40,
        "business": 25,
        "general": 20,
        "region": 10
      },
      "typeDistribution": {
        "feature": 35,
        "technology": 25,
        "use-case": 20,
        "industry": 15
      },
      "totalUsage": 500,
      "averageUsage": 5.26
    },
    "relations": {
      "totalRelations": 300,
      "activeRelations": 295,
      "averageTagsPerService": 3.2,
      "averageServicesPerTag": 2.1,
      "assignmentTypeDistribution": {
        "manual": 200,
        "auto": 80,
        "suggested": 15
      }
    },
    "summary": {
      "totalTags": 100,
      "totalRelations": 300,
      "tagUtilizationRate": 5.26
    }
  }
}
```

## デフォルトタグ一覧

システムには以下のデフォルトタグが用意されています：

### 技術カテゴリ (technical)
| タグ名 | 日本語名 | タイプ | 説明 |
|--------|----------|--------|------|
| serverless | サーバーレス | technology | サーバーレスコンピューティング |
| container | コンテナ | technology | コンテナ技術 |
| microservices | マイクロサービス | architecture | マイクロサービスアーキテクチャ |
| api | API | interface | API・インターフェース |
| database | データベース | technology | データベース技術 |
| storage | ストレージ | technology | ストレージ技術 |
| networking | ネットワーキング | technology | ネットワーク技術 |
| security | セキュリティ | feature | セキュリティ機能 |

### ビジネスカテゴリ (business)
| タグ名 | 日本語名 | タイプ | 説明 |
|--------|----------|--------|------|
| web-application | Webアプリケーション | use-case | Webアプリケーション開発 |
| mobile-app | モバイルアプリ | use-case | モバイルアプリ開発 |
| data-analytics | データ分析 | use-case | データ分析・BI |
| machine-learning | 機械学習 | use-case | 機械学習・AI |
| iot | IoT | use-case | IoT・デバイス連携 |
| gaming | ゲーミング | industry | ゲーム業界 |

### 一般カテゴリ (general)
| タグ名 | 日本語名 | タイプ | 説明 |
|--------|----------|--------|------|
| managed | マネージド | feature | マネージドサービス |
| scalable | スケーラブル | feature | スケーラビリティ |
| high-availability | 高可用性 | feature | 高可用性 |
| cost-effective | コスト効率 | feature | コスト効率性 |
| real-time | リアルタイム | feature | リアルタイム処理 |

### 地域カテゴリ (region)
| タグ名 | 日本語名 | タイプ | 説明 |
|--------|----------|--------|------|
| global | グローバル | feature | グローバルサービス |## 自動タグ付けルー
ル

サービス名と説明文に基づく自動タグ付けルール：

### サービス名ベース
```javascript
{
  'lambda': ['serverless', 'compute', 'event-driven'],
  'ec2': ['compute', 'virtual-machine', 'scalable'],
  's3': ['storage', 'object-storage', 'scalable'],
  'rds': ['database', 'managed', 'relational'],
  'dynamodb': ['database', 'nosql', 'managed', 'serverless'],
  'api-gateway': ['api', 'managed', 'serverless'],
  'cloudfront': ['cdn', 'global', 'performance'],
  'ecs': ['container', 'managed', 'scalable'],
  'eks': ['kubernetes', 'container', 'managed']
}
```

### 説明文ベース
```javascript
{
  'serverless': ['serverless', 'event-driven'],
  'container': ['container', 'docker'],
  'kubernetes': ['kubernetes', 'container'],
  'machine learning': ['machine-learning', 'ai'],
  'real-time': ['real-time', 'streaming'],
  'analytics': ['data-analytics', 'big-data'],
  'mobile': ['mobile-app', 'mobile'],
  'iot': ['iot', 'device'],
  'gaming': ['gaming', 'game']
}
```

## エラーコード一覧

| コード | 説明 |
|--------|------|
| MISSING_REQUIRED_FIELD | 必須フィールドが不足しています |
| TAG_EXISTS | タグが既に存在します |
| TAG_NOT_FOUND | タグが見つかりません |
| TAG_IN_USE | タグが使用中のため削除できません |
| SERVICE_NOT_FOUND | サービスが見つかりません |
| RESOURCE_NOT_FOUND | リソースが見つかりません |
| MISSING_REQUIRED_FIELDS | 必須フィールドが不足しています |
| MISSING_TAG_IDS | タグID配列が必要です |
| MISSING_SEARCH_TERM | 検索語が必要です |
| NO_UPDATE_DATA | 更新するデータが指定されていません |
| INITIALIZATION_ERROR | 初期化に失敗しました |
| CREATION_ERROR | 作成に失敗しました |
| UPDATE_ERROR | 更新に失敗しました |
| DELETE_ERROR | 削除に失敗しました |
| ASSIGNMENT_ERROR | 割り当てに失敗しました |
| AUTO_TAG_ERROR | 自動タグ付けに失敗しました |
| SEARCH_ERROR | 検索に失敗しました |
| FETCH_ERROR | データ取得に失敗しました |
| POPULAR_TAGS_ERROR | 人気タグの取得に失敗しました |
| TAG_CLOUD_ERROR | タグクラウドの取得に失敗しました |
| RELATED_TAGS_ERROR | 関連タグの取得に失敗しました |
| STATISTICS_ERROR | 統計情報の取得に失敗しました |
| VALIDATION_ERROR | 整合性チェックに失敗しました |
| INTERNAL_SERVER_ERROR | サーバー内部エラーが発生しました |

## 使用例

### JavaScript (fetch API)

```javascript
// デフォルトタグ初期化
const initResult = await fetch('/api/aws-tags/initialize', {
  method: 'POST'
}).then(res => res.json());

// タグ作成
const newTag = await fetch('/api/aws-tags', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'edge-computing',
    nameJa: 'エッジコンピューティング',
    category: 'technical',
    type: 'technology'
  })
}).then(res => res.json());

// サービスにタグ割り当て
const assignment = await fetch('/api/aws-tags/assign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceId: 'svc_12345678',
    tagIds: ['tag_12345678', 'tag_87654321']
  })
}).then(res => res.json());

// タグベース検索
const searchResult = await fetch('/api/aws-tags/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tagIds: ['tag_12345678', 'tag_87654321'],
    matchType: 'any'
  })
}).then(res => res.json());
```

## パフォーマンス考慮事項

### 最適化戦略

1. **タグクラウドキャッシュ**: 人気タグデータのキャッシュ
2. **関連タグ計算**: バックグラウンドでの関連度計算
3. **自動タグ付け**: バッチ処理での効率化
4. **検索インデックス**: DynamoDBのGSI活用

### 監視指標

- **タグ使用率**: アクティブタグの使用状況
- **自動タグ精度**: 自動タグ付けの精度
- **検索パフォーマンス**: タグベース検索の応答時間
- **関連タグ品質**: 関連タグの適切性

## セキュリティ考慮事項

- **入力検証**: タグ名・説明の適切な検証
- **権限管理**: タグ管理権限の制御
- **監査ログ**: タグ変更の記録
- **データ整合性**: 定期的な整合性チェック