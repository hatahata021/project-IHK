import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// ルートのインポート
import translationRoutes from './routes/translation';
import translationCacheRoutes from './routes/translationCache';

// ミドルウェアのインポート
import { validationMiddleware } from './middleware/validation';

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

// 共通バリデーションミドルウェア
app.use(validationMiddleware.validateRequestSize);
app.use(validationMiddleware.validateContentType);

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
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

// エラーハンドラー
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});