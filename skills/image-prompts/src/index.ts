import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Supported AI image generators
export type ImagePlatform = 'midjourney' | 'dalle' | 'stable-diffusion' | 'leonardo' | 'generic';

// Art style types
export type ArtStyle = 
  | 'photorealistic' 
  | 'digital-art' 
  | 'oil-painting' 
  | 'watercolor' 
  | 'pencil-sketch'
  | 'anime'
  | '3d-render'
  | 'pixel-art'
  | 'concept-art'
  | 'cyberpunk'
  | 'fantasy'
  | 'minimalist'
  | 'surrealism'
  | 'impressionist'
  | 'pop-art';

// Mood/atmosphere options
export type Mood = 
  | 'peaceful' 
  | 'dramatic' 
  | 'mysterious' 
  | 'joyful' 
  | 'melancholic'
  | 'epic'
  | 'whimsical'
  | 'dark'
  | 'romantic'
  | 'futuristic';

// Lighting options
export type Lighting = 
  | 'natural' 
  | 'studio' 
  | 'dramatic' 
  | 'soft' 
  | 'golden-hour'
  | 'neon'
  | 'cinematic'
  | 'backlit'
  | 'volumetric'
  | 'moonlight';

// Camera angle/perspective
export type Perspective = 
  | 'eye-level' 
  | 'birds-eye' 
  | 'worms-eye' 
  | 'close-up'
  | 'wide-angle'
  | 'macro'
  | 'portrait'
  | 'aerial'
  | 'isometric'
  | 'dutch-angle';

// Quality/Detail level
export type Quality = 'low' | 'medium' | 'high' | 'ultra';

// Aspect ratio options
export type AspectRatio = '1:1' | '4:3' | '16:9' | '9:16' | '21:9' | '3:2' | '2:3';

// Prompt generation request
export interface PromptRequest {
  subject: string;
  platform?: ImagePlatform;
  style?: ArtStyle;
  mood?: Mood;
  lighting?: Lighting;
  perspective?: Perspective;
  quality?: Quality;
  aspectRatio?: AspectRatio;
  details?: string[];
  negativePrompt?: string;
  count?: number;
}

// Generated prompt result
export interface GeneratedPrompt {
  id?: number;
  subject: string;
  prompt: string;
  negativePrompt?: string;
  platform: ImagePlatform;
  style?: ArtStyle;
  mood?: Mood;
  lighting?: Lighting;
  perspective?: Perspective;
  quality: Quality;
  aspectRatio?: AspectRatio;
  parameters: Record<string, string | number | boolean>;
  variations: string[];
  createdAt: string;
}

// Prompt template
export interface PromptTemplate {
  id?: number;
  name: string;
  description: string;
  category: string;
  platform: ImagePlatform;
  template: string;
  negativeTemplate?: string;
  defaultStyle?: ArtStyle;
  defaultMood?: Mood;
  variables: string[];
  createdAt: string;
}

// Style definitions with modifiers
const STYLE_MODIFIERS: Record<ArtStyle, { description: string; keywords: string[] }> = {
  photorealistic: {
    description: 'Ultra-realistic photography style',
    keywords: ['photorealistic', '8k resolution', 'highly detailed', 'realistic textures', 'professional photography']
  },
  'digital-art': {
    description: 'Modern digital illustration',
    keywords: ['digital art', 'vibrant colors', 'clean lines', 'digital painting', 'illustration']
  },
  'oil-painting': {
    description: 'Classic oil painting aesthetic',
    keywords: ['oil painting', 'rich textures', 'visible brushstrokes', 'classical art', 'canvas texture']
  },
  watercolor: {
    description: 'Soft watercolor wash effects',
    keywords: ['watercolor', 'soft edges', 'flowing colors', 'transparent layers', 'artistic wash']
  },
  'pencil-sketch': {
    description: 'Hand-drawn pencil sketch',
    keywords: ['pencil sketch', 'graphite drawing', 'detailed linework', 'monochrome', 'hand-drawn']
  },
  anime: {
    description: 'Japanese anime/manga style',
    keywords: ['anime style', 'manga', 'vibrant colors', 'expressive', 'cel-shaded', 'studio ghibli']
  },
  '3d-render': {
    description: '3D computer generated imagery',
    keywords: ['3D render', 'octane render', 'blender', 'cinematic lighting', 'ray tracing', 'CGI']
  },
  'pixel-art': {
    description: 'Retro pixel art style',
    keywords: ['pixel art', '8-bit', '16-bit', 'retro gaming', 'pixelated', 'dithering']
  },
  'concept-art': {
    description: 'Professional concept art',
    keywords: ['concept art', 'artstation', 'cinematic', 'environment design', 'professional']
  },
  cyberpunk: {
    description: 'Futuristic cyberpunk aesthetic',
    keywords: ['cyberpunk', 'neon lights', 'futuristic', 'high-tech', 'dystopian', 'holographic']
  },
  fantasy: {
    description: 'High fantasy art style',
    keywords: ['fantasy art', 'magical', 'ethereal', 'mythical', 'enchanted', 'dreamlike']
  },
  minimalist: {
    description: 'Clean minimalist design',
    keywords: ['minimalist', 'clean lines', 'simple', 'geometric', 'modern', 'negative space']
  },
  surrealism: {
    description: 'Surreal dreamlike imagery',
    keywords: ['surreal', 'dreamlike', 'surrealism', 'bizarre', 'unusual', 'abstract']
  },
  impressionist: {
    description: 'Impressionist painting style',
    keywords: ['impressionist', 'soft brushstrokes', 'light effects', 'atmospheric', 'painterly']
  },
  'pop-art': {
    description: 'Bold pop art style',
    keywords: ['pop art', 'bold colors', 'graphic', 'warhol style', 'retro', 'vibrant']
  }
};

// Mood modifiers
const MOOD_MODIFIERS: Record<Mood, string[]> = {
  peaceful: ['serene', 'tranquil', 'calm', 'harmonious', 'zen'],
  dramatic: ['dramatic', 'intense', 'dynamic', 'powerful', 'striking'],
  mysterious: ['mysterious', 'enigmatic', 'shadowy', 'intriguing', 'atmospheric'],
  joyful: ['joyful', 'cheerful', 'vibrant', 'uplifting', 'happy'],
  melancholic: ['melancholic', 'somber', 'contemplative', 'nostalgic', 'emotional'],
  epic: ['epic', 'grand', 'majestic', 'breathtaking', 'awe-inspiring'],
  whimsical: ['whimsical', 'playful', 'fantastical', 'quirky', 'charming'],
  dark: ['dark', 'ominous', 'foreboding', 'eerie', 'gothic'],
  romantic: ['romantic', 'dreamy', 'soft', 'tender', 'passionate'],
  futuristic: ['futuristic', 'cutting-edge', 'advanced', 'sleek', 'modern']
};

// Lighting modifiers
const LIGHTING_MODIFIERS: Record<Lighting, string[]> = {
  natural: ['natural lighting', 'soft daylight', 'ambient light'],
  studio: ['studio lighting', 'professional lighting', 'three-point lighting'],
  dramatic: ['dramatic lighting', 'high contrast', 'chiaroscuro'],
  soft: ['soft lighting', 'diffused light', 'gentle illumination'],
  'golden-hour': ['golden hour', 'warm sunset light', 'magical hour'],
  neon: ['neon lighting', 'cyberpunk glow', 'fluorescent'],
  cinematic: ['cinematic lighting', 'movie lighting', 'film look'],
  backlit: ['backlit', 'rim lighting', 'silhouette'],
  volumetric: ['volumetric lighting', 'god rays', 'atmospheric lighting'],
  moonlight: ['moonlight', 'cool blue light', 'night lighting']
};

// Perspective modifiers
const PERSPECTIVE_MODIFIERS: Record<Perspective, string[]> = {
  'eye-level': ['eye level view', 'straight on', 'neutral perspective'],
  'birds-eye': ['birds eye view', 'top down', 'aerial view'],
  'worms-eye': ['worms eye view', 'low angle', 'looking up'],
  'close-up': ['close up', 'macro', 'detailed view'],
  'wide-angle': ['wide angle', 'expansive view', 'panoramic'],
  macro: ['macro photography', 'extreme close-up', 'microscopic detail'],
  portrait: ['portrait orientation', 'medium shot', 'character focus'],
  aerial: ['aerial photography', 'drone view', 'from above'],
  isometric: ['isometric view', 'axonometric', 'technical drawing style'],
  'dutch-angle': ['dutch angle', 'tilted perspective', 'dynamic angle']
};

// Quality modifiers
const QUALITY_MODIFIERS: Record<Quality, string[]> = {
  low: ['simple', 'basic', 'low detail'],
  medium: ['moderate detail', 'standard quality'],
  high: ['highly detailed', 'high quality', 'sharp'],
  ultra: ['ultra detailed', '8k', 'hyperrealistic', 'maximum quality', 'intricate details']
};

// Platform-specific parameters
const PLATFORM_PARAMETERS: Record<ImagePlatform, Record<string, { type: 'string' | 'number' | 'boolean'; default: any; description: string }>> = {
  midjourney: {
    version: { type: 'string', default: '6', description: 'Midjourney version' },
    stylize: { type: 'number', default: 100, description: 'Stylization level (0-1000)' },
    chaos: { type: 'number', default: 0, description: 'Chaos/variation level (0-100)' },
    weird: { type: 'number', default: 0, description: 'Weirdness level (0-3000)' },
    tile: { type: 'boolean', default: false, description: 'Generate tileable image' },
    no: { type: 'string', default: '', description: 'Negative prompt keywords' }
  },
  dalle: {
    quality: { type: 'string', default: 'standard', description: 'Image quality (standard/hd)' },
    style: { type: 'string', default: 'vivid', description: 'Style (vivid/natural)' }
  },
  'stable-diffusion': {
    steps: { type: 'number', default: 30, description: 'Sampling steps' },
    cfg_scale: { type: 'number', default: 7, description: 'CFG Scale (guidance)' },
    seed: { type: 'number', default: -1, description: 'Random seed (-1 for random)' },
    sampler: { type: 'string', default: 'Euler a', description: 'Sampling method' }
  },
  leonardo: {
    photoReal: { type: 'boolean', default: false, description: 'PhotoReal mode' },
    alchemy: { type: 'boolean', default: false, description: 'Alchemy mode' },
    guidance_scale: { type: 'number', default: 7, description: 'Guidance scale' }
  },
  generic: {}
};

// Default templates
const DEFAULT_TEMPLATES: Omit<PromptTemplate, 'id' | 'createdAt'>[] = [
  {
    name: 'character-portrait',
    description: 'Detailed character portrait with personality',
    category: 'character',
    platform: 'midjourney',
    template: '{{style}} portrait of {{subject}}, {{mood}}, {{lighting}}, {{quality}}, {{perspective}}',
    defaultStyle: 'digital-art',
    variables: ['subject', 'style', 'mood', 'lighting', 'quality', 'perspective']
  },
  {
    name: 'landscape-scene',
    description: 'Breathtaking landscape environment',
    category: 'environment',
    platform: 'midjourney',
    template: '{{style}} landscape of {{subject}}, {{mood}}, {{lighting}}, {{quality}}, vast and immersive',
    defaultStyle: 'concept-art',
    variables: ['subject', 'style', 'mood', 'lighting', 'quality']
  },
  {
    name: 'product-shot',
    description: 'Professional product photography',
    category: 'product',
    platform: 'generic',
    template: '{{style}} product photography of {{subject}}, {{lighting}}, clean background, {{quality}}, commercial photography',
    defaultStyle: 'photorealistic',
    variables: ['subject', 'style', 'lighting', 'quality']
  },
  {
    name: 'abstract-art',
    description: 'Abstract artistic composition',
    category: 'abstract',
    platform: 'dalle',
    template: '{{style}} abstract artwork, {{subject}}, {{mood}}, flowing forms, {{lighting}}, {{quality}}, artistic expression',
    defaultStyle: 'digital-art',
    variables: ['subject', 'style', 'mood', 'lighting', 'quality']
  },
  {
    name: 'architectural',
    description: 'Architectural visualization',
    category: 'architecture',
    platform: 'stable-diffusion',
    template: '{{style}} architectural visualization of {{subject}}, {{mood}}, {{lighting}}, {{quality}}, {{perspective}}, modern design',
    defaultStyle: '3d-render',
    variables: ['subject', 'style', 'mood', 'lighting', 'quality', 'perspective']
  }
];

// Common negative prompts
const COMMON_NEGATIVE_PROMPTS: Record<string, string> = {
  midjourney: 'blurry, low quality, distorted, deformed, ugly, bad anatomy, watermark, signature, text, cropped, worst quality',
  dalle: '',
  'stable-diffusion': 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
  leonardo: 'blurry, low quality, distorted, watermark',
  generic: 'low quality, blurry, distorted, watermark, text'
};

export class ImagePromptsSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const baseDir = path.join(os.homedir(), '.openclaw', 'skills', 'image-prompts');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    this.dbPath = path.join(baseDir, 'prompts.db');
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
      `CREATE TABLE IF NOT EXISTS generated_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        prompt TEXT NOT NULL,
        negative_prompt TEXT,
        platform TEXT NOT NULL,
        style TEXT,
        mood TEXT,
        lighting TEXT,
        perspective TEXT,
        quality TEXT NOT NULL,
        aspect_ratio TEXT,
        parameters TEXT NOT NULL,
        variations TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS prompt_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        platform TEXT NOT NULL,
        template TEXT NOT NULL,
        negative_template TEXT,
        default_style TEXT,
        default_mood TEXT,
        variables TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS style_presets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        style TEXT NOT NULL,
        mood TEXT,
        lighting TEXT,
        perspective TEXT,
        keywords TEXT NOT NULL,
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

    await this.insertDefaultTemplates();
  }

  private async insertDefaultTemplates(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    for (const template of DEFAULT_TEMPLATES) {
      const exists = await new Promise<boolean>((resolve) => {
        this.db!.get(
          'SELECT 1 FROM prompt_templates WHERE name = ?',
          [template.name],
          (err: Error | null, row: any) => {
            resolve(!!row);
          }
        );
      });

      if (!exists) {
        await new Promise<void>((resolve, reject) => {
          this.db!.run(
            `INSERT INTO prompt_templates (name, description, category, platform, template, negative_template, default_style, default_mood, variables, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              template.name,
              template.description,
              template.category,
              template.platform,
              template.template,
              template.negativeTemplate || null,
              template.defaultStyle || null,
              template.defaultMood || null,
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

  async generatePrompts(request: PromptRequest): Promise<GeneratedPrompt[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const {
      subject,
      platform = 'midjourney',
      style = 'photorealistic',
      mood,
      lighting,
      perspective,
      quality = 'high',
      aspectRatio,
      details = [],
      negativePrompt,
      count = 3
    } = request;

    const prompts: GeneratedPrompt[] = [];

    for (let i = 0; i < count; i++) {
      const prompt = this.buildPrompt(subject, platform, style, mood, lighting, perspective, quality, details, i);
      const negPrompt = negativePrompt || this.buildNegativePrompt(platform, style);
      const parameters = this.buildParameters(platform, aspectRatio);
      const variations = this.generateVariations(subject, platform, style, count);

      const generatedPrompt: GeneratedPrompt = {
        subject,
        prompt,
        negativePrompt: negPrompt,
        platform,
        style,
        mood,
        lighting,
        perspective,
        quality,
        aspectRatio,
        parameters,
        variations,
        createdAt: new Date().toISOString()
      };

      const id = await this.saveGeneratedPrompt(generatedPrompt);
      generatedPrompt.id = id;

      prompts.push(generatedPrompt);
    }

    return prompts;
  }

  private buildPrompt(
    subject: string,
    platform: ImagePlatform,
    style: ArtStyle,
    mood?: Mood,
    lighting?: Lighting,
    perspective?: Perspective,
    quality: Quality = 'high',
    details: string[] = [],
    variant: number = 0
  ): string {
    const parts: string[] = [];

    const styleData = STYLE_MODIFIERS[style];
    parts.push(...styleData.keywords);
    parts.push(`of ${subject}`);

    if (mood) {
      const moodKeywords = MOOD_MODIFIERS[mood];
      parts.push(...moodKeywords);
    }

    if (lighting) {
      const lightingKeywords = LIGHTING_MODIFIERS[lighting];
      parts.push(...lightingKeywords);
    }

    if (perspective) {
      const perspectiveKeywords = PERSPECTIVE_MODIFIERS[perspective];
      parts.push(...perspectiveKeywords);
    }

    const qualityKeywords = QUALITY_MODIFIERS[quality];
    parts.push(...qualityKeywords);

    if (details.length > 0) {
      parts.push(...details);
    }

    if (variant > 0) {
      const variations = [
        'alternative composition',
        'different angle',
        'unique interpretation',
        'varied color palette',
        'alternate lighting'
      ];
      parts.push(variations[variant % variations.length]);
    }

    let prompt = parts.join(', ');
    prompt = this.formatForPlatform(prompt, platform);

    return prompt;
  }

  private formatForPlatform(prompt: string, platform: ImagePlatform): string {
    switch (platform) {
      case 'midjourney':
        return prompt;
      case 'dalle':
        return prompt.replace(/, /g, ' ').replace(/  +/g, ' ');
      case 'stable-diffusion':
        return prompt;
      default:
        return prompt;
    }
  }

  private buildNegativePrompt(platform: ImagePlatform, style: ArtStyle): string {
    const baseNegative = COMMON_NEGATIVE_PROMPTS[platform] || COMMON_NEGATIVE_PROMPTS.generic;
    
    const styleNegatives: string[] = [];
    if (style === 'photorealistic') {
      styleNegatives.push('painting', 'drawing', 'illustration', 'cartoon');
    } else if (style === 'anime') {
      styleNegatives.push('photorealistic', '3d render', 'western style');
    }

    return styleNegatives.length > 0 
      ? `${baseNegative}, ${styleNegatives.join(', ')}`
      : baseNegative;
  }

  private buildParameters(platform: ImagePlatform, aspectRatio?: AspectRatio): Record<string, string | number | boolean> {
    const params: Record<string, string | number | boolean> = {};
    const platformParams = PLATFORM_PARAMETERS[platform];

    for (const [key, config] of Object.entries(platformParams)) {
      params[key] = config.default;
    }

    if (aspectRatio) {
      switch (platform) {
        case 'midjourney':
          params.ar = aspectRatio;
          break;
        case 'dalle':
          const sizeMap: Record<AspectRatio, string> = {
            '1:1': '1024x1024',
            '4:3': '1024x768',
            '16:9': '1024x576',
            '9:16': '576x1024',
            '21:9': '1024x438',
            '3:2': '1024x683',
            '2:3': '683x1024'
          };
          params.size = sizeMap[aspectRatio] || '1024x1024';
          break;
        case 'stable-diffusion':
          const [width, height] = aspectRatio.split(':').map(Number);
          const scale = 512 / Math.min(width, height);
          params.width = Math.round(width * scale);
          params.height = Math.round(height * scale);
          break;
      }
    }

    return params;
  }

  private generateVariations(subject: string, platform: ImagePlatform, style: ArtStyle, count: number): string[] {
    const variations: string[] = [];
    const styles = Object.keys(STYLE_MODIFIERS) as ArtStyle[];
    const moods = Object.keys(MOOD_MODIFIERS) as Mood[];
    const lightings = Object.keys(LIGHTING_MODIFIERS) as Lighting[];
    const perspectives = Object.keys(PERSPECTIVE_MODIFIERS) as Perspective[];

    for (let i = 0; i < Math.min(count, 5); i++) {
      const altStyle = styles[(styles.indexOf(style) + i + 1) % styles.length];
      const mood = moods[i % moods.length];
      const lighting = lightings[i % lightings.length];
      const perspective = perspectives[i % perspectives.length];

      const parts: string[] = [];
      parts.push(...STYLE_MODIFIERS[altStyle].keywords);
      parts.push(`of ${subject}`);
      parts.push(...MOOD_MODIFIERS[mood]);
      parts.push(...LIGHTING_MODIFIERS[lighting]);
      parts.push(...PERSPECTIVE_MODIFIERS[perspective]);
      parts.push(...QUALITY_MODIFIERS.ultra);

      variations.push(this.formatForPlatform(parts.join(', '), platform));
    }

    return variations;
  }

  private async saveGeneratedPrompt(prompt: GeneratedPrompt): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO generated_prompts (subject, prompt, negative_prompt, platform, style, mood, lighting, perspective, quality, aspect_ratio, parameters, variations, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prompt.subject,
          prompt.prompt,
          prompt.negativePrompt || null,
          prompt.platform,
          prompt.style || null,
          prompt.mood || null,
          prompt.lighting || null,
          prompt.perspective || null,
          prompt.quality,
          prompt.aspectRatio || null,
          JSON.stringify(prompt.parameters),
          JSON.stringify(prompt.variations),
          prompt.createdAt
        ],
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getTemplate(name: string): Promise<PromptTemplate | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM prompt_templates WHERE name = ?',
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
            platform: row.platform,
            template: row.template,
            negativeTemplate: row.negative_template,
            defaultStyle: row.default_style,
            defaultMood: row.default_mood,
            variables: JSON.parse(row.variables),
            createdAt: row.created_at
          });
        }
      );
    });
  }

  async getTemplates(category?: string, platform?: ImagePlatform): Promise<PromptTemplate[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM prompt_templates';
    const params: any[] = [];
    const conditions: string[] = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    if (platform) {
      conditions.push('platform = ?');
      params.push(platform);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY category, name';

    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const templates: PromptTemplate[] = rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          category: row.category,
          platform: row.platform,
          template: row.template,
          negativeTemplate: row.negative_template,
          defaultStyle: row.default_style,
          defaultMood: row.default_mood,
          variables: JSON.parse(row.variables),
          createdAt: row.created_at
        }));

        resolve(templates);
      });
    });
  }

  applyTemplate(template: PromptTemplate, variables: Record<string, string>): string {
    let result = template.template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value);
    }

    result = result.replace(/{{\s*\w+\s*}}/g, '');

    return result;
  }

  async generateFromTemplate(
    templateName: string,
    variables: Record<string, string>,
    platform?: ImagePlatform,
    overrides?: Partial<PromptRequest>
  ): Promise<GeneratedPrompt> {
    const template = await this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const promptText = this.applyTemplate(template, variables);

    const request: PromptRequest = {
      subject: variables.subject || variables.character || variables.product || 'subject',
      platform: platform || template.platform,
      style: overrides?.style || template.defaultStyle || 'digital-art',
      mood: overrides?.mood || template.defaultMood,
      lighting: overrides?.lighting,
      perspective: overrides?.perspective,
      quality: overrides?.quality || 'high',
      aspectRatio: overrides?.aspectRatio,
      details: overrides?.details || [],
      count: 1
    };

    const prompts = await this.generatePrompts(request);
    return prompts[0];
  }

  async getHistory(limit: number = 50): Promise<GeneratedPrompt[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM generated_prompts ORDER BY created_at DESC LIMIT ?',
        [limit],
        (err: Error | null, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          const prompts: GeneratedPrompt[] = rows.map(row => ({
            id: row.id,
            subject: row.subject,
            prompt: row.prompt,
            negativePrompt: row.negative_prompt,
            platform: row.platform,
            style: row.style,
            mood: row.mood,
            lighting: row.lighting,
            perspective: row.perspective,
            quality: row.quality,
            aspectRatio: row.aspect_ratio,
            parameters: JSON.parse(row.parameters),
            variations: JSON.parse(row.variations),
            createdAt: row.created_at
          }));

          resolve(prompts);
        }
      );
    });
  }

  getAvailableStyles(): ArtStyle[] {
    return Object.keys(STYLE_MODIFIERS) as ArtStyle[];
  }

  getAvailableMoods(): Mood[] {
    return Object.keys(MOOD_MODIFIERS) as Mood[];
  }

  getAvailableLighting(): Lighting[] {
    return Object.keys(LIGHTING_MODIFIERS) as Lighting[];
  }

  getAvailablePerspectives(): Perspective[] {
    return Object.keys(PERSPECTIVE_MODIFIERS) as Perspective[];
  }

  getAvailablePlatforms(): ImagePlatform[] {
    return ['midjourney', 'dalle', 'stable-diffusion', 'leonardo', 'generic'];
  }

  getAvailableAspectRatios(): AspectRatio[] {
    return ['1:1', '4:3', '16:9', '9:16', '21:9', '3:2', '2:3'];
  }

  getPlatformParameters(platform: ImagePlatform): Record<string, { type: 'string' | 'number' | 'boolean'; default: any; description: string }> {
    return PLATFORM_PARAMETERS[platform] || {};
  }

  formatPromptWithParameters(prompt: string, platform: ImagePlatform, parameters: Record<string, any>): string {
    const parts: string[] = [prompt];

    switch (platform) {
      case 'midjourney':
        if (parameters.ar) parts.push(`--ar ${parameters.ar}`);
        if (parameters.stylize) parts.push(`--stylize ${parameters.stylize}`);
        if (parameters.chaos) parts.push(`--chaos ${parameters.chaos}`);
        if (parameters.weird) parts.push(`--weird ${parameters.weird}`);
        if (parameters.tile) parts.push('--tile');
        if (parameters.version) parts.push(`--v ${parameters.version}`);
        if (parameters.no) parts.push(`--no ${parameters.no}`);
        break;
    }

    return parts.join(' ');
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.initialize();
      return { healthy: true, message: 'Image prompts skill is ready' };
    } catch (error) {
      return { healthy: false, message: `Error: ${error}` };
    }
  }

  async getStats(): Promise<{
    totalGenerated: number;
    byPlatform: Record<ImagePlatform, number>;
    byStyle: Record<ArtStyle, number>;
  }> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const total = await new Promise<number>((resolve, reject) => {
      this.db!.get('SELECT COUNT(*) as count FROM generated_prompts', (err: Error | null, row: any) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    const byPlatform: Record<string, number> = {};
    const platforms = this.getAvailablePlatforms();
    for (const platform of platforms) {
      const count = await new Promise<number>((resolve, reject) => {
        this.db!.get(
          'SELECT COUNT(*) as count FROM generated_prompts WHERE platform = ?',
          [platform],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });
      byPlatform[platform] = count;
    }

    const byStyle: Record<string, number> = {};
    const styles = this.getAvailableStyles();
    for (const style of styles) {
      const count = await new Promise<number>((resolve, reject) => {
        this.db!.get(
          'SELECT COUNT(*) as count FROM generated_prompts WHERE style = ?',
          [style],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });
      byStyle[style] = count;
    }

    return {
      totalGenerated: total,
      byPlatform: byPlatform as Record<ImagePlatform, number>,
      byStyle: byStyle as Record<ArtStyle, number>
    };
  }

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

export default ImagePromptsSkill;
