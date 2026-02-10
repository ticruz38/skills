/**
 * Calendar Skill
 * Google Calendar integration for events and availability
 * Built on top of google-oauth skill
 */

import { GoogleOAuthClient } from '@openclaw/google-oauth';
import * as sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Google Calendar API base URL
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Calendar event attendee
 */
export interface Attendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  optional?: boolean;
}

/**
 * Recurrence rule for recurring events
 */
export interface RecurrenceRule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  count?: number;
  until?: string; // ISO date
  byDay?: string[]; // e.g., ['MO', 'WE', 'FR']
  byMonthDay?: number[];
}

/**
 * Calendar event
 */
export interface CalendarEvent {
  id: string;
  calendarId: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Attendee[];
  organizer?: {
    email: string;
    displayName?: string;
  };
  recurrence?: string[]; // RRULE strings
  recurringEventId?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  created: string;
  updated: string;
  htmlLink: string;
  iCalUID: string;
  colorId?: string;
}

/**
 * Free/busy time slot
 */
export interface TimeSlot {
  start: string;
  end: string;
}

/**
 * Free time finder options
 */
export interface FindFreeTimeOptions {
  timeMin: string;
  timeMax: string;
  duration: number; // in minutes
  timeZone?: string;
  calendars?: string[]; // calendar IDs to check
}

/**
 * Create event options
 */
export interface CreateEventOptions {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    optional?: boolean;
  }>;
  recurrence?: RecurrenceRule[];
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  colorId?: string;
}

/**
 * Update event options
 */
export interface UpdateEventOptions {
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    optional?: boolean;
  }>;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  visibility?: 'default' | 'public' | 'private' | 'confidential';
}

/**
 * List events result
 */
export interface ListEventsResult {
  events: CalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

/**
 * Calendar list entry
 */
export interface CalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  selected?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: string;
  timeZone?: string;
}

/**
 * Calendar skill configuration
 */
export interface CalendarSkillConfig {
  profile?: string;
  cacheDir?: string;
  enableCache?: boolean;
  defaultCalendarId?: string;
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

/**
 * Calendar Skill - Google Calendar integration
 */
export class CalendarSkill {
  private googleClient: GoogleOAuthClient;
  private profile: string;
  private cacheDir: string;
  private enableCache: boolean;
  private defaultCalendarId: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: CalendarSkillConfig = {}) {
    this.profile = config.profile || 'default';
    this.cacheDir = config.cacheDir || path.join(os.homedir(), '.openclaw', 'skills', 'calendar');
    this.enableCache = config.enableCache !== false;
    this.defaultCalendarId = config.defaultCalendarId || 'primary';
    this.googleClient = GoogleOAuthClient.forProfile(this.profile);
    
    if (this.enableCache) {
      this.initPromise = this.initCache();
    }
  }

  /**
   * Create CalendarSkill for a specific profile
   */
  static forProfile(profile: string = 'default'): CalendarSkill {
    return new CalendarSkill({ profile });
  }

  /**
   * Initialize cache directory and database
   */
  private async initCache(): Promise<void> {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true, mode: 0o700 });
      }

      const dbPath = path.join(this.cacheDir, 'cache.db');
      
      this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
          if (err) reject(err);
          else resolve(db);
        });
      });

      // Create tables
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          calendar_id TEXT NOT NULL,
          profile TEXT NOT NULL,
          summary TEXT,
          description TEXT,
          location TEXT,
          start_time TEXT,
          end_time TEXT,
          start_date TEXT,
          end_date TEXT,
          is_all_day INTEGER DEFAULT 0,
          attendees TEXT,
          recurrence TEXT,
          status TEXT,
          visibility TEXT,
          organizer_email TEXT,
          html_link TEXT,
          updated TEXT,
          cached_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);

      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_events_profile ON events(profile)
      `);
      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_events_calendar ON events(calendar_id)
      `);
      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_events_time ON events(start_time, end_time)
      `);

      await run(this.db, `
        CREATE TABLE IF NOT EXISTS calendars (
          id TEXT PRIMARY KEY,
          profile TEXT NOT NULL,
          summary TEXT,
          description TEXT,
          is_primary INTEGER DEFAULT 0,
          selected INTEGER DEFAULT 1,
          background_color TEXT,
          foreground_color TEXT,
          access_role TEXT,
          time_zone TEXT,
          cached_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);

      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_calendars_profile ON calendars(profile)
      `);

      await run(this.db, `
        CREATE TABLE IF NOT EXISTS sync_tokens (
          calendar_id TEXT PRIMARY KEY,
          profile TEXT NOT NULL,
          sync_token TEXT,
          synced_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);
    } catch (error) {
      console.error('Failed to initialize cache:', error);
      this.enableCache = false;
      this.db = null;
    }
  }

  /**
   * Ensure cache is initialized
   */
  private async ensureCache(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Check if Calendar is connected
   */
  async isConnected(): Promise<boolean> {
    const connected = this.googleClient.isConnected();
    if (!connected) return false;
    
    return await this.googleClient.hasService('calendar');
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    connected: boolean;
    email?: string;
    hasCalendarScope?: boolean;
  }> {
    const connected = this.googleClient.isConnected();
    if (!connected) {
      return { connected: false };
    }

    const email = await this.googleClient.getUserEmail();
    const hasCalendarScope = await this.googleClient.hasService('calendar');

    return {
      connected: true,
      email: email || undefined,
      hasCalendarScope,
    };
  }

  /**
   * List user's calendars
   */
  async listCalendars(): Promise<CalendarListEntry[]> {
    await this.ensureConnected();

    const response = await this.googleClient.fetch(
      `${CALENDAR_API_BASE}/users/me/calendarList`
    );

    if (!response.ok) {
      throw new Error(`Failed to list calendars: ${response.statusText}`);
    }

    const data = await response.json() as {
      items?: GoogleCalendarListEntry[];
    };

    const calendars = (data.items || []).map(cal => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      primary: cal.primary,
      selected: cal.selected,
      backgroundColor: cal.backgroundColor,
      foregroundColor: cal.foregroundColor,
      accessRole: cal.accessRole,
      timeZone: cal.timeZone,
    }));

    // Cache the results
    if (this.enableCache && this.db) {
      await this.ensureCache();
      await this.cacheCalendars(calendars);
    }

    return calendars;
  }

  /**
   * List events from a calendar
   */
  async listEvents(options: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    pageToken?: string;
    showDeleted?: boolean;
    singleEvents?: boolean;
    orderBy?: 'startTime' | 'updated';
    query?: string;
  } = {}): Promise<ListEventsResult> {
    await this.ensureConnected();

    const calendarId = options.calendarId || this.defaultCalendarId;
    const params = new URLSearchParams();
    
    params.set('maxResults', String(options.maxResults || 250));
    
    if (options.timeMin) {
      params.set('timeMin', new Date(options.timeMin).toISOString());
    }
    if (options.timeMax) {
      params.set('timeMax', new Date(options.timeMax).toISOString());
    }
    if (options.pageToken) {
      params.set('pageToken', options.pageToken);
    }
    if (options.showDeleted) {
      params.set('showDeleted', 'true');
    }
    if (options.singleEvents) {
      params.set('singleEvents', 'true');
    }
    if (options.orderBy) {
      params.set('orderBy', options.orderBy);
    }
    if (options.query) {
      params.set('q', options.query);
    }

    const response = await this.googleClient.fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Failed to list events: ${response.statusText}`);
    }

    const data = await response.json() as GoogleEventsResponse;

    const events = (data.items || []).map(item => this.parseEvent(item, calendarId));

    // Cache the results
    if (this.enableCache && this.db) {
      await this.ensureCache();
      await this.cacheEvents(events);
    }

    return {
      events,
      nextPageToken: data.nextPageToken,
      nextSyncToken: data.nextSyncToken,
    };
  }

  /**
   * Get a single event
   */
  async getEvent(eventId: string, calendarId?: string): Promise<CalendarEvent> {
    await this.ensureConnected();

    const calId = calendarId || this.defaultCalendarId;

    const response = await this.googleClient.fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get event: ${response.statusText}`);
    }

    const data = await response.json() as GoogleCalendarEvent;
    return this.parseEvent(data, calId);
  }

  /**
   * Create a new event
   */
  async createEvent(options: CreateEventOptions, calendarId?: string): Promise<CalendarEvent> {
    await this.ensureConnected();

    const calId = calendarId || this.defaultCalendarId;

    const eventBody: Record<string, any> = {
      summary: options.summary,
      start: options.start,
      end: options.end,
    };

    if (options.description) {
      eventBody.description = options.description;
    }
    if (options.location) {
      eventBody.location = options.location;
    }
    if (options.attendees) {
      eventBody.attendees = options.attendees.map(a => ({
        email: a.email,
        displayName: a.displayName,
        optional: a.optional,
      }));
    }
    if (options.recurrence) {
      eventBody.recurrence = options.recurrence.map(r => this.buildRRule(r));
    }
    if (options.visibility) {
      eventBody.visibility = options.visibility;
    }
    if (options.reminders) {
      eventBody.reminders = options.reminders;
    }
    if (options.colorId) {
      eventBody.colorId = options.colorId;
    }

    const response = await this.googleClient.fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calId)}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create event: ${error}`);
    }

    const data = await response.json() as GoogleCalendarEvent;
    const event = this.parseEvent(data, calId);

    // Cache the new event
    if (this.enableCache && this.db) {
      await this.ensureCache();
      await this.cacheEvents([event]);
    }

    return event;
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    eventId: string,
    options: UpdateEventOptions,
    calendarId?: string
  ): Promise<CalendarEvent> {
    await this.ensureConnected();

    const calId = calendarId || this.defaultCalendarId;

    const eventBody: Record<string, any> = {};

    if (options.summary !== undefined) {
      eventBody.summary = options.summary;
    }
    if (options.description !== undefined) {
      eventBody.description = options.description;
    }
    if (options.location !== undefined) {
      eventBody.location = options.location;
    }
    if (options.start) {
      eventBody.start = options.start;
    }
    if (options.end) {
      eventBody.end = options.end;
    }
    if (options.attendees) {
      eventBody.attendees = options.attendees.map(a => ({
        email: a.email,
        displayName: a.displayName,
        optional: a.optional,
      }));
    }
    if (options.status) {
      eventBody.status = options.status;
    }
    if (options.visibility) {
      eventBody.visibility = options.visibility;
    }

    const response = await this.googleClient.fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update event: ${error}`);
    }

    const data = await response.json() as GoogleCalendarEvent;
    const event = this.parseEvent(data, calId);

    // Update cache
    if (this.enableCache && this.db) {
      await this.ensureCache();
      await this.cacheEvents([event]);
    }

    return event;
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string, calendarId?: string): Promise<void> {
    await this.ensureConnected();

    const calId = calendarId || this.defaultCalendarId;

    const response = await this.googleClient.fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete event: ${response.statusText}`);
    }

    // Remove from cache
    if (this.enableCache && this.db) {
      await this.ensureCache();
      await run(this.db, `DELETE FROM events WHERE id = ? AND profile = ?`, [eventId, this.profile]);
    }
  }

  /**
   * Find free time slots
   */
  async findFreeTime(options: FindFreeTimeOptions): Promise<TimeSlot[]> {
    await this.ensureConnected();

    const calendars = options.calendars || ['primary'];
    const timeMin = new Date(options.timeMin).toISOString();
    const timeMax = new Date(options.timeMax).toISOString();
    const durationMs = options.duration * 60 * 1000;

    const requestBody = {
      timeMin,
      timeMax,
      timeZone: options.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      items: calendars.map(id => ({ id })),
    };

    const response = await this.googleClient.fetch(
      `${CALENDAR_API_BASE}/freeBusy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to query free/busy: ${response.statusText}`);
    }

    const data = await response.json() as GoogleFreeBusyResponse;

    // Collect all busy periods
    const busyPeriods: TimeSlot[] = [];
    for (const cal of Object.values(data.calendars || {})) {
      for (const busy of cal.busy || []) {
        busyPeriods.push({
          start: busy.start,
          end: busy.end,
        });
      }
    }

    // Sort by start time
    busyPeriods.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    // Merge overlapping busy periods
    const mergedBusy: TimeSlot[] = [];
    for (const period of busyPeriods) {
      if (mergedBusy.length === 0) {
        mergedBusy.push(period);
      } else {
        const last = mergedBusy[mergedBusy.length - 1];
        if (new Date(period.start) <= new Date(last.end)) {
          // Merge
          last.end = new Date(Math.max(
            new Date(last.end).getTime(),
            new Date(period.end).getTime()
          )).toISOString();
        } else {
          mergedBusy.push(period);
        }
      }
    }

    // Find free slots
    const freeSlots: TimeSlot[] = [];
    let currentTime = new Date(timeMin).getTime();
    const endTime = new Date(timeMax).getTime();

    for (const busy of mergedBusy) {
      const busyStart = new Date(busy.start).getTime();
      const busyEnd = new Date(busy.end).getTime();

      if (busyStart - currentTime >= durationMs) {
        freeSlots.push({
          start: new Date(currentTime).toISOString(),
          end: new Date(currentTime + durationMs).toISOString(),
        });
      }

      currentTime = Math.max(currentTime, busyEnd);
    }

    // Check for free time after last busy period
    if (endTime - currentTime >= durationMs) {
      freeSlots.push({
        start: new Date(currentTime).toISOString(),
        end: new Date(currentTime + durationMs).toISOString(),
      });
    }

    return freeSlots;
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(options: {
    calendarId?: string;
    maxResults?: number;
    days?: number;
  } = {}): Promise<CalendarEvent[]> {
    const now = new Date();
    const timeMax = new Date();
    timeMax.setDate(now.getDate() + (options.days || 7));

    const result = await this.listEvents({
      calendarId: options.calendarId,
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: options.maxResults || 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return result.events;
  }

  /**
   * Get events for today
   */
  async getTodayEvents(calendarId?: string): Promise<CalendarEvent[]> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const result = await this.listEvents({
      calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return result.events;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message?: string;
    email?: string;
  }> {
    const status = await this.getStatus();
    
    if (!status.connected) {
      return { status: 'unhealthy', message: 'Not connected to Google' };
    }

    if (!status.hasCalendarScope) {
      return { status: 'unhealthy', message: 'Calendar scope not authorized', email: status.email };
    }

    // Test API call
    try {
      const response = await this.googleClient.fetch(
        `${CALENDAR_API_BASE}/users/me/calendarList?maxResults=1`
      );
      
      if (response.ok) {
        return { status: 'healthy', message: 'Calendar API accessible', email: status.email };
      } else {
        return { status: 'unhealthy', message: `API error: ${response.status}`, email: status.email };
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: error instanceof Error ? error.message : String(error),
        email: status.email,
      };
    }
  }

  // Private helper methods

  private async ensureConnected(): Promise<void> {
    const status = await this.getStatus();
    if (!status.connected) {
      throw new Error('Not connected. Please authenticate with Google first.');
    }
    if (!status.hasCalendarScope) {
      throw new Error('Calendar scope not authorized. Please reconnect with Calendar permissions.');
    }
  }

  private parseEvent(data: GoogleCalendarEvent, calendarId: string): CalendarEvent {
    return {
      id: data.id,
      calendarId,
      summary: data.summary || '(No title)',
      description: data.description,
      location: data.location,
      start: data.start || { dateTime: new Date().toISOString() },
      end: data.end || { dateTime: new Date().toISOString() },
      attendees: data.attendees?.map(a => ({
        email: a.email,
        displayName: a.displayName,
        responseStatus: a.responseStatus,
        optional: a.optional,
      })),
      organizer: data.organizer ? {
        email: data.organizer.email,
        displayName: data.organizer.displayName,
      } : undefined,
      recurrence: data.recurrence,
      recurringEventId: data.recurringEventId,
      status: data.status || 'confirmed',
      visibility: data.visibility,
      created: data.created,
      updated: data.updated,
      htmlLink: data.htmlLink,
      iCalUID: data.iCalUID,
      colorId: data.colorId,
    };
  }

  private buildRRule(rule: RecurrenceRule): string {
    const parts = [`RRULE:FREQ=${rule.frequency}`];
    
    if (rule.interval) {
      parts.push(`INTERVAL=${rule.interval}`);
    }
    if (rule.count) {
      parts.push(`COUNT=${rule.count}`);
    }
    if (rule.until) {
      parts.push(`UNTIL=${rule.until.replace(/[-:]/g, '').split('.')[0]}Z`);
    }
    if (rule.byDay && rule.byDay.length) {
      parts.push(`BYDAY=${rule.byDay.join(',')}`);
    }
    if (rule.byMonthDay && rule.byMonthDay.length) {
      parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
    }
    
    return parts.join(';');
  }

  private async cacheEvents(events: CalendarEvent[]): Promise<void> {
    if (!this.db) return;

    for (const event of events) {
      const isAllDay = !!event.start.date;
      
      await run(this.db, `
        INSERT OR REPLACE INTO events 
        (id, calendar_id, profile, summary, description, location, 
         start_time, end_time, start_date, end_date, is_all_day,
         attendees, recurrence, status, visibility, organizer_email, html_link, updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        event.id,
        event.calendarId,
        this.profile,
        event.summary,
        event.description || null,
        event.location || null,
        event.start.dateTime || null,
        event.end.dateTime || null,
        event.start.date || null,
        event.end.date || null,
        isAllDay ? 1 : 0,
        event.attendees ? JSON.stringify(event.attendees) : null,
        event.recurrence ? JSON.stringify(event.recurrence) : null,
        event.status,
        event.visibility || null,
        event.organizer?.email || null,
        event.htmlLink,
        event.updated,
      ]);
    }
  }

  private async cacheCalendars(calendars: CalendarListEntry[]): Promise<void> {
    if (!this.db) return;

    for (const cal of calendars) {
      await run(this.db, `
        INSERT OR REPLACE INTO calendars 
        (id, profile, summary, description, is_primary, selected, 
         background_color, foreground_color, access_role, time_zone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        cal.id,
        this.profile,
        cal.summary,
        cal.description || null,
        cal.primary ? 1 : 0,
        cal.selected ? 1 : 0,
        cal.backgroundColor || null,
        cal.foregroundColor || null,
        cal.accessRole || null,
        cal.timeZone || null,
      ]);
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
  }
}

// Google Calendar API types
interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
    optional?: boolean;
  }>;
  organizer?: {
    email: string;
    displayName?: string;
  };
  recurrence?: string[];
  recurringEventId?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  created: string;
  updated: string;
  htmlLink: string;
  iCalUID: string;
  colorId?: string;
}

interface GoogleEventsResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  selected?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: string;
  timeZone?: string;
}

interface GoogleFreeBusyResponse {
  calendars?: Record<string, {
    busy?: Array<{ start: string; end: string }>;
    errors?: Array<{ domain: string; reason: string; message: string }>;
  }>;
  timeMin?: string;
  timeMax?: string;
}

// Factory function
export function getCalendarSkill(profile?: string): CalendarSkill {
  return new CalendarSkill({ profile });
}

export default CalendarSkill;
