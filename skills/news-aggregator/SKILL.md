---
title: News Aggregator
skill_id: news-aggregator
---

# News Aggregator Skill

RSS/Atom feed aggregator with keyword filtering, source management, and deduplication.

## Usage

```typescript
import { NewsAggregatorSkill } from '@openclaw/news-aggregator';

const aggregator = new NewsAggregatorSkill();

// Add feed sources
await aggregator.addSource('TechCrunch', 'https://techcrunch.com/feed/', 'tech');
await aggregator.addSource('Hacker News', 'https://news.ycombinator.com/rss', 'tech');

// Fetch all feeds
const results = await aggregator.fetchAllSources();

// List items
const { items } = await aggregator.getItems({ limit: 20, isRead: false });

// Add keyword filters
await aggregator.addKeywordFilter('typescript', true, 10);  // Include
await aggregator.addKeywordFilter('spam', false);            // Exclude

// Get filtered items
const filtered = await aggregator.getFilteredItems({ limit: 10 });

// Mark as read
await aggregator.markAsRead(itemId);

// Save/bookmark items
await aggregator.saveItem(itemId, true);
```

## CLI

```bash
# Source management
npx news-aggregator sources
npx news-aggregator add "TechCrunch" "https://techcrunch.com/feed/" --category tech
npx news-aggregator remove 1
npx news-aggregator enable 2
npx news-aggregator disable 2

# Fetch feeds
npx news-aggregator fetch          # Fetch all sources
npx news-aggregator fetch 1        # Fetch specific source

# List and read items
npx news-aggregator list           # List recent items
npx news-aggregator list --unread  # Show only unread
npx news-aggregator list --saved   # Show saved items
npx news-aggregator read 42        # Read specific item
npx news-aggregator mark-read 42
npx news-aggregator mark-read --all

# Filtering
npx news-aggregator filters
npx news-aggregator filter-add "typescript"
npx news-aggregator filter-add "spam" --exclude
npx news-aggregator filtered       # Show filtered items

# Deduplication
npx news-aggregator duplicates
npx news-aggregator dedupe

# Stats and health
npx news-aggregator stats
npx news-aggregator health
```

## Features

- RSS and Atom feed parsing
- Keyword filtering (include/exclude)
- Source management with categories
- Deduplication by GUID
- Read/saved status tracking
- Full-text search filtering
- SQLite storage for offline access
