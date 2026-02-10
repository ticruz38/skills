/**
 * Focus Time Blocks Skill
 * Protect focus time on calendar for deep work
 * Built on top of calendar skill
 */

import { CalendarSkill } from '@openclaw/calendar';
import * as sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * Focus block configuration
 */
export interface FocusBlockConfig {
  id?: number;
  name: string;
  durationMinutes: number;
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  colorId?: string;
  description?: string;
  autoDecline: boolean;
  dndEnabled: boolean;
  isActive: boolean;
  createdAt?: string;
}

/**
 * Focus block record (database)
 */
interface FocusBlockRecord {
  id?: number;
  name: string;
  duration_minutes: number;
  days_of_week: string;
  start_time: string;
  end_time: string;
  color_id?: string;
  description?: string;
  auto_decline: number;
  dnd_enabled: number;
  is_active: number;
  created_at: string;
}

/**
 * Productivity session record
 */
export interface ProductivitySession {
  id?: number;
  focusBlockId: number;
  date: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: 'scheduled' | 'completed' | 'interrupted' | 'cancelled';
  interruptions?: number;
  notes?: string;
  calendarEventId?: string;
}

/**
 * Productivity session record (database)
 */
interface ProductivitySessionRecord {
  id?: number;
  focus_block_id: number;
  date: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string;
  actual_end?: string;
  status: 'scheduled' | 'completed' | 'interrupted' | 'cancelled';
  interruptions?: number;
  notes?: string;
  calendar_event_id?: string;
}

/**
 * Auto-decline rule
 */
export interface AutoDeclineRule {
  id?: number;
  focusBlockId: number;
  meetingTitlePattern?: string;
  meetingOrganizer?: string;
  declineMessage: string;
  isActive: boolean;
}

/**
 * Auto-decline rule record (database)
 */
interface AutoDeclineRuleRecord {
  id?: number;
  focus_block_id: number;
  meeting_title_pattern?: string;
  meeting_organizer?: string;
  decline_message: string;
  is_active: number;
}

/**
 * Productivity analytics
 */
export interface ProductivityAnalytics {
  totalSessions: number;
  completedSessions: number;
  interruptedSessions: number;
  cancelledSessions: number;
  totalFocusHours: number;
  averageSessionLength: number;
  completionRate: number;
  interruptionsPerSession: number;
  weeklyTrend: {
    week: string;
    sessions: number;
    hours: number;
    completionRate: number;
  }[];
  dailyDistribution: {
    day: string;
    sessions: number;
    hours: number;
  }[];
}

/**
 * Focus time blocks skill configuration
 */
export interface FocusTimeConfig {
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
 * Focus Time Blocks Skill - Protect focus time for deep work
 */
export class FocusTimeSkill {
  private calendarSkill: CalendarSkill;
  private profile: string;
  private dataDir: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: FocusTimeConfig = {}) {
    this.profile = config.profile || 'default';
    this.dataDir = config.dataDir || path.join(os.homedir(), '.openclaw', 'skills', 'focus-time-blocks');
    this.calendarSkill = new CalendarSkill({ profile: this.profile });
    this.initPromise = this.initDatabase();
  }

  /**
   * Create FocusTimeSkill for a specific profile
   */
  static forProfile(profile: string = 'default'): FocusTimeSkill {
    return new FocusTimeSkill({ profile });
  }

  /**
   * Initialize database
   */
  private async initDatabase(): Promise<void> {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
    }

    const dbPath = path.join(this.dataDir, 'focus_time.db');

    this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const db = new (sqlite3 as any).Database(dbPath, (err: Error | null) => {
        if (err) reject(err);
        else resolve(db);
      });
    });

    // Create focus_blocks table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS focus_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL DEFAULT 120,
        days_of_week TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        color_id TEXT,
        description TEXT,
        auto_decline INTEGER DEFAULT 0,
        dnd_enabled INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create productivity_sessions table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS productivity_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        focus_block_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        scheduled_start TEXT NOT NULL,
        scheduled_end TEXT NOT NULL,
        actual_start TEXT,
        actual_end TEXT,
        status TEXT DEFAULT 'scheduled',
        interruptions INTEGER DEFAULT 0,
        notes TEXT,
        calendar_event_id TEXT,
        FOREIGN KEY (focus_block_id) REFERENCES focus_blocks(id) ON DELETE CASCADE
      )
    `);

    // Create auto_decline_rules table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS auto_decline_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        focus_block_id INTEGER NOT NULL,
        meeting_title_pattern TEXT,
        meeting_organizer TEXT,
        decline_message TEXT NOT NULL DEFAULT 'I am in focus time. I will respond after my deep work session.',
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (focus_block_id) REFERENCES focus_blocks(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_sessions_date ON productivity_sessions(date)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_sessions_block ON productivity_sessions(focus_block_id)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_rules_block ON auto_decline_rules(focus_block_id)`);
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDb(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Check if connected to calendar
   */
  async isConnected(): Promise<boolean> {
    return await this.calendarSkill.isConnected();
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    connected: boolean;
    email?: string;
    focusBlocks: number;
    activeBlocks: number;
  }> {
    const calendarStatus = await this.calendarSkill.getStatus();
    
    await this.ensureDb();
    if (!this.db) {
      return { connected: calendarStatus.connected, focusBlocks: 0, activeBlocks: 0 };
    }

    const totalBlocks = await get<{ count: number }>(this.db, 
      'SELECT COUNT(*) as count FROM focus_blocks'
    );
    const activeBlocks = await get<{ count: number }>(this.db,
      'SELECT COUNT(*) as count FROM focus_blocks WHERE is_active = 1'
    );

    return {
      connected: calendarStatus.connected,
      email: calendarStatus.email,
      focusBlocks: totalBlocks?.count || 0,
      activeBlocks: activeBlocks?.count || 0,
    };
  }

  /**
   * Create a focus block configuration
   */
  async createFocusBlock(config: Omit<FocusBlockConfig, 'id' | 'createdAt'>): Promise<FocusBlockConfig> {
    await this.ensureDb();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, `
      INSERT INTO focus_blocks 
      (name, duration_minutes, days_of_week, start_time, end_time, color_id, description, auto_decline, dnd_enabled, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      config.name,
      config.durationMinutes,
      JSON.stringify(config.daysOfWeek),
      config.startTime,
      config.endTime,
      config.colorId || null,
      config.description || null,
      config.autoDecline ? 1 : 0,
      config.dndEnabled ? 1 : 0,
      config.isActive ? 1 : 0,
    ]);

    return {
      ...config,
      id: result.lastID,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get focus block by ID
   */
  async getFocusBlock(id: number): Promise<FocusBlockConfig | null> {
    await this.ensureDb();
    if (!this.db) return null;

    const record = await get<FocusBlockRecord>(this.db, 
      'SELECT * FROM focus_blocks WHERE id = ?', 
      [id]
    );

    if (!record) return null;

    return this.recordToFocusBlock(record);
  }

  /**
   * List all focus blocks
   */
  async listFocusBlocks(activeOnly: boolean = false): Promise<FocusBlockConfig[]> {
    await this.ensureDb();
    if (!this.db) return [];

    let sql = 'SELECT * FROM focus_blocks';
    if (activeOnly) {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY start_time';

    const records = await all<FocusBlockRecord>(this.db, sql);
    return records.map(r => this.recordToFocusBlock(r));
  }

  /**
   * Update focus block
   */
  async updateFocusBlock(id: number, updates: Partial<Omit<FocusBlockConfig, 'id' | 'createdAt'>>): Promise<FocusBlockConfig | null> {
    await this.ensureDb();
    if (!this.db) return null;

    const sets: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.durationMinutes !== undefined) { sets.push('duration_minutes = ?'); values.push(updates.durationMinutes); }
    if (updates.daysOfWeek !== undefined) { sets.push('days_of_week = ?'); values.push(JSON.stringify(updates.daysOfWeek)); }
    if (updates.startTime !== undefined) { sets.push('start_time = ?'); values.push(updates.startTime); }
    if (updates.endTime !== undefined) { sets.push('end_time = ?'); values.push(updates.endTime); }
    if (updates.colorId !== undefined) { sets.push('color_id = ?'); values.push(updates.colorId); }
    if (updates.description !== undefined) { sets.push('description = ?'); values.push(updates.description); }
    if (updates.autoDecline !== undefined) { sets.push('auto_decline = ?'); values.push(updates.autoDecline ? 1 : 0); }
    if (updates.dndEnabled !== undefined) { sets.push('dnd_enabled = ?'); values.push(updates.dndEnabled ? 1 : 0); }
    if (updates.isActive !== undefined) { sets.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }

    if (sets.length === 0) return this.getFocusBlock(id);

    values.push(id);
    await run(this.db, `UPDATE focus_blocks SET ${sets.join(', ')} WHERE id = ?`, values);

    return this.getFocusBlock(id);
  }

  /**
   * Delete focus block
   */
  async deleteFocusBlock(id: number): Promise<boolean> {
    await this.ensureDb();
    if (!this.db) return false;

    const result = await runWithResult(this.db, 'DELETE FROM focus_blocks WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * Schedule focus blocks for a date range
   */
  async scheduleFocusBlocks(startDate: Date, endDate: Date): Promise<ProductivitySession[]> {
    await this.ensureDb();
    if (!this.db) throw new Error('Database not initialized');

    const focusBlocks = await this.listFocusBlocks(true);
    const sessions: ProductivitySession[] = [];

    for (const block of focusBlocks) {
      const blockSessions = await this.scheduleBlockForRange(block, startDate, endDate);
      sessions.push(...blockSessions);
    }

    return sessions;
  }

  /**
   * Schedule a single focus block for a date range
   */
  private async scheduleBlockForRange(
    block: FocusBlockConfig, 
    startDate: Date, 
    endDate: Date
  ): Promise<ProductivitySession[]> {
    if (!this.db || !block.id) return [];

    const sessions: ProductivitySession[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      
      if (block.daysOfWeek.includes(dayOfWeek)) {
        const dateStr = current.toISOString().split('T')[0];
        
        // Check if already scheduled
        const existing = await get<ProductivitySessionRecord>(this.db,
          'SELECT * FROM productivity_sessions WHERE focus_block_id = ? AND date = ?',
          [block.id, dateStr]
        );

        if (!existing) {
          const [startHour, startMinute] = block.startTime.split(':').map(Number);
          const [endHour, endMinute] = block.endTime.split(':').map(Number);

          const scheduledStart = new Date(current);
          scheduledStart.setHours(startHour, startMinute, 0, 0);

          const scheduledEnd = new Date(current);
          scheduledEnd.setHours(endHour, endMinute, 0, 0);

          // Create calendar event if connected
          let calendarEventId: string | undefined;
          if (await this.isConnected()) {
            try {
              const event = await this.calendarSkill.createEvent({
                summary: `🎯 Focus Time: ${block.name}`,
                description: block.description || 'Deep work session - Focus time protected',
                start: { dateTime: scheduledStart.toISOString() },
                end: { dateTime: scheduledEnd.toISOString() },
                visibility: block.dndEnabled ? 'private' : 'default',
                reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 5 }] },
                colorId: block.colorId,
              });
              calendarEventId = event.id;
            } catch (e) {
              // Calendar event creation failed, but continue with local session
            }
          }

          const result = await runWithResult(this.db, `
            INSERT INTO productivity_sessions 
            (focus_block_id, date, scheduled_start, scheduled_end, calendar_event_id, status)
            VALUES (?, ?, ?, ?, ?, 'scheduled')
          `, [block.id, dateStr, scheduledStart.toISOString(), scheduledEnd.toISOString(), calendarEventId || null]);

          sessions.push({
            id: result.lastID,
            focusBlockId: block.id,
            date: dateStr,
            scheduledStart: scheduledStart.toISOString(),
            scheduledEnd: scheduledEnd.toISOString(),
            status: 'scheduled',
            calendarEventId,
          });
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return sessions;
  }

  /**
   * Get upcoming focus sessions
   */
  async getUpcomingSessions(days: number = 7): Promise<ProductivitySession[]> {
    await this.ensureDb();
    if (!this.db) return [];

    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    const endDateStr = endDate.toISOString().split('T')[0];

    const records = await all<ProductivitySessionRecord>(this.db, `
      SELECT * FROM productivity_sessions 
      WHERE date >= ? AND date <= ?
      ORDER BY date, scheduled_start
    `, [today, endDateStr]);

    return records.map(r => this.recordToSession(r));
  }

  /**
   * Get today's focus sessions
   */
  async getTodaySessions(): Promise<ProductivitySession[]> {
    await this.ensureDb();
    if (!this.db) return [];

    const today = new Date().toISOString().split('T')[0];

    const records = await all<ProductivitySessionRecord>(this.db, `
      SELECT * FROM productivity_sessions 
      WHERE date = ?
      ORDER BY scheduled_start
    `, [today]);

    return records.map(r => this.recordToSession(r));
  }

  /**
   * Start a focus session
   */
  async startSession(sessionId: number): Promise<ProductivitySession | null> {
    await this.ensureDb();
    if (!this.db) return null;

    await run(this.db, `
      UPDATE productivity_sessions 
      SET actual_start = ?, status = 'scheduled'
      WHERE id = ?
    `, [new Date().toISOString(), sessionId]);

    return this.getSession(sessionId);
  }

  /**
   * Complete a focus session
   */
  async completeSession(sessionId: number, notes?: string): Promise<ProductivitySession | null> {
    await this.ensureDb();
    if (!this.db) return null;

    await run(this.db, `
      UPDATE productivity_sessions 
      SET actual_end = ?, status = 'completed', notes = ?
      WHERE id = ?
    `, [new Date().toISOString(), notes || null, sessionId]);

    return this.getSession(sessionId);
  }

  /**
   * Mark session as interrupted
   */
  async interruptSession(sessionId: number, interruptions: number = 1): Promise<ProductivitySession | null> {
    await this.ensureDb();
    if (!this.db) return null;

    await run(this.db, `
      UPDATE productivity_sessions 
      SET status = 'interrupted', interruptions = COALESCE(interruptions, 0) + ?
      WHERE id = ?
    `, [interruptions, sessionId]);

    return this.getSession(sessionId);
  }

  /**
   * Cancel a focus session
   */
  async cancelSession(sessionId: number): Promise<ProductivitySession | null> {
    await this.ensureDb();
    if (!this.db) return null;

    const session = await this.getSession(sessionId);
    if (session?.calendarEventId) {
      try {
        await this.calendarSkill.deleteEvent(session.calendarEventId);
      } catch (e) {
        // Ignore calendar deletion errors
      }
    }

    await run(this.db, `
      UPDATE productivity_sessions 
      SET status = 'cancelled'
      WHERE id = ?
    `, [sessionId]);

    return this.getSession(sessionId);
  }

  /**
   * Get session by ID
   */
  async getSession(id: number): Promise<ProductivitySession | null> {
    await this.ensureDb();
    if (!this.db) return null;

    const record = await get<ProductivitySessionRecord>(this.db,
      'SELECT * FROM productivity_sessions WHERE id = ?',
      [id]
    );

    if (!record) return null;

    return this.recordToSession(record);
  }

  /**
   * Add auto-decline rule
   */
  async addAutoDeclineRule(rule: Omit<AutoDeclineRule, 'id'>): Promise<AutoDeclineRule> {
    await this.ensureDb();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, `
      INSERT INTO auto_decline_rules 
      (focus_block_id, meeting_title_pattern, meeting_organizer, decline_message, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, [
      rule.focusBlockId,
      rule.meetingTitlePattern || null,
      rule.meetingOrganizer || null,
      rule.declineMessage,
      rule.isActive ? 1 : 0,
    ]);

    return {
      ...rule,
      id: result.lastID,
    };
  }

  /**
   * Get auto-decline rules for a focus block
   */
  async getAutoDeclineRules(focusBlockId: number): Promise<AutoDeclineRule[]> {
    await this.ensureDb();
    if (!this.db) return [];

    const records = await all<AutoDeclineRuleRecord>(this.db, `
      SELECT * FROM auto_decline_rules 
      WHERE focus_block_id = ? AND is_active = 1
    `, [focusBlockId]);

    return records.map(r => ({
      id: r.id,
      focusBlockId: r.focus_block_id,
      meetingTitlePattern: r.meeting_title_pattern,
      meetingOrganizer: r.meeting_organizer,
      declineMessage: r.decline_message,
      isActive: r.is_active === 1,
    }));
  }

  /**
   * Delete auto-decline rule
   */
  async deleteAutoDeclineRule(id: number): Promise<boolean> {
    await this.ensureDb();
    if (!this.db) return false;

    const result = await runWithResult(this.db, 'DELETE FROM auto_decline_rules WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * Generate auto-decline message for a meeting
   */
  async generateDeclineMessage(sessionId: number, meetingTitle: string): Promise<string | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const block = await this.getFocusBlock(session.focusBlockId);
    if (!block || !block.autoDecline) return null;

    const rules = await this.getAutoDeclineRules(session.focusBlockId);
    
    // Find matching rule
    const matchingRule = rules.find(r => {
      if (r.meetingTitlePattern && meetingTitle.toLowerCase().includes(r.meetingTitlePattern.toLowerCase())) {
        return true;
      }
      return false;
    });

    if (matchingRule) {
      return matchingRule.declineMessage;
    }

    // Default message
    return `I'm in a focused deep work session (${block.name}) and will respond after ${new Date(session.scheduledEnd).toLocaleTimeString()}.`;
  }

  /**
   * Get productivity analytics
   */
  async getAnalytics(days: number = 30): Promise<ProductivityAnalytics> {
    await this.ensureDb();
    if (!this.db) {
      return this.emptyAnalytics();
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Overall stats
    const stats = await get<{
      total: number;
      completed: number;
      interrupted: number;
      cancelled: number;
      total_minutes: number;
      total_interruptions: number;
    }>(this.db, `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'interrupted' THEN 1 ELSE 0 END) as interrupted,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE 
          WHEN status = 'completed' AND actual_start IS NOT NULL AND actual_end IS NOT NULL 
          THEN (julianday(actual_end) - julianday(actual_start)) * 24 * 60
          ELSE duration_minutes 
        END) as total_minutes,
        SUM(COALESCE(interruptions, 0)) as total_interruptions
      FROM productivity_sessions ps
      JOIN focus_blocks fb ON ps.focus_block_id = fb.id
      WHERE ps.date >= ?
    `, [startDateStr]);

    // Weekly trend
    const weeklyTrend = await all<{
      week: string;
      sessions: number;
      minutes: number;
      completed: number;
    }>(this.db, `
      SELECT 
        strftime('%Y-W%W', date) as week,
        COUNT(*) as sessions,
        SUM(CASE 
          WHEN status = 'completed' AND actual_start IS NOT NULL AND actual_end IS NOT NULL 
          THEN (julianday(actual_end) - julianday(actual_start)) * 24 * 60
          ELSE duration_minutes 
        END) as minutes,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM productivity_sessions ps
      JOIN focus_blocks fb ON ps.focus_block_id = fb.id
      WHERE ps.date >= ?
      GROUP BY week
      ORDER BY week DESC
      LIMIT 4
    `, [startDateStr]);

    // Daily distribution
    const dailyDistribution = await all<{
      day: string;
      sessions: number;
      minutes: number;
    }>(this.db, `
      SELECT 
        CASE CAST(strftime('%w', date) AS INTEGER)
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END as day,
        COUNT(*) as sessions,
        SUM(CASE 
          WHEN status = 'completed' AND actual_start IS NOT NULL AND actual_end IS NOT NULL 
          THEN (julianday(actual_end) - julianday(actual_start)) * 24 * 60
          ELSE duration_minutes 
        END) as minutes
      FROM productivity_sessions ps
      JOIN focus_blocks fb ON ps.focus_block_id = fb.id
      WHERE ps.date >= ?
      GROUP BY day
      ORDER BY sessions DESC
    `, [startDateStr]);

    const total = stats?.total || 0;
    const completed = stats?.completed || 0;
    const totalMinutes = stats?.total_minutes || 0;

    return {
      totalSessions: total,
      completedSessions: completed,
      interruptedSessions: stats?.interrupted || 0,
      cancelledSessions: stats?.cancelled || 0,
      totalFocusHours: Math.round((totalMinutes / 60) * 100) / 100,
      averageSessionLength: total > 0 ? Math.round((totalMinutes / total) * 10) / 10 : 0,
      completionRate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
      interruptionsPerSession: total > 0 ? Math.round(((stats?.total_interruptions || 0) / total) * 100) / 100 : 0,
      weeklyTrend: weeklyTrend.map(w => ({
        week: w.week,
        sessions: w.sessions,
        hours: Math.round((w.minutes / 60) * 100) / 100,
        completionRate: w.sessions > 0 ? Math.round((w.completed / w.sessions) * 1000) / 10 : 0,
      })),
      dailyDistribution: dailyDistribution.map(d => ({
        day: d.day,
        sessions: d.sessions,
        hours: Math.round((d.minutes / 60) * 100) / 100,
      })),
    };
  }

  /**
   * Empty analytics object
   */
  private emptyAnalytics(): ProductivityAnalytics {
    return {
      totalSessions: 0,
      completedSessions: 0,
      interruptedSessions: 0,
      cancelledSessions: 0,
      totalFocusHours: 0,
      averageSessionLength: 0,
      completionRate: 0,
      interruptionsPerSession: 0,
      weeklyTrend: [],
      dailyDistribution: [],
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message?: string;
    calendarHealth?: { status: 'healthy' | 'unhealthy'; message?: string };
  }> {
    const calendarHealth = await this.calendarSkill.healthCheck();

    await this.ensureDb();
    if (!this.db) {
      return {
        status: 'unhealthy',
        message: 'Database not initialized',
        calendarHealth,
      };
    }

    try {
      await get(this.db, 'SELECT 1');
      return {
        status: 'healthy',
        message: 'Focus time blocks skill is healthy',
        calendarHealth,
      };
    } catch (e) {
      return {
        status: 'unhealthy',
        message: e instanceof Error ? e.message : 'Database error',
        calendarHealth,
      };
    }
  }

  /**
   * Close connections
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
    await this.calendarSkill.close();
  }

  // Helper methods

  private recordToFocusBlock(record: FocusBlockRecord): FocusBlockConfig {
    return {
      id: record.id,
      name: record.name,
      durationMinutes: record.duration_minutes,
      daysOfWeek: JSON.parse(record.days_of_week),
      startTime: record.start_time,
      endTime: record.end_time,
      colorId: record.color_id,
      description: record.description,
      autoDecline: record.auto_decline === 1,
      dndEnabled: record.dnd_enabled === 1,
      isActive: record.is_active === 1,
      createdAt: record.created_at,
    };
  }

  private recordToSession(record: ProductivitySessionRecord): ProductivitySession {
    return {
      id: record.id,
      focusBlockId: record.focus_block_id,
      date: record.date,
      scheduledStart: record.scheduled_start,
      scheduledEnd: record.scheduled_end,
      actualStart: record.actual_start,
      actualEnd: record.actual_end,
      status: record.status,
      interruptions: record.interruptions,
      notes: record.notes,
      calendarEventId: record.calendar_event_id,
    };
  }
}

// Default focus block templates
export const FOCUS_BLOCK_TEMPLATES: Omit<FocusBlockConfig, 'id' | 'createdAt'>[] = [
  {
    name: 'Morning Deep Work',
    durationMinutes: 120,
    daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
    startTime: '09:00',
    endTime: '11:00',
    colorId: '9', // Blue
    description: 'Deep work session - no meetings, no distractions',
    autoDecline: true,
    dndEnabled: true,
    isActive: true,
  },
  {
    name: 'Afternoon Focus',
    durationMinutes: 90,
    daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
    startTime: '14:00',
    endTime: '15:30',
    colorId: '10', // Green
    description: 'Focused work time - minimize interruptions',
    autoDecline: true,
    dndEnabled: true,
    isActive: true,
  },
  {
    name: 'Creative Session',
    durationMinutes: 180,
    daysOfWeek: [2, 4], // Tuesday, Thursday
    startTime: '13:00',
    endTime: '16:00',
    colorId: '6', // Purple
    description: 'Creative work - design, writing, brainstorming',
    autoDecline: true,
    dndEnabled: true,
    isActive: true,
  },
  {
    name: 'Weekend Learning',
    durationMinutes: 120,
    daysOfWeek: [0, 6], // Saturday, Sunday
    startTime: '10:00',
    endTime: '12:00',
    colorId: '5', // Yellow
    description: 'Personal development and learning time',
    autoDecline: false,
    dndEnabled: true,
    isActive: true,
  },
];
