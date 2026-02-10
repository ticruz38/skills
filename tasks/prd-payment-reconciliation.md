# PRD: Payment Reconciliation

## Introduction
A payment reconciliation system that automatically matches incoming bank transactions to outstanding invoices, helping freelancers and small business owners quickly identify which invoices have been paid and flag any discrepancies. This reduces manual data entry and catches payment errors early.

## Goals
- Import bank transactions from CSV or direct bank connection
- Automatically match payments to outstanding invoices
- Identify and flag unmatched or partial payments
- Handle payment discrepancies with clear workflows
- Provide reconciliation reports for accounting purposes

## User Stories

### US-001: Import Bank Transactions
**Description:** As a freelancer, I want to import my bank transactions from a CSV file so that I can match them against my invoices without manual data entry.

**Acceptance Criteria:**
- [ ] CSV upload with mapping interface (date, description, amount, reference)
- [ ] Support for common bank CSV formats
- [ ] Preview of imported transactions before processing
- [ ] Duplicate detection to prevent re-importing
- [ ] Error handling for malformed CSV files
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Auto-Match Payments to Invoices
**Description:** As a business owner, I want the system to automatically match incoming payments to my outstanding invoices so that I can save time on manual reconciliation.

**Acceptance Criteria:**
- [ ] Matching algorithm using: amount, reference/invoice number, client name
- [ ] Confidence score for each match (high/medium/low)
- [ ] Bulk approve high-confidence matches
- [ ] Review queue for low-confidence matches
- [ ] Match history log
- [ ] Typecheck passes

### US-003: Manual Payment Matching
**Description:** As a freelancer, I want to manually match a payment to an invoice when auto-matching fails so that I can complete reconciliation for all transactions.

**Acceptance Criteria:**
- [ ] Unmatched transactions list with search/filter
- [ ] Manual match interface: select invoice from dropdown or search
- [ ] Support for partial payments (apply to specific invoice amount)
- [ ] Split payments across multiple invoices
- [ ] Create "other income" category for non-invoice payments
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Handle Partial and Overpayments
**Description:** As a business owner, I want to handle partial payments and overpayments gracefully so that my records remain accurate.

**Acceptance Criteria:**
- [ ] Partial payment: mark invoice as partially paid with remaining balance
- [ ] Overpayment: record credit balance for client
- [ ] Visual distinction between full, partial, and over payments
- [ ] Automatic application of credit to future invoices (optional)
- [ ] Notification to user when overpayment detected
- [ ] Typecheck passes

### US-005: Flag Discrepancies
**Description:** As a freelancer, I want to be alerted when there's a discrepancy between expected and received payment amounts so that I can follow up with the client.

**Acceptance Criteria:**
- [ ] Discrepancy detection for amount mismatches
- [ ] Flag icon on invoices with payment issues
- [ ] Discrepancy report showing: expected amount, received amount, difference
- [ ] Action buttons: contact client, write off difference, adjust invoice
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Generate Reconciliation Report
**Description:** As a business owner, I want to generate a reconciliation report for a specific period so that I can provide documentation to my accountant.

**Acceptance Criteria:**
- [ ] Date range selection for report
- [ ] Summary statistics: total imported, total matched, total unmatched
- [ ] Detailed list with match status for each transaction
- [ ] Export to PDF and CSV
- [ ] Opening and closing balance verification
- [ ] Typecheck passes

## Functional Requirements
- FR-1: CSV import with column mapping for various bank formats
- FR-2: Auto-matching algorithm using fuzzy matching on amount, reference, and payee
- FR-3: Confidence scoring system for match quality
- FR-4: Manual matching interface for unmatched transactions
- FR-5: Support for partial payments with balance tracking
- FR-6: Overpayment handling with client credit balance
- FR-7: Discrepancy detection and flagging system
- FR-8: Reconciliation report generation with export options
- FR-9: Duplicate transaction prevention

## Non-Goals
- Direct bank API integration (CSV import only for MVP)
- Multi-currency reconciliation
- Automatic payment application without review
- Integration with accounting software (QuickBooks, Xero)
- Bank statement balancing (starting/ending balance verification)
- Check deposit or cash payment tracking

## Technical Considerations
- **CSV Parsing:** Robust parser handling different date formats, number formats, encodings
- **Matching Algorithm:** Fuzzy string matching (Levenshtein distance) for names, exact for amounts
- **Data Storage:** Transaction table with match status and linked invoice ID
- **File Handling:** Temporary storage for uploaded CSVs with cleanup
- **Reporting:** PDF generation for reconciliation reports

## Success Metrics
- 80% of transactions auto-matched with high confidence
- Manual matching completed in under 30 seconds per transaction
- Zero duplicate transactions imported
- Reconciliation report generated in under 5 seconds
- Discrepancy flags appear within 1 hour of import

## Open Questions
- Should we support recurring import from email attachments?
- Do we need bank statement format templates for major banks?
- Should partial payments automatically trigger invoice updates?
- How do we handle wire transfer fees that reduce received amount?
