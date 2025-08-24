# Node.js 18 LTS版を使用
FROM node:18-alpine

# 作業ディレクトリを設定
WORKDIR /app

# パッケージファイルをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# アプリケーションコードをコピー
COPY . .

# TypeScriptをビルド
RUN npm run build

# ポート3001を公開
EXPOSE 3001

# 本番環境用のユーザーを作成
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# ファイルの所有者を変更
RUN chown -R nodejs:nodejs /app
USER nodejs

# アプリケーションを起動
CMD ["npm", "start"]