#!/bin/bash

# インフラ管理用ユーティリティスクリプト

PROJECT_NAME="multilingual-community"
ENVIRONMENT=${2:-dev}
AWS_REGION=${AWS_REGION:-ap-northeast-1}

case "$1" in
    "deploy")
        echo "🚀 インフラをデプロイ中..."
        ./scripts/deploy-infrastructure.sh "$ENVIRONMENT"
        ;;
    "status")
        echo "📊 インフラ状況を確認中..."
        echo "環境: $ENVIRONMENT"
        echo "リージョン: $AWS_REGION"
        echo ""
        
        # スタック一覧
        echo "CloudFormationスタック:"
        aws cloudformation list-stacks \
            --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
            --region "$AWS_REGION" \
            --query "StackSummaries[?contains(StackName, '$PROJECT_NAME-$ENVIRONMENT')].{Name:StackName,Status:StackStatus}" \
            --output table
        
        echo ""
        echo "DynamoDBテーブル:"
        aws dynamodb list-tables \
            --region "$AWS_REGION" \
            --query "TableNames[?contains(@, '$PROJECT_NAME-$ENVIRONMENT')]" \
            --output table
        ;;
    "delete")
        echo "⚠️ インフラを削除中..."
        echo "環境: $ENVIRONMENT"
        read -p "本当に削除しますか？ (yes/no): " confirm
        
        if [ "$confirm" = "yes" ]; then
            # 逆順で削除
            STACKS=(
                "$PROJECT_NAME-$ENVIRONMENT-ecs"
                "$PROJECT_NAME-$ENVIRONMENT-cognito"
                "$PROJECT_NAME-$ENVIRONMENT-s3"
                "$PROJECT_NAME-$ENVIRONMENT-dynamodb"
                "$PROJECT_NAME-$ENVIRONMENT-vpc"
            )
            
            for stack in "${STACKS[@]}"; do
                if aws cloudformation describe-stacks --stack-name "$stack" --region "$AWS_REGION" &>/dev/null; then
                    echo "🗑️ $stack を削除中..."
                    aws cloudformation delete-stack --stack-name "$stack" --region "$AWS_REGION"
                    aws cloudformation wait stack-delete-complete --stack-name "$stack" --region "$AWS_REGION"
                    echo "✅ $stack 削除完了"
                else
                    echo "ℹ️ $stack は存在しません"
                fi
            done
        else
            echo "削除をキャンセルしました"
        fi
        ;;
    "outputs")
        echo "📋 スタック出力値:"
        STACKS=(
            "$PROJECT_NAME-$ENVIRONMENT-vpc"
            "$PROJECT_NAME-$ENVIRONMENT-dynamodb"
            "$PROJECT_NAME-$ENVIRONMENT-s3"
            "$PROJECT_NAME-$ENVIRONMENT-cognito"
            "$PROJECT_NAME-$ENVIRONMENT-ecs"
        )
        
        for stack in "${STACKS[@]}"; do
            if aws cloudformation describe-stacks --stack-name "$stack" --region "$AWS_REGION" &>/dev/null; then
                echo ""
                echo "=== $stack ==="
                aws cloudformation describe-stacks \
                    --stack-name "$stack" \
                    --region "$AWS_REGION" \
                    --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue}' \
                    --output table
            fi
        done
        ;;
    "logs")
        if [ -z "$3" ]; then
            echo "使用方法: $0 logs [environment] [service-name]"
            exit 1
        fi
        
        SERVICE_NAME="$3"
        LOG_GROUP="/ecs/$PROJECT_NAME-$ENVIRONMENT"
        
        echo "📋 $SERVICE_NAME のログを表示中..."
        aws logs tail "$LOG_GROUP" \
            --log-stream-names "$SERVICE_NAME" \
            --follow \
            --region "$AWS_REGION"
        ;;
    "validate")
        echo "🔍 CloudFormationテンプレートを検証中..."
        TEMPLATES=(
            "infrastructure/cloudformation/vpc.yml"
            "infrastructure/cloudformation/dynamodb.yml"
            "infrastructure/cloudformation/s3.yml"
            "infrastructure/cloudformation/cognito.yml"
            "infrastructure/cloudformation/ecs.yml"
        )
        
        for template in "${TEMPLATES[@]}"; do
            echo "検証中: $template"
            if aws cloudformation validate-template \
                --template-body "file://$template" \
                --region "$AWS_REGION" &>/dev/null; then
                echo "✅ $template - 有効"
            else
                echo "❌ $template - 無効"
            fi
        done
        ;;
    *)
        echo "🏗️ AWS Engineers Community - インフラ管理ユーティリティ"
        echo ""
        echo "使用方法: $0 [command] [environment] [options]"
        echo ""
        echo "利用可能なコマンド:"
        echo "  deploy     - インフラをデプロイ"
        echo "  status     - インフラ状況を確認"
        echo "  delete     - インフラを削除"
        echo "  outputs    - スタック出力値を表示"
        echo "  logs       - ECSサービスのログを表示"
        echo "  validate   - CloudFormationテンプレートを検証"
        echo ""
        echo "例:"
        echo "  $0 deploy dev"
        echo "  $0 status prod"
        echo "  $0 logs dev backend"
        echo "  $0 validate"
        ;;
esac