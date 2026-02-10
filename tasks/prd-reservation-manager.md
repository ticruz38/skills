# PRD: Reservation Manager

## Introduction

A comprehensive reservation management system for Sergio's Restaurant that handles table bookings, availability checking, party size management, and SMS confirmations. This system ensures efficient table utilization while providing guests with a seamless booking experience.

## Goals

- Automate the reservation booking process from request to confirmation
- Optimize table utilization through intelligent availability management
- Reduce no-shows via automated SMS reminders and confirmations
- Handle varying party sizes with appropriate table assignments
- Provide staff with a real-time view of bookings and table status

## User Stories

### US-001: Create new reservation
**Description:** As a host, I want to create a new reservation so that guests can book tables for their desired date and time.

**Acceptance Criteria:**
- [ ] Form captures guest name, phone number, party size, date, time, and special requests
- [ ] System validates phone number format for SMS delivery
- [ ] Available time slots display based on selected date and party size
- [ ] Duplicate reservation detection (same phone, date, time within 2 hours)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Check table availability
**Description:** As a host, I want to check real-time table availability so I can offer guests suitable booking options.

**Acceptance Criteria:**
- [ ] Availability view shows open/occupied tables by time slot
- [ ] Filter by party size to show only suitable tables
- [ ] Visual indicators for peak hours and limited availability
- [ ] Block time calculations account for typical dining duration (90 min default)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Send SMS confirmation
**Description:** As a system, I want to automatically send SMS confirmations so guests have booking details and reduce no-shows.

**Acceptance Criteria:**
- [ ] SMS sent immediately upon reservation creation
- [ ] Message includes restaurant name, date, time, party size, and cancellation link
- [ ] Reminder SMS sent 24 hours before reservation
- [ ] Delivery status tracked (sent, delivered, failed)
- [ ] Typecheck/lint passes

### US-004: Modify existing reservation
**Description:** As a host, I want to modify reservation details so I can accommodate guest changes.

**Acceptance Criteria:**
- [ ] Edit party size, time, date, or special requests
- [ ] Re-validate availability for new parameters
- [ ] SMS notification sent for significant changes (time/date)
- [ ] Modification history logged with timestamp and staff member
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Cancel reservation
**Description:** As a host, I want to cancel reservations so freed tables become available for other guests.

**Acceptance Criteria:**
 [ ] Cancel with reason selection (guest request, no-show, staff action)
- [ ] Cancellation SMS sent to guest
- [ ] Table immediately released in availability calendar
- [ ] Cancellations tracked for reporting and no-show analysis
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Table management setup
**Description:** As a manager, I want to configure tables so the system knows our seating capacity and arrangements.

**Acceptance Criteria:**
- [ ] Add/edit/delete tables with number, capacity (min/max guests), and section
- [ ] Mark tables as active/inactive (for maintenance or private events)
- [ ] Combine tables for large party handling
- [ ] Section assignment (main dining, patio, bar, private room)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Reservation form captures guest name, phone, party size (1-20+), date, time, and special requests
- FR-2: Phone validation requires 10+ digits for SMS capability
- FR-3: Availability calendar shows 7-day view with hourly time slots
- FR-4: Table assignments consider party size, table capacity, and section preferences
- FR-5: SMS integration with third-party provider (Twilio or similar)
- FR-6: Confirmation SMS sent within 60 seconds of booking
- FR-7: Reminder SMS sent 24 hours before reservation time
- FR-8: Duplicate detection prevents double-booking same guest within 2-hour window
- FR-9: Reservation status states: confirmed, seated, completed, cancelled, no-show
- FR-10: Table turn time configurable per table (default 90 minutes)
- FR-11: Walk-in guests can be added to current availability view
- FR-12: Guest history shows past visits, preferences, and notes

## Non-Goals

- No online customer self-booking (staff-only entry)
- No payment processing or deposit handling
- No integration with third-party reservation platforms (OpenTable, Resy)
- No waitlist management (covered in separate PRD)
- No table layout visualization or floor plan
- No seasonal/holiday pricing variations

## Technical Considerations

- SMS provider API integration required
- Database schema: reservations, tables, guests, sms_logs tables
- Real-time updates via WebSocket for multi-device synchronization
- Phone number storage in E.164 format for international compatibility
- Rate limiting on SMS to prevent abuse
- Backup notification method (email) if SMS fails

## Success Metrics

- 95% of reservations receive successful SMS confirmation within 60 seconds
- Table utilization rate increases by 15% through better availability management
- No-show rate decreases by 20% with reminder SMS
- Average reservation creation time under 60 seconds for staff
- Zero double-booking incidents after implementation

## Open Questions

- Should we support recurring reservations for regular guests?
- How should we handle same-day booking cutoffs?
- Do we need integration with caller ID for phone-based bookings?
- Should VIP guests have special handling or priority booking?
