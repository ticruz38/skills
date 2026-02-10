---
title: Content Writer
skill_id: content-writer
description: Generate content using AI - blog posts, social media captions, email templates
category: content
tags: [content, writing, blog, social-media, email, marketing]
author: OpenClaw
version: 1.0.0
---

# Content Writer

Generate AI-powered content for blogs, social media, and emails with tone adjustment and platform-specific formatting.

## Capabilities

- **Blog Post Generation**: Create structured blog posts with customizable length and tone
- **Social Media Captions**: Platform-optimized content for Twitter/X, LinkedIn, Instagram, Facebook
- **Email Templates**: Professional emails for welcome sequences, follow-ups, promotions, newsletters
- **Tone Adjustment**: Choose from professional, casual, friendly, formal, enthusiastic, empathetic, authoritative, witty
- **Template System**: Built-in templates with variable substitution for quick content creation
- **Content History**: All generated content is saved to SQLite for future reference

## Installation

```bash
cd skills/content-writer
npm install
npm run build
```

## Usage

### CLI

```bash
# Generate a blog post
npx content-writer generate --topic "AI in Business" --type blog --tone professional --words 500

# Generate a social media post
npx content-writer generate -T "Product Launch" -t social -p linkedin --tone enthusiastic

# Generate an email
npx content-writer generate -T "Welcome" -t email -e welcome --tone friendly

# View generation history
npx content-writer history --limit 10

# View statistics
npx content-writer stats

# List available templates
npx content-writer templates

# List available tones
npx content-writer tones
```

### Library

```typescript
import { ContentWriterSkill } from '@openclaw/content-writer';

const writer = new ContentWriterSkill();

// Generate a blog post
const blogPost = await writer.generateContent({
  topic: "The Future of AI",
  contentType: "blog",
  tone: "professional",
  wordCount: 800,
  keywords: ["AI", "technology", "future"],
  audience: "business leaders",
  callToAction: "Subscribe to our newsletter for more insights!"
});

console.log(blogPost.content);

// Generate a social media post
const socialPost = await writer.generateContent({
  topic: "New Product Launch",
  contentType: "social",
  platform: "linkedin",
  tone: "enthusiastic",
  keywords: ["productlaunch", "innovation", "tech"],
  callToAction: "Learn more at our website!"
});

// Generate an email
const email = await writer.generateContent({
  topic: "Welcome to Our Service",
  contentType: "email",
  emailType: "welcome",
  tone: "friendly",
  audience: "new subscribers"
});

// Get generation history
const history = await writer.getHistory('blog', 10);

// Get templates
const templates = await writer.getTemplates('email');

// Apply a template with variables
const template = templates[0];
const content = writer.applyTemplate(template, {
  companyName: "Acme Corp",
  firstName: "John",
  benefit1: "24/7 Support",
  benefit2: "Free Training",
  benefit3: "Priority Access",
  senderName: "Jane",
  senderTitle: "Customer Success"
});

await writer.close();
```

## Content Types

### Blog Posts
- Configurable word count
- SEO keyword integration
- Structured with introduction, sections, and conclusion
- Call-to-action support

### Social Media
Platform-specific constraints and optimizations:
- **Twitter/X**: 280 character limit, 3 recommended hashtags
- **LinkedIn**: 3000 character limit, 5 recommended hashtags
- **Instagram**: 2200 character limit, up to 30 hashtags
- **Facebook**: 63206 character limit, up to 10 hashtags

### Emails
Email types available:
- **welcome**: Onboarding new subscribers
- **follow-up**: Professional follow-ups
- **promotional**: Sales and offers
- **newsletter**: Regular updates
- **cold-outreach**: Initial contact emails
- **thank-you**: Appreciation emails

## Tones

- **professional**: Clear, business-appropriate language
- **casual**: Relaxed, conversational style
- **friendly**: Warm and approachable
- **formal**: Proper grammar, sophisticated vocabulary
- **enthusiastic**: Excited and energetic
- **empathetic**: Understanding and compassionate
- **authoritative**: Expert and confident
- **witty**: Clever and humorous

## Database

Content is stored in SQLite at `~/.openclaw/skills/content-writer/content.db`:

- **generated_content**: All generated content with metadata
- **content_templates**: Reusable templates with variables
- **tone_preferences**: Default tone preferences per content type

## No External Dependencies

This skill uses local AI generation patterns and does not require external API keys. It works entirely offline.
