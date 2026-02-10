# PRD: Client CRM

## Introduction

A lightweight Customer Relationship Management system tailored for Realtor Owen to track client preferences, buying/selling timelines, and communication history. The Client CRM centralizes all client information, ensuring Owen never misses a detail and can provide personalized service at scale. This replaces scattered notes and spreadsheets with a unified client view.

## Goals

- Centralize all client information in one searchable database
- Track property preferences, budget, timeline, and decision factors
- Log all communications (calls, emails, texts, meetings) automatically
- Visualize client pipeline and buying/selling stages
- Enable personalized follow-ups based on client history

## User Stories

### US-001: Add New Client
**Description:** As Owen, I want to add a new client to my CRM so that I can start tracking their home search.

**Acceptance Criteria:**
- [ ] Client creation form with name, email, phone, address
- [ ] Tag as buyer, seller, or both
- [ ] Set client source (referral, website, open house, etc.)
- [ ] Upload profile photo
- [ ] Add spouse/partner information
- [ ] Auto-create timeline entry for "Client Added"
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Record Property Preferences
**Description:** As Owen, I want to record a client's property preferences so that I can find them the perfect home.

**Acceptance Criteria:**
- [ ] Form for must-haves, nice-to-haves, and deal-breakers
- [ ] Budget range with pre-approval amount
- [ ] Preferred locations (multiple neighborhoods)
- [ ] Property type, beds, baths, square footage
- [ ] Lifestyle preferences (commute, schools, walkability)
- [ ] Timeline: urgency level and target move date
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Log Communication
**Description:** As Owen, I want to log a call or meeting with a client so that I have a record of our discussions.

**Acceptance Criteria:**
- [ ] Quick-log form with date, type (call, email, text, meeting, showing)
- [ ] Notes field with rich text support
- [ ] Tag with follow-up required flag and date
- [ ] View communication history in chronological timeline
- [ ] Filter by communication type
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: View Client Pipeline
**Description:** As Owen, I want to see all my clients organized by stage so that I can manage my pipeline effectively.

**Acceptance Criteria:**
- [ ] Kanban board view with stages: Prospect, Active Search, Under Contract, Closed, On Hold
- [ ] Drag-and-drop to move clients between stages
- [ ] Card shows client photo, name, timeline, and next action
- [ ] Filter by client type (buyer/seller), timeline, or tag
- [ ] Count badges showing clients per stage
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Set Follow-up Reminders
**Description:** As Owen, I want to set follow-up reminders so that I never let a client slip through the cracks.

**Acceptance Criteria:**
- [ ] Add reminder with date, time, and note
- [ ] Associate with specific client
- [ ] Notification at reminder time (email or in-app)
- [ ] Mark as complete or snooze
- [ ] View all upcoming reminders in dashboard
- [ ] Overdue reminder alerts
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Search and Filter Clients
**Description:** As Owen, I want to search my client database so that I can quickly find specific client information.

**Acceptance Criteria:**
- [ ] Global search across names, emails, phone numbers, notes
- [ ] Advanced filters: stage, timeline, location preference, budget range
- [ ] Save frequent searches
- [ ] Sort by last contact date, urgency, alphabetically
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Store client contact info: name, email, phone, address, photo
- FR-2: Track buyer/seller status and client source
- FR-3: Record detailed property preferences and budget
- FR-4: Log all communications with timestamps and notes
- FR-5: Pipeline stages: Prospect, Active Search, Under Contract, Closed, On Hold
- FR-6: Create, edit, and complete follow-up reminders
- FR-7: Visual timeline of all client interactions
- FR-8: Search across all client data fields
- FR-9: Filter by stage, type, timeline, and custom tags
- FR-10: Export client list to CSV
- FR-11: Import clients from CSV or Google Contacts
- FR-12: Activity dashboard showing recent interactions and upcoming tasks

## Non-Goals

- No email/SMS sending from the platform (integration only)
- No automated marketing campaigns or drip sequences
- No document signing or transaction management
- No commission tracking or accounting features
- No team collaboration features (single agent focus)

## Technical Considerations

- Contact sync with Google Contacts or Outlook
- Email parsing for auto-logging (with privacy controls)
- File attachments for client documents
- Data encryption for PII (personally identifiable information)
- Soft delete with recovery for accidental deletions
- Mobile-responsive design for field use
- GDPR/CCPA compliance for client data

## Success Metrics

- All active clients have complete preference profiles
- 100% of client communications logged within 24 hours
- Zero missed follow-up reminders
- Average time to find client info under 10 seconds
- Client satisfaction score >4.5/5 on communication

## Open Questions

- Should we integrate with email for auto-logging communications?
- Do we need a mobile app or is mobile web sufficient?
- Should clients have a portal to update their own preferences?
- Do we need integration with transaction management systems?
