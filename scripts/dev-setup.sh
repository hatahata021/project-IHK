#!/bin/bash

# 開発環境セットアップスクリプト
echo "🚀 AWS Engineers Community - 開発環境セットアップ"

# 環境変数ファイルの確認
if [ ! -f .env ]; then
    echo "📋 .envファイルが見つかりません。.env.exampleからコピーします..."
    cp .env.example .env
    echo "✅ .envファイルを作成しました。必要に応じて編集してください。"
fi

# Dockerの確認
if ! command -v docker &> /dev/null; then
    echo "❌ Dockerがインストールされていません。"
    echo "   https://docs.docker.com/get-docker/ からインストールしてください。"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Composeがインストールされていません。"
    echo "   https://docs.docker.com/compose/install/ からインストールしてください。"
    exit 1
fi

echo "✅ Docker環境が確認できました。"

# 既存のコンテナを停止・削除
echo "🧹 既存のコンテナをクリーンアップ中..."
docker-compose down --volumes --remove-orphans

# イメージをビルド
echo "🏗️ Dockerイメージをビルド中..."
docker-compose build

# コンテナを起動
echo "🚀 開発環境を起動中..."
docker-compose up -d

# サービスの起動を待機
echo "⏳ サービスの起動を待機中..."
sleep 10

# ヘルスチェック
echo "🔍 サービスのヘルスチェック中..."

# バックエンドのヘルスチェック
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ バックエンド: http://localhost:3001"
else
    echo "⚠️ バックエンドの起動に時間がかかっています..."
fi

# フロントエンドのヘルスチェック
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ フロントエンド: http://localhost:3000"
else
    echo "⚠️ フロントエンドの起動に時間がかかっています..."
fi

# DynamoDB Localのヘルスチェック
if curl -f http://localhost:8000 > /dev/null 2>&1; then
    echo "✅ DynamoDB Local: http://localhost:8000"
else
    echo "⚠️ DynamoDB Localの起動に時間がかかっています..."
fi

echo ""
echo "🎉 開発環境のセットアップが完了しました！"
echo ""
echo "📋 利用可能なサービス:"
echo "   - フロントエンド: http://localhost:3000"
echo "   - バックエンドAPI: http://localhost:3001"
echo "   - DynamoDB Local: http://localhost:8000"
echo "   - DynamoDB Admin: http://localhost:8001"
echo "   - Redis: localhost:6379"
echo "   - Redis Commander: http://localhost:8081"
echo ""
echo "🛠️ 開発用コマンド:"
echo "   - ログ確認: docker-compose logs -f [service-name]"
echo "   - 停止: docker-compose down"
echo "   - 再起動: docker-compose restart [service-name]"
echo ""