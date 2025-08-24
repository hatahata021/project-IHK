import { Request, Response } from 'express';
import { TranslationController } from '../translationController';
import { translationService } from '../../services/translationService';

// モック設定
jest.mock('../../services/translationService');
jest.mock('uuid', () => ({
  v4: () => 'test-request-id-123'
}));

const mockTranslationService = translationService as jest.Mocked<typeof translationService>;

describe('TranslationController', () => {
  let controller: TranslationController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    controller = new TranslationController();
    
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockRequest = {
      body: {}
    };
    
    mockResponse = {
      status: mockStatus,
      json: mockJson
    };

    // モックをリセット
    jest.clearAllMocks();
  });

  describe('translateText', () => {
    it('正常な翻訳リクエストを処理できる', async () => {
      // テストデータ
      const requestBody = {
        text: 'Hello, world!',
        sourceLanguage: 'en',
        targetLanguage: 'ja'
      };

      const translationResult = {
        originalText: 'Hello, world!',
        translatedText: 'こんにちは、世界！',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        confidence: 0.95,
        fromCache: false,
        processingTime: 150
      };

      mockRequest.body = requestBody;
      mockTranslationService.translateText.mockResolvedValue(translationResult);

      // テスト実行
      await controller.translateText(mockRequest as Request, mockResponse as Response);

      // 検証
      expect(mockTranslationService.translateText).toHaveBeenCalledWith({
        text: 'Hello, world!',
        sourceLanguage: 'en',
        targetLanguage: 'ja'
      });

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            originalText: 'Hello, world!',
            translatedText: 'こんにちは、世界！',
            sourceLanguage: 'en',
            targetLanguage: 'ja',
            confidence: 0.95,
            fromCache: false
          }),
          metadata: expect.objectContaining({
            requestId: 'test-request-id-123',
            version: '1.0.0'
          })
        })
      );
    });

    it('テキストが空の場合はエラーを返す', async () => {
      mockRequest.body = {
        text: '',
        targetLanguage: 'ja'
      };

      await controller.translateText(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_INPUT',
            message: '翻訳対象のテキストが必要です'
          })
        })
      );
    });

    it('翻訳先言語が指定されていない場合はエラーを返す', async () => {
      mockRequest.body = {
        text: 'Hello, world!'
      };

      await controller.translateText(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_TARGET_LANGUAGE',
            message: '翻訳先言語が必要です'
          })
        })
      );
    });

    it('翻訳サービスエラーを適切に処理する', async () => {
      mockRequest.body = {
        text: 'Hello, world!',
        targetLanguage: 'ja'
      };

      const error = new Error('Translation service error');
      (error as any).code = 'TRANSLATION_SERVICE_ERROR';
      mockTranslationService.translateText.mockRejectedValue(error);

      await controller.translateText(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(503);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'TRANSLATION_SERVICE_ERROR',
            message: 'Translation service error'
          })
        })
      );
    });
  });

  describe('translateBatch', () => {
    it('正常なバッチ翻訳リクエストを処理できる', async () => {
      const requestBody = {
        texts: ['Hello', 'World'],
        targetLanguage: 'ja',
        maxConcurrency: 2
      };

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

      mockRequest.body = requestBody;
      mockTranslationService.translateText
        .mockResolvedValueOnce(translationResults[0])
        .mockResolvedValueOnce(translationResults[1]);

      await controller.translateBatch(mockRequest as Request, mockResponse as Response);

      expect(mockTranslationService.translateText).toHaveBeenCalledTimes(2);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            results: expect.arrayContaining([
              expect.objectContaining({
                originalText: 'Hello',
                translatedText: 'こんにちは'
              }),
              expect.objectContaining({
                originalText: 'World',
                translatedText: '世界'
              })
            ]),
            successCount: 2,
            errorCount: 0
          })
        })
      );
    });

    it('テキスト配列が空の場合はエラーを返す', async () => {
      mockRequest.body = {
        texts: [],
        targetLanguage: 'ja'
      };

      await controller.translateBatch(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_INPUT',
            message: '翻訳対象のテキスト配列が必要です'
          })
        })
      );
    });

    it('テキスト数が制限を超える場合はエラーを返す', async () => {
      const texts = new Array(101).fill('test text');
      mockRequest.body = {
        texts,
        targetLanguage: 'ja'
      };

      await controller.translateBatch(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'TOO_MANY_TEXTS',
            message: 'バッチ翻訳は最大100件までです'
          })
        })
      );
    });
  });

  describe('detectLanguage', () => {
    it('正常な言語検出リクエストを処理できる', async () => {
      mockRequest.body = {
        text: 'こんにちは'
      };

      const detectionResult = {
        languageCode: 'ja',
        score: 0.95
      };

      mockTranslationService.detectLanguage.mockResolvedValue(detectionResult);

      await controller.detectLanguage(mockRequest as Request, mockResponse as Response);

      expect(mockTranslationService.detectLanguage).toHaveBeenCalledWith('こんにちは');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            languageCode: 'ja',
            confidence: 0.95,
            text: 'こんにちは'
          })
        })
      );
    });

    it('テキストが空の場合はエラーを返す', async () => {
      mockRequest.body = {
        text: ''
      };

      await controller.detectLanguage(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_INPUT',
            message: '言語検出対象のテキストが必要です'
          })
        })
      );
    });
  });

  describe('getSupportedLanguages', () => {
    it('サポート言語一覧を取得できる', async () => {
      const supportedLanguages = ['ja', 'en', 'zh', 'ko'];
      mockTranslationService.getSupportedLanguages.mockResolvedValue(supportedLanguages);
      mockTranslationService.getLanguageName
        .mockReturnValueOnce('日本語')
        .mockReturnValueOnce('English')
        .mockReturnValueOnce('中文')
        .mockReturnValueOnce('한국어');

      await controller.getSupportedLanguages(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            languages: [
              { code: 'ja', name: '日本語' },
              { code: 'en', name: 'English' },
              { code: 'zh', name: '中文' },
              { code: 'ko', name: '한국어' }
            ],
            count: 4
          })
        })
      );
    });
  });

  describe('healthCheck', () => {
    it('正常なヘルスチェック結果を返す', async () => {
      const healthResult = {
        status: 'healthy',
        message: '翻訳サービスは正常に動作しています'
      };

      mockTranslationService.healthCheck.mockResolvedValue(healthResult);

      await controller.healthCheck(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            status: 'healthy',
            message: '翻訳サービスは正常に動作しています'
          })
        })
      );
    });

    it('異常なヘルスチェック結果を返す', async () => {
      const healthResult = {
        status: 'unhealthy',
        message: '翻訳サービスでエラーが発生しました'
      };

      mockTranslationService.healthCheck.mockResolvedValue(healthResult);

      await controller.healthCheck(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(503);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            status: 'unhealthy',
            message: '翻訳サービスでエラーが発生しました'
          })
        })
      );
    });
  });
});