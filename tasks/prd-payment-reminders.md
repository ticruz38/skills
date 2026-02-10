# PRD: Payment Reminders

## Introduction
An automated payment reminder system that helps freelancers and small business owners follow up on overdue invoices with professionally crafted reminder emails. The system escalates from polite nudges to firm demands based on invoice age, improving cash flow without damaging client relationships.

## Goals
- Automate payment reminder emails for overdue invoices
- Provide escalating reminder levels (gentle → firm → final notice)
- Offer customizable email templates for different tones
- Schedule reminders at optimal intervals
- Track reminder history and client responses

## User Stories

### US-001: Set Up Reminder Schedule
**Description:** As a freelancer, I want to configure when payment reminders are automatically sent so that I can maintain consistent follow-up without manual effort.

**Acceptance Criteria:**
- [ ] Configurable reminder intervals (e.g., 7, 14, 30 days after due date)
- [ ] Toggle to enable/disable automatic reminders
- [ ] Option to set business hours for sending (avoid weekends/holidays)
- [ ] Preview of reminder schedule for each invoice
- [ ] Typecheck passes

### US-002: Create Email Templates
**Description:** As a business owner, I want to customize reminder email templates so that they match my communication style and brand voice.

**Acceptance Criteria:**
- [ ] Default templates for 3 escalation levels: polite, firm, final notice
- [ ] Template editor with variables ({{client_name}}, {{invoice_number}}, {{amount}}, {{due_date}})
- [ ] Subject line customization per template
- [ ] Preview functionality showing rendered template
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Send Manual Reminder
**Description:** As a freelancer, I want to manually send a payment reminder to a specific client so that I can follow up on urgent cases immediately.

**Acceptance Criteria:**
- [ ] "Send Reminder" button on overdue invoices
- [ ] Template selection dropdown (polite, firm, custom)
- [ ] Preview before sending with editable message
- [ ] Confirmation toast on successful send
- [ ] Log entry created for the sent reminder
- [ ] Typecheck passes

### US-004: View Reminder History
**Description:** As a business owner, I want to see a history of all reminders sent for an invoice so that I can track my follow-up efforts.

**Acceptance Criteria:**
- [ ] Timeline view of all reminders sent
- [ ] Display: date sent, template used, email subject
- [ ] Status indicator (sent, opened, bounced)
- [ ] Access from invoice detail page
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Configure Escalation Rules
**Description:** As a freelancer, I want to set up escalation rules that automatically increase reminder firmness over time so that clients take deadlines seriously.

**Acceptance Criteria:**
- [ ] Rule builder: "If overdue by X days, use Y template"
- [ ] Multiple rules can be chained (7 days → polite, 14 days → firm, 30 days → final)
- [ ] Ability to skip to final notice for repeat offenders
- [ ] Per-client override of default rules
- [ ] Typecheck passes

### US-006: Pause Reminders for Specific Invoices
**Description:** As a business owner, I want to pause automatic reminders for a specific invoice so that I can handle special cases (payment plans, disputes) without annoying the client.

**Acceptance Criteria:**
- [ ] "Pause Reminders" toggle on invoice page
- [ ] Reason field for pausing (optional)
- [ ] Visual indicator showing reminders are paused
- [ ] Option to resume reminders with reset schedule
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements
- FR-1: Reminder schedule configuration with customizable intervals
- FR-2: Email template system with variable substitution
- FR-3: Three default templates: polite (gentle reminder), firm (overdue notice), final (urgent demand)
- FR-4: Email sending integration (SMTP, SendGrid, or similar)
- FR-5: Reminder history tracking with timestamps
- FR-6: Escalation rule engine for automatic template selection
- FR-7: Pause/resume functionality for individual invoices
- FR-8: Open/click tracking for sent emails (if supported by email provider)

## Non-Goals
- SMS reminders (email only for MVP)
- Automated phone calls
- Legal action or collection agency integration
- Payment plan management
- Dispute resolution workflow
- Integration with accounting software (manual tracking only)

## Technical Considerations
- **Email Integration:** SMTP configuration or third-party service (SendGrid, Mailgun)
- **Scheduling:** Cron jobs or task queue for automated sends
- **Template Engine:** Handlebars or similar for variable substitution
- **Tracking:** Email open/click tracking via pixel or link rewriting
- **Rate Limiting:** Prevent accidental email spam with send limits

## Success Metrics
- Reminder emails sent within 1 hour of scheduled time
- 25% reduction in average days overdue after implementation
- Zero duplicate reminders sent to same client
- Email delivery rate above 95%
- Template customization completed in under 5 minutes

## Open Questions
- Should we support multiple recipients per reminder (CC accounting department)?
- Do we need read receipts or delivery confirmation?
- Should reminders include a payment link (requires payment gateway)?
- How do we handle bounced emails or invalid addresses?
