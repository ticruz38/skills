---
title: Web Search
skill_id: web-search
---

# Web Search Skill

Search the web for information with structured results, source ranking, and result caching.

## Usage

```typescript
import { WebSearchSkill } from '@openclaw/web-search';

const search = new WebSearchSkill({ enableCache: true });

// Basic search
const results = await search.search('TypeScript best practices');

// Search with options
const results = await search.search('machine learning tutorial', {
  numResults: 10,
  safeSearch: true
});

// Get cached results
const cached = await search.getCachedResults('query');

// Clear old cache
await search.clearCache(7); // Clear entries older than 7 days
```

## CLI

```bash
# Search the web
npx web-search search "query"

# Search with options
npx web-search search "query" --num 10 --safe

# View cache
npx web-search cache

# Clear cache
npx web-search clear-cache --days 7

# Health check
npx web-search health
```

## Configuration

Optional environment variables:
- `SERPER_API_KEY` - Use Serper.dev API for better results (optional, falls back to scraping)

## Features

- Web search with structured results (title, URL, snippet, source)
- Source ranking by relevance
- Result caching in SQLite
- Safe search filtering
- Configurable number of results
