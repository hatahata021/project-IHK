/**
 * AWSサービスカテゴリ管理サービスのテスト
 */

const AWSServiceCategoryService = require('../awsServiceCategoryService');
const AWSServiceCategoryModel = require('../../models/awsServiceCategory');
const AWSServiceModel = require('../../models/awsService');

// モデルをモック化
jest.mock('../../models/awsServiceCategory');
jest.mock('../../models/awsService');

describe('AWSServiceCategoryService', () => {
  let categoryService;
  let mockCategoryModel;
  let mockServiceModel;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // AWSServiceCategoryModelのモック
    mockCategoryModel = {
      createCategory: jest.fn(),
      getCategory: jest.fn(),
      getAllCategories: jest.fn(),
      getChildCategories: jest.fn(),
      getCategoryHierarchy: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      updateServiceCount: jest.fn(),
      searchCategories: jest.fn(),
      getCategoryStatistics: jest.fn()
    };
    AWSServiceCategoryModel.mockImplementation(() => mockCategoryModel);
    
    // AWSServiceModelのモック
    mockServiceModel = {
      getService: jest.fn(),
      getServicesByCategory: jest.fn(),
      getAllServices: jest.fn(),
      updateService: jest.fn(),
      getServiceStatistics: jest.fn()
    };
    AWSServiceModel.mockImplementation(() => mockServiceModel);
    
    categoryService = new AWSServiceCategoryService();
  });

  describe('initializeDefaultCategories', () => {
    it('デフォルトカテゴリを正常に初期化する', async () => {
      mockCategoryModel.createCategory.mockResolvedValue({
        success: true,
        category: { categoryId: 'cat_12345678', name: 'Compute' }
      });

      const result = await categoryService.initializeDefaultCategories();

      expect(result.success).toBe(true);
      expect(result.details.created).toHaveLength(8); // デフォルトカテゴリ数
      expect(mockCategoryModel.createCategory).toHaveBeenCalledTimes(8);
    });

    it('既存カテゴリがある場合はスキップする', async () => {
      mockCategoryModel.createCategory
        .mockResolvedValueOnce({ success: true, category: { name: 'Compute' } })
        .mockRejectedValueOnce(new Error('カテゴリが既に存在します'))
        .mockResolvedValueOnce({ success: true, category: { name: 'Storage' } });

      const result = await categoryService.initializeDefaultCategories();

      expect(result.success).toBe(true);
      expect(result.details.created).toHaveLength(2);
      expect(result.details.skipped).toHaveLength(1);
    });

    it('一部のカテゴリ作成でエラーが発生した場合も継続する', async () => {
      mockCategoryModel.createCategory
        .mockResolvedValueOnce({ success: true, category: { name: 'Compute' } })
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await categoryService.initializeDefaultCategories();

      expect(result.success).toBe(true);
      expect(result.details.errors).toHaveLength(1);
      expect(result.details.errors[0].error).toBe('Database error');
    });
  });

  describe('createCategory', () => {
    it('親カテゴリなしでカテゴリを作成する', async () => {
      const categoryData = {
        name: 'Mobile',
        nameJa: 'モバイル',
        description: 'Mobile services'
      };

      mockCategoryModel.createCategory.mockResolvedValue({
        success: true,
        category: { ...categoryData, categoryId: 'cat_12345678' }
      });

      const result = await categoryService.createCategory(categoryData);

      expect(result.success).toBe(true);
      expect(result.category.name).toBe('Mobile');
      expect(mockCategoryModel.createCategory).toHaveBeenCalledWith(categoryData);
    });

    it('親カテゴリありでカテゴリを作成する', async () => {
      const parentCategory = {
        categoryId: 'cat_parent',
        name: 'Parent',
        level: 0
      };

      const categoryData = {
        name: 'Child',
        parentCategoryId: 'cat_parent'
      };

      mockCategoryModel.getCategory.mockResolvedValue(parentCategory);
      mockCategoryModel.createCategory.mockResolvedValue({
        success: true,
        category: { ...categoryData, categoryId: 'cat_child', level: 1 }
      });

      const result = await categoryService.createCategory(categoryData);

      expect(result.success).toBe(true);
      expect(mockCategoryModel.getCategory).toHaveBeenCalledWith('cat_parent');
      expect(mockCategoryModel.createCategory).toHaveBeenCalledWith({
        ...categoryData,
        level: 1
      });
    });

    it('存在しない親カテゴリが指定された場合はエラーを返す', async () => {
      const categoryData = {
        name: 'Child',
        parentCategoryId: 'cat_nonexistent'
      };

      mockCategoryModel.getCategory.mockResolvedValue(null);

      await expect(categoryService.createCategory(categoryData))
        .rejects.toThrow('指定された親カテゴリが存在しません');
    });
  });

  describe('getCategoryHierarchy', () => {
    it('階層構造を正常に取得する', async () => {
      const mockHierarchy = {
        hierarchy: [
          {
            categoryId: 'cat_1',
            name: 'Compute',
            children: []
          }
        ],
        totalCategories: 1,
        maxLevel: 0
      };

      mockCategoryModel.getCategoryHierarchy.mockResolvedValue(mockHierarchy);

      const result = await categoryService.getCategoryHierarchy();

      expect(result).toEqual(mockHierarchy);
      expect(mockCategoryModel.getCategoryHierarchy).toHaveBeenCalled();
    });

    it('サービス数を含めて階層構造を取得する', async () => {
      const mockHierarchy = {
        hierarchy: [
          {
            categoryId: 'cat_1',
            name: 'Compute',
            children: []
          }
        ],
        totalCategories: 1,
        maxLevel: 0
      };

      const mockServices = [
        { serviceId: 'svc_1', serviceName: 'EC2' },
        { serviceId: 'svc_2', serviceName: 'Lambda' }
      ];

      mockCategoryModel.getCategoryHierarchy.mockResolvedValue(mockHierarchy);
      mockServiceModel.getServicesByCategory.mockResolvedValue(mockServices);

      const result = await categoryService.getCategoryHierarchy({ includeServiceCount: true });

      expect(result.hierarchy[0].actualServiceCount).toBe(2);
      expect(mockServiceModel.getServicesByCategory).toHaveBeenCalledWith('cat_1');
    });
  });

  describe('getCategoryWithServices', () => {
    it('カテゴリとサービス一覧を正常に取得する', async () => {
      const mockCategory = {
        categoryId: 'cat_1',
        name: 'Compute',
        nameJa: 'コンピューティング'
      };

      const mockServices = [
        { serviceId: 'svc_1', serviceName: 'EC2' },
        { serviceId: 'svc_2', serviceName: 'Lambda' }
      ];

      const mockChildCategories = [
        { categoryId: 'cat_child', name: 'Serverless' }
      ];

      mockCategoryModel.getCategory.mockResolvedValue(mockCategory);
      mockServiceModel.getServicesByCategory.mockResolvedValue(mockServices);
      mockCategoryModel.getChildCategories.mockResolvedValue(mockChildCategories);

      const result = await categoryService.getCategoryWithServices('cat_1');

      expect(result.category).toEqual(mockCategory);
      expect(result.services).toEqual(mockServices);
      expect(result.childCategories).toEqual(mockChildCategories);
      expect(result.serviceCount).toBe(2);
      expect(result.childCategoryCount).toBe(1);
    });

    it('存在しないカテゴリの場合はエラーを返す', async () => {
      mockCategoryModel.getCategory.mockResolvedValue(null);

      await expect(categoryService.getCategoryWithServices('cat_nonexistent'))
        .rejects.toThrow('カテゴリが見つかりません');
    });
  });

  describe('classifyService', () => {
    it('Lambdaサービスを正しくComputeカテゴリに分類する', async () => {
      const mockCategories = [
        { categoryId: 'cat_compute', name: 'Compute' },
        { categoryId: 'cat_storage', name: 'Storage' }
      ];

      mockCategoryModel.getAllCategories.mockResolvedValue(mockCategories);

      const result = await categoryService.classifyService('AWS Lambda');

      expect(result).toBe('cat_compute');
    });

    it('S3サービスを正しくStorageカテゴリに分類する', async () => {
      const mockCategories = [
        { categoryId: 'cat_compute', name: 'Compute' },
        { categoryId: 'cat_storage', name: 'Storage' }
      ];

      mockCategoryModel.getAllCategories.mockResolvedValue(mockCategories);

      const result = await categoryService.classifyService('Amazon S3');

      expect(result).toBe('cat_storage');
    });

    it('分類できないサービスの場合はnullを返す', async () => {
      const mockCategories = [
        { categoryId: 'cat_compute', name: 'Compute' }
      ];

      mockCategoryModel.getAllCategories.mockResolvedValue(mockCategories);

      const result = await categoryService.classifyService('Unknown Service');

      expect(result).toBeNull();
    });
  });

  describe('assignServiceToCategory', () => {
    it('サービスを新しいカテゴリに正常に割り当てる', async () => {
      const mockService = {
        serviceId: 'svc_1',
        serviceName: 'Lambda',
        categoryId: null
      };

      const mockCategory = {
        categoryId: 'cat_compute',
        name: 'Compute'
      };

      mockServiceModel.getService.mockResolvedValue(mockService);
      mockCategoryModel.getCategory.mockResolvedValue(mockCategory);
      mockServiceModel.updateService.mockResolvedValue({ success: true });
      mockCategoryModel.updateServiceCount.mockResolvedValue(true);

      const result = await categoryService.assignServiceToCategory('svc_1', 'cat_compute');

      expect(result.success).toBe(true);
      expect(result.serviceId).toBe('svc_1');
      expect(result.categoryId).toBe('cat_compute');
      expect(mockServiceModel.updateService).toHaveBeenCalledWith('svc_1', { categoryId: 'cat_compute' });
      expect(mockCategoryModel.updateServiceCount).toHaveBeenCalledWith('cat_compute', 1);
    });

    it('サービスを別のカテゴリに移動する', async () => {
      const mockService = {
        serviceId: 'svc_1',
        serviceName: 'Lambda',
        categoryId: 'cat_old'
      };

      const mockCategory = {
        categoryId: 'cat_new',
        name: 'NewCategory'
      };

      mockServiceModel.getService.mockResolvedValue(mockService);
      mockCategoryModel.getCategory.mockResolvedValue(mockCategory);
      mockServiceModel.updateService.mockResolvedValue({ success: true });
      mockCategoryModel.updateServiceCount.mockResolvedValue(true);

      const result = await categoryService.assignServiceToCategory('svc_1', 'cat_new');

      expect(result.success).toBe(true);
      expect(result.oldCategoryId).toBe('cat_old');
      expect(mockCategoryModel.updateServiceCount).toHaveBeenCalledWith('cat_old', -1);
      expect(mockCategoryModel.updateServiceCount).toHaveBeenCalledWith('cat_new', 1);
    });

    it('存在しないサービスの場合はエラーを返す', async () => {
      mockServiceModel.getService.mockResolvedValue(null);

      await expect(categoryService.assignServiceToCategory('svc_nonexistent', 'cat_1'))
        .rejects.toThrow('サービスが見つかりません');
    });

    it('存在しないカテゴリの場合はエラーを返す', async () => {
      const mockService = { serviceId: 'svc_1', serviceName: 'Lambda' };
      
      mockServiceModel.getService.mockResolvedValue(mockService);
      mockCategoryModel.getCategory.mockResolvedValue(null);

      await expect(categoryService.assignServiceToCategory('svc_1', 'cat_nonexistent'))
        .rejects.toThrow('カテゴリが見つかりません');
    });
  });

  describe('searchCategories', () => {
    it('英語でカテゴリを検索する', async () => {
      const mockCategories = [
        { categoryId: 'cat_1', name: 'Compute', nameJa: 'コンピューティング' }
      ];

      mockCategoryModel.searchCategories.mockResolvedValue(mockCategories);

      const result = await categoryService.searchCategories('compute', { language: 'en' });

      expect(result).toEqual(mockCategories);
      expect(mockCategoryModel.searchCategories).toHaveBeenCalledWith('compute', 'en');
    });

    it('日本語でカテゴリを検索する', async () => {
      const mockCategories = [
        { categoryId: 'cat_1', name: 'Compute', nameJa: 'コンピューティング' }
      ];

      mockCategoryModel.searchCategories.mockResolvedValue(mockCategories);

      const result = await categoryService.searchCategories('コンピューティング', { language: 'ja' });

      expect(result).toEqual(mockCategories);
      expect(mockCategoryModel.searchCategories).toHaveBeenCalledWith('コンピューティング', 'ja');
    });

    it('サービス数を含めて検索する', async () => {
      const mockCategories = [
        { categoryId: 'cat_1', name: 'Compute' }
      ];

      const mockServices = [
        { serviceId: 'svc_1', serviceName: 'EC2' }
      ];

      mockCategoryModel.searchCategories.mockResolvedValue(mockCategories);
      mockServiceModel.getServicesByCategory.mockResolvedValue(mockServices);

      const result = await categoryService.searchCategories('compute', { includeServiceCount: true });

      expect(result[0].actualServiceCount).toBe(1);
    });
  });

  describe('getCategoryStatistics', () => {
    it('統計情報を正常に取得する', async () => {
      const mockCategoryStats = {
        totalCategories: 8,
        activeCategories: 8,
        rootCategories: 8
      };

      const mockServiceStats = {
        totalServices: 150,
        activeServices: 145,
        categoryDistribution: {
          'cat_1': 20,
          'cat_2': 15
        }
      };

      const mockCategories = [
        { categoryId: 'cat_1', name: 'Compute', nameJa: 'コンピューティング' },
        { categoryId: 'cat_2', name: 'Storage', nameJa: 'ストレージ' }
      ];

      const mockServices1 = [{ serviceId: 'svc_1' }, { serviceId: 'svc_2' }];
      const mockServices2 = [{ serviceId: 'svc_3' }];

      mockCategoryModel.getCategoryStatistics.mockResolvedValue(mockCategoryStats);
      mockServiceModel.getServiceStatistics.mockResolvedValue(mockServiceStats);
      mockCategoryModel.getAllCategories.mockResolvedValue(mockCategories);
      mockServiceModel.getServicesByCategory
        .mockResolvedValueOnce(mockServices1)
        .mockResolvedValueOnce(mockServices2);

      const result = await categoryService.getCategoryStatistics();

      expect(result.categories).toEqual(mockCategoryStats);
      expect(result.services).toEqual(mockServiceStats);
      expect(result.categoryServiceDistribution['cat_1'].serviceCount).toBe(2);
      expect(result.categoryServiceDistribution['cat_2'].serviceCount).toBe(1);
      expect(result.summary.totalCategories).toBe(8);
      expect(result.summary.totalServices).toBe(150);
    });
  });

  describe('getUncategorizedServices', () => {
    it('未分類サービスを取得し、推奨カテゴリを追加する', async () => {
      const mockServices = [
        { serviceId: 'svc_1', serviceName: 'AWS Lambda', categoryId: null },
        { serviceId: 'svc_2', serviceName: 'Amazon S3', categoryId: null },
        { serviceId: 'svc_3', serviceName: 'EC2', categoryId: 'cat_1' } // 分類済み
      ];

      const mockCategory = {
        categoryId: 'cat_compute',
        name: 'Compute',
        nameJa: 'コンピューティング'
      };

      mockServiceModel.getAllServices.mockResolvedValue(mockServices);
      mockCategoryModel.getAllCategories.mockResolvedValue([mockCategory]);
      mockCategoryModel.getCategory.mockResolvedValue(mockCategory);

      const result = await categoryService.getUncategorizedServices();

      expect(result).toHaveLength(2); // 未分類のサービスのみ
      expect(result[0].suggestedCategory).toBeDefined();
      expect(result[0].suggestedCategory.categoryName).toBe('Compute');
    });
  });

  describe('validateCategoryIntegrity', () => {
    it('整合性に問題がない場合', async () => {
      const mockServices = [
        { serviceId: 'svc_1', categoryId: 'cat_1' }
      ];

      const mockCategories = [
        { categoryId: 'cat_1', name: 'Compute', serviceCount: 1, parentCategoryId: null }
      ];

      mockServiceModel.getAllServices.mockResolvedValue(mockServices);
      mockCategoryModel.getAllCategories.mockResolvedValue(mockCategories);
      mockServiceModel.getServicesByCategory.mockResolvedValue([mockServices[0]]);

      const result = await categoryService.validateCategoryIntegrity();

      expect(result.isValid).toBe(true);
      expect(result.issues.orphanedServices).toHaveLength(0);
      expect(result.issues.invalidParentReferences).toHaveLength(0);
      expect(result.issues.serviceCountMismatches).toHaveLength(0);
    });

    it('孤立したサービスを検出する', async () => {
      const mockServices = [
        { serviceId: 'svc_1', serviceName: 'Lambda', categoryId: 'cat_nonexistent' }
      ];

      const mockCategories = [
        { categoryId: 'cat_1', name: 'Compute' }
      ];

      mockServiceModel.getAllServices.mockResolvedValue(mockServices);
      mockCategoryModel.getAllCategories.mockResolvedValue(mockCategories);

      const result = await categoryService.validateCategoryIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.issues.orphanedServices).toHaveLength(1);
      expect(result.issues.orphanedServices[0].serviceId).toBe('svc_1');
      expect(result.issues.orphanedServices[0].invalidCategoryId).toBe('cat_nonexistent');
    });

    it('サービス数の不整合を検出する', async () => {
      const mockServices = [];
      const mockCategories = [
        { categoryId: 'cat_1', name: 'Compute', serviceCount: 5 } // 実際は0個
      ];

      mockServiceModel.getAllServices.mockResolvedValue(mockServices);
      mockCategoryModel.getAllCategories.mockResolvedValue(mockCategories);
      mockServiceModel.getServicesByCategory.mockResolvedValue([]);

      const result = await categoryService.validateCategoryIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.issues.serviceCountMismatches).toHaveLength(1);
      expect(result.issues.serviceCountMismatches[0].recordedCount).toBe(5);
      expect(result.issues.serviceCountMismatches[0].actualCount).toBe(0);
      expect(result.issues.serviceCountMismatches[0].difference).toBe(-5);
    });
  });
});