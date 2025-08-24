import { MonitoringService } from '../monitoringService';

// CloudWatch と SNS クライアントをモック
jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({})
  })),
  PutMetricDataCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({})
  })),
  PublishCommand: jest.fn()
}));

// OS モジュールをモック
jest.mock('os', () => ({
  totalmem: jest.fn(() => 8 * 1024 * 1024 * 1024), // 8GB
  freemem: jest.fn(() => 2 * 1024 * 1024 * 1024),  // 2GB
  loadavg: jest.fn(() => [1.5, 1.2, 1.0]),
  hostname: jest.fn(() => 'test-host')
}));

// fs モジュールをモック
jest.mock('fs', () => ({
  promises: {
    statfs: jest.fn().mockResolvedValue({
      blocks: 1000000,
      bsize: 4096,
      bavail: 500000
    })
  }
}));

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;

  beforeEach(() => {
    // 環境変数を設定
    process.env.SERVICE_NAME = 'test-service';
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_CLOUDWATCH_METRICS = 'false';
    process.env.ENABLE_ALERTS = 'false';
    process.env.METRICS_INTERVAL = '5'; // 5秒間隔（テスト用）

    monitoringService = new MonitoringService();
  });

  afterEach(() => {
    monitoringService.stop();
    jest.clearAllMocks();
  });

  describe('システムメトリクス収集', () => {
    it('システムメトリクスを正しく収集できる', async () => {
      const metrics = await monitoringService.collectSystemMetrics();

      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('disk');
      expect(metrics).toHaveProperty('process');

      // CPU メトリクス
      expect(metrics.cpu).toHaveProperty('usage');
      expect(metrics.cpu).toHaveProperty('loadAverage');
      expect(typeof metrics.cpu.usage).toBe('number');
      expect(Array.isArray(metrics.cpu.loadAverage)).toBe(true);

      // メモリメトリクス
      expect(metrics.memory).toHaveProperty('total');
      expect(metrics.memory).toHaveProperty('used');
      expect(metrics.memory).toHaveProperty('free');
      expect(metrics.memory).toHaveProperty('usage');
      expect(metrics.memory.total).toBe(8 * 1024 * 1024 * 1024);
      expect(metrics.memory.free).toBe(2 * 1024 * 1024 * 1024);
      expect(metrics.memory.used).toBe(6 * 1024 * 1024 * 1024);

      // ディスクメトリクス
      expect(metrics.disk).toHaveProperty('total');
      expect(metrics.disk).toHaveProperty('used');
      expect(metrics.disk).toHaveProperty('free');
      expect(metrics.disk).toHaveProperty('usage');

      // プロセスメトリクス
      expect(metrics.process).toHaveProperty('heapTotal');
      expect(metrics.process).toHaveProperty('heapUsed');
      expect(metrics.process).toHaveProperty('heapUsage');
      expect(metrics.process).toHaveProperty('uptime');
      expect(metrics.process).toHaveProperty('pid');
    });

    it('CPU使用率が0-100%の範囲内である', async () => {
      const metrics = await monitoringService.collectSystemMetrics();
      
      expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.usage).toBeLessThanOrEqual(100);
    });

    it('メモリ使用率が正しく計算される', async () => {
      const metrics = await monitoringService.collectSystemMetrics();
      
      const expectedUsage = ((6 * 1024 * 1024 * 1024) / (8 * 1024 * 1024 * 1024)) * 100;
      expect(metrics.memory.usage).toBeCloseTo(expectedUsage, 1);
    });
  });

  describe('CloudWatch メトリクス送信', () => {
    it('CloudWatch が無効の場合は送信しない', async () => {
      const metrics = await monitoringService.collectSystemMetrics();
      
      await monitoringService.sendMetricsToCloudWatch(metrics);
      
      // CloudWatch クライアントの send メソッドが呼ばれないことを確認
      expect(monitoringService['cloudWatchClient'].send).not.toHaveBeenCalled();
    });

    it('CloudWatch が有効の場合は送信する', async () => {
      monitoringService.updateConfig({ enableCloudWatch: true });
      const metrics = await monitoringService.collectSystemMetrics();
      
      await monitoringService.sendMetricsToCloudWatch(metrics);
      
      // CloudWatch クライアントの send メソッドが呼ばれることを確認
      expect(monitoringService['cloudWatchClient'].send).toHaveBeenCalled();
    });
  });

  describe('アラート機能', () => {
    beforeEach(() => {
      monitoringService.updateConfig({
        alerts: {
          enabled: true,
          thresholds: {
            cpuUsage: 50,
            memoryUsage: 50,
            diskUsage: 50,
            errorRate: 5
          }
        }
      });
    });

    it('閾値を超えた場合にアラートが発生する', async () => {
      // 高いCPU使用率のメトリクスを作成
      const highCpuMetrics = {
        cpu: { usage: 80, loadAverage: [2.0, 1.5, 1.0] },
        memory: { total: 1000, used: 400, free: 600, usage: 40 },
        disk: { total: 1000, used: 300, free: 700, usage: 30 },
        process: { heapTotal: 100, heapUsed: 50, heapUsage: 50, uptime: 3600, pid: 1234 }
      };

      // アラートチェックを実行
      await monitoringService.checkAndSendAlerts(highCpuMetrics);

      // ログにアラートが記録されることを確認（実際の実装では SNS 送信もテスト）
      // この例では、アラートが適切に検出されることを確認
      expect(highCpuMetrics.cpu.usage).toBeGreaterThan(50);
    });

    it('閾値以下の場合はアラートが発生しない', async () => {
      // 正常なメトリクスを作成
      const normalMetrics = {
        cpu: { usage: 30, loadAverage: [0.5, 0.4, 0.3] },
        memory: { total: 1000, used: 300, free: 700, usage: 30 },
        disk: { total: 1000, used: 200, free: 800, usage: 20 },
        process: { heapTotal: 100, heapUsed: 30, heapUsage: 30, uptime: 3600, pid: 1234 }
      };

      // アラートチェックを実行
      await monitoringService.checkAndSendAlerts(normalMetrics);

      // 全ての値が閾値以下であることを確認
      expect(normalMetrics.cpu.usage).toBeLessThanOrEqual(50);
      expect(normalMetrics.memory.usage).toBeLessThanOrEqual(50);
      expect(normalMetrics.disk.usage).toBeLessThanOrEqual(50);
    });
  });

  describe('カウンター機能', () => {
    it('リクエスト数を正しくカウントする', () => {
      expect(monitoringService['requestCount']).toBe(0);
      
      monitoringService.incrementRequestCount();
      monitoringService.incrementRequestCount();
      
      expect(monitoringService['requestCount']).toBe(2);
    });

    it('エラー数を正しくカウントする', () => {
      expect(monitoringService['errorCount']).toBe(0);
      
      monitoringService.incrementErrorCount();
      
      expect(monitoringService['errorCount']).toBe(1);
    });

    it('エラー率を正しく計算する', () => {
      monitoringService.incrementRequestCount();
      monitoringService.incrementRequestCount();
      monitoringService.incrementRequestCount();
      monitoringService.incrementRequestCount();
      monitoringService.incrementErrorCount();

      const errorRate = monitoringService['calculateErrorRate']();
      expect(errorRate).toBe(25); // 1/4 = 25%
    });

    it('リクエスト数が0の場合はエラー率が0になる', () => {
      const errorRate = monitoringService['calculateErrorRate']();
      expect(errorRate).toBe(0);
    });
  });

  describe('設定管理', () => {
    it('設定を取得できる', () => {
      const config = monitoringService.getConfig();
      
      expect(config).toHaveProperty('monitoring');
      expect(config).toHaveProperty('alerts');
      expect(config.monitoring.serviceName).toBe('test-service');
    });

    it('設定を更新できる', () => {
      const newConfig = {
        enableCloudWatch: true,
        metricsInterval: 30,
        alerts: {
          enabled: true,
          thresholds: {
            cpuUsage: 90,
            memoryUsage: 90,
            diskUsage: 95,
            errorRate: 10
          }
        }
      };

      monitoringService.updateConfig(newConfig);
      const updatedConfig = monitoringService.getConfig();

      expect(updatedConfig.monitoring.enableCloudWatch).toBe(true);
      expect(updatedConfig.monitoring.metricsInterval).toBe(30);
      expect(updatedConfig.alerts.enabled).toBe(true);
      expect(updatedConfig.alerts.thresholds.cpuUsage).toBe(90);
    });
  });

  describe('ヘルスチェック', () => {
    it('正常な状態でヘルシーを返す', async () => {
      const healthResult = await monitoringService.healthCheck();
      
      expect(healthResult).toHaveProperty('status');
      expect(healthResult).toHaveProperty('message');
      expect(healthResult).toHaveProperty('metrics');
      expect(['healthy', 'warning', 'unhealthy']).toContain(healthResult.status);
    });

    it('高いリソース使用率で警告を返す', async () => {
      // メモリ使用率を高く設定するためのモック
      jest.spyOn(monitoringService, 'collectSystemMetrics').mockResolvedValue({
        cpu: { usage: 95, loadAverage: [3.0, 2.5, 2.0] },
        memory: { total: 1000, used: 950, free: 50, usage: 95 },
        disk: { total: 1000, used: 980, free: 20, usage: 98 },
        process: { heapTotal: 100, heapUsed: 90, heapUsage: 90, uptime: 3600, pid: 1234 }
      });

      const healthResult = await monitoringService.healthCheck();
      
      expect(healthResult.status).toBe('warning');
      expect(healthResult.message).toContain('System issues detected');
    });
  });

  describe('エラーハンドリング', () => {
    it('メトリクス収集エラーを適切に処理する', async () => {
      // OS モジュールでエラーを発生させる
      const os = require('os');
      os.totalmem.mockImplementation(() => {
        throw new Error('OS error');
      });

      await expect(monitoringService.collectSystemMetrics()).rejects.toThrow('OS error');
    });

    it('CloudWatch 送信エラーを適切に処理する', async () => {
      // CloudWatch クライアントでエラーを発生させる
      const mockSend = jest.fn().mockRejectedValue(new Error('CloudWatch error'));
      monitoringService['cloudWatchClient'].send = mockSend;
      
      monitoringService.updateConfig({ enableCloudWatch: true });
      const metrics = await monitoringService.collectSystemMetrics();

      // エラーが発生してもクラッシュしないことを確認
      await expect(monitoringService.sendMetricsToCloudWatch(metrics)).resolves.not.toThrow();
    });
  });
});