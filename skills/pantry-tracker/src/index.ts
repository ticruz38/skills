/**
 * Pantry Tracker Skill
 * Track pantry inventory with barcode scanning, expiration dates, and low stock alerts
 * No external APIs required - all data stored locally in SQLite
 */

import * as sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * Pantry item category
 */
export type PantryCategory = 
  | 'produce' 
  | 'meat' 
  | 'seafood' 
  | 'dairy' 
  | 'bakery' 
  | 'frozen' 
  | 'pantry' 
  | 'beverages' 
  | 'household' 
  | 'other';

/**
 * Pantry item record from database
 */
export interface PantryItem {
  id: number;
  barcode: string | null;
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategory;
  expirationDate: string | null;
  lowStockThreshold: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Record interface for database rows (snake_case)
 */
interface PantryItemRecord {
  id: number;
  barcode: string | null;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  expiration_date: string | null;
  low_stock_threshold: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Low stock alert
 */
export interface LowStockAlert {
  item: PantryItem;
  currentQuantity: number;
  threshold: number;
}

/**
 * Expiration alert
 */
export interface ExpirationAlert {
  item: PantryItem;
  daysUntilExpiry: number;
  status: 'expired' | 'expiring_soon' | 'warning';
}

/**
 * Shopping list item for integration
 */
export interface ShoppingListItem {
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategory;
  reason: 'low_stock' | 'expired' | 'manual';
}

/**
 * Statistics for pantry
 */
export interface PantryStats {
  totalItems: number;
  totalCategories: number;
  lowStockCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  itemsByCategory: Record<string, number>;
}

/**
 * Options for adding/updating pantry items
 */
export interface AddPantryItemOptions {
  barcode?: string;
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategory;
  expirationDate?: Date | string;
  lowStockThreshold?: number;
  notes?: string;
}

export interface UpdatePantryItemOptions {
  name?: string;
  quantity?: number;
  unit?: string;
  category?: PantryCategory;
  expirationDate?: Date | string | null;
  lowStockThreshold?: number;
  notes?: string | null;
}

/**
 * Options for listing items
 */
export interface ListItemsOptions {
  category?: PantryCategory;
  search?: string;
  lowStockOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  totalItems: number;
  lowStockItems: number;
  expiringItems: number;
  expiredItems: number;
  database: string;
  error?: string;
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
 * Convert database record to PantryItem interface
 */
function recordToItem(record: PantryItemRecord): PantryItem {
  return {
    id: record.id,
    barcode: record.barcode,
    name: record.name,
    quantity: record.quantity,
    unit: record.unit,
    category: record.category as PantryCategory,
    expirationDate: record.expiration_date,
    lowStockThreshold: record.low_stock_threshold,
    notes: record.notes,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

/**
 * Pantry Tracker Skill - Manage pantry inventory with alerts and expiration tracking
 */
export class PantryTrackerSkill {
  private dbPath: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(os.homedir(), '.openclaw', 'skills', 'pantry-tracker', 'pantry.db');
    this.initPromise = this.initDatabase();
  }

  /**
   * Initialize the database
   */
  private async initDatabase(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    // Open database
    this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else resolve(db);
      });
    });

    // Create tables
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS pantry_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 0,
        unit TEXT NOT NULL DEFAULT 'item',
        category TEXT NOT NULL DEFAULT 'other',
        expiration_date TEXT,
        low_stock_threshold REAL NOT NULL DEFAULT 1,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_pantry_barcode ON pantry_items(barcode)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_pantry_category ON pantry_items(category)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_pantry_name ON pantry_items(name)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_pantry_expiration ON pantry_items(expiration_date)`);
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Get all category names
   */
  getCategories(): PantryCategory[] {
    return [
      'produce',
      'meat',
      'seafood',
      'dairy',
      'bakery',
      'frozen',
      'pantry',
      'beverages',
      'household',
      'other'
    ];
  }

  /**
   * Add a new item to the pantry
   */
  async addItem(options: AddPantryItemOptions): Promise<PantryItem> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const expirationDate = options.expirationDate 
      ? (options.expirationDate instanceof Date ? options.expirationDate.toISOString().split('T')[0] : options.expirationDate)
      : null;

    // Check if item with same barcode already exists
    if (options.barcode) {
      const existing = await get<PantryItemRecord>(this.db, 
        'SELECT * FROM pantry_items WHERE barcode = ?', 
        [options.barcode]
      );
      
      if (existing) {
        // Update quantity instead of creating new
        const newQuantity = existing.quantity + options.quantity;
        await run(this.db, 
          `UPDATE pantry_items 
           SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [newQuantity, existing.id]
        );
        return this.getItem(existing.id);
      }
    }

    // Check if item with same name exists (for non-barcoded items)
    const existingByName = await get<PantryItemRecord>(this.db,
      'SELECT * FROM pantry_items WHERE name = ? COLLATE NOCASE AND barcode IS NULL',
      [options.name]
    );

    if (existingByName && !options.barcode) {
      // Update quantity
      const newQuantity = existingByName.quantity + options.quantity;
      await run(this.db,
        `UPDATE pantry_items 
         SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [newQuantity, existingByName.id]
      );
      return this.getItem(existingByName.id);
    }

    // Insert new item
    const result = await runWithResult(this.db, `
      INSERT INTO pantry_items 
        (barcode, name, quantity, unit, category, expiration_date, low_stock_threshold, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      options.barcode || null,
      options.name,
      options.quantity,
      options.unit,
      options.category,
      expirationDate,
      options.lowStockThreshold ?? 1,
      options.notes || null
    ]);

    return this.getItem(result.lastID);
  }

  /**
   * Get a single item by ID
   */
  async getItem(id: number): Promise<PantryItem> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<PantryItemRecord>(this.db, 
      'SELECT * FROM pantry_items WHERE id = ?', 
      [id]
    );

    if (!record) {
      throw new Error(`Pantry item with ID ${id} not found`);
    }

    return recordToItem(record);
  }

  /**
   * Get item by barcode
   */
  async getItemByBarcode(barcode: string): Promise<PantryItem | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<PantryItemRecord>(this.db, 
      'SELECT * FROM pantry_items WHERE barcode = ?', 
      [barcode]
    );

    return record ? recordToItem(record) : null;
  }

  /**
   * List all pantry items with optional filtering
   */
  async listItems(options: ListItemsOptions = {}): Promise<{ items: PantryItem[]; total: number }> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.category) {
      conditions.push('category = ?');
      params.push(options.category);
    }

    if (options.search) {
      conditions.push('(name LIKE ? OR notes LIKE ?)');
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    if (options.lowStockOnly) {
      conditions.push('quantity <= low_stock_threshold');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await get<{ count: number }>(this.db, 
      `SELECT COUNT(*) as count FROM pantry_items ${whereClause}`, 
      params
    );
    const total = countResult?.count || 0;

    // Get items with pagination
    let sql = `SELECT * FROM pantry_items ${whereClause} ORDER BY name`;
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
      if (options.offset) {
        sql += ` OFFSET ${options.offset}`;
      }
    }

    const records = await all<PantryItemRecord>(this.db, sql, params);
    const items = records.map(recordToItem);

    return { items, total };
  }

  /**
   * Update an existing pantry item
   */
  async updateItem(id: number, options: UpdatePantryItemOptions): Promise<PantryItem> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const params: any[] = [];

    if (options.name !== undefined) {
      updates.push('name = ?');
      params.push(options.name);
    }

    if (options.quantity !== undefined) {
      updates.push('quantity = ?');
      params.push(options.quantity);
    }

    if (options.unit !== undefined) {
      updates.push('unit = ?');
      params.push(options.unit);
    }

    if (options.category !== undefined) {
      updates.push('category = ?');
      params.push(options.category);
    }

    if (options.expirationDate !== undefined) {
      updates.push('expiration_date = ?');
      const expDate = options.expirationDate 
        ? (options.expirationDate instanceof Date ? options.expirationDate.toISOString().split('T')[0] : options.expirationDate)
        : null;
      params.push(expDate);
    }

    if (options.lowStockThreshold !== undefined) {
      updates.push('low_stock_threshold = ?');
      params.push(options.lowStockThreshold);
    }

    if (options.notes !== undefined) {
      updates.push('notes = ?');
      params.push(options.notes);
    }

    if (updates.length === 0) {
      return this.getItem(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await run(this.db, 
      `UPDATE pantry_items SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return this.getItem(id);
  }

  /**
   * Delete a pantry item
   */
  async deleteItem(id: number): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    await run(this.db, 'DELETE FROM pantry_items WHERE id = ?', [id]);
  }

  /**
   * Use/consume some quantity of an item
   */
  async consumeItem(id: number, amount: number): Promise<PantryItem> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const item = await this.getItem(id);
    const newQuantity = Math.max(0, item.quantity - amount);

    await run(this.db,
      'UPDATE pantry_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newQuantity, id]
    );

    return this.getItem(id);
  }

  /**
   * Restock/add quantity to an item
   */
  async restockItem(id: number, amount: number): Promise<PantryItem> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const item = await this.getItem(id);
    const newQuantity = item.quantity + amount;

    await run(this.db,
      'UPDATE pantry_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newQuantity, id]
    );

    return this.getItem(id);
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(): Promise<LowStockAlert[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<PantryItemRecord>(this.db,
      'SELECT * FROM pantry_items WHERE quantity <= low_stock_threshold ORDER BY quantity / low_stock_threshold',
      []
    );

    return records.map(record => ({
      item: recordToItem(record),
      currentQuantity: record.quantity,
      threshold: record.low_stock_threshold
    }));
  }

  /**
   * Get expiration alerts
   */
  async getExpirationAlerts(daysThreshold: number = 7): Promise<ExpirationAlert[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const records = await all<PantryItemRecord>(this.db,
      'SELECT * FROM pantry_items WHERE expiration_date IS NOT NULL ORDER BY expiration_date',
      []
    );

    const alerts: ExpirationAlert[] = [];

    for (const record of records) {
      if (!record.expiration_date) continue;

      const expirationDate = new Date(record.expiration_date);
      const daysUntilExpiry = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < -30) {
        // Skip items expired more than 30 days ago
        continue;
      }

      let status: 'expired' | 'expiring_soon' | 'warning';
      if (daysUntilExpiry < 0) {
        status = 'expired';
      } else if (daysUntilExpiry <= 3) {
        status = 'expiring_soon';
      } else if (daysUntilExpiry <= daysThreshold) {
        status = 'warning';
      } else {
        continue;
      }

      alerts.push({
        item: recordToItem(record),
        daysUntilExpiry,
        status
      });
    }

    return alerts;
  }

  /**
   * Generate shopping list from low stock and expired items
   */
  async generateShoppingList(): Promise<ShoppingListItem[]> {
    await this.ensureInitialized();
    
    const shoppingList: ShoppingListItem[] = [];

    // Add low stock items
    const lowStockAlerts = await this.getLowStockAlerts();
    for (const alert of lowStockAlerts) {
      shoppingList.push({
        name: alert.item.name,
        quantity: Math.ceil(alert.threshold * 2 - alert.currentQuantity),
        unit: alert.item.unit,
        category: alert.item.category,
        reason: 'low_stock'
      });
    }

    // Add expired items
    const expirationAlerts = await this.getExpirationAlerts(0);
    for (const alert of expirationAlerts.filter(a => a.status === 'expired')) {
      // Check if not already added from low stock
      if (!shoppingList.find(item => item.name === alert.item.name)) {
        shoppingList.push({
          name: alert.item.name,
          quantity: alert.item.lowStockThreshold * 2,
          unit: alert.item.unit,
          category: alert.item.category,
          reason: 'expired'
        });
      }
    }

    // Sort by category
    return shoppingList.sort((a, b) => a.category.localeCompare(b.category));
  }

  /**
   * Search items by name or barcode
   */
  async searchItems(query: string): Promise<PantryItem[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<PantryItemRecord>(this.db,
      `SELECT * FROM pantry_items 
       WHERE name LIKE ? OR barcode LIKE ? OR notes LIKE ?
       ORDER BY name`,
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );

    return records.map(recordToItem);
  }

  /**
   * Get pantry statistics
   */
  async getStats(): Promise<PantryStats> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const totalResult = await get<{ count: number }>(this.db, 'SELECT COUNT(*) as count FROM pantry_items');
    const totalItems = totalResult?.count || 0;

    const categoriesResult = await all<{ category: string; count: number }>(this.db,
      'SELECT category, COUNT(*) as count FROM pantry_items GROUP BY category'
    );

    const itemsByCategory: Record<string, number> = {};
    for (const row of categoriesResult) {
      itemsByCategory[row.category] = row.count;
    }

    const lowStockResult = await get<{ count: number }>(this.db,
      'SELECT COUNT(*) as count FROM pantry_items WHERE quantity <= low_stock_threshold'
    );
    const lowStockCount = lowStockResult?.count || 0;

    const expiringAlerts = await this.getExpirationAlerts(7);
    const expiringSoonCount = expiringAlerts.filter(a => a.status === 'expiring_soon' || a.status === 'warning').length;
    const expiredCount = expiringAlerts.filter(a => a.status === 'expired').length;

    return {
      totalItems,
      totalCategories: categoriesResult.length,
      lowStockCount,
      expiringSoonCount,
      expiredCount,
      itemsByCategory
    };
  }

  /**
   * Clear all expired items from pantry
   */
  async clearExpired(): Promise<number> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const today = new Date().toISOString().split('T')[0];
    const result = await runWithResult(this.db,
      'DELETE FROM pantry_items WHERE expiration_date < ?',
      [today]
    );

    return result.changes;
  }

  /**
   * Check health status
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      await this.ensureInitialized();
      if (!this.db) throw new Error('Database not initialized');

      const stats = await this.getStats();
      const lowStockAlerts = await this.getLowStockAlerts();
      const expirationAlerts = await this.getExpirationAlerts(7);

      return {
        status: 'healthy',
        totalItems: stats.totalItems,
        lowStockItems: lowStockAlerts.length,
        expiringItems: expirationAlerts.filter(a => a.status !== 'expired').length,
        expiredItems: expirationAlerts.filter(a => a.status === 'expired').length,
        database: this.dbPath
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        totalItems: 0,
        lowStockItems: 0,
        expiringItems: 0,
        expiredItems: 0,
        database: this.dbPath,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.ensureInitialized();
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
}

export default PantryTrackerSkill;
