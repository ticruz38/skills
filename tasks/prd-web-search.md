# PRD: Web Search

## Introduction
A web search skill that enables the Researcher (Russ) to search the internet for information, retrieve structured results, rank sources by credibility, and cache frequently accessed results for improved performance.

## Goals
- Enable fast, reliable web search via Google/Serper API
- Return structured, parseable search results with metadata
- Rank sources by credibility and relevance
- Cache results to reduce API costs and improve response times
- Support advanced search operators and filters

## User Stories

### US-001: Basic Web Search
**Description:** As a researcher, I want to search the web for a query so that I can find relevant information quickly.

**Acceptance Criteria:**
- [ ] Accept a search query string and return top 10 results
- [ ] Each result includes: title, URL, snippet, source domain, date
- [ ] Handle API errors gracefully with meaningful error messages
- [ ] Typecheck passes

### US-002: Structured Search Results
**Description:** As a researcher, I want search results in a structured format so that I can programmatically process them.

**Acceptance Criteria:**
- [ ] Return results as JSON with consistent schema
- [ ] Schema includes: results[], totalResults, searchTime, query
- [ ] Support filtering by date range, site, and content type
- [ ] Typecheck passes

### US-003: Source Ranking
**Description:** As a researcher, I want results ranked by credibility so that I can trust the information I receive.

**Acceptance Criteria:**
- [ ] Rank sources based on domain authority (e.g., .edu, .gov prioritized)
- [ ] Include credibility score (0-100) for each result
- [ ] Allow custom domain whitelist/blacklist configuration
- [ ] Typecheck passes

### US-004: Result Caching
**Description:** As a researcher, I want frequently searched queries to be cached so that responses are faster and API costs are reduced.

**Acceptance Criteria:**
- [ ] Cache results for 24 hours by default (configurable)
- [ ] Cache key based on normalized query string
- [ ] Provide cache bypass option for fresh results
- [ ] Typecheck passes

### US-005: Advanced Search Operators
**Description:** As a researcher, I want to use advanced search operators so that I can refine my searches.

**Acceptance Criteria:**
- [ ] Support exact phrase matching with quotes
- [ ] Support site-specific search (site:example.com)
- [ ] Support exclusion operator (-term)
- [ ] Support filetype filtering (filetype:pdf)
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Integrate with Google Custom Search API or Serper.dev API
- FR-2: Accept search query with optional parameters (num_results, date_range, site)
- FR-3: Return standardized JSON response with metadata and result array
- FR-4: Implement source ranking algorithm based on domain reputation
- FR-5: Cache results in local storage with TTL (time-to-live)
- FR-6: Support cache invalidation and bypass
- FR-7: Handle rate limiting with exponential backoff
- FR-8: Log all searches for analytics and debugging

## Non-Goals
- No web scraping or crawling capabilities
- No paid content bypass or paywall removal
- No image or video search (text-only)
- No real-time search (results may be minutes old)
- No AI-generated summaries of results

## Technical Considerations
- **API Choice:** Google Custom Search API (100 queries/day free) or Serper.dev (generous free tier)
- **Rate Limits:** Implement request throttling to stay within API limits
- **Storage:** Local JSON file or SQLite for caching
- **Security:** Store API keys in environment variables, never in code
- **Error Handling:** Graceful degradation when API is unavailable
- **Dependencies:** Minimal external libraries (axios/fetch for HTTP)

## Success Metrics
- Average search response time < 2 seconds (cached: < 200ms)
- Cache hit rate > 40% for repeated queries
- 99% uptime for search functionality
- Zero API key exposure incidents

## Open Questions
- Should we support multiple search providers as fallbacks?
- Should we implement search result deduplication across queries?
- Should we track and report API usage/costs?
