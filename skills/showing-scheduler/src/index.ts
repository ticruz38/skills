/**
 * Showing Scheduler Skill
 * Real estate property showing scheduler with calendar coordination
 * Built on top of calendar and client-crm skills
 */

import * as sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Dynamic imports for ES module dependencies
async function loadCalendarSkill() {
  const { CalendarSkill } = await import('@openclaw/calendar');
  return CalendarSkill;
}

async function loadClientCRMSkill() {
  const { ClientCRMSkill } = await import('@openclaw/client-crm');
  return ClientCRMSkill;
}

/**
 * Showing status
 */
export type ShowingStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';

/**
 * Client interest level
 */
export type InterestLevel = 'very_high' | 'high' | 'medium' | 'low' | 'none';

/**
 * Property showing record
 */
export interface Showing {
  id?: string;
  clientId: string;
  clientName?: string;
  propertyAddress: string;
  propertyDetails?: string;
  propertyLat?: number;
  propertyLng?: number;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  duration: number; // minutes
  status: ShowingStatus;
  lockboxCode?: string;
  accessNotes?: string;
  calendarEventId?: string;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Showing feedback from client
 */
export interface ShowingFeedback {
  id?: string;
  showingId: string;
  rating: number; // 1-5
  interestLevel: InterestLevel;
  comments?: string;
  pros?: string[];
  cons?: string[];
  followUpRequested: boolean;
  followUpNotes?: string;
  priceOpinion?: 'too_high' | 'fair' | 'good_value' | 'too_low';
  createdAt: string;
}

/**
 * Route optimization result
 */
export interface OptimizedRoute {
  showings: Showing[];
  totalDistance: number; // miles
  estimatedDuration: number; // minutes
  startAddress: string;
  endAddress: string;
}

/**
 * Showing statistics
 */
export interface ShowingStats {
  totalShowings: number;
  completed: number;
  cancelled: number;
  noShow: number;
  scheduled: number;
  averageRating: number;
  highInterestCount: number;
  byMonth: { month: string; count: number }[];
}

/**
 * Schedule showing options
 */
export interface ScheduleShowingOptions {
  clientId: string;
  propertyAddress: string;
  propertyDetails?: string;
  propertyLat?: number;
  propertyLng?: number;
  scheduledDate: string;
  scheduledTime: string;
  duration?: number;
  lockboxCode?: string;
  accessNotes?: string;
  notes?: string;
  createCalendarEvent?: boolean;
}

/**
 * Filter options for listing showings
 */
export interface ShowingFilter {
  clientId?: string;
  status?: ShowingStatus;
  date?: string;
  fromDate?: string;
  toDate?: string;
  propertyAddress?: string;
}

/**
 * Feedback input
 */
export interface FeedbackInput {
  rating: number;
  interestLevel: InterestLevel;
  comments?: string;
  pros?: string[];
  cons?: string[];
  followUpRequested?: boolean;
  followUpNotes?: string;
  priceOpinion?: 'too_high' | 'fair' | 'good_value' | 'too_low';
}

/**
 * Showing scheduler configuration
 */
export interface ShowingSchedulerConfig {
  profile?: string;
  dataDir?: string;
}

// Database record interfaces (snake_case for SQLite)
interface ShowingRecord {
  id?: string;
  client_id: string;
  property_address: string;
  property_details?: string;
  property_lat?: number;
  property_lng?: number;
  scheduled_date: string;
  scheduled_time: string;
  duration: number;
  status: string;
  lockbox_code?: string;
  access_notes?: string;
  calendar_event_id?: string;
  notes?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

interface FeedbackRecord {
  id?: string;
  showing_id: string;
  rating: number;
  interest_level: string;
  comments?: string;
  pros?: string;
  cons?: string;
  follow_up_requested: number;
  follow_up_notes?: string;
  price_opinion?: string;
  created_at: string;
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

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Format date for display
function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Format time for display
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Calculate distance between two coordinates (simplified haversine)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Estimate travel time in minutes
function estimateTravelTime(distance: number): number {
  // Assume average 30 mph in urban areas
  return Math.round((distance / 30) * 60);
}

/**
 * Showing Scheduler Skill
 */
export class ShowingScheduler {
  private profile: string;
  private dataDir: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;
  private calendar: any = null;
  private crm: any = null;

  constructor(config: ShowingSchedulerConfig = {}) {
    this.profile = config.profile || 'default';
    this.dataDir = config.dataDir || path.join(os.homedir(), '.openclaw', 'skills', 'showing-scheduler');
    this.initPromise = this.initStorage();
  }

  /**
   * Create scheduler for a specific profile
   */
  static forProfile(profile: string = 'default'): ShowingScheduler {
    return new ShowingScheduler({ profile });
  }

  /**
   * Initialize storage and dependencies
   */
  private async initStorage(): Promise<void> {
    try {
      // Create data directory
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
      }

      // Initialize database
      const dbPath = path.join(this.dataDir, 'showings.db');
      this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
        const db = new (sqlite3 as any).Database(dbPath, (err: Error | null) => {
          if (err) reject(err);
          else resolve(db);
        });
      });

      // Create showings table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS showings (
          id TEXT PRIMARY KEY,
          profile TEXT NOT NULL,
          client_id TEXT NOT NULL,
          property_address TEXT NOT NULL,
          property_details TEXT,
          property_lat REAL,
          property_lng REAL,
          scheduled_date TEXT NOT NULL,
          scheduled_time TEXT NOT NULL,
          duration INTEGER NOT NULL DEFAULT 60,
          status TEXT NOT NULL DEFAULT 'scheduled',
          lockbox_code TEXT,
          access_notes TEXT,
          calendar_event_id TEXT,
          notes TEXT,
          cancellation_reason TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT
        )
      `);

      // Create feedback table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS feedback (
          id TEXT PRIMARY KEY,
          showing_id TEXT NOT NULL UNIQUE,
          rating INTEGER,
          interest_level TEXT,
          comments TEXT,
          pros TEXT,
          cons TEXT,
          follow_up_requested INTEGER DEFAULT 0,
          follow_up_notes TEXT,
          price_opinion TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (showing_id) REFERENCES showings(id) ON DELETE CASCADE
        )
      `);

      // Create indexes
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_showings_client ON showings(profile, client_id)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_showings_date ON showings(profile, scheduled_date)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_showings_status ON showings(profile, status)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_showings_date_status ON showings(profile, scheduled_date, status)`);

      // Initialize dependencies
      const CalendarSkill = await loadCalendarSkill();
      const ClientCRMSkill = await loadClientCRMSkill();
      this.calendar = new CalendarSkill({ profile: this.profile });
      this.crm = new ClientCRMSkill();

    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  /**
   * Ensure initialization is complete
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
  }

  /**
   * Convert database record to Showing interface
   */
  private recordToShowing(record: ShowingRecord): Showing {
    return {
      id: record.id,
      clientId: record.client_id,
      propertyAddress: record.property_address,
      propertyDetails: record.property_details,
      propertyLat: record.property_lat,
      propertyLng: record.property_lng,
      scheduledDate: record.scheduled_date,
      scheduledTime: record.scheduled_time,
      duration: record.duration,
      status: record.status as ShowingStatus,
      lockboxCode: record.lockbox_code,
      accessNotes: record.access_notes,
      calendarEventId: record.calendar_event_id,
      notes: record.notes,
      cancellationReason: record.cancellation_reason,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      completedAt: record.completed_at,
    };
  }

  /**
   * Convert database record to ShowingFeedback interface
   */
  private recordToFeedback(record: FeedbackRecord): ShowingFeedback {
    return {
      id: record.id,
      showingId: record.showing_id,
      rating: record.rating,
      interestLevel: record.interest_level as InterestLevel,
      comments: record.comments,
      pros: record.pros ? JSON.parse(record.pros) : undefined,
      cons: record.cons ? JSON.parse(record.cons) : undefined,
      followUpRequested: record.follow_up_requested === 1,
      followUpNotes: record.follow_up_notes,
      priceOpinion: record.price_opinion as ShowingFeedback['priceOpinion'],
      createdAt: record.created_at,
    };
  }

  /**
   * Get client name from CRM
   */
  private async getClientName(clientId: string): Promise<string | undefined> {
    try {
      await this.ensureInitialized();
      const client = await this.crm.getClient(clientId);
      return client?.name;
    } catch {
      return undefined;
    }
  }

  /**
   * Schedule a new property showing
   */
  async scheduleShowing(options: ScheduleShowingOptions): Promise<Showing> {
    await this.ensureInitialized();

    if (!this.db) throw new Error('Database not initialized');

    // Validate client exists
    try {
      const client = await this.crm.getClient(options.clientId);
      if (!client) {
        throw new Error(`Client not found: ${options.clientId}`);
      }
    } catch (error) {
      throw new Error(`Failed to validate client: ${error}`);
    }

    const now = new Date().toISOString();
    const showingId = generateId();
    const duration = options.duration || 60;

    // Create calendar event if requested
    let calendarEventId: string | undefined;
    if (options.createCalendarEvent !== false) {
      try {
        const startDateTime = new Date(`${options.scheduledDate}T${options.scheduledTime}`);
        const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

        const event = await this.calendar.createEvent({
          summary: `Property Showing: ${options.propertyAddress}`,
          description: `Client: ${options.clientId}\nDetails: ${options.propertyDetails || 'N/A'}\nNotes: ${options.notes || 'N/A'}`,
          location: options.propertyAddress,
          start: { dateTime: startDateTime.toISOString() },
          end: { dateTime: endDateTime.toISOString() },
        });

        calendarEventId = event.id;
      } catch (error) {
        console.warn('Failed to create calendar event:', error);
      }
    }

    // Insert showing record
    await run(this.db, `
      INSERT INTO showings (
        id, profile, client_id, property_address, property_details,
        property_lat, property_lng, scheduled_date, scheduled_time, duration,
        status, lockbox_code, access_notes, calendar_event_id, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      showingId,
      this.profile,
      options.clientId,
      options.propertyAddress,
      options.propertyDetails || null,
      options.propertyLat || null,
      options.propertyLng || null,
      options.scheduledDate,
      options.scheduledTime,
      duration,
      'scheduled',
      options.lockboxCode || null,
      options.accessNotes || null,
      calendarEventId || null,
      options.notes || null,
      now,
      now,
    ]);

    // Get the created showing
    const record = await get<ShowingRecord>(this.db, `
      SELECT * FROM showings WHERE id = ?
    `, [showingId]);

    if (!record) {
      throw new Error('Failed to create showing');
    }

    return this.recordToShowing(record);
  }

  /**
   * Get a showing by ID
   */
  async getShowing(showingId: string): Promise<Showing | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<ShowingRecord>(this.db, `
      SELECT * FROM showings WHERE id = ? AND profile = ?
    `, [showingId, this.profile]);

    if (!record) return null;

    const showing = this.recordToShowing(record);
    showing.clientName = await this.getClientName(showing.clientId);
    return showing;
  }

  /**
   * List showings with optional filtering
   */
  async listShowings(filter: ShowingFilter = {}): Promise<Showing[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM showings WHERE profile = ?';
    const params: any[] = [this.profile];

    if (filter.clientId) {
      sql += ' AND client_id = ?';
      params.push(filter.clientId);
    }

    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter.date) {
      sql += ' AND scheduled_date = ?';
      params.push(filter.date);
    }

    if (filter.fromDate) {
      sql += ' AND scheduled_date >= ?';
      params.push(filter.fromDate);
    }

    if (filter.toDate) {
      sql += ' AND scheduled_date <= ?';
      params.push(filter.toDate);
    }

    if (filter.propertyAddress) {
      sql += ' AND property_address LIKE ?';
      params.push(`%${filter.propertyAddress}%`);
    }

    sql += ' ORDER BY scheduled_date DESC, scheduled_time DESC';

    const records = await all<ShowingRecord>(this.db, sql, params);

    const showings = records.map(r => this.recordToShowing(r));

    // Get client names
    for (const showing of showings) {
      showing.clientName = await this.getClientName(showing.clientId);
    }

    return showings;
  }

  /**
   * Get showings for today
   */
  async getTodayShowings(): Promise<Showing[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.listShowings({ date: today });
  }

  /**
   * Get upcoming showings
   */
  async getUpcomingShowings(limit: number = 10): Promise<Showing[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const today = new Date().toISOString().split('T')[0];

    const records = await all<ShowingRecord>(this.db, `
      SELECT * FROM showings 
      WHERE profile = ? 
        AND scheduled_date >= ?
        AND status IN ('scheduled', 'confirmed')
      ORDER BY scheduled_date ASC, scheduled_time ASC
      LIMIT ?
    `, [this.profile, today, limit]);

    const showings = records.map(r => this.recordToShowing(r));

    for (const showing of showings) {
      showing.clientName = await this.getClientName(showing.clientId);
    }

    return showings;
  }

  /**
   * Update a showing
   */
  async updateShowing(showingId: string, updates: Partial<Omit<Showing, 'id' | 'createdAt'>>): Promise<Showing> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const showing = await this.getShowing(showingId);
    if (!showing) {
      throw new Error(`Showing not found: ${showingId}`);
    }

    const fieldMapping: Record<string, string> = {
      'scheduledDate': 'scheduled_date',
      'scheduledTime': 'scheduled_time',
      'duration': 'duration',
      'propertyAddress': 'property_address',
      'propertyDetails': 'property_details',
      'propertyLat': 'property_lat',
      'propertyLng': 'property_lng',
      'status': 'status',
      'lockboxCode': 'lockbox_code',
      'accessNotes': 'access_notes',
      'notes': 'notes',
    };

    const updatesToApply: Partial<Record<string, any>> = {};
    for (const [key, dbKey] of Object.entries(fieldMapping)) {
      if (key in updates) {
        const value = (updates as any)[key];
        updatesToApply[dbKey] = value;
      }
    }

    if (Object.keys(updatesToApply).length === 0) {
      return showing;
    }

    updatesToApply.updated_at = new Date().toISOString();

    const setClauses = Object.keys(updatesToApply).map(key => `${key} = ?`);
    const values = Object.values(updatesToApply);

    await run(this.db, `
      UPDATE showings SET ${setClauses.join(', ')} WHERE id = ?
    `, [...values, showingId]);

    // Update calendar event if time changed
    if ((updates.scheduledDate || updates.scheduledTime || updates.duration) && showing.calendarEventId) {
      try {
        const updatedShowing = await this.getShowing(showingId);
        if (updatedShowing) {
          const startDateTime = new Date(`${updatedShowing.scheduledDate}T${updatedShowing.scheduledTime}`);
          const endDateTime = new Date(startDateTime.getTime() + updatedShowing.duration * 60000);

          await this.calendar.updateEvent(showing.calendarEventId, {
            start: { dateTime: startDateTime.toISOString() },
            end: { dateTime: endDateTime.toISOString() },
          });
        }
      } catch (error) {
        console.warn('Failed to update calendar event:', error);
      }
    }

    const updated = await this.getShowing(showingId);
    if (!updated) throw new Error('Failed to retrieve updated showing');
    return updated;
  }

  /**
   * Cancel a showing
   */
  async cancelShowing(showingId: string, reason?: string): Promise<Showing> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const showing = await this.getShowing(showingId);
    if (!showing) {
      throw new Error(`Showing not found: ${showingId}`);
    }

    const now = new Date().toISOString();

    await run(this.db, `
      UPDATE showings 
      SET status = ?, cancellation_reason = ?, updated_at = ?
      WHERE id = ?
    `, ['cancelled', reason || null, now, showingId]);

    // Cancel calendar event
    if (showing.calendarEventId) {
      try {
        await this.calendar.updateEvent(showing.calendarEventId, {
          status: 'cancelled'
        });
      } catch (error) {
        console.warn('Failed to cancel calendar event:', error);
      }
    }

    const updated = await this.getShowing(showingId);
    if (!updated) throw new Error('Failed to retrieve cancelled showing');
    return updated;
  }

  /**
   * Mark showing as completed
   */
  async completeShowing(showingId: string): Promise<Showing> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    await run(this.db, `
      UPDATE showings 
      SET status = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `, ['completed', now, now, showingId]);

    const updated = await this.getShowing(showingId);
    if (!updated) throw new Error('Failed to retrieve completed showing');
    return updated;
  }

  /**
   * Mark showing as no-show
   */
  async markNoShow(showingId: string): Promise<Showing> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    await run(this.db, `
      UPDATE showings 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `, ['no_show', now, showingId]);

    const updated = await this.getShowing(showingId);
    if (!updated) throw new Error('Failed to retrieve showing');
    return updated;
  }

  /**
   * Confirm a showing
   */
  async confirmShowing(showingId: string): Promise<Showing> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    await run(this.db, `
      UPDATE showings 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `, ['confirmed', now, showingId]);

    const updated = await this.getShowing(showingId);
    if (!updated) throw new Error('Failed to retrieve confirmed showing');
    return updated;
  }

  /**
   * Set lockbox code for a showing
   */
  async setLockboxCode(showingId: string, code: string): Promise<Showing> {
    return this.updateShowing(showingId, { lockboxCode: code });
  }

  /**
   * Get lockbox code for a showing
   */
  async getLockboxCode(showingId: string): Promise<string | undefined> {
    const showing = await this.getShowing(showingId);
    return showing?.lockboxCode;
  }

  /**
   * Add feedback for a showing
   */
  async addFeedback(showingId: string, feedback: FeedbackInput): Promise<ShowingFeedback> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const showing = await this.getShowing(showingId);
    if (!showing) {
      throw new Error(`Showing not found: ${showingId}`);
    }

    const now = new Date().toISOString();
    const feedbackId = generateId();

    await run(this.db, `
      INSERT OR REPLACE INTO feedback (
        id, showing_id, rating, interest_level, comments,
        pros, cons, follow_up_requested, follow_up_notes, price_opinion, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      feedbackId,
      showingId,
      feedback.rating,
      feedback.interestLevel,
      feedback.comments || null,
      feedback.pros ? JSON.stringify(feedback.pros) : null,
      feedback.cons ? JSON.stringify(feedback.cons) : null,
      feedback.followUpRequested ? 1 : 0,
      feedback.followUpNotes || null,
      feedback.priceOpinion || null,
      now,
    ]);

    // Update client pipeline if high interest
    if (feedback.interestLevel === 'very_high' || feedback.interestLevel === 'high') {
      try {
        await this.crm.updatePipelineStage(showing.clientId, 'offer');
      } catch (error) {
        console.warn('Failed to update client pipeline:', error);
      }
    }

    return {
      id: feedbackId,
      showingId,
      rating: feedback.rating,
      interestLevel: feedback.interestLevel,
      comments: feedback.comments,
      pros: feedback.pros,
      cons: feedback.cons,
      followUpRequested: feedback.followUpRequested || false,
      followUpNotes: feedback.followUpNotes,
      priceOpinion: feedback.priceOpinion,
      createdAt: now,
    };
  }

  /**
   * Get feedback for a showing
   */
  async getFeedback(showingId: string): Promise<ShowingFeedback | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<FeedbackRecord>(this.db, `
      SELECT * FROM feedback WHERE showing_id = ?
    `, [showingId]);

    if (!record) return null;

    return this.recordToFeedback(record);
  }

  /**
   * Get all feedback for a client
   */
  async getClientFeedback(clientId: string): Promise<(ShowingFeedback & { propertyAddress: string })[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<FeedbackRecord & { property_address: string }>(this.db, `
      SELECT f.*, s.property_address 
      FROM feedback f
      JOIN showings s ON f.showing_id = s.id
      WHERE s.profile = ? AND s.client_id = ?
      ORDER BY f.created_at DESC
    `, [this.profile, clientId]);

    return records.map(r => ({
      ...this.recordToFeedback(r),
      propertyAddress: r.property_address,
    }));
  }

  /**
   * Optimize route for multiple showings
   * Uses nearest neighbor algorithm with distance calculation
   */
  async optimizeRoute(showingIds: string[], startAddress?: string): Promise<OptimizedRoute> {
    await this.ensureInitialized();

    // Get all showings
    const showings: Showing[] = [];
    for (const id of showingIds) {
      const showing = await this.getShowing(id);
      if (showing && showing.status !== 'cancelled') {
        showings.push(showing);
      }
    }

    if (showings.length === 0) {
      throw new Error('No valid showings to optimize');
    }

    // Sort showings with coordinates
    const showingsWithCoords = showings.filter(s => s.propertyLat && s.propertyLng);
    const showingsWithoutCoords = showings.filter(s => !s.propertyLat || !s.propertyLng);

    if (showingsWithCoords.length === 0) {
      // If no coordinates, sort by scheduled time
      const sorted = [...showings].sort((a, b) => {
        const dateA = new Date(`${a.scheduledDate}T${a.scheduledTime}`);
        const dateB = new Date(`${b.scheduledDate}T${b.scheduledTime}`);
        return dateA.getTime() - dateB.getTime();
      });

      return {
        showings: sorted,
        totalDistance: 0,
        estimatedDuration: sorted.reduce((sum, s) => sum + s.duration + 15, 0), // +15 min travel estimate
        startAddress: startAddress || sorted[0].propertyAddress,
        endAddress: sorted[sorted.length - 1].propertyAddress,
      };
    }

    // Nearest neighbor algorithm for route optimization
    const optimized: Showing[] = [];
    const unvisited = [...showingsWithCoords];
    
    // Start from the earliest showing or provided start
    let current: Showing;
    if (startAddress) {
      // Use first showing as starting point if start address not geocoded
      current = unvisited.shift()!;
    } else {
      // Sort by date/time and take earliest
      unvisited.sort((a, b) => {
        const dateA = new Date(`${a.scheduledDate}T${a.scheduledTime}`);
        const dateB = new Date(`${b.scheduledDate}T${b.scheduledTime}`);
        return dateA.getTime() - dateB.getTime();
      });
      current = unvisited.shift()!;
    }
    
    optimized.push(current);

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const distance = calculateDistance(
          current.propertyLat!,
          current.propertyLng!,
          unvisited[i].propertyLat!,
          unvisited[i].propertyLng!
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      current = unvisited.splice(nearestIndex, 1)[0];
      optimized.push(current);
    }

    // Add showings without coordinates at the end
    optimized.push(...showingsWithoutCoords);

    // Calculate total distance
    let totalDistance = 0;
    for (let i = 0; i < optimized.length - 1; i++) {
      if (optimized[i].propertyLat && optimized[i].propertyLng &&
          optimized[i + 1].propertyLat && optimized[i + 1].propertyLng) {
        totalDistance += calculateDistance(
          optimized[i].propertyLat!,
          optimized[i].propertyLng!,
          optimized[i + 1].propertyLat!,
          optimized[i + 1].propertyLng!
        );
      }
    }

    // Calculate estimated duration
    const showingDuration = optimized.reduce((sum, s) => sum + s.duration, 0);
    const travelTime = Math.round(totalDistance / 30 * 60); // 30 mph average
    const estimatedDuration = showingDuration + travelTime;

    return {
      showings: optimized,
      totalDistance: Math.round(totalDistance * 100) / 100,
      estimatedDuration,
      startAddress: startAddress || optimized[0].propertyAddress,
      endAddress: optimized[optimized.length - 1].propertyAddress,
    };
  }

  /**
   * Get optimized route for a date
   */
  async getRouteForDate(date: string, startAddress?: string): Promise<OptimizedRoute> {
    const showings = await this.listShowings({ date, status: 'scheduled' });
    if (showings.length === 0) {
      throw new Error(`No scheduled showings for ${date}`);
    }

    return this.optimizeRoute(showings.map(s => s.id!), startAddress);
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<ShowingStats> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const totalResult = await get<{ count: number }>(this.db, `
      SELECT COUNT(*) as count FROM showings WHERE profile = ?
    `, [this.profile]);

    const completedResult = await get<{ count: number }>(this.db, `
      SELECT COUNT(*) as count FROM showings WHERE profile = ? AND status = ?
    `, [this.profile, 'completed']);

    const cancelledResult = await get<{ count: number }>(this.db, `
      SELECT COUNT(*) as count FROM showings WHERE profile = ? AND status = ?
    `, [this.profile, 'cancelled']);

    const noShowResult = await get<{ count: number }>(this.db, `
      SELECT COUNT(*) as count FROM showings WHERE profile = ? AND status = ?
    `, [this.profile, 'no_show']);

    const scheduledResult = await get<{ count: number }>(this.db, `
      SELECT COUNT(*) as count FROM showings 
      WHERE profile = ? AND status IN ('scheduled', 'confirmed')
    `, [this.profile]);

    const avgRatingResult = await get<{ avg: number }>(this.db, `
      SELECT AVG(rating) as avg 
      FROM feedback f
      JOIN showings s ON f.showing_id = s.id
      WHERE s.profile = ?
    `, [this.profile]);

    const highInterestResult = await get<{ count: number }>(this.db, `
      SELECT COUNT(*) as count 
      FROM feedback f
      JOIN showings s ON f.showing_id = s.id
      WHERE s.profile = ? AND f.interest_level IN ('high', 'very_high')
    `, [this.profile]);

    const byMonth = await all<{ month: string; count: number }>(this.db, `
      SELECT strftime('%Y-%m', scheduled_date) as month, COUNT(*) as count
      FROM showings
      WHERE profile = ?
      GROUP BY strftime('%Y-%m', scheduled_date)
      ORDER BY month DESC
      LIMIT 12
    `, [this.profile]);

    return {
      totalShowings: totalResult?.count || 0,
      completed: completedResult?.count || 0,
      cancelled: cancelledResult?.count || 0,
      noShow: noShowResult?.count || 0,
      scheduled: scheduledResult?.count || 0,
      averageRating: avgRatingResult?.avg ? Math.round(avgRatingResult.avg * 100) / 100 : 0,
      highInterestCount: highInterestResult?.count || 0,
      byMonth,
    };
  }

  /**
   * Check health of dependencies
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string; calendarHealthy: boolean; crmHealthy: boolean }> {
    await this.ensureInitialized();

    let calendarHealthy = false;
    let crmHealthy = false;

    try {
      const calendarHealth = await this.calendar.healthCheck();
      calendarHealthy = calendarHealth.status === 'healthy';
    } catch (error) {
      console.warn('Calendar health check failed:', error);
    }

    try {
      await this.crm.getStats();
      crmHealthy = true;
    } catch (error) {
      console.warn('CRM health check failed:', error);
    }

    if (calendarHealthy && crmHealthy) {
      return { status: 'healthy', message: 'All systems operational', calendarHealthy, crmHealthy };
    } else if (!calendarHealthy && !crmHealthy) {
      return { status: 'unhealthy', message: 'Calendar and CRM unavailable', calendarHealthy, crmHealthy };
    } else if (!calendarHealthy) {
      return { status: 'unhealthy', message: 'Calendar unavailable', calendarHealthy, crmHealthy };
    } else {
      return { status: 'unhealthy', message: 'CRM unavailable', calendarHealthy, crmHealthy };
    }
  }

  /**
   * Delete a showing and its feedback
   */
  async deleteShowing(showingId: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const showing = await this.getShowing(showingId);
    if (!showing) {
      throw new Error(`Showing not found: ${showingId}`);
    }

    // Delete calendar event if exists
    if (showing.calendarEventId) {
      try {
        await this.calendar.deleteEvent(showing.calendarEventId);
      } catch (error) {
        console.warn('Failed to delete calendar event:', error);
      }
    }

    // Delete from database (feedback will cascade)
    await run(this.db, `DELETE FROM showings WHERE id = ?`, [showingId]);
  }

  /**
   * Close connections
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
    }

    if (this.calendar) {
      try {
        await this.calendar.close();
      } catch {
        // Ignore
      }
    }

    if (this.crm) {
      try {
        await this.crm.close();
      } catch {
        // Ignore
      }
    }
  }
}

// Export types
export { formatDate, formatTime, calculateDistance, estimateTravelTime };
