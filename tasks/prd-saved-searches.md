# PRD: Saved Searches

## Introduction
A saved searches skill that allows the Researcher (Russ) to save search queries, run them on a schedule, maintain result history, and receive notifications when new results appear. Automates repetitive research tasks.

## Goals
- Save and organize search queries for reuse
- Schedule automatic execution of saved searches
- Track result history and detect new items
- Send notifications when new results are found
- Support multiple search providers

## User Stories

### US-001: Save Search Queries
**Description:** As a researcher, I want to save search queries so that I can rerun them easily.

**Acceptance Criteria:**
- [ ] Save query with custom name and description
- [ ] Store search parameters (source, filters, date range)
- [ ] Organize into folders or tags
- [ ] Edit and delete saved searches
- [ ] Typecheck passes

### US-002: Scheduled Execution
**Description:** As a researcher, I want searches to run automatically so that I can monitor topics without manual effort.

**Acceptance Criteria:**
- [ ] Schedule searches (hourly, daily, weekly, custom cron)
- [ ] Enable/disable schedules without deleting
- [ ] Set next run time and see last run time
- [ ] Handle schedule conflicts and overlaps
- [ ] Typecheck passes

### US-003: Result History
**Description:** As a researcher, I want to see search history so that I can track how results change over time.

**Acceptance Criteria:**
- [ ] Store all search results with timestamp
- [ ] Compare results between any two runs
- [ ] Show trend graphs (result count over time)
- [ ] Export historical data
- [ ] Typecheck passes

### US-004: New Result Detection
**Description:** As a researcher, I want to know about new results so that I don't miss important information.

**Acceptance Criteria:**
- [ ] Detect new results by comparing to previous run
- [ ] Highlight new, changed, and removed items
- [ ] Configure detection sensitivity (strict vs. fuzzy matching)
- [ ] Mark results as reviewed/acknowledged
- [ ] Typecheck passes

### US-005: Notification System
**Description:** As a researcher, I want notifications for new results so that I can stay informed without checking manually.

**Acceptance Criteria:**
- [ ] Send notifications via console, email, or webhook
- [ ] Configure notification rules (all results, new only, threshold count)
- [ ] Include result summary and direct links
- [ ] Quiet hours and digest mode options
- [ ] Typecheck passes

## Functional Requirements
- FR-1: CRUD operations for saved searches
- FR-2: Support multiple search providers (Web, News, custom APIs)
- FR-3: Schedule searches with cron-like expressions
- FR-4: Store result history with timestamps
- FR-5: Detect new, modified, and removed results
- FR-6: Send notifications via multiple channels
- FR-7: Organize searches with tags/folders
- FR-8: Import/export saved searches (JSON, OPML)
- FR-9: Pause/resume all scheduled searches

## Non-Goals
- No AI-powered query expansion or suggestion
- No collaborative sharing of searches
- No automatic report generation
- No data visualization beyond basic trends
- No integration with external BI tools

## Technical Considerations
- **Scheduling:** node-cron (Node.js) or APScheduler (Python)
- **Storage:** SQLite for search configs and results
- **Notifications:** Pluggable adapters (console, email via SMTP, webhooks)
- **Comparison:** Hash-based or content-based diff for result detection
- **Scalability:** Consider rate limits of search APIs when scheduling
- **Data Retention:** Automatic cleanup of old results to manage storage

## Success Metrics
- Support 100+ saved searches per user
- Schedule execution reliability > 99%
- New result detection accuracy > 95%
- Notification delivery within 1 minute of search completion

## Open Questions
- Should we support conditional searches (if results > N, then alert)?
- Should we integrate with the Competitor Monitor for cross-feature alerts?
- Should we support search templates with variables?
