# マルチステージビルドでイメージサイズを最適化
FROM node:18-alpine AS base

# 作業ディレクトリを設定
WORKDIR /app

# パッケージファイルをコピー
COPY package*.json ./

# 開発段階
FROM base AS development
# 開発用依存関係をインストール
RUN npm ci
# ソースコードをコピー
COPY . .
# 開発サーバーを起動
CMD ["npm", "run", "dev"]

# ビルド段階
FROM base AS build
# 本番用依存関係をインストール
RUN npm ci --only=production && npm cache clean --force
# ソースコードをコピー
COPY . .
# TypeScriptをビルド
RUN npm run build

# 本番段階
FROM node:18-alpine AS production
# セキュリティのため非rootユーザーを作成
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 作業ディレクトリを設定
WORKDIR /app

# 本番用依存関係をコピー
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

# ファイルの所有者を変更
RUN chown -R nodejs:nodejs /app
USER nodejs

# ポートを公開
EXPOSE 3001

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# アプリケーションを起動
CMD ["npm", "start"]