import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as https from 'https';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  rank: number;
}

export interface SearchOptions {
  numResults?: number;
  safeSearch?: boolean;
  recencyDays?: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  fromCache: boolean;
}

export interface CachedResult {
  id?: number;
  query: string;
  results: SearchResult[];
  totalResults: number;
  createdAt: string;
}

interface CacheRecord {
  id: number;
  query: string;
  results: string;
  total_results: number;
  created_at: string;
}

export class WebSearchSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private enableCache: boolean;
  private serperApiKey: string | null;
  private initPromise: Promise<void> | null = null;

  constructor(options: { enableCache?: boolean; dbPath?: string } = {}) {
    this.enableCache = options.enableCache ?? true;
    this.dbPath = options.dbPath || path.join(os.homedir(), '.openclaw', 'skills', 'web-search', 'cache.db');
    this.serperApiKey = process.env.SERPER_API_KEY || null;
    
    if (this.enableCache) {
      this.initPromise = this.initializeDatabase();
    }
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
      CREATE TABLE IF NOT EXISTS search_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL UNIQUE,
        results TEXT NOT NULL,
        total_results INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_cache_query ON search_cache(query);
      CREATE INDEX IF NOT EXISTS idx_cache_created ON search_cache(created_at);
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

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const startTime = Date.now();
    const numResults = options.numResults ?? 10;
    const safeSearch = options.safeSearch ?? true;

    await this.waitForInit();

    // Check cache first
    if (this.enableCache) {
      const cached = await this.getCachedResultsInternal(query);
      if (cached) {
        return {
          query,
          results: cached.results.slice(0, numResults),
          totalResults: cached.totalResults,
          searchTime: Date.now() - startTime,
          fromCache: true
        };
      }
    }

    // Perform search
    let results: SearchResult[];
    let totalResults: number;

    if (this.serperApiKey) {
      const response = await this.searchWithSerper(query, numResults, safeSearch);
      results = response.results;
      totalResults = response.totalResults;
    } else {
      const response = await this.searchWithScraping(query, numResults, safeSearch);
      results = response.results;
      totalResults = response.totalResults;
    }

    // Cache results
    if (this.enableCache) {
      await this.cacheResults(query, results, totalResults);
    }

    return {
      query,
      results: results.slice(0, numResults),
      totalResults,
      searchTime: Date.now() - startTime,
      fromCache: false
    };
  }

  private async searchWithSerper(
    query: string,
    numResults: number,
    safeSearch: boolean
  ): Promise<{ results: SearchResult[]; totalResults: number }> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        q: query,
        num: numResults,
        safe: safeSearch ? 'active' : 'off'
      });

      const requestOptions = {
        hostname: 'google.serper.dev',
        path: '/search',
        method: 'POST',
        headers: {
          'X-API-KEY': this.serperApiKey!,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const results: SearchResult[] = (response.organic || []).map((item: any, index: number) => ({
              title: item.title || '',
              url: item.link || '',
              snippet: item.snippet || '',
              source: this.extractSource(item.link || ''),
              rank: index + 1
            }));

            resolve({
              results,
              totalResults: response.searchInformation?.totalResults || results.length
            });
          } catch (err) {
            reject(new Error(`Failed to parse Serper response: ${err}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(postData);
      req.end();
    });
  }

  private async searchWithScraping(
    query: string,
    numResults: number,
    _safeSearch: boolean
  ): Promise<{ results: SearchResult[]; totalResults: number }> {
    // Simulate search results for scraping mode (in production, this would scrape search engines)
    // For now, return a mock response that indicates no API key is available
    const encodedQuery = encodeURIComponent(query);
    
    // Return simulated results pointing to popular search engines
    const results: SearchResult[] = [
      {
        title: `Search results for "${query}" - Google`,
        url: `https://www.google.com/search?q=${encodedQuery}`,
        snippet: `View Google search results for "${query}". For automated results, set SERPER_API_KEY environment variable.`,
        source: 'google.com',
        rank: 1
      },
      {
        title: `Search results for "${query}" - Bing`,
        url: `https://www.bing.com/search?q=${encodedQuery}`,
        snippet: `View Bing search results for "${query}". For automated results, set SERPER_API_KEY environment variable.`,
        source: 'bing.com',
        rank: 2
      },
      {
        title: `Search results for "${query}" - DuckDuckGo`,
        url: `https://duckduckgo.com/?q=${encodedQuery}`,
        snippet: `View DuckDuckGo search results for "${query}" with privacy protection.`,
        source: 'duckduckgo.com',
        rank: 3
      }
    ];

    return {
      results: results.slice(0, numResults),
      totalResults: results.length
    };
  }

  private extractSource(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }

  private async getCachedResultsInternal(query: string): Promise<CachedResult | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM search_cache WHERE query = ? AND created_at > datetime("now", "-7 days")',
        [query.toLowerCase().trim()],
        (err, row: CacheRecord | undefined) => {
          if (err) {
            reject(err);
            return;
          }
          if (!row) {
            resolve(null);
            return;
          }
          resolve({
            id: row.id,
            query: row.query,
            results: JSON.parse(row.results),
            totalResults: row.total_results,
            createdAt: row.created_at
          });
        }
      );
    });
  }

  async getCachedResults(query: string): Promise<CachedResult | null> {
    await this.waitForInit();
    return this.getCachedResultsInternal(query);
  }

  private async cacheResults(query: string, results: SearchResult[], totalResults: number): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO search_cache (query, results, total_results) 
         VALUES (?, ?, ?)
         ON CONFLICT(query) DO UPDATE SET
           results = excluded.results,
           total_results = excluded.total_results,
           created_at = CURRENT_TIMESTAMP`,
        [query.toLowerCase().trim(), JSON.stringify(results), totalResults],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async clearCache(olderThanDays?: number): Promise<number> {
    await this.waitForInit();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      let sql: string;
      let params: any[] = [];

      if (olderThanDays) {
        sql = 'DELETE FROM search_cache WHERE created_at < datetime("now", ?)';
        params = [`-${olderThanDays} days`];
      } else {
        sql = 'DELETE FROM search_cache';
      }

      this.db!.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async getCacheStats(): Promise<{ totalEntries: number; oldestEntry: string | null; newestEntry: string | null }> {
    await this.waitForInit();
    if (!this.db) {
      return { totalEntries: 0, oldestEntry: null, newestEntry: null };
    }

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT COUNT(*) as count, MIN(created_at) as oldest, MAX(created_at) as newest FROM search_cache',
        (err, row: { count: number; oldest: string | null; newest: string | null } | undefined) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            totalEntries: row?.count || 0,
            oldestEntry: row?.oldest || null,
            newestEntry: row?.newest || null
          });
        }
      );
    });
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string; apiAvailable: boolean }> {
    try {
      await this.waitForInit();
      
      const apiAvailable = !!this.serperApiKey;
      
      if (apiAvailable) {
        // Test API connectivity
        try {
          await this.searchWithSerper('test', 1, true);
          return {
            status: 'healthy',
            message: 'Web search skill is operational with Serper API',
            apiAvailable: true
          };
        } catch (err) {
          return {
            status: 'unhealthy',
            message: `Serper API error: ${err}`,
            apiAvailable: false
          };
        }
      }

      return {
        status: 'healthy',
        message: 'Web search skill is operational (fallback mode - set SERPER_API_KEY for automated results)',
        apiAvailable: false
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        message: `Health check failed: ${err}`,
        apiAvailable: false
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

export default WebSearchSkill;
