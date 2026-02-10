/**
 * Reservation Manager Skill
 * Restaurant table reservation system with calendar integration
 * Built on top of calendar skill for scheduling
 */

import { CalendarSkill, CreateEventOptions } from '@openclaw/calendar';
import * as sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * Table configuration
 */
export interface Table {
  id: string;
  number: number;
  name: string;
  capacity: number;
  section: string;
  isActive: boolean;
  notes?: string;
}

/**
 * Reservation record
 */
export interface Reservation {
  id: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  partySize: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration: number; // in minutes
  tableId?: string;
  tableIds?: string[]; // for multi-table reservations
  status: 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  specialRequests?: string;
  occasion?: string;
  source: 'phone' | 'walk_in' | 'online' | 'third_party';
  calendarEventId?: string;
  smsConfirmationSent: boolean;
  smsReminderSent: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Restaurant configuration
 */
export interface RestaurantConfig {
  name: string;
  openingTime: string; // HH:MM
  closingTime: string; // HH:MM
  timeSlotInterval: number; // in minutes (e.g., 15, 30)
  defaultReservationDuration: number; // in minutes
  bufferBetweenReservations: number; // in minutes
  enableSmsConfirmations: boolean;
}

/**
 * Time slot availability
 */
export interface TimeSlot {
  time: string; // HH:MM
  available: boolean;
  availableTables: string[];
  totalCapacity: number;
}

/**
 * Availability result for a date
 */
export interface AvailabilityResult {
  date: string;
  slots: TimeSlot[];
}

/**
 * Reservation filter options
 */
export interface ReservationFilter {
  date?: string;
  fromDate?: string;
  toDate?: string;
  status?: Reservation['status'];
  tableId?: string;
  guestName?: string;
  guestPhone?: string;
  partySize?: number;
}

/**
 * SMS message template
 */
export interface SmsTemplate {
  id: string;
  name: string;
  type: 'confirmation' | 'reminder' | 'cancellation' | 'custom';
  body: string;
  isDefault: boolean;
}

/**
 * Reservation manager configuration
 */
export interface ReservationManagerConfig {
  profile?: string;
  dataDir?: string;
  restaurantName?: string;
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

function runWithResult(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Reservation Manager Skill - Restaurant table reservation system
 */
export class ReservationManager {
  private calendar: CalendarSkill;
  private profile: string;
  private dataDir: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: ReservationManagerConfig = {}) {
    this.profile = config.profile || 'default';
    this.dataDir = config.dataDir || path.join(os.homedir(), '.openclaw', 'skills', 'reservation-manager');
    this.calendar = new CalendarSkill({ profile: this.profile });
    this.initPromise = this.initStorage();
  }

  /**
   * Create ReservationManager for a specific profile
   */
  static forProfile(profile: string = 'default'): ReservationManager {
    return new ReservationManager({ profile });
  }

  /**
   * Initialize storage directory and database
   */
  private async initStorage(): Promise<void> {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
      }

      const dbPath = path.join(this.dataDir, 'reservations.db');
      
      this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
          if (err) reject(err);
          else resolve(db);
        });
      });

      // Create tables table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS tables (
          id TEXT PRIMARY KEY,
          profile TEXT NOT NULL,
          number INTEGER NOT NULL,
          name TEXT NOT NULL,
          capacity INTEGER NOT NULL,
          section TEXT DEFAULT 'main',
          is_active INTEGER DEFAULT 1,
          notes TEXT,
          created_at TEXT NOT NULL
        )
      `);

      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_tables_profile ON tables(profile)
      `);
      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_tables_active ON tables(is_active)
      `);

      // Create reservations table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS reservations (
          id TEXT PRIMARY KEY,
          profile TEXT NOT NULL,
          guest_name TEXT NOT NULL,
          guest_phone TEXT NOT NULL,
          guest_email TEXT,
          party_size INTEGER NOT NULL,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          duration INTEGER NOT NULL DEFAULT 90,
          table_id TEXT,
          table_ids TEXT,
          status TEXT DEFAULT 'confirmed',
          special_requests TEXT,
          occasion TEXT,
          source TEXT DEFAULT 'phone',
          calendar_event_id TEXT,
          sms_confirmation_sent INTEGER DEFAULT 0,
          sms_reminder_sent INTEGER DEFAULT 0,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_reservations_profile ON reservations(profile)
      `);
      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date)
      `);
      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status)
      `);
      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_reservations_table ON reservations(table_id)
      `);

      // Create config table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          profile TEXT NOT NULL,
          value TEXT NOT NULL
        )
      `);

      // Create SMS templates table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS sms_templates (
          id TEXT PRIMARY KEY,
          profile TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          body TEXT NOT NULL,
          is_default INTEGER DEFAULT 0
        )
      `);

      // Insert default config
      await this.insertDefaultConfig();

      // Insert default SMS templates
      await this.insertDefaultSmsTemplates();
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      this.db = null;
    }
  }

  /**
   * Insert default configuration
   */
  private async insertDefaultConfig(): Promise<void> {
    if (!this.db) return;

    const defaults: Record<string, string> = {
      'restaurant.name': 'My Restaurant',
      'restaurant.openingTime': '11:00',
      'restaurant.closingTime': '22:00',
      'restaurant.timeSlotInterval': '30',
      'restaurant.defaultReservationDuration': '90',
      'restaurant.bufferBetweenReservations': '15',
      'restaurant.enableSmsConfirmations': 'false',
    };

    for (const [key, value] of Object.entries(defaults)) {
      const existing = await get<{ count: number }>(
        this.db,
        'SELECT COUNT(*) as count FROM config WHERE profile = ? AND key = ?',
        [this.profile, key]
      );
      
      if (!existing || existing.count === 0) {
        await run(this.db, 
          'INSERT INTO config (key, profile, value) VALUES (?, ?, ?)',
          [key, this.profile, value]
        );
      }
    }
  }

  /**
   * Insert default SMS templates
   */
  private async insertDefaultSmsTemplates(): Promise<void> {
    if (!this.db) return;

    const defaults: Array<Omit<SmsTemplate, 'id'>> = [
      {
        name: 'Confirmation',
        type: 'confirmation',
        body: 'Hi {{guestName}}, your reservation for {{partySize}} on {{date}} at {{time}} is confirmed. We look forward to seeing you! Reply STOP to opt out.',
        isDefault: true,
      },
      {
        name: 'Reminder',
        type: 'reminder',
        body: 'Reminder: You have a reservation for {{partySize}} at {{restaurantName}} today at {{time}}. See you soon! Reply STOP to opt out.',
        isDefault: true,
      },
      {
        name: 'Cancellation',
        type: 'cancellation',
        body: 'Hi {{guestName}}, your reservation for {{date}} at {{time}} has been cancelled. We hope to see you another time!',
        isDefault: true,
      },
    ];

    for (const template of defaults) {
      const existing = await get<{ count: number }>(
        this.db,
        'SELECT COUNT(*) as count FROM sms_templates WHERE profile = ? AND name = ? AND type = ?',
        [this.profile, template.name, template.type]
      );
      
      if (!existing || existing.count === 0) {
        const id = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await run(this.db, `
          INSERT INTO sms_templates (id, profile, name, type, body, is_default)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          id,
          this.profile,
          template.name,
          template.type,
          template.body,
          template.isDefault ? 1 : 0,
        ]);
      }
    }
  }

  /**
   * Ensure storage is initialized
   */
  private async ensureStorage(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    connected: boolean;
    calendarConnected: boolean;
    email?: string;
  }> {
    const calendarStatus = await this.calendar.getStatus();

    return {
      connected: calendarStatus.connected,
      calendarConnected: calendarStatus.connected,
      email: calendarStatus.email,
    };
  }

  /**
   * Get restaurant configuration
   */
  async getConfig(): Promise<RestaurantConfig> {
    await this.ensureStorage();
    if (!this.db) throw new Error('Storage not initialized');

    const rows = await all<{ key: string; value: string }>(
      this.db,
      'SELECT key, value FROM config WHERE profile = ?',
      [this.profile]
    );

    const config: Record<string, string> = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }

    return {
      name: config['restaurant.name'] || 'My Restaurant',
      openingTime: config['restaurant.openingTime'] || '11:00',
      closingTime: config['restaurant.closingTime'] || '22:00',
      timeSlotInterval: parseInt(config['restaurant.timeSlotInterval'] || '30'),
      defaultReservationDuration: parseInt(config['restaurant.defaultReservationDuration'] || '90'),
      bufferBetweenReservations: parseInt(config['restaurant.bufferBetweenReservations'] || '15'),
      enableSmsConfirmations: config['restaurant.enableSmsConfirmations'] === 'true',
    };
  }

  /**
   * Update restaurant configuration
   */
  async updateConfig(updates: Partial<RestaurantConfig>): Promise<RestaurantConfig> {
    await this.ensureStorage();
    if (!this.db) throw new Error('Storage not initialized');

    const mapping: Record<string, keyof RestaurantConfig> = {
      'restaurant.name': 'name',
      'restaurant.openingTime': 'openingTime',
      'restaurant.closingTime': 'closingTime',
      'restaurant.timeSlotInterval': 'timeSlotInterval',
      'restaurant.defaultReservationDuration': 'defaultReservationDuration',
      'restaurant.bufferBetweenReservations': 'bufferBetweenReservations',
      'restaurant.enableSmsConfirmations': 'enableSmsConfirmations',
    };

    for (const [dbKey, configKey] of Object.entries(mapping)) {
      if (updates[configKey] !== undefined) {
        const value = typeof updates[configKey] === 'boolean' 
          ? String(updates[configKey])
          : String(updates[configKey]);
        
        await run(this.db, `
          INSERT OR REPLACE INTO config (key, profile, value) VALUES (?, ?, ?)
        `, [dbKey, this.profile, value]);
      }
    }

    return this.getConfig();
  }

  // ============== TABLE MANAGEMENT ==============

  /**
   * Add a new table
   */
  async addTable(table: Omit<Table, 'id' | 'createdAt'>): Promise<Table> {
    await this.ensureStorage();
    if (!this.db) throw new Error('Storage not initialized');

    const id = `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();

    await run(this.db, `
      INSERT INTO tables (id, profile, number, name, capacity, section, is_active, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      this.profile,
      table.number,
      table.name,
      table.capacity,
      table.section || 'main',
      table.isActive !== false ? 1 : 0,
      table.notes || null,
      createdAt,
    ]);

    return {
      ...table,
      id,
      section: table.section || 'main',
      isActive: table.isActive !== false,
    };
  }

  /**
   * Get a table by ID
   */
  async getTable(id: string): Promise<Table | null> {
    await this.ensureStorage();
    if (!this.db) return null;

    const row = await get<{
      id: string;
      number: number;
      name: string;
      capacity: number;
      section: string;
      is_active: number;
      notes: string | null;
    }>(this.db, 'SELECT * FROM tables WHERE id = ? AND profile = ?', [id, this.profile]);

    if (!row) return null;

    return {
      id: row.id,
      number: row.number,
      name: row.name,
      capacity: row.capacity,
      section: row.section,
      isActive: row.is_active === 1,
      notes: row.notes || undefined,
    };
  }

  /**
   * List all tables
   */
  async listTables(options: { activeOnly?: boolean; section?: string } = {}): Promise<Table[]> {
    await this.ensureStorage();
    if (!this.db) return [];

    let sql = 'SELECT * FROM tables WHERE profile = ?';
    const params: any[] = [this.profile];

    if (options.activeOnly) {
      sql += ' AND is_active = 1';
    }
    if (options.section) {
      sql += ' AND section = ?';
      params.push(options.section);
    }

    sql += ' ORDER BY number';

    const rows = await all<{
      id: string;
      number: number;
      name: string;
      capacity: number;
      section: string;
      is_active: number;
      notes: string | null;
    }>(this.db, sql, params);

    return rows.map(row => ({
      id: row.id,
      number: row.number,
      name: row.name,
      capacity: row.capacity,
      section: row.section,
      isActive: row.is_active === 1,
      notes: row.notes || undefined,
    }));
  }

  /**
   * Update a table
   */
  async updateTable(id: string, updates: Partial<Omit<Table, 'id'>>): Promise<Table | null> {
    await this.ensureStorage();
    if (!this.db) return null;

    const existing = await this.getTable(id);
    if (!existing) return null;

    const updated: Table = {
      ...existing,
      ...updates,
    };

    await run(this.db, `
      UPDATE tables SET
        number = ?,
        name = ?,
        capacity = ?,
        section = ?,
        is_active = ?,
        notes = ?
      WHERE id = ? AND profile = ?
    `, [
      updated.number,
      updated.name,
      updated.capacity,
      updated.section,
      updated.isActive ? 1 : 0,
      updated.notes || null,
      id,
      this.profile,
    ]);

    return updated;
  }

  /**
   * Delete a table
   */
  async deleteTable(id: string): Promise<boolean> {
    await this.ensureStorage();
    if (!this.db) return false;

    // Check if table has future reservations
    const hasReservations = await get<{ count: number }>(
      this.db,
      `SELECT COUNT(*) as count FROM reservations 
       WHERE profile = ? AND table_id = ? AND date >= date('now') 
       AND status IN ('confirmed', 'seated')`,
      [this.profile, id]
    );

    if (hasReservations && hasReservations.count > 0) {
      throw new Error('Cannot delete table with future reservations');
    }

    await run(this.db, 'DELETE FROM tables WHERE id = ? AND profile = ?', [id, this.profile]);
    return true;
  }

  // ============== RESERVATION MANAGEMENT ==============

  /**
   * Create a new reservation
   */
  async createReservation(
    reservation: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt' | 'smsConfirmationSent' | 'smsReminderSent'>
  ): Promise<Reservation> {
    await this.ensureStorage();
    if (!this.db) throw new Error('Storage not initialized');

    const config = await this.getConfig();
    const id = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // Validate party size
    if (reservation.partySize < 1) {
      throw new Error('Party size must be at least 1');
    }

    // Check availability
    const availableTables = await this.findAvailableTables(
      reservation.date,
      reservation.time,
      reservation.duration || config.defaultReservationDuration,
      reservation.partySize
    );

    // Auto-assign table if not specified
    let tableId = reservation.tableId;
    let tableIds = reservation.tableIds;

    if (!tableId && (!tableIds || tableIds.length === 0)) {
      if (availableTables.length === 0) {
        throw new Error('No available tables for the requested time and party size');
      }
      // Assign the best-fitting table
      tableId = availableTables[0].id;
    }

    // Verify the assigned table is available
    if (tableId) {
      const isAvailable = availableTables.some(t => t.id === tableId);
      if (!isAvailable) {
        throw new Error('Selected table is not available at the requested time');
      }
    }

    const duration = reservation.duration || config.defaultReservationDuration;

    // Create calendar event if connected
    let calendarEventId: string | undefined;
    const status = await this.getStatus();
    
    if (status.calendarConnected) {
      try {
        const startDateTime = new Date(`${reservation.date}T${reservation.time}`);
        const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

        const event = await this.calendar.createEvent({
          summary: `Reservation: ${reservation.guestName} (${reservation.partySize})`,
          description: `Party size: ${reservation.partySize}\nPhone: ${reservation.guestPhone}${reservation.specialRequests ? `\nSpecial requests: ${reservation.specialRequests}` : ''}`,
          start: {
            dateTime: startDateTime.toISOString(),
          },
          end: {
            dateTime: endDateTime.toISOString(),
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 15 },
            ],
          },
        });
        calendarEventId = event.id;
      } catch (e) {
        // Calendar event creation failed but continue with reservation
        console.warn('Failed to create calendar event:', e);
      }
    }

    await run(this.db, `
      INSERT INTO reservations (
        id, profile, guest_name, guest_phone, guest_email, party_size,
        date, time, duration, table_id, table_ids, status, special_requests,
        occasion, source, calendar_event_id, sms_confirmation_sent, sms_reminder_sent,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      this.profile,
      reservation.guestName,
      reservation.guestPhone,
      reservation.guestEmail || null,
      reservation.partySize,
      reservation.date,
      reservation.time,
      duration,
      tableId || null,
      tableIds ? JSON.stringify(tableIds) : null,
      reservation.status || 'confirmed',
      reservation.specialRequests || null,
      reservation.occasion || null,
      reservation.source || 'phone',
      calendarEventId || null,
      0,
      0,
      reservation.notes || null,
      now,
      now,
    ]);

    const created: Reservation = {
      ...reservation,
      id,
      tableId: tableId || undefined,
      tableIds: tableIds || undefined,
      duration,
      status: reservation.status || 'confirmed',
      source: reservation.source || 'phone',
      calendarEventId: calendarEventId || undefined,
      smsConfirmationSent: false,
      smsReminderSent: false,
      createdAt: now,
      updatedAt: now,
    };

    // Send SMS confirmation if enabled
    if (config.enableSmsConfirmations) {
      await this.sendSmsConfirmation(created);
    }

    return created;
  }

  /**
   * Get a reservation by ID
   */
  async getReservation(id: string): Promise<Reservation | null> {
    await this.ensureStorage();
    if (!this.db) return null;

    const row = await get<{
      id: string;
      guest_name: string;
      guest_phone: string;
      guest_email: string | null;
      party_size: number;
      date: string;
      time: string;
      duration: number;
      table_id: string | null;
      table_ids: string | null;
      status: string;
      special_requests: string | null;
      occasion: string | null;
      source: string;
      calendar_event_id: string | null;
      sms_confirmation_sent: number;
      sms_reminder_sent: number;
      notes: string | null;
      created_at: string;
      updated_at: string;
    }>(this.db, 'SELECT * FROM reservations WHERE id = ? AND profile = ?', [id, this.profile]);

    if (!row) return null;

    return {
      id: row.id,
      guestName: row.guest_name,
      guestPhone: row.guest_phone,
      guestEmail: row.guest_email || undefined,
      partySize: row.party_size,
      date: row.date,
      time: row.time,
      duration: row.duration,
      tableId: row.table_id || undefined,
      tableIds: row.table_ids ? JSON.parse(row.table_ids) : undefined,
      status: row.status as Reservation['status'],
      specialRequests: row.special_requests || undefined,
      occasion: row.occasion || undefined,
      source: row.source as Reservation['source'],
      calendarEventId: row.calendar_event_id || undefined,
      smsConfirmationSent: row.sms_confirmation_sent === 1,
      smsReminderSent: row.sms_reminder_sent === 1,
      notes: row.notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * List reservations with filters
   */
  async listReservations(filter: ReservationFilter = {}): Promise<Reservation[]> {
    await this.ensureStorage();
    if (!this.db) return [];

    let sql = 'SELECT * FROM reservations WHERE profile = ?';
    const params: any[] = [this.profile];

    if (filter.date) {
      sql += ' AND date = ?';
      params.push(filter.date);
    }
    if (filter.fromDate) {
      sql += ' AND date >= ?';
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      sql += ' AND date <= ?';
      params.push(filter.toDate);
    }
    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter.tableId) {
      sql += ' AND (table_id = ? OR table_ids LIKE ?)';
      params.push(filter.tableId, `%${filter.tableId}%`);
    }
    if (filter.guestName) {
      sql += ' AND guest_name LIKE ?';
      params.push(`%${filter.guestName}%`);
    }
    if (filter.guestPhone) {
      sql += ' AND guest_phone = ?';
      params.push(filter.guestPhone);
    }
    if (filter.partySize) {
      sql += ' AND party_size = ?';
      params.push(filter.partySize);
    }

    sql += ' ORDER BY date DESC, time DESC';

    const rows = await all<{
      id: string;
      guest_name: string;
      guest_phone: string;
      guest_email: string | null;
      party_size: number;
      date: string;
      time: string;
      duration: number;
      table_id: string | null;
      table_ids: string | null;
      status: string;
      special_requests: string | null;
      occasion: string | null;
      source: string;
      calendar_event_id: string | null;
      sms_confirmation_sent: number;
      sms_reminder_sent: number;
      notes: string | null;
      created_at: string;
      updated_at: string;
    }>(this.db, sql, params);

    return rows.map(row => ({
      id: row.id,
      guestName: row.guest_name,
      guestPhone: row.guest_phone,
      guestEmail: row.guest_email || undefined,
      partySize: row.party_size,
      date: row.date,
      time: row.time,
      duration: row.duration,
      tableId: row.table_id || undefined,
      tableIds: row.table_ids ? JSON.parse(row.table_ids) : undefined,
      status: row.status as Reservation['status'],
      specialRequests: row.special_requests || undefined,
      occasion: row.occasion || undefined,
      source: row.source as Reservation['source'],
      calendarEventId: row.calendar_event_id || undefined,
      smsConfirmationSent: row.sms_confirmation_sent === 1,
      smsReminderSent: row.sms_reminder_sent === 1,
      notes: row.notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Update a reservation
   */
  async updateReservation(
    id: string,
    updates: Partial<Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Reservation | null> {
    await this.ensureStorage();
    if (!this.db) return null;

    const existing = await this.getReservation(id);
    if (!existing) return null;

    // Update calendar event if time changes
    if (updates.date || updates.time || updates.duration) {
      if (existing.calendarEventId) {
        try {
          const date = updates.date || existing.date;
          const time = updates.time || existing.time;
          const duration = updates.duration || existing.duration;
          const startDateTime = new Date(`${date}T${time}`);
          const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

          await this.calendar.updateEvent(existing.calendarEventId, {
            summary: updates.guestName ? `Reservation: ${updates.guestName} (${updates.partySize || existing.partySize})` : undefined,
            start: { dateTime: startDateTime.toISOString() },
            end: { dateTime: endDateTime.toISOString() },
          });
        } catch (e) {
          console.warn('Failed to update calendar event:', e);
        }
      }
    }

    const updated: Reservation = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await run(this.db, `
      UPDATE reservations SET
        guest_name = ?,
        guest_phone = ?,
        guest_email = ?,
        party_size = ?,
        date = ?,
        time = ?,
        duration = ?,
        table_id = ?,
        table_ids = ?,
        status = ?,
        special_requests = ?,
        occasion = ?,
        notes = ?,
        updated_at = ?
      WHERE id = ? AND profile = ?
    `, [
      updated.guestName,
      updated.guestPhone,
      updated.guestEmail || null,
      updated.partySize,
      updated.date,
      updated.time,
      updated.duration,
      updated.tableId || null,
      updated.tableIds ? JSON.stringify(updated.tableIds) : null,
      updated.status,
      updated.specialRequests || null,
      updated.occasion || null,
      updated.notes || null,
      updated.updatedAt,
      id,
      this.profile,
    ]);

    return updated;
  }

  /**
   * Cancel a reservation
   */
  async cancelReservation(id: string, sendNotification: boolean = true): Promise<boolean> {
    await this.ensureStorage();
    if (!this.db) return false;

    const reservation = await this.getReservation(id);
    if (!reservation) return false;

    // Update calendar event
    if (reservation.calendarEventId) {
      try {
        await this.calendar.updateEvent(reservation.calendarEventId, {
          status: 'cancelled',
        });
      } catch (e) {
        // Ignore calendar errors
      }
    }

    // Update reservation status
    await this.updateReservation(id, { status: 'cancelled' });

    // Send cancellation SMS if enabled
    if (sendNotification) {
      await this.sendSmsCancellation(reservation);
    }

    return true;
  }

  /**
   * Delete a reservation
   */
  async deleteReservation(id: string): Promise<boolean> {
    await this.ensureStorage();
    if (!this.db) return false;

    const reservation = await this.getReservation(id);
    if (!reservation) return false;

    // Delete calendar event
    if (reservation.calendarEventId) {
      try {
        await this.calendar.deleteEvent(reservation.calendarEventId);
      } catch (e) {
        // Ignore calendar errors
      }
    }

    await run(this.db, 'DELETE FROM reservations WHERE id = ? AND profile = ?', [id, this.profile]);
    return true;
  }

  // ============== AVAILABILITY ==============

  /**
   * Find available tables for a given time slot
   */
  async findAvailableTables(
    date: string,
    time: string,
    duration: number,
    partySize: number
  ): Promise<Table[]> {
    await this.ensureStorage();
    if (!this.db) return [];

    // Get all active tables with sufficient capacity
    const tables = await this.listTables({ activeOnly: true });
    const suitableTables = tables.filter(t => t.capacity >= partySize);

    if (suitableTables.length === 0) return [];

    // Calculate time range for the reservation
    const startTime = new Date(`${date}T${time}`);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    // Get conflicting reservations
    const conflictingReservations = await all<{
      table_id: string;
      date: string;
      time: string;
      duration: number;
    }>(
      this.db,
      `SELECT table_id, date, time, duration FROM reservations 
       WHERE profile = ? AND date = ? AND status IN ('confirmed', 'seated')
       AND table_id IS NOT NULL`,
      [this.profile, date]
    );

    // Filter out tables with conflicts
    const availableTables: Table[] = [];

    for (const table of suitableTables) {
      const hasConflict = conflictingReservations.some(r => {
        if (r.table_id !== table.id) return false;

        const rStart = new Date(`${r.date}T${r.time}`);
        const rEnd = new Date(rStart.getTime() + r.duration * 60000);

        // Check for overlap
        return (startTime < rEnd && endTime > rStart);
      });

      if (!hasConflict) {
        availableTables.push(table);
      }
    }

    // Sort by capacity (closest fit first)
    availableTables.sort((a, b) => a.capacity - b.capacity);

    return availableTables;
  }

  /**
   * Check availability for a date
   */
  async checkAvailability(date: string, partySize?: number): Promise<AvailabilityResult> {
    await this.ensureStorage();
    const config = await this.getConfig();

    // Get all active tables
    const tables = await this.listTables({ activeOnly: true });
    const suitableTables = partySize 
      ? tables.filter(t => t.capacity >= partySize)
      : tables;

    // Generate time slots
    const slots: TimeSlot[] = [];
    const [openHour, openMinute] = config.openingTime.split(':').map(Number);
    const [closeHour, closeMinute] = config.closingTime.split(':').map(Number);

    const openTime = new Date(`${date}T${config.openingTime}`);
    const closeTime = new Date(`${date}T${config.closingTime}`);

    let currentTime = new Date(openTime);

    while (currentTime < closeTime) {
      const timeStr = currentTime.toTimeString().slice(0, 5);
      
      const availableTables = await this.findAvailableTables(
        date,
        timeStr,
        config.defaultReservationDuration,
        partySize || 1
      );

      const totalCapacity = availableTables.reduce((sum, t) => sum + t.capacity, 0);

      slots.push({
        time: timeStr,
        available: availableTables.length > 0,
        availableTables: availableTables.map(t => t.id),
        totalCapacity,
      });

      currentTime = new Date(currentTime.getTime() + config.timeSlotInterval * 60000);
    }

    return {
      date,
      slots,
    };
  }

  // ============== SMS NOTIFICATIONS ==============

  /**
   * Get SMS template
   */
  async getSmsTemplate(type: SmsTemplate['type']): Promise<SmsTemplate | null> {
    await this.ensureStorage();
    if (!this.db) return null;

    const row = await get<{
      id: string;
      name: string;
      type: string;
      body: string;
      is_default: number;
    }>(
      this.db,
      'SELECT * FROM sms_templates WHERE profile = ? AND type = ? AND is_default = 1 LIMIT 1',
      [this.profile, type]
    );

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      type: row.type as SmsTemplate['type'],
      body: row.body,
      isDefault: row.is_default === 1,
    };
  }

  /**
   * Send SMS confirmation
   */
  async sendSmsConfirmation(reservation: Reservation): Promise<boolean> {
    const template = await this.getSmsTemplate('confirmation');
    if (!template) return false;

    const config = await this.getConfig();
    const message = this.renderSmsTemplate(template.body, reservation, config.name);

    // Mark as sent (actual SMS sending would require SMS gateway integration)
    await run(
      this.db!,
      'UPDATE reservations SET sms_confirmation_sent = 1 WHERE id = ?',
      [reservation.id]
    );

    console.log(`[SMS to ${reservation.guestPhone}]: ${message}`);
    return true;
  }

  /**
   * Send SMS reminder
   */
  async sendSmsReminder(reservation: Reservation): Promise<boolean> {
    const template = await this.getSmsTemplate('reminder');
    if (!template) return false;

    const config = await this.getConfig();
    const message = this.renderSmsTemplate(template.body, reservation, config.name);

    await run(
      this.db!,
      'UPDATE reservations SET sms_reminder_sent = 1 WHERE id = ?',
      [reservation.id]
    );

    console.log(`[SMS to ${reservation.guestPhone}]: ${message}`);
    return true;
  }

  /**
   * Send SMS cancellation
   */
  async sendSmsCancellation(reservation: Reservation): Promise<boolean> {
    const template = await this.getSmsTemplate('cancellation');
    if (!template) return false;

    const config = await this.getConfig();
    const message = this.renderSmsTemplate(template.body, reservation, config.name);

    console.log(`[SMS to ${reservation.guestPhone}]: ${message}`);
    return true;
  }

  /**
   * Render SMS template with variables
   */
  private renderSmsTemplate(template: string, reservation: Reservation, restaurantName: string): string {
    return template
      .replace(/\{\{guestName\}\}/g, reservation.guestName)
      .replace(/\{\{partySize\}\}/g, String(reservation.partySize))
      .replace(/\{\{date\}\}/g, reservation.date)
      .replace(/\{\{time\}\}/g, reservation.time)
      .replace(/\{\{restaurantName\}\}/g, restaurantName);
  }

  /**
   * Send reminders for today's reservations
   */
  async sendRemindersForToday(): Promise<{ sent: number; reservations: Reservation[] }> {
    const today = new Date().toISOString().split('T')[0];
    const reservations = await this.listReservations({
      date: today,
      status: 'confirmed',
    });

    const toRemind = reservations.filter(r => !r.smsReminderSent);

    for (const reservation of toRemind) {
      await this.sendSmsReminder(reservation);
    }

    return {
      sent: toRemind.length,
      reservations: toRemind,
    };
  }

  // ============== STATS & HEALTH ==============

  /**
   * Get reservation statistics
   */
  async getStats(options: { fromDate?: string; toDate?: string } = {}): Promise<{
    totalReservations: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
    totalGuests: number;
    averagePartySize: number;
  }> {
    await this.ensureStorage();
    if (!this.db) {
      return {
        totalReservations: 0,
        byStatus: {},
        bySource: {},
        totalGuests: 0,
        averagePartySize: 0,
      };
    }

    let whereClause = 'profile = ?';
    const params: any[] = [this.profile];

    if (options.fromDate) {
      whereClause += ' AND date >= ?';
      params.push(options.fromDate);
    }
    if (options.toDate) {
      whereClause += ' AND date <= ?';
      params.push(options.toDate);
    }

    const totalResult = await get<{ count: number }>(
      this.db,
      `SELECT COUNT(*) as count FROM reservations WHERE ${whereClause}`,
      params
    );

    const statusResults = await all<{ status: string; count: number }>(
      this.db,
      `SELECT status, COUNT(*) as count FROM reservations WHERE ${whereClause} GROUP BY status`,
      [...params]
    );

    const sourceResults = await all<{ source: string; count: number }>(
      this.db,
      `SELECT source, COUNT(*) as count FROM reservations WHERE ${whereClause} GROUP BY source`,
      [...params]
    );

    const guestsResult = await get<{ total: number; avg: number }>(
      this.db,
      `SELECT SUM(party_size) as total, AVG(party_size) as avg FROM reservations WHERE ${whereClause}`,
      [...params]
    );

    const byStatus: Record<string, number> = {};
    for (const row of statusResults) {
      byStatus[row.status] = row.count;
    }

    const bySource: Record<string, number> = {};
    for (const row of sourceResults) {
      bySource[row.source] = row.count;
    }

    return {
      totalReservations: totalResult?.count || 0,
      byStatus,
      bySource,
      totalGuests: guestsResult?.total || 0,
      averagePartySize: Math.round((guestsResult?.avg || 0) * 10) / 10,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message?: string;
    calendarStatus?: string;
    tables?: number;
    reservations?: number;
  }> {
    const status = await this.getStatus();

    if (!this.db) {
      return {
        status: 'unhealthy',
        message: 'Database not initialized',
      };
    }

    const calendarHealth = await this.calendar.healthCheck();

    const tableCount = await get<{ count: number }>(
      this.db,
      'SELECT COUNT(*) as count FROM tables WHERE profile = ?',
      [this.profile]
    );

    const reservationCount = await get<{ count: number }>(
      this.db,
      'SELECT COUNT(*) as count FROM reservations WHERE profile = ?',
      [this.profile]
    );

    return {
      status: 'healthy',
      message: 'Reservation manager operational',
      calendarStatus: calendarHealth.status,
      tables: tableCount?.count || 0,
      reservations: reservationCount?.count || 0,
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (e) {
        // Ignore
      }
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    await this.calendar.close();
  }
}
