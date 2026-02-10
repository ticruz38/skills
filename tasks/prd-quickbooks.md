# PRD: QuickBooks Online Integration

## Introduction
Enable seamless two-way synchronization between our accounting platform and QuickBooks Online (QBO). This integration allows accountants to sync customers, invoices, and transactions between systems, eliminating manual data entry and ensuring data consistency across platforms.

## Goals
- Authenticate with QuickBooks Online via OAuth 2.0
- Sync customers, invoices, and transactions bidirectionally
- Provide manual sync triggers and automatic sync scheduling
- Handle conflicts and data mapping between systems
- Maintain audit trail of all sync operations

## User Stories

### US-001: OAuth Authentication with QBO
**Description:** As an accountant, I want to securely connect my QuickBooks Online account so that I can sync data between platforms.

**Acceptance Criteria:**
- [ ] "Connect to QuickBooks" button initiates OAuth flow
- [ ] User can authorize the application via Intuit's OAuth portal
- [ ] Access and refresh tokens are securely stored
- [ ] Connection status is displayed in settings
- [ ] Typecheck passes

### US-002: Manual Sync of Customers and Invoices
**Description:** As an accountant, I want to manually trigger a sync of customers and invoices so that I can keep data current before generating reports.

**Acceptance Criteria:**
- [ ] Sync button available on integration dashboard
- [ ] User can select sync direction (to QBO, from QBO, or bidirectional)
- [ ] Sync progress indicator shows current operation
- [ ] Summary report displays items created/updated/skipped
- [ ] Typecheck passes

### US-003: Automatic Scheduled Sync
**Description:** As an accountant, I want data to sync automatically daily so that I don't have to remember to do it manually.

**Acceptance Criteria:**
- [ ] User can configure sync schedule (daily, weekly, manual only)
- [ ] Background job runs sync at scheduled time
- [ ] Email notification sent on sync completion or failure
- [ ] Sync history log shows last 30 days of operations
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Implement OAuth 2.0 authentication flow with Intuit Developer Platform
- FR-2: Store OAuth tokens securely with encryption at rest
- FR-3: Map customer data fields between systems (name, email, address, tax ID)
- FR-4: Map invoice data fields (number, date, line items, amounts, status)
- FR-5: Handle QBO API rate limits with exponential backoff
- FR-6: Detect and flag data conflicts for manual resolution
- FR-7: Support multiple QBO company connections per user
- FR-8: Webhook support for real-time updates from QBO

## Non-Goals
- Support for QuickBooks Desktop (QBD) version
- Direct bank feed integration from QBO
- Payroll data synchronization
- Inventory management sync
- Multi-currency transaction conversion

## Technical Considerations
- Requires Intuit Developer account and app registration
- QBO API sandbox environment for testing
- Token refresh logic before expiration (180 days)
- Idempotency keys for preventing duplicate records
- Database schema changes for storing QBO entity IDs
- Background job queue (e.g., Bull, Sidekiq) for async sync operations
- Conflict resolution UI for manual merge decisions

## Success Metrics
- Successful OAuth connection within 3 clicks
- Initial sync completes within 5 minutes for up to 1000 records
- 99.5% data accuracy between systems post-sync
- Less than 1% sync failure rate
- User can resolve conflicts within 2 minutes

## Open Questions
- Should we support one-way sync as a default for safety?
- How should we handle deleted records in either system?
- Do we need to sync historical data or only new transactions?
