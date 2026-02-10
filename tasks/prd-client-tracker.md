# PRD: Client Tracker

## Introduction
A client management and payment history tracking system that helps freelancers and small business owners maintain detailed records of client interactions, payment behaviors, and creditworthiness. This tool enables informed decisions about payment terms and identifies high-risk clients before extending credit.

## Goals
- Maintain a centralized client database with contact and billing information
- Track complete payment history per client
- Calculate and display credit limits and exposure
- Generate risk scores based on payment behavior
- Provide insights for setting client-specific payment terms

## User Stories

### US-001: Add New Client
**Description:** As a freelancer, I want to add new clients to my database so that I can track their invoices and payment history in one place.

**Acceptance Criteria:**
- [ ] Client form with: name, email, phone, billing address
- [ ] Company name field (optional)
- [ ] Tax ID / VAT number field (optional)
- [ ] Notes field for special requirements
- [ ] Duplicate detection based on email
- [ ] Typecheck passes

### US-002: View Client Dashboard
**Description:** As a business owner, I want to see a comprehensive dashboard for each client so that I can quickly assess their account status and history.

**Acceptance Criteria:**
- [ ] Client header with contact info and total outstanding balance
- [ ] Invoice history table with status indicators
- [ ] Payment statistics: total invoiced, total paid, average payment time
- [ ] Recent activity feed (invoices created, payments received, reminders sent)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Track Payment History
**Description:** As a freelancer, I want to see a detailed payment history for each client so that I can identify patterns in their payment behavior.

**Acceptance Criteria:**
- [ ] Chronological list of all payments received
- [ ] Each entry shows: invoice number, amount, payment date, days to pay
- [ ] Filter by date range
- [ ] Export payment history to CSV
- [ ] Visual indicator for late vs on-time payments
- [ ] Typecheck passes

### US-004: Set Client Credit Limits
**Description:** As a business owner, I want to set credit limits for clients so that I can control my financial exposure.

**Acceptance Criteria:**
- [ ] Credit limit field on client profile
- [ ] Visual warning when outstanding balance approaches limit
- [ ] Block new invoices when limit is exceeded (optional toggle)
- [ ] Credit limit history showing changes over time
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Calculate Client Risk Score
**Description:** As a freelancer, I want to see a risk score for each client based on their payment history so that I can make informed decisions about payment terms.

**Acceptance Criteria:**
- [ ] Risk score algorithm based on: average days to pay, late payment frequency, total outstanding
- [ ] Score displayed as low/medium/high or 0-100 scale
- [ ] Breakdown showing contributing factors
- [ ] Trend indicator (improving/stable/worsening)
- [ ] Typecheck passes

### US-006: Client List with Filters
**Description:** As a business owner, I want to filter and sort my client list so that I can prioritize follow-ups with high-risk or high-balance clients.

**Acceptance Criteria:**
- [ ] Sort by: name, total outstanding, average payment time, risk score
- [ ] Filter by: risk level, outstanding balance range, last activity date
- [ ] Search by name or email
- [ ] Quick action buttons (view, new invoice, send reminder)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements
- FR-1: Client data model with contact info, billing address, tax ID, notes
- FR-2: Relationship between clients and invoices (one-to-many)
- FR-3: Payment history aggregation from invoice data
- FR-4: Credit limit enforcement with configurable warnings/blocks
- FR-5: Risk scoring algorithm with weighted factors
- FR-6: Client list with sorting, filtering, and search
- FR-7: Payment statistics calculation (average, total, days to pay)
- FR-8: Activity logging for client interactions

## Non-Goals
- CRM features (lead tracking, sales pipeline)
- Document storage for contracts or agreements
- Time tracking per client
- Project management integration
- Automated credit checks with external agencies
- Multi-user access or client self-service portal

## Technical Considerations
- **Data Model:** Client table with foreign key relationships to invoices
- **Risk Algorithm:** Weighted scoring based on payment velocity, consistency, and volume
- **Aggregation:** Efficient calculation of payment statistics (consider caching)
- **Search:** Full-text search on client name, email, company
- **Export:** CSV generation for payment history reports

## Success Metrics
- Client lookup completed in under 5 seconds
- Risk score calculation updates within 1 hour of payment received
- Credit limit warnings display immediately when threshold crossed
- Payment history exports successfully for clients with 100+ invoices
- Average time to add new client: under 2 minutes

## Open Questions
- Should risk scores be visible to clients or internal only?
- Do we need integration with external credit bureaus?
- Should we support client groups or categories (VIP, regular, new)?
- How do we handle merged or duplicate client records?
