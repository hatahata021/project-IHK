import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// ルートのインポート
import translationRoutes from './routes/translation';
import translationCacheRoutes from './routes/translationCache';
import logRoutes from './routes/logs';

// ミドルウェアのインポート
import { validationMiddleware } from './middleware/validation';
import { 
  accessLogMiddleware, 
  errorLogMiddleware, 
  performanceLogMiddleware, 
  securityLogMiddleware 
} from './middleware/logging';

// ログサービスのインポート
import { logger } from './services/loggerService';

// 環境変数の読み込み
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// セキュリティミドルウェア
app.use(helmet());

// CORS設定
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// JSON解析ミドルウェア
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ログミドルウェア（最初に設定）
app.use(accessLogMiddleware);
app.use(performanceLogMiddleware(1000)); // 1秒以上のリクエストをログ
app.use(securityLogMiddleware);

// 共通バリデーションミドルウェア
app.use(validationMiddleware.validateRequestSize);
app.use(validationMiddleware.validateContentType);

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  logger.info('Health check requested', { endpoint: '/health' });
  
  res.status(200).json({
    status: 'OK',
    message: 'AWS Engineers Community API is running',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// APIルートの設定
app.use('/api/translate', translationRoutes);
app.use('/api/translation-cache', translationCacheRoutes);
app.use('/api/logs', logRoutes);

// 基本的なルート
app.get('/', (req, res) => {
  res.json({
    message: 'AWS Engineers Community API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      forum: '/api/forum',
      translate: '/api/translate',
      translationCache: '/api/translation-cache',
      logs: '/api/logs',
      upload: '/api/upload'
    }
  });
});

// 404ハンドラー
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// エラーハンドラー（ログミドルウェアを使用）
app.use(errorLogMiddleware);

// サーバー起動
app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    healthCheck: `http://localhost:${PORT}/health`,
    version: '0.1.0'
  });
  
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  logger.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  logger.destroy();
  process.exit(0);
});