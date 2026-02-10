import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Types
export interface Recipient {
  id?: number;
  name: string;
  relationship: string;
  age?: number;
  gender?: string;
  interests: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecipientRecord {
  id?: number;
  name: string;
  relationship: string;
  age?: number | null;
  gender?: string | null;
  interests: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GiftSuggestion {
  id: string;
  name: string;
  description: string;
  category: string;
  priceRange: { min: number; max: number };
  interests: string[];
  occasions: string[];
  ageRange?: { min?: number; max?: number };
  gender?: string[];
  trending: boolean;
  trendingScore?: number;
}

export interface GiftHistory {
  id?: number;
  recipientId: number;
  giftName: string;
  occasion: string;
  date: string;
  price?: number;
  notes?: string;
  reaction?: 'loved' | 'liked' | 'neutral' | 'disliked';
}

export interface GiftHistoryRecord {
  id?: number;
  recipient_id: number;
  gift_name: string;
  occasion: string;
  date: string;
  price?: number | null;
  notes?: string | null;
  reaction?: string | null;
}

export interface SuggestionRequest {
  recipientId?: number;
  interests?: string[];
  budgetMin?: number;
  budgetMax?: number;
  occasion?: string;
  excludePrevious?: boolean;
  count?: number;
}

export interface SuggestionResult {
  suggestion: GiftSuggestion;
  matchScore: number;
  matchReasons: string[];
}

// Gift database - curated suggestions
const GIFT_DATABASE: GiftSuggestion[] = [
  // Tech & Gadgets
  { id: 'tech-001', name: 'Wireless Earbuds', description: 'High-quality wireless earbuds with noise cancellation', category: 'Tech', priceRange: { min: 50, max: 250 }, interests: ['technology', 'music', 'fitness'], occasions: ['birthday', 'christmas', 'graduation'], trending: true, trendingScore: 95 },
  { id: 'tech-002', name: 'Smart Watch', description: 'Fitness and health tracking smartwatch', category: 'Tech', priceRange: { min: 200, max: 500 }, interests: ['technology', 'fitness', 'health'], occasions: ['birthday', 'christmas', 'anniversary'], trending: true, trendingScore: 90 },
  { id: 'tech-003', name: 'Portable Bluetooth Speaker', description: 'Waterproof portable speaker for outdoor adventures', category: 'Tech', priceRange: { min: 30, max: 150 }, interests: ['technology', 'music', 'outdoors', 'travel'], occasions: ['birthday', 'christmas', 'housewarming'], trending: false },
  { id: 'tech-004', name: 'E-Reader', description: 'Digital e-reader with adjustable lighting', category: 'Tech', priceRange: { min: 100, max: 300 }, interests: ['technology', 'reading', 'travel'], occasions: ['birthday', 'christmas', 'graduation'], trending: true, trendingScore: 85 },
  { id: 'tech-005', name: 'Smart Home Assistant', description: 'Voice-controlled smart speaker for home automation', category: 'Tech', priceRange: { min: 30, max: 100 }, interests: ['technology', 'home', 'cooking'], occasions: ['birthday', 'christmas', 'housewarming'], trending: false },
  { id: 'tech-006', name: 'Phone Camera Lens Kit', description: 'Clip-on lenses for smartphone photography', category: 'Tech', priceRange: { min: 20, max: 80 }, interests: ['technology', 'photography', 'travel'], occasions: ['birthday', 'christmas'], trending: false },
  { id: 'tech-007', name: 'Mechanical Keyboard', description: 'Customizable mechanical keyboard for typing enthusiasts', category: 'Tech', priceRange: { min: 80, max: 250 }, interests: ['technology', 'gaming', 'productivity'], occasions: ['birthday', 'christmas'], trending: true, trendingScore: 88 },
  { id: 'tech-008', name: 'Drone', description: 'Beginner-friendly camera drone', category: 'Tech', priceRange: { min: 100, max: 500 }, interests: ['technology', 'photography', 'outdoors'], occasions: ['birthday', 'christmas', 'graduation'], trending: true, trendingScore: 82 },
  
  // Experiences
  { id: 'exp-001', name: 'Spa Day Experience', description: 'Full day of relaxation with massage and treatments', category: 'Experiences', priceRange: { min: 100, max: 300 }, interests: ['wellness', 'relaxation', 'self-care'], occasions: ['birthday', 'anniversary', 'mothers-day'], gender: ['female'], trending: false },
  { id: 'exp-002', name: 'Cooking Class', description: 'Hands-on cooking class with professional chef', category: 'Experiences', priceRange: { min: 50, max: 200 }, interests: ['cooking', 'food', 'learning'], occasions: ['birthday', 'anniversary', 'christmas'], trending: true, trendingScore: 78 },
  { id: 'exp-003', name: 'Hot Air Balloon Ride', description: 'Scenic hot air balloon experience', category: 'Experiences', priceRange: { min: 200, max: 400 }, interests: ['adventure', 'travel', 'photography'], occasions: ['birthday', 'anniversary', 'graduation'], trending: false },
  { id: 'exp-004', name: 'Wine Tasting Tour', description: 'Guided tour of local wineries with tastings', category: 'Experiences', priceRange: { min: 75, max: 200 }, interests: ['wine', 'food', 'travel'], occasions: ['birthday', 'anniversary'], ageRange: { min: 21 }, trending: false },
  { id: 'exp-005', name: 'Concert Tickets', description: 'Tickets to see a favorite artist or band', category: 'Experiences', priceRange: { min: 50, max: 300 }, interests: ['music', 'entertainment'], occasions: ['birthday', 'christmas', 'anniversary'], trending: true, trendingScore: 92 },
  { id: 'exp-006', name: 'Skydiving Experience', description: 'Tandem skydiving jump with instructor', category: 'Experiences', priceRange: { min: 200, max: 400 }, interests: ['adventure', 'extreme-sports'], occasions: ['birthday', 'graduation'], trending: false },
  { id: 'exp-007', name: 'Art Class', description: 'Painting or pottery class for creative expression', category: 'Experiences', priceRange: { min: 40, max: 120 }, interests: ['art', 'creativity', 'learning'], occasions: ['birthday', 'christmas'], trending: true, trendingScore: 75 },
  { id: 'exp-008', name: 'Weekend Getaway', description: 'Two-night stay at boutique hotel or B&B', category: 'Experiences', priceRange: { min: 300, max: 800 }, interests: ['travel', 'relaxation', 'romance'], occasions: ['anniversary', 'birthday', 'valentines'], trending: false },
  
  // Home & Living
  { id: 'home-001', name: 'Cozy Blanket', description: 'Soft, warm throw blanket in neutral tones', category: 'Home', priceRange: { min: 30, max: 100 }, interests: ['home', 'comfort', 'decor'], occasions: ['birthday', 'christmas', 'housewarming'], trending: true, trendingScore: 80 },
  { id: 'home-002', name: 'Aromatherapy Diffuser', description: 'Essential oil diffuser with ambient lighting', category: 'Home', priceRange: { min: 25, max: 60 }, interests: ['home', 'wellness', 'relaxation'], occasions: ['birthday', 'christmas', 'housewarming'], trending: false },
  { id: 'home-003', name: 'Indoor Plant Set', description: 'Low-maintenance houseplants with decorative pots', category: 'Home', priceRange: { min: 30, max: 80 }, interests: ['home', 'plants', 'nature'], occasions: ['birthday', 'housewarming'], trending: true, trendingScore: 87 },
  { id: 'home-004', name: 'Coffee Maker', description: 'Programmable coffee maker for perfect brews', category: 'Home', priceRange: { min: 50, max: 200 }, interests: ['coffee', 'home', 'cooking'], occasions: ['birthday', 'christmas', 'housewarming'], trending: false },
  { id: 'home-005', name: 'Weighted Blanket', description: 'Therapeutic weighted blanket for better sleep', category: 'Home', priceRange: { min: 50, max: 150 }, interests: ['home', 'wellness', 'sleep'], occasions: ['birthday', 'christmas'], trending: true, trendingScore: 85 },
  { id: 'home-006', name: 'Smart Light Bulbs', description: 'Color-changing smart bulbs for ambient lighting', category: 'Home', priceRange: { min: 30, max: 100 }, interests: ['home', 'technology', 'decor'], occasions: ['birthday', 'christmas', 'housewarming'], trending: false },
  { id: 'home-007', name: 'Premium Cookware Set', description: 'High-quality pots and pans for home chefs', category: 'Home', priceRange: { min: 150, max: 400 }, interests: ['cooking', 'home', 'food'], occasions: ['wedding', 'birthday', 'christmas'], trending: false },
  { id: 'home-008', name: 'Robot Vacuum', description: 'Smart robot vacuum for automated cleaning', category: 'Home', priceRange: { min: 200, max: 600 }, interests: ['home', 'technology', 'cleaning'], occasions: ['birthday', 'christmas', 'housewarming'], trending: true, trendingScore: 89 },
  
  // Fashion & Accessories
  { id: 'fash-001', name: 'Designer Scarf', description: 'Luxurious silk or cashmere scarf', category: 'Fashion', priceRange: { min: 50, max: 200 }, interests: ['fashion', 'style'], occasions: ['birthday', 'christmas', 'anniversary'], trending: false },
  { id: 'fash-002', name: 'Minimalist Watch', description: 'Elegant timepiece for everyday wear', category: 'Fashion', priceRange: { min: 100, max: 300 }, interests: ['fashion', 'style', 'accessories'], occasions: ['birthday', 'graduation', 'anniversary'], trending: true, trendingScore: 79 },
  { id: 'fash-003', name: 'Leather Wallet', description: 'Premium leather wallet with RFID protection', category: 'Fashion', priceRange: { min: 40, max: 120 }, interests: ['fashion', 'accessories'], occasions: ['birthday', 'christmas', 'fathers-day'], gender: ['male'], trending: false },
  { id: 'fash-004', name: 'Sunglasses', description: 'Stylish UV-protection sunglasses', category: 'Fashion', priceRange: { min: 50, max: 200 }, interests: ['fashion', 'travel', 'outdoors'], occasions: ['birthday', 'christmas'], trending: false },
  { id: 'fash-005', name: 'Designer Handbag', description: 'Classic handbag from premium brand', category: 'Fashion', priceRange: { min: 200, max: 500 }, interests: ['fashion', 'style', 'luxury'], occasions: ['birthday', 'anniversary', 'christmas'], gender: ['female'], trending: true, trendingScore: 83 },
  { id: 'fash-006', name: 'Jewelry', description: 'Elegant necklace, bracelet, or earrings', category: 'Fashion', priceRange: { min: 50, max: 300 }, interests: ['fashion', 'jewelry', 'accessories'], occasions: ['birthday', 'anniversary', 'valentines', 'christmas'], gender: ['female'], trending: false },
  { id: 'fash-007', name: 'Sneakers', description: 'Trendy or classic sneakers', category: 'Fashion', priceRange: { min: 80, max: 250 }, interests: ['fashion', 'sneakers', 'fitness'], occasions: ['birthday', 'christmas'], trending: true, trendingScore: 91 },
  { id: 'fash-008', name: 'Cozy Slippers', description: 'Plush, comfortable house slippers', category: 'Fashion', priceRange: { min: 30, max: 80 }, interests: ['comfort', 'home'], occasions: ['birthday', 'christmas'], trending: false },
  
  // Books & Learning
  { id: 'book-001', name: 'Bestselling Novel', description: 'Current bestselling fiction book', category: 'Books', priceRange: { min: 15, max: 30 }, interests: ['reading', 'books', 'fiction'], occasions: ['birthday', 'christmas'], trending: true, trendingScore: 77 },
  { id: 'book-002', name: 'Coffee Table Book', description: 'Beautiful photography or art book', category: 'Books', priceRange: { min: 40, max: 100 }, interests: ['art', 'photography', 'decor', 'reading'], occasions: ['birthday', 'christmas', 'housewarming'], trending: false },
  { id: 'book-003', name: 'Cookbook', description: 'Recipes from famous chef or cuisine', category: 'Books', priceRange: { min: 25, max: 50 }, interests: ['cooking', 'food', 'reading'], occasions: ['birthday', 'christmas', 'housewarming'], trending: false },
  { id: 'book-004', name: 'Online Course Subscription', description: 'Year of access to learning platform', category: 'Learning', priceRange: { min: 100, max: 300 }, interests: ['learning', 'self-improvement', 'career'], occasions: ['birthday', 'christmas', 'graduation'], trending: true, trendingScore: 86 },
  { id: 'book-005', name: 'Language Learning App', description: 'Premium subscription to language app', category: 'Learning', priceRange: { min: 60, max: 150 }, interests: ['learning', 'languages', 'travel'], occasions: ['birthday', 'christmas'], trending: true, trendingScore: 81 },
  { id: 'book-006', name: 'MasterClass Subscription', description: 'Learn from world-renowned experts', category: 'Learning', priceRange: { min: 120, max: 200 }, interests: ['learning', 'creativity', 'self-improvement'], occasions: ['birthday', 'christmas', 'graduation'], trending: true, trendingScore: 84 },
  { id: 'book-007', name: 'Puzzle Set', description: 'High-quality jigsaw puzzles', category: 'Entertainment', priceRange: { min: 20, max: 50 }, interests: ['puzzles', 'games', 'relaxation'], occasions: ['birthday', 'christmas'], trending: true, trendingScore: 76 },
  { id: 'book-008', name: 'Board Game', description: 'Popular strategy or party board game', category: 'Entertainment', priceRange: { min: 30, max: 80 }, interests: ['games', 'social', 'entertainment'], occasions: ['birthday', 'christmas'], trending: true, trendingScore: 88 },
  
  // Health & Wellness
  { id: 'well-001', name: 'Yoga Mat & Accessories', description: 'Premium yoga mat with blocks and strap', category: 'Wellness', priceRange: { min: 40, max: 100 }, interests: ['fitness', 'yoga', 'wellness'], occasions: ['birthday', 'christmas'], trending: false },
  { id: 'well-002', name: 'Fitness Tracker', description: 'Basic fitness band for activity tracking', category: 'Wellness', priceRange: { min: 30, max: 100 }, interests: ['fitness', 'health', 'technology'], occasions: ['birthday', 'christmas'], trending: false },
  { id: 'well-003', name: 'Meditation App Subscription', description: 'Year of guided meditation sessions', category: 'Wellness', priceRange: { min: 60, max: 100 }, interests: ['wellness', 'meditation', 'mental-health'], occasions: ['birthday', 'christmas'], trending: true, trendingScore: 82 },
  { id: 'well-004', name: 'Massage Gun', description: 'Percussion massager for muscle recovery', category: 'Wellness', priceRange: { min: 50, max: 200 }, interests: ['fitness', 'wellness', 'sports'], occasions: ['birthday', 'christmas'], trending: true, trendingScore: 90 },
  { id: 'well-005', name: 'Gym Membership', description: 'Monthly or annual gym subscription', category: 'Wellness', priceRange: { min: 100, max: 500 }, interests: ['fitness', 'health', 'wellness'], occasions: ['birthday', 'christmas', 'new-year'], trending: false },
  { id: 'well-006', name: 'Water Bottle', description: 'Insulated stainless steel water bottle', category: 'Wellness', priceRange: { min: 25, max: 50 }, interests: ['fitness', 'outdoors', 'wellness'], occasions: ['birthday', 'christmas'], trending: false },
  { id: 'well-007', name: 'Resistance Bands Set', description: 'Complete set for home workouts', category: 'Wellness', priceRange: { min: 20, max: 50 }, interests: ['fitness', 'home-workout', 'health'], occasions: ['birthday', 'christmas'], trending: false },
  { id: 'well-008', name: 'Premium Tea Set', description: 'Artisan tea collection with infuser', category: 'Wellness', priceRange: { min: 40, max: 100 }, interests: ['tea', 'wellness', 'home'], occasions: ['birthday', 'christmas'], trending: false },
  
  // Food & Drink
  { id: 'food-001', name: 'Gourmet Chocolate Box', description: 'Artisan chocolate assortment', category: 'Food', priceRange: { min: 25, max: 75 }, interests: ['food', 'chocolate', 'gourmet'], occasions: ['birthday', 'christmas', 'valentines'], trending: false },
  { id: 'food-002', name: 'Wine Subscription', description: 'Monthly curated wine selections', category: 'Food', priceRange: { min: 150, max: 400 }, interests: ['wine', 'food', 'luxury'], occasions: ['birthday', 'christmas', 'anniversary'], ageRange: { min: 21 }, trending: true, trendingScore: 79 },
  { id: 'food-003', name: 'Coffee Subscription', description: 'Monthly specialty coffee beans', category: 'Food', priceRange: { min: 80, max: 200 }, interests: ['coffee', 'food', 'gourmet'], occasions: ['birthday', 'christmas'], trending: true, trendingScore: 83 },
  { id: 'food-004', name: 'Charcuterie Board Set', description: 'Complete set for entertaining', category: 'Food', priceRange: { min: 50, max: 150 }, interests: ['food', 'entertaining', 'cooking'], occasions: ['birthday', 'christmas', 'housewarming'], trending: false },
  { id: 'food-005', name: 'Hot Sauce Collection', description: 'Variety pack of artisan hot sauces', category: 'Food', priceRange: { min: 30, max: 60 }, interests: ['food', 'spicy', 'cooking'], occasions: ['birthday', 'christmas'], trending: false },
  { id: 'food-006', name: 'Cheese Making Kit', description: 'DIY kit for homemade cheese', category: 'Food', priceRange: { min: 40, max: 80 }, interests: ['cooking', 'food', 'diy'], occasions: ['birthday', 'christmas'], trending: false },
  { id: 'food-007', name: 'Whiskey Decanter Set', description: 'Crystal decanter with matching glasses', category: 'Food', priceRange: { min: 60, max: 150 }, interests: ['spirits', 'entertaining', 'home'], occasions: ['birthday', 'christmas', 'fathers-day'], gender: ['male'], ageRange: { min: 21 }, trending: false },
  { id: 'food-008', name: 'Baking Kit', description: 'Professional baking tools and ingredients', category: 'Food', priceRange: { min: 40, max: 100 }, interests: ['baking', 'cooking', 'food'], occasions: ['birthday', 'christmas'], trending: true, trendingScore: 78 },
];

// Helper function for SQLite run with result
function runWithResult(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export class GiftSuggestionsSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const baseDir = path.join(os.homedir(), '.openclaw', 'skills', 'gift-suggestions');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    this.dbPath = path.join(baseDir, 'data.db');
  }

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (this.db) return;

    this.initPromise = new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        this.initSchema().then(resolve).catch(reject);
      });
    });

    return this.initPromise;
  }

  private async initSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        // Recipients table
        this.db!.run(`
          CREATE TABLE IF NOT EXISTS recipients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            relationship TEXT NOT NULL,
            age INTEGER,
            gender TEXT,
            interests TEXT NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Gift history table
        this.db!.run(`
          CREATE TABLE IF NOT EXISTS gift_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipient_id INTEGER NOT NULL,
            gift_name TEXT NOT NULL,
            occasion TEXT NOT NULL,
            date TEXT NOT NULL,
            price REAL,
            notes TEXT,
            reaction TEXT,
            FOREIGN KEY (recipient_id) REFERENCES recipients(id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  // Recipient Management
  async addRecipient(recipient: Recipient): Promise<number> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, `
      INSERT INTO recipients (name, relationship, age, gender, interests, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      recipient.name,
      recipient.relationship,
      recipient.age || null,
      recipient.gender || null,
      JSON.stringify(recipient.interests),
      recipient.notes || null
    ]);

    return result.lastID;
  }

  async updateRecipient(id: number, updates: Partial<Recipient>): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const sets: string[] = [];
    const values: any[] = [];

    if (updates.name) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.relationship) { sets.push('relationship = ?'); values.push(updates.relationship); }
    if (updates.age !== undefined) { sets.push('age = ?'); values.push(updates.age); }
    if (updates.gender) { sets.push('gender = ?'); values.push(updates.gender); }
    if (updates.interests) { sets.push('interests = ?'); values.push(JSON.stringify(updates.interests)); }
    if (updates.notes !== undefined) { sets.push('notes = ?'); values.push(updates.notes); }

    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await runWithResult(this.db, `
      UPDATE recipients SET ${sets.join(', ')} WHERE id = ?
    `, values);

    return result.changes > 0;
  }

  async getRecipient(id: number): Promise<Recipient | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM recipients WHERE id = ?',
        [id],
        (err, row: RecipientRecord | undefined) => {
          if (err) reject(err);
          else if (!row) resolve(null);
          else resolve(this.recordToRecipient(row));
        }
      );
    });
  }

  async listRecipients(): Promise<Recipient[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM recipients ORDER BY name',
        [],
        (err, rows: RecipientRecord[]) => {
          if (err) reject(err);
          else resolve(rows.map(r => this.recordToRecipient(r)));
        }
      );
    });
  }

  async deleteRecipient(id: number): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    await runWithResult(this.db, 'DELETE FROM gift_history WHERE recipient_id = ?', [id]);
    const result = await runWithResult(this.db, 'DELETE FROM recipients WHERE id = ?', [id]);
    return result.changes > 0;
  }

  // Gift History
  async addGiftHistory(history: GiftHistory): Promise<number> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, `
      INSERT INTO gift_history (recipient_id, gift_name, occasion, date, price, notes, reaction)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      history.recipientId,
      history.giftName,
      history.occasion,
      history.date,
      history.price || null,
      history.notes || null,
      history.reaction || null
    ]);

    return result.lastID;
  }

  async getGiftHistory(recipientId?: number): Promise<GiftHistory[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const sql = recipientId 
      ? 'SELECT * FROM gift_history WHERE recipient_id = ? ORDER BY date DESC'
      : 'SELECT * FROM gift_history ORDER BY date DESC';
    const params = recipientId ? [recipientId] : [];

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows: GiftHistoryRecord[]) => {
        if (err) reject(err);
        else resolve(rows.map(r => this.recordToGiftHistory(r)));
      });
    });
  }

  // Suggestion Engine
  async suggestGifts(request: SuggestionRequest): Promise<SuggestionResult[]> {
    await this.initialize();
    
    let recipient: Recipient | null = null;
    if (request.recipientId) {
      recipient = await this.getRecipient(request.recipientId);
    }

    const interests = request.interests || recipient?.interests || [];
    const budgetMin = request.budgetMin || 0;
    const budgetMax = request.budgetMax || Infinity;
    const occasion = request.occasion;
    
    // Get previously gifted items to exclude
    let previousGifts: string[] = [];
    if (request.excludePrevious && request.recipientId) {
      const history = await this.getGiftHistory(request.recipientId);
      previousGifts = history.map(h => h.giftName.toLowerCase());
    }

    // Score all gifts
    const scoredGifts: SuggestionResult[] = GIFT_DATABASE.map(gift => {
      let score = 0;
      const reasons: string[] = [];

      // Interest matching (highest weight)
      const interestMatches = gift.interests.filter(i => 
        interests.some(userInterest => 
          i.toLowerCase().includes(userInterest.toLowerCase()) ||
          userInterest.toLowerCase().includes(i.toLowerCase())
        )
      );
      if (interestMatches.length > 0) {
        score += interestMatches.length * 25;
        reasons.push(`Matches ${interestMatches.length} interest(s)`);
      }

      // Budget matching
      if (gift.priceRange.min >= budgetMin && gift.priceRange.max <= budgetMax) {
        score += 15;
        reasons.push('Within budget');
      } else if (gift.priceRange.min <= budgetMax && gift.priceRange.max >= budgetMin) {
        score += 5;
        reasons.push('Partially within budget');
      }

      // Occasion matching
      if (occasion && gift.occasions.includes(occasion.toLowerCase())) {
        score += 20;
        reasons.push(`Great for ${occasion}`);
      }

      // Age matching
      if (recipient?.age && gift.ageRange) {
        if ((!gift.ageRange.min || recipient.age >= gift.ageRange.min) &&
            (!gift.ageRange.max || recipient.age <= gift.ageRange.max)) {
          score += 10;
          reasons.push('Age appropriate');
        }
      }

      // Gender matching
      if (recipient?.gender && gift.gender) {
        if (gift.gender.includes(recipient.gender.toLowerCase())) {
          score += 5;
          reasons.push('Gender appropriate');
        }
      }

      // Trending bonus
      if (gift.trending) {
        score += 10;
        reasons.push('Trending now');
      }

      // Exclude previously gifted
      if (previousGifts.includes(gift.name.toLowerCase())) {
        score = -1;
      }

      return { suggestion: gift, matchScore: score, matchReasons: reasons };
    });

    // Sort by score and return top results
    return scoredGifts
      .filter(r => r.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, request.count || 10);
  }

  async getTrendingGifts(limit: number = 10): Promise<GiftSuggestion[]> {
    return GIFT_DATABASE
      .filter(g => g.trending)
      .sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0))
      .slice(0, limit);
  }

  async getGiftsByCategory(): Promise<Record<string, GiftSuggestion[]>> {
    const categories: Record<string, GiftSuggestion[]> = {};
    GIFT_DATABASE.forEach(gift => {
      if (!categories[gift.category]) {
        categories[gift.category] = [];
      }
      categories[gift.category].push(gift);
    });
    return categories;
  }

  async getGiftsByBudget(maxBudget: number): Promise<GiftSuggestion[]> {
    return GIFT_DATABASE.filter(g => g.priceRange.min <= maxBudget);
  }

  // Helper methods
  private recordToRecipient(record: RecipientRecord): Recipient {
    return {
      id: record.id,
      name: record.name,
      relationship: record.relationship,
      age: record.age || undefined,
      gender: record.gender || undefined,
      interests: JSON.parse(record.interests),
      notes: record.notes || undefined,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }

  private recordToGiftHistory(record: GiftHistoryRecord): GiftHistory {
    return {
      id: record.id,
      recipientId: record.recipient_id,
      giftName: record.gift_name,
      occasion: record.occasion,
      date: record.date,
      price: record.price || undefined,
      notes: record.notes || undefined,
      reaction: record.reaction as GiftHistory['reaction'] || undefined
    };
  }

  async getStats(): Promise<{
    totalRecipients: number;
    totalGiftsGiven: number;
    totalGiftValue: number;
    averageGiftValue: number;
  }> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get(`
        SELECT 
          (SELECT COUNT(*) FROM recipients) as total_recipients,
          (SELECT COUNT(*) FROM gift_history) as total_gifts,
          (SELECT COALESCE(SUM(price), 0) FROM gift_history WHERE price IS NOT NULL) as total_value
      `, [], (err, row: any) => {
        if (err) reject(err);
        else {
          const totalGifts = row.total_gifts || 0;
          const totalValue = row.total_value || 0;
          resolve({
            totalRecipients: row.total_recipients || 0,
            totalGiftsGiven: totalGifts,
            totalGiftValue: totalValue,
            averageGiftValue: totalGifts > 0 ? totalValue / totalGifts : 0
          });
        }
      });
    });
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      await this.initialize();
      await this.listRecipients();
      return { status: 'healthy', message: 'Gift suggestions skill is operational' };
    } catch (error) {
      return { status: 'unhealthy', message: `Error: ${error}` };
    }
  }

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
        this.db = null;
        this.initPromise = null;
      });
    }
  }
}

export default GiftSuggestionsSkill;
