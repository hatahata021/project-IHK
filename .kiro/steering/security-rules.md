---
inclusion: always
---

# セキュリティルール

## 🚨 重要: 秘匿情報の取り扱い

### 絶対にGitにコミット・プッシュしてはいけない情報

#### 認証情報
- **パスワード**: データベース、API、サービスのパスワード
- **APIキー**: AWS Access Key、Secret Key、その他のAPIキー
- **トークン**: Personal Access Token、JWT、OAuth トークン
- **証明書**: SSL証明書、秘密鍵ファイル (.pem, .key, .p12)

#### 個人情報
- **メールアドレス**: 実際のメールアドレス（例外: 公開用のもの）
- **電話番号**: 個人や組織の電話番号
- **住所**: 物理的な住所情報
- **名前**: 実名（例外: 公開されているもの）

#### 設定情報
- **データベース接続文字列**: 本番環境の接続情報
- **環境変数**: 秘匿情報を含む .env ファイル
- **設定ファイル**: 本番環境の設定ファイル
- **ログファイル**: 個人情報や認証情報を含むログ

## ✅ 安全な代替手段

### 環境変数の使用
```bash
# ❌ 危険: ハードコーディング
const apiKey = "AKIA1234567890ABCDEF";

# ✅ 安全: 環境変数使用
const apiKey = process.env.AWS_API_KEY;
```

### プレースホルダーの使用
```bash
# ❌ 危険: 実際の値
DATABASE_URL=postgresql://user:password123@prod-db.example.com:5432/mydb

# ✅ 安全: プレースホルダー
DATABASE_URL=postgresql://[USERNAME]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
```

### サンプルファイルの作成
```bash
# 実際の設定ファイル（.gitignoreに追加）
.env

# サンプルファイル（Gitに含める）
.env.example
```

## 🛡️ 保護メカニズム

### .gitignoreファイル
以下のパターンを必ず .gitignore に追加：

```gitignore
# 環境変数ファイル
.env
.env.local
.env.production
.env.staging

# 認証情報
*.key
*.pem
*.p12
*.pfx
config/secrets.json
config/production.json

# ログファイル
*.log
logs/

# 一時ファイル
tmp/
temp/
.cache/

# IDEファイル（個人設定含む）
.vscode/settings.json
.idea/workspace.xml

# OS固有ファイル
.DS_Store
Thumbs.db

# バックアップファイル
*.bak
*.backup
```

### git-secretsの使用（必須）
**🚨 重要: チーム全員が必ずインストールしてください**

#### インストール手順
```bash
# macOS (Homebrew使用)
brew install git-secrets

# Linux (Ubuntu/Debian)
sudo apt-get install git-secrets

# 手動インストール
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets
make install
```

#### 初期設定（必須）
```bash
# リポジトリでの設定
cd /path/to/project-IHK
git secrets --install
git secrets --register-aws

# グローバル設定（推奨）
git secrets --install ~/.git-templates/git-secrets
git config --global init.templateDir ~/.git-templates/git-secrets
git secrets --register-aws --global
```

#### 自動検出パターン
以下のパターンが自動検出されます：
- AWS Access Key: `AKIA[0-9A-Z]{16}`
- AWS Secret Key: `[A-Za-z0-9/+=]{40}`
- AWS Account ID: `[0-9]{4}-?[0-9]{4}-?[0-9]{4}`

#### 動作確認
```bash
# テスト（このコマンドでエラーが出ればOK）
echo "AKIAIOSFODNN7EXAMPLE" > test-file.txt
git add test-file.txt
git commit -m "test"
# → エラーが出ることを確認
rm test-file.txt
git reset HEAD~1
```

## 📋 コミット前チェックリスト

### 必須確認事項
- [ ] ハードコーディングされたパスワードがないか
- [ ] APIキーや認証トークンが含まれていないか
- [ ] 実際のメールアドレスや個人情報がないか
- [ ] 本番環境の設定情報が含まれていないか
- [ ] ログファイルや一時ファイルが含まれていないか

### コミット前コマンド
```bash
# 変更内容を確認
git diff

# ステージングされた内容を確認
git diff --cached

# 秘匿情報がないか検索
grep -r "password\|secret\|key\|token" --exclude-dir=.git .
```

## 🚨 事故発生時の対応

### 秘匿情報をコミットしてしまった場合

#### 1. まだプッシュしていない場合
```bash
# 最新のコミットを取り消し
git reset --soft HEAD~1

# ファイルを修正してから再コミット
```

#### 2. プッシュしてしまった場合
```bash
# 🚨 緊急対応が必要
# 1. 該当の認証情報を即座に無効化
# 2. 新しい認証情報を生成
# 3. Git履歴から完全に削除（BFGツール使用）
# 4. チーム全体に通知
```

## 👥 チーム責任

### 各メンバーの必須作業
1. **git-secretsインストール**: プロジェクト参加前に必ずインストール
2. **初期設定完了**: リポジトリクローン後に設定を実行
3. **動作確認**: テストコマンドで正常動作を確認

### 各メンバーの責任
- **コミット前**: 必ず内容を確認
- **レビュー時**: 秘匿情報がないかチェック
- **発見時**: 即座にチームに報告
- **git-secrets**: 定期的に最新版に更新

### 定期的な確認
- **毎回**: git-secretsが正常動作していることを確認
- 週1回: .gitignore の見直し
- 月1回: リポジトリ全体の秘匿情報スキャン
- 四半期: セキュリティルールの見直し
- 四半期: git-secretsの最新版確認・更新

## 📚 参考資料

### 安全なコーディング
- 環境変数は必ず検証してから使用
- 設定ファイルは階層化（開発/本番分離）
- ログ出力時は秘匿情報をマスク

### ツール活用
- **git-secrets**: 自動検出
- **truffleHog**: 履歴スキャン
- **detect-secrets**: 事前検出

## 🔐 AWS Secrets Manager使用方針

### 必須使用ケース
以下の情報は**必ずAWS Secrets Manager**で管理してください：

#### データベース認証情報
```typescript
// ❌ 危険: 環境変数での管理
const dbConfig = {
  host: process.env.DB_HOST,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD
};

// ✅ 安全: Secrets Manager使用
const secretsService = new SecretsService();
const dbConfig = await secretsService.getSecret<DatabaseSecret>('prod/multilingual-community/database');
```

#### 外部API認証情報
```typescript
// ❌ 危険: ハードコーディング
const githubToken = "ghp_1234567890abcdef";

// ✅ 安全: Secrets Manager使用
const githubSecret = await secretsService.getSecret<APISecret>('prod/multilingual-community/github-api');
const githubToken = githubSecret.apiKey;
```

#### JWT署名キー
```typescript
// ❌ 危険: 固定値
const jwtSecret = "my-super-secret-key";

// ✅ 安全: Secrets Manager使用
const jwtKeys = await secretsService.getSecret<JWTSecret>('prod/multilingual-community/jwt-keys');
const token = jwt.sign(payload, jwtKeys.signingKey);
```

### AWS Systems Manager Parameter Store使用ケース
非機密設定値は**Parameter Store**を使用：

```typescript
// 設定値の取得例
const parameterService = new ParameterService();
const region = await parameterService.getParameter('/multilingual-community/prod/app/region');
const logLevel = await parameterService.getParameter('/multilingual-community/prod/app/log-level');
```

### 実装時の注意事項
1. **キャッシュ機能**: 頻繁なAPI呼び出しを避けるため5分間キャッシュ
2. **エラーハンドリング**: Secrets Manager接続失敗時のフォールバック処理
3. **ローテーション対応**: 自動ローテーション機能を活用
4. **環境分離**: 開発・本番環境でシークレットを分離管理