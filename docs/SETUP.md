# 開発環境セットアップガイド

## 🚨 重要: 開発開始前の必須作業

### 1. git-secretsインストール（必須）

**全チームメンバーが開発開始前に必ずインストールしてください**

#### macOS
```bash
brew install git-secrets
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get install git-secrets
```

#### 手動インストール
```bash
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets
make install
```

### 2. リポジトリクローンと初期設定

```bash
# リポジトリをクローン
git clone https://github.com/hatahata021/project-IHK.git
cd project-IHK

# git-secrets設定（必須）
git secrets --install
git secrets --register-aws

# グローバル設定（推奨）
git secrets --install ~/.git-templates/git-secrets
git config --global init.templateDir ~/.git-templates/git-secrets
git secrets --register-aws --global
```

### 3. 動作確認テスト

```bash
# テストファイル作成（エラーが出ることを確認）
echo "AKIAIOSFODNN7EXAMPLE" > test-secret.txt
git add test-secret.txt
git commit -m "test"

# エラーが出たら成功！ファイルを削除
rm test-secret.txt
git reset HEAD~1
```

### 4. 環境変数設定

```bash
# サンプルファイルをコピー
cp .env.example .env

# .envファイルを編集（実際の値を設定）
# 注意: .envファイルはGitにコミットされません
```

### 5. 開発ツールインストール

```bash
# Node.js依存関係
npm install

# Docker環境起動
docker-compose up -d
```

## ✅ セットアップ完了チェックリスト

- [ ] git-secretsインストール完了
- [ ] git-secrets設定完了
- [ ] 動作確認テスト成功
- [ ] .envファイル設定完了
- [ ] Node.js依存関係インストール完了
- [ ] Docker環境起動完了

## 🔒 セキュリティ注意事項

- **絶対にコミットしてはいけない情報**:
  - パスワード、APIキー、トークン
  - 個人情報（メールアドレス、電話番号等）
  - 本番環境の設定情報
  - .envファイル

- **コミット前の確認**:
  ```bash
  # セキュリティチェック実行
  ./scripts/security-check.sh
  
  # 問題なければコミット
  git add .
  git commit -m "Your commit message"
  ```

## 🆘 トラブルシューティング

### git-secretsでエラーが出ない場合
```bash
# 設定確認
git config --list | grep secrets

# 再設定
git secrets --install --force
git secrets --register-aws
```

### 既に秘匿情報をコミットしてしまった場合
1. **即座に作業を停止**
2. **チーム全体に報告**
3. **該当の認証情報を無効化**
4. **Git履歴から完全削除**（BFGツール使用）

## 📞 サポート

設定で困った場合は、チームメンバーに相談してください。
セキュリティに関する問題は即座に報告してください。