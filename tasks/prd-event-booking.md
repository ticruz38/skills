# PRD: Event Booking

## Introduction

A private dining and event management system for Sergio's Restaurant that handles event inquiries, package pricing, availability checking, deposit management, and coordination for special occasions like corporate dinners, wedding receptions, and birthday celebrations.

## Goals

- Streamline the private event inquiry and booking process
- Provide clear package pricing and availability information
- Secure event deposits to reduce last-minute cancellations
- Coordinate event details between guests, kitchen, and service staff
- Track event revenue and occupancy for business planning

## User Stories

### US-001: Submit event inquiry
**Description:** As a potential client, I want to submit an event inquiry so I can check availability and receive pricing for my event.

**Acceptance Criteria:**
- [ ] Form captures event type, date, time, guest count, budget range, and contact info
- [ ] Event types: Corporate Dinner, Wedding Reception, Birthday Party, Anniversary, Other
- [ ] Auto-response email sent confirming inquiry receipt with response time expectation
- [ ] Inquiry logged in dashboard with unique tracking number
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Manage event packages
**Description:** As a manager, I want to create and manage event packages so clients have clear pricing options.

**Acceptance Criteria:**
- [ ] Package structure: name, description, price per person, minimum guests, inclusions
- [ ] Inclusions: menu items, beverages, room rental, service charge, tax
- [ ] Set packages as active/inactive by season
- [ ] Add-on options: open bar, upgraded wine, dessert station, AV equipment
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Check event availability
**Description:** As an event coordinator, I want to check availability for event dates so I can respond to inquiries quickly.

**Acceptance Criteria:**
- [ ] Calendar view showing booked, tentative, and available dates
- [ ] Filter by room/space (private dining room, patio, full buyout)
- [ ] Conflict detection with existing reservations
- [ ] Hold tentative dates for 7 days pending deposit
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Send event proposal
**Description:** As an event coordinator, I want to send professional proposals to clients so they can review and approve event details.

**Acceptance Criteria:**
- [ ] Generate PDF proposal with menu, pricing, terms, and contract
- [ ] Include venue photos and layout diagrams
- [ ] Digital signature capability for contract execution
- [ ] Expiration date on proposals (14 days default)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Collect event deposit
**Description:** As a manager, I want to collect deposits for events so we secure the booking and reduce cancellations.

**Acceptance Criteria:**
- [ ] Deposit percentage configurable (default: 25% of estimated total)
- [ ] Payment link sent via email with secure payment processing
- [ ] Deposit recorded and tied to event booking
- [ ] Automatic invoice generation for deposit and balance
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Track event details
**Description:** As an event coordinator, I want to track all event details so nothing is missed on the day of the event.

**Acceptance Criteria:**
- [ ] Event checklist: menu finalized, dietary restrictions, floral, cake, timeline
- [ ] Guest list with dietary restrictions and seating preferences
- [ ] Timeline builder: arrival, cocktail hour, seating, courses, speeches
- [ ] Staff assignment notes (server count, bartender, coordinator)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-007: Event day coordination
**Description:** As a coordinator, I want an event day view so I can manage multiple events and timelines.

**Acceptance Criteria:**
- [ ] Day view showing all events with start/end times and rooms
- [ ] Quick access to event details, contact info, and special notes
- [ ] Checklist completion status visible
- [ ] Post-event notes section for feedback and lessons learned
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-008: Event reporting
**Description:** As a manager, I want event reports so I can analyze private dining revenue and trends.

**Acceptance Criteria:**
- [ ] Monthly/annual event revenue reports
- [ ] Event type breakdown (corporate vs. social)
- [ ] Room utilization rates
- [ ] Average guest count and revenue per event
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Event inquiry form fields: name, email, phone, event type, date, time, guest count, budget, notes
- FR-2: Inquiry status workflow: New → Contacted → Proposal Sent → Deposit Pending → Confirmed → Completed
- FR-3: Minimum guest counts enforced per room (private dining: 8, patio: 20, full buyout: 80)
- FR-4: Deposit collection via Stripe or similar payment processor
- FR-5: Proposal PDF generation with customizable templates
- FR-6: Contract terms and conditions included in proposal
- FR-7: Cancellation policy: full refund >30 days, 50% refund 14-30 days, no refund <14 days
- FR-8: Final guest count due 72 hours before event
- FR-9: Menu tasting appointments can be scheduled through system
- FR-10: Vendor coordination notes (florist, DJ, photographer)
- FR-11: Auto-send reminder emails: 30 days, 7 days, 24 hours before event
- FR-12: Event calendar sync to Google/Outlook for coordinator schedules

## Non-Goals

- No online self-booking (all events require coordinator consultation)
- No wedding planning services beyond catering coordination
- No third-party vendor marketplace or recommendations
- No room layout drag-and-drop designer
- No virtual tour or 3D room visualization
- No guest RSVP management (handled separately by client)

## Technical Considerations

- Payment processing integration (Stripe/PayPal) for deposits
- PDF generation library for proposals and contracts
- Digital signature integration (DocuSign or similar)
- Email template system for automated communications
- Calendar integration for availability and coordinator scheduling

## Success Metrics

- Event inquiry response time under 4 business hours
- 40% of inquiries convert to booked events
- Deposit collection rate: 95% of confirmed bookings
- Cancellation rate below 10% with deposit policy
- Average event revenue increases 15% through upsell add-ons

## Open Questions

- Should we offer different deposit percentages for different event types?
- Do we need to track competitor venue pricing for benchmarking?
- Should we implement a referral program for past event clients?
- How should we handle holiday/weekend pricing premiums?
