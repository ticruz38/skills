---
title: Hashtag Research
skill_id: hashtag-research
description: Find relevant and trending hashtags for social media content
version: 1.0.0
author: OpenClaw
license: MIT
---

# Hashtag Research Skill

Find relevant and trending hashtags for social media platforms. Research hashtags by keywords, discover niche tags with low competition, and get suggestions based on your content.

## Features

- **Keyword-based suggestions**: Find hashtags matching your keywords
- **Trending analysis**: Get popular hashtags by category
- **Relevance scoring**: Hashtags ranked by relevance to your content
- **Niche discovery**: Find low-competition hashtags for better visibility
- **Multi-platform support**: Instagram, Twitter/X, TikTok, LinkedIn, Facebook
- **Category filtering**: 16 content categories
- **Search history**: Track your research
- **Custom hashtags**: Add your own hashtags to the database

## Installation

```bash
npm install
npm run build
```

## Usage

### Research Hashtags by Keywords

```bash
# Basic research
npm run cli -- research fitness workout

# With platform and limit
npm run cli -- research fitness workout -p instagram -l 30

# Specific category
npm run cli -- research startup -c business -p twitter
```

### Suggest Hashtags for Content

```bash
# Analyze content and suggest hashtags
npm run cli -- suggest "Check out my new workout routine!" -p instagram

# Limit results
npm run cli -- suggest "Vegan pasta recipe" -l 15
```

### Get Trending Hashtags

```bash
# All trending
npm run cli -- trending

# By platform and category
npm run cli -- trending -p instagram -c fitness -l 20
```

### Discover Niche Hashtags

```bash
# Find low-competition hashtags
npm run cli -- niche "vegan recipes" --max-competition low

# Deep search
npm run cli -- niche "digital art" -d 30 -p instagram
```

### Add Custom Hashtags

```bash
npm run cli -- add --tag mycustomtag -c lifestyle --competition low
```

### View Statistics

```bash
npm run cli -- stats
npm run cli -- history
npm run cli -- categories
npm run cli -- platforms
```

## API Usage

```typescript
import { HashtagResearchSkill } from './index';

const skill = new HashtagResearchSkill();
await skill.initialize();

// Research hashtags
const result = await skill.research({
  keywords: ['fitness', 'workout'],
  platform: 'instagram',
  category: 'fitness',
  limit: 30,
});

console.log(result.hashtags);
console.log(result.trending);
console.log(result.niche);

// Suggest based on content
const suggestions = await skill.suggestHashtags(
  'Check out my new workout routine!',
  'instagram',
  15
);

// Get trending
const trending = await skill.getTrending('instagram', 'fitness', 20);

// Discover niches
const niche = await skill.discoverNiches({
  topic: 'vegan recipes',
  platform: 'instagram',
  maxCompetition: 'low',
});

// Add custom hashtag
await skill.addCustomHashtag({
  tag: 'mycustomtag',
  platform: 'instagram',
  category: 'lifestyle',
  competitionLevel: 'low',
  trendingScore: 60,
  relatedTags: ['custom', 'tag', 'example'],
});

await skill.close();
```

## Data Structure

### Hashtag

```typescript
interface Hashtag {
  id: number;
  tag: string;                    // The hashtag (without #)
  platform: SocialPlatform;       // instagram, twitter, tiktok, linkedin, facebook, generic
  category: HashtagCategory;      // 16 categories
  postCount?: number;             // Estimated post count
  trendingScore: number;          // 0-100 trending score
  relevanceScore?: number;        // Calculated relevance to query
  competitionLevel: 'low' | 'medium' | 'high';
  relatedTags: string[];          // Related hashtags
  description?: string;
  lastUpdated: string;
}
```

### Categories

- general, lifestyle, business, tech, fashion
- food, travel, fitness, art, photography
- music, sports, health, education, marketing
- entrepreneur

### Competition Levels

- **Low**: Less competition, easier to rank
- **Medium**: Balanced reach and competition
- **High**: High traffic but very competitive

## Database

SQLite database stored at `~/.openclaw/skills/hashtag-research/hashtags.db`

Tables:
- `hashtags` - Hashtag data with scores and metadata
- `search_history` - Search query history
- `trending_cache` - Cached trending data

## CLI Commands

| Command | Description |
|---------|-------------|
| `research <keywords...>` | Research hashtags by keywords |
| `suggest <content>` | Suggest hashtags for content |
| `trending` | Show trending hashtags |
| `niche <topic>` | Discover niche hashtags |
| `add --tag <tag>` | Add custom hashtag |
| `stats` | Show database statistics |
| `history` | Show search history |
| `categories` | List categories |
| `platforms` | List platforms |
| `health` | Health check |

## Options

| Option | Description |
|--------|-------------|
| `-p, --platform` | Social platform |
| `-c, --category` | Content category |
| `-l, --limit` | Result limit |
| `--no-trending` | Exclude trending |
| `--no-niche` | Exclude niche |
| `--max-competition` | Max competition level |
| `--depth` | Search depth for niche |

## No External API Required

This skill uses a local database of curated hashtags with scoring algorithms. No API keys or external services required.
