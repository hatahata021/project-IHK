#!/bin/bash

# AWS基盤インフラデプロイメントスクリプト
set -e

# 設定
PROJECT_NAME="multilingual-community"
ENVIRONMENT=${1:-dev}
AWS_REGION=${AWS_REGION:-ap-northeast-1}

echo "🚀 AWS基盤インフラをデプロイ中..."
echo "   プロジェクト: $PROJECT_NAME"
echo "   環境: $ENVIRONMENT"
echo "   リージョン: $AWS_REGION"
echo ""

# AWS CLIの確認
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLIがインストールされていません。"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# AWS認証の確認
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS認証が設定されていません。"
    echo "   aws configure を実行してください。"
    exit 1
fi

echo "✅ AWS CLI設定確認完了"

# CloudFormationテンプレートディレクトリ
TEMPLATE_DIR="infrastructure/cloudformation"

# 1. VPCスタックのデプロイ
echo "📡 VPCスタックをデプロイ中..."
VPC_STACK_NAME="$PROJECT_NAME-$ENVIRONMENT-vpc"

aws cloudformation deploy \
    --template-file "$TEMPLATE_DIR/vpc.yml" \
    --stack-name "$VPC_STACK_NAME" \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        ProjectName="$PROJECT_NAME" \
    --region "$AWS_REGION" \
    --tags \
        Environment="$ENVIRONMENT" \
        Project="$PROJECT_NAME" \
        ManagedBy="CloudFormation"

echo "✅ VPCスタックデプロイ完了"

# VPCの出力値を取得
VPC_ID=$(aws cloudformation describe-stacks \
    --stack-name "$VPC_STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`VPC`].OutputValue' \
    --output text)

PUBLIC_SUBNETS=$(aws cloudformation describe-stacks \
    --stack-name "$VPC_STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnets`].OutputValue' \
    --output text)

PRIVATE_SUBNETS=$(aws cloudformation describe-stacks \
    --stack-name "$VPC_STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnets`].OutputValue' \
    --output text)

echo "   VPC ID: $VPC_ID"
echo "   Public Subnets: $PUBLIC_SUBNETS"
echo "   Private Subnets: $PRIVATE_SUBNETS"

# 2. DynamoDBスタックのデプロイ
echo "🗄️ DynamoDBスタックをデプロイ中..."
DYNAMODB_STACK_NAME="$PROJECT_NAME-$ENVIRONMENT-dynamodb"

aws cloudformation deploy \
    --template-file "$TEMPLATE_DIR/dynamodb.yml" \
    --stack-name "$DYNAMODB_STACK_NAME" \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        ProjectName="$PROJECT_NAME" \
    --region "$AWS_REGION" \
    --tags \
        Environment="$ENVIRONMENT" \
        Project="$PROJECT_NAME" \
        ManagedBy="CloudFormation"

echo "✅ DynamoDBスタックデプロイ完了"

# 3. S3スタックのデプロイ
echo "🪣 S3スタックをデプロイ中..."
S3_STACK_NAME="$PROJECT_NAME-$ENVIRONMENT-s3"

aws cloudformation deploy \
    --template-file "$TEMPLATE_DIR/s3.yml" \
    --stack-name "$S3_STACK_NAME" \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        ProjectName="$PROJECT_NAME" \
    --region "$AWS_REGION" \
    --tags \
        Environment="$ENVIRONMENT" \
        Project="$PROJECT_NAME" \
        ManagedBy="CloudFormation"

echo "✅ S3スタックデプロイ完了"

# 4. ECRスタックのデプロイ
echo "📦 ECRスタックをデプロイ中..."
ECR_STACK_NAME="$PROJECT_NAME-$ENVIRONMENT-ecr"

aws cloudformation deploy \
    --template-file "$TEMPLATE_DIR/ecr.yml" \
    --stack-name "$ECR_STACK_NAME" \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        ProjectName="$PROJECT_NAME" \
    --region "$AWS_REGION" \
    --tags \
        Environment="$ENVIRONMENT" \
        Project="$PROJECT_NAME" \
        ManagedBy="CloudFormation"

echo "✅ ECRスタックデプロイ完了"

# 5. Secrets Manager・Parameter Storeスタックのデプロイ
echo "🔐 Secrets Manager・Parameter Storeスタックをデプロイ中..."
SECRETS_STACK_NAME="$PROJECT_NAME-$ENVIRONMENT-secrets"

aws cloudformation deploy \
    --template-file "$TEMPLATE_DIR/secrets.yml" \
    --stack-name "$SECRETS_STACK_NAME" \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        ProjectName="$PROJECT_NAME" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION" \
    --tags \
        Environment="$ENVIRONMENT" \
        Project="$PROJECT_NAME" \
        ManagedBy="CloudFormation"

echo "✅ Secrets Manager・Parameter Storeスタックデプロイ完了"

# 6. Cognitoスタックのデプロイ
echo "🔐 Cognitoスタックをデプロイ中..."
COGNITO_STACK_NAME="$PROJECT_NAME-$ENVIRONMENT-cognito"

# フロントエンドURLの設定
if [ "$ENVIRONMENT" = "prod" ]; then
    FRONTEND_URL="https://your-domain.com"
else
    FRONTEND_URL="http://localhost:3000"
fi

aws cloudformation deploy \
    --template-file "$TEMPLATE_DIR/cognito.yml" \
    --stack-name "$COGNITO_STACK_NAME" \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        ProjectName="$PROJECT_NAME" \
        FrontendURL="$FRONTEND_URL" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION" \
    --tags \
        Environment="$ENVIRONMENT" \
        Project="$PROJECT_NAME" \
        ManagedBy="CloudFormation"

echo "✅ Cognitoスタックデプロイ完了"

# Cognito設定をParameter Storeに更新
echo "📝 Cognito設定をParameter Storeに更新中..."
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$COGNITO_STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$COGNITO_STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text)

# Parameter Storeを更新
aws ssm put-parameter \
    --name "/$PROJECT_NAME/$ENVIRONMENT/cognito/user-pool-id" \
    --value "$USER_POOL_ID" \
    --type "String" \
    --overwrite \
    --region "$AWS_REGION" > /dev/null

aws ssm put-parameter \
    --name "/$PROJECT_NAME/$ENVIRONMENT/cognito/client-id" \
    --value "$CLIENT_ID" \
    --type "String" \
    --overwrite \
    --region "$AWS_REGION" > /dev/null

echo "✅ Cognito設定をParameter Storeに更新完了"

# 7. ECSスタックのデプロイ（本番環境のみ）
if [ "$ENVIRONMENT" = "prod" ] || [ "$ENVIRONMENT" = "staging" ]; then
    echo "🐳 ECSスタックをデプロイ中..."
    ECS_STACK_NAME="$PROJECT_NAME-$ENVIRONMENT-ecs"

    aws cloudformation deploy \
        --template-file "$TEMPLATE_DIR/ecs.yml" \
        --stack-name "$ECS_STACK_NAME" \
        --parameter-overrides \
            Environment="$ENVIRONMENT" \
            ProjectName="$PROJECT_NAME" \
            VpcId="$VPC_ID" \
            PublicSubnetIds="$PUBLIC_SUBNETS" \
            PrivateSubnetIds="$PRIVATE_SUBNETS" \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$AWS_REGION" \
        --tags \
            Environment="$ENVIRONMENT" \
            Project="$PROJECT_NAME" \
            ManagedBy="CloudFormation"

    echo "✅ ECSスタックデプロイ完了"
else
    echo "ℹ️ 開発環境のため、ECSスタックはスキップします"
fi

echo ""
echo "🎉 AWS基盤インフラのデプロイが完了しました！"
echo ""
echo "📋 デプロイされたリソース:"
echo "   - VPC: $VPC_ID"
echo "   - DynamoDBテーブル: 6個"
echo "   - S3バケット: 2個"
echo "   - ECRリポジトリ: 2個"
echo "   - Secrets Manager: 5個のシークレット"
echo "   - Parameter Store: 7個のパラメータ"
echo "   - Cognito User Pool: 1個"
if [ "$ENVIRONMENT" = "prod" ] || [ "$ENVIRONMENT" = "staging" ]; then
    echo "   - ECS Cluster: 1個"
fi
echo ""
echo "🔧 次のステップ:"
echo "   1. AWS Secrets Managerの設定（タスク1.4）"
echo "   2. シークレット管理サービスの実装（タスク2.1）"
echo ""