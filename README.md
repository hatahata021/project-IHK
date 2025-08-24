# AWS Engineers Community

AWSエンジニア向け多言語対応コミュニティサイト

## 🌟 概要

言語の壁を意識することなく、世界中のAWSエンジニアがフォーラム形式でやり取りできるWebシステムです。ユーザーが投稿した内容は自動的に各ユーザーの設定言語に翻訳されて表示され、画像やURLプレビューなどのリッチコンテンツにも対応します。

## 🏗️ アーキテクチャ

- **フロントエンド**: React/Next.js + TypeScript + Tailwind CSS
- **バックエンド**: Node.js/Express + TypeScript
- **データベース**: Amazon DynamoDB
- **認証**: Amazon Cognito
- **翻訳**: Amazon Translate
- **ファイルストレージ**: Amazon S3
- **インフラ**: AWS ECS Fargate
- **シークレット管理**: AWS Secrets Manager

## 🚀 開発環境セットアップ

### 前提条件

- Node.js 18以上
- Docker Desktop
- AWS CLI
- Git

### 1. リポジトリのクローン

```bash
git clone https://github.com/hatahata021/project-IHK.git
cd project-IHK
```

### 2. 環境変数の設定

```bash
# 環境変数ファイルをコピー
cp .env.example .env

# .envファイルを編集して実際の値を設定
```

### 3. 依存関係のインストール

```bash
# フロントエンド
cd frontend
npm install

# バックエンド
cd ../backend
npm install
```

### 4. 開発サーバーの起動

#### Docker使用（推奨）

```bash
# 開発環境の自動セットアップ・起動
./scripts/docker-dev.sh setup

# または手動でDocker Composeを使用
docker-compose up -d

# 利用可能なサービス
# - フロントエンド: http://localhost:3000
# - バックエンドAPI: http://localhost:3001
# - DynamoDB Local: http://localhost:8000
# - DynamoDB Admin: http://localhost:8001
# - Redis Commander: http://localhost:8002
```

#### ローカル環境での起動

```bash
# 依存関係のインストール
./scripts/dev-utils.sh install

# バックエンド（ターミナル1）
cd backend
npm run dev

# フロントエンド（ターミナル2）
cd frontend
npm run dev
```

### 5. Docker開発環境管理

```bash
# Docker環境管理コマンド
./scripts/docker-dev.sh start     # Docker環境を起動
./scripts/docker-dev.sh stop      # Docker環境を停止
./scripts/docker-dev.sh restart   # Docker環境を再起動
./scripts/docker-dev.sh build     # Dockerイメージを再ビルド
./scripts/docker-dev.sh logs      # ログを表示
./scripts/docker-dev.sh status    # コンテナの状態を表示
./scripts/docker-dev.sh shell     # バックエンドコンテナにシェル接続
./scripts/docker-dev.sh clean     # 全てのコンテナとボリュームを削除
./scripts/docker-dev.sh setup     # 初回セットアップ

# 個別サービスのログ確認
./scripts/docker-dev.sh logs backend   # バックエンドのログ
./scripts/docker-dev.sh logs frontend  # フロントエンドのログ
```

## 📋 開発ルール

### ブランチ戦略

```bash
# 新機能開発
git checkout -b feature/task-X.X-description

# バグ修正
git checkout -b bugfix/issue-description

# ホットフィックス
git checkout -b hotfix/critical-fix
```

### コミットメッセージ

```bash
# タスク実装
[X.X] タスク名の実装

# バグ修正
[BUGFIX] 修正内容

# ドキュメント更新
[DOCS] ドキュメント更新内容
```

### コードレビュー

- 全てのPRに最低1人のレビューが必要
- セキュリティ、パフォーマンス、可読性を重視
- 建設的なフィードバックを心がける

## 🧪 テスト

### ユニットテスト

```bash
# フロントエンド
cd frontend
npm run test

# バックエンド
cd backend
npm run test
```

### カバレッジ

```bash
# フロントエンド
cd frontend
npm run test:coverage

# バックエンド
cd backend
npm run test:coverage
```

## 🔒 セキュリティ

### コミット前チェック

```bash
# セキュリティチェック実行
./scripts/security-check.sh
```

### 秘匿情報管理

- **AWS Secrets Manager**: 機密情報（パスワード、APIキー等）
- **AWS Parameter Store**: 非機密設定値
- **環境変数**: ローカル開発用設定

#### Secrets Manager・Parameter Store管理

```bash
# スタックのデプロイ
./scripts/secrets-manager.sh deploy dev

# シークレット一覧表示
./scripts/secrets-manager.sh list-secrets dev

# パラメータ一覧表示
./scripts/secrets-manager.sh list-parameters dev

# シークレット取得
./scripts/secrets-manager.sh get-secret dev jwt-secret

# パラメータ取得
./scripts/secrets-manager.sh get-parameter dev app/version

# シークレット設定
./scripts/secrets-manager.sh set-secret dev jwt-secret '{"secret":"new-secret-value"}'

# パラメータ設定
./scripts/secrets-manager.sh set-parameter dev app/version "1.1.0"

# CloudFormationテンプレート検証
./scripts/secrets-manager.sh validate-templates
```

## 👥 チーム構成

### メンバー1: インフラ・バックエンド基盤担当
- プロジェクト構造とGitHub設定
- Docker開発環境構築
- AWS基盤インフラ構築
- 認証システム実装

### メンバー2: 認証・翻訳システム担当
- 翻訳サービス基盤実装
- ログ・監視機能実装
- フォーラム基盤機能実装

### メンバー3: フロントエンド・UI担当
- URLプレビュー機能実装
- AWS特化機能実装
- フロントエンドUI実装

## 📚 ドキュメント

- [要件定義書](.kiro/specs/multilingual-aws-community/requirements.md)
- [設計書](.kiro/specs/multilingual-aws-community/design.md)
- [実装計画](.kiro/specs/multilingual-aws-community/tasks.md)
- [チーム開発ルール](.kiro/steering/team-development-rules.md)
- [セキュリティルール](.kiro/steering/security-rules.md)

## 🤝 コントリビューション

1. Issueを作成して議論
2. フィーチャーブランチを作成
3. 変更を実装
4. テストを追加
5. プルリクエストを作成
6. コードレビューを受ける
7. マージ

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🆘 サポート

質問や問題がある場合は、Issueを作成するかチームメンバーに相談してください。