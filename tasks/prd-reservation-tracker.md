# PRD: Reservation Tracker

## Introduction

Centralize all trip bookings and confirmations in one place by automatically parsing confirmation emails and displaying them in a unified timeline. This feature helps travelers stay organized with check-in reminders and booking details at their fingertips.

## Goals

- Parse and extract details from booking confirmation emails
- Display all reservations in a unified chronological timeline
- Send timely check-in and check-out reminders
- Provide quick access to confirmation numbers and booking details
- Support manual entry for bookings without email confirmations

## User Stories

### US-001: Parse confirmation emails
**Description:** As a traveler, I want the system to automatically parse my booking confirmation emails so that I don't have to manually enter details.

**Acceptance Criteria:**
- [ ] Connect to email inbox (Gmail, Outlook support)
- [ ] Auto-detect booking confirmations by sender patterns
- [ ] Extract key details: dates, confirmation number, price, vendor
- [ ] Support flights, hotels, car rentals, and activities
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Unified reservation timeline
**Description:** As a traveler, I want to see all my reservations in one timeline view so that I can track my trip schedule.

**Acceptance Criteria:**
- [ ] Chronological list of all reservations
- [ ] Group by trip with expandable sections
- [ ] Color coding by reservation type (flight, hotel, activity)
- [ ] Search and filter by type, date, or vendor
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Check-in reminders
**Description:** As a traveler, I want to receive reminders before check-in so that I don't miss important deadlines.

**Acceptance Criteria:**
- [ ] 24-hour advance notification for flight check-in
- [ ] Check-in reminder for hotels with time windows
- [ ] Customizable reminder times per user preference
- [ ] Push and email notification options
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Reservation details view
**Description:** As a traveler, I want to view complete details for each reservation so that I have information readily available.

**Acceptance Criteria:**
- [ ] Display confirmation number with copy button
- [ ] Show dates, times, and locations
- [ ] Display price breakdown and payment status
- [ ] Link to original booking site
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Manual reservation entry
**Description:** As a traveler with bookings that didn't have email confirmations, I want to manually add reservations so that all my plans are tracked.

**Acceptance Criteria:**
- [ ] Form to manually add reservation details
- [ ] Template for each reservation type (flight, hotel, etc.)
- [ ] Upload PDF or image of confirmation
- [ ] Edit and delete manual entries
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Connect to email providers to scan for booking confirmations
- FR-2: Parse confirmation emails for flights, hotels, car rentals, and activities
- FR-3: Extract and store: vendor, dates, confirmation number, price, location
- FR-4: Display reservations in chronological timeline grouped by trip
- FR-5: Send automated check-in reminders (24hr, 1hr before)
- FR-6: Allow manual entry and editing of reservations
- FR-7: Support attachment upload (PDF, images) for confirmations
- FR-8: Quick copy for confirmation numbers and key details
- FR-9: Search and filter reservations by type, date, or vendor

## Non-Goals

- No automated check-in execution (just reminders)
- No cancellation or modification of bookings
- No price tracking or price drop alerts
- No loyalty point tracking
- No expense reporting or receipt management

## Design Considerations

- Card-based timeline with clear type icons and color coding
- Collapsible date headers for trip organization
- Sticky header showing current/upcoming reservation
- Mobile-optimized view with swipe actions

## Technical Considerations

- Email parsing using NLP or regex patterns
- OAuth integration for Gmail/Outlook access
- Background job for periodic email scanning
- Secure storage of confirmation numbers (encrypted)
- Push notification service integration

## Success Metrics

- 90% of confirmation emails parsed successfully
- Average time to add manual reservation: under 2 minutes
- Reminder open rate: 70%+
- 80% of users check timeline at least once per trip

## Open Questions

- Should we support corporate travel management systems?
- Do we need to handle multi-passenger bookings separately?
- Should we integrate with airline apps for mobile boarding passes?
