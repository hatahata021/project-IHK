/**
 * AWSサービスタグ管理サービスのテスト
 */

const AWSServiceTagService = require('../awsServiceTagService');
const AWSServiceTagModel = require('../../models/awsServiceTag');
const ServiceTagRelationModel = require('../../models/serviceTagRelation');
const AWSServiceModel = require('../../models/awsService');

// モデルをモック化
jest.mock('../../models/awsServiceTag');
jest.mock('../../models/serviceTagRelation');
jest.mock('../../models/awsService');

describe('AWSServiceTagService', () => {
  let tagService;
  let mockTagModel;
  let mockRelationModel;
  let mockServiceModel;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // AWSServiceTagModelのモック
    mockTagModel = {
      createTag: jest.fn(),
      getTag: jest.fn(),
      getAllTags: jest.fn(),
      updateUsageCount: jest.fn(),
      getTagCloudData: jest.fn(),
      getTagStatistics: jest.fn()
    };
    AWSServiceTagModel.mockImplementation(() => mockTagModel);
    
    // ServiceTagRelationModelのモック
    mockRelationModel = {
      updateServiceTags: jest.fn(),
      assignTagToService: jest.fn(),
      findServicesByTags: jest.fn(),
      getServiceTags: jest.fn(),
      getTagServices: jest.fn(),
      getRelationStatistics: jest.fn(),
      findOrphanedRelations: jest.fn()
    };
    ServiceTagRelationModel.mockImplementation(() => mockRelationModel);
    
    // AWSServiceModelのモック
    mockServiceModel = {
      getService: jest.fn(),
      getAllServices: jest.fn()
    };
    AWSServiceModel.mockImplementation(() => mockServiceModel);
    
    tagService = new AWSServiceTagService();
  });

  describe('initializeDefaultTags', () => {
    it('デフォルトタグを正常に初期化する', async () => {
      mockTagModel.createTag.mockResolvedValue({
        success: true,
        tag: { tagId: 'tag_12345678', name: 'serverless' }
      });

      const result = await tagService.initializeDefaultTags();

      expect(result.success).toBe(true);
      expect(result.details.created).toHaveLength(20); // デフォルトタグ数
      expect(mockTagModel.createTag).toHaveBeenCalledTimes(20);
    });

    it('既存タグがある場合はスキップする', async () => {
      mockTagModel.createTag
        .mockResolvedValueOnce({ success: true, tag: { name: 'serverless' } })
        .mockRejectedValueOnce(new Error('タグが既に存在します'))
        .mockResolvedValueOnce({ success: true, tag: { name: 'container' } });

      const result = await tagService.initializeDefaultTags();

      expect(result.success).toBe(true);
      expect(result.details.created).toHaveLength(2);
      expect(result.details.skipped).toHaveLength(1);
    });
  });

  describe('assignTagsToService', () => {
    it('サービスにタグを正常に割り当てる', async () => {
      const serviceId = 'svc_12345678';
      const tagIds = ['tag_12345678', 'tag_87654321'];

      const mockService = {
        serviceId,
        serviceName: 'Lambda'
      };

      const mockTags = [
        { tagId: 'tag_12345678', name: 'serverless' },
        { tagId: 'tag_87654321', name: 'compute' }
      ];

      const mockResult = {
        success: true,
        results: {
          added: [
            { tagId: 'tag_12345678' },
            { tagId: 'tag_87654321' }
          ],
          removed: [],
          errors: []
        }
      };

      mockServiceModel.getService.mockResolvedValue(mockService);
      mockTagModel.getTag
        .mockResolvedValueOnce(mockTags[0])
        .mockResolvedValueOnce(mockTags[1]);
      mockRelationModel.updateServiceTags.mockResolvedValue(mockResult);
      mockTagModel.updateUsageCount.mockResolvedValue(true);

      const result = await tagService.assignTagsToService(serviceId, tagIds);

      expect(result.success).toBe(true);
      expect(mockServiceModel.getService).toHaveBeenCalledWith(serviceId);
      expect(mockTagModel.getTag).toHaveBeenCalledTimes(2);
      expect(mockRelationModel.updateServiceTags).toHaveBeenCalledWith(serviceId, tagIds, expect.any(Object));
      expect(mockTagModel.updateUsageCount).toHaveBeenCalledTimes(2);
    });

    it('存在しないサービスの場合はエラーを返す', async () => {
      const serviceId = 'svc_nonexistent';
      const tagIds = ['tag_12345678'];

      mockServiceModel.getService.mockResolvedValue(null);

      await expect(tagService.assignTagsToService(serviceId, tagIds))
        .rejects.toThrow('サービスが見つかりません');
    });

    it('無効なタグが含まれる場合はエラーを返す', async () => {
      const serviceId = 'svc_12345678';
      const tagIds = ['tag_12345678', 'tag_invalid'];

      const mockService = { serviceId, serviceName: 'Lambda' };

      mockServiceModel.getService.mockResolvedValue(mockService);
      mockTagModel.getTag
        .mockResolvedValueOnce({ tagId: 'tag_12345678', name: 'serverless' })
        .mockResolvedValueOnce(null);

      await expect(tagService.assignTagsToService(serviceId, tagIds))
        .rejects.toThrow('無効なタグが含まれています: tag_invalid');
    });
  });

  describe('autoTagService', () => {
    it('Lambdaサービスに適切なタグを自動割り当てする', async () => {
      const serviceId = 'svc_12345678';
      const mockService = {
        serviceId,
        serviceName: 'AWS Lambda',
        description: 'Serverless compute service'
      };

      const mockTags = [
        { tagId: 'tag_serverless', name: 'serverless', isOfficial: true, usageCount: 20 },
        { tagId: 'tag_compute', name: 'compute', isOfficial: true, usageCount: 15 }
      ];

      const mockAssignResults = [
        { success: true, relation: { tagId: 'tag_serverless' } },
        { success: true, relation: { tagId: 'tag_compute' } }
      ];

      mockServiceModel.getService.mockResolvedValue(mockService);
      mockTagModel.getAllTags.mockResolvedValue(mockTags);
      mockRelationModel.assignTagToService
        .mockResolvedValueOnce(mockAssignResults[0])
        .mockResolvedValueOnce(mockAssignResults[1]);
      mockTagModel.updateUsageCount.mockResolvedValue(true);

      const result = await tagService.autoTagService(serviceId);

      expect(result.success).toBe(true);
      expect(result.assignedTags).toHaveLength(2);
      expect(result.suggestedTags).toHaveLength(2);
      expect(mockRelationModel.assignTagToService).toHaveBeenCalledTimes(2);
    });

    it('推奨タグが見つからない場合は適切なメッセージを返す', async () => {
      const serviceId = 'svc_12345678';
      const mockService = {
        serviceId,
        serviceName: 'Unknown Service',
        description: 'Unknown service description'
      };

      mockServiceModel.getService.mockResolvedValue(mockService);
      mockTagModel.getAllTags.mockResolvedValue([]);

      const result = await tagService.autoTagService(serviceId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('推奨タグが見つかりませんでした');
      expect(result.suggestedTags).toHaveLength(0);
    });
  });

  describe('searchServicesByTags', () => {
    it('タグベースでサービスを正常に検索する', async () => {
      const tagIds = ['tag_12345678', 'tag_87654321'];
      
      const mockSearchResults = [
        {
          serviceId: 'svc_12345678',
          matchedTags: 2,
          relations: []
        },
        {
          serviceId: 'svc_87654321',
          matchedTags: 1,
          relations: []
        }
      ];

      const mockServices = [
        { serviceId: 'svc_12345678', serviceName: 'Lambda' },
        { serviceId: 'svc_87654321', serviceName: 'API Gateway' }
      ];

      mockRelationModel.findServicesByTags.mockResolvedValue(mockSearchResults);
      mockServiceModel.getService
        .mockResolvedValueOnce(mockServices[0])
        .mockResolvedValueOnce(mockServices[1]);

      const result = await tagService.searchServicesByTags(tagIds);

      expect(result.success).toBe(true);
      expect(result.totalResults).toBe(2);
      expect(result.services).toHaveLength(2);
      expect(result.services[0].matchedTags).toBe(2);
      expect(result.services[0].matchRatio).toBe(1.0);
    });
  });

  describe('getServiceWithTags', () => {
    it('サービスのタグ一覧を正常に取得する', async () => {
      const serviceId = 'svc_12345678';
      
      const mockService = {
        serviceId,
        serviceName: 'Lambda'
      };

      const mockTagRelations = [
        {
          tagId: 'tag_12345678',
          assignmentType: 'manual',
          confidence: 1.0,
          assignedBy: 'user123'
        }
      ];

      const mockTag = {
        tagId: 'tag_12345678',
        name: 'serverless',
        category: 'technical',
        type: 'technology'
      };

      mockServiceModel.getService.mockResolvedValue(mockService);
      mockRelationModel.getServiceTags.mockResolvedValue(mockTagRelations);
      mockTagModel.getTag.mockResolvedValue(mockTag);

      const result = await tagService.getServiceWithTags(serviceId);

      expect(result.service).toEqual(mockService);
      expect(result.tags).toHaveLength(1);
      expect(result.tags[0].name).toBe('serverless');
      expect(result.tags[0].relation.assignmentType).toBe('manual');
      expect(result.tagsByCategory.technical).toHaveLength(1);
      expect(result.tagsByType.technology).toHaveLength(1);
    });

    it('存在しないサービスの場合はエラーを返す', async () => {
      const serviceId = 'svc_nonexistent';

      mockServiceModel.getService.mockResolvedValue(null);

      await expect(tagService.getServiceWithTags(serviceId))
        .rejects.toThrow('サービスが見つかりません');
    });
  });

  describe('getTagCloud', () => {
    it('タグクラウドデータを正常に取得する', async () => {
      const mockTagCloudData = [
        {
          tagId: 'tag_12345678',
          name: 'serverless',
          usageCount: 25,
          sizeLevel: 5,
          color: '#FF9900'
        },
        {
          tagId: 'tag_87654321',
          name: 'container',
          usageCount: 15,
          sizeLevel: 3,
          color: '#3F48CC'
        }
      ];

      mockTagModel.getTagCloudData.mockResolvedValue(mockTagCloudData);

      const result = await tagService.getTagCloud({ limit: 50 });

      expect(result.success).toBe(true);
      expect(result.tagCloud).toEqual(mockTagCloudData);
      expect(result.totalTags).toBe(2);
    });
  });

  describe('getTagStatistics', () => {
    it('タグ統計情報を正常に取得する', async () => {
      const mockTagStats = {
        totalTags: 100,
        activeTags: 95,
        officialTags: 20,
        totalUsage: 500
      };

      const mockRelationStats = {
        totalRelations: 300,
        averageTagsPerService: 3.2,
        averageServicesPerTag: 2.1
      };

      mockTagModel.getTagStatistics.mockResolvedValue(mockTagStats);
      mockRelationModel.getRelationStatistics.mockResolvedValue(mockRelationStats);

      const result = await tagService.getTagStatistics();

      expect(result.tags).toEqual(mockTagStats);
      expect(result.relations).toEqual(mockRelationStats);
      expect(result.summary.totalTags).toBe(100);
      expect(result.summary.totalRelations).toBe(300);
      expect(result.summary.tagUtilizationRate).toBe(5.26); // 500/95
    });
  });

  describe('getRelatedTags', () => {
    it('関連タグを正常に取得する', async () => {
      const tagId = 'tag_12345678';
      
      const mockTagServices = [
        { serviceId: 'svc_1' },
        { serviceId: 'svc_2' }
      ];

      const mockServiceTags = [
        [
          { tagId: 'tag_87654321' },
          { tagId: 'tag_11111111' }
        ],
        [
          { tagId: 'tag_87654321' },
          { tagId: 'tag_22222222' }
        ]
      ];

      const mockRelatedTags = [
        { tagId: 'tag_87654321', name: 'api-gateway' },
        { tagId: 'tag_11111111', name: 'managed' },
        { tagId: 'tag_22222222', name: 'scalable' }
      ];

      mockRelationModel.getTagServices.mockResolvedValue(mockTagServices);
      mockRelationModel.getServiceTags
        .mockResolvedValueOnce(mockServiceTags[0])
        .mockResolvedValueOnce(mockServiceTags[1]);
      mockTagModel.getTag
        .mockResolvedValueOnce(mockRelatedTags[0])
        .mockResolvedValueOnce(mockRelatedTags[1])
        .mockResolvedValueOnce(mockRelatedTags[2]);

      const result = await tagService.getRelatedTags(tagId, 10);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('api-gateway');
      expect(result[0].relationCount).toBe(2); // 2つのサービスで共通
      expect(result[0].relationStrength).toBe(1.0); // 2/2
    });
  });

  describe('validateTagIntegrity', () => {
    it('整合性に問題がない場合', async () => {
      const mockServices = [
        { serviceId: 'svc_1' }
      ];

      const mockTags = [
        { tagId: 'tag_1', name: 'serverless', usageCount: 1 }
      ];

      const mockOrphanedResult = {
        totalRelations: 1,
        validRelations: 1,
        invalidServiceRelations: 0,
        invalidTagRelations: 0,
        orphanedRelations: {
          invalidServices: [],
          invalidTags: []
        }
      };

      const mockTagServices = [{ serviceId: 'svc_1' }];

      mockServiceModel.getAllServices.mockResolvedValue(mockServices);
      mockTagModel.getAllTags.mockResolvedValue(mockTags);
      mockRelationModel.findOrphanedRelations.mockResolvedValue(mockOrphanedResult);
      mockRelationModel.getTagServices.mockResolvedValue(mockTagServices);

      const result = await tagService.validateTagIntegrity();

      expect(result.isValid).toBe(true);
      expect(result.issues.orphanedServiceRelations).toHaveLength(0);
      expect(result.issues.orphanedTagRelations).toHaveLength(0);
      expect(result.issues.usageCountMismatches).toHaveLength(0);
    });

    it('使用回数の不整合を検出する', async () => {
      const mockServices = [{ serviceId: 'svc_1' }];
      const mockTags = [
        { tagId: 'tag_1', name: 'serverless', usageCount: 5 } // 実際は1個
      ];

      const mockOrphanedResult = {
        totalRelations: 1,
        validRelations: 1,
        invalidServiceRelations: 0,
        invalidTagRelations: 0,
        orphanedRelations: {
          invalidServices: [],
          invalidTags: []
        }
      };

      const mockTagServices = [{ serviceId: 'svc_1' }]; // 実際は1個

      mockServiceModel.getAllServices.mockResolvedValue(mockServices);
      mockTagModel.getAllTags.mockResolvedValue(mockTags);
      mockRelationModel.findOrphanedRelations.mockResolvedValue(mockOrphanedResult);
      mockRelationModel.getTagServices.mockResolvedValue(mockTagServices);

      const result = await tagService.validateTagIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.issues.usageCountMismatches).toHaveLength(1);
      expect(result.issues.usageCountMismatches[0].recordedUsage).toBe(5);
      expect(result.issues.usageCountMismatches[0].actualUsage).toBe(1);
      expect(result.issues.usageCountMismatches[0].difference).toBe(-4);
    });
  });

  describe('generateAutoTags', () => {
    it('Lambdaサービスから適切なタグを生成する', async () => {
      const service = {
        serviceName: 'AWS Lambda',
        description: 'Serverless compute service that runs code'
      };

      const mockTags = [
        { tagId: 'tag_serverless', name: 'serverless', isOfficial: true, usageCount: 20 },
        { tagId: 'tag_lambda', name: 'lambda', isOfficial: true, usageCount: 15 },
        { tagId: 'tag_compute', name: 'compute', isOfficial: true, usageCount: 10 }
      ];

      mockTagModel.getAllTags.mockResolvedValue(mockTags);

      const result = await tagService.generateAutoTags(service);

      expect(result).toHaveLength(3);
      expect(result[0].tagName).toBe('serverless');
      expect(result[0].confidence).toBeGreaterThan(0.5);
      expect(result.find(t => t.tagName === 'lambda')).toBeDefined();
    });

    it('マッチするタグがない場合は空配列を返す', async () => {
      const service = {
        serviceName: 'Unknown Service',
        description: 'Unknown description'
      };

      mockTagModel.getAllTags.mockResolvedValue([]);

      const result = await tagService.generateAutoTags(service);

      expect(result).toHaveLength(0);
    });
  });

  describe('calculateTagConfidence', () => {
    it('サービス名に完全一致する場合は高い信頼度を返す', () => {
      const service = {
        serviceName: 'AWS Lambda',
        description: 'Serverless compute service'
      };

      const tag = {
        name: 'lambda',
        isOfficial: true,
        usageCount: 20
      };

      const confidence = tagService.calculateTagConfidence(service, tag);

      expect(confidence).toBeGreaterThan(0.8);
    });

    it('マッチしない場合はベース信頼度を返す', () => {
      const service = {
        serviceName: 'AWS S3',
        description: 'Object storage service'
      };

      const tag = {
        name: 'lambda',
        isOfficial: false,
        usageCount: 1
      };

      const confidence = tagService.calculateTagConfidence(service, tag);

      expect(confidence).toBe(0.5); // ベース信頼度
    });
  });
});