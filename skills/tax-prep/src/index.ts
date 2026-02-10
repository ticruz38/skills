/**
 * Tax Preparation Skill
 * Compile tax documents and summaries from invoices and receipts
 * Depends on: invoices, receipts-ocr
 */

import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { InvoicesSkill } from '@openclaw/invoices';
import { ReceiptsOCRSkill } from '@openclaw/receipts-ocr';

/**
 * IRS Schedule C Expense Categories
 */
export type IRSExpenseCategory =
  | 'Advertising'
  | 'Car and Truck Expenses'
  | 'Commissions and Fees'
  | 'Contract Labor'
  | 'Depletion'
  | 'Depreciation'
  | 'Employee Benefit Programs'
  | 'Insurance'
  | 'Interest'
  | 'Legal and Professional Services'
  | 'Office Expense'
  | 'Pension and Profit Sharing Plans'
  | 'Rent or Lease - Vehicles'
  | 'Rent or Lease - Equipment'
  | 'Rent or Lease - Other'
  | 'Repairs and Maintenance'
  | 'Supplies'
  | 'Taxes and Licenses'
  | 'Travel'
  | 'Meals'
  | 'Utilities'
  | 'Wages'
  | 'Other Expenses';

/**
 * Expense category mapping
 */
export interface ExpenseCategoryMapping {
  id?: number;
  keyword: string;
  category: IRSExpenseCategory;
  priority: number;
  createdAt?: string;
}

/**
 * Categorized expense for tax purposes
 */
export interface CategorizedExpense {
  id?: number;
  sourceType: 'receipt' | 'invoice';
  sourceId: number;
  date?: string;
  description?: string;
  amount: number;
  category: IRSExpenseCategory;
  deductible: boolean;
  deductibleAmount: number;
  notes?: string;
  createdAt?: string;
}

/**
 * Categorized expense database record
 */
interface CategorizedExpenseRecord {
  id?: number;
  source_type: 'receipt' | 'invoice';
  source_id: number;
  date?: string;
  description?: string;
  amount: number;
  category: IRSExpenseCategory;
  deductible: number;
  deductible_amount: number;
  notes?: string;
  created_at?: string;
}

/**
 * Schedule C Line Item
 */
export interface ScheduleCLineItem {
  category: IRSExpenseCategory;
  lineNumber: string;
  amount: number;
  description: string;
}

/**
 * Schedule C Report
 */
export interface ScheduleCReport {
  year: number;
  generatedAt: string;
  businessName?: string;
  businessAddress?: string;
  ein?: string;

  // Income (Part I)
  grossReceipts: number;
  returnsAndAllowances: number;
  netReceipts: number;
  costOfGoodsSold: number;
  grossProfit: number;
  otherIncome: number;
  grossIncome: number;

  // Expenses (Part II)
  expenses: Record<IRSExpenseCategory, number>;
  totalExpenses: number;

  // Net Profit/Loss
  netProfit: number;

  // Detailed breakdown
  lineItems: ScheduleCLineItem[];
}

/**
 * 1099 Contractor Payment
 */
export interface Contractor1099 {
  name: string;
  address?: string;
  taxId?: string;
  totalPaid: number;
  payments: Array<{
    date: string;
    amount: number;
    invoiceNumber?: string;
    description?: string;
  }>;
  requires1099: boolean;
}

/**
 * Tax Year Summary
 */
export interface TaxYearSummary {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  totalDeductions: number;
  estimatedTaxDue: number;
  expenseBreakdown: Record<IRSExpenseCategory, { count: number; amount: number }>;
}

/**
 * TurboTax CSV Format
 */
export interface TurboTaxRow {
  date: string;
  description: string;
  category: string;
  amount: number;
  taxable: boolean;
}

/**
 * Accountant Package
 */
export interface AccountantPackage {
  year: number;
  generatedAt: string;
  incomeSummary: {
    totalRevenue: number;
    byClient: Array<{ clientName: string; amount: number }>;
  };
  expenseSummary: {
    totalExpenses: number;
    byCategory: Record<IRSExpenseCategory, { count: number; amount: number; deductibleAmount: number }>;
  };
  scheduleC: ScheduleCReport;
  contractors1099: Contractor1099[];
  receiptCount: number;
  invoiceCount: number;
}

/**
 * Tax prep skill configuration
 */
export interface TaxPrepSkillConfig {
  dataDir?: string;
  businessName?: string;
  businessAddress?: string;
  ein?: string;
}

// Default category mappings
const DEFAULT_CATEGORY_MAPPINGS: Array<{ keyword: string; category: IRSExpenseCategory; priority: number }> = [
  // Advertising
  { keyword: 'advertising', category: 'Advertising', priority: 100 },
  { keyword: 'marketing', category: 'Advertising', priority: 100 },
  { keyword: 'google ads', category: 'Advertising', priority: 100 },
  { keyword: 'facebook ads', category: 'Advertising', priority: 100 },
  { keyword: 'promotion', category: 'Advertising', priority: 90 },
  
  // Car and Truck
  { keyword: 'gas', category: 'Car and Truck Expenses', priority: 100 },
  { keyword: 'fuel', category: 'Car and Truck Expenses', priority: 100 },
  { keyword: 'shell', category: 'Car and Truck Expenses', priority: 90 },
  { keyword: 'exxon', category: 'Car and Truck Expenses', priority: 90 },
  { keyword: 'bp', category: 'Car and Truck Expenses', priority: 90 },
  { keyword: 'chevron', category: 'Car and Truck Expenses', priority: 90 },
  { keyword: 'parking', category: 'Car and Truck Expenses', priority: 100 },
  { keyword: 'toll', category: 'Car and Truck Expenses', priority: 100 },
  { keyword: 'uber', category: 'Car and Truck Expenses', priority: 90 },
  { keyword: 'lyft', category: 'Car and Truck Expenses', priority: 90 },
  { keyword: 'taxi', category: 'Car and Truck Expenses', priority: 90 },
  
  // Contract Labor
  { keyword: 'contractor', category: 'Contract Labor', priority: 100 },
  { keyword: 'freelancer', category: 'Contract Labor', priority: 100 },
  { keyword: 'consultant', category: 'Contract Labor', priority: 90 },
  { keyword: 'upwork', category: 'Contract Labor', priority: 100 },
  { keyword: 'fiverr', category: 'Contract Labor', priority: 100 },
  
  // Insurance
  { keyword: 'insurance', category: 'Insurance', priority: 100 },
  { keyword: 'liability', category: 'Insurance', priority: 90 },
  { keyword: 'business insurance', category: 'Insurance', priority: 100 },
  
  // Legal and Professional
  { keyword: 'legal', category: 'Legal and Professional Services', priority: 100 },
  { keyword: 'attorney', category: 'Legal and Professional Services', priority: 100 },
  { keyword: 'lawyer', category: 'Legal and Professional Services', priority: 100 },
  { keyword: 'accounting', category: 'Legal and Professional Services', priority: 100 },
  { keyword: 'accountant', category: 'Legal and Professional Services', priority: 100 },
  { keyword: 'bookkeeping', category: 'Legal and Professional Services', priority: 100 },
  { keyword: 'tax preparation', category: 'Legal and Professional Services', priority: 100 },
  
  // Office Expense
  { keyword: 'office supplies', category: 'Office Expense', priority: 100 },
  { keyword: 'staples', category: 'Office Expense', priority: 90 },
  { keyword: 'paper', category: 'Office Expense', priority: 90 },
  { keyword: 'printer', category: 'Office Expense', priority: 80 },
  { keyword: 'ink', category: 'Office Expense', priority: 80 },
  { keyword: 'software', category: 'Office Expense', priority: 90 },
  { keyword: 'subscription', category: 'Office Expense', priority: 70 },
  { keyword: 'saas', category: 'Office Expense', priority: 80 },
  
  // Rent or Lease
  { keyword: 'rent', category: 'Rent or Lease - Other', priority: 100 },
  { keyword: 'lease', category: 'Rent or Lease - Other', priority: 100 },
  { keyword: 'coworking', category: 'Rent or Lease - Other', priority: 100 },
  { keyword: 'wework', category: 'Rent or Lease - Other', priority: 90 },
  
  // Repairs and Maintenance
  { keyword: 'repair', category: 'Repairs and Maintenance', priority: 100 },
  { keyword: 'maintenance', category: 'Repairs and Maintenance', priority: 100 },
  
  // Supplies
  { keyword: 'supplies', category: 'Supplies', priority: 90 },
  
  // Taxes and Licenses
  { keyword: 'business license', category: 'Taxes and Licenses', priority: 100 },
  { keyword: 'permit', category: 'Taxes and Licenses', priority: 90 },
  { keyword: 'registration', category: 'Taxes and Licenses', priority: 80 },
  
  // Travel
  { keyword: 'hotel', category: 'Travel', priority: 100 },
  { keyword: 'airbnb', category: 'Travel', priority: 100 },
  { keyword: 'flight', category: 'Travel', priority: 100 },
  { keyword: 'airline', category: 'Travel', priority: 90 },
  { keyword: 'airfare', category: 'Travel', priority: 100 },
  { keyword: 'lodging', category: 'Travel', priority: 100 },
  
  // Meals (50% deductible)
  { keyword: 'restaurant', category: 'Meals', priority: 90 },
  { keyword: 'cafe', category: 'Meals', priority: 90 },
  { keyword: 'coffee', category: 'Meals', priority: 70 },
  { keyword: 'lunch', category: 'Meals', priority: 100 },
  { keyword: 'dinner', category: 'Meals', priority: 100 },
  { keyword: 'catering', category: 'Meals', priority: 100 },
  { keyword: 'doordash', category: 'Meals', priority: 80 },
  { keyword: 'ubereats', category: 'Meals', priority: 80 },
  { keyword: 'grubhub', category: 'Meals', priority: 80 },
  
  // Utilities
  { keyword: 'internet', category: 'Utilities', priority: 100 },
  { keyword: 'phone', category: 'Utilities', priority: 100 },
  { keyword: 'mobile', category: 'Utilities', priority: 90 },
  { keyword: 'cell', category: 'Utilities', priority: 90 },
  { keyword: 'electricity', category: 'Utilities', priority: 100 },
  { keyword: 'water', category: 'Utilities', priority: 100 },
  { keyword: 'gas utility', category: 'Utilities', priority: 90 },
  { keyword: 'verizon', category: 'Utilities', priority: 80 },
  { keyword: 'at&t', category: 'Utilities', priority: 80 },
  { keyword: 't-mobile', category: 'Utilities', priority: 80 },
  
  // Interest
  { keyword: 'interest', category: 'Interest', priority: 100 },
  { keyword: 'loan', category: 'Interest', priority: 80 },
];

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
 * Tax Preparation Skill - Compile tax documents and summaries
 */
export class TaxPrepSkill {
  private dataDir: string;
  private businessName?: string;
  private businessAddress?: string;
  private ein?: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;
  private invoicesSkill: InvoicesSkill;
  private receiptsSkill: ReceiptsOCRSkill;

  constructor(config: TaxPrepSkillConfig = {}) {
    this.dataDir = config.dataDir || path.join(os.homedir(), '.openclaw', 'skills', 'tax-prep');
    this.businessName = config.businessName;
    this.businessAddress = config.businessAddress;
    this.ein = config.ein;
    this.invoicesSkill = new InvoicesSkill();
    this.receiptsSkill = new ReceiptsOCRSkill();
    this.initPromise = this.initDatabase();
  }

  /**
   * Initialize database and directories
   */
  private async initDatabase(): Promise<void> {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
    }

    const dbPath = path.join(this.dataDir, 'tax.db');
    
    this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const db = new (sqlite3 as any).Database(dbPath, (err: Error | null) => {
        if (err) reject(err);
        else resolve(db);
      });
    });

    await this.createTables();
    await this.seedDefaultCategories();
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Category mappings table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS category_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Categorized expenses table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS categorized_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL,
        source_id INTEGER NOT NULL,
        date TEXT,
        description TEXT,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        deductible INTEGER DEFAULT 1,
        deductible_amount REAL NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(source_type, source_id)
      )
    `);

    // Tax year summaries
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS tax_years (
        year INTEGER PRIMARY KEY,
        total_income REAL DEFAULT 0,
        total_expenses REAL DEFAULT 0,
        net_profit REAL DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Contractor payments for 1099 tracking
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS contractor_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contractor_name TEXT NOT NULL,
        address TEXT,
        tax_id TEXT,
        payment_date TEXT NOT NULL,
        amount REAL NOT NULL,
        invoice_number TEXT,
        year INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create indexes
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_expenses_category ON categorized_expenses(category)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_expenses_date ON categorized_expenses(date)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_expenses_source ON categorized_expenses(source_type, source_id)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_contractor_name ON contractor_payments(contractor_name)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_contractor_year ON contractor_payments(year)`);
  }

  /**
   * Seed default category mappings
   */
  private async seedDefaultCategories(): Promise<void> {
    if (!this.db) return;

    for (const mapping of DEFAULT_CATEGORY_MAPPINGS) {
      try {
        await run(this.db, `
          INSERT OR IGNORE INTO category_mappings (keyword, category, priority)
          VALUES (?, ?, ?)
        `, [mapping.keyword.toLowerCase(), mapping.category, mapping.priority]);
      } catch {
        // Ignore duplicate errors
      }
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
   * Categorize an expense based on description and merchant
   */
  private async categorizeExpense(description: string, merchant?: string): Promise<{ category: IRSExpenseCategory; confidence: number }> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const searchText = `${description || ''} ${merchant || ''}`.toLowerCase();
    
    // Get all category mappings
    const mappings = await all<ExpenseCategoryMapping>(this.db, 
      'SELECT * FROM category_mappings ORDER BY priority DESC'
    );

    for (const mapping of mappings) {
      if (searchText.includes(mapping.keyword.toLowerCase())) {
        return { category: mapping.category, confidence: mapping.priority / 100 };
      }
    }

    // Default category
    return { category: 'Other Expenses', confidence: 0 };
  }

  /**
   * Calculate deductible amount (e.g., 50% for meals)
   */
  private calculateDeductibleAmount(amount: number, category: IRSExpenseCategory): number {
    // Meals are only 50% deductible
    if (category === 'Meals') {
      return amount * 0.5;
    }
    return amount;
  }

  /**
   * Categorize all uncategorized expenses
   */
  async categorizeExpenses(options: {
    year?: number;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<{ categorized: number; total: number }> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    // Get date range
    let startDate = options.startDate;
    let endDate = options.endDate;

    if (options.year && !startDate && !endDate) {
      startDate = `${options.year}-01-01`;
      endDate = `${options.year}-12-31`;
    }

    let categorized = 0;

    // Get receipts from receipts-ocr skill
    const receipts = await this.receiptsSkill.listReceipts({
      startDate,
      endDate,
      status: 'confirmed',
    });

    for (const receipt of receipts) {
      // Check if already categorized
      const existing = await get(this.db,
        'SELECT id FROM categorized_expenses WHERE source_type = ? AND source_id = ?',
        ['receipt', receipt.id]
      );

      if (!existing && receipt.totalAmount) {
        const { category } = await this.categorizeExpense(
          receipt.rawText || '',
          receipt.merchant
        );

        const deductibleAmount = this.calculateDeductibleAmount(receipt.totalAmount, category);

        await run(this.db, `
          INSERT INTO categorized_expenses 
          (source_type, source_id, date, description, amount, category, deductible, deductible_amount, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          'receipt',
          receipt.id,
          receipt.date,
          receipt.merchant,
          receipt.totalAmount,
          category,
          1,
          deductibleAmount,
          receipt.category || null,
        ]);

        categorized++;
      }
    }

    return { categorized, total: receipts.length };
  }

  /**
   * Get deductions by category
   */
  async getDeductions(options: {
    year?: number;
    startDate?: string;
    endDate?: string;
    category?: IRSExpenseCategory;
  } = {}): Promise<{
    expenses: CategorizedExpense[];
    byCategory: Record<IRSExpenseCategory, { count: number; amount: number; deductibleAmount: number }>;
    totalDeductible: number;
  }> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    let startDate = options.startDate;
    let endDate = options.endDate;

    if (options.year && !startDate && !endDate) {
      startDate = `${options.year}-01-01`;
      endDate = `${options.year}-12-31`;
    }

    let sql = 'SELECT * FROM categorized_expenses WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      sql += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND date <= ?';
      params.push(endDate);
    }
    if (options.category) {
      sql += ' AND category = ?';
      params.push(options.category);
    }

    sql += ' ORDER BY date DESC';

    const records = await all<CategorizedExpenseRecord>(this.db, sql, params);
    
    const expenses: CategorizedExpense[] = records.map(r => ({
      id: r.id,
      sourceType: r.source_type,
      sourceId: r.source_id,
      date: r.date,
      description: r.description,
      amount: r.amount,
      category: r.category,
      deductible: r.deductible === 1,
      deductibleAmount: r.deductible_amount,
      notes: r.notes,
      createdAt: r.created_at,
    }));

    // Group by category
    const byCategory: Record<IRSExpenseCategory, { count: number; amount: number; deductibleAmount: number }> = {} as any;
    let totalDeductible = 0;

    for (const exp of expenses) {
      if (!byCategory[exp.category]) {
        byCategory[exp.category] = { count: 0, amount: 0, deductibleAmount: 0 };
      }
      byCategory[exp.category].count++;
      byCategory[exp.category].amount += exp.amount;
      byCategory[exp.category].deductibleAmount += exp.deductibleAmount;
      totalDeductible += exp.deductibleAmount;
    }

    return { expenses, byCategory, totalDeductible };
  }

  /**
   * Generate Schedule C report
   */
  async generateScheduleC(year: number): Promise<ScheduleCReport> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Get income from invoices
    const paidInvoices = await this.invoicesSkill.listInvoices({
      startDate,
      endDate,
      status: 'paid',
    });

    const grossReceipts = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const returnsAndAllowances = 0; // Would need tracking
    const netReceipts = grossReceipts - returnsAndAllowances;
    const costOfGoodsSold = 0; // Would need inventory tracking
    const grossProfit = netReceipts - costOfGoodsSold;
    const otherIncome = 0;
    const grossIncome = grossProfit + otherIncome;

    // Get expenses
    const { byCategory } = await this.getDeductions({ year });

    const expenses: Record<IRSExpenseCategory, number> = {} as any;
    let totalExpenses = 0;

    for (const [cat, data] of Object.entries(byCategory)) {
      expenses[cat as IRSExpenseCategory] = data.deductibleAmount;
      totalExpenses += data.deductibleAmount;
    }

    const netProfit = grossIncome - totalExpenses;

    // Build line items
    const lineItems: ScheduleCLineItem[] = [];
    const categoryToLine: Record<string, string> = {
      'Advertising': '8',
      'Car and Truck Expenses': '9',
      'Commissions and Fees': '10',
      'Contract Labor': '11',
      'Depletion': '12',
      'Depreciation': '13',
      'Employee Benefit Programs': '14',
      'Insurance': '15',
      'Interest': '16',
      'Legal and Professional Services': '17',
      'Office Expense': '18',
      'Pension and Profit Sharing Plans': '19',
      'Rent or Lease - Vehicles': '20a',
      'Rent or Lease - Equipment': '20b',
      'Rent or Lease - Other': '20b',
      'Repairs and Maintenance': '21',
      'Supplies': '22',
      'Taxes and Licenses': '23',
      'Travel': '24a',
      'Meals': '24b',
      'Utilities': '25',
      'Wages': '26',
      'Other Expenses': '27a',
    };

    for (const [category, amount] of Object.entries(expenses)) {
      if (amount > 0) {
        lineItems.push({
          category: category as IRSExpenseCategory,
          lineNumber: categoryToLine[category] || '27a',
          amount,
          description: `${category} expenses`,
        });
      }
    }

    return {
      year,
      generatedAt: new Date().toISOString(),
      businessName: this.businessName,
      businessAddress: this.businessAddress,
      ein: this.ein,
      grossReceipts,
      returnsAndAllowances,
      netReceipts,
      costOfGoodsSold,
      grossProfit,
      otherIncome,
      grossIncome,
      expenses,
      totalExpenses,
      netProfit,
      lineItems,
    };
  }

  /**
   * Get 1099 contractors (payments >= $600)
   */
  async get1099Contractors(options: {
    year?: number;
    minAmount?: number;
  } = {}): Promise<Contractor1099[]> {
    const year = options.year || new Date().getFullYear();
    const minAmount = options.minAmount || 600;

    // Get paid invoices to identify contractors
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const paidInvoices = await this.invoicesSkill.listInvoices({
      startDate,
      endDate,
      status: 'paid',
    });

    // Group by client (potential contractors)
    const contractorMap = new Map<string, Contractor1099>();

    for (const invoice of paidInvoices) {
      const clientName = invoice.clientName || 'Unknown';
      
      if (!contractorMap.has(clientName)) {
        contractorMap.set(clientName, {
          name: clientName,
          totalPaid: 0,
          payments: [],
          requires1099: false,
        });
      }

      const contractor = contractorMap.get(clientName)!;
      contractor.totalPaid += invoice.total;
      contractor.payments.push({
        date: invoice.issueDate,
        amount: invoice.total,
        invoiceNumber: invoice.invoiceNumber,
        description: invoice.lineItems.map(li => li.description).join(', '),
      });
    }

    // Filter for 1099 requirement (>= $600)
    const contractors: Contractor1099[] = [];
    for (const contractor of contractorMap.values()) {
      contractor.requires1099 = contractor.totalPaid >= minAmount;
      contractors.push(contractor);
    }

    // Sort by total paid descending
    contractors.sort((a, b) => b.totalPaid - a.totalPaid);

    return contractors;
  }

  /**
   * Export data for TurboTax
   */
  async exportForTurboTax(year: number): Promise<{
    rows: TurboTaxRow[];
    csv: string;
  }> {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Get income (invoices)
    const paidInvoices = await this.invoicesSkill.listInvoices({
      startDate,
      endDate,
      status: 'paid',
    });

    // Get expenses
    const { expenses } = await this.getDeductions({ year });

    const rows: TurboTaxRow[] = [];

    // Add income rows
    for (const invoice of paidInvoices) {
      rows.push({
        date: invoice.issueDate,
        description: `Invoice ${invoice.invoiceNumber} - ${invoice.clientName}`,
        category: 'Business Income',
        amount: invoice.total,
        taxable: true,
      });
    }

    // Add expense rows
    for (const expense of expenses) {
      rows.push({
        date: expense.date || '',
        description: expense.description || '',
        category: expense.category,
        amount: -expense.deductibleAmount, // Negative for expenses
        taxable: false,
      });
    }

    // Sort by date
    rows.sort((a, b) => a.date.localeCompare(b.date));

    // Generate CSV
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Taxable'];
    const csvRows = rows.map(r => [
      r.date,
      `"${r.description.replace(/"/g, '""')}"`,
      r.category,
      r.amount.toFixed(2),
      r.taxable ? 'Yes' : 'No',
    ]);

    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');

    return { rows, csv };
  }

  /**
   * Generate accountant package
   */
  async generateAccountantPackage(year: number, outputDir?: string): Promise<{
    package: AccountantPackage;
    files: string[];
  }> {
    await this.ensureDatabase();
    
    const outDir = outputDir || path.join(this.dataDir, `package-${year}`);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const files: string[] = [];

    // Get all data
    const scheduleC = await this.generateScheduleC(year);
    const contractors = await this.get1099Contractors({ year });
    const { byCategory, totalDeductible } = await this.getDeductions({ year });

    // Get invoice summary
    const paidInvoices = await this.invoicesSkill.listInvoices({
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      status: 'paid',
    });

    const incomeByClient: Record<string, number> = {};
    for (const inv of paidInvoices) {
      const name = inv.clientName || 'Unknown';
      incomeByClient[name] = (incomeByClient[name] || 0) + inv.total;
    }

    const packageData: AccountantPackage = {
      year,
      generatedAt: new Date().toISOString(),
      incomeSummary: {
        totalRevenue: paidInvoices.reduce((sum, inv) => sum + inv.total, 0),
        byClient: Object.entries(incomeByClient).map(([clientName, amount]) => ({
          clientName,
          amount,
        })),
      },
      expenseSummary: {
        totalExpenses: totalDeductible,
        byCategory,
      },
      scheduleC,
      contractors1099: contractors,
      receiptCount: (await this.receiptsSkill.listReceipts({
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      })).length,
      invoiceCount: paidInvoices.length,
    };

    // Save package JSON
    const packagePath = path.join(outDir, `tax-package-${year}.json`);
    fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2));
    files.push(packagePath);

    // Save Schedule C HTML
    const scheduleCPath = path.join(outDir, `schedule-c-${year}.html`);
    fs.writeFileSync(scheduleCPath, this.generateScheduleCHTML(scheduleC));
    files.push(scheduleCPath);

    // Save income summary CSV
    const incomePath = path.join(outDir, `income-${year}.csv`);
    const incomeCSV = [
      'Client,Amount',
      ...packageData.incomeSummary.byClient.map(c => `${c.clientName},${c.amount.toFixed(2)}`),
      `Total,${packageData.incomeSummary.totalRevenue.toFixed(2)}`,
    ].join('\n');
    fs.writeFileSync(incomePath, incomeCSV);
    files.push(incomePath);

    // Save expense summary CSV
    const expensePath = path.join(outDir, `expenses-${year}.csv`);
    const expenseCSV = [
      'Category,Count,Amount,Deductible Amount',
      ...Object.entries(byCategory).map(([cat, data]) => 
        `${cat},${data.count},${data.amount.toFixed(2)},${data.deductibleAmount.toFixed(2)}`
      ),
      `Total,0,0,${totalDeductible.toFixed(2)}`,
    ].join('\n');
    fs.writeFileSync(expensePath, expenseCSV);
    files.push(expensePath);

    // Save 1099 contractors CSV
    const contractorsPath = path.join(outDir, `1099-contractors-${year}.csv`);
    const contractorsCSV = [
      'Name,Total Paid,Requires 1099',
      ...contractors.map(c => `${c.name},${c.totalPaid.toFixed(2)},${c.requires1099 ? 'Yes' : 'No'}`),
    ].join('\n');
    fs.writeFileSync(contractorsPath, contractorsCSV);
    files.push(contractorsPath);

    // Save TurboTax export
    const { csv: turbotaxCSV } = await this.exportForTurboTax(year);
    const turbotaxPath = path.join(outDir, `turbotax-${year}.csv`);
    fs.writeFileSync(turbotaxPath, turbotaxCSV);
    files.push(turbotaxPath);

    return { package: packageData, files };
  }

  /**
   * Generate Schedule C HTML
   */
  private generateScheduleCHTML(report: ScheduleCReport): string {
    const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
    
    const expenseRows = Object.entries(report.expenses)
      .filter(([, amount]) => amount > 0)
      .map(([category, amount]) => `
        <tr>
          <td>${category}</td>
          <td style="text-align: right;">${formatCurrency(amount)}</td>
        </tr>
      `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Schedule C - ${report.year}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; max-width: 800px; }
    h1 { font-size: 24px; margin-bottom: 10px; }
    h2 { font-size: 18px; margin-top: 30px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
    .business-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .info-row { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th { background: #2c3e50; color: white; padding: 10px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #ddd; }
    .total-row { font-weight: bold; background: #f0f0f0; }
    .net-profit { font-size: 18px; font-weight: bold; color: ${report.netProfit >= 0 ? '#27ae60' : '#e74c3c'}; }
    .section { margin: 20px 0; }
  </style>
</head>
<body>
  <h1>Schedule C - Profit or Loss from Business (${report.year})</h1>
  
  <div class="business-info">
    <div class="info-row"><strong>Business Name:</strong> ${report.businessName || 'Not specified'}</div>
    <div class="info-row"><strong>EIN:</strong> ${report.ein || 'Not specified'}</div>
    <div class="info-row"><strong>Generated:</strong> ${new Date(report.generatedAt).toLocaleDateString()}</div>
  </div>

  <div class="section">
    <h2>Part I - Income</h2>
    <table>
      <tr><td>Gross receipts or sales</td><td style="text-align: right;">${formatCurrency(report.grossReceipts)}</td></tr>
      <tr><td>Returns and allowances</td><td style="text-align: right;">${formatCurrency(report.returnsAndAllowances)}</td></tr>
      <tr class="total-row"><td>Net receipts</td><td style="text-align: right;">${formatCurrency(report.netReceipts)}</td></tr>
      <tr><td>Cost of goods sold</td><td style="text-align: right;">${formatCurrency(report.costOfGoodsSold)}</td></tr>
      <tr class="total-row"><td>Gross profit</td><td style="text-align: right;">${formatCurrency(report.grossProfit)}</td></tr>
      <tr><td>Other income</td><td style="text-align: right;">${formatCurrency(report.otherIncome)}</td></tr>
      <tr class="total-row"><td>Gross income</td><td style="text-align: right;">${formatCurrency(report.grossIncome)}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Part II - Expenses</h2>
    <table>
      ${expenseRows}
      <tr class="total-row">
        <td>Total Expenses</td>
        <td style="text-align: right;">${formatCurrency(report.totalExpenses)}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>Net Profit or Loss</h2>
    <div class="net-profit">
      ${report.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}: ${formatCurrency(Math.abs(report.netProfit))}
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Add custom category mapping
   */
  async addCategoryMapping(keyword: string, category: IRSExpenseCategory, priority: number = 100): Promise<void> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    await run(this.db, `
      INSERT OR REPLACE INTO category_mappings (keyword, category, priority)
      VALUES (?, ?, ?)
    `, [keyword.toLowerCase(), category, priority]);
  }

  /**
   * Get tax year summary
   */
  async getTaxYearSummary(year: number): Promise<TaxYearSummary> {
    const scheduleC = await this.generateScheduleC(year);
    const { byCategory, totalDeductible } = await this.getDeductions({ year });

    // Simple estimated tax calculation (simplified)
    const selfEmploymentTaxRate = 0.153;
    const selfEmploymentTax = Math.max(0, scheduleC.netProfit * selfEmploymentTaxRate);
    const incomeTax = Math.max(0, scheduleC.netProfit * 0.15); // Simplified estimate
    const estimatedTaxDue = selfEmploymentTax + incomeTax;

    return {
      year,
      totalIncome: scheduleC.grossIncome,
      totalExpenses: scheduleC.totalExpenses,
      netProfit: scheduleC.netProfit,
      totalDeductions: totalDeductible,
      estimatedTaxDue,
      expenseBreakdown: byCategory as any,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string; dependencies: Record<string, { status: 'healthy' | 'unhealthy'; message?: string }> }> {
    try {
      await this.ensureDatabase();
      if (!this.db) {
        return {
          status: 'unhealthy',
          message: 'Database not initialized',
          dependencies: {},
        };
      }

      await get(this.db, 'SELECT 1');

      // Check dependencies
      const invoicesHealth = await this.invoicesSkill.healthCheck();
      const receiptsStatus = this.receiptsSkill.isConnected();

      const dependencies: Record<string, { status: 'healthy' | 'unhealthy'; message?: string }> = {
        invoices: invoicesHealth,
        'receipts-ocr': {
          status: receiptsStatus ? 'healthy' : 'unhealthy',
          message: receiptsStatus ? 'Connected to Google Vision' : 'Not authenticated with Google',
        },
      };

      const allHealthy = invoicesHealth.status === 'healthy' && receiptsStatus;

      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        message: allHealthy ? 'Tax prep skill is ready' : 'Some dependencies are not healthy',
        dependencies,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Health check failed: ${error}`,
        dependencies: {},
      };
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.ensureDatabase();

    if (this.db) {
      await new Promise<void>((resolve) => {
        this.db!.close(() => resolve());
      });
      this.db = null;
    }
  }
}

/**
 * Factory function to get TaxPrepSkill instance
 */
export function getTaxPrepSkill(config?: TaxPrepSkillConfig): TaxPrepSkill {
  return new TaxPrepSkill(config);
}

export default TaxPrepSkill;
