/**
 * Buffer Time Skill
 * Auto-add buffers between meetings for travel time and preparation
 * Built on top of calendar skill
 */

import * as sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Dynamic import for calendar skill (ES module compatibility)
let CalendarSkill: any;
let calendarModule: any;

async function loadCalendarModule() {
  if (!calendarModule) {
    calendarModule = await import('@openclaw/calendar');
    CalendarSkill = calendarModule.CalendarSkill;
  }
  return calendarModule;
}

/**
 * Buffer configuration
 */
export interface BufferConfig {
  id?: number;
  defaultBufferMinutes: number;
  travelTimeEnabled: boolean;
  defaultTravelMinutes: number;
  prepTimeEnabled: boolean;
  sameLocationNoBuffer: boolean;
  minMeetingDurationForBuffer: number; // minutes
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Buffer rule for specific meeting types
 */
export interface BufferRule {
  id?: number;
  name: string;
  keyword: string;
  bufferMinutes: number;
  prepMinutes: number;
  enabled: boolean;
  createdAt?: string;
}

/**
 * Buffer record
 */
export interface Buffer {
  id?: number;
  eventId: string;
  calendarId: string;
  bufferType: 'travel' | 'prep' | 'decompression';
  startTime: string;
  endTime: string;
  description: string;
  autoCreated: boolean;
  createdAt?: string;
}

/**
 * Gap between meetings
 */
export interface MeetingGap {
  previousEvent: {
    id: string;
    summary: string;
    endTime: string;
    location?: string;
  };
  nextEvent: {
    id: string;
    summary: string;
    startTime: string;
    location?: string;
  };
  gapMinutes: number;
  recommendedBuffer: number;
  needsBuffer: boolean;
}

/**
 * Schedule with buffer options
 */
export interface ScheduleWithBufferOptions {
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  bufferMinutes?: number;
  prepMinutes?: number;
  attendees?: Array<{ email: string; displayName?: string; optional?: boolean }>;
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  colorId?: string;
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

// Database record types
interface ConfigRecord {
  id: number;
  default_buffer_minutes: number;
  travel_time_enabled: number;
  default_travel_minutes: number;
  prep_time_enabled: number;
  same_location_no_buffer: number;
  min_meeting_duration_for_buffer: number;
  created_at: string;
  updated_at: string;
}

interface RuleRecord {
  id: number;
  name: string;
  keyword: string;
  buffer_minutes: number;
  prep_minutes: number;
  enabled: number;
  created_at: string;
}

interface BufferRecord {
  id: number;
  event_id: string;
  calendar_id: string;
  buffer_type: string;
  start_time: string;
  end_time: string;
  description: string;
  auto_created: number;
  created_at: string;
}

/**
 * Buffer Time Skill - Auto-add buffers between meetings
 */
export class BufferTimeSkill {
  private profile: string;
  private dataDir: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;
  private calendarSkill: any;

  constructor(profile: string = 'default') {
    this.profile = profile;
    this.dataDir = path.join(os.homedir(), '.openclaw', 'skills', 'buffer-time');
    this.initPromise = this.initDatabase();
  }

  /**
   * Initialize database
   */
  private async initDatabase(): Promise<void> {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
      }

      const dbPath = path.join(this.dataDir, 'buffers.db');
      
      this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
          if (err) reject(err);
          else resolve(db);
        });
      });

      // Create config table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          default_buffer_minutes INTEGER DEFAULT 15,
          travel_time_enabled INTEGER DEFAULT 1,
          default_travel_minutes INTEGER DEFAULT 15,
          prep_time_enabled INTEGER DEFAULT 1,
          same_location_no_buffer INTEGER DEFAULT 1,
          min_meeting_duration_for_buffer INTEGER DEFAULT 30,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert default config if not exists
      await run(this.db, `
        INSERT OR IGNORE INTO config (id) VALUES (1)
      `);

      // Create buffer rules table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS buffer_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          keyword TEXT NOT NULL UNIQUE,
          buffer_minutes INTEGER DEFAULT 15,
          prep_minutes INTEGER DEFAULT 0,
          enabled INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create buffers table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS buffers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT NOT NULL,
          calendar_id TEXT NOT NULL,
          buffer_type TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          description TEXT,
          auto_created INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_buffers_event ON buffers(event_id)
      `);

      // Seed default rules
      await this.seedDefaultRules();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Seed default buffer rules
   */
  private async seedDefaultRules(): Promise<void> {
    if (!this.db) return;

    const defaultRules = [
      { name: 'External Meetings', keyword: 'client', bufferMinutes: 30, prepMinutes: 15 },
      { name: 'Interviews', keyword: 'interview', bufferMinutes: 30, prepMinutes: 15 },
      { name: 'Presentations', keyword: 'presentation', bufferMinutes: 30, prepMinutes: 30 },
      { name: 'Important Calls', keyword: 'call', bufferMinutes: 15, prepMinutes: 5 },
      { name: 'Standup', keyword: 'standup', bufferMinutes: 5, prepMinutes: 0 },
      { name: 'Lunch', keyword: 'lunch', bufferMinutes: 15, prepMinutes: 0 },
    ];

    for (const rule of defaultRules) {
      await run(this.db, `
        INSERT OR IGNORE INTO buffer_rules (name, keyword, buffer_minutes, prep_minutes)
        VALUES (?, ?, ?, ?)
      `, [rule.name, rule.keyword, rule.bufferMinutes, rule.prepMinutes]);
    }
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
   * Initialize calendar skill
   */
  private async getCalendarSkill(): Promise<any> {
    if (!this.calendarSkill) {
      await loadCalendarModule();
      this.calendarSkill = new CalendarSkill({ profile: this.profile });
    }
    return this.calendarSkill;
  }

  /**
   * Get current configuration
   */
  async getConfig(): Promise<BufferConfig> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<ConfigRecord>(this.db, 'SELECT * FROM config WHERE id = 1');
    if (!record) {
      throw new Error('Configuration not found');
    }

    return {
      id: record.id,
      defaultBufferMinutes: record.default_buffer_minutes,
      travelTimeEnabled: record.travel_time_enabled === 1,
      defaultTravelMinutes: record.default_travel_minutes,
      prepTimeEnabled: record.prep_time_enabled === 1,
      sameLocationNoBuffer: record.same_location_no_buffer === 1,
      minMeetingDurationForBuffer: record.min_meeting_duration_for_buffer,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<Omit<BufferConfig, 'id' | 'createdAt' | 'updatedAt'>>): Promise<BufferConfig> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.defaultBufferMinutes !== undefined) {
      fields.push('default_buffer_minutes = ?');
      values.push(updates.defaultBufferMinutes);
    }
    if (updates.travelTimeEnabled !== undefined) {
      fields.push('travel_time_enabled = ?');
      values.push(updates.travelTimeEnabled ? 1 : 0);
    }
    if (updates.defaultTravelMinutes !== undefined) {
      fields.push('default_travel_minutes = ?');
      values.push(updates.defaultTravelMinutes);
    }
    if (updates.prepTimeEnabled !== undefined) {
      fields.push('prep_time_enabled = ?');
      values.push(updates.prepTimeEnabled ? 1 : 0);
    }
    if (updates.sameLocationNoBuffer !== undefined) {
      fields.push('same_location_no_buffer = ?');
      values.push(updates.sameLocationNoBuffer ? 1 : 0);
    }
    if (updates.minMeetingDurationForBuffer !== undefined) {
      fields.push('min_meeting_duration_for_buffer = ?');
      values.push(updates.minMeetingDurationForBuffer);
    }

    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      await run(this.db, `UPDATE config SET ${fields.join(', ')} WHERE id = 1`, values);
    }

    return this.getConfig();
  }

  /**
   * Set default buffer minutes
   */
  async setDefaultBuffer(minutes: number): Promise<BufferConfig> {
    return this.updateConfig({ defaultBufferMinutes: minutes });
  }

  /**
   * Get all buffer rules
   */
  async getBufferRules(): Promise<BufferRule[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<RuleRecord>(this.db, 'SELECT * FROM buffer_rules ORDER BY name');
    return records.map(r => ({
      id: r.id,
      name: r.name,
      keyword: r.keyword,
      bufferMinutes: r.buffer_minutes,
      prepMinutes: r.prep_minutes,
      enabled: r.enabled === 1,
      createdAt: r.created_at,
    }));
  }

  /**
   * Add a buffer rule
   */
  async addBufferRule(rule: Omit<BufferRule, 'id' | 'createdAt'>): Promise<BufferRule> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    await run(this.db, `
      INSERT INTO buffer_rules (name, keyword, buffer_minutes, prep_minutes, enabled)
      VALUES (?, ?, ?, ?, ?)
    `, [rule.name, rule.keyword, rule.bufferMinutes, rule.prepMinutes, rule.enabled ? 1 : 0]);

    const record = await get<RuleRecord>(this.db, 'SELECT * FROM buffer_rules WHERE rowid = last_insert_rowid()');
    return {
      id: record!.id,
      name: record!.name,
      keyword: record!.keyword,
      bufferMinutes: record!.buffer_minutes,
      prepMinutes: record!.prep_minutes,
      enabled: record!.enabled === 1,
      createdAt: record!.created_at,
    };
  }

  /**
   * Delete a buffer rule
   */
  async deleteBufferRule(id: number): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    await run(this.db, 'DELETE FROM buffer_rules WHERE id = ?', [id]);
  }

  /**
   * Calculate buffer minutes for a meeting
   */
  async calculateBufferMinutes(summary: string): Promise<{ buffer: number; prep: number }> {
    const rules = await this.getBufferRules();
    const config = await this.getConfig();

    const lowerSummary = summary.toLowerCase();
    
    // Find matching rule
    const matchingRule = rules
      .filter(r => r.enabled)
      .find(r => lowerSummary.includes(r.keyword.toLowerCase()));

    if (matchingRule) {
      return {
        buffer: matchingRule.bufferMinutes,
        prep: config.prepTimeEnabled ? matchingRule.prepMinutes : 0,
      };
    }

    return {
      buffer: config.defaultBufferMinutes,
      prep: 0,
    };
  }

  /**
   * Calculate travel time between two locations
   */
  calculateTravelTime(fromLocation?: string, toLocation?: string): number {
    if (!fromLocation || !toLocation) return 0;
    
    const from = fromLocation.toLowerCase().trim();
    const to = toLocation.toLowerCase().trim();
    
    // Same location - no travel needed
    if (from === to) return 0;
    
    // Virtual meetings
    if (from.includes('zoom') || from.includes('teams') || from.includes('meet') ||
        to.includes('zoom') || to.includes('teams') || to.includes('meet') ||
        from.includes('virtual') || to.includes('virtual') ||
        from.includes('online') || to.includes('online')) {
      return 0;
    }
    
    // Check for same venue indicators
    const fromWords = from.split(/\s+/);
    const toWords = to.split(/\s+/);
    const commonWords = fromWords.filter(w => toWords.includes(w) && w.length > 2);
    
    if (commonWords.length > 0) {
      return 5; // Minimal buffer for same building/venue
    }

    // Default travel time
    return 15;
  }

  /**
   * Find gaps between meetings that need buffers
   */
  async findMissingBuffers(options: {
    date?: string;
    days?: number;
    calendarId?: string;
  } = {}): Promise<MeetingGap[]> {
    await this.ensureInitialized();
    
    const calendar = await this.getCalendarSkill();
    const config = await this.getConfig();

    // Check calendar connection
    const status = await calendar.getStatus();
    if (!status.connected) {
      throw new Error('Calendar not connected');
    }

    const targetDate = options.date ? new Date(options.date) : new Date();
    const days = options.days || 1;

    const timeMin = new Date(targetDate);
    timeMin.setHours(0, 0, 0, 0);
    
    const timeMax = new Date(timeMin);
    timeMax.setDate(timeMax.getDate() + days);

    const result = await calendar.listEvents({
      calendarId: options.calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = result.events.filter((e: any) => e.status !== 'cancelled');
    const gaps: MeetingGap[] = [];

    for (let i = 0; i < events.length - 1; i++) {
      const current = events[i];
      const next = events[i + 1];

      const currentEnd = new Date(current.end.dateTime || current.end.date || Date.now());
      const nextStart = new Date(next.start.dateTime || next.start.date || Date.now());

      const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60);

      // Calculate needed buffer
      let neededBuffer = await this.calculateBufferMinutes(current.summary);
      let recommendedBuffer = neededBuffer.buffer;

      // Add travel time if locations differ
      if (config.travelTimeEnabled) {
        const travelTime = this.calculateTravelTime(current.location, next.location);
        recommendedBuffer = Math.max(recommendedBuffer, travelTime);
      }

      // Check if same location (skip buffer if configured)
      const sameLocation = current.location && next.location &&
        current.location.toLowerCase().trim() === next.location.toLowerCase().trim();
      
      if (sameLocation && config.sameLocationNoBuffer && recommendedBuffer <= 5) {
        recommendedBuffer = 0;
      }

      gaps.push({
        previousEvent: {
          id: current.id,
          summary: current.summary,
          endTime: currentEnd.toISOString(),
          location: current.location,
        },
        nextEvent: {
          id: next.id,
          summary: next.summary,
          startTime: nextStart.toISOString(),
          location: next.location,
        },
        gapMinutes,
        recommendedBuffer,
        needsBuffer: gapMinutes < recommendedBuffer,
      });
    }

    return gaps;
  }

  /**
   * Schedule a meeting with automatic buffer
   */
  async scheduleWithBuffer(
    options: ScheduleWithBufferOptions,
    calendarId?: string
  ): Promise<{ event: any; buffers: any[] }> {
    await this.ensureInitialized();
    
    const calendar = await this.getCalendarSkill();
    const config = await this.getConfig();

    // Check calendar connection
    const status = await calendar.getStatus();
    if (!status.connected) {
      throw new Error('Calendar not connected');
    }

    // Create the main event
    const event = await calendar.createEvent({
      summary: options.summary,
      description: options.description,
      start: options.start,
      end: options.end,
      location: options.location,
      attendees: options.attendees,
      visibility: options.visibility,
      colorId: options.colorId,
    }, calendarId);

    const buffers: any[] = [];

    // Add prep buffer if enabled and requested
    if (config.prepTimeEnabled && options.prepMinutes && options.prepMinutes > 0) {
      const eventStart = new Date(options.start.dateTime || Date.now());
      const prepStart = new Date(eventStart.getTime() - options.prepMinutes * 60 * 1000);

      try {
        const prepEvent = await calendar.createEvent({
          summary: `Prep: ${options.summary}`,
          description: `Preparation time for: ${options.summary}`,
          start: { dateTime: prepStart.toISOString() },
          end: { dateTime: eventStart.toISOString() },
          visibility: 'private',
          colorId: '2', // Green for prep time
        }, calendarId);

        buffers.push(prepEvent);

        // Store buffer record
        if (this.db) {
          await run(this.db, `
            INSERT INTO buffers (event_id, calendar_id, buffer_type, start_time, end_time, description, auto_created)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [event.id, calendarId || 'primary', 'prep', prepStart.toISOString(), eventStart.toISOString(), `Prep for ${options.summary}`, 1]);
        }
      } catch (e) {
        // Ignore prep buffer errors
      }
    }

    // Check for next event and add travel buffer if needed
    const eventEnd = new Date(options.end.dateTime || Date.now());
    const nextDay = new Date(eventEnd);
    nextDay.setDate(nextDay.getDate() + 1);

    const nextEvents = await calendar.listEvents({
      calendarId,
      timeMin: eventEnd.toISOString(),
      timeMax: nextDay.toISOString(),
      maxResults: 1,
      singleEvents: true,
      orderBy: 'startTime',
    });

    if (nextEvents.events.length > 0) {
      const nextEvent = nextEvents.events[0];
      const nextStart = new Date(nextEvent.start.dateTime || nextEvent.start.date || Date.now());
      const gapMinutes = (nextStart.getTime() - eventEnd.getTime()) / (1000 * 60);

      // Calculate travel time
      let travelMinutes = 0;
      if (config.travelTimeEnabled && options.location && nextEvent.location) {
        travelMinutes = this.calculateTravelTime(options.location, nextEvent.location);
      }

      // Use explicit buffer or calculated travel time
      const bufferMinutes = options.bufferMinutes || travelMinutes;

      if (bufferMinutes > 0 && gapMinutes >= bufferMinutes) {
        try {
          const travelEnd = new Date(eventEnd.getTime() + bufferMinutes * 60 * 1000);
          
          const travelEvent = await calendar.createEvent({
            summary: `Travel: ${options.summary} → ${nextEvent.summary}`,
            description: `Travel buffer from "${options.summary}" to "${nextEvent.summary}"`,
            start: { dateTime: eventEnd.toISOString() },
            end: { dateTime: travelEnd.toISOString() },
            visibility: 'private',
            colorId: '5', // Yellow for travel
          }, calendarId);

          buffers.push(travelEvent);

          // Store buffer record
          if (this.db) {
            await run(this.db, `
              INSERT INTO buffers (event_id, calendar_id, buffer_type, start_time, end_time, description, auto_created)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [event.id, calendarId || 'primary', 'travel', eventEnd.toISOString(), travelEnd.toISOString(), `Travel for ${options.summary}`, 1]);
          }
        } catch (e) {
          // Ignore travel buffer errors
        }
      }
    }

    return { event, buffers };
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalBuffers: number;
    autoCreated: number;
    byType: { travel: number; prep: number; decompression: number };
    rulesCount: number;
  }> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const totalBuffers = await get<{ count: number }>(this.db, 'SELECT COUNT(*) as count FROM buffers');
    const autoCreated = await get<{ count: number }>(this.db, 'SELECT COUNT(*) as count FROM buffers WHERE auto_created = 1');
    
    const travelCount = await get<{ count: number }>(this.db, "SELECT COUNT(*) as count FROM buffers WHERE buffer_type = 'travel'");
    const prepCount = await get<{ count: number }>(this.db, "SELECT COUNT(*) as count FROM buffers WHERE buffer_type = 'prep'");
    const decompCount = await get<{ count: number }>(this.db, "SELECT COUNT(*) as count FROM buffers WHERE buffer_type = 'decompression'");
    
    const rulesCount = await get<{ count: number }>(this.db, 'SELECT COUNT(*) as count FROM buffer_rules');

    return {
      totalBuffers: totalBuffers?.count || 0,
      autoCreated: autoCreated?.count || 0,
      byType: {
        travel: travelCount?.count || 0,
        prep: prepCount?.count || 0,
        decompression: decompCount?.count || 0,
      },
      rulesCount: rulesCount?.count || 0,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message?: string;
    calendarStatus?: any;
  }> {
    await this.ensureInitialized();

    try {
      const calendar = await this.getCalendarSkill();
      const calendarHealth = await calendar.healthCheck();

      if (calendarHealth.status !== 'healthy') {
        return {
          status: 'unhealthy',
          message: 'Calendar connection issue',
          calendarStatus: calendarHealth,
        };
      }

      return {
        status: 'healthy',
        message: 'Buffer time skill operational',
        calendarStatus: calendarHealth,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : String(error),
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

    if (this.calendarSkill) {
      await this.calendarSkill.close();
      this.calendarSkill = null;
    }
  }
}
