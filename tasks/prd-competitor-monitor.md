# PRD: Competitor Monitor

## Introduction
A competitor monitoring skill that tracks competitor websites for changes, detects content updates, compares screenshots over time, and sends alerts when significant changes occur. Helps the Researcher (Russ) stay informed about competitor activities.

## Goals
- Monitor competitor websites for changes
- Detect content, pricing, and structural updates
- Capture and compare screenshots visually
- Send alerts for significant changes
- Maintain historical change log

## User Stories

### US-001: Add Competitor URLs
**Description:** As a researcher, I want to add competitor URLs for monitoring so that I can track their website changes.

**Acceptance Criteria:**
- [ ] Accept URL and optional CSS selector for specific sections
- [ ] Validate URL accessibility before adding
- [ ] Set monitoring frequency (hourly, daily, weekly)
- [ ] Name and categorize competitors
- [ ] Typecheck passes

### US-002: Change Detection
**Description:** As a researcher, I want to detect content changes so that I know when competitors update their sites.

**Acceptance Criteria:**
- [ ] Monitor text content changes using checksum or diff
- [ ] Monitor specific DOM elements via CSS selectors
- [ ] Ignore dynamic content (ads, timestamps, session IDs)
- [ ] Track change timestamp and type (content, structure)
- [ ] Typecheck passes

### US-003: Screenshot Comparison
**Description:** As a researcher, I want visual comparison of pages so that I can see visual changes over time.

**Acceptance Criteria:**
- [ ] Capture full-page screenshots on each check
- [ ] Generate visual diff highlighting changes
- [ ] Support side-by-side comparison view
- [ ] Store screenshots with timestamps
- [ ] Typecheck passes

### US-004: Alert System
**Description:** As a researcher, I want alerts for significant changes so that I can react quickly to competitor moves.

**Acceptance Criteria:**
- [ ] Configure alert thresholds (any change, >10% change, keywords)
- [ ] Send notifications via console, email, or webhook
- [ ] Batch multiple changes into digest alerts
- [ ] Alert suppression for known/expected changes
- [ ] Typecheck passes

### US-005: Change History
**Description:** As a researcher, I want to view change history so that I can analyze competitor evolution over time.

**Acceptance Criteria:**
- [ ] Store all versions of monitored content
- [ ] Display chronological change log
- [ ] Diff view between any two versions
- [ ] Export history report
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Add competitor URLs with monitoring configuration
- FR-2: Schedule periodic checks (configurable frequency)
- FR-3: Detect text and HTML structure changes
- FR-4: Capture and store full-page screenshots
- FR-5: Generate visual diffs between screenshots
- FR-6: Filter out noise (dynamic content, ads)
- FR-7: Send alerts based on configurable thresholds
- FR-8: Maintain version history with diff capability
- FR-9: Export change reports (JSON, CSV, PDF)

## Non-Goals
- No automated competitive analysis or insights
- No pricing extraction or price comparison features
- No SEO or ranking tracking
- No social media monitoring
- No automated response or counter-actions

## Technical Considerations
- **Screenshot:** Playwright or Puppeteer for headless browser capture
- **Change Detection:** SHA256 checksums for content, pixel diff for images
- **Storage:** File system for screenshots, database for metadata
- **Scheduling:** Cron jobs or task queue (Bull, Celery)
- **Rate Limiting:** Respect robots.txt, implement delays between requests
- **Resource Usage:** Screenshot storage can grow quickly; implement retention policies

## Success Metrics
- Detect 99%+ of visible content changes
- False positive rate < 5% (excluding dynamic content)
- Screenshot capture success rate > 98%
- Alert delivery within 5 minutes of detection

## Open Questions
- Should we support login-required pages for monitoring?
- Should we implement AI-powered change classification (pricing, product, content)?
- Should we support monitoring specific API endpoints?
