# PRD: Hashtag Research

## Introduction
A skill that finds trending and relevant hashtags for social media content. Casey needs to maximize content discoverability through strategic hashtag usage without manual research.

## Goals
- Research and recommend relevant hashtags for content
- Analyze trending hashtags in real-time
- Score hashtags by relevance and competition level
- Provide niche and broad hashtag mixes
- Ensure all research operations pass type checking

## User Stories

### US-001: Content-Based Hashtag Suggestions
**Description:** As a content creator, I want hashtag suggestions based on my content so that I can improve post discoverability.

**Acceptance Criteria:**
- [ ] Analyze post content for topic extraction
- [ ] Suggest 20-30 relevant hashtags per post
- [ ] Categorize hashtags by type (niche, broad, trending, branded)
- [ ] Provide relevance scores for each suggestion
- [ ] Typecheck passes

### US-002: Trending Hashtag Discovery
**Description:** As a content creator, I want to discover trending hashtags in my niche so that I can join relevant conversations.

**Acceptance Criteria:**
- [ ] Track trending hashtags by industry/category
- [ ] Show trend velocity (rising, stable, declining)
- [ ] Filter trends by platform and time period
- [ ] Alert for emerging trends in user's niche
- [ ] Typecheck passes

### US-003: Competition and Reach Analysis
**Description:** As a content creator, I want to understand hashtag competition levels so that I can balance reach and visibility.

**Acceptance Criteria:**
- [ ] Display post volume for each hashtag
- [ ] Calculate competition score (low, medium, high)
- [ ] Estimate reach potential
- [ ] Suggest optimal hashtag mix strategy
- [ ] Typecheck passes

### US-004: Hashtag Set Management
**Description:** As a content creator, I want to save and reuse hashtag sets so that I can maintain consistency.

**Acceptance Criteria:**
- [ ] Create and save custom hashtag collections
- [ ] Organize sets by content theme or campaign
- [ ] One-click copy to clipboard
- [ ] Performance tracking per hashtag set
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Analyze content and suggest relevant hashtags
- FR-2: Track trending hashtags across platforms
- FR-3: Score hashtags by relevance, competition, and reach potential
- FR-4: Categorize hashtags (niche, broad, trending, branded, location)
- FR-5: Save and manage hashtag sets/collections
- FR-6: Platform-specific hashtag limits and best practices
- FR-7: Banned or shadowbanned hashtag detection
- FR-8: Hashtag performance tracking over time
- FR-9: Competitor hashtag analysis
- FR-10: Export hashtag sets in platform-ready formats

## Non-Goals
- Automated hashtag insertion into posts (suggestions only)
- Guaranteed viral success metrics
- Instagram/Facebook API integration for real-time data (use third-party data)
- Hashtag purchasing or promotion
- Cross-language hashtag research (English-focused)
- Historical hashtag data beyond 90 days
- Influencer identification via hashtags
- Automated posting with hashtags (handled by social-scheduler)

## Technical Considerations
- **Data Sources:** Third-party APIs for hashtag trends (no direct platform APIs)
- **NLP:** Topic extraction and semantic similarity for relevance scoring
- **Database:** Hashtag metadata storage (volume, trends, categories)
- **Caching:** Trend data cached with appropriate TTL
- **Scoring Algorithm:** Weighted formula for relevance, competition, reach
- **Web Scraping:** Ethical collection of public trend data
- **Updates:** Daily or real-time trend data refresh
- **Type Safety:** TypeScript types for hashtag data structures and API responses

## Success Metrics
- 90%+ of suggested hashtags are relevant to content (user-rated)
- Users discover 5+ new relevant hashtags per research session
- Hashtag sets improve post reach by 20%+ vs. no hashtags
- 70%+ of users save at least 3 hashtag collections
- Trend alerts identify 80%+ of major trends in user's niche within 48 hours
