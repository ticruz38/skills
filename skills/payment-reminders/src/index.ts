/**
 * Payment Reminders Skill
 * Automated payment reminder emails for invoice chasing
 */

import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { InvoicesSkill, Invoice, Client } from '@openclaw/invoices';

// Dynamic import for email skill (ES module compatibility)
async function getEmailSkill(profile?: string) {
  const { EmailSkill } = await import('@openclaw/email');
  return new EmailSkill({ profile });
}

/**
 * Reminder schedule configuration
 */
export interface ReminderSchedule {
  id?: number;
  name: string;
  daysBeforeDue: number[];
  daysAfterDue: number[];
  onDueDate: boolean;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Reminder schedule database record
 */
interface ReminderScheduleRecord {
  id?: number;
  name: string;
  days_before_due: string;
  days_after_due: string;
  on_due_date: number;
  is_default: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Email template for reminders
 */
export interface ReminderTemplate {
  id?: number;
  name: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  stage: 'pre_due' | 'on_due' | 'post_due' | 'final';
  tone: 'friendly' | 'firm' | 'urgent';
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Reminder template database record
 */
interface ReminderTemplateRecord {
  id?: number;
  name: string;
  subject: string;
  body_text: string;
  body_html?: string;
  stage: string;
  tone: string;
  is_default: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Client-specific reminder settings
 */
export interface ClientReminderSettings {
  clientId: number;
  enabled: boolean;
  scheduleId?: number;
  customTemplates?: boolean;
  notes?: string;
  updatedAt?: string;
}

/**
 * Client settings database record
 */
interface ClientSettingsRecord {
  client_id: number;
  enabled: number;
  schedule_id?: number;
  custom_templates: number;
  notes?: string;
  updated_at?: string;
}

/**
 * Reminder history entry
 */
export interface ReminderHistory {
  id?: number;
  invoiceId: number;
  clientId: number;
  stage: string;
  templateId: number;
  subject: string;
  bodyPreview: string;
  sentAt: string;
  sentSuccessfully: boolean;
  errorMessage?: string;
  emailProfile?: string;
}

/**
 * Reminder history database record
 */
interface ReminderHistoryRecord {
  id?: number;
  invoice_id: number;
  client_id: number;
  stage: string;
  template_id: number;
  subject: string;
  body_preview: string;
  sent_at: string;
  sent_successfully: number;
  error_message?: string;
  email_profile?: string;
}

/**
 * Invoice reminder info with due status
 */
export interface InvoiceReminderInfo {
  invoice: Invoice;
  client: Client;
  daysUntilDue: number;
  daysOverdue: number;
  stage: 'upcoming' | 'due_today' | 'overdue' | 'severely_overdue';
  lastReminder?: ReminderHistory;
  remindersSent: number;
}

/**
 * Reminder to be sent
 */
export interface PendingReminder {
  invoice: Invoice;
  client: Client;
  stage: string;
  template: ReminderTemplate;
  daysUntilDue: number;
  daysOverdue: number;
}

/**
 * Payment reminders skill configuration
 */
export interface PaymentRemindersConfig {
  dataDir?: string;
  emailProfile?: string;
  invoicesSkill?: InvoicesSkill;
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
 * Payment Reminders Skill - Automated invoice chasing
 */
export class PaymentRemindersSkill {
  private dataDir: string;
  private emailProfile: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;
  private invoicesSkill: InvoicesSkill;

  constructor(config: PaymentRemindersConfig = {}) {
    this.dataDir = config.dataDir || path.join(os.homedir(), '.openclaw', 'skills', 'payment-reminders');
    this.emailProfile = config.emailProfile || 'default';
    this.invoicesSkill = config.invoicesSkill || new InvoicesSkill();
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

    const dbPath = path.join(this.dataDir, 'reminders.db');
    
    this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const db = new (sqlite3 as any).Database(dbPath, (err: Error | null) => {
        if (err) reject(err);
        else resolve(db);
      });
    });

    // Create tables
    await this.createTables();
    
    // Seed default data
    await this.seedDefaultData();
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Reminder schedules
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS reminder_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        days_before_due TEXT NOT NULL,
        days_after_due TEXT NOT NULL,
        on_due_date INTEGER DEFAULT 1,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Reminder templates
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS reminder_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        body_text TEXT NOT NULL,
        body_html TEXT,
        stage TEXT NOT NULL,
        tone TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Client-specific settings
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS client_settings (
        client_id INTEGER PRIMARY KEY,
        enabled INTEGER DEFAULT 1,
        schedule_id INTEGER,
        custom_templates INTEGER DEFAULT 0,
        notes TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (schedule_id) REFERENCES reminder_schedules(id)
      )
    `);

    // Reminder history
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS reminder_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        client_id INTEGER NOT NULL,
        stage TEXT NOT NULL,
        template_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        body_preview TEXT NOT NULL,
        sent_at TEXT DEFAULT (datetime('now')),
        sent_successfully INTEGER DEFAULT 1,
        error_message TEXT,
        email_profile TEXT,
        FOREIGN KEY (template_id) REFERENCES reminder_templates(id)
      )
    `);

    // Create indexes
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_history_invoice ON reminder_history(invoice_id)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_history_client ON reminder_history(client_id)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_history_sent ON reminder_history(sent_at)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_templates_stage ON reminder_templates(stage)`);
  }

  /**
   * Seed default schedules and templates
   */
  private async seedDefaultData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Check if we already have default schedule
    const existing = await get<{ count: number }>(this.db, 
      'SELECT COUNT(*) as count FROM reminder_schedules'
    );
    
    if (existing && existing.count > 0) return;

    // Default schedule: 7 days before, on due date, 7 days after, 14 days after, 30 days after
    await run(this.db, `
      INSERT INTO reminder_schedules (name, days_before_due, days_after_due, on_due_date, is_default)
      VALUES (?, ?, ?, ?, ?)
    `, ['Standard Schedule', '[7,3]', '[7,14,30]', 1, 1]);

    // Gentle schedule: 3 days before, on due date, 7 days after
    await run(this.db, `
      INSERT INTO reminder_schedules (name, days_before_due, days_after_due, on_due_date, is_default)
      VALUES (?, ?, ?, ?, ?)
    `, ['Gentle Schedule', '[3]', '[7]', 1, 0]);

    // Aggressive schedule: 14, 7, 3 days before, on due date, 3, 7, 14 days after
    await run(this.db, `
      INSERT INTO reminder_schedules (name, days_before_due, days_after_due, on_due_date, is_default)
      VALUES (?, ?, ?, ?, ?)
    `, ['Aggressive Schedule', '[14,7,3]', '[3,7,14,30]', 1, 0]);

    // Seed default templates
    await this.seedDefaultTemplates();
  }

  /**
   * Seed default email templates
   */
  private async seedDefaultTemplates(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const templates: Omit<ReminderTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
      // Pre-due templates
      {
        name: 'Upcoming Payment - Friendly',
        subject: 'Friendly Reminder: Invoice {{invoiceNumber}} Due in {{daysUntilDue}} Days',
        bodyText: `Hi {{clientName}},

I hope this message finds you well. This is a friendly reminder that invoice {{invoiceNumber}} for {{amount}} is due on {{dueDate}} (in {{daysUntilDue}} days).

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Amount Due: {{amount}}
- Due Date: {{dueDate}}

If you have any questions about this invoice, please don't hesitate to reach out.

Thank you for your business!

Best regards,
{{businessName}}`,
        stage: 'pre_due',
        tone: 'friendly',
        isDefault: true,
      },
      {
        name: 'Upcoming Payment - Firm',
        subject: 'Reminder: Invoice {{invoiceNumber}} Due in {{daysUntilDue}} Days',
        bodyText: `Dear {{clientName}},

This is a reminder that invoice {{invoiceNumber}} for {{amount}} is due on {{dueDate}} ({{daysUntilDue}} days from now).

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Amount Due: {{amount}}
- Due Date: {{dueDate}}

Please ensure payment is made by the due date to avoid any late fees.

Regards,
{{businessName}}`,
        stage: 'pre_due',
        tone: 'firm',
        isDefault: false,
      },
      // On due date templates
      {
        name: 'Due Today - Friendly',
        subject: 'Invoice {{invoiceNumber}} is Due Today',
        bodyText: `Hi {{clientName}},

Just a quick note that invoice {{invoiceNumber}} for {{amount}} is due today, {{dueDate}}.

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Amount Due: {{amount}}
- Due Date: {{dueDate}}

If payment has already been sent, please disregard this message. Otherwise, we would appreciate your prompt attention to this matter.

Thank you for your continued business!

Best regards,
{{businessName}}`,
        stage: 'on_due',
        tone: 'friendly',
        isDefault: true,
      },
      {
        name: 'Due Today - Firm',
        subject: 'PAYMENT DUE: Invoice {{invoiceNumber}} - {{amount}}',
        bodyText: `Dear {{clientName}},

This email serves as notification that invoice {{invoiceNumber}} for {{amount}} is due today, {{dueDate}}.

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Amount Due: {{amount}}
- Due Date: Today

Please remit payment immediately to avoid late fees and service interruptions.

Regards,
{{businessName}}`,
        stage: 'on_due',
        tone: 'firm',
        isDefault: false,
      },
      // Post-due templates
      {
        name: 'Overdue - Friendly',
        subject: 'Payment Overdue: Invoice {{invoiceNumber}} ({{daysOverdue}} Days)',
        bodyText: `Hi {{clientName}},

I hope you're doing well. I'm writing to follow up on invoice {{invoiceNumber}} for {{amount}}, which was due on {{dueDate}} ({{daysOverdue}} days ago).

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Amount Due: {{amount}}
- Due Date: {{dueDate}}
- Days Overdue: {{daysOverdue}}

If there are any issues or concerns regarding this payment, please let us know so we can work together to resolve them.

Thank you for your attention to this matter.

Best regards,
{{businessName}}`,
        stage: 'post_due',
        tone: 'friendly',
        isDefault: true,
      },
      {
        name: 'Overdue - Firm',
        subject: 'OVERDUE: Invoice {{invoiceNumber}} - {{amount}} ({{daysOverdue}} Days Overdue)',
        bodyText: `Dear {{clientName}},

This is a payment reminder for invoice {{invoiceNumber}} for {{amount}}, which was due on {{dueDate}} and is now {{daysOverdue}} days overdue.

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Amount Due: {{amount}}
- Due Date: {{dueDate}}
- Days Overdue: {{daysOverdue}}

Please remit payment immediately to avoid additional late fees and potential collection actions.

Regards,
{{businessName}}`,
        stage: 'post_due',
        tone: 'firm',
        isDefault: false,
      },
      // Final notice templates
      {
        name: 'Final Notice - Urgent',
        subject: 'URGENT: Final Notice - Invoice {{invoiceNumber}} ({{daysOverdue}} Days Overdue)',
        bodyText: `Dear {{clientName}},

This is a FINAL NOTICE regarding invoice {{invoiceNumber}} for {{amount}}, which is now {{daysOverdue}} days overdue.

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Amount Due: {{amount}}
- Due Date: {{dueDate}}
- Days Overdue: {{daysOverdue}}

Immediate payment is required to avoid this account being forwarded to collections and potentially affecting your credit rating.

Please contact us immediately if you wish to discuss payment arrangements.

Regards,
{{businessName}}`,
        stage: 'final',
        tone: 'urgent',
        isDefault: true,
      },
    ];

    for (const template of templates) {
      await run(this.db, `
        INSERT INTO reminder_templates (name, subject, body_text, stage, tone, is_default)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [template.name, template.subject, template.bodyText, template.stage, template.tone, template.isDefault ? 1 : 0]);
    }
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
   * Get all reminder schedules
   */
  async getSchedules(): Promise<ReminderSchedule[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<ReminderScheduleRecord>(this.db, 
      'SELECT * FROM reminder_schedules ORDER BY is_default DESC, name'
    );

    return records.map(r => ({
      id: r.id,
      name: r.name,
      daysBeforeDue: JSON.parse(r.days_before_due),
      daysAfterDue: JSON.parse(r.days_after_due),
      onDueDate: r.on_due_date === 1,
      isDefault: r.is_default === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Get default schedule
   */
  async getDefaultSchedule(): Promise<ReminderSchedule | null> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<ReminderScheduleRecord>(this.db, 
      'SELECT * FROM reminder_schedules WHERE is_default = 1 LIMIT 1'
    );

    if (!record) return null;

    return {
      id: record.id,
      name: record.name,
      daysBeforeDue: JSON.parse(record.days_before_due),
      daysAfterDue: JSON.parse(record.days_after_due),
      onDueDate: record.on_due_date === 1,
      isDefault: record.is_default === 1,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  /**
   * Create a new reminder schedule
   */
  async createSchedule(schedule: Omit<ReminderSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReminderSchedule> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, `
      INSERT INTO reminder_schedules (name, days_before_due, days_after_due, on_due_date, is_default)
      VALUES (?, ?, ?, ?, ?)
    `, [
      schedule.name,
      JSON.stringify(schedule.daysBeforeDue),
      JSON.stringify(schedule.daysAfterDue),
      schedule.onDueDate ? 1 : 0,
      schedule.isDefault ? 1 : 0,
    ]);

    // If this is set as default, unset others
    if (schedule.isDefault) {
      await run(this.db, 
        'UPDATE reminder_schedules SET is_default = 0 WHERE id != ?', 
        [result.lastID]
      );
    }

    const newSchedule = await get<ReminderScheduleRecord>(this.db, 
      'SELECT * FROM reminder_schedules WHERE id = ?', 
      [result.lastID]
    );

    if (!newSchedule) throw new Error('Failed to create schedule');

    return {
      id: newSchedule.id,
      name: newSchedule.name,
      daysBeforeDue: JSON.parse(newSchedule.days_before_due),
      daysAfterDue: JSON.parse(newSchedule.days_after_due),
      onDueDate: newSchedule.on_due_date === 1,
      isDefault: newSchedule.is_default === 1,
      createdAt: newSchedule.created_at,
      updatedAt: newSchedule.updated_at,
    };
  }

  /**
   * Get all reminder templates
   */
  async getTemplates(options: { stage?: string; tone?: string } = {}): Promise<ReminderTemplate[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM reminder_templates WHERE 1=1';
    const params: any[] = [];

    if (options.stage) {
      sql += ' AND stage = ?';
      params.push(options.stage);
    }
    if (options.tone) {
      sql += ' AND tone = ?';
      params.push(options.tone);
    }

    sql += ' ORDER BY stage, is_default DESC, name';

    const records = await all<ReminderTemplateRecord>(this.db, sql, params);

    return records.map(r => ({
      id: r.id,
      name: r.name,
      subject: r.subject,
      bodyText: r.body_text,
      bodyHtml: r.body_html,
      stage: r.stage as ReminderTemplate['stage'],
      tone: r.tone as ReminderTemplate['tone'],
      isDefault: r.is_default === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: number): Promise<ReminderTemplate | null> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<ReminderTemplateRecord>(this.db, 
      'SELECT * FROM reminder_templates WHERE id = ?', 
      [id]
    );

    if (!record) return null;

    return {
      id: record.id,
      name: record.name,
      subject: record.subject,
      bodyText: record.body_text,
      bodyHtml: record.body_html,
      stage: record.stage as ReminderTemplate['stage'],
      tone: record.tone as ReminderTemplate['tone'],
      isDefault: record.is_default === 1,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  /**
   * Create a new template
   */
  async createTemplate(template: Omit<ReminderTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReminderTemplate> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, `
      INSERT INTO reminder_templates (name, subject, body_text, body_html, stage, tone, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      template.name,
      template.subject,
      template.bodyText,
      template.bodyHtml || null,
      template.stage,
      template.tone,
      template.isDefault ? 1 : 0,
    ]);

    // If this is set as default for this stage, unset others
    if (template.isDefault) {
      await run(this.db, 
        'UPDATE reminder_templates SET is_default = 0 WHERE stage = ? AND id != ?', 
        [template.stage, result.lastID]
      );
    }

    const newTemplate = await get<ReminderTemplateRecord>(this.db, 
      'SELECT * FROM reminder_templates WHERE id = ?', 
      [result.lastID]
    );

    if (!newTemplate) throw new Error('Failed to create template');

    return {
      id: newTemplate.id,
      name: newTemplate.name,
      subject: newTemplate.subject,
      bodyText: newTemplate.body_text,
      bodyHtml: newTemplate.body_html,
      stage: newTemplate.stage as ReminderTemplate['stage'],
      tone: newTemplate.tone as ReminderTemplate['tone'],
      isDefault: newTemplate.is_default === 1,
      createdAt: newTemplate.created_at,
      updatedAt: newTemplate.updated_at,
    };
  }

  /**
   * Get client reminder settings
   */
  async getClientSettings(clientId: number): Promise<ClientReminderSettings | null> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<ClientSettingsRecord>(this.db, 
      'SELECT * FROM client_settings WHERE client_id = ?', 
      [clientId]
    );

    if (!record) return null;

    return {
      clientId: record.client_id,
      enabled: record.enabled === 1,
      scheduleId: record.schedule_id,
      customTemplates: record.custom_templates === 1,
      notes: record.notes,
      updatedAt: record.updated_at,
    };
  }

  /**
   * Set client reminder settings
   */
  async setClientSettings(settings: ClientReminderSettings): Promise<void> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    await run(this.db, `
      INSERT OR REPLACE INTO client_settings 
      (client_id, enabled, schedule_id, custom_templates, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `, [
      settings.clientId,
      settings.enabled ? 1 : 0,
      settings.scheduleId || null,
      settings.customTemplates ? 1 : 0,
      settings.notes || null,
    ]);
  }

  /**
   * Get reminder history for an invoice
   */
  async getInvoiceReminderHistory(invoiceId: number): Promise<ReminderHistory[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<ReminderHistoryRecord>(this.db, 
      'SELECT * FROM reminder_history WHERE invoice_id = ? ORDER BY sent_at DESC',
      [invoiceId]
    );

    return records.map(r => ({
      id: r.id,
      invoiceId: r.invoice_id,
      clientId: r.client_id,
      stage: r.stage,
      templateId: r.template_id,
      subject: r.subject,
      bodyPreview: r.body_preview,
      sentAt: r.sent_at,
      sentSuccessfully: r.sent_successfully === 1,
      errorMessage: r.error_message,
      emailProfile: r.email_profile,
    }));
  }

  /**
   * Get all pending reminders
   */
  async getPendingReminders(): Promise<PendingReminder[]> {
    await this.ensureDatabase();
    
    // Get all sent/pending invoices
    const invoices = await this.invoicesSkill.listInvoices({ status: 'sent' });
    const overdue = await this.invoicesSkill.getOverdueInvoices();
    
    const allInvoices = [...invoices, ...overdue];
    const pending: PendingReminder[] = [];

    for (const invoice of allInvoices) {
      if (!invoice.clientId) continue;

      // Get client settings
      const clientSettings = await this.getClientSettings(invoice.clientId);
      
      // Skip if reminders disabled for this client
      if (clientSettings && !clientSettings.enabled) continue;

      // Get client info
      const client = await this.invoicesSkill.getClient(invoice.clientId);
      if (!client || !client.email) continue;

      // Calculate days
      const dueDate = new Date(invoice.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - today.getTime();
      const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const daysOverdue = daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;

      // Get schedule
      const scheduleId = clientSettings?.scheduleId;
      let schedule: ReminderSchedule | null = null;
      
      if (scheduleId) {
        const schedules = await this.getSchedules();
        schedule = schedules.find(s => s.id === scheduleId) || null;
      }
      
      if (!schedule) {
        schedule = await this.getDefaultSchedule();
      }

      if (!schedule) continue;

      // Check if we should send a reminder today
      let shouldRemind = false;
      let stage: ReminderTemplate['stage'] = 'pre_due';

      if (daysUntilDue > 0) {
        // Pre-due
        shouldRemind = schedule.daysBeforeDue.includes(daysUntilDue);
        stage = 'pre_due';
      } else if (daysUntilDue === 0) {
        // Due today
        shouldRemind = schedule.onDueDate;
        stage = 'on_due';
      } else {
        // Overdue
        shouldRemind = schedule.daysAfterDue.includes(daysOverdue);
        stage = daysOverdue >= 30 ? 'final' : 'post_due';
      }

      if (!shouldRemind) continue;

      // Check if we already sent a reminder for this stage today
      const history = await this.getInvoiceReminderHistory(invoice.id!);
      const lastReminder = history[0];
      
      // Don't send duplicate reminders for the same stage on the same day
      if (lastReminder && lastReminder.stage === stage) {
        const lastSent = new Date(lastReminder.sentAt);
        const today = new Date();
        if (lastSent.toDateString() === today.toDateString()) {
          continue;
        }
      }

      // Get appropriate template
      const templates = await this.getTemplates({ stage });
      const template = templates.find(t => t.isDefault) || templates[0];

      if (!template) continue;

      pending.push({
        invoice,
        client,
        stage,
        template,
        daysUntilDue,
        daysOverdue,
      });
    }

    return pending;
  }

  /**
   * Process template with variables
   */
  private processTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  /**
   * Send a payment reminder
   */
  async sendReminder(
    pending: PendingReminder,
    options: { templateOverride?: ReminderTemplate; dryRun?: boolean } = {}
  ): Promise<{ success: boolean; historyId?: number; error?: string }> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const { invoice, client, stage, daysUntilDue, daysOverdue } = pending;
    const template = options.templateOverride || pending.template;

    // Get business config
    const config = await this.invoicesSkill.getConfig();

    // Build variables
    const variables: Record<string, string> = {
      clientName: client.name || '',
      invoiceNumber: invoice.invoiceNumber,
      amount: `$${invoice.balanceDue.toFixed(2)}`,
      dueDate: new Date(invoice.dueDate).toLocaleDateString(),
      daysUntilDue: String(daysUntilDue),
      daysOverdue: String(daysOverdue),
      businessName: config.name,
      businessEmail: config.email || '',
      businessPhone: config.phone || '',
    };

    // Process subject and body
    const subject = this.processTemplate(template.subject, variables);
    const bodyText = this.processTemplate(template.bodyText, variables);
    const bodyHtml = template.bodyHtml ? this.processTemplate(template.bodyHtml, variables) : undefined;

    if (options.dryRun) {
      return { success: true };
    }

    // Send email
    try {
      const emailSkill = await getEmailSkill(this.emailProfile);
      
      await emailSkill.send({
        to: client.email!,
        subject,
        bodyText,
        bodyHtml,
      });

      await emailSkill.close();

      // Record in history
      const result = await runWithResult(this.db, `
        INSERT INTO reminder_history 
        (invoice_id, client_id, stage, template_id, subject, body_preview, sent_successfully, email_profile)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoice.id,
        client.id,
        stage,
        template.id,
        subject,
        bodyText.substring(0, 200) + (bodyText.length > 200 ? '...' : ''),
        1,
        this.emailProfile,
      ]);

      return { success: true, historyId: result.lastID };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Record failed attempt
      const result = await runWithResult(this.db, `
        INSERT INTO reminder_history 
        (invoice_id, client_id, stage, template_id, subject, body_preview, sent_successfully, error_message, email_profile)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoice.id,
        client.id,
        stage,
        template.id,
        subject,
        bodyText.substring(0, 200) + (bodyText.length > 200 ? '...' : ''),
        0,
        errorMessage,
        this.emailProfile,
      ]);

      return { success: false, historyId: result.lastID, error: errorMessage };
    }
  }

  /**
   * Send all pending reminders
   */
  async sendAllPending(options: { dryRun?: boolean } = {}): Promise<{
    total: number;
    sent: number;
    failed: number;
    results: Array<{ invoiceNumber: string; success: boolean; error?: string }>;
  }> {
    const pending = await this.getPendingReminders();
    const results: Array<{ invoiceNumber: string; success: boolean; error?: string }> = [];
    let sent = 0;
    let failed = 0;

    for (const reminder of pending) {
      const result = await this.sendReminder(reminder, { dryRun: options.dryRun });
      
      results.push({
        invoiceNumber: reminder.invoice.invoiceNumber,
        success: result.success,
        error: result.error,
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { total: pending.length, sent, failed, results };
  }

  /**
   * Preview reminder for an invoice
   */
  async previewReminder(invoiceId: number, stage?: ReminderTemplate['stage']): Promise<{
    invoice: Invoice;
    client: Client;
    template: ReminderTemplate;
    subject: string;
    bodyText: string;
    bodyHtml?: string;
  } | null> {
    await this.ensureDatabase();

    const invoice = await this.invoicesSkill.getInvoice(invoiceId);
    if (!invoice || !invoice.clientId) return null;

    const client = await this.invoicesSkill.getClient(invoice.clientId);
    if (!client) return null;

    // Calculate days
    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const daysOverdue = daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;

    // Determine stage if not provided
    if (!stage) {
      if (daysUntilDue > 0) stage = 'pre_due';
      else if (daysUntilDue === 0) stage = 'on_due';
      else if (daysOverdue >= 30) stage = 'final';
      else stage = 'post_due';
    }

    // Get template
    const templates = await this.getTemplates({ stage });
    const template = templates.find(t => t.isDefault) || templates[0];

    if (!template) return null;

    // Get business config
    const config = await this.invoicesSkill.getConfig();

    // Build variables
    const variables: Record<string, string> = {
      clientName: client.name || '',
      invoiceNumber: invoice.invoiceNumber,
      amount: `$${invoice.balanceDue.toFixed(2)}`,
      dueDate: new Date(invoice.dueDate).toLocaleDateString(),
      daysUntilDue: String(daysUntilDue),
      daysOverdue: String(daysOverdue),
      businessName: config.name,
      businessEmail: config.email || '',
      businessPhone: config.phone || '',
    };

    // Process template
    const subject = this.processTemplate(template.subject, variables);
    const bodyText = this.processTemplate(template.bodyText, variables);
    const bodyHtml = template.bodyHtml ? this.processTemplate(template.bodyHtml, variables) : undefined;

    return {
      invoice,
      client,
      template,
      subject,
      bodyText,
      bodyHtml,
    };
  }

  /**
   * Get reminder statistics
   */
  async getStats(): Promise<{
    totalRemindersSent: number;
    successfulReminders: number;
    failedReminders: number;
    byStage: Record<string, number>;
    recentActivity: ReminderHistory[];
  }> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const totalResult = await get<{ count: number }>(this.db, 
      'SELECT COUNT(*) as count FROM reminder_history'
    );
    
    const successResult = await get<{ count: number }>(this.db, 
      'SELECT COUNT(*) as count FROM reminder_history WHERE sent_successfully = 1'
    );
    
    const failedResult = await get<{ count: number }>(this.db, 
      'SELECT COUNT(*) as count FROM reminder_history WHERE sent_successfully = 0'
    );

    const byStageRows = await all<{ stage: string; count: number }>(this.db, 
      'SELECT stage, COUNT(*) as count FROM reminder_history GROUP BY stage'
    );

    const byStage: Record<string, number> = {};
    for (const row of byStageRows) {
      byStage[row.stage] = row.count;
    }

    const recentRecords = await all<ReminderHistoryRecord>(this.db, 
      'SELECT * FROM reminder_history ORDER BY sent_at DESC LIMIT 10'
    );

    return {
      totalRemindersSent: totalResult?.count || 0,
      successfulReminders: successResult?.count || 0,
      failedReminders: failedResult?.count || 0,
      byStage,
      recentActivity: recentRecords.map(r => ({
        id: r.id,
        invoiceId: r.invoice_id,
        clientId: r.client_id,
        stage: r.stage,
        templateId: r.template_id,
        subject: r.subject,
        bodyPreview: r.body_preview,
        sentAt: r.sent_at,
        sentSuccessfully: r.sent_successfully === 1,
        errorMessage: r.error_message,
        emailProfile: r.email_profile,
      })),
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    emailStatus?: { connected: boolean; email?: string };
    invoicesStatus?: { status: 'healthy' | 'unhealthy'; message: string };
  }> {
    try {
      await this.ensureDatabase();
      if (!this.db) {
        return { status: 'unhealthy', message: 'Database not initialized' };
      }

      // Test database
      await get(this.db, 'SELECT 1');

      // Check invoices skill
      const invoicesHealth = await this.invoicesSkill.healthCheck();

      // Check email skill
      const emailSkill = await getEmailSkill(this.emailProfile);
      const emailStatus = await emailSkill.getStatus();
      await emailSkill.close();

      if (!emailStatus.connected) {
        return {
          status: 'unhealthy',
          message: 'Email skill not connected',
          invoicesStatus: invoicesHealth,
          emailStatus: { connected: false },
        };
      }

      return {
        status: 'healthy',
        message: 'Payment reminders skill is ready',
        invoicesStatus: invoicesHealth,
        emailStatus: { connected: true, email: emailStatus.email },
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

    // Close invoices skill
    await this.invoicesSkill.close();
  }
}

/**
 * Factory function
 */
export function getPaymentRemindersSkill(config?: PaymentRemindersConfig): PaymentRemindersSkill {
  return new PaymentRemindersSkill(config);
}

export default PaymentRemindersSkill;
