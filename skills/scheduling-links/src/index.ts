/**
 * Scheduling Links Skill
 * Generate Calendly-style booking links with availability windows
 * Built on top of calendar skill for event creation
 */

import * as sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Dynamic import for calendar skill (ES module)
let CalendarSkill: any;

/**
 * Meeting type configuration
 */
export interface MeetingType {
  id?: number;
  slug: string;
  name: string;
  description?: string;
  duration: number; // in minutes
  color?: string;
  isActive: boolean;
  createdAt?: string;
}

/**
 * Meeting type record (snake_case from database)
 */
interface MeetingTypeRecord {
  id?: number;
  slug: string;
  name: string;
  description?: string;
  duration: number;
  color?: string;
  is_active: number;
  created_at?: string;
}

/**
 * Availability window for a meeting type
 */
export interface AvailabilityWindow {
  id?: number;
  meetingTypeId: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
}

/**
 * Availability window record (snake_case from database)
 */
interface AvailabilityWindowRecord {
  id?: number;
  meeting_type_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

/**
 * Booking link configuration
 */
export interface BookingLink {
  id?: number;
  meetingTypeId: number;
  slug: string;
  title: string;
  welcomeMessage?: string;
  confirmationMessage?: string;
  requireEmail: boolean;
  requirePhone: boolean;
  requireNotes: boolean;
  bufferMinutesBefore: number;
  bufferMinutesAfter: number;
  maxAdvanceDays: number;
  minAdvanceHours: number;
  isActive: boolean;
  createdAt?: string;
}

/**
 * Booking link record (snake_case from database)
 */
interface BookingLinkRecord {
  id?: number;
  meeting_type_id: number;
  slug: string;
  title: string;
  welcome_message?: string;
  confirmation_message?: string;
  require_email: number;
  require_phone: number;
  require_notes: number;
  buffer_minutes_before: number;
  buffer_minutes_after: number;
  max_advance_days: number;
  min_advance_hours: number;
  is_active: number;
  created_at?: string;
}

/**
 * Booking record
 */
export interface Booking {
  id?: number;
  bookingLinkId: number;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  startTime: string;
  endTime: string;
  calendarEventId?: string;
  status: 'confirmed' | 'cancelled' | 'no_show';
  createdAt?: string;
}

/**
 * Booking record (snake_case from database)
 */
interface BookingRecord {
  id?: number;
  booking_link_id: number;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  start_time: string;
  end_time: string;
  calendar_event_id?: string;
  status: string;
  created_at?: string;
}

/**
 * Available time slot
 */
export interface AvailableSlot {
  start: string;
  end: string;
}

/**
 * Create meeting type options
 */
export interface CreateMeetingTypeOptions {
  slug: string;
  name: string;
  description?: string;
  duration: number;
  color?: string;
}

/**
 * Create booking link options
 */
export interface CreateBookingLinkOptions {
  meetingTypeSlug: string;
  slug: string;
  title?: string;
  welcomeMessage?: string;
  confirmationMessage?: string;
  requireEmail?: boolean;
  requirePhone?: boolean;
  requireNotes?: boolean;
  bufferMinutesBefore?: number;
  bufferMinutesAfter?: number;
  maxAdvanceDays?: number;
  minAdvanceHours?: number;
}

/**
 * Book appointment options
 */
export interface BookAppointmentOptions {
  linkSlug: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  startTime: string;
}

/**
 * Scheduling Links Skill class
 */
export class SchedulingLinksSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;
  private calendarSkill: any = null;

  constructor() {
    const dataDir = path.join(os.homedir(), '.openclaw', 'skills', 'scheduling-links');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = path.join(dataDir, 'scheduling.db');
  }

  /**
   * Initialize the database
   */
  private async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise(async (resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, async (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          await this.createTables();
          resolve();
        } catch (error) {
          reject(error);
        }
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
      `CREATE TABLE IF NOT EXISTS meeting_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        duration INTEGER NOT NULL,
        color TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS availability_windows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_type_id INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        FOREIGN KEY (meeting_type_id) REFERENCES meeting_types(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS booking_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_type_id INTEGER NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        welcome_message TEXT,
        confirmation_message TEXT,
        require_email INTEGER DEFAULT 1,
        require_phone INTEGER DEFAULT 0,
        require_notes INTEGER DEFAULT 0,
        buffer_minutes_before INTEGER DEFAULT 0,
        buffer_minutes_after INTEGER DEFAULT 0,
        max_advance_days INTEGER DEFAULT 30,
        min_advance_hours INTEGER DEFAULT 24,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (meeting_type_id) REFERENCES meeting_types(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_link_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        notes TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        calendar_event_id TEXT,
        status TEXT DEFAULT 'confirmed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_link_id) REFERENCES booking_links(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_link ON bookings(booking_link_id)`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_time ON bookings(start_time, end_time)`,
      `CREATE INDEX IF NOT EXISTS idx_availability_meeting ON availability_windows(meeting_type_id)`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }
  }

  /**
   * Helper to run SQL with result
   */
  private run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      this.db.run(sql, params, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Helper to run SQL and get result
   */
  private runWithResult(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      this.db.run(sql, params, function(this: any, err: Error | null) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Helper to get a single row
   */
  private get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      this.db.get(sql, params, (err: Error | null, row: T) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Helper to get all rows
   */
  private all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      this.db.all(sql, params, (err: Error | null, rows: T[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Initialize calendar skill
   */
  private async initCalendar(): Promise<any> {
    if (!this.calendarSkill) {
      const calendarModule = await import('@openclaw/calendar');
      CalendarSkill = calendarModule.CalendarSkill;
      this.calendarSkill = new CalendarSkill();
    }
    return this.calendarSkill;
  }

  // ==================== Meeting Types ====================

  /**
   * Create a meeting type
   */
  async createMeetingType(options: CreateMeetingTypeOptions): Promise<MeetingType> {
    await this.init();

    const result = await this.runWithResult(
      `INSERT INTO meeting_types (slug, name, description, duration, color, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [options.slug, options.name, options.description || null, options.duration, options.color || '#4285f4']
    );

    // Create default availability (Monday-Friday 9am-5pm)
    const meetingTypeId = result.lastID;
    for (let day = 1; day <= 5; day++) {
      await this.run(
        `INSERT INTO availability_windows (meeting_type_id, day_of_week, start_time, end_time)
         VALUES (?, ?, ?, ?)`,
        [meetingTypeId, day, '09:00', '17:00']
      );
    }

    return {
      id: meetingTypeId,
      slug: options.slug,
      name: options.name,
      description: options.description,
      duration: options.duration,
      color: options.color || '#4285f4',
      isActive: true
    };
  }

  /**
   * Get all meeting types
   */
  async getMeetingTypes(activeOnly: boolean = false): Promise<MeetingType[]> {
    await this.init();

    let sql = `SELECT * FROM meeting_types`;
    if (activeOnly) {
      sql += ` WHERE is_active = 1`;
    }
    sql += ` ORDER BY name`;

    const records = await this.all<MeetingTypeRecord>(sql);
    return records.map(this.mapMeetingTypeRecord);
  }

  /**
   * Get a meeting type by slug
   */
  async getMeetingTypeBySlug(slug: string): Promise<MeetingType | null> {
    await this.init();

    const record = await this.get<MeetingTypeRecord>(
      `SELECT * FROM meeting_types WHERE slug = ?`,
      [slug]
    );

    return record ? this.mapMeetingTypeRecord(record) : null;
  }

  /**
   * Update a meeting type
   */
  async updateMeetingType(slug: string, updates: Partial<CreateMeetingTypeOptions>): Promise<boolean> {
    await this.init();

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.duration !== undefined) {
      fields.push('duration = ?');
      values.push(updates.duration);
    }
    if (updates.color !== undefined) {
      fields.push('color = ?');
      values.push(updates.color);
    }

    if (fields.length === 0) return false;

    values.push(slug);
    const result = await this.runWithResult(
      `UPDATE meeting_types SET ${fields.join(', ')} WHERE slug = ?`,
      values
    );

    return result.changes > 0;
  }

  /**
   * Set meeting type active status
   */
  async setMeetingTypeActive(slug: string, isActive: boolean): Promise<boolean> {
    await this.init();

    const result = await this.runWithResult(
      `UPDATE meeting_types SET is_active = ? WHERE slug = ?`,
      [isActive ? 1 : 0, slug]
    );

    return result.changes > 0;
  }

  /**
   * Delete a meeting type
   */
  async deleteMeetingType(slug: string): Promise<boolean> {
    await this.init();

    const result = await this.runWithResult(
      `DELETE FROM meeting_types WHERE slug = ?`,
      [slug]
    );

    return result.changes > 0;
  }

  // ==================== Availability Windows ====================

  /**
   * Get availability windows for a meeting type
   */
  async getAvailabilityWindows(meetingTypeSlug: string): Promise<AvailabilityWindow[]> {
    await this.init();

    const records = await this.all<AvailabilityWindowRecord>(
      `SELECT w.* FROM availability_windows w
       JOIN meeting_types m ON w.meeting_type_id = m.id
       WHERE m.slug = ?
       ORDER BY w.day_of_week, w.start_time`,
      [meetingTypeSlug]
    );

    return records.map(this.mapAvailabilityWindowRecord);
  }

  /**
   * Set availability windows for a meeting type
   */
  async setAvailabilityWindows(
    meetingTypeSlug: string,
    windows: { dayOfWeek: number; startTime: string; endTime: string }[]
  ): Promise<boolean> {
    await this.init();

    const meetingType = await this.getMeetingTypeBySlug(meetingTypeSlug);
    if (!meetingType || !meetingType.id) return false;

    // Delete existing windows
    await this.run(
      `DELETE FROM availability_windows WHERE meeting_type_id = ?`,
      [meetingType.id]
    );

    // Insert new windows
    for (const window of windows) {
      await this.run(
        `INSERT INTO availability_windows (meeting_type_id, day_of_week, start_time, end_time)
         VALUES (?, ?, ?, ?)`,
        [meetingType.id, window.dayOfWeek, window.startTime, window.endTime]
      );
    }

    return true;
  }

  // ==================== Booking Links ====================

  /**
   * Create a booking link
   */
  async createBookingLink(options: CreateBookingLinkOptions): Promise<BookingLink> {
    await this.init();

    const meetingType = await this.getMeetingTypeBySlug(options.meetingTypeSlug);
    if (!meetingType || !meetingType.id) {
      throw new Error(`Meeting type not found: ${options.meetingTypeSlug}`);
    }

    const result = await this.runWithResult(
      `INSERT INTO booking_links (
        meeting_type_id, slug, title, welcome_message, confirmation_message,
        require_email, require_phone, require_notes,
        buffer_minutes_before, buffer_minutes_after, max_advance_days, min_advance_hours, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        meetingType.id,
        options.slug,
        options.title || meetingType.name,
        options.welcomeMessage || null,
        options.confirmationMessage || null,
        options.requireEmail !== false ? 1 : 0,
        options.requirePhone ? 1 : 0,
        options.requireNotes ? 1 : 0,
        options.bufferMinutesBefore || 0,
        options.bufferMinutesAfter || 0,
        options.maxAdvanceDays || 30,
        options.minAdvanceHours || 24
      ]
    );

    return {
      id: result.lastID,
      meetingTypeId: meetingType.id,
      slug: options.slug,
      title: options.title || meetingType.name,
      welcomeMessage: options.welcomeMessage,
      confirmationMessage: options.confirmationMessage,
      requireEmail: options.requireEmail !== false,
      requirePhone: options.requirePhone || false,
      requireNotes: options.requireNotes || false,
      bufferMinutesBefore: options.bufferMinutesBefore || 0,
      bufferMinutesAfter: options.bufferMinutesAfter || 0,
      maxAdvanceDays: options.maxAdvanceDays || 30,
      minAdvanceHours: options.minAdvanceHours || 24,
      isActive: true
    };
  }

  /**
   * Get all booking links
   */
  async getBookingLinks(activeOnly: boolean = false): Promise<BookingLink[]> {
    await this.init();

    let sql = `SELECT * FROM booking_links`;
    if (activeOnly) {
      sql += ` WHERE is_active = 1`;
    }
    sql += ` ORDER BY title`;

    const records = await this.all<BookingLinkRecord>(sql);
    return records.map(this.mapBookingLinkRecord);
  }

  /**
   * Get a booking link by slug
   */
  async getBookingLinkBySlug(slug: string): Promise<BookingLink | null> {
    await this.init();

    const record = await this.get<BookingLinkRecord>(
      `SELECT * FROM booking_links WHERE slug = ?`,
      [slug]
    );

    return record ? this.mapBookingLinkRecord(record) : null;
  }

  /**
   * Update a booking link
   */
  async updateBookingLink(slug: string, updates: Partial<CreateBookingLinkOptions>): Promise<boolean> {
    await this.init();

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.welcomeMessage !== undefined) {
      fields.push('welcome_message = ?');
      values.push(updates.welcomeMessage);
    }
    if (updates.confirmationMessage !== undefined) {
      fields.push('confirmation_message = ?');
      values.push(updates.confirmationMessage);
    }
    if (updates.requireEmail !== undefined) {
      fields.push('require_email = ?');
      values.push(updates.requireEmail ? 1 : 0);
    }
    if (updates.requirePhone !== undefined) {
      fields.push('require_phone = ?');
      values.push(updates.requirePhone ? 1 : 0);
    }
    if (updates.requireNotes !== undefined) {
      fields.push('require_notes = ?');
      values.push(updates.requireNotes ? 1 : 0);
    }
    if (updates.bufferMinutesBefore !== undefined) {
      fields.push('buffer_minutes_before = ?');
      values.push(updates.bufferMinutesBefore);
    }
    if (updates.bufferMinutesAfter !== undefined) {
      fields.push('buffer_minutes_after = ?');
      values.push(updates.bufferMinutesAfter);
    }
    if (updates.maxAdvanceDays !== undefined) {
      fields.push('max_advance_days = ?');
      values.push(updates.maxAdvanceDays);
    }
    if (updates.minAdvanceHours !== undefined) {
      fields.push('min_advance_hours = ?');
      values.push(updates.minAdvanceHours);
    }

    if (fields.length === 0) return false;

    values.push(slug);
    const result = await this.runWithResult(
      `UPDATE booking_links SET ${fields.join(', ')} WHERE slug = ?`,
      values
    );

    return result.changes > 0;
  }

  /**
   * Set booking link active status
   */
  async setBookingLinkActive(slug: string, isActive: boolean): Promise<boolean> {
    await this.init();

    const result = await this.runWithResult(
      `UPDATE booking_links SET is_active = ? WHERE slug = ?`,
      [isActive ? 1 : 0, slug]
    );

    return result.changes > 0;
  }

  /**
   * Delete a booking link
   */
  async deleteBookingLink(slug: string): Promise<boolean> {
    await this.init();

    const result = await this.runWithResult(
      `DELETE FROM booking_links WHERE slug = ?`,
      [slug]
    );

    return result.changes > 0;
  }

  // ==================== Available Slots ====================

  /**
   * Get available time slots for a booking link
   */
  async getAvailableSlots(linkSlug: string, date: Date): Promise<AvailableSlot[]> {
    await this.init();

    const link = await this.getBookingLinkBySlug(linkSlug);
    if (!link || !link.isActive) {
      throw new Error(`Booking link not found or inactive: ${linkSlug}`);
    }

    const meetingType = await this.getMeetingTypeById(link.meetingTypeId);
    if (!meetingType) {
      throw new Error('Meeting type not found');
    }

    // Get availability windows for this day of week
    const dayOfWeek = date.getDay();
    const windows = await this.all<AvailabilityWindowRecord>(
      `SELECT * FROM availability_windows WHERE meeting_type_id = ? AND day_of_week = ?`,
      [link.meetingTypeId, dayOfWeek]
    );

    if (windows.length === 0) {
      return []; // No availability on this day
    }

    const slots: AvailableSlot[] = [];
    const dateStr = date.toISOString().split('T')[0];

    // Get existing bookings for this date
    const existingBookings = await this.all<BookingRecord>(
      `SELECT b.* FROM bookings b
       JOIN booking_links l ON b.booking_link_id = l.id
       WHERE l.meeting_type_id = ?
       AND DATE(b.start_time) = ?
       AND b.status = 'confirmed'`,
      [link.meetingTypeId, dateStr]
    );

    // Generate slots from each window
    for (const window of windows) {
      const startTime = this.parseTime(window.start_time);
      const endTime = this.parseTime(window.end_time);

      let currentSlot = new Date(date);
      currentSlot.setHours(startTime.hours, startTime.minutes, 0, 0);

      const windowEnd = new Date(date);
      windowEnd.setHours(endTime.hours, endTime.minutes, 0, 0);

      while (currentSlot.getTime() + meetingType.duration * 60000 <= windowEnd.getTime()) {
        const slotEnd = new Date(currentSlot.getTime() + meetingType.duration * 60000);

        // Check if slot conflicts with existing booking (including buffers)
        const isAvailable = !existingBookings.some(booking => {
          const bookingStart = new Date(booking.start_time);
          const bookingEnd = new Date(booking.end_time);

          // Add buffers
          const bufferStart = new Date(bookingStart.getTime() - (link.bufferMinutesBefore + link.bufferMinutesAfter) * 60000);
          const bufferEnd = new Date(bookingEnd.getTime() + (link.bufferMinutesBefore + link.bufferMinutesAfter) * 60000);

          return currentSlot < bufferEnd && slotEnd > bufferStart;
        });

        if (isAvailable) {
          // Check min/max advance constraints
          const now = new Date();
          const minAdvanceTime = new Date(now.getTime() + link.minAdvanceHours * 3600000);
          const maxAdvanceTime = new Date(now.getTime() + link.maxAdvanceDays * 86400000);

          if (currentSlot >= minAdvanceTime && currentSlot <= maxAdvanceTime) {
            slots.push({
              start: currentSlot.toISOString(),
              end: slotEnd.toISOString()
            });
          }
        }

        currentSlot = slotEnd;
      }
    }

    return slots;
  }

  // ==================== Bookings ====================

  /**
   * Book an appointment
   */
  async bookAppointment(options: BookAppointmentOptions): Promise<Booking> {
    await this.init();

    const link = await this.getBookingLinkBySlug(options.linkSlug);
    if (!link || !link.isActive) {
      throw new Error(`Booking link not found or inactive: ${options.linkSlug}`);
    }

    const meetingType = await this.getMeetingTypeById(link.meetingTypeId);
    if (!meetingType) {
      throw new Error('Meeting type not found');
    }

    // Calculate end time
    const startTime = new Date(options.startTime);
    const endTime = new Date(startTime.getTime() + meetingType.duration * 60000);

    // Verify slot is still available
    const dateStr = startTime.toISOString().split('T')[0];
    const existingBookings = await this.all<BookingRecord>(
      `SELECT * FROM bookings 
       WHERE booking_link_id = ? 
       AND DATE(start_time) = ?
       AND status = 'confirmed'`,
      [link.id, dateStr]
    );

    const hasConflict = existingBookings.some(booking => {
      const bookingStart = new Date(booking.start_time);
      const bookingEnd = new Date(booking.end_time);
      return startTime < bookingEnd && endTime > bookingStart;
    });

    if (hasConflict) {
      throw new Error('This time slot is no longer available');
    }

    // Create calendar event if calendar skill is available
    let calendarEventId: string | undefined;
    try {
      const calendar = await this.initCalendar();
      const isConnected = await calendar.isConnected();
      if (isConnected) {
        const event = await calendar.createEvent({
          summary: `${meetingType.name} - ${options.name}`,
          description: options.notes || `Booked via scheduling link: ${link.slug}`,
          start: { dateTime: startTime.toISOString() },
          end: { dateTime: endTime.toISOString() },
          attendees: options.email ? [{ email: options.email }] : undefined
        });
        calendarEventId = event.id;
      }
    } catch (error) {
      // Continue without calendar event
      console.warn('Failed to create calendar event:', error);
    }

    // Save booking to database
    const result = await this.runWithResult(
      `INSERT INTO bookings (booking_link_id, name, email, phone, notes, start_time, end_time, calendar_event_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
      [
        link.id,
        options.name,
        options.email,
        options.phone || null,
        options.notes || null,
        startTime.toISOString(),
        endTime.toISOString(),
        calendarEventId || null
      ]
    );

    return {
      id: result.lastID,
      bookingLinkId: link.id!,
      name: options.name,
      email: options.email,
      phone: options.phone,
      notes: options.notes,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      calendarEventId,
      status: 'confirmed'
    };
  }

  /**
   * Get bookings for a link
   */
  async getBookings(linkSlug: string, status?: string): Promise<Booking[]> {
    await this.init();

    let sql = `SELECT b.* FROM bookings b
               JOIN booking_links l ON b.booking_link_id = l.id
               WHERE l.slug = ?`;
    const params: any[] = [linkSlug];

    if (status) {
      sql += ` AND b.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY b.start_time DESC`;

    const records = await this.all<BookingRecord>(sql, params);
    return records.map(this.mapBookingRecord);
  }

  /**
   * Get upcoming bookings
   */
  async getUpcomingBookings(): Promise<(Booking & { linkSlug: string; meetingTypeName: string })[]> {
    await this.init();

    const records = await this.all<any>(
      `SELECT b.*, l.slug as link_slug, m.name as meeting_type_name
       FROM bookings b
       JOIN booking_links l ON b.booking_link_id = l.id
       JOIN meeting_types m ON l.meeting_type_id = m.id
       WHERE b.start_time > datetime('now')
       AND b.status = 'confirmed'
       ORDER BY b.start_time ASC`
    );

    return records.map((r: any) => ({
      ...this.mapBookingRecord(r),
      linkSlug: r.link_slug,
      meetingTypeName: r.meeting_type_name
    }));
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: number): Promise<boolean> {
    await this.init();

    const booking = await this.get<BookingRecord>(
      `SELECT * FROM bookings WHERE id = ?`,
      [bookingId]
    );

    if (!booking) return false;

    // Cancel calendar event if exists
    if (booking.calendar_event_id) {
      try {
        const calendar = await this.initCalendar();
        await calendar.deleteEvent(booking.calendar_event_id);
      } catch (error) {
        console.warn('Failed to delete calendar event:', error);
      }
    }

    const result = await this.runWithResult(
      `UPDATE bookings SET status = 'cancelled' WHERE id = ?`,
      [bookingId]
    );

    return result.changes > 0;
  }

  /**
   * Mark booking as no-show
   */
  async markNoShow(bookingId: number): Promise<boolean> {
    await this.init();

    const result = await this.runWithResult(
      `UPDATE bookings SET status = 'no_show' WHERE id = ?`,
      [bookingId]
    );

    return result.changes > 0;
  }

  // ==================== Embeddable Widget ====================

  /**
   * Generate embeddable HTML widget code
   */
  generateWidgetCode(linkSlug: string, options: { width?: string; height?: string; theme?: 'light' | 'dark' } = {}): string {
    const width = options.width || '100%';
    const height = options.height || '600px';
    const theme = options.theme || 'light';

    return `<iframe
  src="https://your-domain.com/book/${linkSlug}?theme=${theme}"
  width="${width}"
  height="${height}"
  frameborder="0"
  style="border: none; min-height: 600px;"
></iframe>`;
  }

  /**
   * Generate booking link URL
   */
  generateBookingUrl(linkSlug: string, baseUrl?: string): string {
    const url = baseUrl || 'https://your-domain.com/book';
    return `${url}/${linkSlug}`;
  }

  // ==================== Health Check ====================

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string; calendarConnected?: boolean }> {
    try {
      await this.init();

      let calendarConnected = false;
      try {
        const calendar = await this.initCalendar();
        calendarConnected = await calendar.isConnected();
      } catch {
        // Calendar not available
      }

      return {
        healthy: true,
        message: `Scheduling links service ready. ${calendarConnected ? 'Calendar integration active.' : 'Calendar integration not connected.'}`,
        calendarConnected
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    meetingTypes: number;
    bookingLinks: number;
    totalBookings: number;
    upcomingBookings: number;
  }> {
    await this.init();

    const meetingTypes = await this.get<{ count: number }>(`SELECT COUNT(*) as count FROM meeting_types`);
    const bookingLinks = await this.get<{ count: number }>(`SELECT COUNT(*) as count FROM booking_links WHERE is_active = 1`);
    const totalBookings = await this.get<{ count: number }>(`SELECT COUNT(*) as count FROM bookings`);
    const upcomingBookings = await this.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM bookings WHERE start_time > datetime('now') AND status = 'confirmed'`
    );

    return {
      meetingTypes: meetingTypes?.count || 0,
      bookingLinks: bookingLinks?.count || 0,
      totalBookings: totalBookings?.count || 0,
      upcomingBookings: upcomingBookings?.count || 0
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.calendarSkill) {
      try {
        await this.calendarSkill.close();
      } catch {
        // Ignore
      }
    }

    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.db = null;
    }
  }

  // ==================== Private Helpers ====================

  async getMeetingTypeById(id: number): Promise<MeetingType | null> {
    const record = await this.get<MeetingTypeRecord>(
      `SELECT * FROM meeting_types WHERE id = ?`,
      [id]
    );
    return record ? this.mapMeetingTypeRecord(record) : null;
  }

  private mapMeetingTypeRecord(record: MeetingTypeRecord): MeetingType {
    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      description: record.description,
      duration: record.duration,
      color: record.color,
      isActive: record.is_active === 1,
      createdAt: record.created_at
    };
  }

  private mapAvailabilityWindowRecord(record: AvailabilityWindowRecord): AvailabilityWindow {
    return {
      id: record.id,
      meetingTypeId: record.meeting_type_id,
      dayOfWeek: record.day_of_week,
      startTime: record.start_time,
      endTime: record.end_time
    };
  }

  private mapBookingLinkRecord(record: BookingLinkRecord): BookingLink {
    return {
      id: record.id,
      meetingTypeId: record.meeting_type_id,
      slug: record.slug,
      title: record.title,
      welcomeMessage: record.welcome_message,
      confirmationMessage: record.confirmation_message,
      requireEmail: record.require_email === 1,
      requirePhone: record.require_phone === 1,
      requireNotes: record.require_notes === 1,
      bufferMinutesBefore: record.buffer_minutes_before,
      bufferMinutesAfter: record.buffer_minutes_after,
      maxAdvanceDays: record.max_advance_days,
      minAdvanceHours: record.min_advance_hours,
      isActive: record.is_active === 1,
      createdAt: record.created_at
    };
  }

  private mapBookingRecord(record: BookingRecord): Booking {
    return {
      id: record.id,
      bookingLinkId: record.booking_link_id,
      name: record.name,
      email: record.email,
      phone: record.phone,
      notes: record.notes,
      startTime: record.start_time,
      endTime: record.end_time,
      calendarEventId: record.calendar_event_id,
      status: record.status as 'confirmed' | 'cancelled' | 'no_show',
      createdAt: record.created_at
    };
  }

  private parseTime(timeStr: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  }
}
