import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as https from 'https';

// Types
export type ReviewPlatform = 'google' | 'yelp';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type ResponseTone = 'grateful' | 'apologetic' | 'professional' | 'follow-up' | 'appreciation';
export type AlertChannel = 'console' | 'email' | 'slack';

export interface Business {
  id?: number;
  name: string;
  platform: ReviewPlatform;
  externalId: string;
  location?: string;
  website?: string;
  isActive: boolean;
  alertChannels: AlertChannel[];
  createdAt?: string;
  lastFetchedAt?: string;
}

export interface BusinessRecord {
  id: number;
  name: string;
  platform: string;
  external_id: string;
  location: string | null;
  website: string | null;
  is_active: number;
  alert_channels: string;
  created_at: string;
  last_fetched_at: string | null;
}

export interface Review {
  id?: number;
  businessId: number;
  externalId: string;
  platform: ReviewPlatform;
  authorName: string;
  authorId?: string;
  rating: number;
  content: string;
  sentiment: Sentiment;
  sentimentScore: number;
  response?: string;
  respondedAt?: string;
  isRead: boolean;
  reviewDate: string;
  fetchedAt?: string;
}

export interface ReviewRecord {
  id: number;
  business_id: number;
  external_id: string;
  platform: string;
  author_name: string;
  author_id: string | null;
  rating: number;
  content: string;
  sentiment: string;
  sentiment_score: number;
  response: string | null;
  responded_at: string | null;
  is_read: number;
  review_date: string;
  fetched_at: string;
}

export interface ResponseTemplate {
  id?: number;
  name: string;
  tone: ResponseTone;
  content: string;
  forSentiment?: Sentiment;
  variables: string[];
}

export interface ResponseTemplateRecord {
  id: number;
  name: string;
  tone: string;
  content: string;
  for_sentiment: string | null;
  variables: string;
}

export interface Alert {
  id?: number;
  reviewId: number;
  channel: AlertChannel;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string;
  errorMessage?: string;
  createdAt?: string;
}

export interface AlertRecord {
  id: number;
  review_id: number;
  channel: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface SentimentAnalysis {
  sentiment: Sentiment;
  score: number;
  confidence: number;
  keywords: string[];
  explanation: string;
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  sentimentDistribution: Record<Sentiment, number>;
  platformDistribution: Record<ReviewPlatform, number>;
  unreadCount: number;
  unrespondedCount: number;
  recentTrend: 'improving' | 'stable' | 'declining';
}

export interface BusinessStats {
  business: Business;
  totalReviews: number;
  averageRating: number;
  sentimentDistribution: Record<Sentiment, number>;
  responseRate: number;
}

// Utility function for SQLite run with result
function runWithResult(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Sentiment analysis keywords
const POSITIVE_KEYWORDS = [
  'excellent', 'amazing', 'wonderful', 'fantastic', 'great', 'love', 'loved',
  'best', 'awesome', 'perfect', 'outstanding', 'superb', 'brilliant', 'happy',
  'pleased', 'satisfied', 'recommend', 'highly', 'beautiful', 'delicious',
  'friendly', 'helpful', 'professional', 'clean', 'comfortable', 'quick',
  'fast', 'efficient', 'polite', 'courteous', 'attentive', 'quality',
  'value', 'worth', 'enjoyed', 'pleasant', 'nice', 'good', 'fresh',
  'tasty', 'yummy', 'cozy', 'atmosphere', 'beautiful', 'impressed',
  'incredible', 'magnificent', 'super', 'top', '5 stars', 'five stars'
];

const NEGATIVE_KEYWORDS = [
  'terrible', 'awful', 'horrible', 'worst', 'hate', 'hated', 'bad',
  'poor', 'disappointed', 'disappointing', 'disgusting', 'rude', 'slow',
  'dirty', 'overpriced', 'expensive', 'waste', 'never', 'avoid',
  'unprofessional', 'unfriendly', 'unhelpful', 'cold', 'stale', 'gross',
  'problem', 'problems', 'issue', 'issues', 'complaint', 'complain',
  'unhappy', 'unsatisfied', 'regret', 'wasted', 'refund', 'return',
  'broken', 'damaged', 'mess', 'messy', 'unclean', 'wait', 'waiting',
  'forever', 'long', 'ignored', 'neglected', 'forgotten', 'error',
  'mistake', 'wrong', 'late', 'missing', 'empty', '1 star', 'one star'
];

// Default response templates
const DEFAULT_TEMPLATES: Omit<ResponseTemplate, 'id'>[] = [
  {
    name: 'grateful-positive',
    tone: 'grateful',
    content: 'Hi {{authorName}},\n\nThank you so much for your wonderful review! We\'re thrilled to hear that you enjoyed {{highlight}}. Your feedback means the world to our team.\n\nWe look forward to welcoming you back soon!\n\nBest regards,\n{{businessName}} Team',
    forSentiment: 'positive',
    variables: ['authorName', 'highlight', 'businessName']
  },
  {
    name: 'apologetic-negative',
    tone: 'apologetic',
    content: 'Hi {{authorName}},\n\nWe sincerely apologize for your experience. This is not the standard we strive for, and we\'re sorry we fell short.\n\n{{resolution}}\n\nWe\'d love the opportunity to make this right. Please reach out to us directly at {{contact}}.\n\nBest regards,\n{{businessName}} Team',
    forSentiment: 'negative',
    variables: ['authorName', 'resolution', 'contact', 'businessName']
  },
  {
    name: 'professional-neutral',
    tone: 'professional',
    content: 'Hi {{authorName}},\n\nThank you for taking the time to share your feedback. We appreciate your honest review and take all comments seriously.\n\n{{response}}\n\nWe hope to serve you again soon.\n\nBest regards,\n{{businessName}} Team',
    forSentiment: 'neutral',
    variables: ['authorName', 'response', 'businessName']
  },
  {
    name: 'follow-up-question',
    tone: 'follow-up',
    content: 'Hi {{authorName}},\n\nThank you for your review. We\'d like to learn more about your experience with {{topic}}.\n\nCould you please contact us at {{contact}} so we can better understand and address your concerns?\n\nBest regards,\n{{businessName}} Team',
    variables: ['authorName', 'topic', 'contact', 'businessName']
  },
  {
    name: 'appreciation-general',
    tone: 'appreciation',
    content: 'Hi {{authorName}},\n\nThank you for sharing your experience with us. We truly value your feedback as it helps us improve.\n\nWe appreciate your support and look forward to your next visit!\n\nBest regards,\n{{businessName}} Team',
    variables: ['authorName', 'businessName']
  }
];

export class ReviewMonitorSkill {
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(os.homedir(), '.openclaw', 'skills', 'review-monitor');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    const dbPath = path.join(this.dataDir, 'reviews.db');
    
    return new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(dbPath, (err: Error | null) => {
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

    const tables = [
      `CREATE TABLE IF NOT EXISTS businesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        external_id TEXT NOT NULL,
        location TEXT,
        website TEXT,
        is_active INTEGER DEFAULT 1,
        alert_channels TEXT DEFAULT '["console"]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_fetched_at DATETIME,
        UNIQUE(platform, external_id)
      )`,
      `CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        external_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_id TEXT,
        rating INTEGER NOT NULL,
        content TEXT NOT NULL,
        sentiment TEXT NOT NULL,
        sentiment_score REAL NOT NULL,
        response TEXT,
        responded_at DATETIME,
        is_read INTEGER DEFAULT 0,
        review_date TEXT NOT NULL,
        fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        UNIQUE(platform, external_id)
      )`,
      `CREATE TABLE IF NOT EXISTS response_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        tone TEXT NOT NULL,
        content TEXT NOT NULL,
        for_sentiment TEXT,
        variables TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id INTEGER NOT NULL,
        channel TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        sent_at DATETIME,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
      )`
    ];

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id)',
      'CREATE INDEX IF NOT EXISTS idx_reviews_platform ON reviews(platform)',
      'CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment)',
      'CREATE INDEX IF NOT EXISTS idx_reviews_read ON reviews(is_read)',
      'CREATE INDEX IF NOT EXISTS idx_reviews_date ON reviews(review_date)',
      'CREATE INDEX IF NOT EXISTS idx_alerts_review ON alerts(review_id)',
      'CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)'
    ];

    for (const sql of [...tables, ...indexes]) {
      await new Promise<void>((resolve, reject) => {
        this.db!.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    await this.seedDefaultTemplates();
  }

  private async seedDefaultTemplates(): Promise<void> {
    if (!this.db) return;

    for (const template of DEFAULT_TEMPLATES) {
      try {
        await runWithResult(
          this.db,
          `INSERT OR IGNORE INTO response_templates (name, tone, content, for_sentiment, variables) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            template.name,
            template.tone,
            template.content,
            template.forSentiment || null,
            JSON.stringify(template.variables)
          ]
        );
      } catch (err) {
        // Ignore duplicate errors
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  // Business Management
  async addBusiness(business: Omit<Business, 'id' | 'createdAt' | 'lastFetchedAt'>): Promise<Business> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(
      this.db,
      `INSERT INTO businesses (name, platform, external_id, location, website, is_active, alert_channels)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        business.name,
        business.platform,
        business.externalId,
        business.location || null,
        business.website || null,
        business.isActive ? 1 : 0,
        JSON.stringify(business.alertChannels)
      ]
    );

    return {
      ...business,
      id: result.lastID,
      createdAt: new Date().toISOString()
    };
  }

  async getBusiness(id: number): Promise<Business | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const record = await new Promise<BusinessRecord | undefined>((resolve, reject) => {
      this.db!.get<BusinessRecord>(
        'SELECT * FROM businesses WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!record) return null;

    return this.mapBusinessRecord(record);
  }

  async listBusinesses(options: { platform?: ReviewPlatform; activeOnly?: boolean } = {}): Promise<Business[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM businesses WHERE 1=1';
    const params: any[] = [];

    if (options.platform) {
      sql += ' AND platform = ?';
      params.push(options.platform);
    }

    if (options.activeOnly !== false) {
      sql += ' AND is_active = 1';
    }

    sql += ' ORDER BY name';

    const records = await new Promise<BusinessRecord[]>((resolve, reject) => {
      this.db!.all<BusinessRecord>(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    return records.map(r => this.mapBusinessRecord(r));
  }

  async updateBusiness(id: number, updates: Partial<Omit<Business, 'id'>>): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }
    if (updates.alertChannels !== undefined) {
      fields.push('alert_channels = ?');
      values.push(JSON.stringify(updates.alertChannels));
    }
    if (updates.location !== undefined) {
      fields.push('location = ?');
      values.push(updates.location);
    }
    if (updates.website !== undefined) {
      fields.push('website = ?');
      values.push(updates.website);
    }

    if (fields.length === 0) return;

    values.push(id);

    await runWithResult(
      this.db,
      `UPDATE businesses SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async deleteBusiness(id: number): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    await runWithResult(
      this.db,
      'DELETE FROM businesses WHERE id = ?',
      [id]
    );
  }

  private mapBusinessRecord(record: BusinessRecord): Business {
    return {
      id: record.id,
      name: record.name,
      platform: record.platform as ReviewPlatform,
      externalId: record.external_id,
      location: record.location || undefined,
      website: record.website || undefined,
      isActive: record.is_active === 1,
      alertChannels: JSON.parse(record.alert_channels),
      createdAt: record.created_at,
      lastFetchedAt: record.last_fetched_at || undefined
    };
  }

  // Review Management
  async fetchReviews(businessId: number): Promise<Review[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const business = await this.getBusiness(businessId);
    if (!business) throw new Error(`Business ${businessId} not found`);

    // In a real implementation, this would call Google/Yelp APIs
    // For now, we simulate by returning stored reviews
    await this.updateBusiness(businessId, {}); // Update last_fetched_at
    await runWithResult(
      this.db,
      'UPDATE businesses SET last_fetched_at = CURRENT_TIMESTAMP WHERE id = ?',
      [businessId]
    );

    return this.getReviewsByBusiness(businessId);
  }

  async addReview(review: Omit<Review, 'id' | 'fetchedAt'>): Promise<Review> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    // Analyze sentiment if not provided
    let sentiment = review.sentiment;
    let sentimentScore = review.sentimentScore;

    if (!sentiment || sentimentScore === undefined) {
      const analysis = this.analyzeSentimentLocal(review.content, review.rating);
      sentiment = analysis.sentiment;
      sentimentScore = analysis.score;
    }

    const result = await runWithResult(
      this.db,
      `INSERT INTO reviews (business_id, external_id, platform, author_name, author_id, rating, 
       content, sentiment, sentiment_score, response, responded_at, is_read, review_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        review.businessId,
        review.externalId,
        review.platform,
        review.authorName,
        review.authorId || null,
        review.rating,
        review.content,
        sentiment,
        sentimentScore,
        review.response || null,
        review.respondedAt || null,
        review.isRead ? 1 : 0,
        review.reviewDate
      ]
    );

    const newReview: Review = {
      ...review,
      sentiment,
      sentimentScore,
      id: result.lastID,
      fetchedAt: new Date().toISOString()
    };

    // Create alerts for new reviews
    await this.createAlerts(newReview);

    return newReview;
  }

  async getReview(id: number): Promise<Review | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const record = await new Promise<ReviewRecord | undefined>((resolve, reject) => {
      this.db!.get<ReviewRecord>(
        'SELECT * FROM reviews WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!record) return null;

    return this.mapReviewRecord(record);
  }

  async getReviewsByBusiness(businessId: number, options: { 
    sentiment?: Sentiment; 
    unreadOnly?: boolean;
    unrespondedOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<Review[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM reviews WHERE business_id = ?';
    const params: any[] = [businessId];

    if (options.sentiment) {
      sql += ' AND sentiment = ?';
      params.push(options.sentiment);
    }

    if (options.unreadOnly) {
      sql += ' AND is_read = 0';
    }

    if (options.unrespondedOnly) {
      sql += ' AND response IS NULL';
    }

    sql += ' ORDER BY review_date DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const records = await new Promise<ReviewRecord[]>((resolve, reject) => {
      this.db!.all<ReviewRecord>(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    return records.map(r => this.mapReviewRecord(r));
  }

  async getAllReviews(options: {
    platform?: ReviewPlatform;
    sentiment?: Sentiment;
    unreadOnly?: boolean;
    limit?: number;
  } = {}): Promise<Review[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT r.*, b.name as business_name FROM reviews r JOIN businesses b ON r.business_id = b.id WHERE 1=1';
    const params: any[] = [];

    if (options.platform) {
      sql += ' AND r.platform = ?';
      params.push(options.platform);
    }

    if (options.sentiment) {
      sql += ' AND r.sentiment = ?';
      params.push(options.sentiment);
    }

    if (options.unreadOnly) {
      sql += ' AND r.is_read = 0';
    }

    sql += ' ORDER BY r.review_date DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const records = await new Promise<ReviewRecord[]>((resolve, reject) => {
      this.db!.all<ReviewRecord>(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    return records.map(r => this.mapReviewRecord(r));
  }

  async markReviewAsRead(id: number): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    await runWithResult(
      this.db,
      'UPDATE reviews SET is_read = 1 WHERE id = ?',
      [id]
    );
  }

  async markReviewAsUnread(id: number): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    await runWithResult(
      this.db,
      'UPDATE reviews SET is_read = 0 WHERE id = ?',
      [id]
    );
  }

  async addResponse(reviewId: number, response: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    await runWithResult(
      this.db,
      'UPDATE reviews SET response = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?',
      [response, reviewId]
    );
  }

  async deleteReview(id: number): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    await runWithResult(
      this.db,
      'DELETE FROM reviews WHERE id = ?',
      [id]
    );
  }

  private mapReviewRecord(record: ReviewRecord): Review {
    return {
      id: record.id,
      businessId: record.business_id,
      externalId: record.external_id,
      platform: record.platform as ReviewPlatform,
      authorName: record.author_name,
      authorId: record.author_id || undefined,
      rating: record.rating,
      content: record.content,
      sentiment: record.sentiment as Sentiment,
      sentimentScore: record.sentiment_score,
      response: record.response || undefined,
      respondedAt: record.responded_at || undefined,
      isRead: record.is_read === 1,
      reviewDate: record.review_date,
      fetchedAt: record.fetched_at
    };
  }

  // Sentiment Analysis
  analyzeSentimentLocal(content: string, rating?: number): SentimentAnalysis {
    const lowerContent = content.toLowerCase();
    const words = lowerContent.split(/\s+/);
    
    let positiveCount = 0;
    let negativeCount = 0;
    const foundKeywords: string[] = [];

    // Count positive keywords
    for (const keyword of POSITIVE_KEYWORDS) {
      if (lowerContent.includes(keyword)) {
        positiveCount++;
        if (!foundKeywords.includes(keyword)) {
          foundKeywords.push(keyword);
        }
      }
    }

    // Count negative keywords
    for (const keyword of NEGATIVE_KEYWORDS) {
      if (lowerContent.includes(keyword)) {
        negativeCount++;
        if (!foundKeywords.includes(keyword)) {
          foundKeywords.push(keyword);
        }
      }
    }

    // Calculate base sentiment score
    let score = 0;
    const totalWords = words.length;
    
    if (positiveCount + negativeCount > 0) {
      score = (positiveCount - negativeCount) / (positiveCount + negativeCount);
    }

    // Factor in rating if provided
    if (rating !== undefined) {
      const ratingScore = (rating - 3) / 2; // Normalize 1-5 to -1 to 1
      score = score * 0.6 + ratingScore * 0.4; // Weighted average
    }

    // Clamp score to -1 to 1
    score = Math.max(-1, Math.min(1, score));

    // Determine sentiment category
    let sentiment: Sentiment;
    if (score > 0.2) {
      sentiment = 'positive';
    } else if (score < -0.2) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }

    // Calculate confidence based on keyword density and explicit sentiment
    const keywordDensity = (positiveCount + negativeCount) / totalWords;
    let confidence = Math.min(0.95, 0.4 + keywordDensity * 5 + Math.abs(score) * 0.3);

    // Generate explanation
    let explanation = '';
    if (sentiment === 'positive') {
      explanation = `Detected ${positiveCount} positive indicators`;
      if (rating && rating >= 4) explanation += ` with a ${rating}-star rating`;
    } else if (sentiment === 'negative') {
      explanation = `Detected ${negativeCount} negative indicators`;
      if (rating && rating <= 2) explanation += ` with a ${rating}-star rating`;
    } else {
      explanation = 'Mixed or neutral language detected';
    }

    return {
      sentiment,
      score,
      confidence,
      keywords: foundKeywords.slice(0, 5),
      explanation
    };
  }

  async analyzeSentiment(reviewId: number): Promise<SentimentAnalysis | null> {
    const review = await this.getReview(reviewId);
    if (!review) return null;

    return this.analyzeSentimentLocal(review.content, review.rating);
  }

  // Response Templates
  async getResponseTemplates(options: { tone?: ResponseTone; forSentiment?: Sentiment } = {}): Promise<ResponseTemplate[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM response_templates WHERE 1=1';
    const params: any[] = [];

    if (options.tone) {
      sql += ' AND tone = ?';
      params.push(options.tone);
    }

    if (options.forSentiment) {
      sql += ' AND (for_sentiment = ? OR for_sentiment IS NULL)';
      params.push(options.forSentiment);
    }

    sql += ' ORDER BY name';

    const records = await new Promise<ResponseTemplateRecord[]>((resolve, reject) => {
      this.db!.all<ResponseTemplateRecord>(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    return records.map(r => this.mapTemplateRecord(r));
  }

  async getResponseTemplate(id: number): Promise<ResponseTemplate | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const record = await new Promise<ResponseTemplateRecord | undefined>((resolve, reject) => {
      this.db!.get<ResponseTemplateRecord>(
        'SELECT * FROM response_templates WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!record) return null;

    return this.mapTemplateRecord(record);
  }

  async addResponseTemplate(template: Omit<ResponseTemplate, 'id'>): Promise<ResponseTemplate> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(
      this.db,
      `INSERT INTO response_templates (name, tone, content, for_sentiment, variables)
       VALUES (?, ?, ?, ?, ?)`,
      [
        template.name,
        template.tone,
        template.content,
        template.forSentiment || null,
        JSON.stringify(template.variables)
      ]
    );

    return {
      ...template,
      id: result.lastID
    };
  }

  async deleteResponseTemplate(id: number): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    await runWithResult(
      this.db,
      'DELETE FROM response_templates WHERE id = ?',
      [id]
    );
  }

  private mapTemplateRecord(record: ResponseTemplateRecord): ResponseTemplate {
    return {
      id: record.id,
      name: record.name,
      tone: record.tone as ResponseTone,
      content: record.content,
      forSentiment: record.for_sentiment as Sentiment || undefined,
      variables: JSON.parse(record.variables)
    };
  }

  async generateResponse(reviewId: number, tone: ResponseTone, variables: Record<string, string> = {}): Promise<string | null> {
    const review = await this.getReview(reviewId);
    if (!review) return null;

    // Get template matching tone and sentiment
    const templates = await this.getResponseTemplates({ 
      tone,
      forSentiment: review.sentiment 
    });

    if (templates.length === 0) {
      // Fall back to any template with matching tone
      const anyTemplates = await this.getResponseTemplates({ tone });
      if (anyTemplates.length === 0) return null;
    }

    const template = templates[0] || (await this.getResponseTemplates({ tone }))[0];
    if (!template) return null;

    // Get business name
    const business = await this.getBusiness(review.businessId);
    const businessName = business?.name || 'Our';

    // Default variables
    const defaultVars: Record<string, string> = {
      authorName: review.authorName.split(' ')[0] || 'there',
      businessName: businessName,
      highlight: 'your visit',
      resolution: 'We are taking immediate steps to address this issue.',
      contact: 'our support team',
      response: 'We are always looking to improve.',
      topic: 'your experience',
      ...variables
    };

    // Replace variables
    let response = template.content;
    for (const [key, value] of Object.entries(defaultVars)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      response = response.replace(regex, value);
    }

    return response;
  }

  // Alerts
  private async createAlerts(review: Review): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const business = await this.getBusiness(review.businessId);
    if (!business) return;

    for (const channel of business.alertChannels) {
      await runWithResult(
        this.db,
        'INSERT INTO alerts (review_id, channel, status) VALUES (?, ?, ?)',
        [review.id, channel, 'pending']
      );
    }
  }

  async getPendingAlerts(): Promise<{ alert: Alert; review: Review; business: Business }[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const sql = `
      SELECT a.*, r.*, b.*, a.id as alert_id, r.id as review_id, b.id as business_id
      FROM alerts a
      JOIN reviews r ON a.review_id = r.id
      JOIN businesses b ON r.business_id = b.id
      WHERE a.status = 'pending'
      ORDER BY a.created_at DESC
    `;

    const rows = await new Promise<any[]>((resolve, reject) => {
      this.db!.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    return rows.map(row => ({
      alert: {
        id: row.alert_id,
        reviewId: row.review_id,
        channel: row.channel as AlertChannel,
        status: row.status as Alert['status'],
        sentAt: row.sent_at || undefined,
        errorMessage: row.error_message || undefined,
        createdAt: row.created_at
      },
      review: {
        id: row.review_id,
        businessId: row.business_id,
        externalId: row.external_id,
        platform: row.platform as ReviewPlatform,
        authorName: row.author_name,
        authorId: row.author_id || undefined,
        rating: row.rating,
        content: row.content,
        sentiment: row.sentiment as Sentiment,
        sentimentScore: row.sentiment_score,
        response: row.response || undefined,
        respondedAt: row.responded_at || undefined,
        isRead: row.is_read === 1,
        reviewDate: row.review_date,
        fetchedAt: row.fetched_at
      },
      business: {
        id: row.business_id,
        name: row.name,
        platform: row.platform as ReviewPlatform,
        externalId: row.external_id,
        location: row.location || undefined,
        website: row.website || undefined,
        isActive: row.is_active === 1,
        alertChannels: JSON.parse(row.alert_channels),
        createdAt: row.created_at,
        lastFetchedAt: row.last_fetched_at || undefined
      }
    }));
  }

  async markAlertSent(alertId: number): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    await runWithResult(
      this.db,
      "UPDATE alerts SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = ?",
      [alertId]
    );
  }

  async markAlertFailed(alertId: number, errorMessage: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    await runWithResult(
      this.db,
      "UPDATE alerts SET status = 'failed', error_message = ? WHERE id = ?",
      [errorMessage, alertId]
    );
  }

  async sendAlerts(): Promise<{ sent: number; failed: number }> {
    const pending = await this.getPendingAlerts();
    let sent = 0;
    let failed = 0;

    for (const { alert, review, business } of pending) {
      try {
        // For console alerts, just log to stdout
        if (alert.channel === 'console') {
          console.log(`\n🔔 NEW REVIEW ALERT`);
          console.log(`Business: ${business.name}`);
          console.log(`Platform: ${review.platform}`);
          console.log(`Rating: ${'⭐'.repeat(review.rating)}`);
          console.log(`Sentiment: ${review.sentiment}`);
          console.log(`Author: ${review.authorName}`);
          console.log(`Content: ${review.content.substring(0, 100)}${review.content.length > 100 ? '...' : ''}`);
          console.log(`Review ID: ${review.id}\n`);
          
          await this.markAlertSent(alert.id!);
          sent++;
        } else {
          // For email/slack, would integrate with those skills
          // For now, just mark as sent for demo purposes
          console.log(`[Alert would be sent via ${alert.channel}]`);
          await this.markAlertSent(alert.id!);
          sent++;
        }
      } catch (error) {
        await this.markAlertFailed(alert.id!, String(error));
        failed++;
      }
    }

    return { sent, failed };
  }

  // Statistics
  async getStats(): Promise<ReviewStats> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    // Total reviews
    const totalResult = await new Promise<{ count: number }>((resolve, reject) => {
      this.db!.get('SELECT COUNT(*) as count FROM reviews', [], (err, row: any) => {
        if (err) reject(err);
        else resolve({ count: row?.count || 0 });
      });
    });

    // Average rating
    const avgResult = await new Promise<{ avg: number }>((resolve, reject) => {
      this.db!.get('SELECT AVG(rating) as avg FROM reviews', [], (err, row: any) => {
        if (err) reject(err);
        else resolve({ avg: row?.avg || 0 });
      });
    });

    // Sentiment distribution
    const sentimentResult = await new Promise<{ sentiment: Sentiment; count: number }[]>((resolve, reject) => {
      this.db!.all(
        'SELECT sentiment, COUNT(*) as count FROM reviews GROUP BY sentiment',
        [],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Platform distribution
    const platformResult = await new Promise<{ platform: ReviewPlatform; count: number }[]>((resolve, reject) => {
      this.db!.all(
        'SELECT platform, COUNT(*) as count FROM reviews GROUP BY platform',
        [],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Unread count
    const unreadResult = await new Promise<{ count: number }>((resolve, reject) => {
      this.db!.get('SELECT COUNT(*) as count FROM reviews WHERE is_read = 0', [], (err, row: any) => {
        if (err) reject(err);
        else resolve({ count: row?.count || 0 });
      });
    });

    // Unresponded count
    const unrespondedResult = await new Promise<{ count: number }>((resolve, reject) => {
      this.db!.get('SELECT COUNT(*) as count FROM reviews WHERE response IS NULL', [], (err, row: any) => {
        if (err) reject(err);
        else resolve({ count: row?.count || 0 });
      });
    });

    // Calculate trend (compare last 30 days to previous 30 days)
    const recentResult = await new Promise<{ avg: number }>((resolve, reject) => {
      this.db!.get(
        `SELECT AVG(rating) as avg FROM reviews 
         WHERE review_date >= date('now', '-30 days')`,
        [],
        (err, row: any) => {
          if (err) reject(err);
          else resolve({ avg: row?.avg || 0 });
        }
      );
    });

    const previousResult = await new Promise<{ avg: number }>((resolve, reject) => {
      this.db!.get(
        `SELECT AVG(rating) as avg FROM reviews 
         WHERE review_date >= date('now', '-60 days') 
         AND review_date < date('now', '-30 days')`,
        [],
        (err, row: any) => {
          if (err) reject(err);
          else resolve({ avg: row?.avg || 0 });
        }
      );
    });

    let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recentResult.avg > previousResult.avg + 0.2) {
      recentTrend = 'improving';
    } else if (recentResult.avg < previousResult.avg - 0.2) {
      recentTrend = 'declining';
    }

    const sentimentDistribution: Record<Sentiment, number> = {
      positive: 0,
      neutral: 0,
      negative: 0
    };
    for (const row of sentimentResult) {
      sentimentDistribution[row.sentiment] = row.count;
    }

    const platformDistribution: Record<ReviewPlatform, number> = {
      google: 0,
      yelp: 0
    };
    for (const row of platformResult) {
      platformDistribution[row.platform] = row.count;
    }

    return {
      totalReviews: totalResult.count,
      averageRating: parseFloat(avgResult.avg.toFixed(2)),
      sentimentDistribution,
      platformDistribution,
      unreadCount: unreadResult.count,
      unrespondedCount: unrespondedResult.count,
      recentTrend
    };
  }

  async getBusinessStats(businessId: number): Promise<BusinessStats | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const business = await this.getBusiness(businessId);
    if (!business) return null;

    // Total and average
    const statsResult = await new Promise<{ total: number; avg: number }>((resolve, reject) => {
      this.db!.get(
        'SELECT COUNT(*) as total, AVG(rating) as avg FROM reviews WHERE business_id = ?',
        [businessId],
        (err, row: any) => {
          if (err) reject(err);
          else resolve({ total: row?.total || 0, avg: row?.avg || 0 });
        }
      );
    });

    // Sentiment distribution
    const sentimentResult = await new Promise<{ sentiment: Sentiment; count: number }[]>((resolve, reject) => {
      this.db!.all(
        'SELECT sentiment, COUNT(*) as count FROM reviews WHERE business_id = ? GROUP BY sentiment',
        [businessId],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Response rate
    const responseResult = await new Promise<{ responded: number }>((resolve, reject) => {
      this.db!.get(
        'SELECT COUNT(*) as responded FROM reviews WHERE business_id = ? AND response IS NOT NULL',
        [businessId],
        (err, row: any) => {
          if (err) reject(err);
          else resolve({ responded: row?.responded || 0 });
        }
      );
    });

    const sentimentDistribution: Record<Sentiment, number> = {
      positive: 0,
      neutral: 0,
      negative: 0
    };
    for (const row of sentimentResult) {
      sentimentDistribution[row.sentiment] = row.count;
    }

    const responseRate = statsResult.total > 0 
      ? parseFloat(((responseResult.responded / statsResult.total) * 100).toFixed(1))
      : 0;

    return {
      business,
      totalReviews: statsResult.total,
      averageRating: parseFloat(statsResult.avg.toFixed(2)),
      sentimentDistribution,
      responseRate
    };
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; message: string; stats?: { businesses: number; reviews: number } }> {
    try {
      await this.ensureInitialized();
      
      const businesses = await this.listBusinesses({ activeOnly: false });
      const reviews = await this.getAllReviews({ limit: 1 });

      return {
        healthy: true,
        message: `Review monitor operational. ${businesses.length} businesses configured.`,
        stats: {
          businesses: businesses.length,
          reviews: (await new Promise<number>((resolve, reject) => {
            this.db!.get('SELECT COUNT(*) as count FROM reviews', [], (err, row: any) => {
              if (err) reject(err);
              else resolve(row?.count || 0);
            });
          }))
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error}`
      };
    }
  }

  // Cleanup
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
  }
}

export default ReviewMonitorSkill;
