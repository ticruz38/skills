# PRD: Data Connector

## Introduction

Enable Barry the Analyst to seamlessly connect to external data sources (Google Sheets, Airtable, Notion, CSV/Excel) to import, sync, and cache data for analysis. This eliminates manual data entry and ensures analyses are always based on current information.

## Goals

- Support connections to Google Sheets, Airtable, Notion, CSV, and Excel files
- Provide secure OAuth-based authentication for cloud services
- Implement intelligent data caching to reduce API calls and improve performance
- Enable scheduled automatic data refresh
- Support data transformation and cleaning during import

## User Stories

### US-001: Connect to Google Sheets
**Description:** As Barry, I want to connect to a Google Sheet so that I can import live data for analysis.

**Acceptance Criteria:**
- [ ] OAuth 2.0 flow to authenticate with Google
- [ ] Sheet picker UI showing available sheets
- [ ] Select specific worksheet/range within a spreadsheet
- [ ] Preview data before import
- [ ] Typecheck/lint passes

### US-002: Connect to Airtable
**Description:** As Barry, I want to connect to an Airtable base so that I can analyze structured data.

**Acceptance Criteria:**
- [ ] API key or OAuth authentication
- [ ] Base and table selection UI
- [ ] Field type mapping (Airtable to internal types)
- [ ] Handle linked records and attachments
- [ ] Typecheck/lint passes

### US-003: Connect to Notion
**Description:** As Barry, I want to connect to Notion databases so that I can analyze database content.

**Acceptance Criteria:**
- [ ] Notion integration token authentication
- [ ] Database selection from connected workspace
- [ ] Property type mapping (Notion to internal types)
- [ ] Handle rollups and relations
- [ ] Typecheck/lint passes

### US-004: Upload CSV/Excel Files
**Description:** As Barry, I want to upload CSV or Excel files so that I can analyze local data.

**Acceptance Criteria:**
- [ ] Drag-and-drop file upload interface
- [ ] Support .csv, .xlsx, .xls formats
- [ ] Auto-detect delimiter and encoding for CSV
- [ ] Handle multiple sheets in Excel files
- [ ] Typecheck/lint passes

### US-005: Configure Data Caching
**Description:** As Barry, I want to cache imported data so that reports load faster and API limits are respected.

**Acceptance Criteria:**
- [ ] Cache configuration UI (TTL, refresh strategy)
- [ ] Manual refresh button for immediate updates
- [ ] Visual indicator showing cache age
- [ ] Background refresh option
- [ ] Typecheck/lint passes

### US-006: Set Up Auto-Refresh
**Description:** As Barry, I want to schedule automatic data refreshes so that my analyses stay current.

**Acceptance Criteria:**
- [ ] Schedule configuration (hourly, daily, weekly)
- [ ] Email notification on refresh failure
- [ ] View refresh history and logs
- [ ] Pause/resume scheduled refreshes
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Support OAuth 2.0 authentication for Google Sheets and Airtable
- FR-2: Support API token authentication for Notion
- FR-3: Support CSV/Excel file upload with size limit of 50MB
- FR-4: Cache imported data with configurable TTL (default: 1 hour)
- FR-5: Auto-detect data types (text, number, date, boolean) during import
- FR-6: Allow manual data type override during import
- FR-7: Support incremental updates where API allows
- FR-8: Provide data preview before final import
- FR-9: Handle API rate limits with exponential backoff
- FR-10: Encrypt stored API credentials and tokens

## Non-Goals

- No real-time streaming data connections
- No direct database connections (PostgreSQL, MySQL, etc.)
- No ETL pipeline creation or complex transformations
- No data editing in source systems
- No two-way sync (changes in analysis don't write back)

## Technical Considerations

- Store OAuth tokens securely with encryption at rest
- Implement request queuing to respect API rate limits
- Use webhooks where available for near-real-time updates
- Cache storage in Redis or similar for fast access
- Support for proxy configuration for enterprise environments

## Success Metrics

- Connect to any supported source in under 60 seconds
- Data refresh completes in under 10 seconds for datasets under 10,000 rows
- API quota utilization stays under 80% of limits
- Zero data loss during import/transformation

## Open Questions

- Should we support webhook-based instant updates from Airtable?
- Do we need to support enterprise SSO (SAML/OIDC) for authentication?
- Should we store historical versions of imported data?
