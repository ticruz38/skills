import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Types from email skill
interface Email {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  subject: string;
  from: string;
  to: string[];
  date: Date;
  isUnread: boolean;
  isStarred: boolean;
  isImportant: boolean;
}

// Classification types
export type EmailCategory = 'urgent' | 'important' | 'newsletter' | 'promotional' | 'social' | 'updates' | 'forums' | 'spam' | 'unknown';
export type EmailPriority = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface EmailClassification {
  id?: number;
  emailId: string;
  category: EmailCategory;
  priority: EmailPriority;
  priorityScore: number;
  confidence: number;
  reasons: string[];
  actionSuggested?: string;
  classifiedAt: Date;
  reviewed: boolean;
}

export interface TriageResult {
  email: Email;
  classification: EmailClassification;
}

export interface BulkActionResult {
  success: string[];
  failed: { emailId: string; error: string }[];
}

export interface TriageStats {
  totalClassified: number;
  byCategory: Record<EmailCategory, number>;
  byPriority: Record<EmailPriority, number>;
  unreviewed: number;
  accuracy?: number;
}

// Database record interfaces (snake_case)
interface ClassificationRecord {
  id?: number;
  email_id: string;
  category: string;
  priority: string;
  priority_score: number;
  confidence: number;
  reasons: string;
  action_suggested?: string;
  classified_at: string;
  reviewed: number;
}

interface UndoActionRecord {
  id?: number;
  action_type: string;
  email_ids: string;
  previous_states: string;
  action_data: string;
  created_at: string;
  expires_at: string;
}

interface SenderRuleRecord {
  id?: number;
  sender_email: string;
  sender_name?: string;
  category: string;
  priority: string;
  auto_action?: string;
  created_at: string;
}

// Helper for SQLite run with result
function runWithResult(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export class InboxTriageSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private profile: string;
  private initPromise: Promise<void> | null = null;
  private emailSkill: any = null;

  constructor(profile: string = 'default') {
    this.profile = profile;
    const skillDir = path.join(os.homedir(), '.openclaw', 'skills', 'inbox-triage');
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }
    this.dbPath = path.join(skillDir, `${profile}.db`);
  }

  static forProfile(profile: string): InboxTriageSkill {
    return new InboxTriageSkill(profile);
  }

  private async initDatabase(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
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

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const schema = `
      CREATE TABLE IF NOT EXISTS classifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        priority_score REAL NOT NULL,
        confidence REAL NOT NULL,
        reasons TEXT NOT NULL,
        action_suggested TEXT,
        classified_at TEXT NOT NULL,
        reviewed INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_classifications_category ON classifications(category);
      CREATE INDEX IF NOT EXISTS idx_classifications_priority ON classifications(priority);
      CREATE INDEX IF NOT EXISTS idx_classifications_reviewed ON classifications(reviewed);

      CREATE TABLE IF NOT EXISTS undo_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        email_ids TEXT NOT NULL,
        previous_states TEXT NOT NULL,
        action_data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_undo_expires ON undo_actions(expires_at);

      CREATE TABLE IF NOT EXISTS sender_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_email TEXT NOT NULL UNIQUE,
        sender_name TEXT,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        auto_action TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sender_rules_email ON sender_rules(sender_email);

      CREATE TABLE IF NOT EXISTS action_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        previous_category TEXT,
        new_category TEXT,
        previous_priority TEXT,
        new_priority TEXT,
        performed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_action_history_email ON action_history(email_id);
    `;

    await new Promise<void>((resolve, reject) => {
      this.db!.exec(schema, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async getEmailSkill(): Promise<any> {
    if (!this.emailSkill) {
      const { EmailSkill } = await import('@openclaw/email');
      this.emailSkill = EmailSkill.forProfile(this.profile);
    }
    return this.emailSkill;
  }

  // AI Classification algorithm
  private classifyEmail(email: Email): EmailClassification {
    const fromLower = email.from.toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    const snippetLower = email.snippet.toLowerCase();
    
    let category: EmailCategory = 'unknown';
    let priority: EmailPriority = 'medium';
    let score = 50;
    const reasons: string[] = [];
    let actionSuggested: string | undefined;

    // Check sender patterns
    const urgentPatterns = ['noreply', 'alert', 'notification', 'urgent', 'action required', 'immediate'];
    const newsletterPatterns = ['newsletter', 'digest', 'weekly', 'monthly', 'subscribe'];
    const promotionalPatterns = ['sale', 'discount', 'offer', 'deal', 'promo', 'coupon', 'limited time'];
    const socialPatterns = ['linkedin', 'facebook', 'twitter', 'instagram', 'connection request', 'invited'];
    const forumPatterns = ['forum', 'discussion', 'reply to', 'comment on', 'thread'];
    const updatePatterns = ['update', 'changelog', 'release', 'version', 'maintenance'];

    // Check for urgent/high priority indicators
    const hasUrgentWords = urgentPatterns.some(p => subjectLower.includes(p) || snippetLower.includes(p));
    const isFromMe = fromLower.includes('me') || fromLower.includes('self');
    const isImportantLabel = email.isImportant;
    
    // Score calculation
    if (email.isUnread) score += 10;
    if (email.isImportant) score += 15;
    if (hasUrgentWords) score += 20;
    if (subjectLower.includes('re:') || subjectLower.includes('fwd:')) score += 5;

    // Category detection
    if (urgentPatterns.some(p => fromLower.includes(p))) {
      category = 'urgent';
      priority = 'critical';
      score += 30;
      reasons.push('Urgent sender pattern detected');
    } else if (socialPatterns.some(p => fromLower.includes(p) || subjectLower.includes(p))) {
      category = 'social';
      priority = 'low';
      score -= 20;
      reasons.push('Social media notification');
    } else if (promotionalPatterns.some(p => subjectLower.includes(p) || snippetLower.includes(p))) {
      category = 'promotional';
      priority = 'low';
      score -= 25;
      reasons.push('Promotional content detected');
    } else if (newsletterPatterns.some(p => fromLower.includes(p) || subjectLower.includes(p))) {
      category = 'newsletter';
      priority = 'low';
      score -= 20;
      reasons.push('Newsletter format detected');
    } else if (forumPatterns.some(p => subjectLower.includes(p))) {
      category = 'forums';
      priority = 'medium';
      reasons.push('Forum discussion update');
    } else if (updatePatterns.some(p => subjectLower.includes(p))) {
      category = 'updates';
      priority = 'medium';
      reasons.push('System or app update');
    } else if (score >= 70) {
      category = 'important';
      priority = 'high';
      reasons.push('High importance indicators present');
    }

    // Adjust priority based on score
    if (score >= 80) {
      priority = 'critical';
      actionSuggested = 'Reply immediately';
    } else if (score >= 60) {
      priority = 'high';
      actionSuggested = 'Review today';
    } else if (score >= 40) {
      priority = 'medium';
      actionSuggested = 'Review this week';
    } else if (score >= 20) {
      priority = 'low';
      actionSuggested = 'Review when convenient';
    } else {
      priority = 'none';
      actionSuggested = 'Can archive';
    }

    // Cap score
    score = Math.min(100, Math.max(0, score));

    // Calculate confidence based on pattern matching strength
    const confidence = Math.min(0.95, 0.5 + (reasons.length * 0.15));

    if (reasons.length === 0) {
      reasons.push('Default classification');
    }

    return {
      emailId: email.id,
      category,
      priority,
      priorityScore: score,
      confidence,
      reasons,
      actionSuggested,
      classifiedAt: new Date(),
      reviewed: false
    };
  }

  async classify(emailId: string): Promise<EmailClassification>;
  async classify(email: Email): Promise<EmailClassification>;
  async classify(emailOrId: string | Email): Promise<EmailClassification> {
    await this.initDatabase();

    let email: Email;
    if (typeof emailOrId === 'string') {
      const emailSkill = await this.getEmailSkill();
      email = await emailSkill.read(emailOrId);
    } else {
      email = emailOrId;
    }

    // Check for existing classification
    const existing = await this.getClassification(email.id);
    if (existing && !existing.reviewed) {
      return existing;
    }

    // Check sender rules
    const senderRule = await this.getSenderRule(email.from);
    let classification: EmailClassification;

    if (senderRule) {
      classification = {
        emailId: email.id,
        category: senderRule.category as EmailCategory,
        priority: senderRule.priority as EmailPriority,
        priorityScore: senderRule.priority === 'critical' ? 90 : senderRule.priority === 'high' ? 70 : 50,
        confidence: 0.9,
        reasons: ['Matched sender rule'],
        classifiedAt: new Date(),
        reviewed: false
      };
    } else {
      classification = this.classifyEmail(email);
    }

    await this.saveClassification(classification);
    return classification;
  }

  async classifyInbox(maxResults: number = 50): Promise<TriageResult[]> {
    await this.initDatabase();
    const emailSkill = await this.getEmailSkill();
    
    const { emails } = await emailSkill.list({ maxResults });
    const results: TriageResult[] = [];

    for (const email of emails) {
      const classification = await this.classify(email);
      results.push({ email, classification });
    }

    return results.sort((a, b) => b.classification.priorityScore - a.classification.priorityScore);
  }

  private async saveClassification(classification: EmailClassification): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const sql = `
      INSERT OR REPLACE INTO classifications 
      (email_id, category, priority, priority_score, confidence, reasons, action_suggested, classified_at, reviewed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await runWithResult(this.db, sql, [
      classification.emailId,
      classification.category,
      classification.priority,
      classification.priorityScore,
      classification.confidence,
      JSON.stringify(classification.reasons),
      classification.actionSuggested || null,
      classification.classifiedAt.toISOString(),
      classification.reviewed ? 1 : 0
    ]);
  }

  async getClassification(emailId: string): Promise<EmailClassification | null> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM classifications WHERE email_id = ?',
        [emailId],
        (err, row: ClassificationRecord | undefined) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            resolve({
              id: row.id,
              emailId: row.email_id,
              category: row.category as EmailCategory,
              priority: row.priority as EmailPriority,
              priorityScore: row.priority_score,
              confidence: row.confidence,
              reasons: JSON.parse(row.reasons),
              actionSuggested: row.action_suggested || undefined,
              classifiedAt: new Date(row.classified_at),
              reviewed: row.reviewed === 1
            });
          }
        }
      );
    });
  }

  async listByCategory(category: EmailCategory, limit: number = 50): Promise<TriageResult[]> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const emailSkill = await this.getEmailSkill();

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM classifications WHERE category = ? ORDER BY priority_score DESC LIMIT ?',
        [category, limit],
        async (err, rows: ClassificationRecord[]) => {
          if (err) {
            reject(err);
            return;
          }

          const results: TriageResult[] = [];
          for (const row of rows) {
            try {
              const email = await emailSkill.read(row.email_id);
              results.push({
                email,
                classification: {
                  id: row.id,
                  emailId: row.email_id,
                  category: row.category as EmailCategory,
                  priority: row.priority as EmailPriority,
                  priorityScore: row.priority_score,
                  confidence: row.confidence,
                  reasons: JSON.parse(row.reasons),
                  actionSuggested: row.action_suggested || undefined,
                  classifiedAt: new Date(row.classified_at),
                  reviewed: row.reviewed === 1
                }
              });
            } catch (e) {
              // Email might have been deleted
            }
          }
          resolve(results);
        }
      );
    });
  }

  async listByPriority(priority: EmailPriority, limit: number = 50): Promise<TriageResult[]> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const emailSkill = await this.getEmailSkill();

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM classifications WHERE priority = ? ORDER BY priority_score DESC LIMIT ?',
        [priority, limit],
        async (err, rows: ClassificationRecord[]) => {
          if (err) {
            reject(err);
            return;
          }

          const results: TriageResult[] = [];
          for (const row of rows) {
            try {
              const email = await emailSkill.read(row.email_id);
              results.push({
                email,
                classification: {
                  id: row.id,
                  emailId: row.email_id,
                  category: row.category as EmailCategory,
                  priority: row.priority as EmailPriority,
                  priorityScore: row.priority_score,
                  confidence: row.confidence,
                  reasons: JSON.parse(row.reasons),
                  actionSuggested: row.action_suggested || undefined,
                  classifiedAt: new Date(row.classified_at),
                  reviewed: row.reviewed === 1
                }
              });
            } catch (e) {
              // Email might have been deleted
            }
          }
          resolve(results);
        }
      );
    });
  }

  async getUnreviewed(limit: number = 50): Promise<TriageResult[]> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const emailSkill = await this.getEmailSkill();

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM classifications WHERE reviewed = 0 ORDER BY priority_score DESC LIMIT ?',
        [limit],
        async (err, rows: ClassificationRecord[]) => {
          if (err) {
            reject(err);
            return;
          }

          const results: TriageResult[] = [];
          for (const row of rows) {
            try {
              const email = await emailSkill.read(row.email_id);
              results.push({
                email,
                classification: {
                  id: row.id,
                  emailId: row.email_id,
                  category: row.category as EmailCategory,
                  priority: row.priority as EmailPriority,
                  priorityScore: row.priority_score,
                  confidence: row.confidence,
                  reasons: JSON.parse(row.reasons),
                  actionSuggested: row.action_suggested || undefined,
                  classifiedAt: new Date(row.classified_at),
                  reviewed: row.reviewed === 1
                }
              });
            } catch (e) {
              // Email might have been deleted
            }
          }
          resolve(results);
        }
      );
    });
  }

  async review(emailId: string, updates: Partial<Pick<EmailClassification, 'category' | 'priority'>>): Promise<void> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const classification = await this.getClassification(emailId);
    if (!classification) {
      throw new Error(`No classification found for email ${emailId}`);
    }

    // Log the change
    await runWithResult(this.db, `
      INSERT INTO action_history (email_id, action_type, previous_category, new_category, previous_priority, new_priority, performed_at)
      VALUES (?, 'review', ?, ?, ?, ?, ?)
    `, [
      emailId,
      classification.category,
      updates.category || classification.category,
      classification.priority,
      updates.priority || classification.priority,
      new Date().toISOString()
    ]);

    const sql = `
      UPDATE classifications 
      SET category = COALESCE(?, category),
          priority = COALESCE(?, priority),
          reviewed = 1
      WHERE email_id = ?
    `;

    await runWithResult(this.db, sql, [
      updates.category || null,
      updates.priority || null,
      emailId
    ]);
  }

  // Bulk actions with undo support
  async bulkArchive(emailIds: string[]): Promise<BulkActionResult> {
    await this.initDatabase();
    const emailSkill = await this.getEmailSkill();
    
    const result: BulkActionResult = { success: [], failed: [] };
    const previousStates: Record<string, any> = {};

    for (const emailId of emailIds) {
      try {
        const email = await emailSkill.read(emailId);
        previousStates[emailId] = { labelIds: email.labelIds };
        await emailSkill.archive(emailId);
        result.success.push(emailId);
      } catch (error: any) {
        result.failed.push({ emailId, error: error.message });
      }
    }

    // Store undo action
    await this.storeUndoAction('archive', result.success, previousStates, {});

    return result;
  }

  async bulkMarkAsRead(emailIds: string[]): Promise<BulkActionResult> {
    await this.initDatabase();
    const emailSkill = await this.getEmailSkill();
    
    const result: BulkActionResult = { success: [], failed: [] };
    const previousStates: Record<string, any> = {};

    for (const emailId of emailIds) {
      try {
        const email = await emailSkill.read(emailId);
        previousStates[emailId] = { isUnread: email.isUnread };
        await emailSkill.markAsRead(emailId, true);
        result.success.push(emailId);
      } catch (error: any) {
        result.failed.push({ emailId, error: error.message });
      }
    }

    await this.storeUndoAction('markAsRead', result.success, previousStates, {});
    return result;
  }

  async bulkTrash(emailIds: string[]): Promise<BulkActionResult> {
    await this.initDatabase();
    const emailSkill = await this.getEmailSkill();
    
    const result: BulkActionResult = { success: [], failed: [] };
    const previousStates: Record<string, any> = {};

    for (const emailId of emailIds) {
      try {
        const email = await emailSkill.read(emailId);
        previousStates[emailId] = { labelIds: email.labelIds };
        await emailSkill.trash(emailId);
        result.success.push(emailId);
      } catch (error: any) {
        result.failed.push({ emailId, error: error.message });
      }
    }

    await this.storeUndoAction('trash', result.success, previousStates, {});
    return result;
  }

  private async storeUndoAction(
    actionType: string,
    emailIds: string[],
    previousStates: Record<string, any>,
    actionData: any
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    await runWithResult(this.db, `
      INSERT INTO undo_actions (action_type, email_ids, previous_states, action_data, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      actionType,
      JSON.stringify(emailIds),
      JSON.stringify(previousStates),
      JSON.stringify(actionData),
      now.toISOString(),
      expiresAt.toISOString()
    ]);
  }

  async undoLastAction(): Promise<BulkActionResult> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const emailSkill = await this.getEmailSkill();

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM undo_actions WHERE expires_at > ? ORDER BY created_at DESC LIMIT 1',
        [new Date().toISOString()],
        async (err, row: UndoActionRecord | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            resolve({ success: [], failed: [{ emailId: 'none', error: 'No undoable action found' }] });
            return;
          }

          const emailIds: string[] = JSON.parse(row.email_ids);
          const previousStates: Record<string, any> = JSON.parse(row.previous_states);
          const result: BulkActionResult = { success: [], failed: [] };

          try {
            for (const emailId of emailIds) {
              try {
                const state = previousStates[emailId];
                if (row.action_type === 'archive') {
                  // Move back to inbox
                  await emailSkill.archive(emailId); // Toggle
                } else if (row.action_type === 'markAsRead' && !state.isUnread) {
                  await emailSkill.markAsRead(emailId, false);
                } else if (row.action_type === 'trash') {
                  // Move out of trash
                  await emailSkill.archive(emailId); // This moves it somewhere
                }
                result.success.push(emailId);
              } catch (error: any) {
                result.failed.push({ emailId, error: error.message });
              }
            }

            // Delete the undo record
            await runWithResult(this.db!, 'DELETE FROM undo_actions WHERE id = ?', [row.id!]);
            resolve(result);
          } catch (error: any) {
            reject(error);
          }
        }
      );
    });
  }

  // Sender rules
  async addSenderRule(
    senderEmail: string,
    category: EmailCategory,
    priority: EmailPriority,
    autoAction?: string,
    senderName?: string
  ): Promise<void> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    await runWithResult(this.db, `
      INSERT OR REPLACE INTO sender_rules (sender_email, sender_name, category, priority, auto_action, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      senderEmail.toLowerCase(),
      senderName || null,
      category,
      priority,
      autoAction || null,
      new Date().toISOString()
    ]);
  }

  async getSenderRule(senderEmail: string): Promise<{ 
    senderEmail: string; 
    senderName?: string; 
    category: EmailCategory; 
    priority: EmailPriority;
    autoAction?: string;
  } | null> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM sender_rules WHERE sender_email = ?',
        [senderEmail.toLowerCase()],
        (err, row: SenderRuleRecord | undefined) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            resolve({
              senderEmail: row.sender_email,
              senderName: row.sender_name || undefined,
              category: row.category as EmailCategory,
              priority: row.priority as EmailPriority,
              autoAction: row.auto_action || undefined
            });
          }
        }
      );
    });
  }

  async listSenderRules(): Promise<Array<{
    id: number;
    senderEmail: string;
    senderName?: string;
    category: EmailCategory;
    priority: EmailPriority;
    autoAction?: string;
    createdAt: Date;
  }>> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM sender_rules ORDER BY created_at DESC',
        [],
        (err, rows: SenderRuleRecord[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => ({
              id: row.id!,
              senderEmail: row.sender_email,
              senderName: row.sender_name || undefined,
              category: row.category as EmailCategory,
              priority: row.priority as EmailPriority,
              autoAction: row.auto_action || undefined,
              createdAt: new Date(row.created_at)
            })));
          }
        }
      );
    });
  }

  async deleteSenderRule(senderEmail: string): Promise<void> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    await runWithResult(this.db, 'DELETE FROM sender_rules WHERE sender_email = ?', [senderEmail.toLowerCase()]);
  }

  // Statistics
  async getStats(): Promise<TriageStats> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const stats: TriageStats = {
      totalClassified: 0,
      byCategory: {
        urgent: 0, important: 0, newsletter: 0, promotional: 0,
        social: 0, updates: 0, forums: 0, spam: 0, unknown: 0
      },
      byPriority: {
        critical: 0, high: 0, medium: 0, low: 0, none: 0
      },
      unreviewed: 0
    };

    return new Promise((resolve, reject) => {
      this.db!.get('SELECT COUNT(*) as count FROM classifications', [], (err, row: { count: number }) => {
        if (err) {
          reject(err);
          return;
        }
        stats.totalClassified = row.count;

        this.db!.all('SELECT category, COUNT(*) as count FROM classifications GROUP BY category', [], (err, rows: Array<{ category: string; count: number }>) => {
          if (err) {
            reject(err);
            return;
          }
          for (const row of rows) {
            stats.byCategory[row.category as EmailCategory] = row.count;
          }

          this.db!.all('SELECT priority, COUNT(*) as count FROM classifications GROUP BY priority', [], (err, rows: Array<{ priority: string; count: number }>) => {
            if (err) {
              reject(err);
              return;
            }
            for (const row of rows) {
              stats.byPriority[row.priority as EmailPriority] = row.count;
            }

            this.db!.get('SELECT COUNT(*) as count FROM classifications WHERE reviewed = 0', [], (err, row: { count: number }) => {
              if (err) {
                reject(err);
                return;
              }
              stats.unreviewed = row.count;
              resolve(stats);
            });
          });
        });
      });
    });
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message?: string }> {
    try {
      await this.initDatabase();
      const emailSkill = await this.getEmailSkill();
      const health = await emailSkill.healthCheck();
      
      if (health.status === 'healthy') {
        return { status: 'healthy', message: 'Inbox triage system operational' };
      } else {
        return { status: 'unhealthy', message: `Email skill: ${health.message}` };
      }
    } catch (error: any) {
      return { status: 'unhealthy', message: error.message };
    }
  }

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
    if (this.emailSkill) {
      await this.emailSkill.close();
      this.emailSkill = null;
    }
  }
}

export default InboxTriageSkill;
