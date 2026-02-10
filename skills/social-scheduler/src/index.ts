/**
 * Social Scheduler Skill
 * Schedule posts to social platforms with queue management and optimal timing
 */

import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Supported social media platforms
 */
export type SocialPlatform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'youtube' | 'generic';

/**
 * Post status in the workflow
 */
export type PostStatus = 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'published' | 'failed' | 'cancelled';

/**
 * Time slot for optimal posting
 */
export interface OptimalTimeSlot {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  hour: number; // 0-23
  score: number; // 0-100
  description: string;
}

/**
 * Queued post interface
 */
export interface QueuedPost {
  id: number;
  content: string;
  platform: SocialPlatform;
  scheduledAt: string;
  status: PostStatus;
  requiresApproval: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  publishedAt: string | null;
  publishError: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Database record for queued post (snake_case columns)
 */
interface QueuedPostRecord {
  id: number;
  content: string;
  platform: SocialPlatform;
  scheduled_at: string;
  status: PostStatus;
  requires_approval: number;
  approved_at: string | null;
  approved_by: string | null;
  published_at: string | null;
  publish_error: string | null;
  metadata: string;
  created_at: string;
  updated_at: string;
}

/**
 * Options for creating a post
 */
export interface QueuePostOptions {
  content: string;
  platform: SocialPlatform;
  scheduledAt: Date | string;
  requiresApproval?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Options for listing posts
 */
export interface ListPostsOptions {
  status?: PostStatus;
  platform?: SocialPlatform;
  limit?: number;
  offset?: number;
  upcoming?: boolean;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  total: number;
  byStatus: Record<PostStatus, number>;
  byPlatform: Record<SocialPlatform, number>;
  upcoming: number;
  overdue: number;
}

/**
 * Promisified database helpers
 */
function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err: Error | null) => {
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
    db.get(sql, params, (err: Error | null, row: any) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

function all<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

/**
 * Optimal posting times by platform (based on general best practices)
 */
const OPTIMAL_TIMES: Record<SocialPlatform, OptimalTimeSlot[]> = {
  twitter: [
    { dayOfWeek: 1, hour: 9, score: 85, description: 'Tuesday 9 AM - High engagement' },
    { dayOfWeek: 1, hour: 13, score: 80, description: 'Tuesday 1 PM - Lunch break' },
    { dayOfWeek: 2, hour: 9, score: 85, description: 'Wednesday 9 AM - Peak engagement' },
    { dayOfWeek: 2, hour: 15, score: 75, description: 'Wednesday 3 PM - Afternoon boost' },
    { dayOfWeek: 3, hour: 9, score: 85, description: 'Thursday 9 AM - High engagement' },
    { dayOfWeek: 3, hour: 12, score: 78, description: 'Thursday 12 PM - Lunch scroll' },
    { dayOfWeek: 4, hour: 9, score: 80, description: 'Friday 9 AM - End of week' },
  ],
  linkedin: [
    { dayOfWeek: 1, hour: 8, score: 85, description: 'Tuesday 8 AM - Morning commute' },
    { dayOfWeek: 1, hour: 12, score: 80, description: 'Tuesday 12 PM - Lunch break' },
    { dayOfWeek: 1, hour: 17, score: 75, description: 'Tuesday 5 PM - End of workday' },
    { dayOfWeek: 2, hour: 8, score: 85, description: 'Wednesday 8 AM - Peak engagement' },
    { dayOfWeek: 2, hour: 12, score: 82, description: 'Wednesday 12 PM - Best lunch slot' },
    { dayOfWeek: 3, hour: 8, score: 85, description: 'Thursday 8 AM - High engagement' },
    { dayOfWeek: 3, hour: 12, score: 80, description: 'Thursday 12 PM - Lunch break' },
  ],
  facebook: [
    { dayOfWeek: 1, hour: 13, score: 80, description: 'Tuesday 1 PM - Post-lunch engagement' },
    { dayOfWeek: 2, hour: 13, score: 82, description: 'Wednesday 1 PM - Mid-week peak' },
    { dayOfWeek: 3, hour: 13, score: 80, description: 'Thursday 1 PM - High engagement' },
    { dayOfWeek: 4, hour: 13, score: 78, description: 'Friday 1 PM - Pre-weekend' },
    { dayOfWeek: 4, hour: 15, score: 75, description: 'Friday 3 PM - Afternoon wind-down' },
  ],
  instagram: [
    { dayOfWeek: 1, hour: 11, score: 82, description: 'Tuesday 11 AM - Late morning' },
    { dayOfWeek: 1, hour: 14, score: 80, description: 'Tuesday 2 PM - Early afternoon' },
    { dayOfWeek: 2, hour: 11, score: 85, description: 'Wednesday 11 AM - Peak engagement' },
    { dayOfWeek: 2, hour: 14, score: 82, description: 'Wednesday 2 PM - Best afternoon slot' },
    { dayOfWeek: 4, hour: 11, score: 78, description: 'Friday 11 AM - Pre-weekend' },
    { dayOfWeek: 4, hour: 14, score: 76, description: 'Friday 2 PM - Friday vibes' },
  ],
  youtube: [
    { dayOfWeek: 3, hour: 14, score: 85, description: 'Thursday 2 PM - Pre-weekend uploads' },
    { dayOfWeek: 3, hour: 16, score: 80, description: 'Thursday 4 PM - Afternoon slot' },
    { dayOfWeek: 4, hour: 14, score: 82, description: 'Friday 2 PM - Weekend prep' },
    { dayOfWeek: 4, hour: 16, score: 78, description: 'Friday 4 PM - End of week' },
    { dayOfWeek: 5, hour: 10, score: 75, description: 'Saturday 10 AM - Weekend viewing' },
    { dayOfWeek: 6, hour: 10, score: 75, description: 'Sunday 10 AM - Sunday viewing' },
  ],
  generic: [
    { dayOfWeek: 1, hour: 10, score: 80, description: 'Tuesday 10 AM - General best time' },
    { dayOfWeek: 2, hour: 10, score: 82, description: 'Wednesday 10 AM - Mid-week peak' },
    { dayOfWeek: 3, hour: 10, score: 80, description: 'Thursday 10 AM - Good engagement' },
    { dayOfWeek: 1, hour: 14, score: 78, description: 'Tuesday 2 PM - Afternoon slot' },
  ],
};

/**
 * Social Scheduler Skill - Manage social media post scheduling
 */
export class SocialSchedulerSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor(dbPath?: string) {
    const baseDir = path.join(os.homedir(), '.openclaw', 'skills', 'social-scheduler');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    this.dbPath = dbPath || path.join(baseDir, 'scheduler.db');
  }

  /**
   * Initialize the database
   */
  private async initDatabase(): Promise<void> {
    if (this.db) return;

    this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const db = new (sqlite3 as any).Database(this.dbPath, (err: Error | null) => {
        if (err) reject(err);
        else resolve(db);
      });
    });

    // Create posts table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        platform TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        requires_approval INTEGER NOT NULL DEFAULT 0,
        approved_at TEXT,
        approved_by TEXT,
        published_at TEXT,
        publish_error TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform)`);

    // Create approval log table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS approval_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        performed_by TEXT,
        performed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
      )
    `);

    // Create publish log table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS publish_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        platform TEXT NOT NULL,
        published_at TEXT DEFAULT CURRENT_TIMESTAMP,
        success INTEGER NOT NULL,
        error_message TEXT,
        response_data TEXT,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
      )
    `);
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initDatabase();
    }
    await this.initPromise;
  }

  /**
   * Convert database record to interface
   */
  private recordToPost(record: QueuedPostRecord): QueuedPost {
    return {
      id: record.id,
      content: record.content,
      platform: record.platform,
      scheduledAt: record.scheduled_at,
      status: record.status,
      requiresApproval: record.requires_approval === 1,
      approvedAt: record.approved_at,
      approvedBy: record.approved_by,
      publishedAt: record.published_at,
      publishError: record.publish_error,
      metadata: record.metadata ? JSON.parse(record.metadata) : {},
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  /**
   * Parse natural language datetime for scheduling
   */
  parseNaturalDateTime(input: string): Date {
    const now = new Date();
    const inputLower = input.toLowerCase().trim();

    // Handle special keywords
    if (inputLower === 'now') return now;
    if (inputLower === 'today') return now;

    if (inputLower === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    }

    // Handle day names
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayMatch = inputLower.match(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?)?$/);
    if (dayMatch) {
      const targetDay = days.indexOf(dayMatch[1]);
      const currentDay = now.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;

      const date = new Date(now);
      date.setDate(date.getDate() + daysUntil);
      const hour = dayMatch[2] ? parseInt(dayMatch[2]) : 9;
      const minute = dayMatch[3] ? parseInt(dayMatch[3]) : 0;
      date.setHours(hour, minute, 0, 0);
      return date;
    }

    // Handle "in X unit" format
    const inMatch = inputLower.match(/^in\s+(\d+)\s+(hour|hours|minute|minutes|min|mins|day|days|week|weeks)$/);
    if (inMatch) {
      const num = parseInt(inMatch[1], 10);
      const unit = inMatch[2];
      const result = new Date(now);

      if (unit.startsWith('hour')) result.setHours(result.getHours() + num);
      else if (unit.startsWith('min')) result.setMinutes(result.getMinutes() + num);
      else if (unit.startsWith('day')) result.setDate(result.getDate() + num);
      else if (unit.startsWith('week')) result.setDate(result.getDate() + num * 7);
      return result;
    }

    // Handle "in an hour" / "in a minute"
    const inAMatch = inputLower.match(/^in\s+(a|an)\s+(hour|minute|min|day|week)$/);
    if (inAMatch) {
      const unit = inAMatch[2];
      const result = new Date(now);

      if (unit.startsWith('hour')) result.setHours(result.getHours() + 1);
      else if (unit.startsWith('min')) result.setMinutes(result.getMinutes() + 1);
      else if (unit.startsWith('day')) result.setDate(result.getDate() + 1);
      else if (unit.startsWith('week')) result.setDate(result.getDate() + 7);
      return result;
    }

    // Try parsing as ISO date
    const isoDate = new Date(input);
    if (!isNaN(isoDate.getTime())) return isoDate;

    // Try parsing "YYYY-MM-DD HH:MM"
    const dateTimeMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
    if (dateTimeMatch) {
      const [_, year, month, day, hour, minute] = dateTimeMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
      if (!isNaN(date.getTime())) return date;
    }

    // Try parsing "HH:MM" (today at specific time, or tomorrow if passed)
    const timeMatch = input.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const [_, hour, minute] = timeMatch;
      const date = new Date(now);
      date.setHours(parseInt(hour), parseInt(minute), 0, 0);
      if (date < now) date.setDate(date.getDate() + 1);
      return date;
    }

    throw new Error(`Unable to parse datetime: "${input}". Try formats like "2026-02-15 14:00", "tomorrow", "in 2 hours", "tuesday at 9", or "14:30"`);
  }

  /**
   * Queue a new post for scheduling
   */
  async queuePost(options: QueuePostOptions): Promise<QueuedPost> {
    await this.ensureInitialized();

    const scheduledAt = options.scheduledAt instanceof Date
      ? options.scheduledAt.toISOString()
      : options.scheduledAt;

    const requiresApproval = options.requiresApproval ?? false;
    const metadata = options.metadata ? JSON.stringify(options.metadata) : '{}';

    // Determine initial status
    let status: PostStatus = 'scheduled';
    if (requiresApproval) {
      status = 'pending_approval';
    }

    const result = await runWithResult(this.db!,
      `INSERT INTO posts (content, platform, scheduled_at, status, requires_approval, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [options.content, options.platform, scheduledAt, status, requiresApproval ? 1 : 0, metadata]
    );

    const post = await this.getPost(result.lastID);
    if (!post) throw new Error('Failed to create post');

    return post;
  }

  /**
   * Get a post by ID
   */
  async getPost(id: number): Promise<QueuedPost | null> {
    await this.ensureInitialized();

    const record = await get<QueuedPostRecord>(this.db!,
      'SELECT * FROM posts WHERE id = ?',
      [id]
    );

    return record ? this.recordToPost(record) : null;
  }

  /**
   * List posts with optional filtering
   */
  async listPosts(options: ListPostsOptions = {}): Promise<QueuedPost[]> {
    await this.ensureInitialized();

    let sql = 'SELECT * FROM posts WHERE 1=1';
    const params: any[] = [];

    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }

    if (options.platform) {
      sql += ' AND platform = ?';
      params.push(options.platform);
    }

    if (options.upcoming) {
      sql += ' AND scheduled_at >= ? AND status IN (?, ?)';
      params.push(new Date().toISOString(), 'scheduled', 'pending_approval');
    }

    sql += ' ORDER BY scheduled_at ASC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const records = await all<QueuedPostRecord>(this.db!, sql, params);
    return records.map(r => this.recordToPost(r));
  }

  /**
   * Get posts that are due for publishing
   */
  async getDuePosts(): Promise<QueuedPost[]> {
    await this.ensureInitialized();

    const now = new Date().toISOString();

    const records = await all<QueuedPostRecord>(this.db!,
      `SELECT * FROM posts 
       WHERE status = 'scheduled' 
       AND scheduled_at <= ?
       ORDER BY scheduled_at ASC`,
      [now]
    );

    return records.map(r => this.recordToPost(r));
  }

  /**
   * Approve a pending post
   */
  async approvePost(id: number, approvedBy?: string, notes?: string): Promise<QueuedPost> {
    await this.ensureInitialized();

    const post = await this.getPost(id);
    if (!post) throw new Error(`Post ${id} not found`);
    if (post.status !== 'pending_approval') throw new Error(`Post ${id} is not pending approval`);

    const now = new Date().toISOString();

    await run(this.db!,
      `UPDATE posts SET status = 'scheduled', approved_at = ?, approved_by = ?, updated_at = ?
       WHERE id = ?`,
      [now, approvedBy || null, now, id]
    );

    // Log approval
    await run(this.db!,
      `INSERT INTO approval_log (post_id, action, performed_by, notes)
       VALUES (?, ?, ?, ?)`,
      [id, 'approved', approvedBy || null, notes || null]
    );

    const updated = await this.getPost(id);
    if (!updated) throw new Error('Failed to update post');
    return updated;
  }

  /**
   * Reject a pending post
   */
  async rejectPost(id: number, rejectedBy?: string, reason?: string): Promise<QueuedPost> {
    await this.ensureInitialized();

    const post = await this.getPost(id);
    if (!post) throw new Error(`Post ${id} not found`);
    if (post.status !== 'pending_approval') throw new Error(`Post ${id} is not pending approval`);

    const now = new Date().toISOString();

    await run(this.db!,
      `UPDATE posts SET status = 'cancelled', updated_at = ? WHERE id = ?`,
      [now, id]
    );

    // Log rejection
    await run(this.db!,
      `INSERT INTO approval_log (post_id, action, performed_by, notes)
       VALUES (?, ?, ?, ?)`,
      [id, 'rejected', rejectedBy || null, reason || null]
    );

    const updated = await this.getPost(id);
    if (!updated) throw new Error('Failed to update post');
    return updated;
  }

  /**
   * Update a post's content or scheduled time
   */
  async updatePost(id: number, updates: Partial<{ content: string; scheduledAt: Date | string; metadata: Record<string, any> }>): Promise<QueuedPost> {
    await this.ensureInitialized();

    const post = await this.getPost(id);
    if (!post) throw new Error(`Post ${id} not found`);
    if (post.status === 'published') throw new Error(`Cannot update published post ${id}`);

    const sets: string[] = [];
    const params: any[] = [];

    if (updates.content !== undefined) {
      sets.push('content = ?');
      params.push(updates.content);
    }

    if (updates.scheduledAt !== undefined) {
      sets.push('scheduled_at = ?');
      params.push(updates.scheduledAt instanceof Date ? updates.scheduledAt.toISOString() : updates.scheduledAt);
    }

    if (updates.metadata !== undefined) {
      sets.push('metadata = ?');
      params.push(JSON.stringify(updates.metadata));
    }

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await run(this.db!, `UPDATE posts SET ${sets.join(', ')} WHERE id = ?`, params);

    const updated = await this.getPost(id);
    if (!updated) throw new Error('Failed to update post');
    return updated;
  }

  /**
   * Cancel/delete a post
   */
  async cancelPost(id: number): Promise<boolean> {
    await this.ensureInitialized();

    const post = await this.getPost(id);
    if (!post) return false;
    if (post.status === 'published') throw new Error(`Cannot cancel published post ${id}`);

    const result = await runWithResult(this.db!,
      `UPDATE posts SET status = 'cancelled', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), id]
    );

    return result.changes > 0;
  }

  /**
   * Delete a post permanently
   */
  async deletePost(id: number): Promise<boolean> {
    await this.ensureInitialized();

    const result = await runWithResult(this.db!, 'DELETE FROM posts WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * Mark a post as published
   */
  async markPublished(id: number, success: boolean, errorMessage?: string, responseData?: any): Promise<QueuedPost> {
    await this.ensureInitialized();

    const post = await this.getPost(id);
    if (!post) throw new Error(`Post ${id} not found`);

    const now = new Date().toISOString();
    const newStatus: PostStatus = success ? 'published' : 'failed';

    await run(this.db!,
      `UPDATE posts SET status = ?, published_at = ?, publish_error = ?, updated_at = ? WHERE id = ?`,
      [newStatus, now, errorMessage || null, now, id]
    );

    // Log publish attempt
    await run(this.db!,
      `INSERT INTO publish_log (post_id, platform, success, error_message, response_data)
       VALUES (?, ?, ?, ?, ?)`,
      [id, post.platform, success ? 1 : 0, errorMessage || null, responseData ? JSON.stringify(responseData) : null]
    );

    const updated = await this.getPost(id);
    if (!updated) throw new Error('Failed to update post');
    return updated;
  }

  /**
   * Get optimal posting times for a platform
   */
  getOptimalTimes(platform: SocialPlatform): OptimalTimeSlot[] {
    return [...OPTIMAL_TIMES[platform]].sort((a, b) => b.score - a.score);
  }

  /**
   * Get the next optimal time for a platform
   */
  getNextOptimalTime(platform: SocialPlatform): Date {
    const times = this.getOptimalTimes(platform);
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    // Find the next optimal time
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const checkDay = (currentDay + dayOffset) % 7;
      
      for (const slot of times) {
        if (slot.dayOfWeek === checkDay) {
          if (dayOffset === 0 && slot.hour <= currentHour) continue;
          
          const result = new Date(now);
          result.setDate(result.getDate() + dayOffset);
          result.setHours(slot.hour, 0, 0, 0);
          return result;
        }
      }
    }

    // Fallback to tomorrow at 9 AM
    const fallback = new Date(now);
    fallback.setDate(fallback.getDate() + 1);
    fallback.setHours(9, 0, 0, 0);
    return fallback;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    await this.ensureInitialized();

    const now = new Date().toISOString();

    const totalResult = await get<{ count: number }>(this.db!, 'SELECT COUNT(*) as count FROM posts');
    const total = totalResult?.count || 0;

    // By status
    const byStatus: Record<PostStatus, number> = {
      draft: 0, pending_approval: 0, approved: 0, scheduled: 0, published: 0, failed: 0, cancelled: 0
    };

    const statusRows = await all<{ status: PostStatus; count: number }>(this.db!,
      'SELECT status, COUNT(*) as count FROM posts GROUP BY status'
    );
    for (const row of statusRows) {
      byStatus[row.status] = row.count;
    }

    // By platform
    const byPlatform: Record<SocialPlatform, number> = {
      twitter: 0, linkedin: 0, facebook: 0, instagram: 0, youtube: 0, generic: 0
    };

    const platformRows = await all<{ platform: SocialPlatform; count: number }>(this.db!,
      'SELECT platform, COUNT(*) as count FROM posts GROUP BY platform'
    );
    for (const row of platformRows) {
      byPlatform[row.platform] = row.count;
    }

    // Upcoming (scheduled for future)
    const upcomingResult = await get<{ count: number }>(this.db!,
      'SELECT COUNT(*) as count FROM posts WHERE scheduled_at > ? AND status IN (?, ?)',
      [now, 'scheduled', 'pending_approval']
    );

    // Overdue (past scheduled time but not published)
    const overdueResult = await get<{ count: number }>(this.db!,
      'SELECT COUNT(*) as count FROM posts WHERE scheduled_at <= ? AND status = ?',
      [now, 'scheduled']
    );

    return {
      total,
      byStatus,
      byPlatform,
      upcoming: upcomingResult?.count || 0,
      overdue: overdueResult?.count || 0,
    };
  }

  /**
   * Get approval history for a post
   */
  async getApprovalHistory(postId: number): Promise<{
    id: number;
    action: string;
    performedBy: string | null;
    performedAt: string;
    notes: string | null;
  }[]> {
    await this.ensureInitialized();

    const rows = await all<{
      id: number;
      action: string;
      performed_by: string | null;
      performed_at: string;
      notes: string | null;
    }>(this.db!,
      'SELECT * FROM approval_log WHERE post_id = ? ORDER BY performed_at DESC',
      [postId]
    );

    return rows.map(r => ({
      id: r.id,
      action: r.action,
      performedBy: r.performed_by,
      performedAt: r.performed_at,
      notes: r.notes,
    }));
  }

  /**
   * Get publish history for a post
   */
  async getPublishHistory(postId: number): Promise<{
    id: number;
    platform: SocialPlatform;
    publishedAt: string;
    success: boolean;
    errorMessage: string | null;
  }[]> {
    await this.ensureInitialized();

    const rows = await all<{
      id: number;
      platform: SocialPlatform;
      published_at: string;
      success: number;
      error_message: string | null;
    }>(this.db!,
      'SELECT * FROM publish_log WHERE post_id = ? ORDER BY published_at DESC',
      [postId]
    );

    return rows.map(r => ({
      id: r.id,
      platform: r.platform,
      publishedAt: r.published_at,
      success: r.success === 1,
      errorMessage: r.error_message,
    }));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.ensureInitialized();
      const stats = await this.getStats();
      return {
        healthy: true,
        message: `Social Scheduler ready. ${stats.total} posts in queue, ${stats.upcoming} upcoming.`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Error: ${error}`,
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
  }
}

export default SocialSchedulerSkill;
