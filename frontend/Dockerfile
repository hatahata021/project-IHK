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
# 依存関係をインストール
RUN npm ci
# ソースコードをコピー
COPY . .
# Next.jsアプリケーションをビルド
RUN npm run build

# 本番段階
FROM node:18-alpine AS production
# セキュリティのため非rootユーザーを作成
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# 作業ディレクトリを設定
WORKDIR /app

# 本番用依存関係をコピー
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# ファイルの所有者を変更
RUN chown -R nextjs:nodejs /app
USER nextjs

# ポートを公開
EXPOSE 3000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# アプリケーションを起動
CMD ["node", "server.js"]