# PRD: Waitlist Manager

## Introduction

A digital waitlist system for Sergio's Restaurant that manages walk-in guests when tables are unavailable. The system tracks wait times, sends ETA notifications, monitors table turns, and handles priority seating to optimize guest experience and table turnover.

## Goals

- Eliminate paper waitlists with a digital, centralized system
- Provide accurate wait time estimates based on table turn data
- Keep guests informed via SMS notifications as their table approaches readiness
- Maximize table turnover through efficient seating coordination
- Handle priority seating for VIPs and special occasions

## User Stories

### US-001: Add guest to waitlist
**Description:** As a host, I want to add walk-in guests to the waitlist so they can be seated when a table becomes available.

**Acceptance Criteria:**
- [ ] Capture party size, guest name, phone number, and seating preference
- [ ] Estimated wait time calculated based on current queue and table turns
- [ ] Guest receives SMS confirmation with position in line and estimated wait
- [ ] Visual indicator if guest has dietary restrictions or special needs
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Display active waitlist
**Description:** As a host, I want to see the current waitlist so I can manage guest expectations and seating order.

**Acceptance Criteria:**
- [ ] List shows all waiting parties sorted by arrival time
- [ ] Each entry displays party size, quoted wait time, and time elapsed
- [ ] Visual indicators for priority guests and special occasions
- [ ] Auto-refresh every 30 seconds to reflect current status
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Send ETA notifications
**Description:** As a system, I want to automatically notify guests as their table approaches readiness so they can return to the restaurant.

**Acceptance Criteria:**
- [ ] "Table almost ready" SMS sent when wait time drops below 10 minutes
- [ ] "Table ready" SMS sent when table is actually available
- [ ] Guest can reply to confirm they're returning or cancel
- [ ] SMS history visible in guest's waitlist entry
- [ ] Typecheck/lint passes

### US-004: Seat waitlisted guest
**Description:** As a host, I want to seat a waitlisted guest when their table is ready so the waitlist stays accurate.

**Acceptance Criteria:**
- [ ] Select table from available options matching party size
- [ ] Mark guest as "seated" with timestamp
- [ ] Automatic removal from active waitlist view
- [ ] Table status updated to occupied
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Track table turns
**Description:** As a manager, I want to track table turnover times so I can improve wait time estimates.

**Acceptance Criteria:**
- [ ] Record seated time and departure time for each table
- [ ] Calculate actual dining duration per table/party size
- [ ] Dashboard shows average turn time by table and day part
- [ ] Historical data used to improve wait time predictions
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Handle priority seating
**Description:** As a host, I want to mark certain guests as priority so they receive preferential seating.

**Acceptance Criteria:**
- [ ] Priority levels: VIP, celebration (birthday/anniversary), elderly/disabled, regular
- [ ] Priority guests can be moved up in queue with manager override
- [ ] Priority reason logged for reporting
- [ ] Visual distinction in waitlist view
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-007: Remove from waitlist
**Description:** As a host, I want to remove guests from the waitlist when they leave or cancel.

**Acceptance Criteria:**
- [ ] Remove with reason: seated, cancelled, no-show, left premises
- [ ] Cancellation SMS sent if guest chooses to leave
- [ ] Removal timestamp recorded for analytics
- [ ] Option to add note about guest departure
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Waitlist entry requires party size (1-12+), name, and phone number
- FR-2: Estimated wait time calculated using algorithm: (parties ahead × avg turn time) + buffer
- FR-3: Initial wait time quoted as range (e.g., "20-30 minutes") not exact minutes
- FR-4: SMS confirmation sent immediately with position in queue
- FR-5: Two-stage notifications: 10-minute warning and table-ready alert
- FR-6: Table turn tracking captures seated time, check dropped time, and table cleared time
- FR-7: Priority seating requires manager PIN or role authorization
- FR-8: Waitlist auto-purges entries older than 3 hours
- FR-9: Maximum wait time cap at 90 minutes (advise guests to return later)
- FR-10: Integration with reservation system to show reserved table availability times
- FR-11: No-show timeout: table held for 10 minutes after "ready" notification
- FR-12: Daily waitlist statistics: average wait time, parties served, no-show rate

## Non-Goals

- No customer-facing mobile app or self-check-in kiosk
- No reservation-waitlist hybrid (reservations handled separately)
- No integration with restaurant pager systems
- No external notification channels (push notifications, WhatsApp)
- No loyalty program integration for automatic priority
- No waitlist capacity limits (unlimited queue length)

## Technical Considerations

- WebSocket connection for real-time waitlist updates across devices
- SMS queue system to handle burst notifications
- Algorithm for wait time prediction using historical turn data
- Local storage backup for network outage scenarios
- Conflict resolution if multiple hosts try to seat same table simultaneously

## Success Metrics

- Average quoted wait time accuracy within ±5 minutes (actual vs. quoted)
- 90% of guests receive and acknowledge SMS notifications
- Table turnover rate increases by 10% through optimized seating
- Zero lost waitlist entries due to system errors
- Host staff report improved efficiency vs. paper waitlists

## Open Questions

- Should we offer a callback option instead of SMS for guests without texting?
- How should we handle large parties (8+) differently on the waitlist?
- Do we need a "quiet mode" option that doesn't send SMS notifications?
- Should we track weather impact on walk-in volume?
