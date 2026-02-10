import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Social media platforms
export type SocialPlatform = 'instagram' | 'twitter' | 'tiktok' | 'linkedin' | 'facebook' | 'generic';

// Hashtag category
export type HashtagCategory =
  | 'general'
  | 'lifestyle'
  | 'business'
  | 'tech'
  | 'fashion'
  | 'food'
  | 'travel'
  | 'fitness'
  | 'art'
  | 'photography'
  | 'music'
  | 'sports'
  | 'health'
  | 'education'
  | 'marketing'
  | 'entrepreneur';

// Hashtag data structure
export interface Hashtag {
  id?: number;
  tag: string;
  platform: SocialPlatform;
  category: HashtagCategory;
  postCount?: number;
  trendingScore: number;
  relevanceScore?: number;
  competitionLevel: 'low' | 'medium' | 'high';
  relatedTags: string[];
  description?: string;
  lastUpdated: string;
}

// Research request
export interface ResearchRequest {
  keywords: string[];
  platform?: SocialPlatform;
  category?: HashtagCategory;
  limit?: number;
  minPosts?: number;
  maxPosts?: number;
  includeTrending?: boolean;
  includeNiche?: boolean;
}

// Research result
export interface ResearchResult {
  query: string;
  platform: SocialPlatform;
  hashtags: Hashtag[];
  trending: Hashtag[];
  niche: Hashtag[];
  relatedKeywords: string[];
  generatedAt: string;
}

// Trending data
export interface TrendingData {
  platform: SocialPlatform;
  hashtags: Hashtag[];
  updatedAt: string;
}

// Niche discovery request
export interface NicheRequest {
  topic: string;
  platform?: SocialPlatform;
  depth?: number;
  minPostCount?: number;
  maxCompetition?: 'low' | 'medium' | 'high';
}

// Search history record
interface SearchHistoryRecord {
  id?: number;
  query: string;
  platform: string;
  results_count: number;
  created_at: string;
}

// Helper function for SQLite run with result
function runWithResult(
  db: sqlite3.Database,
  sql: string,
  params: any[] = []
): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Default hashtag database - popular hashtags organized by category
const DEFAULT_HASHTAGS: Partial<Hashtag>[] = [
  // General
  { tag: 'love', category: 'general', competitionLevel: 'high', relatedTags: ['life', 'happy', 'instagood'] },
  { tag: 'instagood', category: 'general', competitionLevel: 'high', relatedTags: ['photooftheday', 'beautiful', 'happy'] },
  { tag: 'photooftheday', category: 'general', competitionLevel: 'high', relatedTags: ['instagood', 'photography', 'beautiful'] },
  { tag: 'beautiful', category: 'general', competitionLevel: 'high', relatedTags: ['love', 'nature', 'photooftheday'] },
  { tag: 'happy', category: 'general', competitionLevel: 'high', relatedTags: ['love', 'smile', 'life'] },
  
  // Lifestyle
  { tag: 'lifestyle', category: 'lifestyle', competitionLevel: 'high', relatedTags: ['life', 'daily', 'moments'] },
  { tag: 'motivation', category: 'lifestyle', competitionLevel: 'high', relatedTags: ['inspiration', 'success', 'goals'] },
  { tag: 'selfcare', category: 'lifestyle', competitionLevel: 'medium', relatedTags: ['wellness', 'mentalhealth', 'mindfulness'] },
  { tag: 'morningroutine', category: 'lifestyle', competitionLevel: 'medium', relatedTags: ['productivity', 'habits', 'morning'] },
  { tag: 'gratitude', category: 'lifestyle', competitionLevel: 'low', relatedTags: ['mindfulness', 'positive', 'happiness'] },
  
  // Business
  { tag: 'entrepreneur', category: 'business', competitionLevel: 'high', relatedTags: ['business', 'success', 'startup'] },
  { tag: 'smallbusiness', category: 'business', competitionLevel: 'high', relatedTags: ['supportlocal', 'shopsmall', 'handmade'] },
  { tag: 'marketing', category: 'business', competitionLevel: 'high', relatedTags: ['digitalmarketing', 'socialmedia', 'branding'] },
  { tag: 'startup', category: 'business', competitionLevel: 'medium', relatedTags: ['entrepreneur', 'founder', 'tech'] },
  { tag: 'freelance', category: 'business', competitionLevel: 'medium', relatedTags: ['remotework', 'digitalnomad', 'workfromhome'] },
  
  // Tech
  { tag: 'technology', category: 'tech', competitionLevel: 'high', relatedTags: ['tech', 'innovation', 'future'] },
  { tag: 'coding', category: 'tech', competitionLevel: 'medium', relatedTags: ['programming', 'developer', 'javascript'] },
  { tag: 'ai', category: 'tech', competitionLevel: 'high', relatedTags: ['artificialintelligence', 'machinelearning', 'tech'] },
  { tag: 'programming', category: 'tech', competitionLevel: 'medium', relatedTags: ['coding', 'developer', 'software'] },
  { tag: 'webdevelopment', category: 'tech', competitionLevel: 'medium', relatedTags: ['webdev', 'frontend', 'backend'] },
  
  // Fashion
  { tag: 'fashion', category: 'fashion', competitionLevel: 'high', relatedTags: ['style', 'ootd', 'fashionblogger'] },
  { tag: 'ootd', category: 'fashion', competitionLevel: 'high', relatedTags: ['outfit', 'fashion', 'style'] },
  { tag: 'streetstyle', category: 'fashion', competitionLevel: 'medium', relatedTags: ['fashion', 'urban', 'style'] },
  { tag: 'sustainablefashion', category: 'fashion', competitionLevel: 'low', relatedTags: ['ecofashion', 'slowfashion', 'ethicalfashion'] },
  { tag: 'vintage', category: 'fashion', competitionLevel: 'medium', relatedTags: ['retro', 'thrift', 'secondhand'] },
  
  // Food
  { tag: 'foodie', category: 'food', competitionLevel: 'high', relatedTags: ['food', 'delicious', 'yummy'] },
  { tag: 'homemade', category: 'food', competitionLevel: 'medium', relatedTags: ['homecooking', 'recipes', 'cooking'] },
  { tag: 'healthyfood', category: 'food', competitionLevel: 'high', relatedTags: ['healthyeating', 'cleaneating', 'nutrition'] },
  { tag: 'vegan', category: 'food', competitionLevel: 'medium', relatedTags: ['plantbased', 'veganfood', 'crueltyfree'] },
  { tag: 'foodphotography', category: 'food', competitionLevel: 'medium', relatedTags: ['foodstyling', 'foodblogger', 'foodporn'] },
  
  // Travel
  { tag: 'travel', category: 'travel', competitionLevel: 'high', relatedTags: ['wanderlust', 'adventure', 'explore'] },
  { tag: 'wanderlust', category: 'travel', competitionLevel: 'medium', relatedTags: ['travel', 'adventure', 'backpacking'] },
  { tag: 'solotravel', category: 'travel', competitionLevel: 'low', relatedTags: ['backpacking', 'adventure', 'travelalone'] },
  { tag: 'hiddengems', category: 'travel', competitionLevel: 'low', relatedTags: ['offthebeatenpath', 'explore', 'secretspots'] },
  { tag: 'budgettravel', category: 'travel', competitionLevel: 'low', relatedTags: ['cheaptravel', 'backpacking', 'hostellife'] },
  
  // Fitness
  { tag: 'fitness', category: 'fitness', competitionLevel: 'high', relatedTags: ['workout', 'gym', 'fitnessmotivation'] },
  { tag: 'homeworkout', category: 'fitness', competitionLevel: 'medium', relatedTags: ['fitness', 'noequipment', 'workoutathome'] },
  { tag: 'yoga', category: 'fitness', competitionLevel: 'high', relatedTags: ['yogalife', 'mindfulness', 'flexibility'] },
  { tag: 'running', category: 'fitness', competitionLevel: 'medium', relatedTags: ['runner', 'marathon', 'fitness'] },
  { tag: 'strengthtraining', category: 'fitness', competitionLevel: 'medium', relatedTags: ['weightlifting', 'gym', 'muscle'] },
  
  // Art
  { tag: 'art', category: 'art', competitionLevel: 'high', relatedTags: ['artist', 'artwork', 'creative'] },
  { tag: 'digitalart', category: 'art', competitionLevel: 'medium', relatedTags: ['digitalpainting', 'illustration', 'procreate'] },
  { tag: 'traditionalart', category: 'art', competitionLevel: 'low', relatedTags: ['painting', 'drawing', 'fineart'] },
  { tag: 'sketch', category: 'art', competitionLevel: 'medium', relatedTags: ['drawing', 'pencil', 'art'] },
  { tag: 'abstractart', category: 'art', competitionLevel: 'low', relatedTags: ['contemporaryart', 'modernart', 'painting'] },
  
  // Photography
  { tag: 'photography', category: 'photography', competitionLevel: 'high', relatedTags: ['photographer', 'photo', 'camera'] },
  { tag: 'naturephotography', category: 'photography', competitionLevel: 'medium', relatedTags: ['landscape', 'nature', 'wildlife'] },
  { tag: 'portraitphotography', category: 'photography', competitionLevel: 'medium', relatedTags: ['portrait', 'model', 'photoshoot'] },
  { tag: 'mobilephotography', category: 'photography', competitionLevel: 'low', relatedTags: ['shotoniphone', 'phoneography', 'mobile'] },
  { tag: 'blackandwhite', category: 'photography', competitionLevel: 'medium', relatedTags: ['bnw', 'monochrome', 'bw'] },
  
  // Marketing
  { tag: 'digitalmarketing', category: 'marketing', competitionLevel: 'high', relatedTags: ['marketing', 'socialmedia', 'seo'] },
  { tag: 'contentmarketing', category: 'marketing', competitionLevel: 'medium', relatedTags: ['contentstrategy', 'blogging', 'marketing'] },
  { tag: 'socialmediatips', category: 'marketing', competitionLevel: 'medium', relatedTags: ['socialmediamarketing', 'instagramtips', 'growth'] },
  { tag: 'emailmarketing', category: 'marketing', competitionLevel: 'medium', relatedTags: ['newsletter', 'marketing', 'emaillist'] },
  { tag: 'branding', category: 'marketing', competitionLevel: 'medium', relatedTags: ['brandstrategy', 'logo', 'identity'] },
];

// Keyword to category mapping
const KEYWORD_CATEGORIES: Record<string, HashtagCategory> = {
  business: 'business', entrepreneur: 'entrepreneur', startup: 'business',
  marketing: 'marketing', sales: 'business', brand: 'marketing',
  tech: 'tech', code: 'tech', software: 'tech', ai: 'tech',
  fashion: 'fashion', style: 'fashion', outfit: 'fashion',
  food: 'food', recipe: 'food', cooking: 'food', eat: 'food',
  travel: 'travel', trip: 'travel', vacation: 'travel', explore: 'travel',
  fitness: 'fitness', workout: 'fitness', gym: 'fitness', health: 'health',
  art: 'art', draw: 'art', paint: 'art', create: 'art',
  photo: 'photography', camera: 'photography', picture: 'photography',
  music: 'music', song: 'music', artist: 'music',
  sport: 'sports', game: 'sports', sports: 'sports',
  learn: 'education', study: 'education', school: 'education',
  life: 'lifestyle', live: 'lifestyle', daily: 'lifestyle',
};

export class HashtagResearchSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const baseDir = path.join(os.homedir(), '.openclaw', 'skills', 'hashtag-research');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    this.dbPath = path.join(baseDir, 'hashtags.db');
  }

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, async (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          await this.createTables();
          await this.seedDefaultHashtags();
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

    const queries = [
      `CREATE TABLE IF NOT EXISTS hashtags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT NOT NULL UNIQUE,
        platform TEXT DEFAULT 'generic',
        category TEXT DEFAULT 'general',
        post_count INTEGER,
        trending_score REAL DEFAULT 0,
        competition_level TEXT DEFAULT 'medium',
        related_tags TEXT,
        description TEXT,
        last_updated TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        platform TEXT,
        results_count INTEGER,
        created_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS trending_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        data TEXT,
        updated_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_hashtags_category ON hashtags(category)`,
      `CREATE INDEX IF NOT EXISTS idx_hashtags_platform ON hashtags(platform)`,
      `CREATE INDEX IF NOT EXISTS idx_hashtags_tag ON hashtags(tag)`,
    ];

    for (const query of queries) {
      await new Promise<void>((resolve, reject) => {
        this.db!.run(query, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  private async seedDefaultHashtags(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    
    for (const hashtag of DEFAULT_HASHTAGS) {
      const trendingScore = this.calculateBaseTrendingScore(hashtag.category!, hashtag.competitionLevel!);
      await runWithResult(
        this.db,
        `INSERT OR IGNORE INTO hashtags 
         (tag, platform, category, competition_level, related_tags, trending_score, last_updated)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          hashtag.tag,
          'generic',
          hashtag.category,
          hashtag.competitionLevel,
          JSON.stringify(hashtag.relatedTags || []),
          trendingScore,
          now,
        ]
      );
    }
  }

  private calculateBaseTrendingScore(category: HashtagCategory, competition: string): number {
    const categoryScores: Record<HashtagCategory, number> = {
      general: 90, lifestyle: 75, business: 70, tech: 80, fashion: 85,
      food: 82, travel: 78, fitness: 76, art: 65, photography: 72,
      music: 68, sports: 70, health: 74, education: 60, marketing: 66,
      entrepreneur: 62,
    };
    
    const competitionMultiplier: Record<string, number> = { low: 1.2, medium: 1.0, high: 0.8 };
    const baseScore = categoryScores[category] || 50;
    return Math.round(baseScore * (competitionMultiplier[competition] || 1.0) * 10) / 10;
  }

  async research(request: ResearchRequest): Promise<ResearchResult> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const platform = request.platform || 'generic';
    const limit = request.limit || 30;
    const keywords = request.keywords.map(k => k.toLowerCase().trim());

    // Determine category from keywords
    const category = request.category || this.inferCategory(keywords);

    // Build query for matching hashtags
    const hashtagResults: Hashtag[] = [];
    const relatedKeywords: string[] = [];

    // Search by category and related tags
    for (const keyword of keywords) {
      const rows = await this.query(
        `SELECT * FROM hashtags 
         WHERE category = ? 
         OR tag LIKE ? 
         OR related_tags LIKE ?
         ORDER BY trending_score DESC
         LIMIT ?`,
        [category, `%${keyword}%`, `%${keyword}%`, Math.ceil(limit / keywords.length)]
      );

      for (const row of rows) {
        const hashtag = this.rowToHashtag(row);
        if (!hashtagResults.find(h => h.tag === hashtag.tag)) {
          hashtag.relevanceScore = this.calculateRelevanceScore(hashtag, keywords, category);
          hashtagResults.push(hashtag);
        }
        relatedKeywords.push(...hashtag.relatedTags);
      }
    }

    // Sort by relevance and trending
    hashtagResults.sort((a, b) => 
      (b.relevanceScore || 0) + b.trendingScore - (a.relevanceScore || 0) - a.trendingScore
    );

    // Get trending hashtags for this category
    const trending = await this.getTrending(platform, category, Math.ceil(limit / 3));

    // Get niche (low competition) hashtags
    const niche = await this.getNicheHashtags(category, Math.ceil(limit / 3));

    // Filter by competition if specified
    let filtered = hashtagResults;
    if (request.maxPosts) {
      filtered = filtered.filter(h => (h.postCount || 999999999) <= request.maxPosts!);
    }

    // Save search history
    await this.saveSearchHistory(keywords.join(' '), platform, filtered.length);

    return {
      query: keywords.join(' '),
      platform,
      hashtags: filtered.slice(0, limit),
      trending: trending.slice(0, Math.ceil(limit / 3)),
      niche: niche.slice(0, Math.ceil(limit / 3)),
      relatedKeywords: [...new Set(relatedKeywords)].slice(0, 10),
      generatedAt: new Date().toISOString(),
    };
  }

  private inferCategory(keywords: string[]): HashtagCategory {
    for (const keyword of keywords) {
      for (const [key, category] of Object.entries(KEYWORD_CATEGORIES)) {
        if (keyword.includes(key)) return category;
      }
    }
    return 'general';
  }

  private calculateRelevanceScore(hashtag: Hashtag, keywords: string[], category: HashtagCategory): number {
    let score = 0;
    const tagLower = hashtag.tag.toLowerCase();

    // Direct keyword match
    for (const keyword of keywords) {
      if (tagLower.includes(keyword)) score += 30;
      if (hashtag.relatedTags.some(t => t.toLowerCase().includes(keyword))) score += 15;
    }

    // Category match
    if (hashtag.category === category) score += 20;

    // Competition preference (medium gets boost)
    if (hashtag.competitionLevel === 'medium') score += 10;
    if (hashtag.competitionLevel === 'low') score += 15;

    return Math.min(score, 100);
  }

  private rowToHashtag(row: any): Hashtag {
    return {
      id: row.id,
      tag: row.tag,
      platform: row.platform as SocialPlatform,
      category: row.category as HashtagCategory,
      postCount: row.post_count,
      trendingScore: row.trending_score,
      competitionLevel: row.competition_level,
      relatedTags: JSON.parse(row.related_tags || '[]'),
      description: row.description,
      lastUpdated: row.last_updated,
    };
  }

  private async query(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getTrending(platform: SocialPlatform = 'generic', category?: HashtagCategory, limit: number = 10): Promise<Hashtag[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    let sql = `SELECT * FROM hashtags WHERE trending_score > 50`;
    const params: any[] = [];

    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY trending_score DESC LIMIT ?`;
    params.push(limit);

    const rows = await this.query(sql, params);
    return rows.map(r => this.rowToHashtag(r));
  }

  async getNicheHashtags(category?: HashtagCategory, limit: number = 10): Promise<Hashtag[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    let sql = `SELECT * FROM hashtags WHERE competition_level = 'low'`;
    const params: any[] = [];

    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY trending_score DESC LIMIT ?`;
    params.push(limit);

    const rows = await this.query(sql, params);
    return rows.map(r => this.rowToHashtag(r));
  }

  async discoverNiches(request: NicheRequest): Promise<Hashtag[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const topic = request.topic.toLowerCase();
    const platform = request.platform || 'generic';
    const maxCompetition = request.maxCompetition || 'medium';

    // Get hashtags related to topic with low/medium competition
    const competitionLevels = maxCompetition === 'low' ? ['low'] : 
                             maxCompetition === 'medium' ? ['low', 'medium'] : 
                             ['low', 'medium', 'high'];

    const placeholders = competitionLevels.map(() => '?').join(',');
    
    const rows = await this.query(
      `SELECT * FROM hashtags 
       WHERE (tag LIKE ? OR related_tags LIKE ?)
       AND competition_level IN (${placeholders})
       ORDER BY trending_score DESC
       LIMIT ?`,
      [`%${topic}%`, `%${topic}%`, ...competitionLevels, request.depth || 20]
    );

    return rows.map(r => this.rowToHashtag(r));
  }

  async suggestHashtags(content: string, platform: SocialPlatform = 'generic', limit: number = 15): Promise<Hashtag[]> {
    await this.initialize();
    
    // Extract keywords from content
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);

    const keywords = [...new Set(words)].slice(0, 5);
    
    const result = await this.research({
      keywords,
      platform,
      limit,
    });

    return result.hashtags;
  }

  async addCustomHashtag(hashtag: Omit<Hashtag, 'id' | 'lastUpdated'>): Promise<number> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(
      this.db,
      `INSERT OR REPLACE INTO hashtags 
       (tag, platform, category, post_count, trending_score, competition_level, related_tags, description, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hashtag.tag.toLowerCase().replace(/[^\w]/g, ''),
        hashtag.platform,
        hashtag.category,
        hashtag.postCount || null,
        hashtag.trendingScore,
        hashtag.competitionLevel,
        JSON.stringify(hashtag.relatedTags),
        hashtag.description || null,
        new Date().toISOString(),
      ]
    );

    return result.lastID;
  }

  async getSearchHistory(limit: number = 20): Promise<Array<{ query: string; platform: string; createdAt: string }>> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.query(
      `SELECT query, platform, created_at as createdAt 
       FROM search_history 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [limit]
    );

    return rows;
  }

  private async saveSearchHistory(query: string, platform: string, resultsCount: number): Promise<void> {
    if (!this.db) return;

    await runWithResult(
      this.db,
      `INSERT INTO search_history (query, platform, results_count, created_at) VALUES (?, ?, ?, ?)`,
      [query, platform, resultsCount, new Date().toISOString()]
    );
  }

  async getStats(): Promise<{
    totalHashtags: number;
    byCategory: Record<string, number>;
    byCompetition: Record<string, number>;
    totalSearches: number;
  }> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const totalRow = await this.query('SELECT COUNT(*) as count FROM hashtags');
    const searchesRow = await this.query('SELECT COUNT(*) as count FROM search_history');
    
    const categoryRows = await this.query(
      'SELECT category, COUNT(*) as count FROM hashtags GROUP BY category'
    );
    const competitionRows = await this.query(
      'SELECT competition_level, COUNT(*) as count FROM hashtags GROUP BY competition_level'
    );

    const byCategory: Record<string, number> = {};
    for (const row of categoryRows) {
      byCategory[row.category] = row.count;
    }

    const byCompetition: Record<string, number> = {};
    for (const row of competitionRows) {
      byCompetition[row.competition_level] = row.count;
    }

    return {
      totalHashtags: totalRow[0]?.count || 0,
      byCategory,
      byCompetition,
      totalSearches: searchesRow[0]?.count || 0,
    };
  }

  async healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
    try {
      await this.initialize();
      const stats = await this.getStats();
      return {
        status: 'ok',
        message: `Database healthy. ${stats.totalHashtags} hashtags, ${stats.totalSearches} searches.`,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async close(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.db = null;
      this.initPromise = null;
    }
  }
}

export default HashtagResearchSkill;
