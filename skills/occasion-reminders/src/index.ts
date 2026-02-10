/**
 * Occasion Reminders Skill
 * Track birthdays and anniversaries with gift planning timeline
 * Depends on reminders skill for notification scheduling
 */

import * as sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { RemindersSkill } from '@openclaw/reminders';

/**
 * Occasion type
 */
export type OccasionType = 'birthday' | 'anniversary' | 'holiday' | 'custom';

/**
 * Advance notice configuration
 */
export interface AdvanceNotice {
  weeks: number;
  days: number;
}

/**
 * Contact interface
 */
export interface Contact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  relationship?: string;
  createdAt: string;
}

/**
 * Contact record from database (snake_case)
 */
interface ContactRecord {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  relationship?: string;
  created_at: string;
}

/**
 * Occasion interface
 */
export interface Occasion {
  id: number;
  contactId: number;
  type: OccasionType;
  name: string;
  month: number; // 1-12
  day: number; // 1-31
  year?: number; // Optional birth year for age calculation
  advanceNotice: AdvanceNotice;
  giftIdeas?: string;
  budget?: number;
  reminderId?: number; // Reference to reminders skill
  createdAt: string;
}

/**
 * Occasion record from database (snake_case)
 */
interface OccasionRecord {
  id: number;
  contact_id: number;
  type: OccasionType;
  name: string;
  month: number;
  day: number;
  year?: number;
  advance_weeks: number;
  advance_days: number;
  gift_ideas?: string;
  budget?: number;
  reminder_id?: number;
  created_at: string;
}

/**
 * Upcoming occasion with calculated dates
 */
export interface UpcomingOccasion extends Occasion {
  contactName: string;
  nextDate: Date;
  age?: number; // For birthdays
  yearsTogether?: number; // For anniversaries
  daysUntil: number;
  isAdvanceNotice: boolean;
}

/**
 * Gift planning timeline item
 */
export interface GiftPlanningItem {
  occasion: UpcomingOccasion;
  suggestedActions: string[];
  timeline: {
    startShopping: Date;
    orderBy: Date;
    wrapBy: Date;
    giveOn: Date;
  };
}

/**
 * Create contact options
 */
export interface CreateContactOptions {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  relationship?: string;
}

/**
 * Create occasion options
 */
export interface CreateOccasionOptions {
  contactId: number;
  type: OccasionType;
  name: string;
  month: number;
  day: number;
  year?: number;
  advanceNotice?: AdvanceNotice;
  giftIdeas?: string;
  budget?: number;
}

/**
 * Import contact options
 */
export interface ImportContactOptions {
  format: 'csv' | 'json' | 'vcard';
  data: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  contacts: number;
  occasions: number;
  upcoming: number;
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
 * Occasion Reminders Skill - Track birthdays and anniversaries
 */
export class OccasionRemindersSkill {
  private dbPath: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;
  private remindersSkill: RemindersSkill;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(os.homedir(), '.openclaw', 'skills', 'occasion-reminders', 'occasions.db');
    this.remindersSkill = new RemindersSkill();
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

    // Create contacts table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        notes TEXT,
        relationship TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create occasions table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS occasions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        month INTEGER NOT NULL,
        day INTEGER NOT NULL,
        year INTEGER,
        advance_weeks INTEGER DEFAULT 2,
        advance_days INTEGER DEFAULT 0,
        gift_ideas TEXT,
        budget REAL,
        reminder_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_occasions_contact ON occasions(contact_id)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_occasions_date ON occasions(month, day)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name)`);
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
   * Add a new contact
   */
  async addContact(options: CreateContactOptions): Promise<Contact> {
    await this.ensureInitialized();

    const result = await runWithResult(this.db!,
      `INSERT INTO contacts (name, email, phone, notes, relationship) VALUES (?, ?, ?, ?, ?)`,
      [options.name, options.email || null, options.phone || null, options.notes || null, options.relationship || null]
    );

    return {
      id: result.lastID,
      name: options.name,
      email: options.email,
      phone: options.phone,
      notes: options.notes,
      relationship: options.relationship,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get a contact by ID
   */
  async getContact(id: number): Promise<Contact | undefined> {
    await this.ensureInitialized();

    const record = await get<ContactRecord>(this.db!, `
      SELECT id, name, email, phone, notes, relationship, created_at as created_at
      FROM contacts WHERE id = ?
    `, [id]);

    if (!record) return undefined;

    return {
      id: record.id,
      name: record.name,
      email: record.email,
      phone: record.phone,
      notes: record.notes,
      relationship: record.relationship,
      createdAt: record.created_at,
    };
  }

  /**
   * List all contacts
   */
  async listContacts(): Promise<Contact[]> {
    await this.ensureInitialized();

    const records = await all<ContactRecord>(this.db!, `
      SELECT id, name, email, phone, notes, relationship, created_at as created_at
      FROM contacts
      ORDER BY name ASC
    `);

    return records.map(record => ({
      id: record.id,
      name: record.name,
      email: record.email,
      phone: record.phone,
      notes: record.notes,
      relationship: record.relationship,
      createdAt: record.created_at,
    }));
  }

  /**
   * Update a contact
   */
  async updateContact(id: number, updates: Partial<CreateContactOptions>): Promise<Contact | undefined> {
    await this.ensureInitialized();

    const sets: string[] = [];
    const params: any[] = [];

    if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name); }
    if (updates.email !== undefined) { sets.push('email = ?'); params.push(updates.email); }
    if (updates.phone !== undefined) { sets.push('phone = ?'); params.push(updates.phone); }
    if (updates.notes !== undefined) { sets.push('notes = ?'); params.push(updates.notes); }
    if (updates.relationship !== undefined) { sets.push('relationship = ?'); params.push(updates.relationship); }

    if (sets.length === 0) {
      return this.getContact(id);
    }

    params.push(id);
    await run(this.db!, `UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`, params);

    return this.getContact(id);
  }

  /**
   * Delete a contact (cascades to occasions)
   */
  async deleteContact(id: number): Promise<boolean> {
    await this.ensureInitialized();

    // Delete associated reminders first
    const occasions = await this.getContactOccasions(id);
    for (const occasion of occasions) {
      if (occasion.reminderId) {
        await this.remindersSkill.deleteReminder(occasion.reminderId);
      }
    }

    const result = await runWithResult(this.db!, `DELETE FROM contacts WHERE id = ?`, [id]);
    return result.changes > 0;
  }

  /**
   * Import contacts from various formats
   */
  async importContacts(options: ImportContactOptions): Promise<{ imported: number; errors: string[] }> {
    await this.ensureInitialized();
    const errors: string[] = [];
    let imported = 0;

    try {
      if (options.format === 'json') {
        const contacts = JSON.parse(options.data);
        if (Array.isArray(contacts)) {
          for (const contact of contacts) {
            try {
              await this.addContact({
                name: contact.name,
                email: contact.email,
                phone: contact.phone,
                notes: contact.notes,
                relationship: contact.relationship,
              });
              imported++;
            } catch (e) {
              errors.push(`Failed to import ${contact.name}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }
      } else if (options.format === 'csv') {
        // Simple CSV parsing (name,email,phone,relationship,notes)
        const lines = options.data.split('\n').filter(line => line.trim());
        for (const line of lines) {
          const parts = line.split(',').map(p => p.trim());
          try {
            await this.addContact({
              name: parts[0],
              email: parts[1] || undefined,
              phone: parts[2] || undefined,
              relationship: parts[3] || undefined,
              notes: parts[4] || undefined,
            });
            imported++;
          } catch (e) {
            errors.push(`Failed to import ${parts[0]}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      } else {
        errors.push(`Format ${options.format} not yet implemented`);
      }
    } catch (e) {
      errors.push(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    return { imported, errors };
  }

  /**
   * Add an occasion for a contact
   */
  async addOccasion(options: CreateOccasionOptions): Promise<Occasion> {
    await this.ensureInitialized();

    // Validate contact exists
    const contact = await this.getContact(options.contactId);
    if (!contact) {
      throw new Error(`Contact ${options.contactId} not found`);
    }

    const advanceNotice = options.advanceNotice || { weeks: 2, days: 0 };

    // Calculate next occurrence for reminder
    const nextDate = this.calculateNextOccurrence(options.month, options.day);
    const reminderDate = new Date(nextDate);
    reminderDate.setDate(reminderDate.getDate() - (advanceNotice.weeks * 7 + advanceNotice.days));

    // Create reminder in reminders skill
    let reminderId: number | undefined;
    try {
      const reminder = await this.remindersSkill.addReminder({
        message: `${options.name} for ${contact.name} is on ${options.month}/${options.day}`,
        scheduledAt: reminderDate,
      });
      reminderId = reminder.id;
    } catch (e) {
      // Continue without reminder if it fails
      console.warn('Failed to create reminder:', e instanceof Error ? e.message : String(e));
    }

    const result = await runWithResult(this.db!,
      `INSERT INTO occasions (contact_id, type, name, month, day, year, advance_weeks, advance_days, gift_ideas, budget, reminder_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        options.contactId,
        options.type,
        options.name,
        options.month,
        options.day,
        options.year || null,
        advanceNotice.weeks,
        advanceNotice.days,
        options.giftIdeas || null,
        options.budget || null,
        reminderId || null,
      ]
    );

    return {
      id: result.lastID,
      contactId: options.contactId,
      type: options.type,
      name: options.name,
      month: options.month,
      day: options.day,
      year: options.year,
      advanceNotice,
      giftIdeas: options.giftIdeas,
      budget: options.budget,
      reminderId,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get an occasion by ID
   */
  async getOccasion(id: number): Promise<Occasion | undefined> {
    await this.ensureInitialized();

    const record = await get<OccasionRecord>(this.db!, `
      SELECT id, contact_id, type, name, month, day, year, advance_weeks, advance_days, 
             gift_ideas, budget, reminder_id, created_at
      FROM occasions WHERE id = ?
    `, [id]);

    if (!record) return undefined;

    return this.mapOccasionRecord(record);
  }

  /**
   * Get all occasions for a contact
   */
  async getContactOccasions(contactId: number): Promise<Occasion[]> {
    await this.ensureInitialized();

    const records = await all<OccasionRecord>(this.db!, `
      SELECT id, contact_id, type, name, month, day, year, advance_weeks, advance_days,
             gift_ideas, budget, reminder_id, created_at
      FROM occasions WHERE contact_id = ?
    `, [contactId]);

    return records.map(record => this.mapOccasionRecord(record));
  }

  /**
   * List all occasions
   */
  async listOccasions(): Promise<Occasion[]> {
    await this.ensureInitialized();

    const records = await all<OccasionRecord>(this.db!, `
      SELECT id, contact_id, type, name, month, day, year, advance_weeks, advance_days,
             gift_ideas, budget, reminder_id, created_at
      FROM occasions
      ORDER BY month, day
    `);

    return records.map(record => this.mapOccasionRecord(record));
  }

  /**
   * Update an occasion
   */
  async updateOccasion(id: number, updates: Partial<CreateOccasionOptions>): Promise<Occasion | undefined> {
    await this.ensureInitialized();

    const occasion = await this.getOccasion(id);
    if (!occasion) return undefined;

    const sets: string[] = [];
    const params: any[] = [];

    if (updates.type !== undefined) { sets.push('type = ?'); params.push(updates.type); }
    if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name); }
    if (updates.month !== undefined) { sets.push('month = ?'); params.push(updates.month); }
    if (updates.day !== undefined) { sets.push('day = ?'); params.push(updates.day); }
    if (updates.year !== undefined) { sets.push('year = ?'); params.push(updates.year); }
    if (updates.giftIdeas !== undefined) { sets.push('gift_ideas = ?'); params.push(updates.giftIdeas); }
    if (updates.budget !== undefined) { sets.push('budget = ?'); params.push(updates.budget); }

    if (updates.advanceNotice !== undefined) {
      sets.push('advance_weeks = ?');
      params.push(updates.advanceNotice.weeks);
      sets.push('advance_days = ?');
      params.push(updates.advanceNotice.days);
    }

    if (sets.length === 0) {
      return occasion;
    }

    params.push(id);
    await run(this.db!, `UPDATE occasions SET ${sets.join(', ')} WHERE id = ?`, params);

    // Update reminder if date-related fields changed
    if (updates.month !== undefined || updates.day !== undefined || updates.advanceNotice !== undefined) {
      const updated = await this.getOccasion(id);
      if (updated && updated.reminderId) {
        // Delete old reminder and create new one
        await this.remindersSkill.deleteReminder(updated.reminderId);
        
        const contact = await this.getContact(updated.contactId);
        const nextDate = this.calculateNextOccurrence(updated.month, updated.day);
        const reminderDate = new Date(nextDate);
        reminderDate.setDate(reminderDate.getDate() - (updated.advanceNotice.weeks * 7 + updated.advanceNotice.days));
        
        const newReminder = await this.remindersSkill.addReminder({
          message: `${updated.name} for ${contact?.name || 'Unknown'} is on ${updated.month}/${updated.day}`,
          scheduledAt: reminderDate,
        });
        
        await run(this.db!, `UPDATE occasions SET reminder_id = ? WHERE id = ?`, [newReminder.id, id]);
      }
    }

    return this.getOccasion(id);
  }

  /**
   * Delete an occasion
   */
  async deleteOccasion(id: number): Promise<boolean> {
    await this.ensureInitialized();

    const occasion = await this.getOccasion(id);
    if (occasion?.reminderId) {
      await this.remindersSkill.deleteReminder(occasion.reminderId);
    }

    const result = await runWithResult(this.db!, `DELETE FROM occasions WHERE id = ?`, [id]);
    return result.changes > 0;
  }

  /**
   * Calculate the next occurrence of a date (month/day)
   */
  private calculateNextOccurrence(month: number, day: number): Date {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    let candidate = new Date(currentYear, month - 1, day);
    
    // If this date has passed this year, use next year
    if (candidate < now) {
      candidate = new Date(currentYear + 1, month - 1, day);
    }
    
    return candidate;
  }

  /**
   * Calculate days until a date
   */
  private daysUntil(target: Date): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const targetCopy = new Date(target);
    targetCopy.setHours(0, 0, 0, 0);
    
    const diffMs = targetCopy.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get upcoming occasions
   */
  async getUpcomingOccasions(daysAhead: number = 365): Promise<UpcomingOccasion[]> {
    await this.ensureInitialized();

    const records = await all<OccasionRecord & { contact_name: string }>(this.db!, `
      SELECT o.id, o.contact_id, o.type, o.name, o.month, o.day, o.year, 
             o.advance_weeks, o.advance_days, o.gift_ideas, o.budget, o.reminder_id, o.created_at,
             c.name as contact_name
      FROM occasions o
      JOIN contacts c ON o.contact_id = c.id
      ORDER BY o.month, o.day
    `);

    const upcoming: UpcomingOccasion[] = [];
    const now = new Date();

    for (const record of records) {
      const nextDate = this.calculateNextOccurrence(record.month, record.day);
      const daysUntil = this.daysUntil(nextDate);

      if (daysUntil <= daysAhead) {
        const advanceDaysTotal = record.advance_weeks * 7 + record.advance_days;
        const isAdvanceNotice = daysUntil <= advanceDaysTotal;

        const occasion: UpcomingOccasion = {
          id: record.id,
          contactId: record.contact_id,
          type: record.type,
          name: record.name,
          month: record.month,
          day: record.day,
          year: record.year,
          advanceNotice: { weeks: record.advance_weeks, days: record.advance_days },
          giftIdeas: record.gift_ideas,
          budget: record.budget,
          reminderId: record.reminder_id,
          createdAt: record.created_at,
          contactName: record.contact_name,
          nextDate,
          daysUntil,
          isAdvanceNotice,
        };

        // Calculate age for birthdays
        if (record.type === 'birthday' && record.year) {
          occasion.age = nextDate.getFullYear() - record.year;
        }

        // Calculate years together for anniversaries
        if (record.type === 'anniversary' && record.year) {
          occasion.yearsTogether = nextDate.getFullYear() - record.year;
        }

        upcoming.push(occasion);
      }
    }

    // Sort by days until (closest first)
    return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  }

  /**
   * Get gift planning timeline for upcoming occasions
   */
  async getGiftPlanningTimeline(daysAhead: number = 90): Promise<GiftPlanningItem[]> {
    const upcoming = await this.getUpcomingOccasions(daysAhead);
    const planningItems: GiftPlanningItem[] = [];

    for (const occasion of upcoming) {
      if (!occasion.isAdvanceNotice) continue;

      const daysToShop = Math.min(14, occasion.daysUntil - 1);
      const daysToOrder = Math.min(7, occasion.daysUntil - 1);
      const daysToWrap = Math.min(1, occasion.daysUntil - 1);

      const startShopping = new Date();
      startShopping.setDate(startShopping.getDate() + Math.max(0, occasion.daysUntil - daysToShop));

      const orderBy = new Date();
      orderBy.setDate(orderBy.getDate() + Math.max(0, occasion.daysUntil - daysToOrder));

      const wrapBy = new Date();
      wrapBy.setDate(wrapBy.getDate() + Math.max(0, occasion.daysUntil - daysToWrap));

      const suggestedActions: string[] = [];
      
      if (occasion.giftIdeas) {
        suggestedActions.push(`Review gift ideas: ${occasion.giftIdeas}`);
      } else {
        suggestedActions.push('Brainstorm gift ideas');
      }

      if (occasion.budget) {
        suggestedActions.push(`Set budget: $${occasion.budget}`);
      }

      suggestedActions.push('Research gift options');
      suggestedActions.push('Purchase gift');
      suggestedActions.push('Wrap and prepare card');

      planningItems.push({
        occasion,
        suggestedActions,
        timeline: {
          startShopping,
          orderBy,
          wrapBy,
          giveOn: occasion.nextDate,
        },
      });
    }

    return planningItems;
  }

  /**
   * Get occasions by type
   */
  async getOccasionsByType(type: OccasionType): Promise<Occasion[]> {
    await this.ensureInitialized();

    const records = await all<OccasionRecord>(this.db!, `
      SELECT id, contact_id, type, name, month, day, year, advance_weeks, advance_days,
             gift_ideas, budget, reminder_id, created_at
      FROM occasions WHERE type = ?
      ORDER BY month, day
    `, [type]);

    return records.map(record => this.mapOccasionRecord(record));
  }

  /**
   * Search contacts and occasions
   */
  async search(query: string): Promise<{ contacts: Contact[]; occasions: Occasion[] }> {
    await this.ensureInitialized();

    const searchTerm = `%${query}%`;

    const contactRecords = await all<ContactRecord>(this.db!, `
      SELECT id, name, email, phone, notes, relationship, created_at
      FROM contacts 
      WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR notes LIKE ?
    `, [searchTerm, searchTerm, searchTerm, searchTerm]);

    const occasionRecords = await all<OccasionRecord>(this.db!, `
      SELECT id, contact_id, type, name, month, day, year, advance_weeks, advance_days,
             gift_ideas, budget, reminder_id, created_at
      FROM occasions 
      WHERE name LIKE ? OR gift_ideas LIKE ?
    `, [searchTerm, searchTerm]);

    return {
      contacts: contactRecords.map(record => ({
        id: record.id,
        name: record.name,
        email: record.email,
        phone: record.phone,
        notes: record.notes,
        relationship: record.relationship,
        createdAt: record.created_at,
      })),
      occasions: occasionRecords.map(record => this.mapOccasionRecord(record)),
    };
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    contacts: number;
    occasions: number;
    birthdays: number;
    anniversaries: number;
    upcomingThisMonth: number;
  }> {
    await this.ensureInitialized();

    const contactsResult = await get<{ count: number }>(this.db!, `SELECT COUNT(*) as count FROM contacts`);
    const occasionsResult = await get<{ count: number }>(this.db!, `SELECT COUNT(*) as count FROM occasions`);
    const birthdaysResult = await get<{ count: number }>(this.db!, `SELECT COUNT(*) as count FROM occasions WHERE type = 'birthday'`);
    const anniversariesResult = await get<{ count: number }>(this.db!, `SELECT COUNT(*) as count FROM occasions WHERE type = 'anniversary'`);

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    
    const upcomingResult = await get<{ count: number }>(this.db!, 
      `SELECT COUNT(*) as count FROM occasions WHERE month = ?`,
      [currentMonth]
    );

    return {
      contacts: contactsResult?.count || 0,
      occasions: occasionsResult?.count || 0,
      birthdays: birthdaysResult?.count || 0,
      anniversaries: anniversariesResult?.count || 0,
      upcomingThisMonth: upcomingResult?.count || 0,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      await this.ensureInitialized();

      const stats = await this.getStats();
      const upcoming = await this.getUpcomingOccasions(30);

      return {
        status: 'healthy',
        contacts: stats.contacts,
        occasions: stats.occasions,
        upcoming: upcoming.length,
        database: this.dbPath,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        contacts: 0,
        occasions: 0,
        upcoming: 0,
        database: this.dbPath,
        error: error instanceof Error ? error.message : String(error),
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
      this.db.close();
      this.db = null;
    }
    await this.remindersSkill.close();
  }

  /**
   * Map database record to Occasion interface
   */
  private mapOccasionRecord(record: OccasionRecord): Occasion {
    return {
      id: record.id,
      contactId: record.contact_id,
      type: record.type,
      name: record.name,
      month: record.month,
      day: record.day,
      year: record.year,
      advanceNotice: {
        weeks: record.advance_weeks,
        days: record.advance_days,
      },
      giftIdeas: record.gift_ideas,
      budget: record.budget,
      reminderId: record.reminder_id,
      createdAt: record.created_at,
    };
  }
}

// Default export
export default OccasionRemindersSkill;
