# PRD: Late Fee Calculator

## Introduction
A late fee calculation and management system that helps freelancers and small business owners automatically calculate, apply, and communicate late fees on overdue invoices based on predefined contract terms. This encourages timely payments while maintaining professional client relationships.

## Goals
- Calculate late fees based on configurable contract terms
- Apply late fees to overdue invoices automatically or manually
- Notify clients about applied late fees with clear explanations
- Track late fee history and waivers
- Provide insights on late fee effectiveness

## User Stories

### US-001: Configure Late Fee Rules
**Description:** As a business owner, I want to configure late fee rules based on my contract terms so that fees are calculated consistently and fairly.

**Acceptance Criteria:**
- [ ] Fee type selection: percentage (%) or flat amount
- [ ] Rate input field with validation (e.g., 1.5% per month, $25 flat)
- [ ] Grace period configuration (days after due date before fees apply)
- [ ] Cap/maximum fee setting (optional)
- [ ] Compound vs simple interest option
- [ ] Default rule and per-client override capability
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Calculate Late Fees Automatically
**Description:** As a freelancer, I want late fees to be calculated automatically on overdue invoices so that I don't have to compute them manually.

**Acceptance Criteria:**
- [ ] Daily background calculation for all overdue invoices
- [ ] Fee calculation based on outstanding principal amount
- [ ] Accurate day counting (respecting grace period)
- [ ] Running total display on invoice detail page
- [ ] Audit log showing calculation history
- [ ] Typecheck passes

### US-003: Apply Late Fee to Invoice
**Description:** As a business owner, I want to apply calculated late fees to an invoice so that the client sees the updated total amount due.

**Acceptance Criteria:**
- [ ] "Apply Late Fee" button on overdue invoices
- [ ] Confirmation modal showing fee breakdown
- [ ] Invoice total updates to include late fees
- [ ] Separate line item for late fees on invoice
- [ ] Option to apply all pending fees across multiple invoices (bulk action)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Notify Client of Late Fees
**Description:** As a freelancer, I want to notify clients when late fees are applied so that they understand the additional charges.

**Acceptance Criteria:**
- [ ] Automatic email notification when fee is applied
- [ ] Customizable email template with variables ({{fee_amount}}, {{total_due}}, {{days_overdue}})
- [ ] Fee explanation with breakdown calculation
- [ ] Option to include in payment reminder emails
- [ ] Notification history log
- [ ] Typecheck passes

### US-005: Waive or Adjust Late Fees
**Description:** As a business owner, I want to waive or adjust late fees for specific clients so that I can maintain good relationships when circumstances warrant flexibility.

**Acceptance Criteria:**
- [ ] "Waive Fee" button with reason field
- [ ] Partial waiver option (reduce fee amount)
- [ ] Require confirmation for waivers above threshold
- [ ] Waiver history with reason tracking
- [ ] Report of all waived fees by client and date range
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: View Late Fee Report
**Description:** As a freelancer, I want to see a report of all late fees charged and collected so that I can assess the effectiveness of my late fee policy.

**Acceptance Criteria:**
- [ ] Date range filter for report
- [ ] Summary metrics: total fees charged, total collected, collection rate
- [ ] Breakdown by client: fees charged, paid, waived, outstanding
- [ ] Trend chart showing fees over time
- [ ] Export to CSV/PDF
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements
- FR-1: Late fee rule configuration: percentage or flat, rate, grace period, cap
- FR-2: Daily automated calculation of accrued late fees
- FR-3: Fee application workflow with confirmation and invoice update
- FR-4: Late fee line item added to invoices when applied
- FR-5: Email notification system for fee application
- FR-6: Waiver functionality with reason tracking and approval workflow
- FR-7: Late fee reporting with filtering and export
- FR-8: Per-client fee rule overrides
- FR-9: Audit log for all fee calculations and adjustments

## Non-Goals
- Legal compliance checking for usury laws (user responsibility)
- Collection agency integration for unpaid late fees
- Interest compounding on late fees themselves
- Automated small claims court filing
- Credit reporting of late payments
- Multi-tier escalation fees (e.g., increasing rate over time)

## Technical Considerations
- **Calculation Engine:** Accurate day counting, handling leap years and timezone issues
- **Scheduling:** Background job for daily fee calculations
- **Currency:** Handle precision for percentage calculations (2 decimal places)
- **Legal Compliance:** Warning about maximum allowable rates by jurisdiction
- **Audit Trail:** Immutable log of all fee calculations and changes
- **Performance:** Efficient calculation for large numbers of overdue invoices

## Success Metrics
- Late fee calculation completes in under 1 second per invoice
- 90% of clients pay within grace period after first late fee notification
- Fee waiver requests processed in under 2 minutes
- Late fee report generates in under 3 seconds
- Zero calculation errors in fee amounts

## Open Questions
- Should we support different fee structures by invoice amount tier?
- Do we need integration with legal compliance databases for rate limits?
- Should late fees themselves accrue additional late fees if unpaid?
- How do we handle partial payments when late fees are present (apply to principal or fees first)?
