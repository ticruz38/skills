# PRD: Satisfaction Tracker

## Introduction

A CSAT (Customer Satisfaction) tracking and feedback analysis system for Tim (Support) that collects post-resolution surveys, analyzes trends, and generates reports. Helps identify areas for improvement and recognize high-performing agents.

## Goals

- Collect CSAT ratings after ticket resolution
- Track satisfaction trends over time
- Analyze feedback to identify improvement areas
- Generate reports for management review
- Recognize agents with consistently high ratings

## User Stories

### US-001: Post-Resolution Surveys
**Description:** As a support manager, I want to automatically collect CSAT ratings after tickets are resolved.

**Acceptance Criteria:**
- [ ] Trigger survey email 24 hours after ticket resolution
- [ ] Include simple 1-5 star rating in email
- [ ] Provide optional comment field
- [ ] Link back to ticket for context
- [ ] Send reminder if no response after 3 days
- [ ] Typecheck/lint passes

### US-002: CSAT Trends
**Description:** As a support manager, I want to see CSAT trends over time to track team performance.

**Acceptance Criteria:**
- [ ] Display average CSAT by week, month, quarter
- [ ] Show trend line with improvement/decline indicators
- [ ] Compare to team/organization benchmarks
- [ ] Filter by agent, category, or time period
- [ ] Export trend data to CSV
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Feedback Analysis
**Description:** As Tim (Support), I want feedback categorized so we can identify common issues.

**Acceptance Criteria:**
- [ ] Auto-categorize feedback comments (positive, negative, neutral)
- [ ] Extract key themes from negative feedback
- [ ] Identify recurring complaints or praise
- [ ] Link feedback to specific tickets for context
- [ ] Highlight feedback mentioning specific agents
- [ ] Typecheck/lint passes

### US-004: Agent Performance
**Description:** As a support manager, I want to see individual agent CSAT scores for performance reviews.

**Acceptance Criteria:**
- [ ] Show average CSAT per agent
- [ ] Display number of rated tickets per agent
- [ ] Rank agents by satisfaction score
- [ ] Show agent's CSAT trend over time
- [ ] Compare agent to team average
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Reporting Dashboard
**Description:** As a support manager, I want automated reports on CSAT metrics.

**Acceptance Criteria:**
- [ ] Generate weekly summary report
- [ ] Include key metrics: avg CSAT, response rate, trend
- [ ] Highlight top and bottom performing categories
- [ ] Show agent leaderboard
- [ ] Email report to managers automatically
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Automatically send CSAT surveys after ticket resolution
- FR-2: Collect 1-5 star ratings with optional comment
- FR-3: Track and display CSAT trends over time
- FR-4: Analyze feedback sentiment and extract key themes
- FR-5: Generate agent performance reports with CSAT metrics
- FR-6: Create automated weekly/monthly summary reports
- FR-7: Support filtering by date range, agent, and category
- FR-8: Calculate response rates and survey completion metrics
- FR-9: Export data in CSV/Excel format
- FR-10: Integrate with Zendesk/Help Scout satisfaction ratings

## Non-Goals

- No NPS (Net Promoter Score) collection in v1
- No real-time in-app surveys
- No customer-facing dashboards or reports
- No integration with external BI tools (Tableau, Looker)
- No predictive CSAT modeling

## Technical Considerations

- Store CSAT data locally for fast reporting
- Implement email delivery with tracking
- Use lightweight NLP for feedback categorization
- Support webhook integration for survey responses
- Archive old survey data to manage storage

## Success Metrics

- Survey response rate >30%
- CSAT tracking accuracy 100% (all rated tickets captured)
- Report generation time <5 seconds
- Average CSAT score maintained or improved
- Manager time spent on manual CSAT tracking reduced by 80%

## Open Questions

- Should we support custom survey questions?
- How to handle customers who rate multiple tickets?
- Should we integrate with existing Zendesk satisfaction ratings?
