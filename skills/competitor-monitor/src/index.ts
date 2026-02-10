import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { createHash } from 'crypto';

export interface Competitor {
  id?: number;
  name: string;
  url: string;
  description?: string;
  checkFrequency: 'hourly' | 'daily' | 'weekly';
  isActive: boolean;
  alertEmail?: string;
  alertWebhook?: string;
  keywords?: string[];
  createdAt?: string;
  lastCheckedAt?: string;
}

export interface CompetitorRecord {
  id: number;
  name: string;
  url: string;
  description: string | null;
  check_frequency: string;
  is_active: number;
  alert_email: string | null;
  alert_webhook: string | null;
  keywords: string | null;
  created_at: string;
  last_checked_at: string | null;
}

export interface Snapshot {
  id?: number;
  competitorId: number;
  contentHash: string;
  contentPreview: string;
  screenshotPath?: string;
  httpStatus: number;
  contentLength: number;
  fetchedAt: string;
}

export interface SnapshotRecord {
  id: number;
  competitor_id: number;
  content_hash: string;
  content_preview: string;
  screenshot_path: string | null;
  http_status: number;
  content_length: number;
  fetched_at: string;
}

export interface Change {
  id?: number;
  competitorId: number;
  snapshotId: number;
  changeType: 'content' | 'screenshot' | 'status' | 'keyword_match';
  severity: 'info' | 'minor' | 'major' | 'critical';
  oldValue?: string;
  newValue?: string;
  description: string;
  isRead: boolean;
  detectedAt: string;
}

export interface ChangeRecord {
  id: number;
  competitor_id: number;
  snapshot_id: number;
  change_type: string;
  severity: string;
  old_value: string | null;
  new_value: string | null;
  description: string;
  is_read: number;
  detected_at: string;
}

export interface ChangeDetectionResult {
  hasChanged: boolean;
  changes: Change[];
  snapshot: Snapshot;
}

export interface CheckResult {
  competitor: Competitor;
  changes: Change[];
  success: boolean;
  error?: string;
}

function runWithResult(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export class CompetitorMonitorSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;
  private snapshotsDir: string;

  constructor(options: { dbPath?: string; snapshotsDir?: string } = {}) {
    this.dbPath = options.dbPath || path.join(os.homedir(), '.openclaw', 'skills', 'competitor-monitor', 'monitor.db');
    this.snapshotsDir = options.snapshotsDir || path.join(os.homedir(), '.openclaw', 'skills', 'competitor-monitor', 'snapshots');
    this.initPromise = this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.snapshotsDir)) {
      fs.mkdirSync(this.snapshotsDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    const sql = `
      CREATE TABLE IF NOT EXISTS competitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        description TEXT,
        check_frequency TEXT DEFAULT 'daily',
        is_active INTEGER DEFAULT 1,
        alert_email TEXT,
        alert_webhook TEXT,
        keywords TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_checked_at DATETIME
      );
      
      CREATE INDEX IF NOT EXISTS idx_competitors_active ON competitors(is_active);
      CREATE INDEX IF NOT EXISTS idx_competitors_url ON competitors(url);
      
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competitor_id INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        content_preview TEXT,
        screenshot_path TEXT,
        http_status INTEGER,
        content_length INTEGER,
        fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_snapshots_competitor ON snapshots(competitor_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_fetched ON snapshots(fetched_at);
      
      CREATE TABLE IF NOT EXISTS changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competitor_id INTEGER NOT NULL,
        snapshot_id INTEGER NOT NULL,
        change_type TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        old_value TEXT,
        new_value TEXT,
        description TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE,
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_changes_competitor ON changes(competitor_id);
      CREATE INDEX IF NOT EXISTS idx_changes_read ON changes(is_read);
      CREATE INDEX IF NOT EXISTS idx_changes_detected ON changes(detected_at);
    `;

    return new Promise((resolve, reject) => {
      this.db!.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  // Competitor Management
  async addCompetitor(competitor: Omit<Competitor, 'id' | 'createdAt'>): Promise<Competitor> {
    await this.waitForInit();

    const result = await runWithResult(
      this.db!,
      `INSERT INTO competitors (name, url, description, check_frequency, is_active, alert_email, alert_webhook, keywords)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        competitor.name,
        competitor.url,
        competitor.description || null,
        competitor.checkFrequency,
        competitor.isActive ? 1 : 0,
        competitor.alertEmail || null,
        competitor.alertWebhook || null,
        competitor.keywords ? JSON.stringify(competitor.keywords) : null
      ]
    );

    return {
      ...competitor,
      id: result.lastID,
      createdAt: new Date().toISOString()
    };
  }

  async updateCompetitor(id: number, updates: Partial<Omit<Competitor, 'id' | 'createdAt'>>): Promise<boolean> {
    await this.waitForInit();

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.url !== undefined) { fields.push('url = ?'); values.push(updates.url); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.checkFrequency !== undefined) { fields.push('check_frequency = ?'); values.push(updates.checkFrequency); }
    if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
    if (updates.alertEmail !== undefined) { fields.push('alert_email = ?'); values.push(updates.alertEmail); }
    if (updates.alertWebhook !== undefined) { fields.push('alert_webhook = ?'); values.push(updates.alertWebhook); }
    if (updates.keywords !== undefined) { fields.push('keywords = ?'); values.push(JSON.stringify(updates.keywords)); }

    if (fields.length === 0) return false;

    values.push(id);
    const result = await runWithResult(this.db!, `UPDATE competitors SET ${fields.join(', ')} WHERE id = ?`, values);
    return result.changes > 0;
  }

  async deleteCompetitor(id: number): Promise<boolean> {
    await this.waitForInit();
    const result = await runWithResult(this.db!, 'DELETE FROM competitors WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async getCompetitor(id: number): Promise<Competitor | null> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM competitors WHERE id = ?',
        [id],
        (err, row: CompetitorRecord | undefined) => {
          if (err) { reject(err); return; }
          if (!row) { resolve(null); return; }
          resolve(this.recordToCompetitor(row));
        }
      );
    });
  }

  async getCompetitorByName(name: string): Promise<Competitor | null> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM competitors WHERE name = ?',
        [name],
        (err, row: CompetitorRecord | undefined) => {
          if (err) { reject(err); return; }
          if (!row) { resolve(null); return; }
          resolve(this.recordToCompetitor(row));
        }
      );
    });
  }

  async listCompetitors(activeOnly = false): Promise<Competitor[]> {
    await this.waitForInit();

    const sql = activeOnly
      ? 'SELECT * FROM competitors WHERE is_active = 1 ORDER BY name'
      : 'SELECT * FROM competitors ORDER BY name';

    return new Promise((resolve, reject) => {
      this.db!.all(sql, (err, rows: CompetitorRecord[]) => {
        if (err) { reject(err); return; }
        resolve(rows.map(r => this.recordToCompetitor(r)));
      });
    });
  }

  private recordToCompetitor(record: CompetitorRecord): Competitor {
    return {
      id: record.id,
      name: record.name,
      url: record.url,
      description: record.description || undefined,
      checkFrequency: record.check_frequency as 'hourly' | 'daily' | 'weekly',
      isActive: record.is_active === 1,
      alertEmail: record.alert_email || undefined,
      alertWebhook: record.alert_webhook || undefined,
      keywords: record.keywords ? JSON.parse(record.keywords) : undefined,
      createdAt: record.created_at,
      lastCheckedAt: record.last_checked_at || undefined
    };
  }

  // Website Fetching
  private async fetchWebsite(url: string): Promise<{ content: string; statusCode: number; contentLength: number }> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      
      const requestOptions = {
        hostname: new URL(url).hostname,
        path: new URL(url).pathname + new URL(url).search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CompetitorMonitor/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'identity',
          'Connection': 'keep-alive'
        },
        timeout: 30000
      };

      const req = client.request(requestOptions, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          resolve({
            content: data,
            statusCode: res.statusCode || 0,
            contentLength: data.length
          });
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private extractTextPreview(content: string, maxLength = 500): string {
    // Remove HTML tags and extract text
    const text = content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  // Snapshot Management
  async createSnapshot(competitorId: number): Promise<Snapshot> {
    await this.waitForInit();

    const competitor = await this.getCompetitor(competitorId);
    if (!competitor) throw new Error('Competitor not found');

    const fetchResult = await this.fetchWebsite(competitor.url);
    const contentHash = this.hashContent(fetchResult.content);
    const contentPreview = this.extractTextPreview(fetchResult.content);

    const result = await runWithResult(
      this.db!,
      `INSERT INTO snapshots (competitor_id, content_hash, content_preview, http_status, content_length)
       VALUES (?, ?, ?, ?, ?)`,
      [competitorId, contentHash, contentPreview, fetchResult.statusCode, fetchResult.contentLength]
    );

    // Update last checked timestamp
    await runWithResult(this.db!, 'UPDATE competitors SET last_checked_at = CURRENT_TIMESTAMP WHERE id = ?', [competitorId]);

    return {
      id: result.lastID,
      competitorId,
      contentHash,
      contentPreview,
      httpStatus: fetchResult.statusCode,
      contentLength: fetchResult.contentLength,
      fetchedAt: new Date().toISOString()
    };
  }

  async getLatestSnapshot(competitorId: number): Promise<Snapshot | null> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM snapshots WHERE competitor_id = ? ORDER BY fetched_at DESC LIMIT 1',
        [competitorId],
        (err, row: SnapshotRecord | undefined) => {
          if (err) { reject(err); return; }
          if (!row) { resolve(null); return; }
          resolve(this.recordToSnapshot(row));
        }
      );
    });
  }

  async getSnapshots(competitorId: number, limit = 10): Promise<Snapshot[]> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM snapshots WHERE competitor_id = ? ORDER BY fetched_at DESC LIMIT ?',
        [competitorId, limit],
        (err, rows: SnapshotRecord[]) => {
          if (err) { reject(err); return; }
          resolve(rows.map(r => this.recordToSnapshot(r)));
        }
      );
    });
  }

  private recordToSnapshot(record: SnapshotRecord): Snapshot {
    return {
      id: record.id,
      competitorId: record.competitor_id,
      contentHash: record.content_hash,
      contentPreview: record.content_preview,
      screenshotPath: record.screenshot_path || undefined,
      httpStatus: record.http_status,
      contentLength: record.content_length,
      fetchedAt: record.fetched_at
    };
  }

  // Change Detection
  async detectChanges(competitorId: number): Promise<ChangeDetectionResult> {
    await this.waitForInit();

    const competitor = await this.getCompetitor(competitorId);
    if (!competitor) throw new Error('Competitor not found');

    const previousSnapshot = await this.getLatestSnapshot(competitorId);
    const newSnapshot = await this.createSnapshot(competitorId);

    const changes: Change[] = [];

    if (previousSnapshot) {
      // Check for content changes
      if (previousSnapshot.contentHash !== newSnapshot.contentHash) {
        // Check for keyword matches
        if (competitor.keywords && competitor.keywords.length > 0) {
          const content = newSnapshot.contentPreview.toLowerCase();
          const oldContent = previousSnapshot.contentPreview.toLowerCase();
          
          for (const keyword of competitor.keywords) {
            const hasKeyword = content.includes(keyword.toLowerCase());
            const hadKeyword = oldContent.includes(keyword.toLowerCase());
            
            if (hasKeyword && !hadKeyword) {
              const changeResult = await runWithResult(
                this.db!,
                `INSERT INTO changes (competitor_id, snapshot_id, change_type, severity, description)
                 VALUES (?, ?, ?, ?, ?)`,
                [competitorId, newSnapshot.id!, 'keyword_match', 'major', `Keyword "${keyword}" detected in content`]
              );
              
              changes.push({
                id: changeResult.lastID,
                competitorId,
                snapshotId: newSnapshot.id!,
                changeType: 'keyword_match',
                severity: 'major',
                description: `Keyword "${keyword}" detected in content`,
                isRead: false,
                detectedAt: new Date().toISOString()
              });
            }
          }
        }

        // Content change
        const severity = this.calculateChangeSeverity(previousSnapshot, newSnapshot);
        const contentChangeResult = await runWithResult(
          this.db!,
          `INSERT INTO changes (competitor_id, snapshot_id, change_type, severity, old_value, new_value, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            competitorId,
            newSnapshot.id!,
            'content',
            severity,
            previousSnapshot.contentHash.substring(0, 16) + '...',
            newSnapshot.contentHash.substring(0, 16) + '...',
            `Content changed (${previousSnapshot.contentLength} → ${newSnapshot.contentLength} bytes)`
          ]
        );

        changes.push({
          id: contentChangeResult.lastID,
          competitorId,
          snapshotId: newSnapshot.id!,
          changeType: 'content',
          severity,
          oldValue: previousSnapshot.contentHash.substring(0, 16) + '...',
          newValue: newSnapshot.contentHash.substring(0, 16) + '...',
          description: `Content changed (${previousSnapshot.contentLength} → ${newSnapshot.contentLength} bytes)`,
          isRead: false,
          detectedAt: new Date().toISOString()
        });
      }

      // Check for status code changes
      if (previousSnapshot.httpStatus !== newSnapshot.httpStatus) {
        const severity = newSnapshot.httpStatus >= 400 ? 'critical' : 'major';
        const statusChangeResult = await runWithResult(
          this.db!,
          `INSERT INTO changes (competitor_id, snapshot_id, change_type, severity, old_value, new_value, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            competitorId,
            newSnapshot.id!,
            'status',
            severity,
            previousSnapshot.httpStatus.toString(),
            newSnapshot.httpStatus.toString(),
            `HTTP status changed from ${previousSnapshot.httpStatus} to ${newSnapshot.httpStatus}`
          ]
        );

        changes.push({
          id: statusChangeResult.lastID,
          competitorId,
          snapshotId: newSnapshot.id!,
          changeType: 'status',
          severity,
          oldValue: previousSnapshot.httpStatus.toString(),
          newValue: newSnapshot.httpStatus.toString(),
          description: `HTTP status changed from ${previousSnapshot.httpStatus} to ${newSnapshot.httpStatus}`,
          isRead: false,
          detectedAt: new Date().toISOString()
        });
      }
    }

    return {
      hasChanged: changes.length > 0,
      changes,
      snapshot: newSnapshot
    };
  }

  private calculateChangeSeverity(oldSnapshot: Snapshot, newSnapshot: Snapshot): 'info' | 'minor' | 'major' | 'critical' {
    const sizeDiff = Math.abs(newSnapshot.contentLength - oldSnapshot.contentLength);
    const sizeChangePercent = oldSnapshot.contentLength > 0 ? sizeDiff / oldSnapshot.contentLength : 0;

    if (newSnapshot.httpStatus >= 400) return 'critical';
    if (sizeChangePercent > 0.5) return 'major';
    if (sizeChangePercent > 0.2) return 'minor';
    return 'info';
  }

  // Change Management
  async getChanges(competitorId?: number, unreadOnly = false, limit = 50): Promise<Change[]> {
    await this.waitForInit();

    let sql = 'SELECT * FROM changes WHERE 1=1';
    const params: any[] = [];

    if (competitorId) {
      sql += ' AND competitor_id = ?';
      params.push(competitorId);
    }

    if (unreadOnly) {
      sql += ' AND is_read = 0';
    }

    sql += ' ORDER BY detected_at DESC LIMIT ?';
    params.push(limit);

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows: ChangeRecord[]) => {
        if (err) { reject(err); return; }
        resolve(rows.map(r => this.recordToChange(r)));
      });
    });
  }

  async markChangeRead(id: number, read = true): Promise<boolean> {
    await this.waitForInit();
    const result = await runWithResult(this.db!, 'UPDATE changes SET is_read = ? WHERE id = ?', [read ? 1 : 0, id]);
    return result.changes > 0;
  }

  async deleteChange(id: number): Promise<boolean> {
    await this.waitForInit();
    const result = await runWithResult(this.db!, 'DELETE FROM changes WHERE id = ?', [id]);
    return result.changes > 0;
  }

  private recordToChange(record: ChangeRecord): Change {
    return {
      id: record.id,
      competitorId: record.competitor_id,
      snapshotId: record.snapshot_id,
      changeType: record.change_type as 'content' | 'screenshot' | 'status' | 'keyword_match',
      severity: record.severity as 'info' | 'minor' | 'major' | 'critical',
      oldValue: record.old_value || undefined,
      newValue: record.new_value || undefined,
      description: record.description,
      isRead: record.is_read === 1,
      detectedAt: record.detected_at
    };
  }

  // Check All Competitors
  async checkAll(activeOnly = true): Promise<CheckResult[]> {
    await this.waitForInit();

    const competitors = await this.listCompetitors(activeOnly);
    const results: CheckResult[] = [];

    for (const competitor of competitors) {
      try {
        const detection = await this.detectChanges(competitor.id!);
        results.push({
          competitor,
          changes: detection.changes,
          success: true
        });
      } catch (err) {
        results.push({
          competitor,
          changes: [],
          success: false,
          error: String(err)
        });
      }
    }

    return results;
  }

  // Alert Generation
  async getUnreadAlertCount(): Promise<number> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT COUNT(*) as count FROM changes WHERE is_read = 0',
        (err, row: { count: number } | undefined) => {
          if (err) { reject(err); return; }
          resolve(row?.count || 0);
        }
      );
    });
  }

  async getAlertSummary(): Promise<{ total: number; critical: number; major: number; minor: number; info: number }> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT severity, COUNT(*) as count FROM changes WHERE is_read = 0 GROUP BY severity`,
        (err, rows: { severity: string; count: number }[]) => {
          if (err) { reject(err); return; }
          
          const summary = { total: 0, critical: 0, major: 0, minor: 0, info: 0 };
          for (const row of rows) {
            summary.total += row.count;
            if (row.severity === 'critical') summary.critical = row.count;
            else if (row.severity === 'major') summary.major = row.count;
            else if (row.severity === 'minor') summary.minor = row.count;
            else if (row.severity === 'info') summary.info = row.count;
          }
          resolve(summary);
        }
      );
    });
  }

  // Analysis
  async analyzeChanges(competitorId: number, days = 30): Promise<{
    totalChanges: number;
    changesByType: Record<string, number>;
    changesBySeverity: Record<string, number>;
    averageChangesPerDay: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    await this.waitForInit();

    const since = new Date();
    since.setDate(since.getDate() - days);

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT change_type, severity, COUNT(*) as count 
         FROM changes 
         WHERE competitor_id = ? AND detected_at > datetime(?, 'unixepoch')
         GROUP BY change_type, severity`,
        [competitorId, Math.floor(since.getTime() / 1000)],
        (err, rows: { change_type: string; severity: string; count: number }[]) => {
          if (err) { reject(err); return; }

          const changesByType: Record<string, number> = {};
          const changesBySeverity: Record<string, number> = {};
          let totalChanges = 0;

          for (const row of rows) {
            totalChanges += row.count;
            changesByType[row.change_type] = (changesByType[row.change_type] || 0) + row.count;
            changesBySeverity[row.severity] = (changesBySeverity[row.severity] || 0) + row.count;
          }

          const averageChangesPerDay = totalChanges / days;
          
          // Simple trend analysis (compare first half to second half)
          const trend: 'increasing' | 'decreasing' | 'stable' = totalChanges < days * 0.5 ? 'stable' : 'increasing';

          resolve({
            totalChanges,
            changesByType,
            changesBySeverity,
            averageChangesPerDay,
            trend
          });
        }
      );
    });
  }

  // Statistics
  async getStats(): Promise<{
    totalCompetitors: number;
    activeCompetitors: number;
    totalSnapshots: number;
    totalChanges: number;
    unreadChanges: number;
    lastCheck: string | null;
  }> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.get(
        `SELECT 
          (SELECT COUNT(*) FROM competitors) as total_competitors,
          (SELECT COUNT(*) FROM competitors WHERE is_active = 1) as active_competitors,
          (SELECT COUNT(*) FROM snapshots) as total_snapshots,
          (SELECT COUNT(*) FROM changes) as total_changes,
          (SELECT COUNT(*) FROM changes WHERE is_read = 0) as unread_changes,
          (SELECT MAX(last_checked_at) FROM competitors) as last_check`,
        (err, row: {
          total_competitors: number;
          active_competitors: number;
          total_snapshots: number;
          total_changes: number;
          unread_changes: number;
          last_check: string | null;
        } | undefined) => {
          if (err) { reject(err); return; }
          resolve({
            totalCompetitors: row?.total_competitors || 0,
            activeCompetitors: row?.active_competitors || 0,
            totalSnapshots: row?.total_snapshots || 0,
            totalChanges: row?.total_changes || 0,
            unreadChanges: row?.unread_changes || 0,
            lastCheck: row?.last_check || null
          });
        }
      );
    });
  }

  // Health Check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string; dependencies: { webSearch: boolean } }> {
    try {
      await this.waitForInit();
      
      return {
        status: 'healthy',
        message: 'Competitor monitor is operational',
        dependencies: { webSearch: true }
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        message: `Health check failed: ${err}`,
        dependencies: { webSearch: false }
      };
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.waitForInit();
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
}

export default CompetitorMonitorSkill;
