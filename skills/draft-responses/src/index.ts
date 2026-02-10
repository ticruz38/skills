/**
 * Draft Responses Skill
 * Generate email reply suggestions with multiple tone options and context-aware drafting
 * Built on top of email skill for message reading and sending
 */

import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Re-export types from email skill
export type Tone = 'professional' | 'casual' | 'friendly' | 'formal' | 'enthusiastic' | 'empathetic' | 'authoritative' | 'witty';

// Draft suggestion interface
export interface DraftSuggestion {
  id?: number;
  emailId: string;
  subject: string;
  draft: string;
  tone: Tone;
  context: string;
  createdAt: string;
  sentAt?: string;
}

// Template interface
export interface ResponseTemplate {
  id?: number;
  name: string;
  description: string;
  category: string;
  template: string;
  defaultTone: Tone;
  variables: string[];
  createdAt: string;
}

// Default templates for email responses
const DEFAULT_TEMPLATES: Omit<ResponseTemplate, 'id' | 'createdAt'>[] = [
  {
    name: 'thank-you',
    description: 'Express gratitude for positive feedback or help',
    category: 'appreciation',
    defaultTone: 'friendly',
    template: 'Hi {{name}},\n\nThank you so much for {{reason}}. I really appreciate it!\n\nBest regards',
    variables: ['name', 'reason']
  },
  {
    name: 'acknowledgment',
    description: 'Acknowledge receipt of information or request',
    category: 'general',
    defaultTone: 'professional',
    template: 'Hi {{name}},\n\nThank you for sending this over. I have received {{item}} and will review it shortly.\n\nBest regards',
    variables: ['name', 'item']
  },
  {
    name: 'follow-up',
    description: 'Follow up on a previous conversation or pending item',
    category: 'general',
    defaultTone: 'professional',
    template: 'Hi {{name}},\n\nI wanted to follow up on {{topic}}. {{message}}\n\nPlease let me know if you have any updates.\n\nBest regards',
    variables: ['name', 'topic', 'message']
  },
  {
    name: 'meeting-accept',
    description: 'Accept a meeting invitation',
    category: 'meetings',
    defaultTone: 'professional',
    template: 'Hi {{name}},\n\nThank you for the invitation. I am available to meet on {{date}} at {{time}}.\n\nLooking forward to discussing {{topic}}.\n\nBest regards',
    variables: ['name', 'date', 'time', 'topic']
  },
  {
    name: 'meeting-decline',
    description: 'Decline a meeting with alternative suggestions',
    category: 'meetings',
    defaultTone: 'professional',
    template: 'Hi {{name}},\n\nThank you for the invitation. Unfortunately, I am not available at that time.\n\nWould {{alternative}} work for you instead?\n\nBest regards',
    variables: ['name', 'alternative']
  },
  {
    name: 'information-request',
    description: 'Request additional information politely',
    category: 'general',
    defaultTone: 'professional',
    template: 'Hi {{name}},\n\nThank you for your email. To help me better assist you, could you please provide more details about {{topic}}?\n\nSpecifically, I would like to know:\n- {{question1}}\n- {{question2}}\n\nBest regards',
    variables: ['name', 'topic', 'question1', 'question2']
  },
  {
    name: 'deadline-extension',
    description: 'Request a deadline extension professionally',
    category: 'general',
    defaultTone: 'professional',
    template: 'Hi {{name}},\n\nI am writing regarding the deadline for {{task}}. Due to {{reason}}, I need to request an extension until {{newDate}}.\n\nI want to ensure the quality of my work meets expectations. Please let me know if this is acceptable.\n\nBest regards',
    variables: ['name', 'task', 'reason', 'newDate']
  },
  {
    name: 'apology',
    description: 'Professional apology for delay or mistake',
    category: 'general',
    defaultTone: 'empathetic',
    template: 'Hi {{name}},\n\nI sincerely apologize for {{issue}}. This was due to {{reason}}, and I take full responsibility.\n\nTo make this right, I will {{solution}}.\n\nPlease accept my apologies, and thank you for your understanding.\n\nBest regards',
    variables: ['name', 'issue', 'reason', 'solution']
  }
];

// Tone modifiers for draft generation
const TONE_MODIFIERS: Record<Tone, string> = {
  professional: 'Clear, business-appropriate language. Concise and respectful.',
  casual: 'Relaxed, conversational style. Uses contractions and everyday language.',
  friendly: 'Warm and approachable. Inclusive language and positive expressions.',
  formal: 'Proper grammar and sophisticated vocabulary. No contractions or slang.',
  enthusiastic: 'Shows excitement and energy. Positive adjectives.',
  empathetic: 'Shows understanding and compassion. Acknowledges feelings.',
  authoritative: 'Demonstrates expertise and confidence. Strong statements.',
  witty: 'Clever and light humor where appropriate.'
};

// Helper to promisify database run with result
function runWithResult(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Helper to promisify database get
function get<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: any) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

// Helper to promisify database all
function all<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

// Database record interfaces for snake_case columns
interface DraftRecord {
  id?: number;
  email_id: string;
  subject: string;
  draft: string;
  tone: Tone;
  context: string;
  created_at: string;
  sent_at?: string;
}

interface TemplateRecord {
  id?: number;
  name: string;
  description: string;
  category: string;
  template: string;
  default_tone: Tone;
  variables: string;
  created_at: string;
}

export class DraftResponsesSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;
  private profile: string;

  constructor(profile: string = 'default') {
    this.profile = profile;
    const baseDir = path.join(os.homedir(), '.openclaw', 'skills', 'draft-responses');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    this.dbPath = path.join(baseDir, 'drafts.db');
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        this.createTables().then(() => resolve()).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const queries = [
      `CREATE TABLE IF NOT EXISTS draft_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        draft TEXT NOT NULL,
        tone TEXT NOT NULL,
        context TEXT NOT NULL,
        created_at TEXT NOT NULL,
        sent_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS response_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        template TEXT NOT NULL,
        default_tone TEXT NOT NULL,
        variables TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_drafts_email ON draft_suggestions(email_id)`,
      `CREATE INDEX IF NOT EXISTS idx_drafts_created ON draft_suggestions(created_at)`
    ];

    for (const query of queries) {
      await new Promise<void>((resolve, reject) => {
        this.db!.run(query, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    await this.insertDefaultTemplates();
  }

  private async insertDefaultTemplates(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    for (const template of DEFAULT_TEMPLATES) {
      const exists = await get<{ count: number }>(
        this.db,
        'SELECT COUNT(*) as count FROM response_templates WHERE name = ?',
        [template.name]
      );

      if (!exists || exists.count === 0) {
        await runWithResult(
          this.db,
          `INSERT INTO response_templates (name, description, category, template, default_tone, variables, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            template.name,
            template.description,
            template.category,
            template.template,
            template.defaultTone,
            JSON.stringify(template.variables),
            new Date().toISOString()
          ]
        );
      }
    }
  }

  /**
   * Get email by ID using the email skill
   */
  async getEmail(emailId: string): Promise<any> {
    const { EmailSkill } = await import('@openclaw/email');
    const emailSkill = new EmailSkill({ profile: this.profile });
    
    try {
      const email = await emailSkill.read(emailId);
      await emailSkill.close();
      return email;
    } catch (error) {
      await emailSkill.close();
      throw error;
    }
  }

  /**
   * Get thread context using the email skill
   */
  async getThreadContext(threadId: string): Promise<any> {
    const { EmailSkill } = await import('@openclaw/email');
    const emailSkill = new EmailSkill({ profile: this.profile });
    
    try {
      const thread = await emailSkill.getThread(threadId);
      await emailSkill.close();
      return thread;
    } catch (error) {
      await emailSkill.close();
      throw error;
    }
  }

  /**
   * Generate draft reply suggestions for an email
   */
  async generateDrafts(
    emailId: string,
    options: {
      tones?: Tone[];
      count?: number;
      useThreadContext?: boolean;
    } = {}
  ): Promise<DraftSuggestion[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const { tones = ['professional', 'friendly'], count = 3, useThreadContext = true } = options;

    // Get the email
    const email = await this.getEmail(emailId);
    if (!email) {
      throw new Error(`Email not found: ${emailId}`);
    }

    // Get thread context if requested
    let context = '';
    if (useThreadContext && email.threadId) {
      try {
        const thread = await this.getThreadContext(email.threadId);
        if (thread && thread.messages && thread.messages.length > 1) {
          context = `This is part of a conversation with ${thread.messages.length} messages. `;
          context += `Previous context: "${thread.messages[thread.messages.length - 2].bodyText?.substring(0, 200)}..."`;
        }
      } catch (e) {
        // Ignore thread fetch errors
      }
    }

    // Parse sender name from "Name <email>" format
    const senderName = this.parseSenderName(email.from);
    const subject = email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject || 'No Subject'}`;

    // Generate drafts for different tones
    const drafts: DraftSuggestion[] = [];
    const tonesToUse = tones.slice(0, count);

    for (const tone of tonesToUse) {
      const draft = this.createDraft(email, senderName, tone, context);
      
      const suggestion: DraftSuggestion = {
        emailId,
        subject,
        draft,
        tone,
        context,
        createdAt: new Date().toISOString()
      };

      // Save to database
      const result = await runWithResult(
        this.db,
        `INSERT INTO draft_suggestions (email_id, subject, draft, tone, context, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [emailId, subject, draft, tone, context, suggestion.createdAt]
      );

      suggestion.id = result.lastID;
      drafts.push(suggestion);
    }

    return drafts;
  }

  private parseSenderName(from: string): string {
    if (!from) return 'there';
    
    // Handle "Name <email@example.com>" format
    const match = from.match(/^([^<]+)</);
    if (match) {
      return match[1].trim();
    }
    
    // Handle just email - use part before @
    const emailMatch = from.match(/^([^@]+)@/);
    if (emailMatch) {
      return emailMatch[1].charAt(0).toUpperCase() + emailMatch[1].slice(1);
    }
    
    return 'there';
  }

  private createDraft(email: any, senderName: string, tone: Tone, context: string): string {
    const toneModifier = TONE_MODIFIERS[tone];
    const originalBody = email.bodyText || '';
    const isQuestion = originalBody.includes('?');
    
    // Analyze email content for better context
    const isUrgent = /urgent|asap|immediately|deadline|today/i.test(originalBody);
    const isThankYou = /thank|thanks|appreciate|grateful/i.test(originalBody);
    const isRequest = /please|could you|would you|can you/i.test(originalBody);
    const isMeeting = /meeting|call|zoom|discuss|schedule/i.test(originalBody);

    // Generate appropriate response based on content analysis and tone
    let greeting = this.getGreeting(tone, senderName);
    let body = '';
    let closing = this.getClosing(tone);

    // Build body based on email type
    if (isThankYou) {
      body = this.getThankYouResponse(tone, senderName);
    } else if (isRequest && isQuestion) {
      body = this.getQuestionResponse(tone, senderName);
    } else if (isMeeting) {
      body = this.getMeetingResponse(tone, senderName);
    } else if (isRequest) {
      body = this.getRequestResponse(tone, senderName, isUrgent);
    } else {
      body = this.getGeneralResponse(tone, senderName, isQuestion);
    }

    // Add context reference if available
    if (context && tone !== 'casual') {
      body += '\n\n' + this.getContextAcknowledgment(tone);
    }

    return `${greeting}\n\n${body}\n\n${closing}`;
  }

  private getGreeting(tone: Tone, name: string): string {
    const greetings: Record<Tone, string> = {
      professional: `Hi ${name},`,
      casual: `Hey ${name},`,
      friendly: `Hi ${name}!`,
      formal: `Dear ${name},`,
      enthusiastic: `Hi ${name}! 👋`,
      empathetic: `Hi ${name},`,
      authoritative: `${name},`,
      witty: `Hey ${name},`
    };
    return greetings[tone];
  }

  private getClosing(tone: Tone): string {
    const closings: Record<Tone, string> = {
      professional: 'Best regards,\n[Your name]',
      casual: 'Thanks,\n[Your name]',
      friendly: 'Best,\n[Your name]',
      formal: 'Sincerely,\n[Your name]',
      enthusiastic: 'Excited to hear from you!\n[Your name]',
      empathetic: 'Take care,\n[Your name]',
      authoritative: 'Best,\n[Your name]',
      witty: 'Cheers,\n[Your name]'
    };
    return closings[tone];
  }

  private getThankYouResponse(tone: Tone, name: string): string {
    const responses: Record<Tone, string> = {
      professional: `Thank you for your email. I appreciate you taking the time to reach out.`,
      casual: `Thanks so much for your message! Really appreciate it.`,
      friendly: `Thank you so much, ${name}! I really appreciate your kind words.`,
      formal: `I wish to express my sincere gratitude for your correspondence.`,
      enthusiastic: `Thank you so much! Your message absolutely made my day! 🎉`,
      empathetic: `Thank you for your thoughtful message. It means a lot to me.`,
      authoritative: `I acknowledge your message with appreciation.`,
      witty: `Thanks a million! You're too kind! 😊`
    };
    return responses[tone];
  }

  private getQuestionResponse(tone: Tone, name: string): string {
    const responses: Record<Tone, string> = {
      professional: `Thank you for your question. I would be happy to help with this.`,
      casual: `Good question! Let me look into this for you.`,
      friendly: `Great question! I'd be happy to help you with this.`,
      formal: `Thank you for your inquiry. I shall endeavor to provide the information you require.`,
      enthusiastic: `Great question! I'd love to help you figure this out!`,
      empathetic: `I understand your question, and I want to make sure I give you the best answer possible.`,
      authoritative: `I've reviewed your question and have the following insights to share.`,
      witty: `Ah, the million-dollar question! Let me see what I can find out for you.`
    };
    return responses[tone];
  }

  private getMeetingResponse(tone: Tone, name: string): string {
    const responses: Record<Tone, string> = {
      professional: `Thank you for the meeting invitation. I have reviewed my schedule and can confirm my availability.`,
      casual: `Thanks for setting this up! Works for me.`,
      friendly: `I'd love to meet! That time works perfectly for me.`,
      formal: `Thank you for the invitation to meet. I am pleased to confirm my availability for the proposed time.`,
      enthusiastic: `Absolutely! I'd be delighted to meet and discuss this further!`,
      empathetic: `I appreciate you coordinating this meeting. I understand the importance of our discussion.`,
      authoritative: `I've reviewed the meeting request and confirmed my attendance.`,
      witty: `Sounds like a plan! Looking forward to our chat.`
    };
    return responses[tone];
  }

  private getRequestResponse(tone: Tone, name: string, isUrgent: boolean): string {
    const urgency = isUrgent ? ' I understand this is time-sensitive and will prioritize it accordingly.' : '';
    
    const responses: Record<Tone, string> = {
      professional: `Thank you for your request. I have received it and will attend to it promptly.${urgency}`,
      casual: `Got it! I'll take care of this for you.${urgency ? ' I see it\'s urgent - on it!' : ''}`,
      friendly: `I'd be happy to help with this!${urgency ? ' I understand it\'s urgent and will get right on it.' : ''}`,
      formal: `I acknowledge receipt of your request and shall process it with due diligence.${urgency}`,
      enthusiastic: `Absolutely! I'd be thrilled to help with this!${urgency ? ' I see it\'s urgent - consider it done!' : ''}`,
      empathetic: `I understand your request and want to help.${urgency ? ' I know this is urgent and will make it a priority.' : ''}`,
      authoritative: `I have received your request and will ensure it is handled appropriately.${urgency}`,
      witty: `No problem at all! I've got this covered.${urgency ? ' And yes, I see the urgency - fast track activated!' : ''}`
    };
    return responses[tone];
  }

  private getGeneralResponse(tone: Tone, name: string, isQuestion: boolean): string {
    if (isQuestion) {
      return this.getQuestionResponse(tone, name);
    }
    
    const responses: Record<Tone, string> = {
      professional: `Thank you for your email. I have reviewed the contents and will respond accordingly.`,
      casual: `Thanks for reaching out! Appreciate you taking the time.`,
      friendly: `Thanks so much for your email! It's great to hear from you.`,
      formal: `I wish to acknowledge receipt of your correspondence and express my appreciation for your communication.`,
      enthusiastic: `Thanks for getting in touch! Always excited to hear from you!`,
      empathetic: `Thank you for sharing this with me. I value your communication.`,
      authoritative: `I have received your communication and will provide a response as appropriate.`,
      witty: `Well hello there! Thanks for dropping me a line.`
    };
    return responses[tone];
  }

  private getContextAcknowledgment(tone: Tone): string {
    const acknowledgments: Record<Tone, string> = {
      professional: 'I have reviewed the previous correspondence and am providing this response in context.',
      casual: 'Looking at our previous messages, I wanted to follow up.',
      friendly: 'Based on our conversation so far, I wanted to add my thoughts.',
      formal: 'Having reviewed our prior exchange, I offer the following response.',
      enthusiastic: 'I\'ve been following our conversation and I\'m excited to continue!',
      empathetic: 'I\'ve been thinking about our exchange and want to address your points thoughtfully.',
      authoritative: 'Based on the context of our discussion, here is my response.',
      witty: 'Picking up where we left off...'
    };
    return acknowledgments[tone];
  }

  /**
   * Send a draft reply using the email skill
   */
  async sendDraft(draftId: number): Promise<{ success: boolean; message: string }> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    // Get the draft
    const record = await get<DraftRecord>(
      this.db,
      'SELECT * FROM draft_suggestions WHERE id = ?',
      [draftId]
    );

    if (!record) {
      return { success: false, message: `Draft not found: ${draftId}` };
    }

    // Get the original email to reply to
    const { EmailSkill } = await import('@openclaw/email');
    const emailSkill = new EmailSkill({ profile: this.profile });

    try {
      // Send the reply
      await emailSkill.reply(record.email_id, {
        bodyText: record.draft
      });

      // Mark as sent
      await runWithResult(
        this.db,
        'UPDATE draft_suggestions SET sent_at = ? WHERE id = ?',
        [new Date().toISOString(), draftId]
      );

      await emailSkill.close();
      return { success: true, message: 'Reply sent successfully' };
    } catch (error) {
      await emailSkill.close();
      throw error;
    }
  }

  /**
   * Get a response template by name
   */
  async getTemplate(name: string): Promise<ResponseTemplate | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const row = await get<TemplateRecord>(
      this.db,
      'SELECT * FROM response_templates WHERE name = ?',
      [name]
    );

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      template: row.template,
      defaultTone: row.default_tone,
      variables: JSON.parse(row.variables),
      createdAt: row.created_at
    };
  }

  /**
   * Get all templates
   */
  async getTemplates(category?: string): Promise<ResponseTemplate[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM response_templates';
    const params: any[] = [];

    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }

    query += ' ORDER BY category, name';

    const rows = await all<TemplateRecord>(this.db, query, params);

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      template: row.template,
      defaultTone: row.default_tone,
      variables: JSON.parse(row.variables),
      createdAt: row.created_at
    }));
  }

  /**
   * Apply a template with variable substitution
   */
  applyTemplate(template: ResponseTemplate, variables: Record<string, string>): string {
    let result = template.template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value);
    }

    // Remove any remaining unfilled variables
    result = result.replace(/{{\s*\w+\s*}}/g, '');

    return result;
  }

  /**
   * Get draft history for an email
   */
  async getDraftsForEmail(emailId: string): Promise<DraftSuggestion[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const rows = await all<DraftRecord>(
      this.db,
      'SELECT * FROM draft_suggestions WHERE email_id = ? ORDER BY created_at DESC',
      [emailId]
    );

    return rows.map(row => ({
      id: row.id,
      emailId: row.email_id,
      subject: row.subject,
      draft: row.draft,
      tone: row.tone,
      context: row.context,
      createdAt: row.created_at,
      sentAt: row.sent_at
    }));
  }

  /**
   * Get all draft suggestions
   */
  async getAllDrafts(limit: number = 50): Promise<DraftSuggestion[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const rows = await all<DraftRecord>(
      this.db,
      'SELECT * FROM draft_suggestions ORDER BY created_at DESC LIMIT ?',
      [limit]
    );

    return rows.map(row => ({
      id: row.id,
      emailId: row.email_id,
      subject: row.subject,
      draft: row.draft,
      tone: row.tone,
      context: row.context,
      createdAt: row.created_at,
      sentAt: row.sent_at
    }));
  }

  /**
   * Delete a draft
   */
  async deleteDraft(draftId: number): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    await runWithResult(
      this.db,
      'DELETE FROM draft_suggestions WHERE id = ?',
      [draftId]
    );
  }

  /**
   * Get available tones
   */
  getAvailableTones(): Tone[] {
    return Object.keys(TONE_MODIFIERS) as Tone[];
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalDrafts: number;
    sentDrafts: number;
    byTone: Record<Tone, number>;
  }> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const totalResult = await get<{ count: number }>(
      this.db,
      'SELECT COUNT(*) as count FROM draft_suggestions'
    );

    const sentResult = await get<{ count: number }>(
      this.db,
      'SELECT COUNT(*) as count FROM draft_suggestions WHERE sent_at IS NOT NULL'
    );

    const byTone: Record<Tone, number> = {} as Record<Tone, number>;
    const tones = this.getAvailableTones();

    for (const tone of tones) {
      const result = await get<{ count: number }>(
        this.db,
        'SELECT COUNT(*) as count FROM draft_suggestions WHERE tone = ?',
        [tone]
      );
      byTone[tone] = result?.count || 0;
    }

    return {
      totalDrafts: totalResult?.count || 0,
      sentDrafts: sentResult?.count || 0,
      byTone
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      await this.initialize();
      
      // Check if email skill is available
      const { EmailSkill } = await import('@openclaw/email');
      const emailSkill = new EmailSkill({ profile: this.profile });
      const emailHealth = await emailSkill.healthCheck();
      await emailSkill.close();

      if (emailHealth.status !== 'healthy') {
        return {
          status: 'unhealthy',
          message: `Email skill not available: ${emailHealth.message}`
        };
      }

      return {
        status: 'healthy',
        message: 'Draft responses skill is ready'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Error: ${error}`
      };
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }

    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err: Error | null) => {
          if (err) reject(err);
          else {
            this.db = null;
            this.initPromise = null;
            resolve();
          }
        });
      });
    }
  }
}

export default DraftResponsesSkill;
