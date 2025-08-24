#!/usr/bin/env ts-node

/**
 * DynamoDBテーブル初期化スクリプト
 * 開発環境用のサンプルデータを投入します
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

// 環境変数の設定
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const PROJECT_NAME = process.env.PROJECT_NAME || 'multilingual-community';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';
const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT || undefined;

// DynamoDBクライアントの設定
const dynamoDBClient = new DynamoDBClient({
  region: AWS_REGION,
  endpoint: DYNAMODB_ENDPOINT,
  credentials: DYNAMODB_ENDPOINT ? {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy'
  } : undefined
});

const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

// テーブル名の生成
const getTableName = (tableName: string) => `${PROJECT_NAME}-${ENVIRONMENT}-${tableName}`;

// カテゴリの初期データ
const categories = [
  {
    id: 'category-compute',
    name: 'コンピューティング',
    nameEn: 'Compute',
    description: 'EC2、Lambda、ECS等のコンピューティングサービス',
    descriptionEn: 'Computing services like EC2, Lambda, ECS',
    icon: '💻',
    sortOrder: 1,
    awsServices: ['EC2', 'Lambda', 'ECS', 'Fargate', 'Batch'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'category-storage',
    name: 'ストレージ',
    nameEn: 'Storage',
    description: 'S3、EBS、EFS等のストレージサービス',
    descriptionEn: 'Storage services like S3, EBS, EFS',
    icon: '🗄️',
    sortOrder: 2,
    awsServices: ['S3', 'EBS', 'EFS', 'FSx', 'Storage Gateway'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'category-database',
    name: 'データベース',
    nameEn: 'Database',
    description: 'RDS、DynamoDB、ElastiCache等のデータベースサービス',
    descriptionEn: 'Database services like RDS, DynamoDB, ElastiCache',
    icon: '🗃️',
    sortOrder: 3,
    awsServices: ['RDS', 'DynamoDB', 'ElastiCache', 'DocumentDB', 'Neptune'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'category-networking',
    name: 'ネットワーキング',
    nameEn: 'Networking',
    description: 'VPC、CloudFront、Route53等のネットワークサービス',
    descriptionEn: 'Networking services like VPC, CloudFront, Route53',
    icon: '🌐',
    sortOrder: 4,
    awsServices: ['VPC', 'CloudFront', 'Route53', 'API Gateway', 'Direct Connect'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'category-security',
    name: 'セキュリティ',
    nameEn: 'Security',
    description: 'IAM、Cognito、WAF等のセキュリティサービス',
    descriptionEn: 'Security services like IAM, Cognito, WAF',
    icon: '🔒',
    sortOrder: 5,
    awsServices: ['IAM', 'Cognito', 'WAF', 'Shield', 'GuardDuty'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'category-general',
    name: '一般的な質問',
    nameEn: 'General Questions',
    description: 'AWS全般に関する質問や議論',
    descriptionEn: 'General AWS questions and discussions',
    icon: '💬',
    sortOrder: 6,
    awsServices: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// サンプル投稿データ
const samplePosts = [
  {
    id: 'post-welcome',
    userId: 'system',
    categoryId: 'category-general',
    title: 'AWS Engineers Communityへようこそ！',
    titleEn: 'Welcome to AWS Engineers Community!',
    content: `このコミュニティは、世界中のAWSエンジニアが言語の壁を越えて交流できる場所です。

## 主な機能
- 自動翻訳機能により、投稿は各ユーザーの設定言語で表示されます
- AWSサービス別のカテゴリで整理された議論
- 画像やURLプレビューに対応したリッチな投稿
- AWS認定資格や専門分野でのプロフィール設定

## 使い方
1. プロフィールで言語設定を行ってください
2. 興味のあるカテゴリで質問や知見を投稿してください
3. 他のエンジニアの投稿にコメントして交流しましょう

質問や提案があれば、お気軽に投稿してください！`,
    contentEn: `This community is a place where AWS engineers from around the world can interact beyond language barriers.

## Main Features
- Automatic translation feature displays posts in each user's preferred language
- Discussions organized by AWS service categories
- Rich posts with image and URL preview support
- Profile settings for AWS certifications and specialties

## How to Use
1. Set your language preference in your profile
2. Post questions and insights in categories of interest
3. Comment on other engineers' posts to interact

Feel free to post any questions or suggestions!`,
    originalLanguage: 'ja',
    tags: ['welcome', 'community', 'getting-started'],
    imageUrls: [],
    urlPreviews: [],
    viewCount: 0,
    reactionCounts: {
      like: 0,
      helpful: 0,
      thanks: 0
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

/**
 * カテゴリデータを投入
 */
async function insertCategories() {
  console.log('📂 カテゴリデータを投入中...');
  
  for (const category of categories) {
    try {
      await docClient.send(new PutCommand({
        TableName: getTableName('categories'),
        Item: category
      }));
      console.log(`✅ カテゴリ投入完了: ${category.name}`);
    } catch (error) {
      console.error(`❌ カテゴリ投入エラー: ${category.name}`, error);
    }
  }
}

/**
 * サンプル投稿データを投入
 */
async function insertSamplePosts() {
  console.log('📝 サンプル投稿データを投入中...');
  
  for (const post of samplePosts) {
    try {
      await docClient.send(new PutCommand({
        TableName: getTableName('posts'),
        Item: post
      }));
      console.log(`✅ 投稿投入完了: ${post.title}`);
    } catch (error) {
      console.error(`❌ 投稿投入エラー: ${post.title}`, error);
    }
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 DynamoDBテーブル初期化を開始...');
  console.log(`環境: ${ENVIRONMENT}`);
  console.log(`プロジェクト: ${PROJECT_NAME}`);
  console.log(`リージョン: ${AWS_REGION}`);
  if (DYNAMODB_ENDPOINT) {
    console.log(`DynamoDB Endpoint: ${DYNAMODB_ENDPOINT}`);
  }
  console.log('');

  try {
    await insertCategories();
    console.log('');
    await insertSamplePosts();
    console.log('');
    console.log('🎉 DynamoDBテーブル初期化が完了しました！');
  } catch (error) {
    console.error('❌ 初期化中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  main();
}

export { main as setupDatabase };