/**
 * Email Summarizer Skill
 * Summarize long email threads with key points and action items extraction
 * Built on top of email skill
 */

import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Types
export type SummaryLength = 'short' | 'medium' | 'long';
export type SummaryFormat = 'paragraph' | 'bullet' | 'numbered';

export interface ThreadSummary {
  id?: number;
  threadId: string;
  subject: string;
  participants: string[];
  messageCount: number;
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  length: SummaryLength;
  format: SummaryFormat;
  createdAt: Date;
}

export interface ActionItem {
  text: string;
  assignee?: string;
  deadline?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SummarizeOptions {
  threadId: string;
  length?: SummaryLength;
  format?: SummaryFormat;
  extractActionItems?: boolean;
  profile?: string;
}

export interface ThreadSummaryRecord {
  id?: number;
  thread_id: string;
  subject: string;
  participants: string;
  message_count: number;
  summary: string;
  key_points: string;
  action_items: string;
  length: SummaryLength;
  format: SummaryFormat;
  created_at: string;
}

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

/**
 * Email Summarizer Skill
 */
export class EmailSummarizerSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;
  private profile: string;

  constructor(profile: string = 'default') {
    this.profile = profile;
    const skillDir = path.join(os.homedir(), '.openclaw', 'skills', 'email-summarizer');
    this.dbPath = path.join(skillDir, 'summaries.db');
    
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }
  }

  private async initDatabase(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (this.db) return;

    this.initPromise = new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        this.createTables().then(() => resolve()).catch(reject);
      });
    });

    return this.initPromise;
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run(`
          CREATE TABLE IF NOT EXISTS thread_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_id TEXT NOT NULL,
            subject TEXT NOT NULL,
            participants TEXT NOT NULL,
            message_count INTEGER NOT NULL,
            summary TEXT NOT NULL,
            key_points TEXT NOT NULL,
            action_items TEXT NOT NULL,
            length TEXT NOT NULL,
            format TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        this.db!.run(`
          CREATE INDEX IF NOT EXISTS idx_thread_id ON thread_summaries(thread_id)
        `);

        this.db!.run(`
          CREATE INDEX IF NOT EXISTS idx_created ON thread_summaries(created_at)
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  /**
   * Summarize an email thread
   */
  async summarize(options: SummarizeOptions): Promise<ThreadSummary> {
    await this.initDatabase();

    const { threadId, length = 'medium', format = 'bullet', extractActionItems = true } = options;

    // Dynamically import email skill (ES module compatibility)
    const { EmailSkill } = await import('@openclaw/email');
    const emailSkill = new EmailSkill({ profile: this.profile });

    try {
      // Fetch the thread
      const thread = await emailSkill.getThread(threadId);
      
      if (!thread.messages || thread.messages.length === 0) {
        throw new Error('Thread has no messages');
      }

      // Extract thread information
      const subject = thread.messages[0].subject || '(No Subject)';
      const participants = this.extractParticipants(thread.messages);
      const messageCount = thread.messages.length;

      // Build thread text for summarization
      const threadText = this.buildThreadText(thread.messages);

      // Generate summary
      const summary = this.generateSummary(threadText, length, format);

      // Extract key points
      const keyPoints = this.extractKeyPoints(thread.messages, length);

      // Extract action items if requested
      const actionItems = extractActionItems 
        ? this.extractActionItemsFromThread(thread.messages)
        : [];

      const result: ThreadSummary = {
        threadId,
        subject,
        participants,
        messageCount,
        summary,
        keyPoints,
        actionItems,
        length,
        format,
        createdAt: new Date()
      };

      await this.saveSummary(result);

      return result;
    } finally {
      await emailSkill.close();
    }
  }

  /**
   * Extract unique participants from messages
   */
  private extractParticipants(messages: any[]): string[] {
    const participants = new Set<string>();
    messages.forEach(msg => {
      if (msg.from) participants.add(msg.from);
      msg.to?.forEach((to: string) => participants.add(to));
      msg.cc?.forEach((cc: string) => participants.add(cc));
    });
    return Array.from(participants);
  }

  /**
   * Build thread text from messages for summarization
   */
  private buildThreadText(messages: any[]): string {
    return messages.map(msg => {
      const from = msg.from || 'Unknown';
      const date = msg.date ? new Date(msg.date).toLocaleDateString() : 'Unknown date';
      const body = msg.bodyText || msg.snippet || '';
      return `From: ${from} (${date})\n${body}`;
    }).join('\n\n---\n\n');
  }

  /**
   * Generate summary from thread text
   */
  private generateSummary(text: string, length: SummaryLength, format: SummaryFormat): string {
    const sentences = this.extractSentences(text);
    
    if (sentences.length === 0) {
      return 'No content to summarize.';
    }

    // Determine how many sentences based on length
    const multiplier = length === 'short' ? 0.05 : length === 'medium' ? 0.1 : 0.2;
    const targetSentences = Math.max(2, Math.ceil(sentences.length * multiplier));

    // Score and select sentences
    const scored = sentences.map((sentence, index) => ({
      sentence,
      score: this.scoreSentence(sentence, index, sentences.length),
      position: index
    }));

    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, targetSentences).sort((a, b) => a.position - b.position);

    // Format output
    switch (format) {
      case 'bullet':
        return selected.map(s => `• ${s.sentence}`).join('\n');
      case 'numbered':
        return selected.map((s, i) => `${i + 1}. ${s.sentence}`).join('\n');
      case 'paragraph':
      default:
        return selected.map(s => s.sentence).join(' ');
    }
  }

  /**
   * Extract sentences from text
   */
  private extractSentences(text: string): string[] {
    return text
      .replace(/([.!?])\s+/g, "$1|")
      .split("|")
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 500);
  }

  /**
   * Score a sentence for importance
   */
  private scoreSentence(sentence: string, position: number, total: number): number {
    let score = 0;
    const lower = sentence.toLowerCase();

    // Email-specific keywords
    const importantKeywords = [
      'decided', 'agreed', 'conclusion', 'action', 'follow up', 'next step',
      'important', 'deadline', 'urgent', 'please', 'need to', 'should',
      'will', 'scheduled', 'meeting', 'call', 'discuss', 'approve'
    ];

    importantKeywords.forEach(keyword => {
      if (lower.includes(keyword)) score += 3;
    });

    // Position scoring - first and last sentences often important
    if (position === 0) score += 5;
    if (position === total - 1) score += 3;
    if (position < total * 0.1) score += 2; // First 10%

    // Has specific details
    if (/\d{1,2}:\d{2}/.test(sentence)) score += 2; // Time
    if (/\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}/.test(sentence)) score += 2; // Date
    if (/\d+%|\$\d+/.test(sentence)) score += 2; // Numbers/money

    // Length preference
    const words = sentence.split(/\s+/).length;
    if (words > 8 && words < 30) score += 1;

    return score;
  }

  /**
   * Extract key points from messages
   */
  private extractKeyPoints(messages: any[], length: SummaryLength): string[] {
    const points: string[] = [];
    
    // Get all sentences
    const allSentences: string[] = [];
    messages.forEach(msg => {
      const text = msg.bodyText || msg.snippet || '';
      allSentences.push(...this.extractSentences(text));
    });

    // Score and extract top points
    const scored = allSentences.map((sentence, index) => ({
      sentence,
      score: this.scoreSentence(sentence, index, allSentences.length)
    }));

    scored.sort((a, b) => b.score - a.score);

    const count = length === 'short' ? 3 : length === 'medium' ? 5 : 8;
    const topPoints = scored.slice(0, count);
    
    // Deduplicate similar points
    const seen = new Set<string>();
    for (const point of topPoints) {
      const normalized = point.sentence.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seen.has(normalized)) {
        seen.add(normalized);
        points.push(point.sentence);
      }
    }

    return points.slice(0, count);
  }

  /**
   * Extract action items from thread
   */
  private extractActionItemsFromThread(messages: any[]): ActionItem[] {
    const actionItems: ActionItem[] = [];
    const seen = new Set<string>();

    // Action item patterns
    const actionPatterns = [
      { regex: /(?:need|needs|needed)\s+to\s+(.+?)(?:\.|\n|$)/i, priority: 'medium' as const },
      { regex: /(?:should|must|will)\s+(.+?)(?:\.|\n|$)/i, priority: 'high' as const },
      { regex: /(?:please|pls)\s+(.+?)(?:\.|\n|$)/i, priority: 'high' as const },
      { regex: /(?:action item|todo|to-do|task):?\s*(.+?)(?:\.|\n|$)/i, priority: 'high' as const },
      { regex: /(?:follow\s+up|followup)\s+(?:on|with)?\s*(.+?)(?:\.|\n|$)/i, priority: 'medium' as const },
      { regex: /(?:by|before)\s+(?:next\s+)?(\w+day|tomorrow|(?:mon|tues|wednes|thurs|fri|satur|sun)day)/i, priority: 'high' as const },
      { regex: /(?:deadline|due)\s*(?:is)?\s*:?\s*(.+?)(?:\.|\n|$)/i, priority: 'high' as const }
    ];

    messages.forEach(msg => {
      const text = msg.bodyText || msg.snippet || '';
      const from = msg.from || 'Unknown';
      
      actionPatterns.forEach(({ regex, priority }) => {
        let match;
        const textToSearch = text;
        while ((match = regex.exec(textToSearch)) !== null) {
          const actionText = match[1].trim();
          if (actionText.length > 10 && actionText.length < 200) {
            // Deduplicate
            const key = actionText.toLowerCase().slice(0, 50);
            if (!seen.has(key)) {
              seen.add(key);
              
              // Try to extract deadline
              let deadline: string | undefined;
              const deadlineMatch = text.match(/(?:by|before|on)\s+(\w+day,?\s+\w+\s+\d+|\d{1,2}\/\d{1,2}|next\s+\w+day|tomorrow|end\s+of\s+\w+)/i);
              if (deadlineMatch) {
                deadline = deadlineMatch[1];
              }

              actionItems.push({
                text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
                assignee: this.extractAssignee(text, from),
                deadline,
                priority
              });
            }
          }
        }
      });
    });

    return actionItems.slice(0, 10); // Limit to top 10
  }

  /**
   * Try to extract assignee from text
   */
  private extractAssignee(text: string, from: string): string | undefined {
    // Look for @mentions or explicit assignments
    const mentionMatch = text.match(/@(\w+)/);
    if (mentionMatch) return mentionMatch[1];

    const assignmentMatch = text.match(/(\w+)\s+(?:will|is\s+going\s+to|should)/i);
    if (assignmentMatch) return assignmentMatch[1];

    // Default to sender if they're requesting something
    if (text.toLowerCase().includes('i will') || text.toLowerCase().includes("i'll")) {
      return from.match(/([^<]+)/)?.[1].trim() || from;
    }

    return undefined;
  }

  /**
   * Save summary to database
   */
  private async saveSummary(summary: ThreadSummary): Promise<void> {
    await this.initDatabase();
    if (!this.db) return;

    const result = await runWithResult(this.db, `
      INSERT INTO thread_summaries 
      (thread_id, subject, participants, message_count, summary, key_points, action_items, length, format)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      summary.threadId,
      summary.subject,
      JSON.stringify(summary.participants),
      summary.messageCount,
      summary.summary,
      JSON.stringify(summary.keyPoints),
      JSON.stringify(summary.actionItems),
      summary.length,
      summary.format
    ]);

    summary.id = result.lastID;
  }

  /**
   * Get summary history
   */
  async getHistory(limit: number = 20): Promise<ThreadSummary[]> {
    await this.initDatabase();
    if (!this.db) return [];

    const rows = await all<ThreadSummaryRecord>(this.db, 
      'SELECT * FROM thread_summaries ORDER BY created_at DESC LIMIT ?', 
      [limit]
    );

    return rows.map(row => this.recordToSummary(row));
  }

  /**
   * Get summary by ID
   */
  async getSummary(id: number): Promise<ThreadSummary | null> {
    await this.initDatabase();
    if (!this.db) return null;

    const row = await get<ThreadSummaryRecord>(this.db, 
      'SELECT * FROM thread_summaries WHERE id = ?', 
      [id]
    );

    if (!row) return null;
    return this.recordToSummary(row);
  }

  /**
   * Get summaries for a specific thread
   */
  async getThreadSummaries(threadId: string): Promise<ThreadSummary[]> {
    await this.initDatabase();
    if (!this.db) return [];

    const rows = await all<ThreadSummaryRecord>(this.db, 
      'SELECT * FROM thread_summaries WHERE thread_id = ? ORDER BY created_at DESC', 
      [threadId]
    );

    return rows.map(row => this.recordToSummary(row));
  }

  /**
   * Delete a summary
   */
  async deleteSummary(id: number): Promise<boolean> {
    await this.initDatabase();
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      this.db!.run('DELETE FROM thread_summaries WHERE id = ?', [id], function(this: sqlite3.RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalSummaries: number;
    byLength: Record<SummaryLength, number>;
    totalActionItems: number;
  }> {
    await this.initDatabase();
    if (!this.db) {
      return { totalSummaries: 0, byLength: { short: 0, medium: 0, long: 0 }, totalActionItems: 0 };
    }

    const totalRow = await get<{ count: number }>(this.db, 'SELECT COUNT(*) as count FROM thread_summaries');
    const totalSummaries = totalRow?.count || 0;

    const lengthRows = await all<{ length: SummaryLength; count: number }>(this.db, 
      'SELECT length, COUNT(*) as count FROM thread_summaries GROUP BY length'
    );
    const byLength: Record<SummaryLength, number> = { short: 0, medium: 0, long: 0 };
    lengthRows.forEach(row => byLength[row.length] = row.count);

    // Count action items (stored as JSON array)
    const actionItemsRows = await all<{ action_items: string }>(this.db, 
      'SELECT action_items FROM thread_summaries'
    );
    let totalActionItems = 0;
    actionItemsRows.forEach(row => {
      try {
        const items = JSON.parse(row.action_items);
        totalActionItems += items.length;
      } catch {}
    });

    return { totalSummaries, byLength, totalActionItems };
  }

  /**
   * Clear old summaries
   */
  async clearHistory(olderThanDays?: number): Promise<number> {
    await this.initDatabase();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      let sql = 'DELETE FROM thread_summaries';
      const params: any[] = [];

      if (olderThanDays) {
        sql = 'DELETE FROM thread_summaries WHERE created_at < datetime("now", "-' + olderThanDays + ' days")';
      }

      this.db!.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.initDatabase();
      
      // Check email skill
      const { EmailSkill } = await import('@openclaw/email');
      const emailSkill = new EmailSkill({ profile: this.profile });
      const emailHealth = await emailSkill.healthCheck();
      await emailSkill.close();
      
      if (emailHealth.status !== 'healthy') {
        return { 
          healthy: false, 
          message: `Email skill not healthy: ${emailHealth.message}` 
        };
      }
      
      return { healthy: true, message: 'Email summarizer skill is operational' };
    } catch (error) {
      return { healthy: false, message: `Error: ${error}` };
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
        this.db!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  /**
   * Convert database record to ThreadSummary
   */
  private recordToSummary(row: ThreadSummaryRecord): ThreadSummary {
    return {
      id: row.id,
      threadId: row.thread_id,
      subject: row.subject,
      participants: JSON.parse(row.participants),
      messageCount: row.message_count,
      summary: row.summary,
      keyPoints: JSON.parse(row.key_points),
      actionItems: JSON.parse(row.action_items),
      length: row.length,
      format: row.format,
      createdAt: new Date(row.created_at)
    };
  }
}

export default EmailSummarizerSkill;
