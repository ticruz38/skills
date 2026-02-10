import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { XMLParser } from 'fast-xml-parser';

export interface FeedSource {
  id?: number;
  name: string;
  url: string;
  category?: string;
  isActive: boolean;
  lastFetchAt?: string;
  fetchErrorCount: number;
  createdAt?: string;
}

export interface FeedItem {
  id?: number;
  sourceId: number;
  title: string;
  description: string;
  link: string;
  guid: string;
  pubDate: string;
  author?: string;
  categories: string[];
  isRead: boolean;
  isSaved: boolean;
  fetchedAt: string;
}

export interface KeywordFilter {
  id?: number;
  keyword: string;
  isInclude: boolean;
  priority: number;
  createdAt?: string;
}

export interface FetchResult {
  source: FeedSource;
  itemsAdded: number;
  itemsUpdated: number;
  errors: string[];
}

export interface FilteredItemsResult {
  items: FeedItem[];
  totalCount: number;
  page: number;
  perPage: number;
}

interface FeedSourceRecord {
  id: number;
  name: string;
  url: string;
  category: string | null;
  is_active: number;
  last_fetch_at: string | null;
  fetch_error_count: number;
  created_at: string;
}

interface FeedItemRecord {
  id: number;
  source_id: number;
  title: string;
  description: string;
  link: string;
  guid: string;
  pub_date: string;
  author: string | null;
  categories: string;
  is_read: number;
  is_saved: number;
  fetched_at: string;
}

interface KeywordFilterRecord {
  id: number;
  keyword: string;
  is_include: number;
  priority: number;
  created_at: string;
}

export class NewsAggregatorSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;
  private xmlParser: XMLParser;

  constructor(options: { dbPath?: string } = {}) {
    this.dbPath = options.dbPath || path.join(os.homedir(), '.openclaw', 'skills', 'news-aggregator', 'feeds.db');
    this.initPromise = this.initializeDatabase();
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: false,
      trimValues: true
    });
  }

  private async initializeDatabase(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
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
      CREATE TABLE IF NOT EXISTS feed_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        category TEXT,
        is_active INTEGER DEFAULT 1,
        last_fetch_at DATETIME,
        fetch_error_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_sources_active ON feed_sources(is_active);
      
      CREATE TABLE IF NOT EXISTS feed_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        link TEXT NOT NULL,
        guid TEXT NOT NULL,
        pub_date DATETIME NOT NULL,
        author TEXT,
        categories TEXT,
        is_read INTEGER DEFAULT 0,
        is_saved INTEGER DEFAULT 0,
        fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_id) REFERENCES feed_sources(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_items_guid ON feed_items(guid);
      CREATE INDEX IF NOT EXISTS idx_items_pub_date ON feed_items(pub_date);
      CREATE INDEX IF NOT EXISTS idx_items_source ON feed_items(source_id);
      CREATE INDEX IF NOT EXISTS idx_items_read ON feed_items(is_read);
      CREATE INDEX IF NOT EXISTS idx_items_saved ON feed_items(is_saved);
      
      CREATE TABLE IF NOT EXISTS keyword_filters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL,
        is_include INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_filters_keyword ON keyword_filters(keyword);
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

  // Source Management
  async addSource(name: string, url: string, category?: string): Promise<FeedSource> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.run(
        'INSERT INTO feed_sources (name, url, category, is_active) VALUES (?, ?, ?, 1)',
        [name, url, category || null],
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            id: this.lastID,
            name,
            url,
            category,
            isActive: true,
            fetchErrorCount: 0
          });
        }
      );
    });
  }

  async updateSource(id: number, updates: Partial<Omit<FeedSource, 'id' | 'createdAt'>>): Promise<void> {
    await this.waitForInit();

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.url !== undefined) {
      fields.push('url = ?');
      values.push(updates.url);
    }
    if (updates.category !== undefined) {
      fields.push('category = ?');
      values.push(updates.category);
    }
    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }

    if (fields.length === 0) return;

    values.push(id);

    return new Promise((resolve, reject) => {
      this.db!.run(
        `UPDATE feed_sources SET ${fields.join(', ')} WHERE id = ?`,
        values,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async deleteSource(id: number): Promise<void> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.run('DELETE FROM feed_sources WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getSources(activeOnly: boolean = false): Promise<FeedSource[]> {
    await this.waitForInit();

    const sql = activeOnly
      ? 'SELECT * FROM feed_sources WHERE is_active = 1 ORDER BY name'
      : 'SELECT * FROM feed_sources ORDER BY name';

    return new Promise((resolve, reject) => {
      this.db!.all(sql, (err, rows: FeedSourceRecord[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows.map(row => this.recordToSource(row)));
      });
    });
  }

  async getSource(id: number): Promise<FeedSource | null> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.get('SELECT * FROM feed_sources WHERE id = ?', [id], (err, row: FeedSourceRecord | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row ? this.recordToSource(row) : null);
      });
    });
  }

  private recordToSource(row: FeedSourceRecord): FeedSource {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      category: row.category || undefined,
      isActive: row.is_active === 1,
      lastFetchAt: row.last_fetch_at || undefined,
      fetchErrorCount: row.fetch_error_count,
      createdAt: row.created_at
    };
  }

  // Keyword Filtering
  async addKeywordFilter(keyword: string, isInclude: boolean = true, priority: number = 0): Promise<KeywordFilter> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.run(
        'INSERT INTO keyword_filters (keyword, is_include, priority) VALUES (?, ?, ?)',
        [keyword.toLowerCase(), isInclude ? 1 : 0, priority],
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            id: this.lastID,
            keyword: keyword.toLowerCase(),
            isInclude,
            priority,
            createdAt: new Date().toISOString()
          });
        }
      );
    });
  }

  async deleteKeywordFilter(id: number): Promise<void> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.run('DELETE FROM keyword_filters WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getKeywordFilters(): Promise<KeywordFilter[]> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM keyword_filters ORDER BY priority DESC, keyword',
        (err, rows: KeywordFilterRecord[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map(row => ({
            id: row.id,
            keyword: row.keyword,
            isInclude: row.is_include === 1,
            priority: row.priority,
            createdAt: row.created_at
          })));
        }
      );
    });
  }

  // Feed Fetching
  async fetchFeed(url: string): Promise<{ items: Partial<FeedItem>[]; title: string; description: string }> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      protocol.get(url, { timeout: 30000 }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = this.parseFeed(data, url);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        });
      }).on('error', reject).on('timeout', () => reject(new Error('Request timeout')));
    });
  }

  private parseFeed(xml: string, sourceUrl: string): { items: Partial<FeedItem>[]; title: string; description: string } {
    const parsed = this.xmlParser.parse(xml);
    
    // Handle RSS 2.0
    if (parsed.rss?.channel) {
      const channel = parsed.rss.channel;
      return {
        title: channel.title || 'Unknown Feed',
        description: channel.description || '',
        items: this.parseRssItems(channel.item || [], sourceUrl)
      };
    }
    
    // Handle Atom
    if (parsed.feed) {
      const feed = parsed.feed;
      return {
        title: feed.title?.['#text'] || feed.title || 'Unknown Feed',
        description: feed.subtitle?.['#text'] || feed.subtitle || '',
        items: this.parseAtomItems(feed.entry || [], sourceUrl)
      };
    }
    
    throw new Error('Unknown feed format');
  }

  private parseRssItems(items: any[], _sourceUrl: string): Partial<FeedItem>[] {
    if (!Array.isArray(items)) {
      items = items ? [items] : [];
    }
    
    return items.map(item => ({
      title: this.cleanText(item.title || 'No Title'),
      description: this.cleanText(item.description || item['content:encoded'] || ''),
      link: item.link || '',
      guid: item.guid?.['#text'] || item.guid || item.link || '',
      pubDate: this.parseDate(item.pubDate || item.pubdate || new Date()),
      author: item.author || item['dc:creator'] || undefined,
      categories: this.parseCategories(item.category),
      fetchedAt: new Date().toISOString()
    }));
  }

  private parseAtomItems(entries: any[], _sourceUrl: string): Partial<FeedItem>[] {
    if (!Array.isArray(entries)) {
      entries = entries ? [entries] : [];
    }
    
    return entries.map(entry => {
      const link = Array.isArray(entry.link)
        ? entry.link.find((l: any) => l['@_rel'] === 'alternate')?.['@_href'] || entry.link[0]?.['@_href']
        : entry.link?.['@_href'] || '';
      
      return {
        title: this.cleanText(entry.title?.['#text'] || entry.title || 'No Title'),
        description: this.cleanText(
          entry.content?.['#text'] || entry.summary?.['#text'] || entry.content || entry.summary || ''
        ),
        link,
        guid: entry.id || link,
        pubDate: this.parseAtomDate(entry.updated || entry.published || new Date()),
        author: entry.author?.name || undefined,
        categories: this.parseCategories(entry.category),
        fetchedAt: new Date().toISOString()
      };
    });
  }

  private cleanText(text: string): string {
    if (!text) return '';
    // Remove HTML tags
    return text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseCategories(category: any): string[] {
    if (!category) return [];
    if (Array.isArray(category)) {
      return category.map(c => typeof c === 'string' ? c : c['#text'] || c['@_term'] || '').filter(Boolean);
    }
    if (typeof category === 'string') return [category];
    return [category['#text'] || category['@_term'] || ''].filter(Boolean);
  }

  private parseDate(dateStr: string | Date): string {
    if (dateStr instanceof Date) return dateStr.toISOString();
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
  }

  private parseAtomDate(dateStr: string | Date): string {
    return this.parseDate(dateStr);
  }

  async fetchAllSources(): Promise<FetchResult[]> {
    await this.waitForInit();
    
    const sources = await this.getSources(true);
    const results: FetchResult[] = [];

    for (const source of sources) {
      try {
        const result = await this.fetchSource(source);
        results.push(result);
      } catch (err) {
        results.push({
          source,
          itemsAdded: 0,
          itemsUpdated: 0,
          errors: [`${err}`]
        });
      }
    }

    return results;
  }

  async fetchSource(source: FeedSource): Promise<FetchResult> {
    const result: FetchResult = {
      source,
      itemsAdded: 0,
      itemsUpdated: 0,
      errors: []
    };

    try {
      const feed = await this.fetchFeed(source.url);
      
      for (const item of feed.items) {
        try {
          const existing = await this.getItemByGuid(item.guid!);
          if (existing) {
            // Update if content changed
            await this.updateItem(existing.id!, {
              title: item.title!,
              description: item.description!
            });
            result.itemsUpdated++;
          } else {
            // Insert new item
            await this.insertItem({
              ...item,
              sourceId: source.id!
            } as Partial<FeedItem>);
            result.itemsAdded++;
          }
        } catch (err) {
          result.errors.push(`Failed to process item "${item.title}": ${err}`);
        }
      }

      // Update source last fetch time
      await this.updateSource(source.id!, {
        lastFetchAt: new Date().toISOString()
      });
      
      // Reset error count on success
      if (source.fetchErrorCount > 0) {
        await this.resetSourceErrorCount(source.id!);
      }
    } catch (err) {
      result.errors.push(`Failed to fetch feed: ${err}`);
      await this.incrementSourceErrorCount(source.id!);
    }

    return result;
  }

  private async resetSourceErrorCount(sourceId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.run(
        'UPDATE feed_sources SET fetch_error_count = 0 WHERE id = ?',
        [sourceId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  private async incrementSourceErrorCount(sourceId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.run(
        'UPDATE feed_sources SET fetch_error_count = fetch_error_count + 1 WHERE id = ?',
        [sourceId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  private async getItemByGuid(guid: string): Promise<FeedItem | null> {
    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM feed_items WHERE guid = ?',
        [guid],
        (err, row: FeedItemRecord | undefined) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? this.recordToItem(row) : null);
        }
      );
    });
  }

  private async insertItem(item: Partial<FeedItem>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO feed_items (source_id, title, description, link, guid, pub_date, author, categories)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.sourceId,
          item.title,
          item.description,
          item.link,
          item.guid,
          item.pubDate,
          item.author || null,
          JSON.stringify(item.categories || [])
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  private async updateItem(id: number, updates: Partial<FeedItem>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.isRead !== undefined) {
      fields.push('is_read = ?');
      values.push(updates.isRead ? 1 : 0);
    }
    if (updates.isSaved !== undefined) {
      fields.push('is_saved = ?');
      values.push(updates.isSaved ? 1 : 0);
    }

    if (fields.length === 0) return;

    values.push(id);

    return new Promise((resolve, reject) => {
      this.db!.run(
        `UPDATE feed_items SET ${fields.join(', ')} WHERE id = ?`,
        values,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  private recordToItem(row: FeedItemRecord): FeedItem {
    return {
      id: row.id,
      sourceId: row.source_id,
      title: row.title,
      description: row.description,
      link: row.link,
      guid: row.guid,
      pubDate: row.pub_date,
      author: row.author || undefined,
      categories: JSON.parse(row.categories || '[]'),
      isRead: row.is_read === 1,
      isSaved: row.is_saved === 1,
      fetchedAt: row.fetched_at
    };
  }

  // Item Querying
  async getItems(options: {
    sourceId?: number;
    isRead?: boolean;
    isSaved?: boolean;
    limit?: number;
    offset?: number;
    since?: string;
  } = {}): Promise<FilteredItemsResult> {
    await this.waitForInit();

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    let whereClause = '1=1';
    const params: any[] = [];

    if (options.sourceId !== undefined) {
      whereClause += ' AND source_id = ?';
      params.push(options.sourceId);
    }
    if (options.isRead !== undefined) {
      whereClause += ' AND is_read = ?';
      params.push(options.isRead ? 1 : 0);
    }
    if (options.isSaved !== undefined) {
      whereClause += ' AND is_saved = ?';
      params.push(options.isSaved ? 1 : 0);
    }
    if (options.since) {
      whereClause += ' AND pub_date > ?';
      params.push(options.since);
    }

    const countParams = [...params];
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
      this.db!.get(
        `SELECT COUNT(*) as count FROM feed_items WHERE ${whereClause}`,
        countParams,
        (err, countRow: { count: number } | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          this.db!.all(
            `SELECT * FROM feed_items WHERE ${whereClause} ORDER BY pub_date DESC LIMIT ? OFFSET ?`,
            params,
            (err, rows: FeedItemRecord[]) => {
              if (err) {
                reject(err);
                return;
              }
              resolve({
                items: rows.map(row => this.recordToItem(row)),
                totalCount: countRow?.count || 0,
                page: Math.floor(offset / limit) + 1,
                perPage: limit
              });
            }
          );
        }
      );
    });
  }

  async getFilteredItems(options: {
    keywords?: string[];
    limit?: number;
    offset?: number;
    since?: string;
  } = {}): Promise<FilteredItemsResult> {
    await this.waitForInit();

    const filters = await this.getKeywordFilters();
    const includeFilters = filters.filter(f => f.isInclude);
    const excludeFilters = filters.filter(f => !f.isInclude);

    let items = (await this.getItems({
      limit: 1000,
      since: options.since
    })).items;

    // Apply keyword filtering
    if (includeFilters.length > 0 || excludeFilters.length > 0) {
      items = items.filter(item => {
        const text = `${item.title} ${item.description} ${item.categories.join(' ')}`.toLowerCase();
        
        // Check exclude filters first
        for (const filter of excludeFilters) {
          if (text.includes(filter.keyword)) return false;
        }
        
        // Check include filters (if any exist, at least one must match)
        if (includeFilters.length > 0) {
          return includeFilters.some(filter => text.includes(filter.keyword));
        }
        
        return true;
      });
    }

    // Additional keyword filter from options
    if (options.keywords && options.keywords.length > 0) {
      items = items.filter(item => {
        const text = `${item.title} ${item.description}`.toLowerCase();
        return options.keywords!.some(kw => text.includes(kw.toLowerCase()));
      });
    }

    const totalCount = items.length;
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    return {
      items: items.slice(offset, offset + limit),
      totalCount,
      page: Math.floor(offset / limit) + 1,
      perPage: limit
    };
  }

  async getItem(id: number): Promise<FeedItem | null> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.get('SELECT * FROM feed_items WHERE id = ?', [id], (err, row: FeedItemRecord | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row ? this.recordToItem(row) : null);
      });
    });
  }

  async markAsRead(id: number, isRead: boolean = true): Promise<void> {
    await this.waitForInit();
    await this.updateItem(id, { isRead });
  }

  async markAllAsRead(sourceId?: number): Promise<number> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      let sql = 'UPDATE feed_items SET is_read = 1 WHERE is_read = 0';
      const params: any[] = [];

      if (sourceId !== undefined) {
        sql += ' AND source_id = ?';
        params.push(sourceId);
      }

      this.db!.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async saveItem(id: number, isSaved: boolean = true): Promise<void> {
    await this.waitForInit();
    await this.updateItem(id, { isSaved });
  }

  async deleteItem(id: number): Promise<void> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.run('DELETE FROM feed_items WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // Deduplication
  async findDuplicates(): Promise<{ guid: string; count: number; ids: number[] }[]> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT guid, COUNT(*) as count, GROUP_CONCAT(id) as ids 
         FROM feed_items 
         GROUP BY guid 
         HAVING count > 1`,
        (err, rows: { guid: string; count: number; ids: string }[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map(row => ({
            guid: row.guid,
            count: row.count,
            ids: row.ids.split(',').map(Number)
          })));
        }
      );
    });
  }

  async removeDuplicates(keepNewest: boolean = true): Promise<number> {
    await this.waitForInit();

    const duplicates = await this.findDuplicates();
    let removed = 0;

    for (const dup of duplicates) {
      // Keep one, delete the rest
      const idsToDelete = keepNewest ? dup.ids.slice(1) : dup.ids.slice(0, -1);
      
      for (const id of idsToDelete) {
        await this.deleteItem(id);
        removed++;
      }
    }

    return removed;
  }

  // Stats
  async getStats(): Promise<{
    totalSources: number;
    activeSources: number;
    totalItems: number;
    unreadItems: number;
    savedItems: number;
    includeFilters: number;
    excludeFilters: number;
  }> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      this.db!.get(
        `SELECT 
          (SELECT COUNT(*) FROM feed_sources) as total_sources,
          (SELECT COUNT(*) FROM feed_sources WHERE is_active = 1) as active_sources,
          (SELECT COUNT(*) FROM feed_items) as total_items,
          (SELECT COUNT(*) FROM feed_items WHERE is_read = 0) as unread_items,
          (SELECT COUNT(*) FROM feed_items WHERE is_saved = 1) as saved_items,
          (SELECT COUNT(*) FROM keyword_filters WHERE is_include = 1) as include_filters,
          (SELECT COUNT(*) FROM keyword_filters WHERE is_include = 0) as exclude_filters`,
        (err, row: {
          total_sources: number;
          active_sources: number;
          total_items: number;
          unread_items: number;
          saved_items: number;
          include_filters: number;
          exclude_filters: number;
        } | undefined) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            totalSources: row?.total_sources || 0,
            activeSources: row?.active_sources || 0,
            totalItems: row?.total_items || 0,
            unreadItems: row?.unread_items || 0,
            savedItems: row?.saved_items || 0,
            includeFilters: row?.include_filters || 0,
            excludeFilters: row?.exclude_filters || 0
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
        message: `News aggregator operational. ${stats.totalSources} sources, ${stats.totalItems} items, ${stats.unreadItems} unread.`
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

export default NewsAggregatorSkill;
