/**
 * Tax Export Skill
 * Export expenses for tax filing with multiple formats
 * Built on top of expense-categorizer skill
 */

import { ExpenseCategorizerSkill, CategoryStats } from '@openclaw/expense-categorizer';
import { ReceiptsOCRSkill, Receipt } from '@openclaw/receipts-ocr';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * IRS Schedule C Category
 */
export interface IRSCategory {
  id?: number;
  code: string;
  name: string;
  description: string;
  deductibleRate: number; // 1.0 = 100%, 0.5 = 50% (meals)
}

/**
 * Category to IRS mapping
 */
export interface CategoryIRSMapping {
  id?: number;
  expenseCategory: string;
  irsCategory: string;
  deductibleRate: number;
  isCustom: boolean;
}

/**
 * Category to IRS mapping database record
 */
interface CategoryIRSMappingRecord {
  id?: number;
  expense_category: string;
  irs_category: string;
  deductible_rate: number;
  is_custom: number;
}

/**
 * Export options
 */
export interface ExportOptions {
  year?: number;
  startDate?: string;
  endDate?: string;
  category?: string;
  deductibleOnly?: boolean;
  minAmount?: number;
  maxAmount?: number;
  status?: ('pending' | 'confirmed' | 'corrected' | 'rejected')[];
}

/**
 * Export result
 */
export interface ExportResult {
  format: 'csv' | 'pdf' | 'bundle';
  content: string | Buffer;
  filename: string;
  recordCount: number;
  totalAmount: number;
  deductibleAmount: number;
  generatedAt: string;
}

/**
 * Export history record
 */
export interface ExportHistory {
  id?: number;
  format: string;
  filename: string;
  filters: string;
  recordCount: number;
  totalAmount: number;
  generatedAt: string;
}

/**
 * Tax export statistics
 */
export interface TaxExportStats {
  totalExports: number;
  byFormat: Record<string, number>;
  totalRecordsExported: number;
  lastExportDate?: string;
}

/**
 * Skill configuration
 */
export interface TaxExportSkillConfig {
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
 * Default IRS Schedule C categories
 */
const DEFAULT_IRS_CATEGORIES: IRSCategory[] = [
  { code: '1', name: 'Advertising', description: 'Marketing, advertising, promotion costs', deductibleRate: 1.0 },
  { code: '2', name: 'Car and Truck Expenses', description: 'Vehicle expenses, mileage', deductibleRate: 1.0 },
  { code: '3', name: 'Commissions and Fees', description: 'Payments to subcontractors', deductibleRate: 1.0 },
  { code: '4', name: 'Contract Labor', description: 'Independent contractor payments', deductibleRate: 1.0 },
  { code: '5', name: 'Depletion', description: 'Natural resource depletion', deductibleRate: 1.0 },
  { code: '6', name: 'Depreciation', description: 'Asset depreciation', deductibleRate: 1.0 },
  { code: '7', name: 'Employee Benefit Programs', description: 'Health insurance, retirement plans', deductibleRate: 1.0 },
  { code: '8', name: 'Insurance', description: 'Business insurance premiums', deductibleRate: 1.0 },
  { code: '9', name: 'Interest', description: 'Business loan interest', deductibleRate: 1.0 },
  { code: '10', name: 'Legal and Professional Services', description: 'Legal fees, accounting', deductibleRate: 1.0 },
  { code: '11', name: 'Office Expense', description: 'Office supplies, equipment', deductibleRate: 1.0 },
  { code: '12', name: 'Pension and Profit Sharing Plans', description: 'Retirement contributions', deductibleRate: 1.0 },
  { code: '13', name: 'Rent or Lease', description: 'Equipment, vehicle, property rent', deductibleRate: 1.0 },
  { code: '14', name: 'Repairs and Maintenance', description: 'Equipment repairs', deductibleRate: 1.0 },
  { code: '15', name: 'Supplies', description: 'Materials and supplies', deductibleRate: 1.0 },
  { code: '16', name: 'Taxes and Licenses', description: 'Business licenses, property taxes', deductibleRate: 1.0 },
  { code: '17', name: 'Travel', description: 'Business travel expenses', deductibleRate: 1.0 },
  { code: '18', name: 'Meals', description: 'Business meals (50% deductible)', deductibleRate: 0.5 },
  { code: '19', name: 'Utilities', description: 'Electricity, water, internet, phone', deductibleRate: 1.0 },
  { code: '20', name: 'Wages', description: 'Employee salaries and wages', deductibleRate: 1.0 },
  { code: '21', name: 'Other Expenses', description: 'Miscellaneous business expenses', deductibleRate: 1.0 },
];

/**
 * Default category mappings
 */
const DEFAULT_CATEGORY_MAPPINGS: Array<{ expenseCategory: string; irsCategory: string; deductibleRate: number }> = [
  { expenseCategory: 'Office', irsCategory: 'Office Expense', deductibleRate: 1.0 },
  { expenseCategory: 'Electronics', irsCategory: 'Office Expense', deductibleRate: 1.0 },
  { expenseCategory: 'Dining', irsCategory: 'Meals', deductibleRate: 0.5 },
  { expenseCategory: 'Travel', irsCategory: 'Travel', deductibleRate: 1.0 },
  { expenseCategory: 'Transportation', irsCategory: 'Car and Truck Expenses', deductibleRate: 1.0 },
  { expenseCategory: 'Gas', irsCategory: 'Car and Truck Expenses', deductibleRate: 1.0 },
  { expenseCategory: 'Utilities', irsCategory: 'Utilities', deductibleRate: 1.0 },
  { expenseCategory: 'Healthcare', irsCategory: 'Employee Benefit Programs', deductibleRate: 1.0 },
  { expenseCategory: 'Entertainment', irsCategory: 'Other Expenses', deductibleRate: 1.0 },
  { expenseCategory: 'Retail', irsCategory: 'Supplies', deductibleRate: 1.0 },
  { expenseCategory: 'Groceries', irsCategory: 'Supplies', deductibleRate: 1.0 },
  { expenseCategory: 'Pharmacy', irsCategory: 'Employee Benefit Programs', deductibleRate: 1.0 },
  { expenseCategory: 'Professional Services', irsCategory: 'Legal and Professional Services', deductibleRate: 1.0 },
  { expenseCategory: 'Advertising', irsCategory: 'Advertising', deductibleRate: 1.0 },
  { expenseCategory: 'Insurance', irsCategory: 'Insurance', deductibleRate: 1.0 },
  { expenseCategory: 'Repairs', irsCategory: 'Repairs and Maintenance', deductibleRate: 1.0 },
  { expenseCategory: 'Rent', irsCategory: 'Rent or Lease', deductibleRate: 1.0 },
  { expenseCategory: 'Taxes', irsCategory: 'Taxes and Licenses', deductibleRate: 1.0 },
  { expenseCategory: 'Wages', irsCategory: 'Wages', deductibleRate: 1.0 },
];

/**
 * Tax Export Skill
 */
export class TaxExportSkill {
  private dataDir: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;
  private categorizerSkill: ExpenseCategorizerSkill;
  private receiptsSkill: ReceiptsOCRSkill;

  constructor(config: TaxExportSkillConfig = {}) {
    this.dataDir = config.dataDir || path.join(os.homedir(), '.openclaw', 'skills', 'tax-export');
    this.categorizerSkill = new ExpenseCategorizerSkill({ receiptsProfile: config.receiptsProfile || 'default' });
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

    const dbPath = path.join(this.dataDir, 'tax-export.db');
    
    this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const db = new (sqlite3 as any).Database(dbPath, (err: Error | null) => {
        if (err) reject(err);
        else resolve(db);
      });
    });

    // Create tables
    await this.createTables();
    
    // Seed default data
    await this.seedDefaultData();
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // IRS categories table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS irs_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        deductible_rate REAL DEFAULT 1.0
      )
    `);

    // Category mappings table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS category_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_category TEXT UNIQUE NOT NULL,
        irs_category TEXT NOT NULL,
        deductible_rate REAL DEFAULT 1.0,
        is_custom INTEGER DEFAULT 0
      )
    `);

    // Export history table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS export_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        format TEXT NOT NULL,
        filename TEXT NOT NULL,
        filters TEXT,
        record_count INTEGER DEFAULT 0,
        total_amount REAL DEFAULT 0,
        generated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create indexes
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_mappings_expense ON category_mappings(expense_category)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_mappings_irs ON category_mappings(irs_category)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_history_format ON export_history(format)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_history_date ON export_history(generated_at)`);
  }

  /**
   * Seed default data
   */
  private async seedDefaultData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Seed IRS categories
    for (const cat of DEFAULT_IRS_CATEGORIES) {
      await run(this.db, `
        INSERT OR IGNORE INTO irs_categories (code, name, description, deductible_rate)
        VALUES (?, ?, ?, ?)
      `, [cat.code, cat.name, cat.description, cat.deductibleRate]);
    }

    // Seed category mappings
    for (const mapping of DEFAULT_CATEGORY_MAPPINGS) {
      await run(this.db, `
        INSERT OR IGNORE INTO category_mappings (expense_category, irs_category, deductible_rate, is_custom)
        VALUES (?, ?, ?, 0)
      `, [mapping.expenseCategory, mapping.irsCategory, mapping.deductibleRate]);
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
    await this.categorizerSkill.close();
    await this.receiptsSkill.close();
  }

  /**
   * Get receipts with filtering
   */
  private async getFilteredReceipts(options: ExportOptions): Promise<Receipt[]> {
    // Build date range
    let startDate = options.startDate;
    let endDate = options.endDate;

    if (options.year && !startDate && !endDate) {
      startDate = `${options.year}-01-01`;
      endDate = `${options.year}-12-31`;
    }

    // Get receipts from receipts-ocr skill
    const receipts = await this.receiptsSkill.listReceipts({
      startDate,
      endDate,
    });

    // Apply additional filters
    return receipts.filter(receipt => {
      // Category filter
      if (options.category && receipt.category !== options.category) {
        return false;
      }

      // Amount filters
      if (options.minAmount !== undefined && (receipt.totalAmount || 0) < options.minAmount) {
        return false;
      }
      if (options.maxAmount !== undefined && (receipt.totalAmount || 0) > options.maxAmount) {
        return false;
      }

      // Status filter
      if (options.status && !options.status.includes(receipt.status)) {
        return false;
      }

      return true;
    });

    // Apply deductible filter separately since it requires async
    if (options.deductibleOnly) {
      const filtered: Receipt[] = [];
      for (const receipt of receipts) {
        const mapping = await this.getCategoryMapping(receipt.category || 'Uncategorized');
        if (mapping && (mapping as CategoryIRSMapping).deductibleRate > 0) {
          filtered.push(receipt);
        }
      }
      return filtered;
    }

    return receipts;
  }

  /**
   * Get IRS category mapping for an expense category
   */
  private async getCategoryMapping(expenseCategory: string): Promise<CategoryIRSMapping | null> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<CategoryIRSMappingRecord>(this.db,
      'SELECT * FROM category_mappings WHERE LOWER(expense_category) = LOWER(?)',
      [expenseCategory]
    );

    if (!record) {
      // Return default mapping to Other Expenses
      return {
        expenseCategory,
        irsCategory: 'Other Expenses',
        deductibleRate: 1.0,
        isCustom: false,
      };
    }

    return {
      id: record.id,
      expenseCategory: record.expense_category,
      irsCategory: record.irs_category,
      deductibleRate: record.deductible_rate,
      isCustom: record.is_custom === 1,
    };
  }

  /**
   * Export expenses to CSV format
   */
  async exportToCSV(options: ExportOptions = {}): Promise<ExportResult> {
    await this.ensureDatabase();

    const receipts = await this.getFilteredReceipts(options);
    
    if (receipts.length === 0) {
      return {
        format: 'csv',
        content: '',
        filename: 'expenses.csv',
        recordCount: 0,
        totalAmount: 0,
        deductibleAmount: 0,
        generatedAt: new Date().toISOString(),
      };
    }

    // Build CSV header
    const headers = [
      'Date',
      'Merchant',
      'Category',
      'IRS Category',
      'Amount',
      'Deductible Rate',
      'Deductible Amount',
      'Tax',
      'Total',
      'Payment Method',
      'Status',
      'Receipt ID',
    ];

    const rows: string[] = [headers.join(',')];
    let totalAmount = 0;
    let totalDeductible = 0;

    for (const receipt of receipts) {
      const mapping = await this.getCategoryMapping(receipt.category || 'Uncategorized');
      const amount = receipt.totalAmount || 0;
      const deductibleRate = mapping?.deductibleRate || 1.0;
      const deductibleAmount = amount * deductibleRate;

      totalAmount += amount;
      totalDeductible += deductibleAmount;

      const row = [
        receipt.date || '',
        this.escapeCSV(receipt.merchant || ''),
        receipt.category || 'Uncategorized',
        mapping?.irsCategory || 'Other Expenses',
        amount.toFixed(2),
        (deductibleRate * 100).toFixed(0) + '%',
        deductibleAmount.toFixed(2),
        (receipt.taxAmount || 0).toFixed(2),
        (amount + (receipt.taxAmount || 0)).toFixed(2),
        receipt.paymentMethod || '',
        receipt.status,
        receipt.id?.toString() || '',
      ];

      rows.push(row.map(field => this.escapeCSV(field)).join(','));
    }

    // Add summary row
    rows.push('');
    rows.push(`Total Records,${receipts.length}`);
    rows.push(`Total Amount,${totalAmount.toFixed(2)}`);
    rows.push(`Total Deductible,${totalDeductible.toFixed(2)}`);

    const content = rows.join('\n');
    const filename = options.year 
      ? `expenses-${options.year}.csv` 
      : `expenses-${new Date().toISOString().split('T')[0]}.csv`;

    // Record in history
    await this.recordExport('csv', filename, options, receipts.length, totalAmount);

    return {
      format: 'csv',
      content,
      filename,
      recordCount: receipts.length,
      totalAmount,
      deductibleAmount: totalDeductible,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Escape CSV field
   */
  private escapeCSV(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  /**
   * Generate PDF report (HTML format ready for PDF conversion)
   */
  async generatePDF(options: ExportOptions = {}): Promise<ExportResult> {
    await this.ensureDatabase();

    const receipts = await this.getFilteredReceipts(options);
    
    if (receipts.length === 0) {
      return {
        format: 'pdf',
        content: '',
        filename: 'report.html',
        recordCount: 0,
        totalAmount: 0,
        deductibleAmount: 0,
        generatedAt: new Date().toISOString(),
      };
    }

    // Group by IRS category
    const categoryGroups: Map<string, { receipts: Receipt[]; total: number; deductible: number }> = new Map();
    let grandTotal = 0;
    let grandDeductible = 0;

    for (const receipt of receipts) {
      const mapping = await this.getCategoryMapping(receipt.category || 'Uncategorized');
      const irsCategory = mapping?.irsCategory || 'Other Expenses';
      const amount = receipt.totalAmount || 0;
      const deductibleRate = mapping?.deductibleRate || 1.0;
      const deductibleAmount = amount * deductibleRate;

      const group = categoryGroups.get(irsCategory) || { receipts: [], total: 0, deductible: 0 };
      group.receipts.push(receipt);
      group.total += amount;
      group.deductible += deductibleAmount;
      categoryGroups.set(irsCategory, group);

      grandTotal += amount;
      grandDeductible += deductibleAmount;
    }

    const year = options.year || new Date().getFullYear();

    // Generate HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tax Expense Report ${year}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f5f5f5; font-weight: bold; }
    .summary { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
    .summary-row { display: flex; justify-content: space-between; margin: 10px 0; }
    .total { font-weight: bold; font-size: 1.2em; }
    .category-header { background-color: #e9e9e9; padding: 15px; margin-top: 20px; font-weight: bold; }
    .footer { margin-top: 40px; font-size: 0.9em; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <h1>Tax Expense Report - ${year}</h1>
  <p>Generated on: ${new Date().toLocaleDateString()}</p>
  
  <div class="summary">
    <div class="summary-row">
      <span>Total Records:</span>
      <span>${receipts.length}</span>
    </div>
    <div class="summary-row">
      <span>Total Expenses:</span>
      <span>$${grandTotal.toFixed(2)}</span>
    </div>
    <div class="summary-row total">
      <span>Total Deductible:</span>
      <span>$${grandDeductible.toFixed(2)}</span>
    </div>
  </div>

  ${Array.from(categoryGroups.entries()).map(([category, group]) => `
    <div class="category-header">
      ${category} - $${group.deductible.toFixed(2)} deductible
    </div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Merchant</th>
          <th>Category</th>
          <th>Amount</th>
          <th>Deductible</th>
        </tr>
      </thead>
      <tbody>
        ${group.receipts.map(r => {
          const mapping = DEFAULT_CATEGORY_MAPPINGS.find(m => m.expenseCategory === r.category) || 
                         { deductibleRate: 1.0, irsCategory: 'Other Expenses' };
          const amount = r.totalAmount || 0;
          const deductible = amount * (mapping.deductibleRate || 1.0);
          return `
            <tr>
              <td>${r.date || 'N/A'}</td>
              <td>${r.merchant || 'Unknown'}</td>
              <td>${r.category || 'Uncategorized'}</td>
              <td>$${amount.toFixed(2)}</td>
              <td>$${deductible.toFixed(2)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `).join('')}

  <div class="footer">
    <p><strong>Note:</strong> This report is for tax preparation purposes. Please consult with a tax professional.</p>
    <p>Meals are only 50% deductible. Keep original receipts for audit purposes.</p>
  </div>
</body>
</html>`;

    const filename = `report-${year}.html`;

    // Record in history
    await this.recordExport('pdf', filename, options, receipts.length, grandTotal);

    return {
      format: 'pdf',
      content: html,
      filename,
      recordCount: receipts.length,
      totalAmount: grandTotal,
      deductibleAmount: grandDeductible,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Bundle receipt images into a zip-like structure (returns paths and metadata)
   */
  async bundleReceipts(options: ExportOptions = {}): Promise<ExportResult> {
    await this.ensureDatabase();

    const receipts = await this.getFilteredReceipts(options);
    
    // Create bundle metadata
    const bundleData = {
      receipts: receipts.map(r => ({
        id: r.id,
        date: r.date,
        merchant: r.merchant,
        amount: r.totalAmount,
        category: r.category,
        imagePath: r.imagePath,
      })),
      totalCount: receipts.length,
      totalAmount: receipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
      generatedAt: new Date().toISOString(),
    };

    const year = options.year || new Date().getFullYear();
    const filename = `receipts-${year}.json`;

    // Record in history
    await this.recordExport('bundle', filename, options, receipts.length, bundleData.totalAmount);

    return {
      format: 'bundle',
      content: JSON.stringify(bundleData, null, 2),
      filename,
      recordCount: receipts.length,
      totalAmount: bundleData.totalAmount,
      deductibleAmount: 0, // Calculated separately
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Record export in history
   */
  private async recordExport(
    format: string,
    filename: string,
    options: ExportOptions,
    recordCount: number,
    totalAmount: number
  ): Promise<void> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    await run(this.db, `
      INSERT INTO export_history (format, filename, filters, record_count, total_amount)
      VALUES (?, ?, ?, ?, ?)
    `, [format, filename, JSON.stringify(options), recordCount, totalAmount]);
  }

  /**
   * Save export to file
   */
  async saveExport(result: ExportResult, filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (typeof result.content === 'string') {
      fs.writeFileSync(filePath, result.content, 'utf-8');
    } else {
      fs.writeFileSync(filePath, result.content);
    }
  }

  /**
   * Export complete tax package
   */
  async exportTaxPackage(year: number, outputDir: string): Promise<{
    csvPath: string;
    pdfPath: string;
    bundlePath: string;
  }> {
    const options: ExportOptions = { year };

    // Export CSV
    const csvResult = await this.exportToCSV(options);
    const csvPath = path.join(outputDir, csvResult.filename);
    await this.saveExport(csvResult, csvPath);

    // Export PDF (HTML format)
    const pdfResult = await this.generatePDF(options);
    const pdfPath = path.join(outputDir, pdfResult.filename);
    await this.saveExport(pdfResult, pdfPath);

    // Export bundle
    const bundleResult = await this.bundleReceipts(options);
    const bundlePath = path.join(outputDir, bundleResult.filename);
    await this.saveExport(bundleResult, bundlePath);

    return { csvPath, pdfPath, bundlePath };
  }

  /**
   * Get all IRS categories
   */
  async getIRSCategories(): Promise<IRSCategory[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<{
      id?: number;
      code: string;
      name: string;
      description: string;
      deductible_rate: number;
    }>(this.db, 'SELECT * FROM irs_categories ORDER BY code');

    return records.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      deductibleRate: r.deductible_rate,
    }));
  }

  /**
   * Get all category mappings
   */
  async getCategoryMappings(): Promise<CategoryIRSMapping[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<CategoryIRSMappingRecord>(
      this.db, 
      'SELECT * FROM category_mappings ORDER BY expense_category'
    );

    return records.map(r => ({
      id: r.id,
      expenseCategory: r.expense_category,
      irsCategory: r.irs_category,
      deductibleRate: r.deductible_rate,
      isCustom: r.is_custom === 1,
    }));
  }

  /**
   * Add or update custom category mapping
   */
  async setCategoryMapping(
    expenseCategory: string,
    irsCategory: string,
    deductibleRate: number = 1.0
  ): Promise<void> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const existing = await get<CategoryIRSMappingRecord>(this.db,
      'SELECT * FROM category_mappings WHERE LOWER(expense_category) = LOWER(?)',
      [expenseCategory]
    );

    if (existing) {
      await run(this.db, `
        UPDATE category_mappings 
        SET irs_category = ?, deductible_rate = ?, is_custom = 1
        WHERE id = ?
      `, [irsCategory, deductibleRate, existing.id]);
    } else {
      await run(this.db, `
        INSERT INTO category_mappings (expense_category, irs_category, deductible_rate, is_custom)
        VALUES (?, ?, ?, 1)
      `, [expenseCategory, irsCategory, deductibleRate]);
    }
  }

  /**
   * Get export history
   */
  async getExportHistory(limit: number = 50): Promise<ExportHistory[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    interface HistoryRecord {
      id?: number;
      format: string;
      filename: string;
      filters: string;
      record_count: number;
      total_amount: number;
      generated_at: string;
    }

    const records = await all<HistoryRecord>(this.db, 
      'SELECT * FROM export_history ORDER BY generated_at DESC LIMIT ?',
      [limit]
    );

    return records.map(r => ({
      id: r.id,
      format: r.format,
      filename: r.filename,
      filters: r.filters,
      recordCount: r.record_count,
      totalAmount: r.total_amount,
      generatedAt: r.generated_at,
    }));
  }

  /**
   * Get export statistics
   */
  async getStats(): Promise<TaxExportStats> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const totalExports = await get<{ count: number }>(
      this.db, 
      'SELECT COUNT(*) as count FROM export_history'
    );

    const byFormat = await all<{ format: string; count: number }>(
      this.db,
      'SELECT format, COUNT(*) as count FROM export_history GROUP BY format'
    );

    const totalRecords = await get<{ sum: number }>(
      this.db,
      'SELECT SUM(record_count) as sum FROM export_history'
    );

    const lastExport = await get<{ generated_at: string }>(
      this.db,
      'SELECT generated_at FROM export_history ORDER BY generated_at DESC LIMIT 1'
    );

    const byFormatMap: Record<string, number> = {};
    for (const row of byFormat) {
      byFormatMap[row.format] = row.count;
    }

    return {
      totalExports: totalExports?.count || 0,
      byFormat: byFormatMap,
      totalRecordsExported: totalRecords?.sum || 0,
      lastExportDate: lastExport?.generated_at,
    };
  }

  /**
   * Get skill status
   */
  async getStatus(): Promise<{
    connected: boolean;
    irsCategoriesCount: number;
    mappingsCount: number;
    totalExports: number;
  }> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const irsCategories = await get<{ count: number }>(
      this.db, 
      'SELECT COUNT(*) as count FROM irs_categories'
    );
    
    const mappings = await get<{ count: number }>(
      this.db, 
      'SELECT COUNT(*) as count FROM category_mappings'
    );
    
    const exports = await get<{ count: number }>(
      this.db, 
      'SELECT COUNT(*) as count FROM export_history'
    );

    return {
      connected: true,
      irsCategoriesCount: irsCategories?.count || 0,
      mappingsCount: mappings?.count || 0,
      totalExports: exports?.count || 0,
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
      expenseCategorizer: boolean;
      receiptsOCR: boolean;
    };
  }> {
    try {
      await this.ensureDatabase();
      if (!this.db) throw new Error('Database not initialized');

      // Test database
      await run(this.db, 'SELECT 1');

      // Test dependent skills
      const categorizerHealth = await this.categorizerSkill.healthCheck();
      const receiptsStatus = await this.receiptsSkill.getStatus();

      return {
        healthy: true,
        message: 'Tax Export is operational',
        details: {
          database: true,
          expenseCategorizer: categorizerHealth.healthy,
          receiptsOCR: receiptsStatus.connected,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: {
          database: false,
          expenseCategorizer: false,
          receiptsOCR: false,
        },
      };
    }
  }
}

export default TaxExportSkill;
