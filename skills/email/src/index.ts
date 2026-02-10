/**
 * Email Skill
 * Gmail integration for reading, sending, and managing emails
 * Built on top of google-oauth skill
 */

import { GoogleOAuthClient } from '@openclaw/google-oauth';
import * as sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Gmail API base URL
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

/**
 * Email metadata structure
 */
export interface EmailMetadata {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  sizeEstimate: number;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  date: string;
  isUnread: boolean;
  isStarred: boolean;
  isImportant: boolean;
  isDraft: boolean;
  isSent: boolean;
}

/**
 * Full email with body content
 */
export interface Email extends EmailMetadata {
  bodyText: string;
  bodyHtml: string;
  attachments: Attachment[];
}

/**
 * Email attachment
 */
export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * Thread containing multiple messages
 */
export interface Thread {
  id: string;
  historyId: string;
  messages: Email[];
}

/**
 * Search result with pagination
 */
export interface SearchResult {
  emails: EmailMetadata[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

/**
 * Send email options
 */
export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    mimeType: string;
  }>;
  threadId?: string;
}

/**
 * Email skill configuration
 */
export interface EmailSkillConfig {
  profile?: string;
  cacheDir?: string;
  enableCache?: boolean;
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
 * Email Skill - Gmail integration
 */
export class EmailSkill {
  private googleClient: GoogleOAuthClient;
  private profile: string;
  private cacheDir: string;
  private enableCache: boolean;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: EmailSkillConfig = {}) {
    this.profile = config.profile || 'default';
    this.cacheDir = config.cacheDir || path.join(os.homedir(), '.openclaw', 'skills', 'email');
    this.enableCache = config.enableCache !== false;
    this.googleClient = GoogleOAuthClient.forProfile(this.profile);
    
    if (this.enableCache) {
      this.initPromise = this.initCache();
    }
  }

  /**
   * Create EmailSkill for a specific profile
   */
  static forProfile(profile: string = 'default'): EmailSkill {
    return new EmailSkill({ profile });
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
      
      // Wait for database to be ready
      this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
          if (err) reject(err);
          else resolve(db);
        });
      });

      // Create tables
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS email_metadata (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL,
          profile TEXT NOT NULL,
          subject TEXT,
          sender TEXT,
          recipients TEXT,
          date TEXT,
          snippet TEXT,
          is_unread INTEGER DEFAULT 0,
          is_starred INTEGER DEFAULT 0,
          is_important INTEGER DEFAULT 0,
          label_ids TEXT,
          cached_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);

      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_profile ON email_metadata(profile)
      `);
      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_thread ON email_metadata(thread_id)
      `);
      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_date ON email_metadata(date)
      `);

      await run(this.db, `
        CREATE TABLE IF NOT EXISTS sync_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile TEXT NOT NULL,
          history_id TEXT,
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
   * Check if Gmail is connected
   */
  async isConnected(): Promise<boolean> {
    const connected = this.googleClient.isConnected();
    if (!connected) return false;
    
    // Also check we have Gmail scope
    return await this.googleClient.hasService('gmail');
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    connected: boolean;
    email?: string;
    hasGmailScope?: boolean;
  }> {
    const connected = this.googleClient.isConnected();
    if (!connected) {
      return { connected: false };
    }

    const email = await this.googleClient.getUserEmail();
    const hasGmailScope = await this.googleClient.hasService('gmail');

    return {
      connected: true,
      email: email || undefined,
      hasGmailScope,
    };
  }

  /**
   * List recent emails
   */
  async list(options: {
    maxResults?: number;
    pageToken?: string;
    labelIds?: string[];
    query?: string;
  } = {}): Promise<SearchResult> {
    await this.ensureConnected();

    const params = new URLSearchParams();
    params.set('maxResults', String(options.maxResults || 20));
    
    if (options.pageToken) {
      params.set('pageToken', options.pageToken);
    }
    if (options.labelIds?.length) {
      options.labelIds.forEach(id => params.append('labelIds', id));
    }
    if (options.query) {
      params.set('q', options.query);
    }

    const response = await this.googleClient.fetch(
      `${GMAIL_API_BASE}/me/messages?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Failed to list emails: ${response.statusText}`);
    }

    const data = await response.json() as {
      messages?: Array<{ id: string; threadId: string }>;
      nextPageToken?: string;
      resultSizeEstimate?: number;
    };

    if (!data.messages || data.messages.length === 0) {
      return {
        emails: [],
        nextPageToken: data.nextPageToken,
        resultSizeEstimate: data.resultSizeEstimate || 0,
      };
    }

    // Get metadata for each message
    const emails: EmailMetadata[] = [];
    for (const msg of data.messages) {
      try {
        const metadata = await this.getEmailMetadata(msg.id);
        emails.push(metadata);
      } catch (error) {
        console.warn(`Failed to get metadata for ${msg.id}:`, error);
      }
    }

    // Cache the results
    if (this.enableCache && this.db) {
      await this.ensureCache();
      await this.cacheEmails(emails);
    }

    return {
      emails,
      nextPageToken: data.nextPageToken,
      resultSizeEstimate: data.resultSizeEstimate || 0,
    };
  }

  /**
   * Search emails with Gmail query syntax
   */
  async search(query: string, options: {
    maxResults?: number;
    pageToken?: string;
  } = {}): Promise<SearchResult> {
    return this.list({ ...options, query });
  }

  /**
   * Get email metadata (lightweight)
   */
  async getEmailMetadata(messageId: string): Promise<EmailMetadata> {
    await this.ensureConnected();

    const response = await this.googleClient.fetch(
      `${GMAIL_API_BASE}/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc&metadataHeaders=Date`
    );

    if (!response.ok) {
      throw new Error(`Failed to get email metadata: ${response.statusText}`);
    }

    const data = await response.json() as GmailMessage;
    return this.parseEmailMetadata(data);
  }

  /**
   * Read full email content
   */
  async read(messageId: string): Promise<Email> {
    await this.ensureConnected();

    const response = await this.googleClient.fetch(
      `${GMAIL_API_BASE}/me/messages/${messageId}?format=full`
    );

    if (!response.ok) {
      throw new Error(`Failed to read email: ${response.statusText}`);
    }

    const data = await response.json() as GmailMessage;
    return this.parseFullEmail(data);
  }

  /**
   * Get thread with all messages
   */
  async getThread(threadId: string): Promise<Thread> {
    await this.ensureConnected();

    const response = await this.googleClient.fetch(
      `${GMAIL_API_BASE}/me/threads/${threadId}?format=full`
    );

    if (!response.ok) {
      throw new Error(`Failed to get thread: ${response.statusText}`);
    }

    const data = await response.json() as GmailThread;
    
    return {
      id: data.id,
      historyId: data.historyId,
      messages: (data.messages || []).map(m => this.parseFullEmail(m)),
    };
  }

  /**
   * Send an email
   */
  async send(options: SendEmailOptions): Promise<{ id: string; threadId: string }> {
    await this.ensureConnected();

    const raw = this.buildRawMessage(options);
    const encoded = this.base64UrlEncode(raw);

    const response = await this.googleClient.fetch(
      `${GMAIL_API_BASE}/me/messages/send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encoded,
          threadId: options.threadId,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const result = await response.json() as { id: string; threadId: string };
    return result;
  }

  /**
   * Reply to an email
   */
  async reply(messageId: string, options: {
    bodyText?: string;
    bodyHtml?: string;
    attachments?: SendEmailOptions['attachments'];
  }): Promise<{ id: string; threadId: string }> {
    // Get original message for threading
    const original = await this.read(messageId);
    
    // Build reply
    const to = original.from;
    const subject = original.subject.startsWith('Re:') 
      ? original.subject 
      : `Re: ${original.subject}`;
    
    // Quote original message in text body
    let bodyText = options.bodyText || '';
    if (bodyText && original.bodyText) {
      bodyText += `\n\nOn ${original.date}, ${original.from} wrote:\n> ${original.bodyText.replace(/\n/g, '\n> ')}`;
    }

    return this.send({
      to,
      subject,
      bodyText,
      bodyHtml: options.bodyHtml,
      attachments: options.attachments,
      threadId: original.threadId,
    });
  }

  /**
   * Mark email as read/unread
   */
  async markAsRead(messageId: string, read: boolean = true): Promise<void> {
    await this.ensureConnected();

    const response = await this.googleClient.fetch(
      `${GMAIL_API_BASE}/me/messages/${messageId}/modify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(read 
          ? { removeLabelIds: ['UNREAD'] }
          : { addLabelIds: ['UNREAD'] }
        ),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to modify email: ${response.statusText}`);
    }
  }

  /**
   * Star/unstar email
   */
  async star(messageId: string, starred: boolean = true): Promise<void> {
    await this.ensureConnected();

    const response = await this.googleClient.fetch(
      `${GMAIL_API_BASE}/me/messages/${messageId}/modify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(starred 
          ? { addLabelIds: ['STARRED'] }
          : { removeLabelIds: ['STARRED'] }
        ),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to modify email: ${response.statusText}`);
    }
  }

  /**
   * Archive email (remove from INBOX)
   */
  async archive(messageId: string): Promise<void> {
    await this.ensureConnected();

    const response = await this.googleClient.fetch(
      `${GMAIL_API_BASE}/me/messages/${messageId}/modify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to archive email: ${response.statusText}`);
    }
  }

  /**
   * Move to trash
   */
  async trash(messageId: string): Promise<void> {
    await this.ensureConnected();

    const response = await this.googleClient.fetch(
      `${GMAIL_API_BASE}/me/messages/${messageId}/trash`,
      { method: 'POST' }
    );

    if (!response.ok) {
      throw new Error(`Failed to trash email: ${response.statusText}`);
    }
  }

  /**
   * Delete permanently
   */
  async delete(messageId: string): Promise<void> {
    await this.ensureConnected();

    const response = await this.googleClient.fetch(
      `${GMAIL_API_BASE}/me/messages/${messageId}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete email: ${response.statusText}`);
    }
  }

  /**
   * Get attachment content
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    await this.ensureConnected();

    const response = await this.googleClient.fetch(
      `${GMAIL_API_BASE}/me/messages/${messageId}/attachments/${attachmentId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get attachment: ${response.statusText}`);
    }

    const data = await response.json() as { data: string };
    // Gmail returns base64url encoded data
    return Buffer.from(data.data, 'base64url');
  }

  /**
   * List labels
   */
  async listLabels(): Promise<Array<{
    id: string;
    name: string;
    type: 'system' | 'user';
    messageListVisibility?: string;
    labelListVisibility?: string;
  }>> {
    await this.ensureConnected();

    const response = await this.googleClient.fetch(
      `${GMAIL_API_BASE}/me/labels`
    );

    if (!response.ok) {
      throw new Error(`Failed to list labels: ${response.statusText}`);
    }

    const data = await response.json() as {
      labels?: Array<{
        id: string;
        name: string;
        type: string;
        messageListVisibility?: string;
        labelListVisibility?: string;
      }>;
    };

    return (data.labels || []).map(l => ({
      id: l.id,
      name: l.name,
      type: l.type as 'system' | 'user',
      messageListVisibility: l.messageListVisibility,
      labelListVisibility: l.labelListVisibility,
    }));
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

    if (!status.hasGmailScope) {
      return { status: 'unhealthy', message: 'Gmail scope not authorized', email: status.email };
    }

    // Test API call
    try {
      const response = await this.googleClient.fetch(
        `${GMAIL_API_BASE}/me/profile`
      );
      
      if (response.ok) {
        return { status: 'healthy', message: 'Gmail API accessible', email: status.email };
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
    if (!status.hasGmailScope) {
      throw new Error('Gmail scope not authorized. Please reconnect with Gmail permissions.');
    }
  }

  private parseEmailMetadata(data: GmailMessage): EmailMetadata {
    const headers = data.payload?.headers || [];
    const getHeader = (name: string) => 
      headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const labelIds = data.labelIds || [];

    return {
      id: data.id,
      threadId: data.threadId,
      labelIds,
      snippet: decodeHtmlEntities(data.snippet || ''),
      historyId: data.historyId,
      internalDate: data.internalDate,
      sizeEstimate: data.sizeEstimate || 0,
      subject: getHeader('subject'),
      from: parseEmailAddress(getHeader('from')),
      to: parseEmailList(getHeader('to')),
      cc: parseEmailList(getHeader('cc')),
      bcc: parseEmailList(getHeader('bcc')),
      date: getHeader('date'),
      isUnread: labelIds.includes('UNREAD'),
      isStarred: labelIds.includes('STARRED'),
      isImportant: labelIds.includes('IMPORTANT'),
      isDraft: labelIds.includes('DRAFT'),
      isSent: labelIds.includes('SENT'),
    };
  }

  private parseFullEmail(data: GmailMessage): Email {
    const metadata = this.parseEmailMetadata(data);
    const parts = this.extractParts(data.payload);

    return {
      ...metadata,
      bodyText: parts.text || '',
      bodyHtml: parts.html || '',
      attachments: parts.attachments,
    };
  }

  private extractParts(payload?: GmailPayload): {
    text: string;
    html: string;
    attachments: Attachment[];
  } {
    const result = {
      text: '',
      html: '',
      attachments: [] as Attachment[],
    };

    if (!payload) return result;

    // If it's a simple message
    if (payload.body?.data) {
      const content = this.decodeBase64Url(payload.body.data);
      if (payload.mimeType === 'text/plain') {
        result.text = content;
      } else if (payload.mimeType === 'text/html') {
        result.html = content;
      }
    }

    // If it has parts (multipart)
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          result.text = this.decodeBase64Url(part.body.data);
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          result.html = this.decodeBase64Url(part.body.data);
        } else if (part.filename && part.body?.attachmentId) {
          result.attachments.push({
            id: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType || 'application/octet-stream',
            size: part.body.size || 0,
          });
        }
        
        // Recursively handle nested parts
        if (part.parts) {
          const nested = this.extractParts(part);
          if (!result.text && nested.text) result.text = nested.text;
          if (!result.html && nested.html) result.html = nested.html;
          result.attachments.push(...nested.attachments);
        }
      }
    }

    return result;
  }

  private decodeBase64Url(data: string): string {
    return Buffer.from(data, 'base64url').toString('utf-8');
  }

  private base64UrlEncode(data: string): string {
    return Buffer.from(data).toString('base64url');
  }

  private buildRawMessage(options: SendEmailOptions): string {
    const lines: string[] = [];
    
    // Headers
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    lines.push(`To: ${to}`);
    
    if (options.cc) {
      const cc = Array.isArray(options.cc) ? options.cc.join(', ') : options.cc;
      lines.push(`Cc: ${cc}`);
    }
    
    lines.push(`Subject: ${options.subject}`);
    lines.push('MIME-Version: 1.0');

    // Build multipart message if needed
    const hasAttachments = options.attachments && options.attachments.length > 0;
    const hasHtml = !!options.bodyHtml;
    const hasText = !!options.bodyText;

    if (hasAttachments || hasHtml) {
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      lines.push('');
      lines.push(`This is a multi-part message in MIME format.`);
      lines.push('');

      // Text part
      if (hasText) {
        lines.push(`--${boundary}`);
        lines.push('Content-Type: text/plain; charset=UTF-8');
        lines.push('Content-Transfer-Encoding: base64');
        lines.push('');
        lines.push(Buffer.from(options.bodyText!).toString('base64'));
        lines.push('');
      }

      // HTML part
      if (hasHtml) {
        lines.push(`--${boundary}`);
        lines.push('Content-Type: text/html; charset=UTF-8');
        lines.push('Content-Transfer-Encoding: base64');
        lines.push('');
        lines.push(Buffer.from(options.bodyHtml!).toString('base64'));
        lines.push('');
      }

      // Attachments
      if (hasAttachments) {
        for (const att of options.attachments!) {
          lines.push(`--${boundary}`);
          lines.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
          lines.push('Content-Transfer-Encoding: base64');
          lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
          lines.push('');
          lines.push(att.content.toString('base64'));
          lines.push('');
        }
      }

      lines.push(`--${boundary}--`);
    } else {
      // Simple text message
      lines.push('Content-Type: text/plain; charset=UTF-8');
      lines.push('');
      lines.push(options.bodyText || '');
    }

    return lines.join('\r\n');
  }

  private async cacheEmails(emails: EmailMetadata[]): Promise<void> {
    if (!this.db) return;

    for (const email of emails) {
      await run(this.db, `
        INSERT OR REPLACE INTO email_metadata 
        (id, thread_id, profile, subject, sender, recipients, date, snippet, is_unread, is_starred, is_important, label_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        email.id,
        email.threadId,
        this.profile,
        email.subject,
        email.from,
        [...email.to, ...email.cc].join(', '),
        email.date,
        email.snippet,
        email.isUnread ? 1 : 0,
        email.isStarred ? 1 : 0,
        email.isImportant ? 1 : 0,
        JSON.stringify(email.labelIds)
      ]);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    // Wait for initialization to complete before closing
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (e) {
        // Ignore init errors, we're closing anyway
      }
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Gmail API types
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId: string;
  internalDate: string;
  payload?: GmailPayload;
  sizeEstimate?: number;
}

interface GmailPayload {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailPayload[];
}

interface GmailThread {
  id: string;
  historyId: string;
  messages?: GmailMessage[];
}

// Utility functions

function parseEmailList(header: string): string[] {
  if (!header) return [];
  return header.split(',').map(e => parseEmailAddress(e.trim()));
}

function parseEmailAddress(address: string): string {
  // Extract email from "Name <email@domain.com>" format
  const match = address.match(/<([^>]+)>/);
  return match ? match[1] : address.trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Factory function
export function getEmailSkill(profile?: string): EmailSkill {
  return new EmailSkill({ profile });
}

export default EmailSkill;
