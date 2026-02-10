# PRD: Knowledge Base Search

## Introduction

A semantic search system for Tim (Support) that searches across Zendesk/Help Scout knowledge bases to find relevant answers quickly. Uses semantic understanding rather than keyword matching to surface the most helpful articles and suggest quick replies.

## Goals

- Enable semantic search across all knowledge base articles
- Rank answers by relevance and helpfulness
- Suggest quick replies based on matched articles
- Reduce time spent manually searching for solutions
- Improve response consistency by using approved KB content

## User Stories

### US-001: Zendesk/Help Scout Integration
**Description:** As a support agent, I want the system to connect to our existing KB so all content is searchable.

**Acceptance Criteria:**
- [ ] OAuth connection to Zendesk or Help Scout
- [ ] Sync all published articles to local index
- [ ] Handle article updates and deletions
- [ ] Support multiple knowledge bases per organization
- [ ] Sync runs automatically every 15 minutes
- [ ] Typecheck/lint passes

### US-002: Semantic Search
**Description:** As Tim (Support), I want to search using natural language instead of exact keywords.

**Acceptance Criteria:**
- [ ] Accept full question text as search query
- [ ] Use embeddings to find semantically similar content
- [ ] Return results in <2 seconds
- [ ] Show relevance score for each result
- [ ] Support filters (category, date, popularity)
- [ ] Typecheck/lint passes

### US-003: Answer Ranking
**Description:** As a support agent, I want the best answers ranked first so I don't waste time reading irrelevant articles.

**Acceptance Criteria:**
- [ ] Rank by semantic similarity to query
- [ ] Boost frequently-used articles (usage-based ranking)
- [ ] Consider article helpfulness ratings
- [ ] Prioritize recently updated articles
- [ ] Allow manual reordering/pinning of key articles
- [ ] Typecheck/lint passes

### US-004: Quick Replies
**Description:** As Tim (Support), I want one-click insertion of KB content into my responses.

**Acceptance Criteria:**
- [ ] "Insert as reply" button on each search result
- [ ] Auto-personalize with customer name placeholder
- [ ] Option to insert summary vs full article
- [ ] Track which articles are used in replies
- [ ] Keyboard shortcut (Cmd+K) to trigger search
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Contextual Suggestions
**Description:** As a support agent, I want relevant KB articles suggested while I read a ticket.

**Acceptance Criteria:**
- [ ] Auto-suggest articles based on ticket content
- [ ] Display suggestions in sidebar while viewing ticket
- [ ] Show confidence score for each suggestion
- [ ] One-click to view full article
- [ ] Dismiss suggestions that aren't relevant
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Integrate with Zendesk and Help Scout APIs for article sync
- FR-2: Generate embeddings for all KB articles using local model
- FR-3: Support semantic search with natural language queries
- FR-4: Rank results by relevance, popularity, and recency
- FR-5: Provide one-click quick reply insertion with personalization
- FR-6: Auto-suggest relevant articles based on ticket context
- FR-7: Track article usage metrics (views, insertions, helpfulness)
- FR-8: Support filtering by category, date range, and article status
- FR-9: Maintain search index locally for fast queries
- FR-10: Allow manual article pinning/boosting for common issues

## Non-Goals

- No creation or editing of KB articles (read-only access)
- No customer-facing search (agent-only tool)
- No multi-language search in v1
- No AI-generated answers (only existing KB content)
- No integration with external knowledge bases (Confluence, Notion)

## Technical Considerations

- Use lightweight embedding model (all-MiniLM-L6-v2 or similar)
- Store vector index locally using FAISS or similar
- Implement incremental sync to minimize API calls
- Cache search results for common queries
- Support offline mode with last-synced index

## Success Metrics

- Search results returned in <2 seconds
- Top-3 results contain answer in 85% of searches
- Average articles read per ticket reduced by 40%
- Agent time-to-first-response improved by 25%
- KB article usage increased by 30%

## Open Questions

- Should we support custom embedding models?
- How to handle very large KBs (10,000+ articles)?
- Should we integrate with ticket context for better suggestions?
