# PRD: Scheduling Links

## Introduction

Generate Calendly-style scheduling links that allow others to book time directly on Terry's calendar. This feature eliminates the back-and-forth of finding mutually available times for external meetings.

## Goals

- Create customizable booking pages with personal scheduling links
- Define availability windows and meeting types
- Support multiple duration options per link
- Provide embeddable widgets for websites and emails

## User Stories

### US-001: Create Scheduling Link
**Description:** As Terry, I want to create personalized scheduling links so that external contacts can book time with me directly.

**Acceptance Criteria:**
- [ ] Generate unique URL (e.g., schedule.with/terry/consultation)
- [ ] Set link title and description
- [ ] Choose which calendar to check for availability
- [ ] Set link expiration or usage limits (optional)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Configure Availability Windows
**Description:** As Terry, I want to define when people can book through my link so that meetings only happen during my preferred hours.

**Acceptance Criteria:**
- [ ] Set weekly availability schedule (e.g., Mon-Fri 9am-5pm)
- [ ] Add specific date exceptions (block holidays, vacation days)
- [ ] Set minimum notice required (e.g., 24 hours advance booking)
- [ ] Set maximum booking horizon (e.g., 30 days in advance)
- [ ] Configure buffer time between booked meetings
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Multiple Meeting Types & Durations
**Description:** As Terry, I want to offer different meeting types so that bookers choose the appropriate duration and format.

**Acceptance Criteria:**
- [ ] Create multiple meeting types: "Quick Chat" (15min), "Meeting" (30min), "Deep Dive" (60min)
- [ ] Custom meeting type creation with name, duration, description
- [ ] Different availability rules per meeting type
- [ ] Meeting type selection on booking page
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Booking Page Experience
**Description:** As a booker, I want a clean booking interface so that I can quickly find and select a suitable time.

**Acceptance Criteria:**
- [ ] Display available time slots in booker's local timezone
- [ ] Calendar view with clickable available slots
- [ ] Show remaining slots for popular times
- [ ] Mobile-responsive booking page
- [ ] Collect booker name, email, and optional notes
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Confirmation & Calendar Integration
**Description:** As Terry, I want booked meetings to automatically appear on my calendar so that I don't have to manually create events.

**Acceptance Criteria:**
- [ ] Auto-create calendar event when booking confirmed
- [ ] Send confirmation email to booker with calendar invite
- [ ] Send notification email to Terry with booker details
- [ ] Include meeting link (Zoom, Meet) in calendar event
- [ ] Typecheck/lint passes

### US-006: Embeddable Booking Widget
**Description:** As Terry, I want to embed my booking calendar on my website so that visitors can schedule without leaving the page.

**Acceptance Criteria:**
- [ ] Generate embed code (iframe) for booking widget
- [ ] Customizable widget dimensions and colors
- [ ] Mobile-responsive embedded widget
- [ ] Light and dark theme options
- [ ] Copy-paste ready embed code with instructions
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-007: Booking Management & Limits
**Description:** As Terry, I want to control my booking volume so that I don't get overwhelmed with meetings.

**Acceptance Criteria:**
- [ ] Set daily/weekly booking limits per link
- [ ] Display "fully booked" message when limits reached
- [ ] Pause/unpause scheduling links temporarily
- [ ] Require approval for bookings (optional)
- [ ] View booking analytics: total bookings, conversion rate
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Generate unique, shareable scheduling URLs for each meeting type
- FR-2: Configure weekly availability patterns with day/time selection
- FR-3: Set booking constraints: minimum notice, maximum horizon, duration limits
- FR-4: Support multiple meeting types with different durations and settings
- FR-5: Display booking interface in booker's local timezone with automatic conversion
- FR-6: Auto-create calendar events and send confirmation emails upon booking
- FR-7: Generate embeddable iframe widgets for external websites
- FR-8: Implement booking limits and pause functionality for volume control
- FR-9: Collect custom fields from bookers (name, email, phone, notes, etc.)
- FR-10: Provide booking analytics dashboard with usage statistics
- FR-11: Support video conferencing integration (Zoom, Google Meet, Teams)
- FR-12: Allow rescheduling and cancellation by booker and host

## Non-Goals

- No group scheduling or round-robin assignment to team members
- No payment collection for paid consultations
- No custom branding/domain on free tier (basic styling only)
- No SMS notifications or reminders
- No AI-powered scheduling suggestions for bookers

## Design Considerations

- Clean, minimal booking page that loads quickly
- Calendar-first interface with clear available/busy indicators
- Professional but approachable visual design
- Consistent branding across all scheduling touchpoints
- Loading states for calendar availability checks

## Technical Considerations

- Real-time availability calculation from connected calendars
- Rate limiting to prevent calendar scanning abuse
- Webhook support for booking notifications
- CDN delivery for embed widgets
- GDPR compliance for booker data collection

## Success Metrics

- Reduce average time-to-book from 6+ emails to 2 clicks
- 95% of bookings completed without host intervention
- Booking page load time under 2 seconds
- 80%+ booking completion rate (started to confirmed)

## Open Questions

- Should we support "secret" links not indexed in user profile?
- How should we handle recurring bookings (e.g., weekly coaching)?
- Should we support team scheduling links (round-robin) in future?
