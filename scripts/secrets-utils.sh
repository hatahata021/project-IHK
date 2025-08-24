#!/bin/bash

# シークレット管理ユーティリティスクリプト

PROJECT_NAME="multilingual-community"
ENVIRONMENT=${2:-dev}
AWS_REGION=${AWS_REGION:-ap-northeast-1}

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

# シークレット名を生成
get_secret_name() {
    echo "$PROJECT_NAME/$ENVIRONMENT/$1"
}

# パラメータ名を生成
get_parameter_name() {
    echo "/$PROJECT_NAME/$ENVIRONMENT/$1"
}

case "$1" in
    "list-secrets")
        print_info "Secrets Manager シークレット一覧:"
        aws secretsmanager list-secrets \
            --region "$AWS_REGION" \
            --query "SecretList[?contains(Name, '$PROJECT_NAME/$ENVIRONMENT')].{Name:Name,Description:Description,LastChanged:LastChangedDate}" \
            --output table
        ;;
    "list-parameters")
        print_info "Parameter Store パラメータ一覧:"
        aws ssm get-parameters-by-path \
            --path "/$PROJECT_NAME/$ENVIRONMENT" \
            --recursive \
            --region "$AWS_REGION" \
            --query "Parameters[].{Name:Name,Type:Type,LastModified:LastModifiedDate}" \
            --output table
        ;;
    "get-secret")
        if [ -z "$3" ]; then
            print_error "使用方法: $0 get-secret [environment] [secret-type]"
            print_info "利用可能なシークレットタイプ: jwt-keys, github-api, twitter-api, linkedin-api, email-config"
            exit 1
        fi
        
        SECRET_NAME=$(get_secret_name "$3")
        print_info "シークレット取得中: $SECRET_NAME"
        
        aws secretsmanager get-secret-value \
            --secret-id "$SECRET_NAME" \
            --region "$AWS_REGION" \
            --query 'SecretString' \
            --output text | jq '.'
        ;;
    "get-parameter")
        if [ -z "$3" ]; then
            print_error "使用方法: $0 get-parameter [environment] [parameter-path]"
            print_info "例: $0 get-parameter dev app/region"
            exit 1
        fi
        
        PARAMETER_NAME=$(get_parameter_name "$3")
        print_info "パラメータ取得中: $PARAMETER_NAME"
        
        aws ssm get-parameter \
            --name "$PARAMETER_NAME" \
            --region "$AWS_REGION" \
            --query 'Parameter.Value' \
            --output text
        ;;
    "update-secret")
        if [ -z "$3" ] || [ -z "$4" ]; then
            print_error "使用方法: $0 update-secret [environment] [secret-type] [json-file]"
            print_info "例: $0 update-secret dev jwt-keys jwt-keys.json"
            exit 1
        fi
        
        SECRET_NAME=$(get_secret_name "$3")
        JSON_FILE="$4"
        
        if [ ! -f "$JSON_FILE" ]; then
            print_error "JSONファイルが見つかりません: $JSON_FILE"
            exit 1
        fi
        
        print_info "シークレット更新中: $SECRET_NAME"
        
        aws secretsmanager update-secret \
            --secret-id "$SECRET_NAME" \
            --secret-string "file://$JSON_FILE" \
            --region "$AWS_REGION"
        
        print_success "シークレット更新完了: $SECRET_NAME"
        ;;
    "update-parameter")
        if [ -z "$3" ] || [ -z "$4" ]; then
            print_error "使用方法: $0 update-parameter [environment] [parameter-path] [value]"
            print_info "例: $0 update-parameter dev app/log-level info"
            exit 1
        fi
        
        PARAMETER_NAME=$(get_parameter_name "$3")
        VALUE="$4"
        
        print_info "パラメータ更新中: $PARAMETER_NAME"
        
        aws ssm put-parameter \
            --name "$PARAMETER_NAME" \
            --value "$VALUE" \
            --type "String" \
            --overwrite \
            --region "$AWS_REGION"
        
        print_success "パラメータ更新完了: $PARAMETER_NAME"
        ;;
    "rotate-jwt")
        SECRET_NAME=$(get_secret_name "jwt-keys")
        print_info "JWT署名キーをローテーション中: $SECRET_NAME"
        
        # 新しいキーを生成
        SIGNING_KEY=$(openssl rand -hex 64)
        REFRESH_KEY=$(openssl rand -hex 64)
        
        # JSONを作成
        JSON_CONTENT=$(cat <<EOF
{
  "signingKey": "$SIGNING_KEY",
  "refreshKey": "$REFRESH_KEY"
}
EOF
)
        
        # シークレットを更新
        aws secretsmanager update-secret \
            --secret-id "$SECRET_NAME" \
            --secret-string "$JSON_CONTENT" \
            --region "$AWS_REGION"
        
        print_success "JWT署名キーのローテーション完了"
        print_warning "アプリケーションの再起動が必要です"
        ;;
    "setup-github-api")
        if [ -z "$3" ]; then
            print_error "使用方法: $0 setup-github-api [environment] [github-token]"
            exit 1
        fi
        
        SECRET_NAME=$(get_secret_name "github-api")
        GITHUB_TOKEN="$3"
        
        JSON_CONTENT=$(cat <<EOF
{
  "apiKey": "$GITHUB_TOKEN",
  "endpoint": "https://api.github.com"
}
EOF
)
        
        print_info "GitHub API認証情報を設定中: $SECRET_NAME"
        
        aws secretsmanager update-secret \
            --secret-id "$SECRET_NAME" \
            --secret-string "$JSON_CONTENT" \
            --region "$AWS_REGION"
        
        print_success "GitHub API認証情報の設定完了"
        ;;
    "setup-twitter-api")
        if [ -z "$3" ] || [ -z "$4" ]; then
            print_error "使用方法: $0 setup-twitter-api [environment] [api-key] [api-secret] [bearer-token]"
            exit 1
        fi
        
        SECRET_NAME=$(get_secret_name "twitter-api")
        API_KEY="$3"
        API_SECRET="$4"
        BEARER_TOKEN="$5"
        
        JSON_CONTENT=$(cat <<EOF
{
  "apiKey": "$API_KEY",
  "apiSecret": "$API_SECRET",
  "bearerToken": "$BEARER_TOKEN"
}
EOF
)
        
        print_info "Twitter API認証情報を設定中: $SECRET_NAME"
        
        aws secretsmanager update-secret \
            --secret-id "$SECRET_NAME" \
            --secret-string "$JSON_CONTENT" \
            --region "$AWS_REGION"
        
        print_success "Twitter API認証情報の設定完了"
        ;;
    "setup-linkedin-api")
        if [ -z "$3" ] || [ -z "$4" ]; then
            print_error "使用方法: $0 setup-linkedin-api [environment] [client-id] [client-secret]"
            exit 1
        fi
        
        SECRET_NAME=$(get_secret_name "linkedin-api")
        CLIENT_ID="$3"
        CLIENT_SECRET="$4"
        
        JSON_CONTENT=$(cat <<EOF
{
  "clientId": "$CLIENT_ID",
  "clientSecret": "$CLIENT_SECRET"
}
EOF
)
        
        print_info "LinkedIn API認証情報を設定中: $SECRET_NAME"
        
        aws secretsmanager update-secret \
            --secret-id "$SECRET_NAME" \
            --secret-string "$JSON_CONTENT" \
            --region "$AWS_REGION"
        
        print_success "LinkedIn API認証情報の設定完了"
        ;;
    "validate-config")
        print_info "設定の検証を実行中..."
        
        # 必須シークレットの確認
        SECRETS=("jwt-keys" "email-config")
        for secret in "${SECRETS[@]}"; do
            SECRET_NAME=$(get_secret_name "$secret")
            if aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --region "$AWS_REGION" &>/dev/null; then
                print_success "✓ シークレット存在確認: $secret"
            else
                print_error "✗ シークレット不足: $secret"
            fi
        done
        
        # 必須パラメータの確認
        PARAMETERS=("app/region" "app/log-level" "dynamodb/table-prefix" "s3/bucket-name")
        for param in "${PARAMETERS[@]}"; do
            PARAMETER_NAME=$(get_parameter_name "$param")
            if aws ssm get-parameter --name "$PARAMETER_NAME" --region "$AWS_REGION" &>/dev/null; then
                print_success "✓ パラメータ存在確認: $param"
            else
                print_error "✗ パラメータ不足: $param"
            fi
        done
        ;;
    "backup-secrets")
        BACKUP_DIR="secrets-backup-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        
        print_info "シークレットをバックアップ中: $BACKUP_DIR"
        
        # シークレット一覧を取得
        SECRET_NAMES=$(aws secretsmanager list-secrets \
            --region "$AWS_REGION" \
            --query "SecretList[?contains(Name, '$PROJECT_NAME/$ENVIRONMENT')].Name" \
            --output text)
        
        for secret_name in $SECRET_NAMES; do
            SAFE_NAME=$(echo "$secret_name" | sed 's/\//_/g')
            print_info "バックアップ中: $secret_name"
            
            aws secretsmanager get-secret-value \
                --secret-id "$secret_name" \
                --region "$AWS_REGION" \
                --query 'SecretString' \
                --output text > "$BACKUP_DIR/${SAFE_NAME}.json"
        done
        
        print_success "シークレットバックアップ完了: $BACKUP_DIR"
        print_warning "バックアップファイルには機密情報が含まれています。適切に管理してください。"
        ;;
    *)
        echo "🔐 AWS Engineers Community - シークレット管理ユーティリティ"
        echo ""
        echo "使用方法: $0 [command] [environment] [options]"
        echo ""
        echo "利用可能なコマンド:"
        echo "  list-secrets        - Secrets Manager シークレット一覧表示"
        echo "  list-parameters     - Parameter Store パラメータ一覧表示"
        echo "  get-secret          - 特定のシークレット取得"
        echo "  get-parameter       - 特定のパラメータ取得"
        echo "  update-secret       - シークレット更新"
        echo "  update-parameter    - パラメータ更新"
        echo "  rotate-jwt          - JWT署名キーのローテーション"
        echo "  setup-github-api    - GitHub API認証情報設定"
        echo "  setup-twitter-api   - Twitter API認証情報設定"
        echo "  setup-linkedin-api  - LinkedIn API認証情報設定"
        echo "  validate-config     - 設定の検証"
        echo "  backup-secrets      - シークレットのバックアップ"
        echo ""
        echo "例:"
        echo "  $0 list-secrets dev"
        echo "  $0 get-secret dev jwt-keys"
        echo "  $0 rotate-jwt dev"
        echo "  $0 setup-github-api dev ghp_xxxxxxxxxxxx"
        echo "  $0 validate-config dev"
        ;;
esac