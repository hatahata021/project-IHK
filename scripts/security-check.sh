#!/bin/bash

# セキュリティチェックスクリプト
# コミット前に実行して秘匿情報がないかチェック

echo "🔍 セキュリティチェックを開始します..."

# git-secretsの動作確認
echo "📋 git-secretsの動作確認中..."
if ! command -v git-secrets &> /dev/null; then
    echo "❌ git-secretsがインストールされていません"
    echo "📖 インストール方法: docs/SETUP.md を参照してください"
    exit 1
fi

# git-secretsでスキャン
if ! git secrets --scan; then
    echo "❌ git-secretsで秘匿情報が検出されました"
    exit 1
fi

# 危険なパターンを検索
echo "📋 秘匿情報パターンをチェック中..."

# パスワード関連
if grep -r -i "password\s*=\s*['\"][^'\"]*['\"]" --exclude-dir=.git --exclude-dir=node_modules --exclude="*.md" .; then
    echo "❌ ハードコーディングされたパスワードが見つかりました"
    exit 1
fi

# APIキー関連
if grep -r -E "(api_key|apikey|api-key)\s*=\s*['\"][^'\"]*['\"]" --exclude-dir=.git --exclude-dir=node_modules --exclude="*.md" .; then
    echo "❌ ハードコーディングされたAPIキーが見つかりました"
    exit 1
fi

# AWS Access Key
if grep -r -E "AKIA[0-9A-Z]{16}" --exclude-dir=.git --exclude-dir=node_modules --exclude="*.md" .; then
    echo "❌ AWS Access Keyが見つかりました"
    exit 1
fi

# メールアドレス（@gmail.com, @yahoo.com など個人用）
if grep -r -E "[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|outlook)\.com" --exclude-dir=.git --exclude-dir=node_modules --exclude="*.md" .; then
    echo "❌ 個人のメールアドレスが見つかりました"
    exit 1
fi

# 秘密鍵ファイル
if find . -name "*.key" -o -name "*.pem" -o -name "*.p12" | grep -v .git; then
    echo "❌ 秘密鍵ファイルが見つかりました"
    exit 1
fi

# .envファイル
if find . -name ".env" -not -name ".env.example" | grep -v .git; then
    echo "❌ .envファイルが見つかりました（.env.exampleのみ許可）"
    exit 1
fi

echo "✅ セキュリティチェック完了 - 問題は見つかりませんでした"
echo "🚀 安全にコミット・プッシュできます"