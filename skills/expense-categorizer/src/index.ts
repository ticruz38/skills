/**
 * Expense Categorizer Skill
 * Auto-categorize expenses from receipts with learning from corrections
 * Built on top of receipts-ocr skill
 */

import { ReceiptsOCRSkill, Receipt, ReceiptLineItem } from '@openclaw/receipts-ocr';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Category definition
 */
export interface Category {
  id?: number;
  name: string;
  keywords: string[];
  parentCategory?: string;
  isCustom: boolean;
  createdAt?: string;
}

/**
 * Category database record (snake_case columns)
 */
interface CategoryRecord {
  id?: number;
  name: string;
  keywords: string;
  parent_category?: string;
  is_custom: number;
  created_at?: string;
}

/**
 * Merchant mapping
 */
export interface MerchantMapping {
  id?: number;
  merchant: string;
  category: string;
  confidence: number;
  receiptCount: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Merchant mapping database record (snake_case columns)
 */
interface MerchantMappingRecord {
  id?: number;
  merchant: string;
  category: string;
  confidence: number;
  receipt_count: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Categorization result
 */
export interface CategorizationResult {
  receiptId: number;
  category: string;
  confidence: number;
  method: 'merchant' | 'keyword' | 'line_item' | 'manual';
  applied: boolean;
}

/**
 * Category statistics
 */
export interface CategoryStats {
  category: string;
  receiptCount: number;
  totalAmount: number;
  averageConfidence: number;
}

/**
 * Learning record for tracking corrections
 */
export interface LearningRecord {
  id?: number;
  receiptId: number;
  merchant?: string;
  suggestedCategory?: string;
  correctedCategory: string;
  appliedAt?: string;
}

/**
 * Skill configuration
 */
export interface ExpenseCategorizerSkillConfig {
  dataDir?: string;
  receiptsProfile?: string;
}

// Promisify database operations
function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

function runWithResult(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

function all<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

/**
 * Expense Categorizer Skill
 */
export class ExpenseCategorizerSkill {
  private dataDir: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;
  private receiptsSkill: ReceiptsOCRSkill;

  constructor(config: ExpenseCategorizerSkillConfig = {}) {
    this.dataDir = config.dataDir || path.join(os.homedir(), '.openclaw', 'skills', 'expense-categorizer');
    this.receiptsSkill = new ReceiptsOCRSkill({ profile: config.receiptsProfile || 'default' });
    this.initPromise = this.initDatabase();
  }

  /**
   * Initialize database and directories
   */
  private async initDatabase(): Promise<void> {
    // Create directories
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
    }

    const dbPath = path.join(this.dataDir, 'categorizer.db');
    
    this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const db = new (sqlite3 as any).Database(dbPath, (err: Error | null) => {
        if (err) reject(err);
        else resolve(db);
      });
    });

    // Create tables
    await this.createTables();
    
    // Seed default categories
    await this.seedDefaultCategories();
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Categories table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        keywords TEXT NOT NULL,
        parent_category TEXT,
        is_custom INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Merchant mappings table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS merchant_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merchant TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        confidence REAL DEFAULT 0.8,
        receipt_count INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Learning records table (tracks corrections)
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS learning_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER NOT NULL,
        merchant TEXT,
        suggested_category TEXT,
        corrected_category TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create indexes
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_merchant_mappings_merchant ON merchant_mappings(merchant)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_merchant_mappings_category ON merchant_mappings(category)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_learning_merchant ON learning_records(merchant)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_learning_receipt ON learning_records(receipt_id)`);
  }

  /**
   * Seed default categories
   */
  private async seedDefaultCategories(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const defaultCategories: Array<{ name: string; keywords: string[]; parent?: string }> = [
      { name: 'Groceries', keywords: ['grocery', 'supermarket', 'market', 'food', 'produce', 'meat', 'bakery', 'dairy'] },
      { name: 'Dining', keywords: ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'food', 'diner', 'bistro', 'grill'] },
      { name: 'Gas', keywords: ['gas', 'fuel', 'petrol', 'shell', 'exxon', 'bp', 'chevron', 'mobil', 'texaco'] },
      { name: 'Pharmacy', keywords: ['pharmacy', 'drugstore', 'walgreens', 'cvs', 'rite aid', 'medicine', 'prescription'] },
      { name: 'Office', keywords: ['office', 'supplies', 'staples', 'paper', 'ink', 'toner', 'stationery', 'desk'] },
      { name: 'Electronics', keywords: ['electronics', 'best buy', 'amazon', 'computer', 'phone', 'tech', 'gadget'] },
      { name: 'Transportation', keywords: ['uber', 'lyft', 'taxi', 'transit', 'bus', 'train', 'subway', 'parking', 'toll'] },
      { name: 'Entertainment', keywords: ['movie', 'theater', 'cinema', 'game', 'entertainment', 'netflix', 'spotify', 'concert'] },
      { name: 'Retail', keywords: ['walmart', 'target', 'costco', 'store', 'shop', 'mall', 'outlet'] },
      { name: 'Utilities', keywords: ['electricity', 'gas', 'water', 'internet', 'phone', 'utility', 'bill'] },
      { name: 'Travel', keywords: ['hotel', 'flight', 'airline', 'rental', 'car', 'booking', 'airbnb', 'trip'] },
      { name: 'Healthcare', keywords: ['medical', 'dental', 'vision', 'doctor', 'hospital', 'clinic', 'health'] },
    ];

    for (const cat of defaultCategories) {
      await run(this.db, `
        INSERT OR IGNORE INTO categories (name, keywords, parent_category, is_custom)
        VALUES (?, ?, ?, 0)
      `, [cat.name, JSON.stringify(cat.keywords), cat.parent || null]);
    }
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDatabase(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await this.ensureDatabase();
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.db = null;
    }
    await this.receiptsSkill.close();
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<Category[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<CategoryRecord>(this.db, 'SELECT * FROM categories ORDER BY name');
    return records.map(r => ({
      id: r.id,
      name: r.name,
      keywords: JSON.parse(r.keywords),
      parentCategory: r.parent_category,
      isCustom: r.is_custom === 1,
      createdAt: r.created_at,
    }));
  }

  /**
   * Add a custom category
   */
  async addCategory(category: Omit<Category, 'id' | 'isCustom' | 'createdAt'>): Promise<Category> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, `
      INSERT INTO categories (name, keywords, parent_category, is_custom)
      VALUES (?, ?, ?, 1)
    `, [category.name, JSON.stringify(category.keywords), category.parentCategory || null]);

    const record = await get<CategoryRecord>(this.db, 'SELECT * FROM categories WHERE id = ?', [result.lastID]);
    if (!record) throw new Error('Failed to create category');

    return {
      id: record.id,
      name: record.name,
      keywords: JSON.parse(record.keywords),
      parentCategory: record.parent_category,
      isCustom: record.is_custom === 1,
      createdAt: record.created_at,
    };
  }

  /**
   * Delete a custom category
   */
  async deleteCategory(name: string): Promise<void> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    await run(this.db, 'DELETE FROM categories WHERE name = ? AND is_custom = 1', [name]);
  }

  /**
   * Suggest a category for a receipt without applying it
   */
  async suggestCategory(receiptId: number): Promise<CategorizationResult> {
    await this.ensureDatabase();
    
    const receipt = await this.receiptsSkill.getReceipt(receiptId);
    if (!receipt) {
      throw new Error(`Receipt ${receiptId} not found`);
    }

    return this.categorizeReceiptInternal(receipt, false);
  }

  /**
   * Categorize a single receipt and apply the category
   */
  async categorizeReceipt(receiptId: number): Promise<CategorizationResult> {
    await this.ensureDatabase();
    
    const receipt = await this.receiptsSkill.getReceipt(receiptId);
    if (!receipt) {
      throw new Error(`Receipt ${receiptId} not found`);
    }

    return this.categorizeReceiptInternal(receipt, true);
  }

  /**
   * Internal categorization logic
   */
  private async categorizeReceiptInternal(receipt: Receipt, apply: boolean): Promise<CategorizationResult> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    // 1. Check merchant mapping (highest priority)
    if (receipt.merchant) {
      const mapping = await get<MerchantMappingRecord>(this.db,
        'SELECT * FROM merchant_mappings WHERE LOWER(merchant) = LOWER(?)',
        [receipt.merchant]
      );
      
      if (mapping) {
        const result: CategorizationResult = {
          receiptId: receipt.id!,
          category: mapping.category,
          confidence: mapping.confidence,
          method: 'merchant',
          applied: false,
        };

        if (apply) {
          await this.receiptsSkill.updateReceipt(receipt.id!, { category: mapping.category });
          result.applied = true;
          
          // Update mapping confidence
          await run(this.db, `
            UPDATE merchant_mappings 
            SET receipt_count = receipt_count + 1, updated_at = datetime('now')
            WHERE id = ?
          `, [mapping.id]);
        }

        return result;
      }
    }

    // 2. Get all categories for keyword matching
    const categories = await this.getCategories();
    const fullText = receipt.rawText?.toLowerCase() || '';
    const merchantLower = receipt.merchant?.toLowerCase() || '';

    // 3. Keyword matching with scoring
    let bestCategory: string | null = null;
    let bestScore = 0;
    let matchMethod: 'keyword' | 'line_item' = 'keyword';

    for (const category of categories) {
      let score = 0;
      let matchCount = 0;

      // Check merchant name against keywords
      for (const keyword of category.keywords) {
        if (merchantLower.includes(keyword.toLowerCase())) {
          score += 2; // Higher weight for merchant match
          matchCount++;
        }
      }

      // Check full text against keywords
      for (const keyword of category.keywords) {
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
        const matches = fullText.match(regex);
        if (matches) {
          score += matches.length;
          matchCount++;
        }
      }

      // Check line items
      for (const item of receipt.lineItems || []) {
        const itemDesc = item.description.toLowerCase();
        for (const keyword of category.keywords) {
          if (itemDesc.includes(keyword.toLowerCase())) {
            score += 0.5;
            matchCount++;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCategory = category.name;
      }
    }

    // 4. Calculate confidence based on score
    let confidence = 0;
    if (bestScore >= 5) confidence = 0.9;
    else if (bestScore >= 3) confidence = 0.75;
    else if (bestScore >= 1) confidence = 0.6;
    else confidence = 0.4;

    // If no good match found, default to the existing category or 'Uncategorized'
    const finalCategory = bestCategory || receipt.category || 'Uncategorized';

    const result: CategorizationResult = {
      receiptId: receipt.id!,
      category: finalCategory,
      confidence,
      method: matchMethod,
      applied: false,
    };

    // 5. Apply if requested
    if (apply && bestCategory) {
      await this.receiptsSkill.updateReceipt(receipt.id!, { category: bestCategory });
      result.applied = true;
    }

    return result;
  }

  /**
   * Bulk categorize all uncategorized receipts
   */
  async bulkCategorize(options: {
    minConfidence?: number;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<CategorizationResult[]> {
    await this.ensureDatabase();

    const minConfidence = options.minConfidence ?? 0.5;

    // Get uncategorized receipts
    const receipts = await this.receiptsSkill.listReceipts({
      startDate: options.startDate,
      endDate: options.endDate,
    });

    const uncategorized = receipts.filter(r => !r.category || r.category === 'Uncategorized');
    const results: CategorizationResult[] = [];

    for (const receipt of uncategorized) {
      try {
        const result = await this.categorizeReceiptInternal(receipt, true);
        if (result.confidence >= minConfidence) {
          results.push(result);
        }
      } catch (error) {
        // Skip failed categorizations
        console.warn(`Failed to categorize receipt ${receipt.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Apply a correction to teach the system
   */
  async applyCorrection(receiptId: number, correctCategory: string): Promise<void> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    // Get the receipt
    const receipt = await this.receiptsSkill.getReceipt(receiptId);
    if (!receipt) {
      throw new Error(`Receipt ${receiptId} not found`);
    }

    const originalCategory = receipt.category;

    // Update the receipt
    await this.receiptsSkill.updateReceipt(receiptId, { 
      category: correctCategory,
      status: 'corrected'
    });

    // Record the learning
    await run(this.db, `
      INSERT INTO learning_records (receipt_id, merchant, suggested_category, corrected_category)
      VALUES (?, ?, ?, ?)
    `, [receiptId, receipt.merchant || null, originalCategory || null, correctCategory]);

    // Update or create merchant mapping
    if (receipt.merchant) {
      const existing = await get<MerchantMappingRecord>(this.db,
        'SELECT * FROM merchant_mappings WHERE LOWER(merchant) = LOWER(?)',
        [receipt.merchant]
      );

      if (existing) {
        // Update with higher confidence since it's been verified
        await run(this.db, `
          UPDATE merchant_mappings 
          SET category = ?, confidence = 0.95, receipt_count = receipt_count + 1, updated_at = datetime('now')
          WHERE id = ?
        `, [correctCategory, existing.id]);
      } else {
        // Create new mapping
        await run(this.db, `
          INSERT INTO merchant_mappings (merchant, category, confidence, receipt_count)
          VALUES (?, ?, 0.95, 1)
        `, [receipt.merchant, correctCategory]);
      }
    }
  }

  /**
   * Get merchant mappings
   */
  async getMerchantMappings(): Promise<MerchantMapping[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<MerchantMappingRecord>(
      this.db, 
      'SELECT * FROM merchant_mappings ORDER BY receipt_count DESC, merchant'
    );

    return records.map(r => ({
      id: r.id,
      merchant: r.merchant,
      category: r.category,
      confidence: r.confidence,
      receiptCount: r.receipt_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Manually map a merchant to a category
   */
  async mapMerchant(merchant: string, category: string): Promise<void> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const existing = await get<MerchantMappingRecord>(this.db,
      'SELECT * FROM merchant_mappings WHERE LOWER(merchant) = LOWER(?)',
      [merchant]
    );

    if (existing) {
      await run(this.db, `
        UPDATE merchant_mappings 
        SET category = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [category, existing.id]);
    } else {
      await run(this.db, `
        INSERT INTO merchant_mappings (merchant, category, confidence, receipt_count)
        VALUES (?, ?, 1.0, 0)
      `, [merchant, category]);
    }
  }

  /**
   * Delete a merchant mapping
   */
  async deleteMerchantMapping(merchant: string): Promise<void> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    await run(this.db, 'DELETE FROM merchant_mappings WHERE LOWER(merchant) = LOWER(?)', [merchant]);
  }

  /**
   * Get categorization statistics
   */
  async getStats(): Promise<{
    totalReceipts: number;
    categorizedReceipts: number;
    uncategorizedReceipts: number;
    byCategory: CategoryStats[];
    merchantMappings: number;
    corrections: number;
  }> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    // Get all receipts stats from receipts-ocr
    const receipts = await this.receiptsSkill.listReceipts({});
    const totalReceipts = receipts.length;
    const categorizedReceipts = receipts.filter(r => r.category && r.category !== 'Uncategorized').length;
    const uncategorizedReceipts = totalReceipts - categorizedReceipts;

    // Category breakdown (get from receipts)
    const categoryMap = new Map<string, { count: number; amount: number; confidences: number[] }>();
    for (const receipt of receipts) {
      if (!receipt.category || receipt.category === 'Uncategorized') continue;
      
      const existing = categoryMap.get(receipt.category) || { count: 0, amount: 0, confidences: [] };
      existing.count++;
      existing.amount += receipt.totalAmount || 0;
      // Use average of confidence scores as a proxy
      existing.confidences.push((receipt.totalConfidence + receipt.merchantConfidence + receipt.dateConfidence) / 3);
      categoryMap.set(receipt.category, existing);
    }

    const byCategory: CategoryStats[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      receiptCount: data.count,
      totalAmount: data.amount,
      averageConfidence: data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length,
    }));

    // Sort by amount desc
    byCategory.sort((a, b) => b.totalAmount - a.totalAmount);

    // Count merchant mappings
    const mappingCount = await get<{ count: number }>(this.db, 'SELECT COUNT(*) as count FROM merchant_mappings');

    // Count corrections
    const correctionCount = await get<{ count: number }>(this.db, 'SELECT COUNT(*) as count FROM learning_records');

    return {
      totalReceipts,
      categorizedReceipts,
      uncategorizedReceipts,
      byCategory,
      merchantMappings: mappingCount?.count || 0,
      corrections: correctionCount?.count || 0,
    };
  }

  /**
   * Get accuracy metrics based on corrections
   */
  async getAccuracyMetrics(): Promise<{
    totalSuggestions: number;
    correctSuggestions: number;
    accuracyRate: number;
    byCategory: Record<string, { correct: number; incorrect: number }>;
  }> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    interface LearningRecordDb {
      id?: number;
      receipt_id: number;
      merchant: string | null;
      suggested_category: string | null;
      corrected_category: string;
      applied_at: string;
    }

    const records = await all<LearningRecordDb>(this.db, 'SELECT * FROM learning_records');
    
    let correct = 0;
    const byCategory: Record<string, { correct: number; incorrect: number }> = {};

    for (const record of records) {
      const suggested = record.suggested_category || 'Uncategorized';
      const isCorrect = suggested === record.corrected_category;
      
      if (isCorrect) {
        correct++;
      }

      // Track by the suggested category
      if (!byCategory[suggested]) {
        byCategory[suggested] = { correct: 0, incorrect: 0 };
      }
      
      if (isCorrect) {
        byCategory[suggested].correct++;
      } else {
        byCategory[suggested].incorrect++;
      }
    }

    const total = records.length;
    const accuracyRate = total > 0 ? correct / total : 0;

    return {
      totalSuggestions: total,
      correctSuggestions: correct,
      accuracyRate,
      byCategory,
    };
  }

  /**
   * Get learning history
   */
  async getLearningHistory(limit: number = 50): Promise<LearningRecord[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    interface LearningRecordDb {
      id?: number;
      receipt_id: number;
      merchant: string | null;
      suggested_category: string | null;
      corrected_category: string;
      applied_at: string;
    }

    const records = await all<LearningRecordDb>(this.db, 
      'SELECT * FROM learning_records ORDER BY applied_at DESC LIMIT ?',
      [limit]
    );

    return records.map(r => ({
      id: r.id,
      receiptId: r.receipt_id,
      merchant: r.merchant || undefined,
      suggestedCategory: r.suggested_category || undefined,
      correctedCategory: r.corrected_category,
      appliedAt: r.applied_at,
    }));
  }

  /**
   * Get skill status
   */
  async getStatus(): Promise<{
    connected: boolean;
    categoriesCount: number;
    merchantMappingsCount: number;
  }> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const categoriesCount = await get<{ count: number }>(this.db, 'SELECT COUNT(*) as count FROM categories');
    const mappingsCount = await get<{ count: number }>(this.db, 'SELECT COUNT(*) as count FROM merchant_mappings');

    return {
      connected: true,
      categoriesCount: categoriesCount?.count || 0,
      merchantMappingsCount: mappingsCount?.count || 0,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    message: string;
    details: {
      database: boolean;
      receiptsOCR: boolean;
    };
  }> {
    try {
      await this.ensureDatabase();
      if (!this.db) throw new Error('Database not initialized');

      // Test database
      await run(this.db, 'SELECT 1');

      // Test receipts OCR
      const receiptsStatus = await this.receiptsSkill.getStatus();

      return {
        healthy: true,
        message: 'Expense Categorizer is operational',
        details: {
          database: true,
          receiptsOCR: receiptsStatus.connected,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: {
          database: false,
          receiptsOCR: false,
        },
      };
    }
  }

  /**
   * Get statistics for a specific category within a date range
   */
  async getCategoryStats(
    category: string,
    options: { startDate?: string; endDate?: string } = {}
  ): Promise<CategoryStats | null> {
    await this.ensureDatabase();

    // Get receipts from receipts-ocr skill for this category and date range
    const receipts = await this.receiptsSkill.listReceipts({
      startDate: options.startDate,
      endDate: options.endDate,
    });

    // Filter by category
    const categoryReceipts = receipts.filter(r => r.category === category);

    if (categoryReceipts.length === 0) {
      return null;
    }

    const totalAmount = categoryReceipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    
    // Calculate average confidence
    const confidences = categoryReceipts.map(r => 
      ((r.totalConfidence || 0) + (r.merchantConfidence || 0) + (r.dateConfidence || 0)) / 3
    );
    const averageConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    return {
      category,
      receiptCount: categoryReceipts.length,
      totalAmount,
      averageConfidence,
    };
  }
}

export default ExpenseCategorizerSkill;
