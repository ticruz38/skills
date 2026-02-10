# PRD: Market Reports

## Introduction

Provide Realtor Owen with automated, data-driven market trend reports to help him advise clients with confidence. The Market Reports system aggregates local real estate data to visualize price trends, inventory levels, days on market, and neighborhood-specific insights. This positions Owen as a market expert and helps clients make informed buying and selling decisions.

## Goals

- Generate automated weekly market trend reports for Owen's active areas
- Visualize price trends, inventory, and days on market over time
- Provide neighborhood-level comparisons and insights
- Enable Owen to create custom reports for client presentations
- Reduce time spent manually compiling market data by 90%

## User Stories

### US-001: View Dashboard Overview
**Description:** As Owen, I want to see a dashboard of my active market areas so that I can quickly understand current conditions.

**Acceptance Criteria:**
- [ ] Map view showing Owen's tracked neighborhoods/zip codes
- [ ] Cards displaying key metrics: median price, inventory count, days on market
- [ ] Trend indicators (up/down arrows with percentages vs last month)
- [ ] Quick filters for time period (1m, 3m, 6m, 1y, 2y)
- [ ] Click to drill down into specific area
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Price Trend Analysis
**Description:** As Owen, I want to see price trends over time so that I can advise clients on market timing.

**Acceptance Criteria:**
- [ ] Line chart of median sale price over selected time period
- [ ] Price per square foot trend line
- [ ] Sold vs. list price ratio over time
- [ ] Filter by property type (single family, condo, etc.)
- [ ] Hover for exact values on specific dates
- [ ] Export chart as image for client reports
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Inventory and Days on Market
**Description:** As Owen, I want to track inventory levels and days on market so that I can gauge market competitiveness.

**Acceptance Criteria:**
- [ ] Bar chart of active listings count by month
- [ ] Line chart of average days on market over time
- [ ] New listings vs. sold listings comparison
- [ ] Months of inventory calculation and trend
- [ ] "Absorption rate" metric (how fast inventory is selling)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Neighborhood Comparison
**Description:** As Owen, I want to compare multiple neighborhoods side-by-side so that I can help clients choose the right area.

**Acceptance Criteria:**
- [ ] Multi-select neighborhoods for comparison
- [ ] Table view with key metrics per neighborhood
- [ ] Bar charts comparing prices, DOM, inventory across areas
- [ ] "Hotness score" ranking neighborhoods by activity
- [ ] Save comparison as favorite
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Generate Client Report
**Description:** As Owen, I want to generate a branded PDF report for clients so that I can share market insights professionally.

**Acceptance Criteria:**
- [ ] Select report type (buyer's guide, seller's guide, neighborhood profile)
- [ ] Auto-populate with current market data
- [ ] Add custom notes and commentary
- [ ] Owen's branding (logo, photo, contact info)
- [ ] Download as PDF or share via email
- [ ] Report history with view tracking
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Aggregate market data from Zillow, Redfin, and public records
- FR-2: Calculate median sale price, price per sqft, and price trends
- FR-3: Track active inventory levels and new listing velocity
- FR-4: Calculate average and median days on market
- FR-5: Compute sold-to-list price ratios
- FR-6: Support geographic granularity: city, ZIP code, neighborhood
- FR-7: Time period filters: 1 month, 3 months, 6 months, 1 year, 2 years, 5 years
- FR-8: Property type filtering (single family, condo, townhouse, all)
- FR-9: Interactive charts with hover details and zoom
- FR-10: Export charts as PNG/SVG for presentations
- FR-11: Generate branded PDF reports with customizable content
- FR-12: Schedule automated weekly email reports for tracked areas
- FR-13: Compare up to 5 neighborhoods side-by-side

## Non-Goals

- No predictive pricing or AI-powered valuations (separate feature)
- No rental market analysis (buy/sell focus only)
- No commercial real estate data
- No foreclosure or distressed property tracking
- No individual property history (covered in property-alerts)

## Technical Considerations

- Data aggregation from Zillow API, Redfin API, and county assessor records
- Time-series database for efficient trend queries
- Charting library (Chart.js, Recharts, or D3.js)
- PDF generation (Puppeteer, jsPDF, or server-side rendering)
- Caching layer for expensive aggregation queries
- Data freshness indicator (last updated timestamp)
- Scheduled jobs for weekly report generation

## Success Metrics

- Market data updated within 24 hours of source changes
- Report generation time under 30 seconds
- Owen creates at least 2 client reports per week
- Clients mention market reports as valuable in feedback
- Zero manual spreadsheet compilation for market data

## Open Questions

- Should we include school ratings or crime stats in neighborhood profiles?
- Do we need custom report templates for different client types (first-time buyers, investors)?
- Should reports include competitive analysis of other agents' listings?
