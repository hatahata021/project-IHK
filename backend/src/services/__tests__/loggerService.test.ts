import { LoggerService, LogLevel } from '../loggerService';

// CloudWatch Logsクライアントをモック
jest.mock('@aws-sdk/client-cloudwatch-logs', () => ({
  CloudWatchLogsClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({})
  })),
  PutLogEventsCommand: jest.fn(),
  CreateLogGroupCommand: jest.fn(),
  CreateLogStreamCommand: jest.fn()
}));

describe('LoggerService', () => {
  let loggerService: LoggerService;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // コンソール出力をモック
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'debug').mockImplementation();

    // 環境変数を設定
    process.env.SERVICE_NAME = 'test-service';
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'DEBUG';
    process.env.ENABLE_CLOUDWATCH_LOGS = 'false';
    process.env.ENABLE_CONSOLE_LOGS = 'true';

    loggerService = new LoggerService();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    loggerService.destroy();
    jest.clearAllMocks();
  });

  describe('基本ログ出力', () => {
    it('エラーログを正しく出力できる', () => {
      const error = new Error('Test error');
      const metadata = { key: 'value' };

      loggerService.error('Test error message', error, metadata, 'req-123', 'user-456');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"ERROR"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Test error message"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"requestId":"req-123"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"userId":"user-456"')
      );
    });

    it('警告ログを正しく出力できる', () => {
      loggerService.warn('Test warning', { type: 'warning' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"WARN"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Test warning"')
      );
    });

    it('情報ログを正しく出力できる', () => {
      loggerService.info('Test info', { type: 'info' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"INFO"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Test info"')
      );
    });

    it('デバッグログを正しく出力できる', () => {
      loggerService.debug('Test debug', { type: 'debug' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"DEBUG"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Test debug"')
      );
    });
  });

  describe('特殊ログ出力', () => {
    it('アクセスログを正しく出力できる', () => {
      loggerService.access('GET', '/api/test', 200, 150, 'req-123', 'user-456', 'Mozilla/5.0');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"GET /api/test 200"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"method":"GET"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"statusCode":200')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"duration":150')
      );
    });

    it('パフォーマンスログを正しく出力できる', () => {
      loggerService.performance('database query', 250, { query: 'SELECT * FROM users' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Performance: database query completed in 250ms"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"duration":250')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"memoryUsage"')
      );
    });
  });

  describe('ログレベルフィルタリング', () => {
    it('ログレベルがERRORの場合、ERROR以上のログのみ出力される', () => {
      loggerService.updateConfig({ logLevel: LogLevel.ERROR });

      loggerService.error('Error message');
      loggerService.warn('Warning message');
      loggerService.info('Info message');
      loggerService.debug('Debug message');

      // ERRORログのみ出力される
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"ERROR"')
      );
    });

    it('ログレベルがINFOの場合、INFO以上のログが出力される', () => {
      loggerService.updateConfig({ logLevel: LogLevel.INFO });

      loggerService.error('Error message');
      loggerService.warn('Warning message');
      loggerService.info('Info message');
      loggerService.debug('Debug message');

      // ERROR, WARN, INFOログが出力される（DEBUGは出力されない）
      expect(consoleSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('設定管理', () => {
    it('設定を取得できる', () => {
      const config = loggerService.getConfig();

      expect(config).toMatchObject({
        serviceName: 'test-service',
        environment: 'test',
        logLevel: LogLevel.DEBUG,
        enableCloudWatch: false,
        enableConsole: true
      });
    });

    it('設定を更新できる', () => {
      const newConfig = {
        logLevel: LogLevel.WARN,
        enableConsole: false
      };

      loggerService.updateConfig(newConfig);
      const updatedConfig = loggerService.getConfig();

      expect(updatedConfig.logLevel).toBe(LogLevel.WARN);
      expect(updatedConfig.enableConsole).toBe(false);
    });
  });

  describe('CloudWatch Logs連携', () => {
    beforeEach(() => {
      // CloudWatch Logsを有効化
      loggerService.updateConfig({ enableCloudWatch: true });
    });

    it('ログがバッファリングされる', () => {
      loggerService.info('Test message 1');
      loggerService.info('Test message 2');

      // バッファに追加されることを確認（実際のCloudWatch送信はモック）
      expect(loggerService['logBuffer']).toHaveLength(2);
    });

    it('フラッシュ機能が動作する', async () => {
      loggerService.info('Test message');
      
      await loggerService.flush();

      // フラッシュ後はバッファがクリアされる
      expect(loggerService['logBuffer']).toHaveLength(0);
    });
  });

  describe('エラーハンドリング', () => {
    it('CloudWatch Logs送信エラーを適切に処理する', async () => {
      // CloudWatch Logsクライアントでエラーを発生させる
      const mockSend = jest.fn().mockRejectedValue(new Error('CloudWatch error'));
      loggerService['cloudWatchClient'].send = mockSend;
      
      loggerService.updateConfig({ enableCloudWatch: true });
      loggerService.info('Test message');

      // エラーが発生してもクラッシュしないことを確認
      await expect(loggerService.flush()).resolves.not.toThrow();
    });

    it('無効なログレベルを適切に処理する', () => {
      // 無効なログレベルを設定しても例外が発生しないことを確認
      expect(() => {
        loggerService['parseLogLevel']('INVALID');
      }).not.toThrow();

      // デフォルトのINFOレベルが返されることを確認
      const level = loggerService['parseLogLevel']('INVALID');
      expect(level).toBe(LogLevel.INFO);
    });
  });

  describe('メモリ管理', () => {
    it('バッファサイズ制限が機能する', () => {
      loggerService.updateConfig({ enableCloudWatch: true });

      // 大量のログを生成
      for (let i = 0; i < 150; i++) {
        loggerService.info(`Test message ${i}`);
      }

      // バッファサイズが制限されることを確認（100件でフラッシュされる）
      expect(loggerService['logBuffer'].length).toBeLessThan(100);
    });
  });
});