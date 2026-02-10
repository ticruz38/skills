# PRD: Invoice Management

## Introduction
A complete invoice management system that allows accountants to create professional invoices, send them to clients via email, track payment status, and automate payment reminders. This streamlines the billing process and improves cash flow visibility.

## Goals
- Create professional, customizable invoice templates
- Send invoices directly to clients via email
- Track invoice status (draft, sent, viewed, paid, overdue)
- Automate payment reminder emails
- Support multiple payment methods and partial payments

## User Stories

### US-001: Create Professional Invoice
**Description:** As an accountant, I want to create professional-looking invoices so that my clients take my billing seriously.

**Acceptance Criteria:**
- [ ] Invoice form with client selector, line items, due date, and notes
- [ ] Auto-generate invoice number with customizable prefix
- [ ] Real-time preview of invoice PDF before sending
- [ ] Save as draft or send immediately options
- [ ] Typecheck passes

### US-002: Send Invoice via Email
**Description:** As an accountant, I want to email invoices directly to clients so that I don't need to download and attach files manually.

**Acceptance Criteria:**
- [ ] Email composition with customizable subject and message
- [ ] PDF attachment auto-generated and attached
- [ ] "Pay Online" button/link included in email body
- [ ] Delivery confirmation tracking
- [ ] Typecheck passes

### US-003: Track Payment Status and Send Reminders
**Description:** As an accountant, I want to track which invoices are paid and automatically remind clients about overdue payments.

**Acceptance Criteria:**
- [ ] Dashboard showing invoice status counts (paid, pending, overdue)
- [ ] Automatic reminder emails at 7, 14, and 30 days overdue
- [ ] Manual "Send Reminder" button for any invoice
- [ ] Payment received confirmation with date and amount
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Create invoice with client, line items (description, quantity, rate, amount), due date, and notes
- FR-2: Auto-number invoices with configurable prefix and starting number
- FR-3: Generate PDF invoice with professional branding (logo, colors, company info)
- FR-4: Send invoice via email with customizable templates
- FR-5: Track invoice status: draft, sent, viewed, paid, partially paid, overdue
- FR-6: Record payments with date, amount, method, and reference number
- FR-7: Automated reminder emails for overdue invoices
- FR-8: Recurring invoice support for subscription billing
- FR-9: Invoice list with filtering by status, client, and date range

## Non-Goals
- Payment processing/gateway integration (handled separately)
- Multi-currency invoicing (USD only for MVP)
- Purchase order matching
- Credit note/invoice refund functionality
- Client portal for self-service invoice viewing

## Technical Considerations
- PDF generation library (e.g., Puppeteer, jsPDF, wkhtmltopdf)
- Email service integration (SendGrid, AWS SES, or SMTP)
- Email template system with variables ({{client_name}}, {{invoice_number}})
- Scheduled cron jobs for automated reminders
- Database schema: invoices, invoice_items, payments tables
- File storage for generated PDFs (S3, local filesystem)
- Unsubscribe link in reminder emails for compliance

## Success Metrics
- Create and send invoice in under 2 minutes
- 90% of invoices sent via email (vs downloaded/printed)
- 30% reduction in days sales outstanding (DSO)
- 95% of payment reminders delivered successfully
- Invoice PDF renders correctly across email clients

## Open Questions
- Should reminders come from the platform email or accountant's personal email?
- Do we need to support invoice approval workflows before sending?
- Should we integrate with specific payment providers (Stripe, PayPal)?
