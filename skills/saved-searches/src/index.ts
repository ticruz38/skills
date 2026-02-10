import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export interface SavedSearch {
  id?: number;
  name: string;
  query: string;
  type: 'web' | 'news';
  isActive: boolean;
  scheduleMinutes?: number;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount: number;
  createdAt?: string;
}

export interface SearchSnapshot {
  id?: number;
  savedSearchId: number;
  results: SearchResultItem[];
  resultCount: number;
  newItems: SearchResultItem[];
  changedItems: ChangedItem[];
  removedItems: SearchResultItem[];
  createdAt: string;
}

export interface SearchResultItem {
  id: string;
  title: string;
  url?: string;
  link?: string;
  snippet?: string;
  description?: string;
  source?: string;
  guid?: string;
  pubDate?: string;
  [key: string]: any;
}

export interface ChangedItem {
  item: SearchResultItem;
  previousItem: SearchResultItem;
  changes: string[];
}

export interface ComparisonResult {
  newItems: SearchResultItem[];
  changedItems: ChangedItem[];
  removedItems: SearchResultItem[];
  unchangedItems: SearchResultItem[];
}

export interface SearchAlert {
  id?: number;
  savedSearchId: number;
  snapshotId: number;
  alertType: 'new_item' | 'changed' | 'removed';
  message: string;
  details: any;
  isRead: boolean;
  createdAt: string;
}

interface SavedSearchRecord {
  id: number;
  name: string;
  query: string;
  type: 'web' | 'news';
  is_active: number;
  schedule_minutes?: number;
  last_run_at?: string;
  next_run_at?: string;
  run_count: number;
  created_at: string;
}

interface SearchSnapshotRecord {
  id: number;
  saved_search_id: number;
  results: string;
  result_count: number;
  new_items: string;
  changed_items: string;
  removed_items: string;
  created_at: string;
}

interface SearchAlertRecord {
  id: number;
  saved_search_id: number;
  snapshot_id: number;
  alert_type: 'new_item' | 'changed' | 'removed';
  message: string;
  details: string;
  is_read: number;
  created_at: string;
}

export class SavedSearchesSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor(options: { dbPath?: string } = {}) {
    this.dbPath = options.dbPath || path.join(os.homedir(), '.openclaw', 'skills', 'saved-searches', 'data.db');
    this.initPromise = this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, (err: Error | null) => {
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
      CREATE TABLE IF NOT EXISTS saved_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        query TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('web', 'news')),
        is_active INTEGER DEFAULT 1,
        schedule_minutes INTEGER,
        last_run_at DATETIME,
        next_run_at DATETIME,
        run_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_searches_active ON saved_searches(is_active);
      CREATE INDEX IF NOT EXISTS idx_searches_type ON saved_searches(type);
      CREATE INDEX IF NOT EXISTS idx_searches_next_run ON saved_searches(next_run_at);
      
      CREATE TABLE IF NOT EXISTS search_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        saved_search_id INTEGER NOT NULL,
        results TEXT NOT NULL,
        result_count INTEGER NOT NULL,
        new_items TEXT NOT NULL,
        changed_items TEXT NOT NULL,
        removed_items TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (saved_search_id) REFERENCES saved_searches(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_snapshots_search ON search_snapshots(saved_search_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_created ON search_snapshots(created_at);
      
      CREATE TABLE IF NOT EXISTS search_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        saved_search_id INTEGER NOT NULL,
        snapshot_id INTEGER NOT NULL,
        alert_type TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (saved_search_id) REFERENCES saved_searches(id) ON DELETE CASCADE,
        FOREIGN KEY (snapshot_id) REFERENCES search_snapshots(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_alerts_search ON search_alerts(saved_search_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_read ON search_alerts(is_read);
      CREATE INDEX IF NOT EXISTS idx_alerts_created ON search_alerts(created_at);
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

  // Saved Search CRUD
  async createSearch(
    name: string,
    query: string,
    type: 'web' | 'news',
    options: { scheduleMinutes?: number; isActive?: boolean } = {}
  ): Promise<SavedSearch> {
    await this.waitForInit();

    const isActive = options.isActive ?? true;
    const scheduleMinutes = options.scheduleMinutes;
    
    // Calculate next run time if scheduled
    let nextRunAt: string | undefined;
    if (scheduleMinutes && isActive) {
      nextRunAt = new Date(Date.now() + scheduleMinutes * 60 * 1000).toISOString();
    }

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO saved_searches (name, query, type, is_active, schedule_minutes, next_run_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, query, type, isActive ? 1 : 0, scheduleMinutes || null, nextRunAt || null],
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            id: this.lastID,
            name,
            query,
            type,
            isActive,
            scheduleMinutes,
            nextRunAt,
            runCount: 0,
            createdAt: new Date().toISOString()
          });
        }
      );
    });
  }

  async getSearch(id: number): Promise<SavedSearch | null> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM saved_searches WHERE id = ?',
        [id],
        (err, row: SavedSearchRecord | undefined) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? this.recordToSearch(row) : null);
        }
      );
    });
  }

  async listSearches(type?: 'web' | 'news', activeOnly: boolean = false): Promise<SavedSearch[]> {
    await this.waitForInit();

    let sql = 'SELECT * FROM saved_searches WHERE 1=1';
    const params: any[] = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (activeOnly) {
      sql += ' AND is_active = 1';
    }

    sql += ' ORDER BY created_at DESC';

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows: SavedSearchRecord[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows.map(row => this.recordToSearch(row)));
      });
    });
  }

  async updateSearch(
    id: number,
    updates: Partial<Pick<SavedSearch, 'name' | 'query' | 'isActive' | 'scheduleMinutes'>>
  ): Promise<void> {
    await this.waitForInit();

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.query !== undefined) {
      fields.push('query = ?');
      values.push(updates.query);
    }
    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }
    if (updates.scheduleMinutes !== undefined) {
      fields.push('schedule_minutes = ?');
      values.push(updates.scheduleMinutes);
      // Recalculate next run if schedule changed
      if (updates.scheduleMinutes) {
        fields.push('next_run_at = ?');
        values.push(new Date(Date.now() + updates.scheduleMinutes * 60 * 1000).toISOString());
      }
    }

    if (fields.length === 0) return;

    values.push(id);

    return new Promise((resolve, reject) => {
      this.db!.run(
        `UPDATE saved_searches SET ${fields.join(', ')} WHERE id = ?`,
        values,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async deleteSearch(id: number): Promise<void> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.run('DELETE FROM saved_searches WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private recordToSearch(row: SavedSearchRecord): SavedSearch {
    return {
      id: row.id,
      name: row.name,
      query: row.query,
      type: row.type,
      isActive: row.is_active === 1,
      scheduleMinutes: row.schedule_minutes || undefined,
      lastRunAt: row.last_run_at || undefined,
      nextRunAt: row.next_run_at || undefined,
      runCount: row.run_count,
      createdAt: row.created_at
    };
  }

  // Search Execution
  async runSearch(searchId: number): Promise<{ snapshot: SearchSnapshot; comparison: ComparisonResult }> {
    await this.waitForInit();

    const search = await this.getSearch(searchId);
    if (!search) {
      throw new Error(`Saved search with ID ${searchId} not found`);
    }

    // Execute the search
    let results: SearchResultItem[];
    
    if (search.type === 'web') {
      results = await this.runWebSearch(search.query);
    } else {
      results = await this.runNewsSearch(search.query);
    }

    // Get previous snapshot for comparison
    const previousSnapshot = await this.getLatestSnapshot(searchId);

    // Compare results
    const comparison = this.compareResults(previousSnapshot?.results || [], results);

    // Create snapshot
    const snapshot = await this.createSnapshot(searchId, results, comparison);

    // Update search run info
    const nextRunAt = search.scheduleMinutes
      ? new Date(Date.now() + search.scheduleMinutes * 60 * 1000).toISOString()
      : undefined;

    await this.updateSearchRunInfo(searchId, nextRunAt);

    // Create alerts for new/changed items
    if (comparison.newItems.length > 0) {
      await this.createAlert(searchId, snapshot.id!, 'new_item', 
        `${comparison.newItems.length} new items found`,
        { items: comparison.newItems }
      );
    }

    if (comparison.changedItems.length > 0) {
      await this.createAlert(searchId, snapshot.id!, 'changed',
        `${comparison.changedItems.length} items changed`,
        { items: comparison.changedItems }
      );
    }

    if (comparison.removedItems.length > 0) {
      await this.createAlert(searchId, snapshot.id!, 'removed',
        `${comparison.removedItems.length} items removed`,
        { items: comparison.removedItems }
      );
    }

    return { snapshot, comparison };
  }

  private async runWebSearch(query: string): Promise<SearchResultItem[]> {
    // Dynamic import to handle ES modules
    const { WebSearchSkill } = await import('@openclaw/web-search');
    const webSearch = new WebSearchSkill();
    
    try {
      const response = await webSearch.search(query, { numResults: 20 });
      return response.results.map(r => ({
        id: r.url,
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        source: r.source,
        rank: r.rank
      }));
    } finally {
      await webSearch.close();
    }
  }

  private async runNewsSearch(query: string): Promise<SearchResultItem[]> {
    const { NewsAggregatorSkill } = await import('@openclaw/news-aggregator');
    const newsAggregator = new NewsAggregatorSkill();
    
    try {
      // First try to get filtered items by keywords
      const filteredResult = await newsAggregator.getFilteredItems({
        keywords: query.split(' '),
        limit: 50
      });

      return filteredResult.items.map(item => ({
        id: item.guid,
        title: item.title,
        link: item.link,
        description: item.description,
        guid: item.guid,
        pubDate: item.pubDate,
        source: 'RSS Feed'
      }));
    } finally {
      await newsAggregator.close();
    }
  }

  // Result Comparison
  private compareResults(previousResults: SearchResultItem[], currentResults: SearchResultItem[]): ComparisonResult {
    const previousMap = new Map(previousResults.map(r => [r.id || r.url || r.link || r.guid, r]));
    const currentMap = new Map(currentResults.map(r => [r.id || r.url || r.link || r.guid, r]));

    const newItems: SearchResultItem[] = [];
    const changedItems: ChangedItem[] = [];
    const removedItems: SearchResultItem[] = [];
    const unchangedItems: SearchResultItem[] = [];

    // Find new and changed items
    for (const [id, current] of currentMap) {
      const previous = previousMap.get(id);
      if (!previous) {
        newItems.push(current);
      } else {
        const changes = this.detectChanges(previous, current);
        if (changes.length > 0) {
          changedItems.push({
            item: current,
            previousItem: previous,
            changes
          });
        } else {
          unchangedItems.push(current);
        }
      }
    }

    // Find removed items
    for (const [id, previous] of previousMap) {
      if (!currentMap.has(id)) {
        removedItems.push(previous);
      }
    }

    return { newItems, changedItems, removedItems, unchangedItems };
  }

  private detectChanges(previous: SearchResultItem, current: SearchResultItem): string[] {
    const changes: string[] = [];
    const fieldsToCompare = ['title', 'snippet', 'description', 'pubDate'];

    for (const field of fieldsToCompare) {
      if (previous[field] !== current[field]) {
        changes.push(field);
      }
    }

    return changes;
  }

  // Snapshot Management
  private async createSnapshot(
    savedSearchId: number,
    results: SearchResultItem[],
    comparison: ComparisonResult
  ): Promise<SearchSnapshot> {
    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO search_snapshots 
         (saved_search_id, results, result_count, new_items, changed_items, removed_items)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          savedSearchId,
          JSON.stringify(results),
          results.length,
          JSON.stringify(comparison.newItems),
          JSON.stringify(comparison.changedItems),
          JSON.stringify(comparison.removedItems)
        ],
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            id: this.lastID,
            savedSearchId,
            results,
            resultCount: results.length,
            newItems: comparison.newItems,
            changedItems: comparison.changedItems,
            removedItems: comparison.removedItems,
            createdAt: new Date().toISOString()
          });
        }
      );
    });
  }

  async getLatestSnapshot(savedSearchId: number): Promise<SearchSnapshot | null> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM search_snapshots WHERE saved_search_id = ? ORDER BY created_at DESC LIMIT 1',
        [savedSearchId],
        (err, row: SearchSnapshotRecord | undefined) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? this.recordToSnapshot(row) : null);
        }
      );
    });
  }

  async getSnapshots(savedSearchId: number, limit: number = 10): Promise<SearchSnapshot[]> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM search_snapshots WHERE saved_search_id = ? ORDER BY created_at DESC LIMIT ?',
        [savedSearchId, limit],
        (err, rows: SearchSnapshotRecord[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map(row => this.recordToSnapshot(row)));
        }
      );
    });
  }

  private recordToSnapshot(row: SearchSnapshotRecord): SearchSnapshot {
    return {
      id: row.id,
      savedSearchId: row.saved_search_id,
      results: JSON.parse(row.results),
      resultCount: row.result_count,
      newItems: JSON.parse(row.new_items),
      changedItems: JSON.parse(row.changed_items),
      removedItems: JSON.parse(row.removed_items),
      createdAt: row.created_at
    };
  }

  private async updateSearchRunInfo(searchId: number, nextRunAt?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.run(
        `UPDATE saved_searches 
         SET last_run_at = CURRENT_TIMESTAMP, 
             next_run_at = ?,
             run_count = run_count + 1
         WHERE id = ?`,
        [nextRunAt || null, searchId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Alert Management
  private async createAlert(
    savedSearchId: number,
    snapshotId: number,
    alertType: 'new_item' | 'changed' | 'removed',
    message: string,
    details: any
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO search_alerts (saved_search_id, snapshot_id, alert_type, message, details)
         VALUES (?, ?, ?, ?, ?)`,
        [savedSearchId, snapshotId, alertType, message, JSON.stringify(details)],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getAlerts(savedSearchId?: number, unreadOnly: boolean = false): Promise<SearchAlert[]> {
    await this.waitForInit();

    let sql = 'SELECT * FROM search_alerts WHERE 1=1';
    const params: any[] = [];

    if (savedSearchId !== undefined) {
      sql += ' AND saved_search_id = ?';
      params.push(savedSearchId);
    }

    if (unreadOnly) {
      sql += ' AND is_read = 0';
    }

    sql += ' ORDER BY created_at DESC';

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows: SearchAlertRecord[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows.map(row => this.recordToAlert(row)));
      });
    });
  }

  async markAlertRead(id: number, isRead: boolean = true): Promise<void> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.run(
        'UPDATE search_alerts SET is_read = ? WHERE id = ?',
        [isRead ? 1 : 0, id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async markAllAlertsRead(savedSearchId?: number): Promise<number> {
    await this.waitForInit();

    let sql = 'UPDATE search_alerts SET is_read = 1 WHERE is_read = 0';
    const params: any[] = [];

    if (savedSearchId !== undefined) {
      sql += ' AND saved_search_id = ?';
      params.push(savedSearchId);
    }

    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async deleteAlert(id: number): Promise<void> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.run('DELETE FROM search_alerts WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private recordToAlert(row: SearchAlertRecord): SearchAlert {
    return {
      id: row.id,
      savedSearchId: row.saved_search_id,
      snapshotId: row.snapshot_id,
      alertType: row.alert_type,
      message: row.message,
      details: JSON.parse(row.details),
      isRead: row.is_read === 1,
      createdAt: row.created_at
    };
  }

  // Scheduled Execution
  async getDueSearches(): Promise<SavedSearch[]> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT * FROM saved_searches 
         WHERE is_active = 1 
         AND schedule_minutes IS NOT NULL
         AND (next_run_at IS NULL OR next_run_at <= datetime('now'))
         ORDER BY next_run_at ASC`,
        (err, rows: SavedSearchRecord[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map(row => this.recordToSearch(row)));
        }
      );
    });
  }

  async runAllDue(): Promise<{ search: SavedSearch; result: { snapshot: SearchSnapshot; comparison: ComparisonResult } }[]> {
    const dueSearches = await this.getDueSearches();
    const results: { search: SavedSearch; result: { snapshot: SearchSnapshot; comparison: ComparisonResult } }[] = [];

    for (const search of dueSearches) {
      try {
        const result = await this.runSearch(search.id!);
        results.push({ search, result });
      } catch (err) {
        console.error(`Failed to run search ${search.id}: ${err}`);
      }
    }

    return results;
  }

  // Statistics
  async getStats(): Promise<{
    totalSearches: number;
    activeSearches: number;
    webSearches: number;
    newsSearches: number;
    totalSnapshots: number;
    totalAlerts: number;
    unreadAlerts: number;
    scheduledSearches: number;
  }> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.get(
        `SELECT 
          (SELECT COUNT(*) FROM saved_searches) as total_searches,
          (SELECT COUNT(*) FROM saved_searches WHERE is_active = 1) as active_searches,
          (SELECT COUNT(*) FROM saved_searches WHERE type = 'web') as web_searches,
          (SELECT COUNT(*) FROM saved_searches WHERE type = 'news') as news_searches,
          (SELECT COUNT(*) FROM search_snapshots) as total_snapshots,
          (SELECT COUNT(*) FROM search_alerts) as total_alerts,
          (SELECT COUNT(*) FROM search_alerts WHERE is_read = 0) as unread_alerts,
          (SELECT COUNT(*) FROM saved_searches WHERE schedule_minutes IS NOT NULL) as scheduled_searches`,
        (err, row: {
          total_searches: number;
          active_searches: number;
          web_searches: number;
          news_searches: number;
          total_snapshots: number;
          total_alerts: number;
          unread_alerts: number;
          scheduled_searches: number;
        } | undefined) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            totalSearches: row?.total_searches || 0,
            activeSearches: row?.active_searches || 0,
            webSearches: row?.web_searches || 0,
            newsSearches: row?.news_searches || 0,
            totalSnapshots: row?.total_snapshots || 0,
            totalAlerts: row?.total_alerts || 0,
            unreadAlerts: row?.unread_alerts || 0,
            scheduledSearches: row?.scheduled_searches || 0
          });
        }
      );
    });
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      await this.waitForInit();
      const stats = await this.getStats();
      
      return {
        status: 'healthy',
        message: `Saved searches operational. ${stats.totalSearches} searches, ${stats.totalSnapshots} snapshots, ${stats.unreadAlerts} unread alerts.`
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        message: `Health check failed: ${err}`
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

export default SavedSearchesSkill;
