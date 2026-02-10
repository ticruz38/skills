import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Platform types
export type Platform = 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'email' | 'generic';

// Tone options
export type Tone = 'professional' | 'casual' | 'friendly' | 'formal' | 'enthusiastic' | 'empathetic' | 'authoritative' | 'witty';

// Sentiment types
export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed';

// Reply request interface
export interface ReplyRequest {
  message: string;
  context?: string;
  authorName?: string;
  platform?: Platform;
  tone?: Tone;
  count?: number;
}

// Generated reply interface
export interface GeneratedReply {
  id?: number;
  originalMessage: string;
  reply: string;
  platform: Platform;
  tone: Tone;
  sentiment: Sentiment;
  context?: string;
  authorName?: string;
  createdAt: string;
}

// Sentiment analysis result
export interface SentimentAnalysis {
  sentiment: Sentiment;
  score: number;
  emotions: string[];
  confidence: number;
}

// Template interface
export interface ReplyTemplate {
  id?: number;
  name: string;
  description: string;
  category: string;
  template: string;
  defaultTone: Tone;
  variables: string[];
  createdAt: string;
}

// Default templates
const DEFAULT_TEMPLATES: Omit<ReplyTemplate, 'id' | 'createdAt'>[] = [
  {
    name: 'thank-you',
    description: 'Express gratitude for positive feedback',
    category: 'appreciation',
    defaultTone: 'friendly',
    template: "Thank you so much, {{name}}! {{appreciation}}",
    variables: ['name', 'appreciation']
  },
  {
    name: 'question-response',
    description: 'Answer common questions helpfully',
    category: 'support',
    defaultTone: 'professional',
    template: "Hi {{name}}, great question! {{answer}} Let me know if you need anything else!",
    variables: ['name', 'answer']
  },
  {
    name: 'complaint-acknowledgment',
    description: 'Acknowledge issues professionally',
    category: 'support',
    defaultTone: 'empathetic',
    template: "Hi {{name}}, I'm really sorry to hear about {{issue}}. {{solution}} We appreciate your patience.",
    variables: ['name', 'issue', 'solution']
  },
  {
    name: 'follow-up-request',
    description: 'Encourage further engagement',
    category: 'engagement',
    defaultTone: 'enthusiastic',
    template: "Thanks {{name}}! {{engagement}} We'd love to hear more of your thoughts!",
    variables: ['name', 'engagement']
  },
  {
    name: 'appreciation',
    description: 'Show appreciation for support',
    category: 'appreciation',
    defaultTone: 'friendly',
    template: "{{name}}, your support means the world to us! {{gratitude}}",
    variables: ['name', 'gratitude']
  },
  {
    name: 'welcome',
    description: 'Greet new followers/connections',
    category: 'engagement',
    defaultTone: 'friendly',
    template: "Welcome {{name}}! {{welcomeMessage}} So glad you're here! 🎉",
    variables: ['name', 'welcomeMessage']
  },
  {
    name: 'apology',
    description: 'Professional apology responses',
    category: 'support',
    defaultTone: 'empathetic',
    template: "{{name}}, please accept our sincere apologies for {{issue}}. {{resolution}} We're committed to making this right.",
    variables: ['name', 'issue', 'resolution']
  },
  {
    name: 'clarification',
    description: 'Clear up misunderstandings',
    category: 'support',
    defaultTone: 'professional',
    template: "Hi {{name}}, thanks for reaching out. To clarify: {{clarification}} Hope that helps clear things up!",
    variables: ['name', 'clarification']
  }
];

// Tone modifiers for reply generation
const TONE_MODIFIERS: Record<Tone, string> = {
  professional: 'Use clear, business-appropriate language. Be concise and respectful.',
  casual: 'Write in a relaxed, conversational style. Use contractions and everyday language.',
  friendly: 'Be warm and approachable. Use inclusive language and positive expressions.',
  formal: 'Use proper grammar and sophisticated vocabulary. Avoid contractions and slang.',
  enthusiastic: 'Show excitement and energy. Use exclamation points and positive adjectives.',
  empathetic: 'Show understanding and compassion. Acknowledge feelings and offer support.',
  authoritative: 'Demonstrate expertise and confidence. Use strong statements and evidence.',
  witty: 'Be clever and humorous. Use wordplay and light sarcasm where appropriate.'
};

// Platform constraints
const PLATFORM_CONSTRAINTS: Record<Platform, { maxLength: number; style: string }> = {
  twitter: { maxLength: 280, style: 'Short, punchy, may use abbreviations and hashtags' },
  linkedin: { maxLength: 3000, style: 'Professional, thoughtful, may include industry insights' },
  instagram: { maxLength: 2200, style: 'Visual-friendly, emoji-supported, enthusiastic' },
  facebook: { maxLength: 63206, style: 'Casual, conversational, community-focused' },
  email: { maxLength: 10000, style: 'Formal, structured, complete sentences' },
  generic: { maxLength: 2000, style: 'Balanced, adaptable to context' }
};

// Positive keywords for sentiment analysis
const POSITIVE_KEYWORDS = [
  'amazing', 'awesome', 'great', 'excellent', 'fantastic', 'wonderful', 'love', 'best',
  'perfect', 'brilliant', 'outstanding', 'superb', 'magnificent', 'fabulous', 'incredible',
  'thank', 'thanks', 'appreciate', 'grateful', 'helpful', 'useful', 'valuable', 'insightful',
  'inspiring', 'motivating', 'impressive', 'beautiful', 'nice', 'good', 'happy', 'pleased',
  'delighted', 'excited', 'thrilled', 'congratulations', 'well done', 'kudos', 'cheers'
];

// Negative keywords for sentiment analysis
const NEGATIVE_KEYWORDS = [
  'terrible', 'awful', 'horrible', 'hate', 'worst', 'bad', 'disappointing', 'frustrated',
  'annoying', 'useless', 'waste', 'problem', 'issue', 'broken', 'wrong', 'error', 'fail',
  'failed', 'disappointed', 'upset', 'angry', 'furious', 'ridiculous', 'stupid', 'annoyed',
  'confused', 'misleading', 'unfair', 'unhappy', 'dissatisfied', 'complaint', 'complain',
  'never', 'wont', 'waste', 'refund', 'cancel', 'stop'
];

export class EngagementRepliesSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const baseDir = path.join(os.homedir(), '.openclaw', 'skills', 'engagement-replies');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    this.dbPath = path.join(baseDir, 'replies.db');
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
      `CREATE TABLE IF NOT EXISTS generated_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_message TEXT NOT NULL,
        reply TEXT NOT NULL,
        platform TEXT NOT NULL,
        tone TEXT NOT NULL,
        sentiment TEXT NOT NULL,
        context TEXT,
        author_name TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        template TEXT NOT NULL,
        default_tone TEXT NOT NULL,
        variables TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sentiment_cache (
        message_hash TEXT PRIMARY KEY,
        sentiment TEXT NOT NULL,
        score REAL NOT NULL,
        emotions TEXT NOT NULL,
        confidence REAL NOT NULL,
        created_at TEXT NOT NULL
      )`
    ];

    for (const query of queries) {
      await new Promise<void>((resolve, reject) => {
        this.db!.run(query, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Insert default templates
    await this.insertDefaultTemplates();
  }

  private async insertDefaultTemplates(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    for (const template of DEFAULT_TEMPLATES) {
      const exists = await new Promise<boolean>((resolve) => {
        this.db!.get(
          'SELECT 1 FROM templates WHERE name = ?',
          [template.name],
          (err: Error | null, row: any) => {
            resolve(!!row);
          }
        );
      });

      if (!exists) {
        await new Promise<void>((resolve, reject) => {
          this.db!.run(
            `INSERT INTO templates (name, description, category, template, default_tone, variables, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              template.name,
              template.description,
              template.category,
              template.template,
              template.defaultTone,
              JSON.stringify(template.variables),
              new Date().toISOString()
            ],
            (err: Error | null) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
    }
  }

  /**
   * Analyze sentiment of a message
   */
  async analyzeSentiment(message: string): Promise<SentimentAnalysis> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    // Create simple hash for caching
    const messageHash = this.simpleHash(message);

    // Check cache first
    const cached = await new Promise<SentimentAnalysis | null>((resolve) => {
      this.db!.get(
        'SELECT * FROM sentiment_cache WHERE message_hash = ?',
        [messageHash],
        (err: Error | null, row: any) => {
          if (err || !row) {
            resolve(null);
          } else {
            resolve({
              sentiment: row.sentiment,
              score: row.score,
              emotions: JSON.parse(row.emotions),
              confidence: row.confidence
            });
          }
        }
      );
    });

    if (cached) {
      return cached;
    }

    // Perform sentiment analysis
    const lowerMessage = message.toLowerCase();
    let positiveScore = 0;
    let negativeScore = 0;
    const emotions: string[] = [];

    // Count positive keywords
    for (const keyword of POSITIVE_KEYWORDS) {
      if (lowerMessage.includes(keyword)) {
        positiveScore++;
        if (['love', 'amazing', 'awesome', 'fantastic'].includes(keyword)) {
          emotions.push('joy');
        }
        if (['thank', 'thanks', 'grateful', 'appreciate'].includes(keyword)) {
          emotions.push('gratitude');
        }
        if (['excited', 'thrilled', 'enthusiastic'].includes(keyword)) {
          emotions.push('excitement');
        }
      }
    }

    // Count negative keywords
    for (const keyword of NEGATIVE_KEYWORDS) {
      if (lowerMessage.includes(keyword)) {
        negativeScore++;
        if (['angry', 'furious', 'annoyed'].includes(keyword)) {
          emotions.push('anger');
        }
        if (['disappointed', 'frustrated', 'upset'].includes(keyword)) {
          emotions.push('disappointment');
        }
        if (['confused', 'misleading'].includes(keyword)) {
          emotions.push('confusion');
        }
      }
    }

    // Check for exclamation marks (enthusiasm)
    const exclamationCount = (message.match(/!/g) || []).length;
    if (exclamationCount > 1) {
      positiveScore += 0.5;
      if (!emotions.includes('excitement')) {
        emotions.push('excitement');
      }
    }

    // Check for question marks (curiosity)
    const questionCount = (message.match(/\?/g) || []).length;
    if (questionCount > 0) {
      emotions.push('curiosity');
    }

    // Calculate final sentiment
    let sentiment: Sentiment;
    let score: number;
    const total = positiveScore + negativeScore;

    if (total === 0) {
      sentiment = 'neutral';
      score = 0.5;
    } else {
      const ratio = positiveScore / total;
      if (ratio >= 0.7) {
        sentiment = 'positive';
        score = 0.5 + (ratio * 0.5);
      } else if (ratio <= 0.3) {
        sentiment = 'negative';
        score = 0.5 - ((1 - ratio) * 0.5);
      } else {
        sentiment = 'mixed';
        score = 0.5;
      }
    }

    // Normalize score to 0-1 range
    score = Math.max(0, Math.min(1, score));

    // Calculate confidence based on keyword density
    const wordCount = message.split(/\s+/).length;
    const confidence = Math.min(1, total / Math.max(1, wordCount * 0.1));

    // Deduplicate emotions
    const uniqueEmotions = [...new Set(emotions)];

    const result: SentimentAnalysis = {
      sentiment,
      score,
      emotions: uniqueEmotions.length > 0 ? uniqueEmotions : ['neutral'],
      confidence
    };

    // Cache the result
    await new Promise<void>((resolve, reject) => {
      this.db!.run(
        `INSERT OR REPLACE INTO sentiment_cache (message_hash, sentiment, score, emotions, confidence, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          messageHash,
          result.sentiment,
          result.score,
          JSON.stringify(result.emotions),
          result.confidence,
          new Date().toISOString()
        ],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    return result;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Detect tone from message
   */
  async detectTone(message: string): Promise<Tone> {
    const sentiment = await this.analyzeSentiment(message);
    const lowerMessage = message.toLowerCase();

    // Check for specific tone indicators
    if (lowerMessage.includes('?') && (lowerMessage.includes('how') || lowerMessage.includes('what') || lowerMessage.includes('why'))) {
      return 'professional';
    }

    if (sentiment.emotions.includes('excitement') || sentiment.emotions.includes('joy')) {
      return 'enthusiastic';
    }

    if (sentiment.emotions.includes('anger') || sentiment.emotions.includes('disappointment')) {
      return 'empathetic';
    }

    if (lowerMessage.includes('lol') || lowerMessage.includes('haha') || lowerMessage.includes('😂')) {
      return 'casual';
    }

    // Default based on sentiment
    if (sentiment.sentiment === 'positive') {
      return 'friendly';
    } else if (sentiment.sentiment === 'negative') {
      return 'empathetic';
    }

    return 'professional';
  }

  /**
   * Generate reply suggestions
   */
  async generateReplies(request: ReplyRequest): Promise<GeneratedReply[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const { message, context, authorName, platform = 'generic', tone, count = 3 } = request;

    // Analyze sentiment of incoming message
    const sentiment = await this.analyzeSentiment(message);

    // Detect tone if not specified
    const targetTone = tone || await this.detectTone(message);

    // Generate multiple reply options
    const replies: GeneratedReply[] = [];

    for (let i = 0; i < count; i++) {
      const reply = this.createReply(message, context, authorName, platform, targetTone, sentiment, i);
      
      const generatedReply: GeneratedReply = {
        originalMessage: message,
        reply,
        platform,
        tone: targetTone,
        sentiment: sentiment.sentiment,
        context,
        authorName,
        createdAt: new Date().toISOString()
      };

      // Save to database
      const id = await this.saveGeneratedReply(generatedReply);
      generatedReply.id = id;

      replies.push(generatedReply);
    }

    return replies;
  }

  private createReply(
    message: string,
    context: string | undefined,
    authorName: string | undefined,
    platform: Platform,
    tone: Tone,
    sentiment: SentimentAnalysis,
    variant: number
  ): string {
    const constraints = PLATFORM_CONSTRAINTS[platform];
    const toneModifier = TONE_MODIFIERS[tone];
    const name = authorName || 'there';

    // Generate different reply styles based on variant
    const replies: string[] = [];

    // Reply variant 1: Direct response
    replies.push(this.generateDirectReply(message, name, platform, tone, sentiment, toneModifier));

    // Reply variant 2: Engaging follow-up
    replies.push(this.generateEngagingReply(message, name, platform, tone, sentiment, toneModifier, context));

    // Reply variant 3: Appreciation + Action
    replies.push(this.generateAppreciationReply(message, name, platform, tone, sentiment, toneModifier));

    let reply = replies[variant % replies.length];

    // Apply platform constraints
    if (reply.length > constraints.maxLength) {
      reply = reply.substring(0, constraints.maxLength - 3) + '...';
    }

    return reply;
  }

  private generateDirectReply(
    message: string,
    name: string,
    platform: Platform,
    tone: Tone,
    sentiment: SentimentAnalysis,
    toneModifier: string
  ): string {
    const isQuestion = message.includes('?');

    if (sentiment.sentiment === 'positive') {
      if (isQuestion) {
        return `Hi ${name}! Thanks for the kind words! To answer your question, I'd be happy to help. Feel free to DM me for more details!`;
      }
      return `Thank you so much, ${name}! Really appreciate you taking the time to share this! 🙏`;
    }

    if (sentiment.sentiment === 'negative') {
      return `Hi ${name}, I really appreciate you sharing this feedback. I'm here to help make things right. Could you DM me with more details?`;
    }

    if (isQuestion) {
      return `Hi ${name}! Great question. Let me know if you'd like me to elaborate further!`;
    }

    return `Thanks for reaching out, ${name}! Always appreciate thoughtful comments like yours.`;
  }

  private generateEngagingReply(
    message: string,
    name: string,
    platform: Platform,
    tone: Tone,
    sentiment: SentimentAnalysis,
    toneModifier: string,
    context?: string
  ): string {
    const isQuestion = message.includes('?');
    const contextRef = context ? ` on the ${context}` : '';

    if (sentiment.sentiment === 'positive') {
      if (isQuestion) {
        return `Hey ${name}! Love your enthusiasm${contextRef}! I'd love to hear more about what you're working on. What are your thoughts on this?`;
      }
      return `Thanks ${name}! What aspects resonated most with you? Always curious to hear different perspectives!`;
    }

    if (sentiment.sentiment === 'negative') {
      return `${name}, I hear you and I want to understand better. Would you be open to sharing what would make this better for you?`;
    }

    if (isQuestion) {
      return `Hi ${name}! That's an interesting point${contextRef}. What led you to ask about this?`;
    }

    return `${name}, thanks for sharing your thoughts! I'd love to continue this conversation - what else is on your mind?`;
  }

  private generateAppreciationReply(
    message: string,
    name: string,
    platform: Platform,
    tone: Tone,
    sentiment: SentimentAnalysis,
    toneModifier: string
  ): string {
    const isQuestion = message.includes('?');

    if (sentiment.sentiment === 'positive') {
      if (isQuestion) {
        return `${name}, thank you! I've sent you a detailed response. Your support means a lot! 🙌`;
      }
      return `So grateful for your support, ${name}! Comments like yours make my day. Thank you! 💙`;
    }

    if (sentiment.sentiment === 'negative') {
      return `Thank you for your honesty, ${name}. Feedback like yours helps us improve. I'm committed to addressing this.`;
    }

    if (isQuestion) {
      return `Thanks for the great question, ${name}! I've answered above - let me know if you need anything else!`;
    }

    return `Appreciate you taking the time to comment, ${name}! Thanks for being part of this community!`;
  }

  private async saveGeneratedReply(reply: GeneratedReply): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO generated_replies (original_message, reply, platform, tone, sentiment, context, author_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reply.originalMessage,
          reply.reply,
          reply.platform,
          reply.tone,
          reply.sentiment,
          reply.context || null,
          reply.authorName || null,
          reply.createdAt
        ],
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  /**
   * Get a template by name
   */
  async getTemplate(name: string): Promise<ReplyTemplate | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM templates WHERE name = ?',
        [name],
        (err: Error | null, row: any) => {
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
            name: row.name,
            description: row.description,
            category: row.category,
            template: row.template,
            defaultTone: row.default_tone,
            variables: JSON.parse(row.variables),
            createdAt: row.created_at
          });
        }
      );
    });
  }

  /**
   * Get all templates
   */
  async getTemplates(category?: string): Promise<ReplyTemplate[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM templates';
    const params: any[] = [];

    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }

    query += ' ORDER BY category, name';

    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const templates: ReplyTemplate[] = rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          category: row.category,
          template: row.template,
          defaultTone: row.default_tone,
          variables: JSON.parse(row.variables),
          createdAt: row.created_at
        }));

        resolve(templates);
      });
    });
  }

  /**
   * Apply a template with variable substitution
   */
  applyTemplate(template: ReplyTemplate, variables: Record<string, string>): string {
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
   * Get reply history
   */
  async getHistory(limit: number = 50): Promise<GeneratedReply[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM generated_replies ORDER BY created_at DESC LIMIT ?',
        [limit],
        (err: Error | null, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          const replies: GeneratedReply[] = rows.map(row => ({
            id: row.id,
            originalMessage: row.original_message,
            reply: row.reply,
            platform: row.platform,
            tone: row.tone,
            sentiment: row.sentiment,
            context: row.context,
            authorName: row.author_name,
            createdAt: row.created_at
          }));

          resolve(replies);
        }
      );
    });
  }

  /**
   * Get available tones
   */
  getAvailableTones(): Tone[] {
    return Object.keys(TONE_MODIFIERS) as Tone[];
  }

  /**
   * Get available platforms
   */
  getAvailablePlatforms(): Platform[] {
    return Object.keys(PLATFORM_CONSTRAINTS) as Platform[];
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.initialize();
      return { healthy: true, message: 'Engagement replies skill is ready' };
    } catch (error) {
      return { healthy: false, message: `Error: ${error}` };
    }
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalGenerated: number;
    byPlatform: Record<Platform, number>;
    byTone: Record<Tone, number>;
    bySentiment: Record<Sentiment, number>;
  }> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const total = await new Promise<number>((resolve, reject) => {
      this.db!.get('SELECT COUNT(*) as count FROM generated_replies', (err: Error | null, row: any) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    const byPlatform: Record<string, number> = {};
    const platforms = this.getAvailablePlatforms();
    for (const platform of platforms) {
      const count = await new Promise<number>((resolve, reject) => {
        this.db!.get(
          'SELECT COUNT(*) as count FROM generated_replies WHERE platform = ?',
          [platform],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });
      byPlatform[platform] = count;
    }

    const byTone: Record<string, number> = {};
    const tones = this.getAvailableTones();
    for (const tone of tones) {
      const count = await new Promise<number>((resolve, reject) => {
        this.db!.get(
          'SELECT COUNT(*) as count FROM generated_replies WHERE tone = ?',
          [tone],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });
      byTone[tone] = count;
    }

    const bySentiment: Record<string, number> = {};
    const sentiments: Sentiment[] = ['positive', 'negative', 'neutral', 'mixed'];
    for (const sentiment of sentiments) {
      const count = await new Promise<number>((resolve, reject) => {
        this.db!.get(
          'SELECT COUNT(*) as count FROM generated_replies WHERE sentiment = ?',
          [sentiment],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });
      bySentiment[sentiment] = count;
    }

    return {
      totalGenerated: total,
      byPlatform: byPlatform as Record<Platform, number>,
      byTone: byTone as Record<Tone, number>,
      bySentiment: bySentiment as Record<Sentiment, number>
    };
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

export default EngagementRepliesSkill;
