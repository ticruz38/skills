/**
 * Data Connector Skill
 * Connect to Google Sheets, Airtable, and CSV for data management
 * Supports read/write operations, caching, and data synchronization
 */

import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Google OAuth skill dependency
let GoogleOAuth: typeof import('@openclaw/google-oauth') | null = null;

/**
 * Data source types supported
 */
export type DataSourceType = 'google-sheets' | 'airtable' | 'csv';

/**
 * Column definition for table schema
 */
export interface Column {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  required?: boolean;
  primaryKey?: boolean;
}

/**
 * Row data structure
 */
export interface Row {
  [key: string]: any;
}

/**
 * Google Sheets connection config
 */
export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName?: string;
  range?: string;
  hasHeaderRow?: boolean;
}

/**
 * Airtable connection config
 */
export interface AirtableConfig {
  apiKey?: string;
  baseId: string;
  tableName: string;
}

/**
 * CSV file config
 */
export interface CSVConfig {
  filePath: string;
  delimiter?: string;
  hasHeaderRow?: boolean;
  encoding?: BufferEncoding;
}

/**
 * Connection metadata
 */
export interface Connection {
  id?: number;
  name: string;
  type: DataSourceType;
  config: GoogleSheetsConfig | AirtableConfig | CSVConfig;
  lastSyncedAt?: string;
  createdAt?: string;
}

/**
 * Connection database record
 */
interface ConnectionRecord {
  id?: number;
  name: string;
  type: DataSourceType;
  config: string;
  last_synced_at?: string;
  created_at?: string;
}

/**
 * Cache entry for data storage
 */
export interface CacheEntry {
  id?: number;
  connectionId: number;
  data: Row[];
  cachedAt: string;
}

/**
 * Cache record from database
 */
interface CacheRecord {
  id?: number;
  connection_id: number;
  data: string;
  cached_at: string;
}

/**
 * Import/Export options
 */
export interface ImportOptions {
  skipEmptyRows?: boolean;
  trimValues?: boolean;
  typeConversion?: boolean;
}

export interface ExportOptions {
  includeHeaders?: boolean;
  dateFormat?: string;
}

/**
 * Helper to run SQL and get lastID
 */
function runWithResult(
  db: sqlite3.Database,
  sql: string,
  params: any[] = []
): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Data Connector Skill
 */
export class DataConnectorSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;
  private airtableConfig?: { apiKey: string };

  constructor() {
    const storageDir = path.join(os.homedir(), '.openclaw', 'skills', 'data-connector');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.dbPath = path.join(storageDir, 'data.db');
    
    // Load Airtable API key from environment if available
    if (process.env.AIRTABLE_API_KEY) {
      this.airtableConfig = { apiKey: process.env.AIRTABLE_API_KEY };
    }
  }

  /**
   * Initialize database
   */
  private async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        this.createTables().then(resolve).catch(reject);
      });
    });
    
    return this.initPromise;
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = [
      `CREATE TABLE IF NOT EXISTS connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        config TEXT NOT NULL,
        last_synced_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS data_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connection_id INTEGER NOT NULL,
        data TEXT NOT NULL,
        cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cache_connection ON data_cache(connection_id)`
    ];

    for (const sql of tables) {
      await new Promise<void>((resolve, reject) => {
        this.db!.run(sql, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  /**
   * Load Google OAuth module dynamically
   */
  private async loadGoogleOAuth(): Promise<typeof import('@openclaw/google-oauth')> {
    if (!GoogleOAuth) {
      GoogleOAuth = await import('@openclaw/google-oauth');
    }
    return GoogleOAuth;
  }

  // ==================== Connection Management ====================

  /**
   * Create a new connection
   */
  async createConnection(
    name: string,
    type: DataSourceType,
    config: GoogleSheetsConfig | AirtableConfig | CSVConfig
  ): Promise<Connection> {
    await this.init();
    
    const configJson = JSON.stringify(config);
    const result = await runWithResult(
      this.db!,
      `INSERT INTO connections (name, type, config) VALUES (?, ?, ?)`,
      [name, type, configJson]
    );

    return {
      id: result.lastID,
      name,
      type,
      config
    };
  }

  /**
   * Get a connection by ID
   */
  async getConnection(id: number): Promise<Connection | null> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.get<ConnectionRecord>(
        `SELECT * FROM connections WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          if (!row) {
            resolve(null);
            return;
          }
          resolve({
            id: row.id,
            name: row.name,
            type: row.type as DataSourceType,
            config: JSON.parse(row.config),
            lastSyncedAt: row.last_synced_at,
            createdAt: row.created_at
          });
        }
      );
    });
  }

  /**
   * Get a connection by name
   */
  async getConnectionByName(name: string): Promise<Connection | null> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.get<ConnectionRecord>(
        `SELECT * FROM connections WHERE name = ?`,
        [name],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          if (!row) {
            resolve(null);
            return;
          }
          resolve({
            id: row.id,
            name: row.name,
            type: row.type as DataSourceType,
            config: JSON.parse(row.config),
            lastSyncedAt: row.last_synced_at,
            createdAt: row.created_at
          });
        }
      );
    });
  }

  /**
   * List all connections
   */
  async listConnections(): Promise<Connection[]> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.all<ConnectionRecord>(
        `SELECT * FROM connections ORDER BY created_at DESC`,
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map(row => ({
            id: row.id,
            name: row.name,
            type: row.type as DataSourceType,
            config: JSON.parse(row.config),
            lastSyncedAt: row.last_synced_at,
            createdAt: row.created_at
          })));
        }
      );
    });
  }

  /**
   * Update a connection
   */
  async updateConnection(
    id: number,
    updates: Partial<Omit<Connection, 'id' | 'createdAt'>>
  ): Promise<boolean> {
    await this.init();
    
    const sets: string[] = [];
    const values: any[] = [];
    
    if (updates.name) {
      sets.push('name = ?');
      values.push(updates.name);
    }
    if (updates.type) {
      sets.push('type = ?');
      values.push(updates.type);
    }
    if (updates.config) {
      sets.push('config = ?');
      values.push(JSON.stringify(updates.config));
    }
    
    if (sets.length === 0) return false;
    
    values.push(id);
    
    const result = await runWithResult(
      this.db!,
      `UPDATE connections SET ${sets.join(', ')} WHERE id = ?`,
      values
    );
    
    return result.changes > 0;
  }

  /**
   * Delete a connection
   */
  async deleteConnection(id: number): Promise<boolean> {
    await this.init();
    
    const result = await runWithResult(
      this.db!,
      `DELETE FROM connections WHERE id = ?`,
      [id]
    );
    
    return result.changes > 0;
  }

  // ==================== Google Sheets ====================

  /**
   * Read data from Google Sheets
   */
  async readGoogleSheets(config: GoogleSheetsConfig): Promise<Row[]> {
    const google = await this.loadGoogleOAuth();
    const auth = new google.GoogleOAuthClient();
    
    if (!(await auth.isConnected())) {
      throw new Error('Google OAuth not connected. Run: google-oauth connect sheets');
    }
    
    const token = await auth.getAccessToken();
    if (!token) {
      throw new Error('Failed to get access token');
    }
    
    const sheetName = config.sheetName || 'Sheet1';
    const range = config.range || `${sheetName}!A1:Z1000`;
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Sheets API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json() as { values?: string[][] };
    
    if (!data.values || data.values.length === 0) {
      return [];
    }
    
    const hasHeader = config.hasHeaderRow !== false;
    const rows = data.values;
    
    if (!hasHeader) {
      return rows.map((row, index) => ({
        _rowIndex: index + 1,
        ...row.reduce((obj, val, i) => ({ ...obj, [`col${i + 1}`]: val }), {})
      }));
    }
    
    const headers = rows[0];
    return rows.slice(1).map((row, index) => {
      const obj: Row = { _rowIndex: index + 2 };
      headers.forEach((header, i) => {
        obj[header] = row[i] || '';
      });
      return obj;
    });
  }

  /**
   * Write data to Google Sheets
   */
  async writeGoogleSheets(config: GoogleSheetsConfig, data: Row[]): Promise<void> {
    const google = await this.loadGoogleOAuth();
    const auth = new google.GoogleOAuthClient();
    
    if (!(await auth.isConnected())) {
      throw new Error('Google OAuth not connected. Run: google-oauth connect sheets');
    }
    
    const token = await auth.getAccessToken();
    if (!token) {
      throw new Error('Failed to get access token');
    }
    
    if (data.length === 0) {
      throw new Error('No data to write');
    }
    
    // Extract headers from first row (excluding internal _rowIndex)
    const firstRow = data[0];
    const headers = Object.keys(firstRow).filter(k => !k.startsWith('_'));
    
    // Convert data to array format
    const values = data.map(row => headers.map(h => String(row[h] || '')));
    values.unshift(headers); // Add header row
    
    const sheetName = config.sheetName || 'Sheet1';
    const range = `${sheetName}!A1`;
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Sheets API error: ${response.status} - ${error}`);
    }
  }

  /**
   * Append data to Google Sheets
   */
  async appendGoogleSheets(config: GoogleSheetsConfig, data: Row[]): Promise<void> {
    const google = await this.loadGoogleOAuth();
    const auth = new google.GoogleOAuthClient();
    
    if (!(await auth.isConnected())) {
      throw new Error('Google OAuth not connected. Run: google-oauth connect sheets');
    }
    
    const token = await auth.getAccessToken();
    if (!token) {
      throw new Error('Failed to get access token');
    }
    
    if (data.length === 0) {
      return;
    }
    
    // Extract headers from first row
    const firstRow = data[0];
    const headers = Object.keys(firstRow).filter(k => !k.startsWith('_'));
    
    // Convert data to array format (no headers when appending)
    const values = data.map(row => headers.map(h => String(row[h] || '')));
    
    const sheetName = config.sheetName || 'Sheet1';
    const range = `${sheetName}!A1`;
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Sheets API error: ${response.status} - ${error}`);
    }
  }

  // ==================== Airtable ====================

  /**
   * Get Airtable API key
   */
  private getAirtableApiKey(config?: AirtableConfig): string {
    const apiKey = config?.apiKey || this.airtableConfig?.apiKey || process.env.AIRTABLE_API_KEY;
    if (!apiKey) {
      throw new Error('Airtable API key not configured. Set AIRTABLE_API_KEY environment variable.');
    }
    return apiKey;
  }

  /**
   * Read data from Airtable
   */
  async readAirtable(config: AirtableConfig): Promise<Row[]> {
    const apiKey = this.getAirtableApiKey(config);
    const records: Row[] = [];
    let offset: string | null = null;
    
    do {
      const url = new URL(`https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(config.tableName)}`);
      if (offset) {
        url.searchParams.set('offset', offset);
      }
      url.searchParams.set('pageSize', '100');
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Airtable API error: ${response.status} - ${error}`);
      }
      
      const data = await response.json() as {
        records: Array<{ id: string; fields: Record<string, any>; createdTime: string }>;
        offset?: string;
      };
      
      records.push(...data.records.map(r => ({
        _airtableId: r.id,
        _createdTime: r.createdTime,
        ...r.fields
      })));
      
      offset = data.offset || null;
    } while (offset);
    
    return records;
  }

  /**
   * Write data to Airtable (creates new records)
   */
  async writeAirtable(config: AirtableConfig, data: Row[]): Promise<void> {
    const apiKey = this.getAirtableApiKey(config);
    
    // Airtable only allows 10 records per request
    const batchSize = 10;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const records = batch.map(row => {
        // Remove internal fields
        const { _airtableId, _createdTime, ...fields } = row;
        return { fields };
      });
      
      const response = await fetch(
        `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(config.tableName)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ records })
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Airtable API error: ${response.status} - ${error}`);
      }
    }
  }

  /**
   * Update records in Airtable
   */
  async updateAirtable(config: AirtableConfig, data: Row[]): Promise<void> {
    const apiKey = this.getAirtableApiKey(config);
    
    // Filter to only records with airtable ID
    const recordsWithId = data.filter(row => row._airtableId);
    
    if (recordsWithId.length === 0) {
      throw new Error('No records with _airtableId field to update');
    }
    
    const batchSize = 10;
    
    for (let i = 0; i < recordsWithId.length; i += batchSize) {
      const batch = recordsWithId.slice(i, i + batchSize);
      const records = batch.map(row => {
        const { _airtableId, _createdTime, ...fields } = row;
        return { id: _airtableId, fields };
      });
      
      const response = await fetch(
        `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(config.tableName)}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ records })
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Airtable API error: ${response.status} - ${error}`);
      }
    }
  }

  // ==================== CSV ====================

  /**
   * Read CSV file
   */
  readCSV(config: CSVConfig, options: ImportOptions = {}): Row[] {
    const content = fs.readFileSync(config.filePath, config.encoding || 'utf-8');
    const lines = content.split('\n');
    
    const delimiter = config.delimiter || ',';
    const hasHeader = config.hasHeaderRow !== false;
    const skipEmpty = options.skipEmptyRows !== false;
    const trim = options.trimValues !== false;
    
    const rows: Row[] = [];
    let headers: string[] = [];
    
    let startIndex = 0;
    if (hasHeader && lines.length > 0) {
      headers = this.parseCSVLine(lines[0], delimiter).map(h => trim ? h.trim() : h);
      startIndex = 1;
    }
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() && skipEmpty) continue;
      
      const values = this.parseCSVLine(line, delimiter);
      if (values.length === 0 && skipEmpty) continue;
      
      const row: Row = { _rowIndex: i + 1 };
      
      if (hasHeader) {
        headers.forEach((header, index) => {
          let value = values[index] || '';
          if (trim) value = value.trim();
          row[header] = options.typeConversion ? this.convertType(value) : value;
        });
      } else {
        values.forEach((value, index) => {
          if (trim) value = value.trim();
          row[`col${index + 1}`] = options.typeConversion ? this.convertType(value) : value;
        });
      }
      
      rows.push(row);
    }
    
    return rows;
  }

  /**
   * Parse a CSV line handling quoted values
   */
  private parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  /**
   * Convert string value to appropriate type
   */
  private convertType(value: string): any {
    // Boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }
    
    // Date (ISO format)
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    
    return value;
  }

  /**
   * Write CSV file
   */
  writeCSV(config: CSVConfig, data: Row[], options: ExportOptions = {}): void {
    if (data.length === 0) {
      fs.writeFileSync(config.filePath, '');
      return;
    }
    
    const delimiter = config.delimiter || ',';
    const includeHeaders = options.includeHeaders !== false;
    
    // Get all unique keys excluding internal ones
    const allKeys = new Set<string>();
    data.forEach(row => {
      Object.keys(row).forEach(k => {
        if (!k.startsWith('_')) allKeys.add(k);
      });
    });
    const headers = Array.from(allKeys);
    
    const lines: string[] = [];
    
    if (includeHeaders) {
      lines.push(headers.map(h => this.escapeCSV(h, delimiter)).join(delimiter));
    }
    
    data.forEach(row => {
      const values = headers.map(h => {
        const value = row[h];
        if (value === null || value === undefined) return '';
        
        let strValue = String(value);
        if (options.dateFormat && value instanceof Date) {
          strValue = value.toISOString().split('T')[0];
        }
        
        return this.escapeCSV(strValue, delimiter);
      });
      lines.push(values.join(delimiter));
    });
    
    fs.writeFileSync(config.filePath, lines.join('\n'), config.encoding || 'utf-8');
  }

  /**
   * Escape CSV value
   */
  private escapeCSV(value: string, delimiter: string): string {
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  // ==================== Data Operations ====================

  /**
   * Read data from any source
   */
  async readFromSource(connection: Connection): Promise<Row[]> {
    switch (connection.type) {
      case 'google-sheets':
        return this.readGoogleSheets(connection.config as GoogleSheetsConfig);
      case 'airtable':
        return this.readAirtable(connection.config as AirtableConfig);
      case 'csv':
        return this.readCSV(connection.config as CSVConfig);
      default:
        throw new Error(`Unknown source type: ${connection.type}`);
    }
  }

  /**
   * Write data to any source
   */
  async writeToSource(connection: Connection, data: Row[]): Promise<void> {
    switch (connection.type) {
      case 'google-sheets':
        return this.writeGoogleSheets(connection.config as GoogleSheetsConfig, data);
      case 'airtable':
        return this.writeAirtable(connection.config as AirtableConfig, data);
      case 'csv':
        this.writeCSV(connection.config as CSVConfig, data);
        return;
      default:
        throw new Error(`Unknown source type: ${connection.type}`);
    }
  }

  /**
   * Cache data locally
   */
  async cacheData(connectionId: number, data: Row[]): Promise<void> {
    await this.init();
    
    // Clear old cache
    await runWithResult(
      this.db!,
      `DELETE FROM data_cache WHERE connection_id = ?`,
      [connectionId]
    );
    
    // Insert new cache
    await runWithResult(
      this.db!,
      `INSERT INTO data_cache (connection_id, data) VALUES (?, ?)`,
      [connectionId, JSON.stringify(data)]
    );
    
    // Update last synced
    await runWithResult(
      this.db!,
      `UPDATE connections SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [connectionId]
    );
  }

  /**
   * Get cached data
   */
  async getCachedData(connectionId: number): Promise<Row[] | null> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.get<CacheRecord>(
        `SELECT * FROM data_cache WHERE connection_id = ?`,
        [connectionId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          if (!row) {
            resolve(null);
            return;
          }
          resolve(JSON.parse(row.data));
        }
      );
    });
  }

  /**
   * Sync connection (read and cache)
   */
  async syncConnection(connectionId: number): Promise<Row[]> {
    const connection = await this.getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }
    
    const data = await this.readFromSource(connection);
    await this.cacheData(connectionId, data);
    
    return data;
  }

  /**
   * Get sync statistics
   */
  async getStats(): Promise<{ connections: number; cachedConnections: number }> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.get<{ connections: number; cached: number }>(
        `SELECT 
          (SELECT COUNT(*) FROM connections) as connections,
          (SELECT COUNT(DISTINCT connection_id) FROM data_cache) as cached`,
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            connections: row?.connections || 0,
            cachedConnections: row?.cached || 0
          });
        }
      );
    });
  }

  /**
   * Clear cache for a connection
   */
  async clearCache(connectionId?: number): Promise<number> {
    await this.init();
    
    if (connectionId) {
      const result = await runWithResult(
        this.db!,
        `DELETE FROM data_cache WHERE connection_id = ?`,
        [connectionId]
      );
      return result.changes;
    } else {
      const result = await runWithResult(
        this.db!,
        `DELETE FROM data_cache`,
        []
      );
      return result.changes;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string; details?: any }> {
    const checks: any = {
      database: false,
      googleOAuth: false,
      airtable: false
    };
    
    try {
      await this.init();
      checks.database = true;
    } catch (e) {
      return { healthy: false, message: 'Database initialization failed', details: checks };
    }
    
    try {
      const google = await this.loadGoogleOAuth();
      const auth = new google.GoogleOAuthClient();
      checks.googleOAuth = await auth.isConnected();
    } catch (e) {
      checks.googleOAuth = false;
    }
    
    checks.airtable = !!this.airtableConfig?.apiKey || !!process.env.AIRTABLE_API_KEY;
    
    const healthy = checks.database;
    const messages: string[] = [];
    
    if (checks.googleOAuth) messages.push('Google OAuth connected');
    else messages.push('Google OAuth not connected');
    
    if (checks.airtable) messages.push('Airtable configured');
    else messages.push('Airtable not configured');
    
    return {
      healthy,
      message: messages.join('; '),
      details: checks
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.db = null;
      this.initPromise = null;
    }
  }
}

// Export for use
export default DataConnectorSkill;
