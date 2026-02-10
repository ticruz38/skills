# PRD: Monthly Reports

## Introduction
Generate automated monthly expense summaries that provide insights into spending patterns, category breakdowns, and budget tracking. Visual charts and trend analysis help users understand their financial habits and make informed decisions.

## Goals
- Auto-generate monthly expense reports on the 1st of each month
- Display spending breakdown by category with visual charts
- Show month-over-month spending trends
- Compare actual spending against user-defined budgets
- Enable one-click sharing of reports

## User Stories

### US-001: Monthly Report Generation
**Description:** As a user tracking expenses, I want an automated monthly summary so that I can review my spending without manual calculation.

**Acceptance Criteria:**
- [ ] Report auto-generated on the 1st of each month for previous month
- [ ] Report accessible via email notification and in-app dashboard
- [ ] Summary shows: total spent, number of transactions, top category, vs. previous month
- [ ] User can manually generate report for any past month
- [ ] Report generation completes in <5 seconds
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Category Spending Breakdown
**Description:** As a user tracking expenses, I want to see how much I spent in each category so that I understand my spending distribution.

**Acceptance Criteria:**
- [ ] Interactive pie/donut chart showing spending by category
- [ ] Category list sorted by amount (highest first)
- [ ] Percentage shown for each category relative to total
- [ ] Click/tap on category filters expense list to that category
- [ ] "Other" category groups expenses <2% of total
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Spending Trends
**Description:** As a user tracking expenses, I want to see my spending trends over time so that I can identify patterns and seasonal variations.

**Acceptance Criteria:**
- [ ] Line or bar chart showing monthly totals for last 6/12 months
- [ ] Category-specific trend lines toggleable on/off
- [ ] Year-over-year comparison for same month
- [ ] Average spending line shown for reference
- [ ] Annotations for highest/lowest months
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Budget vs Actual
**Description:** As a user tracking expenses, I want to compare my spending against my budget so that I know if I'm overspending.

**Acceptance Criteria:**
- [ ] User can set monthly budget per category or overall
- [ ] Progress bars show % of budget used for each category
- [ ] Visual indicator when >80% of budget spent (yellow) and >100% (red)
- [ ] Summary shows: budgeted amount, actual spent, remaining/deficit
- [ ] Budget rollover option for unused amounts
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Report Sharing
**Description:** As a user tracking expenses, I want to share my monthly report so that I can discuss finances with partners or advisors.

**Acceptance Criteria:**
- [ ] Share button generates public or private link to report view
- - [ ] PDF export option for email attachment
- [ ] Option to include/exclude specific categories in shared report
- [ ] Shared reports are view-only (no editing)
- [ ] Links expire after 30 days (configurable)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements
- FR-1: Reports cover calendar month (1st to last day) with timezone support
- FR-2: Charts use Chart.js or similar lightweight library
- FR-3: Data points: total spending, transaction count, average transaction, top 3 merchants, top 3 categories
- FR-4: Budgets can be set at category level or overall monthly total
- FR-5: Report data exportable as PDF or image (PNG) for sharing
- FR-6: Email notifications include report summary with link to full report

## Non-Goals
- No real-time spending alerts (covered in separate notification feature)
- No predictive forecasting or AI spending predictions
- No investment or net worth tracking
- No income tracking (expenses only)
- No bank account linking or automatic import

## Technical Considerations
- Charting Library: Chart.js (lightweight, responsive, accessible)
- Report Storage: Pre-generated reports cached for fast loading
- Scheduling: Cron job triggers report generation on 1st of month
- Email: SendGrid or similar for reliable delivery
- Mobile: Responsive charts that work on 320px+ screens
- Performance: Report data aggregated via database views for speed

## Success Metrics
- 60%+ of users open monthly report within 3 days of generation
- Average time spent viewing report: >2 minutes
- 40%+ of users with budgets set (engagement indicator)
- Report generation success rate: >99%
