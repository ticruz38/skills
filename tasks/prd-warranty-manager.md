# PRD: Warranty Manager

## Introduction

A warranty tracking and alert system for Hank the Home Handyman to store warranty information, receive expiration alerts, and organize claim documentation. This ensures no warranty expires unused and claim processes are streamlined.

## Goals

- Centralize storage of all product and appliance warranties
- Provide proactive alerts before warranty expiration
- Organize claim documentation and support contacts
- Track warranty claim history and outcomes
- Support multiple warranty types: manufacturer, extended, home warranty

## User Stories

### US-001: Add warranty information
**Description:** As Hank, I want to add warranty details to a product so I can track coverage periods.

**Acceptance Criteria:**
- [ ] Link warranty to existing appliance or create standalone
- [ ] Warranty type: Manufacturer, Extended, Home Warranty, Service Contract
- [ ] Required fields: start date, duration (months/years), provider
- [ ] Optional fields: warranty number, coverage details, phone/email contact
- [ ] Upload warranty document/registration
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Warranty dashboard
**Description:** As Hank, I want to see all my warranties and their status at a glance.

**Acceptance Criteria:**
- [ ] Dashboard shows: active warranties, expiring soon (30 days), expired
- [ ] Visual indicators: green (active), yellow (expiring < 90 days), red (expired)
- [ ] Countdown display: "Expires in 45 days"
- [ ] Filter by: all, active, expiring soon, expired, by provider
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Expiration alerts
**Description:** As Hank, I want to receive alerts before warranties expire so I don't miss claim windows.

**Acceptance Criteria:**
- [ ] Configurable alert schedule: 90, 60, 30, 7 days before expiration
- [ ] Email and/or push notification options
- [ ] Alert includes: product name, warranty type, expiration date, claim contact
- [ ] Mark alert as acknowledged/dismissed
- [ ] Alert history viewable
- [ ] Typecheck/lint passes

### US-004: Record warranty claim
**Description:** As Hank, I want to document warranty claims so I have a record of repairs.

**Acceptance Criteria:**
- [ ] Form to record claim: date filed, issue description, claim number
- [ ] Track claim status: Pending, Approved, Denied, Completed
- [ ] Upload claim documentation and correspondence
- [ ] Add resolution notes and outcome
- [ ] View claim history per warranty
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Warranty document storage
**Description:** As Hank, I want to upload and organize warranty documents for easy access.

**Acceptance Criteria:**
- [ ] Upload original warranty certificate/registration
- [ ] Upload receipts and proof of purchase
- [ ] Organize documents by type with labels
- [ ] Quick download/share option
- [ ] Document preview in browser
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Database schema for warranties with fields: id, product_id (optional), warranty_type, provider, start_date, end_date, warranty_number, coverage_details, contact_phone, contact_email, notes
- FR-2: Automatic expiration date calculation from start date + duration
- FR-3: Dashboard with status categorization and visual indicators
- FR-4: Alert system with configurable notification schedule
- FR-5: Claim tracking with status workflow and documentation
- FR-6: Document storage with categorization and metadata
- FR-7: Integration with Appliance Tracker (link warranties to appliances)
- FR-8: Export warranty summary report (PDF/CSV)

## Non-Goals

- No automatic warranty registration with manufacturers
- No integration with retailer warranty databases
- No automated claim filing with providers
- No warranty valuation or transfer features
- No insurance policy management (separate from warranties)

## Technical Considerations

- Background job for daily expiration checking and notifications
- Date calculations must account for leap years
- Document storage with backup and version control
- Email templates for different alert types

## Success Metrics

- 100% of warranties have valid expiration dates
- Alerts delivered 24 hours before scheduled notification time
- Users can file warranty claim documentation in under 3 minutes
- Zero missed expirations due to system failure

## Open Questions

- Should we support recurring/renewable warranties?
- Should there be a "warranty card" PDF generator for physical backup?
- Should we track warranty transferability for resale scenarios?
