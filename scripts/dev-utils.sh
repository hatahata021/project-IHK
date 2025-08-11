#!/bin/bash

# 開発用ユーティリティスクリプト

case "$1" in
    "start")
        echo "🚀 開発環境を起動中..."
        docker-compose up -d
        ;;
    "stop")
        echo "🛑 開発環境を停止中..."
        docker-compose down
        ;;
    "restart")
        echo "🔄 開発環境を再起動中..."
        docker-compose restart
        ;;
    "logs")
        if [ -z "$2" ]; then
            echo "📋 全サービスのログを表示中..."
            docker-compose logs -f
        else
            echo "📋 $2 のログを表示中..."
            docker-compose logs -f "$2"
        fi
        ;;
    "clean")
        echo "🧹 開発環境をクリーンアップ中..."
        docker-compose down --volumes --remove-orphans
        docker system prune -f
        ;;
    "reset")
        echo "🔄 開発環境をリセット中..."
        docker-compose down --volumes --remove-orphans
        docker-compose build --no-cache
        docker-compose up -d
        ;;
    "status")
        echo "📊 サービス状況:"
        docker-compose ps
        echo ""
        echo "🔍 ヘルスチェック:"
        
        # バックエンド
        if curl -f http://localhost:3001/health > /dev/null 2>&1; then
            echo "✅ バックエンド: http://localhost:3001"
        else
            echo "❌ バックエンド: 応答なし"
        fi
        
        # フロントエンド
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            echo "✅ フロントエンド: http://localhost:3000"
        else
            echo "❌ フロントエンド: 応答なし"
        fi
        
        # DynamoDB Local
        if curl -f http://localhost:8000 > /dev/null 2>&1; then
            echo "✅ DynamoDB Local: http://localhost:8000"
        else
            echo "❌ DynamoDB Local: 応答なし"
        fi
        ;;
    "install")
        echo "📦 依存関係をインストール中..."
        echo "フロントエンド..."
        cd frontend && npm install && cd ..
        echo "バックエンド..."
        cd backend && npm install && cd ..
        echo "✅ インストール完了"
        ;;
    "test")
        if [ -z "$2" ]; then
            echo "🧪 全テストを実行中..."
            echo "フロントエンドテスト..."
            cd frontend && npm test && cd ..
            echo "バックエンドテスト..."
            cd backend && npm test && cd ..
        elif [ "$2" = "frontend" ]; then
            echo "🧪 フロントエンドテストを実行中..."
            cd frontend && npm test
        elif [ "$2" = "backend" ]; then
            echo "🧪 バックエンドテストを実行中..."
            cd backend && npm test
        fi
        ;;
    *)
        echo "🛠️ AWS Engineers Community - 開発用ユーティリティ"
        echo ""
        echo "使用方法: $0 [command] [options]"
        echo ""
        echo "利用可能なコマンド:"
        echo "  start     - 開発環境を起動"
        echo "  stop      - 開発環境を停止"
        echo "  restart   - 開発環境を再起動"
        echo "  logs      - ログを表示 (オプション: サービス名)"
        echo "  clean     - 開発環境をクリーンアップ"
        echo "  reset     - 開発環境を完全リセット"
        echo "  status    - サービス状況を確認"
        echo "  install   - 依存関係をインストール"
        echo "  test      - テストを実行 (オプション: frontend/backend)"
        echo ""
        echo "例:"
        echo "  $0 start"
        echo "  $0 logs backend"
        echo "  $0 test frontend"
        ;;
esac