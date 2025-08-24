/**
 * AWSサービスカテゴリモデル
 * DynamoDBでのAWSサービスカテゴリ管理
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

class AWSServiceCategoryModel {
  constructor() {
    // DynamoDBクライアントの初期化
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-northeast-1',
      ...(process.env.NODE_ENV === 'development' && {
        endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
      })
    });
    
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.AWS_SERVICE_CATEGORY_TABLE_NAME || 'AWSServiceCategories';
  }

  /**
   * カテゴリを作成
   * @param {Object} categoryData - カテゴリデータ
   * @returns {Promise<Object>} 作成結果
   */
  async createCategory(categoryData) {
    try {
      const now = new Date().toISOString();
      const categoryId = this.generateCategoryId(categoryData.name);
      
      const category = {
        categoryId: categoryId,
        name: categoryData.name,
        nameJa: categoryData.nameJa || categoryData.name,
        description: categoryData.description || '',
        descriptionJa: categoryData.descriptionJa || categoryData.description || '',
        parentCategoryId: categoryData.parentCategoryId || null,
        level: categoryData.level || 0,
        displayOrder: categoryData.displayOrder || 0,
        color: categoryData.color || '#1976d2',
        icon: categoryData.icon || 'aws',
        isActive: categoryData.isActive !== false,
        serviceCount: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: categoryData.createdBy || 'system',
        metadata: categoryData.metadata || {}
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: category,
        ConditionExpression: 'attribute_not_exists(categoryId)'
      });

      await this.docClient.send(command);
      return { success: true, category };
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('カテゴリが既に存在します');
      }
      console.error('カテゴリ作成エラー:', error);
      throw new Error(`カテゴリの作成に失敗しました: ${error.message}`);
    }
  }

  /**
   * カテゴリを取得
   * @param {string} categoryId - カテゴリID
   * @returns {Promise<Object|null>} カテゴリデータまたはnull
   */
  async getCategory(categoryId) {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { categoryId }
      });

      const result = await this.docClient.send(command);
      return result.Item || null;
    } catch (error) {
      console.error('カテゴリ取得エラー:', error);
      throw new Error(`カテゴリの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * 全カテゴリを取得
   * @param {Object} options - 取得オプション
   * @returns {Promise<Object[]>} カテゴリ配列
   */
  async getAllCategories(options = {}) {
    try {
      const params = {
        TableName: this.tableName
      };

      // アクティブなカテゴリのみ取得
      if (options.activeOnly) {
        params.FilterExpression = 'isActive = :active';
        params.ExpressionAttributeValues = { ':active': true };
      }

      const command = new ScanCommand(params);
      const result = await this.docClient.send(command);
      
      let categories = result.Items || [];

      // 階層構造でソート
      categories.sort((a, b) => {
        if (a.level !== b.level) {
          return a.level - b.level;
        }
        return a.displayOrder - b.displayOrder;
      });

      return categories;
    } catch (error) {
      console.error('全カテゴリ取得エラー:', error);
      throw new Error(`カテゴリ一覧の取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * 親カテゴリの子カテゴリを取得
   * @param {string} parentCategoryId - 親カテゴリID
   * @returns {Promise<Object[]>} 子カテゴリ配列
   */
  async getChildCategories(parentCategoryId) {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'parentCategoryId = :parentId AND isActive = :active',
        ExpressionAttributeValues: {
          ':parentId': parentCategoryId,
          ':active': true
        }
      });

      const result = await this.docClient.send(command);
      const categories = result.Items || [];

      // 表示順でソート
      categories.sort((a, b) => a.displayOrder - b.displayOrder);

      return categories;
    } catch (error) {
      console.error('子カテゴリ取得エラー:', error);
      throw new Error(`子カテゴリの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * ルートカテゴリ（親なし）を取得
   * @returns {Promise<Object[]>} ルートカテゴリ配列
   */
  async getRootCategories() {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'attribute_not_exists(parentCategoryId) AND isActive = :active',
        ExpressionAttributeValues: {
          ':active': true
        }
      });

      const result = await this.docClient.send(command);
      const categories = result.Items || [];

      // 表示順でソート
      categories.sort((a, b) => a.displayOrder - b.displayOrder);

      return categories;
    } catch (error) {
      console.error('ルートカテゴリ取得エラー:', error);
      throw new Error(`ルートカテゴリの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * カテゴリを更新
   * @param {string} categoryId - カテゴリID
   * @param {Object} updateData - 更新データ
   * @returns {Promise<Object>} 更新結果
   */
  async updateCategory(categoryId, updateData) {
    try {
      const now = new Date().toISOString();
      
      // 更新可能なフィールドのみを抽出
      const allowedFields = [
        'name', 'nameJa', 'description', 'descriptionJa',
        'displayOrder', 'color', 'icon', 'isActive', 'metadata'
      ];
      
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = { ':updatedAt': now };

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          updateExpression.push(`#${field} = :${field}`);
          expressionAttributeNames[`#${field}`] = field;
          expressionAttributeValues[`:${field}`] = updateData[field];
        }
      });

      if (updateExpression.length === 0) {
        throw new Error('更新するフィールドが指定されていません');
      }

      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { categoryId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(categoryId)',
        ReturnValues: 'ALL_NEW'
      });

      const result = await this.docClient.send(command);
      return { success: true, category: result.Attributes };
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('カテゴリが見つかりません');
      }
      console.error('カテゴリ更新エラー:', error);
      throw new Error(`カテゴリの更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * カテゴリを削除
   * @param {string} categoryId - カテゴリID
   * @returns {Promise<boolean>} 削除成功可否
   */
  async deleteCategory(categoryId) {
    try {
      // 子カテゴリの存在チェック
      const childCategories = await this.getChildCategories(categoryId);
      if (childCategories.length > 0) {
        throw new Error('子カテゴリが存在するため削除できません');
      }

      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: { categoryId },
        ConditionExpression: 'attribute_exists(categoryId) AND serviceCount = :zero',
        ExpressionAttributeValues: { ':zero': 0 }
      });

      await this.docClient.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('カテゴリが見つからないか、サービスが割り当てられています');
      }
      console.error('カテゴリ削除エラー:', error);
      throw new Error(`カテゴリの削除に失敗しました: ${error.message}`);
    }
  }

  /**
   * カテゴリのサービス数を更新
   * @param {string} categoryId - カテゴリID
   * @param {number} increment - 増減値
   * @returns {Promise<boolean>} 更新成功可否
   */
  async updateServiceCount(categoryId, increment) {
    try {
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { categoryId },
        UpdateExpression: 'ADD serviceCount :increment SET updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':increment': increment,
          ':updatedAt': new Date().toISOString()
        },
        ConditionExpression: 'attribute_exists(categoryId)'
      });

      await this.docClient.send(command);
      return true;
    } catch (error) {
      console.error('サービス数更新エラー:', error);
      return false;
    }
  }

  /**
   * カテゴリ階層構造を取得
   * @returns {Promise<Object>} 階層構造データ
   */
  async getCategoryHierarchy() {
    try {
      const allCategories = await this.getAllCategories({ activeOnly: true });
      
      // 階層構造を構築
      const categoryMap = new Map();
      const rootCategories = [];

      // まずすべてのカテゴリをマップに格納
      allCategories.forEach(category => {
        categoryMap.set(category.categoryId, {
          ...category,
          children: []
        });
      });

      // 親子関係を構築
      allCategories.forEach(category => {
        if (category.parentCategoryId) {
          const parent = categoryMap.get(category.parentCategoryId);
          if (parent) {
            parent.children.push(categoryMap.get(category.categoryId));
          }
        } else {
          rootCategories.push(categoryMap.get(category.categoryId));
        }
      });

      return {
        hierarchy: rootCategories,
        totalCategories: allCategories.length,
        maxLevel: Math.max(...allCategories.map(c => c.level))
      };
    } catch (error) {
      console.error('階層構造取得エラー:', error);
      throw new Error(`階層構造の取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * カテゴリ統計情報を取得
   * @returns {Promise<Object>} 統計情報
   */
  async getCategoryStatistics() {
    try {
      const allCategories = await this.getAllCategories();
      
      const stats = {
        totalCategories: allCategories.length,
        activeCategories: allCategories.filter(c => c.isActive).length,
        inactiveCategories: allCategories.filter(c => !c.isActive).length,
        rootCategories: allCategories.filter(c => !c.parentCategoryId).length,
        totalServices: allCategories.reduce((sum, c) => sum + (c.serviceCount || 0), 0),
        levelDistribution: {},
        timestamp: new Date().toISOString()
      };

      // レベル別分布
      allCategories.forEach(category => {
        const level = category.level || 0;
        stats.levelDistribution[level] = (stats.levelDistribution[level] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('統計情報取得エラー:', error);
      throw new Error(`統計情報の取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * カテゴリIDを生成
   * @param {string} name - カテゴリ名
   * @returns {string} カテゴリID
   * @private
   */
  generateCategoryId(name) {
    const crypto = require('crypto');
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(name + timestamp).digest('hex').substring(0, 8);
    return `cat_${hash}`;
  }

  /**
   * カテゴリ名で検索
   * @param {string} searchTerm - 検索語
   * @param {string} language - 言語 ('en' | 'ja')
   * @returns {Promise<Object[]>} 検索結果
   */
  async searchCategories(searchTerm, language = 'en') {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: language === 'ja' 
          ? 'contains(nameJa, :term) OR contains(descriptionJa, :term)'
          : 'contains(#name, :term) OR contains(description, :term)',
        ExpressionAttributeNames: language === 'en' ? { '#name': 'name' } : undefined,
        ExpressionAttributeValues: {
          ':term': searchTerm
        }
      });

      const result = await this.docClient.send(command);
      return result.Items || [];
    } catch (error) {
      console.error('カテゴリ検索エラー:', error);
      throw new Error(`カテゴリ検索に失敗しました: ${error.message}`);
    }
  }
}

module.exports = AWSServiceCategoryModel;