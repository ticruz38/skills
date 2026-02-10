# PRD: News Aggregator

## Introduction
A news aggregation skill that collects articles from RSS feeds and news sources, filters by keywords, manages source subscriptions, and deduplicates similar articles to provide a clean, curated news feed for the Researcher (Russ).

## Goals
- Aggregate news from multiple RSS feeds and news APIs
- Filter articles by keywords, categories, and sources
- Manage source subscriptions (add, remove, categorize)
- Deduplicate similar articles from different sources
- Provide a unified, chronological news feed

## User Stories

### US-001: RSS Feed Parsing
**Description:** As a researcher, I want to add RSS feeds so that I can collect news from my preferred sources.

**Acceptance Criteria:**
- [ ] Accept RSS/Atom feed URLs and parse entries
- [ ] Extract: title, link, description, published date, author
- [ ] Handle malformed feeds gracefully
- [ ] Support standard RSS 2.0 and Atom 1.0 formats
- [ ] Typecheck passes

### US-002: Keyword Filtering
**Description:** As a researcher, I want to filter articles by keywords so that I only see relevant news.

**Acceptance Criteria:**
- [ ] Support include keywords (must contain)
- [ ] Support exclude keywords (must not contain)
- [ ] Support keyword groups with OR/AND logic
- [ ] Case-insensitive matching by default
- [ ] Typecheck passes

### US-003: Source Management
**Description:** As a researcher, I want to manage my news sources so that I can organize my information diet.

**Acceptance Criteria:**
- [ ] Add/remove feed sources with custom names
- [ ] Categorize sources (e.g., Tech, Finance, Science)
- [ ] Enable/disable sources without deleting
- [ ] View source health (last fetch status, error count)
- [ ] Typecheck passes

### US-004: Article Deduplication
**Description:** As a researcher, I want duplicate articles filtered out so that I don't see the same story multiple times.

**Acceptance Criteria:**
- [ ] Detect duplicates by URL normalization
- [ ] Detect near-duplicates by title similarity (fuzzy matching)
- [ ] Keep the earliest or most complete version
- [ ] Mark duplicates with reference to original
- [ ] Typecheck passes

### US-005: Unified News Feed
**Description:** As a researcher, I want a unified feed so that I can browse all news in one place.

**Acceptance Criteria:**
- [ ] Display articles in reverse chronological order
- [ ] Show source, category, and publish time for each article
- [ ] Support pagination or infinite scroll
- [ ] Filter by date range, source, or category
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Parse RSS 2.0 and Atom 1.0 feeds
- FR-2: Store feed configurations (URL, name, category, enabled status)
- FR-3: Fetch feeds on schedule (configurable interval, default 30 min)
- FR-4: Filter articles by include/exclude keyword lists
- FR-5: Deduplicate articles using URL and title similarity
- FR-6: Store article metadata in local database
- FR-7: Provide REST API or CLI for feed management
- FR-8: Mark articles as read/unread

## Non-Goals
- No social media feed aggregation (Twitter/X, Facebook)
- No full-text article extraction (use link to original)
- No AI-generated article summaries
- No push notifications or real-time alerts
- No email digests

## Technical Considerations
- **RSS Parsing:** Use robust library (feedparser for Python, rss-parser for Node.js)
- **Storage:** SQLite for articles, JSON/YAML for source configuration
- **Deduplication:** Use simhash or Jaccard similarity for title matching
- **Scheduling:** Cron-like scheduler or interval-based fetching
- **Rate Limiting:** Respect robots.txt and implement polite delays between requests
- **Feed Health:** Track fetch errors and disable unhealthy feeds after N failures

## Success Metrics
- Support for 50+ concurrent feed sources
- Deduplication accuracy > 95% (minimal false positives)
- Article fetch success rate > 98%
- Feed update latency < 5 minutes from publication

## Open Questions
- Should we support OPML import/export for feed management?
- Should we implement full-text search across article content?
- Should we track article read time or engagement?
