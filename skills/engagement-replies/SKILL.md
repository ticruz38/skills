---
title: Engagement Replies
skill_id: engagement-replies
description: Draft replies to comments and messages with tone matching and sentiment awareness
category: social
tags: [social, replies, engagement, comments, messages, tone, sentiment]
author: OpenClaw
version: 1.0.0
---

# Engagement Replies

Generate AI-powered reply suggestions for social media comments and messages with intelligent tone matching and sentiment awareness.

## Capabilities

- **Reply Generation**: Create contextual reply suggestions for any comment or message
- **Tone Matching**: Automatically match the tone of the incoming message or choose from 8 different tones
- **Quick Templates**: Access pre-built response templates for common scenarios
- **Sentiment Awareness**: Detect sentiment and adjust replies accordingly
- **Multiple Suggestions**: Get 3 different reply options to choose from
- **History Tracking**: Save and review all generated replies

## Installation

```bash
cd skills/engagement-replies
npm install
npm run build
```

## Usage

### CLI

```bash
# Generate reply suggestions for a comment
npx engagement-replies generate --message "Great post! Really helpful content." --context "blog-post" --author "JohnDoe"

# Generate with specific tone
npx engagement-replies generate -m "Thanks for sharing!" -c "linkedin-comment" -t professional

# Use a quick template
npx engagement-replies template --name "thank-you" --variables '{"name":"John"}'

# List available templates
npx engagement-replies templates

# View sentiment analysis
npx engagement-replies sentiment --message "This is amazing! Love your work!"

# View reply history
npx engagement-replies history --limit 10
```

### Library

```typescript
import { EngagementRepliesSkill } from '@openclaw/engagement-replies';

const replies = new EngagementRepliesSkill();

// Generate reply suggestions
const suggestions = await replies.generateReplies({
  message: "Great post! Really helpful content.",
  context: "Blog post about AI tools",
  authorName: "JohnDoe",
  platform: "twitter",
  tone: "friendly",
  count: 3
});

console.log(suggestions);
// Returns array of reply options with different approaches

// Analyze sentiment
const sentiment = await replies.analyzeSentiment("This is amazing! Love your work!");
console.log(sentiment);
// { sentiment: 'positive', score: 0.9, emotions: ['joy', 'excitement'] }

// Use a quick template
const template = await replies.getTemplate("thank-you");
const reply = replies.applyTemplate(template, { name: "John", product: "Our Service" });

// Get all templates
const templates = await replies.getTemplates();

// View history
const history = await replies.getHistory(10);

await replies.close();
```

## Reply Types

### Platforms
- **twitter**: Short, concise replies optimized for Twitter/X
- **linkedin**: Professional tone for business networking
- **instagram**: Visual-friendly, emoji-supported replies
- **facebook**: Casual, conversational style
- **email**: Formal, structured responses
- **generic**: Platform-agnostic replies

### Tones
- **professional**: Clear, business-appropriate language
- **casual**: Relaxed, conversational style
- **friendly**: Warm and approachable
- **formal**: Proper grammar, sophisticated vocabulary
- **enthusiastic**: Excited and energetic
- **empathetic**: Understanding and compassionate
- **authoritative**: Expert and confident
- **witty**: Clever and humorous

### Sentiment Responses
- **Positive**: Gratitude, agreement, encouragement
- **Negative**: Empathy, problem-solving, de-escalation
- **Neutral**: Informational, helpful, clarifying
- **Mixed**: Balanced, addressing concerns positively

## Templates

Built-in quick response templates:

- **thank-you**: Express gratitude for positive feedback
- **question-response**: Answer common questions
- **complaint-acknowledgment**: Acknowledge issues professionally
- **follow-up-request**: Encourage further engagement
- **appreciation**: Show appreciation for support
- **welcome**: Greet new followers/connections
- **apology**: Professional apology responses
- **clarification**: Clear up misunderstandings

## Database

Replies are stored in SQLite at `~/.openclaw/skills/engagement-replies/replies.db`:

- **generated_replies**: All generated reply suggestions with metadata
- **templates**: Quick response templates
- **sentiment_cache**: Cached sentiment analysis results

## No External Dependencies

This skill uses local AI generation patterns and does not require external API keys. It works entirely offline.
