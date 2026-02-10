import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Content types
export type ContentType = 'blog' | 'social' | 'email';

// Social media platforms
export type SocialPlatform = 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'generic';

// Email types
export type EmailType = 'welcome' | 'follow-up' | 'promotional' | 'newsletter' | 'cold-outreach' | 'thank-you';

// Tone options
export type Tone = 'professional' | 'casual' | 'friendly' | 'formal' | 'enthusiastic' | 'empathetic' | 'authoritative' | 'witty';

// Content request interface
export interface ContentRequest {
  topic: string;
  contentType: ContentType;
  platform?: SocialPlatform;
  emailType?: EmailType;
  tone: Tone;
  keywords?: string[];
  wordCount?: number;
  audience?: string;
  callToAction?: string;
}

// Generated content interface
export interface GeneratedContent {
  id?: number;
  title: string;
  content: string;
  contentType: ContentType;
  platform?: SocialPlatform;
  emailType?: EmailType;
  tone: Tone;
  wordCount: number;
  createdAt: string;
}

// Template interface
export interface ContentTemplate {
  id?: number;
  name: string;
  description: string;
  contentType: ContentType;
  platform?: SocialPlatform;
  emailType?: EmailType;
  template: string;
  defaultTone: Tone;
  variables: string[];
  createdAt: string;
}

// Default templates
const DEFAULT_TEMPLATES: Omit<ContentTemplate, 'id' | 'createdAt'>[] = [
  {
    name: 'Blog Post - How-To',
    description: 'Step-by-step instructional blog post',
    contentType: 'blog',
    defaultTone: 'friendly',
    template: `# {{title}}

## Introduction
In this guide, we'll walk you through everything you need to know about {{topic}}. Whether you're just getting started or looking to level up your skills, this article has you covered.

## Why {{topic}} Matters
{{topic}} has become increasingly important in today's world. Here's why:

- Benefit 1
- Benefit 2
- Benefit 3

## Step-by-Step Guide

### Step 1: Getting Started
Begin by...

### Step 2: Implementation
Next, you'll want to...

### Step 3: Optimization
Finally, make sure to...

## Conclusion
{{topic}} doesn't have to be complicated. With the steps outlined above, you're well on your way to success.

{{callToAction}}`,
    variables: ['title', 'topic', 'callToAction']
  },
  {
    name: 'Social Media - Twitter/X',
    description: 'Short-form tweet with hashtags',
    contentType: 'social',
    platform: 'twitter',
    defaultTone: 'witty',
    template: `{{content}}

{{hashtags}}`,
    variables: ['content', 'hashtags']
  },
  {
    name: 'Social Media - LinkedIn',
    description: 'Professional LinkedIn post',
    contentType: 'social',
    platform: 'linkedin',
    defaultTone: 'professional',
    template: `I wanted to share some thoughts on {{topic}}:

{{content}}

What are your thoughts on this? I'd love to hear your perspective in the comments.

{{hashtags}}`,
    variables: ['topic', 'content', 'hashtags']
  },
  {
    name: 'Email - Welcome',
    description: 'Welcome email for new subscribers',
    contentType: 'email',
    emailType: 'welcome',
    defaultTone: 'friendly',
    template: `Subject: Welcome to {{companyName}}!

Hi {{firstName}},

Welcome to the {{companyName}} community! We're thrilled to have you on board.

Here's what you can expect from us:
- {{benefit1}}
- {{benefit2}}
- {{benefit3}}

{{content}}

If you have any questions, just reply to this email. We're here to help!

Best,
{{senderName}}
{{senderTitle}}`,
    variables: ['companyName', 'firstName', 'benefit1', 'benefit2', 'benefit3', 'content', 'senderName', 'senderTitle']
  },
  {
    name: 'Email - Follow-Up',
    description: 'Professional follow-up email',
    contentType: 'email',
    emailType: 'follow-up',
    defaultTone: 'professional',
    template: `Subject: Following up on {{subject}}

Hi {{firstName}},

I hope this email finds you well. I wanted to follow up on {{subject}} that we discussed {{timeReference}}.

{{content}}

Please let me know if you have any questions or if there's a better time to connect.

Best regards,
{{senderName}}
{{senderTitle}}
{{contactInfo}}`,
    variables: ['subject', 'firstName', 'timeReference', 'content', 'senderName', 'senderTitle', 'contactInfo']
  },
  {
    name: 'Email - Promotional',
    description: 'Sales or promotional email',
    contentType: 'email',
    emailType: 'promotional',
    defaultTone: 'enthusiastic',
    template: `Subject: {{offer}} - Don't Miss Out!

Hi {{firstName}},

We have something special for you!

{{content}}

{{offerDetails}}

{{callToAction}}

This offer won't last long, so act now!

Cheers,
{{senderName}}
{{companyName}}`,
    variables: ['offer', 'firstName', 'content', 'offerDetails', 'callToAction', 'senderName', 'companyName']
  }
];

// Platform constraints
const PLATFORM_CONSTRAINTS: Record<SocialPlatform, { maxLength: number; hashtagCount: number }> = {
  twitter: { maxLength: 280, hashtagCount: 3 },
  linkedin: { maxLength: 3000, hashtagCount: 5 },
  instagram: { maxLength: 2200, hashtagCount: 30 },
  facebook: { maxLength: 63206, hashtagCount: 10 },
  generic: { maxLength: 2000, hashtagCount: 5 }
};

// Tone modifiers
const TONE_MODIFIERS: Record<Tone, string> = {
  professional: 'Use clear, business-appropriate language. Be concise and direct.',
  casual: 'Write in a relaxed, conversational style. Use contractions and everyday language.',
  friendly: 'Be warm and approachable. Use inclusive language and positive expressions.',
  formal: 'Use proper grammar and sophisticated vocabulary. Avoid contractions and slang.',
  enthusiastic: 'Show excitement and energy. Use exclamation points and positive adjectives.',
  empathetic: 'Show understanding and compassion. Acknowledge feelings and offer support.',
  authoritative: 'Demonstrate expertise and confidence. Use strong statements and evidence.',
  witty: 'Be clever and humorous. Use wordplay and light sarcasm where appropriate.'
};

export class ContentWriterSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const baseDir = path.join(os.homedir(), '.openclaw', 'skills', 'content-writer');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    this.dbPath = path.join(baseDir, 'content.db');
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
      `CREATE TABLE IF NOT EXISTS generated_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        content_type TEXT NOT NULL,
        platform TEXT,
        email_type TEXT,
        tone TEXT NOT NULL,
        word_count INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS content_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        content_type TEXT NOT NULL,
        platform TEXT,
        email_type TEXT,
        template TEXT NOT NULL,
        default_tone TEXT NOT NULL,
        variables TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS tone_preferences (
        content_type TEXT PRIMARY KEY,
        default_tone TEXT NOT NULL
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

    // Insert default templates if they don't exist
    await this.insertDefaultTemplates();
  }

  private async insertDefaultTemplates(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    for (const template of DEFAULT_TEMPLATES) {
      const exists = await new Promise<boolean>((resolve) => {
        this.db!.get(
          'SELECT 1 FROM content_templates WHERE name = ?',
          [template.name],
          (err: Error | null, row: any) => {
            resolve(!!row);
          }
        );
      });

      if (!exists) {
        await new Promise<void>((resolve, reject) => {
          this.db!.run(
            `INSERT INTO content_templates (name, description, content_type, platform, email_type, template, default_tone, variables, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              template.name,
              template.description,
              template.contentType,
              template.platform || null,
              template.emailType || null,
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
   * Generate content based on request parameters
   * This simulates AI content generation - in production, this would call the main model
   */
  async generateContent(request: ContentRequest): Promise<GeneratedContent> {
    await this.initialize();

    const { topic, contentType, platform, emailType, tone, keywords, wordCount, audience, callToAction } = request;

    // Generate content based on type
    let title: string;
    let content: string;

    switch (contentType) {
      case 'blog':
        ({ title, content } = this.generateBlogPost(topic, tone, wordCount || 500, keywords, audience, callToAction));
        break;
      case 'social':
        ({ title, content } = this.generateSocialPost(topic, platform || 'generic', tone, keywords, callToAction));
        break;
      case 'email':
        ({ title, content } = this.generateEmail(topic, emailType || 'welcome', tone, audience, callToAction));
        break;
      default:
        throw new Error(`Unsupported content type: ${contentType}`);
    }

    const generated: GeneratedContent = {
      title,
      content,
      contentType,
      platform,
      emailType,
      tone,
      wordCount: content.split(/\s+/).length,
      createdAt: new Date().toISOString()
    };

    // Save to database
    const id = await this.saveGeneratedContent(generated);
    generated.id = id;

    return generated;
  }

  private generateBlogPost(
    topic: string,
    tone: Tone,
    targetWordCount: number,
    keywords?: string[],
    audience?: string,
    callToAction?: string
  ): { title: string; content: string } {
    const toneDesc = TONE_MODIFIERS[tone];
    const keywordString = keywords ? keywords.join(', ') : '';
    const targetAudience = audience || 'readers';
    const cta = callToAction || 'Start implementing these strategies today!';

    const title = `The Complete Guide to ${topic}`;

    const sections = Math.ceil(targetWordCount / 150);
    const sectionContent: string[] = [];

    for (let i = 1; i <= sections; i++) {
      sectionContent.push(`## ${i}. Key Aspect ${i} of ${topic}

This section covers important information about ${topic} that ${targetAudience} need to understand. ${toneDesc}

When approaching ${topic}, consider these factors:
- Factor ${i}a: Important consideration
- Factor ${i}b: Another key point
- Factor ${i}c: Final thought on this aspect

Understanding these elements will help you make better decisions regarding ${topic}.`);
    }

    const intro = `## Introduction

${topic} has become increasingly relevant for ${targetAudience}. In this comprehensive guide, we'll explore everything you need to know to succeed with ${topic}.

${keywordString ? `Key concepts we'll cover: ${keywordString}.` : ''}

Let's dive in!`;

    const conclusion = `## Conclusion

We've covered the essential aspects of ${topic}. By implementing the strategies outlined above, you'll be well-positioned for success.

**${cta}**

${toneDesc}`;

    const content = `${intro}

${sectionContent.join('\n\n')}

${conclusion}`;

    return { title, content };
  }

  private generateSocialPost(
    topic: string,
    platform: SocialPlatform,
    tone: Tone,
    keywords?: string[],
    callToAction?: string
  ): { title: string; content: string } {
    const constraints = PLATFORM_CONSTRAINTS[platform];
    const toneDesc = TONE_MODIFIERS[tone];
    const hashtags = keywords ? keywords.map(k => `#${k.replace(/\s+/g, '')}`).slice(0, constraints.hashtagCount).join(' ') : '';
    const cta = callToAction || (platform === 'twitter' ? 'RT if you agree!' : 'Share your thoughts below!');

    let title = `Social Post: ${topic}`;
    let content: string;

    switch (platform) {
      case 'twitter':
        content = `🚀 ${topic} is changing everything!

Quick thread on why it matters ${toneDesc.toLowerCase()}

1/ It solves real problems
2/ It's more accessible than ever
3/ The results speak for themselves

${cta}

${hashtags}`;
        break;
      case 'linkedin':
        title = `LinkedIn Post: ${topic}`;
        content = `I wanted to share some insights about ${topic} that I've gained through my experience.

${toneDesc}

Here are 3 key takeaways:

1️⃣ Start with the fundamentals
2️⃣ Focus on consistent improvement
3️⃣ Measure what matters

The landscape around ${topic} continues to evolve, and staying informed is crucial for professional growth.

${cta}

${hashtags}`;
        break;
      case 'instagram':
        title = `Instagram Caption: ${topic}`;
        content = `✨ ${topic} ✨

${toneDesc}

Swipe to see the transformation! →

${hashtags}

.
.
.
#instagood #instadaily #contentcreator`;
        break;
      case 'facebook':
        title = `Facebook Post: ${topic}`;
        content = `Hey everyone! 👋

I wanted to talk about ${topic} because it's something I'm passionate about.

${toneDesc}

What are your thoughts on ${topic}? Have you tried it? Let me know in the comments!

${cta}

${hashtags}`;
        break;
      default:
        content = `Check out this thought on ${topic}:

${toneDesc}

${cta}

${hashtags}`;
    }

    // Truncate if exceeds platform limit
    if (content.length > constraints.maxLength) {
      content = content.substring(0, constraints.maxLength - 3) + '...';
    }

    return { title, content };
  }

  private generateEmail(
    topic: string,
    emailType: EmailType,
    tone: Tone,
    audience?: string,
    callToAction?: string
  ): { title: string; content: string } {
    const toneDesc = TONE_MODIFIERS[tone];
    const targetAudience = audience || 'valued customer';
    const cta = callToAction || 'Click here to learn more';

    let subject: string;
    let body: string;

    switch (emailType) {
      case 'welcome':
        subject = `Welcome! Let's talk about ${topic}`;
        body = `Hi there,

Welcome! We're excited to have you join us on this journey with ${topic}.

${toneDesc}

Here's what you can look forward to:
• Exclusive insights about ${topic}
• Tips and best practices
• Early access to new features

${cta}

Looking forward to connecting with you!

Best regards,
The Team`;
        break;
      case 'follow-up':
        subject = `Following up on ${topic}`;
        body = `Hi ${targetAudience},

I hope you're doing well. I wanted to follow up regarding ${topic}.

${toneDesc}

Have you had a chance to review the information I shared? I'd love to hear your thoughts and answer any questions you might have.

${cta}

Best,
[Your Name]`;
        break;
      case 'promotional':
        subject = `Special offer: ${topic}`;
        body = `Hi ${targetAudience},

We have something exciting to share about ${topic}!

${toneDesc}

For a limited time, we're offering exclusive access that you won't want to miss.

${cta}

Don't wait - this opportunity won't last long!

Cheers,
The Marketing Team`;
        break;
      case 'newsletter':
        subject = `This Week in ${topic}`;
        body = `Hello ${targetAudience},

Welcome to this week's update on ${topic}!

${toneDesc}

📰 Latest News
We've got exciting developments to share...

💡 Pro Tip
Here's a quick tip to help you get the most out of ${topic}...

🎯 Coming Soon
Stay tuned for these upcoming features...

${cta}

Thanks for reading!

The Newsletter Team`;
        break;
      case 'cold-outreach':
        subject = `Quick question about ${topic}`;
        body = `Hi ${targetAudience},

I came across your profile and was impressed by your work. I'm reaching out because I think ${topic} could be valuable for what you're building.

${toneDesc}

Would you be open to a brief conversation about how this might help your goals?

${cta}

Looking forward to hearing from you.

Best,
[Your Name]`;
        break;
      case 'thank-you':
        subject = `Thank you for your interest in ${topic}`;
        body = `Hi ${targetAudience},

Thank you so much for your interest in ${topic}!

${toneDesc}

We truly appreciate your support and are here to help you succeed.

${cta}

With gratitude,
The Team`;
        break;
      default:
        subject = `About ${topic}`;
        body = `Hi ${targetAudience},

I wanted to reach out about ${topic}.

${toneDesc}

${cta}

Best regards`;
    }

    const content = `Subject: ${subject}

${body}`;

    return { title: subject, content };
  }

  private async saveGeneratedContent(content: GeneratedContent): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO generated_content (title, content, content_type, platform, email_type, tone, word_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          content.title,
          content.content,
          content.contentType,
          content.platform || null,
          content.emailType || null,
          content.tone,
          content.wordCount,
          content.createdAt
        ],
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  /**
   * Get content generation history
   */
  async getHistory(contentType?: ContentType, limit: number = 50): Promise<GeneratedContent[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM generated_content';
    const params: any[] = [];

    if (contentType) {
      query += ' WHERE content_type = ?';
      params.push(contentType);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const records: GeneratedContent[] = rows.map(row => ({
          id: row.id,
          title: row.title,
          content: row.content,
          contentType: row.content_type,
          platform: row.platform,
          emailType: row.email_type,
          tone: row.tone,
          wordCount: row.word_count,
          createdAt: row.created_at
        }));

        resolve(records);
      });
    });
  }

  /**
   * Get a specific generated content by ID
   */
  async getById(id: number): Promise<GeneratedContent | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get('SELECT * FROM generated_content WHERE id = ?', [id], (err: Error | null, row: any) => {
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
          title: row.title,
          content: row.content,
          contentType: row.content_type,
          platform: row.platform,
          emailType: row.email_type,
          tone: row.tone,
          wordCount: row.word_count,
          createdAt: row.created_at
        });
      });
    });
  }

  /**
   * Get available templates
   */
  async getTemplates(contentType?: ContentType): Promise<ContentTemplate[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM content_templates';
    const params: any[] = [];

    if (contentType) {
      query += ' WHERE content_type = ?';
      params.push(contentType);
    }

    query += ' ORDER BY name';

    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const templates: ContentTemplate[] = rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          contentType: row.content_type,
          platform: row.platform,
          emailType: row.email_type,
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
   * Add a custom template
   */
  async addTemplate(template: Omit<ContentTemplate, 'id' | 'createdAt'>): Promise<number> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO content_templates (name, description, content_type, platform, email_type, template, default_tone, variables, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          template.name,
          template.description,
          template.contentType,
          template.platform || null,
          template.emailType || null,
          template.template,
          template.defaultTone,
          JSON.stringify(template.variables),
          new Date().toISOString()
        ],
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  /**
   * Apply a template with variable substitution
   */
  applyTemplate(template: ContentTemplate, variables: Record<string, string>): string {
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
   * Get platform constraints
   */
  getPlatformConstraints(platform: SocialPlatform): { maxLength: number; hashtagCount: number } {
    return PLATFORM_CONSTRAINTS[platform];
  }

  /**
   * Get available tones
   */
  getAvailableTones(): Tone[] {
    return Object.keys(TONE_MODIFIERS) as Tone[];
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.initialize();
      return { healthy: true, message: 'Content writer is ready' };
    } catch (error) {
      return { healthy: false, message: `Error: ${error}` };
    }
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalGenerated: number;
    byType: Record<ContentType, number>;
    byTone: Record<Tone, number>;
  }> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const total = await new Promise<number>((resolve, reject) => {
      this.db!.get('SELECT COUNT(*) as count FROM generated_content', (err: Error | null, row: any) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    const byType: Record<string, number> = {};
    const types: ContentType[] = ['blog', 'social', 'email'];
    for (const type of types) {
      const count = await new Promise<number>((resolve, reject) => {
        this.db!.get(
          'SELECT COUNT(*) as count FROM generated_content WHERE content_type = ?',
          [type],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });
      byType[type] = count;
    }

    const byTone: Record<string, number> = {};
    const tones = this.getAvailableTones();
    for (const tone of tones) {
      const count = await new Promise<number>((resolve, reject) => {
        this.db!.get(
          'SELECT COUNT(*) as count FROM generated_content WHERE tone = ?',
          [tone],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });
      byTone[tone] = count;
    }

    return {
      totalGenerated: total,
      byType: byType as Record<ContentType, number>,
      byTone: byTone as Record<Tone, number>
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

export default ContentWriterSkill;
