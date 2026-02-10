/**
 * Client CRM Skill
 * Real estate client relationship management with contact profiles, 
 * property preferences, communication history, and pipeline tracking
 */

import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Client type classification
 */
export type ClientType = 'buyer' | 'seller' | 'renter' | 'investor' | 'vendor' | 'other';

/**
 * Pipeline stage for tracking client progress
 */
export type PipelineStage = 'lead' | 'qualified' | 'viewing' | 'offer' | 'under_contract' | 'closed' | 'archived';

/**
 * Urgency level for prioritizing clients
 */
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Status of the client relationship
 */
export type ClientStatus = 'active' | 'inactive' | 'on_hold' | 'closed';

/**
 * Communication type
 */
export type CommunicationType = 'call' | 'email' | 'meeting' | 'showing' | 'text' | 'note' | 'other';

/**
 * Client record
 */
export interface Client {
  id?: number;
  name: string;
  email?: string;
  phone?: string;
  phone2?: string;
  address?: string;
  type: ClientType;
  status: ClientStatus;
  pipelineStage: PipelineStage;
  urgency: UrgencyLevel;
  source?: string;
  budgetMin?: number;
  budgetMax?: number;
  timeline?: string;
  agentId?: string;
  notes?: string;
  followUpDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Client database record (snake_case)
 */
interface ClientRecord {
  id?: number;
  name: string;
  email?: string;
  phone?: string;
  phone2?: string;
  address?: string;
  type: string;
  status: string;
  pipeline_stage: string;
  urgency: string;
  source?: string;
  budget_min?: number;
  budget_max?: number;
  timeline?: string;
  agent_id?: string;
  notes?: string;
  follow_up_date?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Property preferences for a client
 */
export interface PropertyPreferences {
  id?: number;
  clientId: number;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  minSqft?: number;
  maxSqft?: number;
  locations: string[];
  propertyTypes: string[];
  mustHaveFeatures: string[];
  niceToHaveFeatures: string[];
  updatedAt: string;
}

/**
 * Property preferences database record (snake_case)
 */
interface PreferencesRecord {
  id?: number;
  client_id: number;
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number;
  max_bedrooms?: number;
  min_bathrooms?: number;
  max_bathrooms?: number;
  min_sqft?: number;
  max_sqft?: number;
  locations: string;
  property_types: string;
  must_have_features: string;
  nice_to_have_features: string;
  updated_at: string;
}

/**
 * Communication log entry
 */
export interface CommunicationLog {
  id?: number;
  clientId: number;
  type: CommunicationType;
  content: string;
  propertyId?: string;
  createdAt: string;
}

/**
 * Communication log database record (snake_case)
 */
interface CommunicationRecord {
  id?: number;
  client_id: number;
  type: string;
  content: string;
  property_id?: string;
  created_at: string;
}

/**
 * Pipeline statistics
 */
export interface PipelineStats {
  stage: PipelineStage;
  count: number;
  totalValue: number;
}

/**
 * Client statistics
 */
export interface ClientStatistics {
  totalClients: number;
  byType: Record<ClientType, number>;
  byStage: Record<PipelineStage, number>;
  byStatus: Record<ClientStatus, number>;
  activeBuyers: number;
  activeSellers: number;
  urgentFollowUps: number;
  totalPipelineValue: number;
}

/**
 * Search filters for clients
 */
export interface ClientSearchFilters {
  type?: ClientType;
  status?: ClientStatus;
  stage?: PipelineStage;
  urgency?: UrgencyLevel;
  source?: string;
  minBudget?: number;
  maxBudget?: number;
  hasFollowUp?: boolean;
  searchText?: string;
}

/**
 * Client CRM configuration
 */
export interface ClientCRMConfig {
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
 * Client CRM Skill - Real estate client relationship management
 */
export class ClientCRMSkill {
  private dataDir: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: ClientCRMConfig = {}) {
    this.dataDir = config.dataDir || path.join(os.homedir(), '.openclaw', 'skills', 'client-crm');
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

    const dbPath = path.join(this.dataDir, 'client-crm.db');
    
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

    // Clients table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        phone2 TEXT,
        address TEXT,
        type TEXT NOT NULL DEFAULT 'buyer',
        status TEXT NOT NULL DEFAULT 'active',
        pipeline_stage TEXT NOT NULL DEFAULT 'lead',
        urgency TEXT NOT NULL DEFAULT 'medium',
        source TEXT,
        budget_min REAL,
        budget_max REAL,
        timeline TEXT,
        agent_id TEXT,
        notes TEXT,
        follow_up_date TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Property preferences table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL UNIQUE,
        min_price REAL,
        max_price REAL,
        min_bedrooms INTEGER,
        max_bedrooms INTEGER,
        min_bathrooms REAL,
        max_bathrooms REAL,
        min_sqft INTEGER,
        max_sqft INTEGER,
        locations TEXT DEFAULT '[]',
        property_types TEXT DEFAULT '[]',
        must_have_features TEXT DEFAULT '[]',
        nice_to_have_features TEXT DEFAULT '[]',
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      )
    `);

    // Communication log table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS communications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        property_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_clients_stage ON clients(pipeline_stage)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_clients_urgency ON clients(urgency)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_clients_source ON clients(source)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_clients_follow_up ON clients(follow_up_date)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_comm_client ON communications(client_id)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_comm_date ON communications(created_at)`);
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
   * Convert database record to Client interface
   */
  private recordToClient(record: ClientRecord): Client {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      phone: record.phone,
      phone2: record.phone2,
      address: record.address,
      type: record.type as ClientType,
      status: record.status as ClientStatus,
      pipelineStage: record.pipeline_stage as PipelineStage,
      urgency: record.urgency as UrgencyLevel,
      source: record.source,
      budgetMin: record.budget_min,
      budgetMax: record.budget_max,
      timeline: record.timeline,
      agentId: record.agent_id,
      notes: record.notes,
      followUpDate: record.follow_up_date,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  /**
   * Convert database record to PropertyPreferences interface
   */
  private recordToPreferences(record: PreferencesRecord): PropertyPreferences {
    return {
      id: record.id,
      clientId: record.client_id,
      minPrice: record.min_price,
      maxPrice: record.max_price,
      minBedrooms: record.min_bedrooms,
      maxBedrooms: record.max_bedrooms,
      minBathrooms: record.min_bathrooms,
      maxBathrooms: record.max_bathrooms,
      minSqft: record.min_sqft,
      maxSqft: record.max_sqft,
      locations: JSON.parse(record.locations),
      propertyTypes: JSON.parse(record.property_types),
      mustHaveFeatures: JSON.parse(record.must_have_features),
      niceToHaveFeatures: JSON.parse(record.nice_to_have_features),
      updatedAt: record.updated_at,
    };
  }

  /**
   * Convert database record to CommunicationLog interface
   */
  private recordToCommunication(record: CommunicationRecord): CommunicationLog {
    return {
      id: record.id,
      clientId: record.client_id,
      type: record.type as CommunicationType,
      content: record.content,
      propertyId: record.property_id,
      createdAt: record.created_at,
    };
  }

  /**
   * Add a new client
   */
  async addClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    
    const result = await runWithResult(this.db, `
      INSERT INTO clients 
      (name, email, phone, phone2, address, type, status, pipeline_stage, urgency, 
       source, budget_min, budget_max, timeline, agent_id, notes, follow_up_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      client.name,
      client.email || null,
      client.phone || null,
      client.phone2 || null,
      client.address || null,
      client.type || 'buyer',
      client.status || 'active',
      client.pipelineStage || 'lead',
      client.urgency || 'medium',
      client.source || null,
      client.budgetMin || null,
      client.budgetMax || null,
      client.timeline || null,
      client.agentId || null,
      client.notes || null,
      client.followUpDate || null,
      now,
      now,
    ]);

    const record = await get<ClientRecord>(this.db, 
      'SELECT * FROM clients WHERE id = ?', 
      [result.lastID]
    );

    if (!record) throw new Error('Failed to create client');
    return this.recordToClient(record);
  }

  /**
   * Get a client by ID
   */
  async getClient(id: number): Promise<Client | null> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<ClientRecord>(this.db, 
      'SELECT * FROM clients WHERE id = ?', 
      [id]
    );

    return record ? this.recordToClient(record) : null;
  }

  /**
   * Update a client
   */
  async updateClient(id: number, updates: Partial<Omit<Client, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Client | null> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
    if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }
    if (updates.phone2 !== undefined) { fields.push('phone2 = ?'); values.push(updates.phone2); }
    if (updates.address !== undefined) { fields.push('address = ?'); values.push(updates.address); }
    if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.pipelineStage !== undefined) { fields.push('pipeline_stage = ?'); values.push(updates.pipelineStage); }
    if (updates.urgency !== undefined) { fields.push('urgency = ?'); values.push(updates.urgency); }
    if (updates.source !== undefined) { fields.push('source = ?'); values.push(updates.source); }
    if (updates.budgetMin !== undefined) { fields.push('budget_min = ?'); values.push(updates.budgetMin); }
    if (updates.budgetMax !== undefined) { fields.push('budget_max = ?'); values.push(updates.budgetMax); }
    if (updates.timeline !== undefined) { fields.push('timeline = ?'); values.push(updates.timeline); }
    if (updates.agentId !== undefined) { fields.push('agent_id = ?'); values.push(updates.agentId); }
    if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }
    if (updates.followUpDate !== undefined) { fields.push('follow_up_date = ?'); values.push(updates.followUpDate); }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await run(this.db, `UPDATE clients SET ${fields.join(', ')} WHERE id = ?`, values);

    return this.getClient(id);
  }

  /**
   * Delete a client
   */
  async deleteClient(id: number): Promise<boolean> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, 
      'DELETE FROM clients WHERE id = ?', 
      [id]
    );

    return result.changes > 0;
  }

  /**
   * List clients with optional filters
   */
  async listClients(filters?: ClientSearchFilters): Promise<Client[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM clients WHERE 1=1';
    const params: any[] = [];

    if (filters?.type) {
      sql += ' AND type = ?';
      params.push(filters.type);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.stage) {
      sql += ' AND pipeline_stage = ?';
      params.push(filters.stage);
    }
    if (filters?.urgency) {
      sql += ' AND urgency = ?';
      params.push(filters.urgency);
    }
    if (filters?.source) {
      sql += ' AND source = ?';
      params.push(filters.source);
    }
    if (filters?.minBudget !== undefined) {
      sql += ' AND budget_max >= ?';
      params.push(filters.minBudget);
    }
    if (filters?.maxBudget !== undefined) {
      sql += ' AND budget_min <= ?';
      params.push(filters.maxBudget);
    }
    if (filters?.hasFollowUp) {
      sql += ' AND follow_up_date IS NOT NULL';
    }
    if (filters?.searchText) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR notes LIKE ?)';
      const search = `%${filters.searchText}%`;
      params.push(search, search, search, search);
    }

    sql += ' ORDER BY updated_at DESC';

    const records = await all<ClientRecord>(this.db, sql, params);
    return records.map(r => this.recordToClient(r));
  }

  /**
   * Search clients by text
   */
  async searchClients(query: string): Promise<Client[]> {
    return this.listClients({ searchText: query });
  }

  /**
   * Update pipeline stage
   */
  async updatePipelineStage(clientId: number, stage: PipelineStage): Promise<Client | null> {
    return this.updateClient(clientId, { pipelineStage: stage });
  }

  /**
   * Set property preferences for a client
   */
  async setPreferences(clientId: number, prefs: Partial<Omit<PropertyPreferences, 'id' | 'clientId' | 'updatedAt'>>): Promise<PropertyPreferences> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    // Check if preferences exist
    const existing = await get<PreferencesRecord>(this.db, 
      'SELECT id FROM preferences WHERE client_id = ?', 
      [clientId]
    );

    if (existing) {
      // Update
      const fields: string[] = [];
      const values: any[] = [];

      if (prefs.minPrice !== undefined) { fields.push('min_price = ?'); values.push(prefs.minPrice); }
      if (prefs.maxPrice !== undefined) { fields.push('max_price = ?'); values.push(prefs.maxPrice); }
      if (prefs.minBedrooms !== undefined) { fields.push('min_bedrooms = ?'); values.push(prefs.minBedrooms); }
      if (prefs.maxBedrooms !== undefined) { fields.push('max_bedrooms = ?'); values.push(prefs.maxBedrooms); }
      if (prefs.minBathrooms !== undefined) { fields.push('min_bathrooms = ?'); values.push(prefs.minBathrooms); }
      if (prefs.maxBathrooms !== undefined) { fields.push('max_bathrooms = ?'); values.push(prefs.maxBathrooms); }
      if (prefs.minSqft !== undefined) { fields.push('min_sqft = ?'); values.push(prefs.minSqft); }
      if (prefs.maxSqft !== undefined) { fields.push('max_sqft = ?'); values.push(prefs.maxSqft); }
      if (prefs.locations !== undefined) { fields.push('locations = ?'); values.push(JSON.stringify(prefs.locations)); }
      if (prefs.propertyTypes !== undefined) { fields.push('property_types = ?'); values.push(JSON.stringify(prefs.propertyTypes)); }
      if (prefs.mustHaveFeatures !== undefined) { fields.push('must_have_features = ?'); values.push(JSON.stringify(prefs.mustHaveFeatures)); }
      if (prefs.niceToHaveFeatures !== undefined) { fields.push('nice_to_have_features = ?'); values.push(JSON.stringify(prefs.niceToHaveFeatures)); }

      fields.push('updated_at = ?');
      values.push(now);
      values.push(existing.id);

      await run(this.db, `UPDATE preferences SET ${fields.join(', ')} WHERE id = ?`, values);
    } else {
      // Insert
      await runWithResult(this.db, `
        INSERT INTO preferences 
        (client_id, min_price, max_price, min_bedrooms, max_bedrooms, min_bathrooms, max_bathrooms,
         min_sqft, max_sqft, locations, property_types, must_have_features, nice_to_have_features, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        clientId,
        prefs.minPrice || null,
        prefs.maxPrice || null,
        prefs.minBedrooms || null,
        prefs.maxBedrooms || null,
        prefs.minBathrooms || null,
        prefs.maxBathrooms || null,
        prefs.minSqft || null,
        prefs.maxSqft || null,
        JSON.stringify(prefs.locations || []),
        JSON.stringify(prefs.propertyTypes || []),
        JSON.stringify(prefs.mustHaveFeatures || []),
        JSON.stringify(prefs.niceToHaveFeatures || []),
        now,
      ]);
    }

    const record = await get<PreferencesRecord>(this.db, 
      'SELECT * FROM preferences WHERE client_id = ?', 
      [clientId]
    );

    if (!record) throw new Error('Failed to save preferences');
    return this.recordToPreferences(record);
  }

  /**
   * Get property preferences for a client
   */
  async getPreferences(clientId: number): Promise<PropertyPreferences | null> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<PreferencesRecord>(this.db, 
      'SELECT * FROM preferences WHERE client_id = ?', 
      [clientId]
    );

    return record ? this.recordToPreferences(record) : null;
  }

  /**
   * Add a communication log entry
   */
  async addCommunication(clientId: number, entry: Omit<CommunicationLog, 'id' | 'clientId' | 'createdAt'>): Promise<CommunicationLog> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, `
      INSERT INTO communications (client_id, type, content, property_id)
      VALUES (?, ?, ?, ?)
    `, [clientId, entry.type, entry.content, entry.propertyId || null]);

    const record = await get<CommunicationRecord>(this.db,
      'SELECT * FROM communications WHERE id = ?',
      [result.lastID]
    );

    if (!record) throw new Error('Failed to create communication log');
    return this.recordToCommunication(record);
  }

  /**
   * Get communication history for a client
   */
  async getCommunications(clientId: number, limit: number = 50): Promise<CommunicationLog[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<CommunicationRecord>(this.db,
      'SELECT * FROM communications WHERE client_id = ? ORDER BY created_at DESC LIMIT ?',
      [clientId, limit]
    );

    return records.map(r => this.recordToCommunication(r));
  }

  /**
   * Set follow-up date for a client
   */
  async setFollowUp(clientId: number, date: string, notes?: string): Promise<Client | null> {
    const updates: Partial<Client> = { followUpDate: date };
    if (notes) {
      const client = await this.getClient(clientId);
      if (client) {
        updates.notes = client.notes ? `${client.notes}\n\nFollow-up: ${notes}` : `Follow-up: ${notes}`;
      }
    }
    return this.updateClient(clientId, updates);
  }

  /**
   * Get upcoming follow-ups
   */
  async getUpcomingFollowUps(days: number = 7): Promise<Client[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<ClientRecord>(this.db, `
      SELECT * FROM clients 
      WHERE follow_up_date IS NOT NULL 
      AND follow_up_date <= date('now', '+${days} days')
      AND status = 'active'
      ORDER BY follow_up_date ASC
    `);

    return records.map(r => this.recordToClient(r));
  }

  /**
   * Find clients by location preference
   */
  async findByLocation(location: string): Promise<Client[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<ClientRecord>(this.db, `
      SELECT c.* FROM clients c
      JOIN preferences p ON c.id = p.client_id
      WHERE p.locations LIKE ?
      AND c.status = 'active'
    `, [`%${location}%`]);

    return records.map(r => this.recordToClient(r));
  }

  /**
   * Find clients by feature preference
   */
  async findByFeature(feature: string): Promise<Client[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<ClientRecord>(this.db, `
      SELECT c.* FROM clients c
      JOIN preferences p ON c.id = p.client_id
      WHERE (p.must_have_features LIKE ? OR p.nice_to_have_features LIKE ?)
      AND c.status = 'active'
    `, [`%${feature}%`, `%${feature}%`]);

    return records.map(r => this.recordToClient(r));
  }

  /**
   * Get pipeline statistics
   */
  async getPipelineStats(): Promise<PipelineStats[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<{ pipeline_stage: string; count: number; total_budget: number }>(this.db, `
      SELECT pipeline_stage, COUNT(*) as count, 
             SUM(CASE WHEN budget_max IS NOT NULL THEN budget_max ELSE 0 END) as total_budget
      FROM clients
      WHERE status = 'active'
      GROUP BY pipeline_stage
    `);

    return records.map(r => ({
      stage: r.pipeline_stage as PipelineStage,
      count: r.count,
      totalValue: r.total_budget || 0,
    }));
  }

  /**
   * Get overall statistics
   */
  async getStatistics(): Promise<ClientStatistics> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const total = await get<{ count: number }>(this.db, 'SELECT COUNT(*) as count FROM clients');
    
    const byType = await all<{ type: string; count: number }>(this.db, 
      'SELECT type, COUNT(*) as count FROM clients GROUP BY type'
    );
    
    const byStage = await all<{ pipeline_stage: string; count: number }>(this.db, 
      'SELECT pipeline_stage, COUNT(*) as count FROM clients WHERE status = "active" GROUP BY pipeline_stage'
    );
    
    const byStatus = await all<{ status: string; count: number }>(this.db, 
      'SELECT status, COUNT(*) as count FROM clients GROUP BY status'
    );

    const activeBuyers = await get<{ count: number }>(this.db, 
      'SELECT COUNT(*) as count FROM clients WHERE type = "buyer" AND status = "active"'
    );

    const activeSellers = await get<{ count: number }>(this.db, 
      'SELECT COUNT(*) as count FROM clients WHERE type = "seller" AND status = "active"'
    );

    const urgentFollowUps = await get<{ count: number }>(this.db, 
      `SELECT COUNT(*) as count FROM clients 
       WHERE follow_up_date IS NOT NULL 
       AND follow_up_date <= date('now', '+7 days')
       AND status = 'active'`
    );

    const pipelineValue = await get<{ total: number }>(this.db, 
      'SELECT SUM(budget_max) as total FROM clients WHERE status = "active" AND budget_max IS NOT NULL'
    );

    const typeMap: Record<string, number> = {};
    byType.forEach(t => typeMap[t.type] = t.count);

    const stageMap: Record<string, number> = {};
    byStage.forEach(s => stageMap[s.pipeline_stage] = s.count);

    const statusMap: Record<string, number> = {};
    byStatus.forEach(s => statusMap[s.status] = s.count);

    return {
      totalClients: total?.count || 0,
      byType: typeMap as Record<ClientType, number>,
      byStage: stageMap as Record<PipelineStage, number>,
      byStatus: statusMap as Record<ClientStatus, number>,
      activeBuyers: activeBuyers?.count || 0,
      activeSellers: activeSellers?.count || 0,
      urgentFollowUps: urgentFollowUps?.count || 0,
      totalPipelineValue: pipelineValue?.total || 0,
    };
  }

  /**
   * Export clients to CSV
   */
  async exportToCSV(filePath: string): Promise<void> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const clients = await this.listClients();
    
    const headers = [
      'ID', 'Name', 'Email', 'Phone', 'Phone 2', 'Address', 'Type', 'Status',
      'Pipeline Stage', 'Urgency', 'Source', 'Budget Min', 'Budget Max',
      'Timeline', 'Agent ID', 'Notes', 'Follow-up Date', 'Created At', 'Updated At'
    ];

    const rows = clients.map(c => [
      c.id,
      c.name,
      c.email || '',
      c.phone || '',
      c.phone2 || '',
      c.address || '',
      c.type,
      c.status,
      c.pipelineStage,
      c.urgency,
      c.source || '',
      c.budgetMin || '',
      c.budgetMax || '',
      c.timeline || '',
      c.agentId || '',
      (c.notes || '').replace(/\n/g, ' '),
      c.followUpDate || '',
      c.createdAt,
      c.updatedAt,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(field => 
      `"${String(field).replace(/"/g, '""')}"`
    ).join(','))].join('\n');

    fs.writeFileSync(filePath, csv, 'utf-8');
  }

  /**
   * Import clients from CSV
   */
  async importFromCSV(filePath: string): Promise<{ imported: number; errors: number }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    
    // Skip header
    const dataLines = lines.slice(1);
    
    let imported = 0;
    let errors = 0;

    for (const line of dataLines) {
      try {
        // Simple CSV parsing - split by comma, handling quotes
        const fields = this.parseCSVLine(line);
        
        if (fields.length < 2) continue;

        await this.addClient({
          name: fields[1]?.replace(/""/g, '"').replace(/^"|"$/g, '') || 'Unknown',
          email: fields[2]?.replace(/""/g, '"').replace(/^"|"$/g, '') || undefined,
          phone: fields[3]?.replace(/""/g, '"').replace(/^"|"$/g, '') || undefined,
          phone2: fields[4]?.replace(/""/g, '"').replace(/^"|"$/g, '') || undefined,
          address: fields[5]?.replace(/""/g, '"').replace(/^"|"$/g, '') || undefined,
          type: (fields[6] as ClientType) || 'buyer',
          status: (fields[7] as ClientStatus) || 'active',
          pipelineStage: (fields[8] as PipelineStage) || 'lead',
          urgency: (fields[9] as UrgencyLevel) || 'medium',
          source: fields[10]?.replace(/""/g, '"').replace(/^"|"$/g, '') || undefined,
          budgetMin: fields[11] ? parseFloat(fields[11]) : undefined,
          budgetMax: fields[12] ? parseFloat(fields[12]) : undefined,
          timeline: fields[13]?.replace(/""/g, '"').replace(/^"|"$/g, '') || undefined,
          agentId: fields[14]?.replace(/""/g, '"').replace(/^"|"$/g, '') || undefined,
          notes: fields[15]?.replace(/""/g, '"').replace(/^"|"$/g, '') || undefined,
        });
        
        imported++;
      } catch (e) {
        errors++;
      }
    }

    return { imported, errors };
  }

  /**
   * Parse a CSV line, handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    fields.push(current);
    return fields;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      await this.ensureDatabase();
      if (!this.db) {
        return { status: 'unhealthy', message: 'Database not initialized' };
      }

      await get(this.db, 'SELECT 1');

      const stats = await this.getStatistics();

      return {
        status: 'healthy',
        message: `Client CRM is ready (${stats.totalClients} clients)`,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (e) {
        // Ignore init errors
      }
    }

    if (this.db) {
      await new Promise<void>((resolve) => {
        this.db!.close(() => resolve());
      });
      this.db = null;
    }
  }
}

/**
 * Factory function
 */
export function getClientCRMSkill(config?: ClientCRMConfig): ClientCRMSkill {
  return new ClientCRMSkill(config);
}

export default ClientCRMSkill;
