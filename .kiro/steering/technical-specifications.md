---
inclusion: always
---

# 技術仕様参照

## プロジェクト仕様書
実装時は必ず以下の仕様書を参照してください：

### 要件定義
#[[file:.kiro/specs/multilingual-aws-community/requirements.md]]

### 設計書
#[[file:.kiro/specs/multilingual-aws-community/design.md]]

### 実装計画
#[[file:.kiro/specs/multilingual-aws-community/tasks.md]]

## 技術スタック

### フロントエンド
- **フレームワーク**: React 18 + Next.js 14
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand または Context API
- **テスト**: Jest + React Testing Library

### バックエンド
- **フレームワーク**: Node.js + Express
- **言語**: TypeScript
- **データベース**: Amazon DynamoDB
- **認証**: Amazon Cognito
- **ファイルストレージ**: Amazon S3
- **翻訳**: Amazon Translate

### インフラ
- **コンテナ**: Docker + ECS Fargate
- **ロードバランサー**: Application Load Balancer
- **監視**: CloudWatch
- **CI/CD**: GitHub Actions

## 開発環境設定

### 必須ツール
- Node.js 18以上
- Docker Desktop
- AWS CLI
- Git
- **git-secrets（必須）**: 秘匿情報の誤コミット防止

### 環境変数
```bash
# 基本設定（Parameter Store管理）
NODE_ENV=development
AWS_REGION=ap-northeast-1

# AWS認証（IAMロール使用推奨）
AWS_ACCESS_KEY_ID=[YOUR_AWS_ACCESS_KEY]
AWS_SECRET_ACCESS_KEY=[YOUR_AWS_SECRET_KEY]

# 非機密設定（Parameter Store管理）
DYNAMODB_ENDPOINT=http://localhost:8000
S3_BUCKET_NAME=[YOUR_BUCKET_NAME]
TRANSLATE_SERVICE_REGION=ap-northeast-1

# 開発用設定
DEBUG=true
LOG_LEVEL=debug
```

### AWS Secrets Manager管理対象
以下の機密情報はSecrets Managerで管理：

```typescript
// データベース認証情報
interface DatabaseSecret {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname: string;
}

// Cognito設定
interface CognitoSecret {
  userPoolId: string;
  clientId: string;
  clientSecret: string;
}

// 外部API認証情報
interface ExternalAPISecrets {
  githubToken: string;
  twitterApiKey: string;
  twitterApiSecret: string;
  linkedinClientId: string;
  linkedinClientSecret: string;
}

// JWT署名キー
interface JWTSecret {
  signingKey: string;
  refreshKey: string;
}

// メール設定
interface EmailSecret {
  smtpHost: string;
  smtpUser: string;
  smtpPassword: string;
}
```

### Parameter Store管理対象
```
/multilingual-community/prod/app/region
/multilingual-community/prod/app/log-level
/multilingual-community/prod/dynamodb/table-prefix
/multilingual-community/prod/s3/bucket-name
/multilingual-community/prod/translate/source-languages
```

## コーディング標準

### TypeScript設定
- strict mode有効
- noImplicitAny: true
- strictNullChecks: true

### ESLint/Prettier設定
- Airbnb設定ベース
- 日本語コメント許可
- セミコロン必須

### ファイル命名規則
- コンポーネント: PascalCase (UserProfile.tsx)
- ユーティリティ: camelCase (formatDate.ts)
- 定数: UPPER_SNAKE_CASE (API_ENDPOINTS.ts)

## API設計原則

### RESTful API
- GET: データ取得
- POST: データ作成
- PUT: データ更新（全体）
- PATCH: データ更新（部分）
- DELETE: データ削除

### レスポンス形式
```typescript
// 成功時
{
  success: true,
  data: any,
  message?: string
}

// エラー時
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```

### エラーコード
- 400: Bad Request (入力値エラー)
- 401: Unauthorized (認証エラー)
- 403: Forbidden (権限エラー)
- 404: Not Found (リソース未発見)
- 500: Internal Server Error (サーバーエラー)

## データベース設計原則

### DynamoDB
- パーティションキーの設計を慎重に行う
- ホットパーティションを避ける
- GSIを効果的に活用
- 項目サイズは400KB以下

### データ型
- 文字列: S
- 数値: N
- バイナリ: B
- リスト: L
- マップ: M

## セキュリティ要件

### 認証・認可
- JWTトークンの適切な検証
- CORS設定の最適化
- レート制限の実装

### データ保護
- 個人情報の暗号化
- SQLインジェクション対策
- XSS対策

## パフォーマンス要件

### フロントエンド
- First Contentful Paint < 2秒
- Largest Contentful Paint < 3秒
- 画像の最適化（WebP使用）

### バックエンド
- API レスポンス時間 < 500ms
- データベースクエリ最適化
- キャッシュ戦略の実装

## 多言語対応

### サポート言語
- 日本語 (ja)
- 英語 (en)
- 中国語 (zh)
- 韓国語 (ko)
- その他（設定で追加可能）

### 翻訳方針
- ユーザー投稿: Amazon Translate使用
- UI文言: i18n対応
- 翻訳キャッシュでコスト最適化