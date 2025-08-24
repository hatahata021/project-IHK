import request from 'supertest';
import express from 'express';
import translationRoutes from '../translation';
import { translationService } from '../../services/translationService';

// モック設定
jest.mock('../../services/translationService');
jest.mock('../../middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-123', email: 'test@example.com' };
    next();
  }
}));

const mockTranslationService = translationService as jest.Mocked<typeof translationService>;

describe('Translation Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/translate', translationRoutes);
    
    // モックをリセット
    jest.clearAllMocks();
  });

  describe('POST /api/translate', () => {
    it('正常な翻訳リクエストを処理できる', async () => {
      const translationResult = {
        originalText: 'Hello, world!',
        translatedText: 'こんにちは、世界！',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        confidence: 0.95,
        fromCache: false,
        processingTime: 150
      };

      mockTranslationService.translateText.mockResolvedValue(translationResult);

      const response = await request(app)
        .post('/api/translate')
        .send({
          text: 'Hello, world!',
          sourceLanguage: 'en',
          targetLanguage: 'ja'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          originalText: 'Hello, world!',
          translatedText: 'こんにちは、世界！',
          sourceLanguage: 'en',
          targetLanguage: 'ja',
          confidence: 0.95,
          fromCache: false
        },
        metadata: {
          version: '1.0.0'
        }
      });

      expect(mockTranslationService.translateText).toHaveBeenCalledWith({
        text: 'Hello, world!',
        sourceLanguage: 'en',
        targetLanguage: 'ja'
      });
    });

    it('バリデーションエラーを適切に処理する', async () => {
      const response = await request(app)
        .post('/api/translate')
        .send({
          text: '',
          targetLanguage: 'ja'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値に問題があります',
          details: {
            text: ['テキストが空です']
          }
        }
      });
    });

    it('サポートされていない言語でエラーを返す', async () => {
      const response = await request(app)
        .post('/api/translate')
        .send({
          text: 'Hello, world!',
          targetLanguage: 'invalid-lang'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: {
            targetLanguage: ['サポートされていない言語です: invalid-lang']
          }
        }
      });
    });
  });

  describe('POST /api/translate/batch', () => {
    it('正常なバッチ翻訳リクエストを処理できる', async () => {
      const translationResults = [
        {
          originalText: 'Hello',
          translatedText: 'こんにちは',
          sourceLanguage: 'en',
          targetLanguage: 'ja',
          confidence: 0.95,
          fromCache: false,
          processingTime: 100
        },
        {
          originalText: 'World',
          translatedText: '世界',
          sourceLanguage: 'en',
          targetLanguage: 'ja',
          confidence: 0.90,
          fromCache: false,
          processingTime: 120
        }
      ];

      mockTranslationService.translateText
        .mockResolvedValueOnce(translationResults[0])
        .mockResolvedValueOnce(translationResults[1]);

      const response = await request(app)
        .post('/api/translate/batch')
        .send({
          texts: ['Hello', 'World'],
          targetLanguage: 'ja',
          maxConcurrency: 2
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          successCount: 2,
          errorCount: 0,
          results: expect.arrayContaining([
            expect.objectContaining({
              originalText: 'Hello',
              translatedText: 'こんにちは'
            }),
            expect.objectContaining({
              originalText: 'World',
              translatedText: '世界'
            })
          ])
        }
      });

      expect(mockTranslationService.translateText).toHaveBeenCalledTimes(2);
    });

    it('テキスト配列が空の場合はエラーを返す', async () => {
      const response = await request(app)
        .post('/api/translate/batch')
        .send({
          texts: [],
          targetLanguage: 'ja'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: {
            texts: ['テキスト配列が空です']
          }
        }
      });
    });

    it('テキスト数が制限を超える場合はエラーを返す', async () => {
      const texts = new Array(101).fill('test text');
      
      const response = await request(app)
        .post('/api/translate/batch')
        .send({
          texts,
          targetLanguage: 'ja'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: {
            texts: ['バッチ翻訳は最大100件までです']
          }
        }
      });
    });
  });

  describe('POST /api/translate/detect', () => {
    it('正常な言語検出リクエストを処理できる', async () => {
      const detectionResult = {
        languageCode: 'ja',
        score: 0.95
      };

      mockTranslationService.detectLanguage.mockResolvedValue(detectionResult);

      const response = await request(app)
        .post('/api/translate/detect')
        .send({
          text: 'こんにちは'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          languageCode: 'ja',
          confidence: 0.95,
          text: 'こんにちは'
        }
      });

      expect(mockTranslationService.detectLanguage).toHaveBeenCalledWith('こんにちは');
    });

    it('テキストが空の場合はエラーを返す', async () => {
      const response = await request(app)
        .post('/api/translate/detect')
        .send({
          text: ''
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: {
            text: ['テキストが空です']
          }
        }
      });
    });
  });

  describe('GET /api/translate/languages', () => {
    it('サポート言語一覧を取得できる', async () => {
      const supportedLanguages = ['ja', 'en', 'zh', 'ko'];
      mockTranslationService.getSupportedLanguages.mockResolvedValue(supportedLanguages);
      mockTranslationService.getLanguageName
        .mockReturnValueOnce('日本語')
        .mockReturnValueOnce('English')
        .mockReturnValueOnce('中文')
        .mockReturnValueOnce('한국어');

      const response = await request(app)
        .get('/api/translate/languages')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          languages: [
            { code: 'ja', name: '日本語' },
            { code: 'en', name: 'English' },
            { code: 'zh', name: '中文' },
            { code: 'ko', name: '한국어' }
          ],
          count: 4
        }
      });
    });
  });

  describe('GET /api/translate/health', () => {
    it('正常なヘルスチェック結果を返す', async () => {
      const healthResult = {
        status: 'healthy',
        message: '翻訳サービスは正常に動作しています'
      };

      mockTranslationService.healthCheck.mockResolvedValue(healthResult);

      const response = await request(app)
        .get('/api/translate/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          message: '翻訳サービスは正常に動作しています'
        }
      });
    });

    it('異常なヘルスチェック結果を返す', async () => {
      const healthResult = {
        status: 'unhealthy',
        message: '翻訳サービスでエラーが発生しました'
      };

      mockTranslationService.healthCheck.mockResolvedValue(healthResult);

      const response = await request(app)
        .get('/api/translate/health')
        .expect(503);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'unhealthy',
          message: '翻訳サービスでエラーが発生しました'
        }
      });
    });
  });
});