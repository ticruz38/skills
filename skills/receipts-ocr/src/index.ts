/**
 * Receipts OCR Skill
 * Extract data from receipt photos using Google Vision API
 * Built on top of google-oauth skill
 */

import { GoogleOAuthClient } from '@openclaw/google-oauth';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Google Vision API base URL
const VISION_API_BASE = 'https://vision.googleapis.com/v1';

/**
 * Receipt line item extracted from OCR
 */
export interface ReceiptLineItem {
  id?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  confidence: number;
}

/**
 * Receipt line item database record (snake_case columns)
 */
interface ReceiptLineItemRecord {
  id?: number;
  receipt_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  confidence: number;
}

/**
 * Receipt data extracted from OCR
 */
export interface Receipt {
  id?: number;
  imagePath: string;
  merchant?: string;
  merchantConfidence: number;
  totalAmount?: number;
  totalConfidence: number;
  taxAmount?: number;
  taxConfidence: number;
  date?: string;
  dateConfidence: number;
  category?: string;
  paymentMethod?: string;
  lineItems: ReceiptLineItem[];
  rawText?: string;
  status: 'pending' | 'confirmed' | 'corrected' | 'rejected';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Receipt database record (snake_case columns)
 */
interface ReceiptRecord {
  id?: number;
  image_path: string;
  merchant?: string;
  merchant_confidence: number;
  total_amount?: number;
  total_confidence: number;
  tax_amount?: number;
  tax_confidence: number;
  date?: string;
  date_confidence: number;
  category?: string;
  payment_method?: string;
  raw_text?: string;
  status: 'pending' | 'confirmed' | 'corrected' | 'rejected';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * OCR extraction result from Google Vision
 */
export interface ExtractionResult {
  merchant?: string;
  merchantConfidence: number;
  totalAmount?: number;
  totalConfidence: number;
  taxAmount?: number;
  taxConfidence: number;
  date?: string;
  dateConfidence: number;
  category?: string;
  paymentMethod?: string;
  lineItems: ReceiptLineItem[];
  rawText: string;
}

/**
 * Receipts OCR skill configuration
 */
export interface ReceiptsOCRSkillConfig {
  profile?: string;
  dataDir?: string;
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
 * Receipts OCR Skill - Extract data from receipt images
 */
export class ReceiptsOCRSkill {
  private googleClient: GoogleOAuthClient;
  private profile: string;
  private dataDir: string;
  private imagesDir: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: ReceiptsOCRSkillConfig = {}) {
    this.profile = config.profile || 'default';
    this.dataDir = config.dataDir || path.join(os.homedir(), '.openclaw', 'skills', 'receipts-ocr');
    this.imagesDir = path.join(this.dataDir, 'images');
    this.googleClient = new GoogleOAuthClient(this.profile);
    this.initPromise = this.initDatabase();
  }

  /**
   * Create ReceiptsOCRSkill for a specific profile
   */
  static forProfile(profile: string = 'default'): ReceiptsOCRSkill {
    return new ReceiptsOCRSkill({ profile });
  }

  /**
   * Initialize database and directories
   */
  private async initDatabase(): Promise<void> {
    // Create directories
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
    }
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true, mode: 0o700 });
    }

    const dbPath = path.join(this.dataDir, 'receipts.db');
    
    this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const db = new (sqlite3 as any).Database(dbPath, (err: Error | null) => {
        if (err) reject(err);
        else resolve(db);
      });
    });

    // Create tables
    await this.createTables();
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Receipts table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_path TEXT NOT NULL,
        merchant TEXT,
        merchant_confidence REAL DEFAULT 0,
        total_amount REAL,
        total_confidence REAL DEFAULT 0,
        tax_amount REAL,
        tax_confidence REAL DEFAULT 0,
        date TEXT,
        date_confidence REAL DEFAULT 0,
        category TEXT,
        payment_method TEXT,
        raw_text TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Line items table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS receipt_line_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        quantity REAL DEFAULT 1,
        unit_price REAL,
        total REAL,
        confidence REAL DEFAULT 0,
        FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_receipts_merchant ON receipts(merchant)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_line_items_receipt ON receipt_line_items(receipt_id)`);
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
   * Close database connection
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
  }

  /**
   * Check if connected to Google
   */
  isConnected(): boolean {
    return this.googleClient.isConnected();
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    connected: boolean;
    profile: string;
    hasVisionAccess: boolean;
  }> {
    const connected = this.isConnected();
    let hasVisionAccess = false;

    if (connected) {
      try {
        const token = await this.googleClient.getAccessToken();
        hasVisionAccess = !!token;
      } catch {
        hasVisionAccess = false;
      }
    }

    return {
      connected,
      profile: this.profile,
      hasVisionAccess,
    };
  }

  /**
   * Perform OCR on an image using Google Vision API
   */
  async performOCR(imagePath: string): Promise<ExtractionResult> {
    await this.ensureDatabase();

    const accessToken = await this.googleClient.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please connect your Google account first.');
    }

    // Read image file
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // Call Google Vision API
    const response = await fetch(`${VISION_API_BASE}/images:annotate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          image: {
            content: base64Image,
          },
          features: [
            { type: 'DOCUMENT_TEXT_DETECTION' },
            { type: 'TEXT_DETECTION' },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vision API error: ${error}`);
    }

    const data = await response.json() as {
      responses: Array<{
        fullTextAnnotation?: {
          text?: string;
          pages?: Array<{
            blocks?: Array<{
              blockType?: string;
              paragraphs?: Array<{
                words?: Array<{
                  symbols?: Array<{
                    text?: string;
                    confidence?: number;
                  }>;
                }>;
              }>;
            }>;
          }>;
        };
        textAnnotations?: Array<{
          description?: string;
          score?: number;
        }>;
      }>;
    };

    const fullText = data.responses[0]?.fullTextAnnotation?.text || '';
    
    // Parse the extracted text
    return this.parseReceiptText(fullText);
  }

  /**
   * Parse receipt text to extract structured data
   */
  private parseReceiptText(text: string): ExtractionResult {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const fullText = text.toLowerCase();

    // Extract merchant (usually near the top, often in ALL CAPS or Title Case)
    let merchant: string | undefined;
    let merchantConfidence = 0;
    
    // Look for merchant name in first few lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      // Skip common non-merchant headers
      if (/^\d+$/.test(line) || /^www\./i.test(line) || /^http/i.test(line)) {
        continue;
      }
      // Look for store names (often contain LLC, Inc, Store, Market, etc. or are in title case)
      if (line.length > 2 && line.length < 50 && !/^\d/.test(line)) {
        merchant = line;
        merchantConfidence = 0.8;
        break;
      }
    }

    // Extract total amount
    let totalAmount: number | undefined;
    let totalConfidence = 0;
    
    // Look for total patterns
    const totalPatterns = [
      /total[\s:]*[$]?([\d,]+\.\d{2})/i,
      /amount[\s:]*[$]?([\d,]+\.\d{2})/i,
      /sum[\s:]*[$]?([\d,]+\.\d{2})/i,
      /balance[\s:]*[$]?([\d,]+\.\d{2})/i,
      /[$]?([\d,]+\.\d{2})\s*total/i,
    ];

    for (const pattern of totalPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        totalAmount = parseFloat(match[1].replace(/,/g, ''));
        totalConfidence = 0.85;
        break;
      }
    }

    // If no total found, look for the largest dollar amount
    if (!totalAmount) {
      const amounts: Array<{ amount: number; line: string; index: number }> = [];
      const amountPattern = /[$]?([\d,]+\.\d{2})/g;
      let match;
      
      while ((match = amountPattern.exec(text)) !== null) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (amount > 0 && amount < 100000) { // Reasonable range for receipts
          amounts.push({ amount, line: lines.find(l => l.includes(match![0])) || '', index: match.index });
        }
      }

      if (amounts.length > 0) {
        // Sort by amount and pick the largest reasonable one
        amounts.sort((a, b) => b.amount - a.amount);
        // Filter out likely totals (lines containing "total", "sum", "amount")
        const likelyTotal = amounts.find(a => 
          /total|sum|amount|balance/i.test(a.line)
        );
        totalAmount = likelyTotal?.amount || amounts[0].amount;
        totalConfidence = likelyTotal ? 0.75 : 0.6;
      }
    }

    // Extract tax amount
    let taxAmount: number | undefined;
    let taxConfidence = 0;
    
    const taxPatterns = [
      /tax[\s:]*[$]?([\d,]+\.\d{2})/i,
      /vat[\s:]*[$]?([\d,]+\.\d{2})/i,
      /gst[\s:]*[$]?([\d,]+\.\d{2})/i,
    ];

    for (const pattern of taxPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        taxAmount = parseFloat(match[1].replace(/,/g, ''));
        taxConfidence = 0.8;
        break;
      }
    }

    // Extract date
    let date: string | undefined;
    let dateConfidence = 0;
    
    const datePatterns = [
      // MM/DD/YYYY or MM-DD-YYYY
      { pattern: /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/, format: 'mdy' },
      // YYYY/MM/DD or YYYY-MM-DD
      { pattern: /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/, format: 'ymd' },
      // DD/MM/YYYY or DD-MM-YYYY (European)
      { pattern: /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/, format: 'dmy' },
    ];

    for (const { pattern } of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        // Try to parse as ISO date
        try {
          const parsed = new Date(match[0]);
          if (!isNaN(parsed.getTime())) {
            date = parsed.toISOString().split('T')[0];
            dateConfidence = 0.85;
            break;
          }
        } catch {
          // Continue to next pattern
        }
      }
    }

    // Extract payment method
    let paymentMethod: string | undefined;
    const paymentPatterns = [
      { pattern: /visa|mastercard|amex|american express|discover/i, method: 'Credit Card' },
      { pattern: /cash/i, method: 'Cash' },
      { pattern: /check|cheque/i, method: 'Check' },
      { pattern: /debit/i, method: 'Debit Card' },
      { pattern: /apple pay|google pay|paypal/i, method: 'Digital Wallet' },
    ];

    for (const { pattern, method } of paymentPatterns) {
      if (pattern.test(fullText)) {
        paymentMethod = method;
        break;
      }
    }

    // Extract line items
    const lineItems: ReceiptLineItem[] = [];
    
    // Look for patterns like "Item Name ... $X.XX" or tabular data
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip header/footer lines
      if (/total|subtotal|tax|change|cash|visa|mastercard|thank|welcome|receipt/i.test(line)) {
        continue;
      }

      // Look for price at end of line
      const priceMatch = line.match(/[$]?([\d,]+\.\d{2})\s*$/);
      if (priceMatch && line.length > 5) {
        const description = line.substring(0, line.lastIndexOf(priceMatch[0])).trim();
        const total = parseFloat(priceMatch[1].replace(/,/g, ''));
        
        // Try to extract quantity
        let quantity = 1;
        let unitPrice = total;
        
        const qtyMatch = description.match(/^(\d+)\s*[@x]\s*[$]?([\d,]+\.\d{2})/i);
        if (qtyMatch) {
          quantity = parseInt(qtyMatch[1]);
          unitPrice = parseFloat(qtyMatch[2].replace(/,/g, ''));
        } else {
          const simpleQtyMatch = description.match(/^(\d+)\s+/);
          if (simpleQtyMatch) {
            quantity = parseInt(simpleQtyMatch[1]);
            unitPrice = total / quantity;
          }
        }

        if (description.length > 2) {
          lineItems.push({
            description: description.replace(/^\d+\s*[@x]?\s*/, '').trim(),
            quantity,
            unitPrice,
            total,
            confidence: 0.7,
          });
        }
      }
    }

    // Infer category from merchant and items
    let category: string | undefined;
    const categoryKeywords: Record<string, RegExp[]> = {
      'Groceries': [/grocery|supermarket|market|food|produce|meat/i],
      'Dining': [/restaurant|cafe|coffee|pizza|burger|food/i],
      'Gas': [/gas|fuel|petrol|shell|exxon|bp|chevron/i],
      'Pharmacy': [/pharmacy|drugstore|walgreens|cvs|rite aid/i],
      'Office': [/office|supplies|staples|paper|ink/i],
      'Electronics': [/electronics|best buy|amazon|computer|phone/i],
      'Transportation': [/uber|lyft|taxi|transit|bus|train/i],
      'Entertainment': [/movie|theater|cinema|game|entertainment/i],
      'Retail': [/walmart|target|costco|store|shop/i],
    };

    for (const [cat, patterns] of Object.entries(categoryKeywords)) {
      if (patterns.some(p => p.test(fullText))) {
        category = cat;
        break;
      }
    }

    return {
      merchant,
      merchantConfidence,
      totalAmount,
      totalConfidence,
      taxAmount,
      taxConfidence,
      date,
      dateConfidence,
      category,
      paymentMethod,
      lineItems,
      rawText: text,
    };
  }

  /**
   * Process a receipt image - OCR and save to database
   */
  async processReceipt(imagePath: string, options: {
    copyImage?: boolean;
    notes?: string;
  } = {}): Promise<Receipt> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Copy image to storage if requested
    let storedImagePath = imagePath;
    if (options.copyImage) {
      const ext = path.extname(imagePath);
      const filename = `receipt_${Date.now()}${ext}`;
      storedImagePath = path.join(this.imagesDir, filename);
      fs.copyFileSync(imagePath, storedImagePath);
    }

    // Perform OCR
    const extraction = await this.performOCR(imagePath);

    // Create receipt record
    const result = await runWithResult(this.db, `
      INSERT INTO receipts (
        image_path, merchant, merchant_confidence, total_amount, total_confidence,
        tax_amount, tax_confidence, date, date_confidence, category, payment_method,
        raw_text, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      storedImagePath,
      extraction.merchant || null,
      extraction.merchantConfidence,
      extraction.totalAmount || null,
      extraction.totalConfidence,
      extraction.taxAmount || null,
      extraction.taxConfidence,
      extraction.date || null,
      extraction.dateConfidence,
      extraction.category || null,
      extraction.paymentMethod || null,
      extraction.rawText,
      'pending',
      options.notes || null,
    ]);

    const receiptId = result.lastID;

    // Insert line items
    for (const item of extraction.lineItems) {
      await run(this.db, `
        INSERT INTO receipt_line_items (receipt_id, description, quantity, unit_price, total, confidence)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [receiptId, item.description, item.quantity, item.unitPrice, item.total, item.confidence]);
    }

    return this.getReceipt(receiptId) as Promise<Receipt>;
  }

  /**
   * Get receipt by ID
   */
  async getReceipt(id: number): Promise<Receipt | null> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<ReceiptRecord>(this.db, 'SELECT * FROM receipts WHERE id = ?', [id]);
    if (!record) return null;

    // Get line items
    const lineItemRecords = await all<ReceiptLineItemRecord>(this.db,
      'SELECT * FROM receipt_line_items WHERE receipt_id = ?', [id]
    );

    const lineItems: ReceiptLineItem[] = lineItemRecords.map(r => ({
      id: r.id,
      description: r.description,
      quantity: r.quantity,
      unitPrice: r.unit_price,
      total: r.total,
      confidence: r.confidence,
    }));

    return {
      id: record.id,
      imagePath: record.image_path,
      merchant: record.merchant,
      merchantConfidence: record.merchant_confidence,
      totalAmount: record.total_amount,
      totalConfidence: record.total_confidence,
      taxAmount: record.tax_amount,
      taxConfidence: record.tax_confidence,
      date: record.date,
      dateConfidence: record.date_confidence,
      category: record.category,
      paymentMethod: record.payment_method,
      lineItems,
      rawText: record.raw_text,
      status: record.status,
      notes: record.notes,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  /**
   * List receipts with optional filters
   */
  async listReceipts(options: {
    status?: 'pending' | 'confirmed' | 'corrected' | 'rejected';
    startDate?: string;
    endDate?: string;
    merchant?: string;
    category?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Receipt[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM receipts WHERE 1=1';
    const params: any[] = [];

    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }
    if (options.startDate) {
      sql += ' AND date >= ?';
      params.push(options.startDate);
    }
    if (options.endDate) {
      sql += ' AND date <= ?';
      params.push(options.endDate);
    }
    if (options.merchant) {
      sql += ' AND merchant LIKE ?';
      params.push(`%${options.merchant}%`);
    }
    if (options.category) {
      sql += ' AND category = ?';
      params.push(options.category);
    }

    sql += ' ORDER BY created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const records = await all<ReceiptRecord>(this.db, sql, params);
    const receipts: Receipt[] = [];

    for (const record of records) {
      const lineItemRecords = await all<ReceiptLineItemRecord>(this.db,
        'SELECT * FROM receipt_line_items WHERE receipt_id = ?', [record.id!]
      );

      receipts.push({
        id: record.id,
        imagePath: record.image_path,
        merchant: record.merchant,
        merchantConfidence: record.merchant_confidence,
        totalAmount: record.total_amount,
        totalConfidence: record.total_confidence,
        taxAmount: record.tax_amount,
        taxConfidence: record.tax_confidence,
        date: record.date,
        dateConfidence: record.date_confidence,
        category: record.category,
        paymentMethod: record.payment_method,
        lineItems: lineItemRecords.map(r => ({
          id: r.id,
          description: r.description,
          quantity: r.quantity,
          unitPrice: r.unit_price,
          total: r.total,
          confidence: r.confidence,
        })),
        rawText: record.raw_text,
        status: record.status,
        notes: record.notes,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      });
    }

    return receipts;
  }

  /**
   * Update receipt with manual corrections
   */
  async updateReceipt(id: number, updates: {
    merchant?: string;
    totalAmount?: number;
    taxAmount?: number;
    date?: string;
    category?: string;
    paymentMethod?: string;
    status?: 'pending' | 'confirmed' | 'corrected' | 'rejected';
    notes?: string;
    lineItems?: Array<{
      id?: number;
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
  }): Promise<Receipt> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.merchant !== undefined) { fields.push('merchant = ?'); values.push(updates.merchant); }
    if (updates.totalAmount !== undefined) { fields.push('total_amount = ?'); values.push(updates.totalAmount); }
    if (updates.taxAmount !== undefined) { fields.push('tax_amount = ?'); values.push(updates.taxAmount); }
    if (updates.date !== undefined) { fields.push('date = ?'); values.push(updates.date); }
    if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
    if (updates.paymentMethod !== undefined) { fields.push('payment_method = ?'); values.push(updates.paymentMethod); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }

    if (fields.length > 0) {
      fields.push('updated_at = datetime("now")');
      fields.push('status = COALESCE(?, status)');
      values.push(updates.status || 'corrected');
      values.push(id);

      await run(this.db, `UPDATE receipts SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    // Update line items if provided
    if (updates.lineItems !== undefined) {
      // Delete existing line items
      await run(this.db, 'DELETE FROM receipt_line_items WHERE receipt_id = ?', [id]);

      // Insert new line items
      for (const item of updates.lineItems) {
        await run(this.db, `
          INSERT INTO receipt_line_items (receipt_id, description, quantity, unit_price, total, confidence)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [id, item.description, item.quantity, item.unitPrice, item.total, 1.0]); // Manual entries have 100% confidence
      }
    }

    const receipt = await this.getReceipt(id);
    if (!receipt) throw new Error('Receipt not found');
    return receipt;
  }

  /**
   * Delete receipt
   */
  async deleteReceipt(id: number): Promise<void> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    // Get receipt to find image path
    const receipt = await get<{ image_path: string }>(this.db, 'SELECT image_path FROM receipts WHERE id = ?', [id]);
    
    // Delete from database (cascades to line items)
    await run(this.db, 'DELETE FROM receipts WHERE id = ?', [id]);

    // Delete image file if it's in our storage
    if (receipt && receipt.image_path.startsWith(this.imagesDir)) {
      try {
        fs.unlinkSync(receipt.image_path);
      } catch {
        // Ignore errors deleting files
      }
    }
  }

  /**
   * Confirm a receipt (mark as verified)
   */
  async confirmReceipt(id: number): Promise<Receipt> {
    return this.updateReceipt(id, { status: 'confirmed' });
  }

  /**
   * Reject a receipt (mark as invalid)
   */
  async rejectReceipt(id: number): Promise<Receipt> {
    return this.updateReceipt(id, { status: 'rejected' });
  }

  /**
   * Get receipt statistics
   */
  async getStats(options: {
    startDate?: string;
    endDate?: string;
  } = {}): Promise<{
    totalReceipts: number;
    totalAmount: number;
    byStatus: Record<string, { count: number; amount: number }>;
    byCategory: Record<string, { count: number; amount: number }>;
    averageConfidence: number;
  }> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (options.startDate) {
      whereClause += ' AND date >= ?';
      params.push(options.startDate);
    }
    if (options.endDate) {
      whereClause += ' AND date <= ?';
      params.push(options.endDate);
    }

    // Total receipts and amount
    const totalResult = await get<{ count: number; amount: number }>(this.db,
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount FROM receipts ${whereClause}`,
      params
    );

    // By status
    const statusRows = await all<{ status: string; count: number; amount: number }>(this.db,
      `SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount 
       FROM receipts ${whereClause} GROUP BY status`,
      [...params]
    );

    // By category
    const categoryRows = await all<{ category: string; count: number; amount: number }>(this.db,
      `SELECT category, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount 
       FROM receipts ${whereClause} AND category IS NOT NULL GROUP BY category`,
      [...params]
    );

    // Average confidence
    const confidenceResult = await get<{ avg: number }>(this.db,
      `SELECT AVG((merchant_confidence + total_confidence + date_confidence) / 3) as avg 
       FROM receipts ${whereClause}`,
      [...params]
    );

    const byStatus: Record<string, { count: number; amount: number }> = {};
    for (const row of statusRows) {
      byStatus[row.status] = { count: row.count, amount: row.amount };
    }

    const byCategory: Record<string, { count: number; amount: number }> = {};
    for (const row of categoryRows) {
      byCategory[row.category || 'Uncategorized'] = { count: row.count, amount: row.amount };
    }

    return {
      totalReceipts: totalResult?.count || 0,
      totalAmount: totalResult?.amount || 0,
      byStatus,
      byCategory,
      averageConfidence: confidenceResult?.avg || 0,
    };
  }

  /**
   * Export receipts to CSV
   */
  async exportToCSV(options: {
    startDate?: string;
    endDate?: string;
    status?: 'pending' | 'confirmed' | 'corrected' | 'rejected';
  } = {}): Promise<string> {
    const receipts = await this.listReceipts(options);
    
    const headers = ['ID', 'Date', 'Merchant', 'Category', 'Payment Method', 'Total', 'Tax', 'Status', 'Notes'];
    const rows = receipts.map(r => [
      r.id,
      r.date || '',
      r.merchant || '',
      r.category || '',
      r.paymentMethod || '',
      r.totalAmount?.toFixed(2) || '',
      r.taxAmount?.toFixed(2) || '',
      r.status,
      r.notes || '',
    ]);

    return [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    googleStatus?: 'connected' | 'disconnected';
  }> {
    try {
      await this.ensureDatabase();
      
      const status = await this.getStatus();
      
      if (!status.connected) {
        return {
          status: 'unhealthy',
          message: 'Google OAuth not connected',
          googleStatus: 'disconnected',
        };
      }

      return {
        status: 'healthy',
        message: 'Receipts OCR skill is operational',
        googleStatus: 'connected',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Default export
export default ReceiptsOCRSkill;
