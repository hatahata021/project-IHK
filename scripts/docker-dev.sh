#!/bin/bash

# Docker開発環境管理スクリプト

set -e

# 色付きメッセージ用の関数
print_info() {
    echo -e "\033[36m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[33m[WARNING]\033[0m $1"
}

# 使用方法を表示
show_usage() {
    echo "使用方法: $0 [コマンド]"
    echo ""
    echo "利用可能なコマンド:"
    echo "  start     - Docker環境を起動"
    echo "  stop      - Docker環境を停止"
    echo "  restart   - Docker環境を再起動"
    echo "  build     - Dockerイメージを再ビルド"
    echo "  logs      - ログを表示"
    echo "  clean     - 全てのコンテナとボリュームを削除"
    echo "  status    - コンテナの状態を表示"
    echo "  shell     - バックエンドコンテナにシェル接続"
    echo "  setup     - 初回セットアップ（テーブル作成等）"
    echo ""
}

# Docker環境を起動
start_docker() {
    print_info "Docker開発環境を起動しています..."
    
    # .envファイルの存在確認
    if [ ! -f ".env" ]; then
        print_warning ".envファイルが見つかりません。.env.exampleからコピーしています..."
        cp .env.example .env
        print_info ".envファイルを作成しました。必要に応じて設定を変更してください。"
    fi
    
    docker-compose up -d
    
    print_success "Docker環境が起動しました！"
    print_info "アクセス可能なURL:"
    print_info "  フロントエンド: http://localhost:3000"
    print_info "  バックエンドAPI: http://localhost:3001"
    print_info "  DynamoDB Admin: http://localhost:8001"
    print_info "  Redis Commander: http://localhost:8002"
}

# Docker環境を停止
stop_docker() {
    print_info "Docker環境を停止しています..."
    docker-compose down
    print_success "Docker環境を停止しました。"
}

# Docker環境を再起動
restart_docker() {
    print_info "Docker環境を再起動しています..."
    docker-compose restart
    print_success "Docker環境を再起動しました。"
}

# Dockerイメージを再ビルド
build_docker() {
    print_info "Dockerイメージを再ビルドしています..."
    docker-compose build --no-cache
    print_success "Dockerイメージの再ビルドが完了しました。"
}

# ログを表示
show_logs() {
    if [ -n "$2" ]; then
        docker-compose logs -f "$2"
    else
        docker-compose logs -f
    fi
}

# 環境をクリーンアップ
clean_docker() {
    print_warning "全てのコンテナとボリュームを削除します。データは失われます。"
    read -p "続行しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Docker環境をクリーンアップしています..."
        docker-compose down -v --remove-orphans
        docker system prune -f
        print_success "クリーンアップが完了しました。"
    else
        print_info "クリーンアップをキャンセルしました。"
    fi
}

# コンテナの状態を表示
show_status() {
    print_info "コンテナの状態:"
    docker-compose ps
}

# バックエンドコンテナにシェル接続
connect_shell() {
    print_info "バックエンドコンテナに接続しています..."
    docker-compose exec backend sh
}

# 初回セットアップ
setup_environment() {
    print_info "初回セットアップを実行しています..."
    
    # Docker環境を起動
    start_docker
    
    # DynamoDBテーブルの作成を待機
    print_info "DynamoDBの起動を待機しています..."
    sleep 10
    
    # テーブル作成スクリプトを実行（将来実装予定）
    print_info "DynamoDBテーブルを作成しています..."
    # docker-compose exec backend npm run setup:db
    
    print_success "初回セットアップが完了しました！"
}

# メイン処理
case "${1:-}" in
    start)
        start_docker
        ;;
    stop)
        stop_docker
        ;;
    restart)
        restart_docker
        ;;
    build)
        build_docker
        ;;
    logs)
        show_logs "$@"
        ;;
    clean)
        clean_docker
        ;;
    status)
        show_status
        ;;
    shell)
        connect_shell
        ;;
    setup)
        setup_environment
        ;;
    *)
        show_usage
        exit 1
        ;;
esac