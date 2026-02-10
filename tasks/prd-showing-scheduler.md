# PRD: Showing Scheduler

## Introduction

Streamline the process of scheduling property showings for Realtor Owen and his clients. The Showing Scheduler coordinates calendar availability, manages lockbox codes, collects client feedback after showings, and optimizes driving routes between properties. This eliminates the back-and-forth of scheduling and ensures efficient, productive showing days.

## Goals

- Enable one-click scheduling of property showings with calendar integration
- Coordinate availability between Owen, clients, and listing agents
- Manage lockbox codes and access instructions securely
- Collect structured feedback from clients after each showing
- Optimize driving routes to minimize travel time between properties

## User Stories

### US-001: Schedule a Showing
**Description:** As Owen, I want to schedule a property showing so that I can coordinate with the client and listing agent.

**Acceptance Criteria:**
- [ ] Select property from saved listings or enter address
- [ ] Pick date and time with calendar picker
- [ ] Select client(s) attending from CRM
- [ ] Check listing agent availability (if integrated)
- [ ] Set showing duration (default 30 min)
- [ ] Add internal notes (parking instructions, gate codes)
- [ ] Send confirmation to client via email/SMS
- [ ] Add to Owen's calendar (Google/Outlook integration)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: View Daily Showing Schedule
**Description:** As Owen, I want to see my daily showing schedule so that I can plan my route and timing.

**Acceptance Criteria:**
- [ ] Day view with showing times and property details
- [ ] Property thumbnail, address, and client name on each card
- [ ] Travel time estimates between properties
- [ ] Status indicators (confirmed, pending, completed, cancelled)
- [ ] One-click to get directions
- [ ] Print-friendly view
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Store Lockbox Codes
**Description:** As Owen, I want to store lockbox codes securely so that I can access properties during showings.

**Acceptance Criteria:**
- [ ] Secure storage for lockbox codes and access instructions
- [ ] Visible only to Owen (encrypted at rest)
- [ ] Quick access from showing details
- [ ] Auto-expire codes after showing date
- [ ] Log of code access for security
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Collect Client Feedback
**Description:** As Owen, I want to collect feedback from clients after each showing so that I can refine our search.

**Acceptance Criteria:**
- [ ] Automated email/SMS request for feedback 1 hour after showing
- [ ] Rating scale (1-5 stars) for overall impression
- [ ] Structured questions: likes, dislikes, deal-breakers
- [ ] Compare to client's stated preferences
- [ ] Owen can add his own notes
- [ ] View all feedback for a property in one place
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Optimize Route
**Description:** As Owen, I want to optimize my route between multiple showings so that I minimize driving time.

**Acceptance Criteria:**
- [ ] Multi-stop route optimization
- [ ] Consider showing time windows as constraints
- [ ] Display route on map with turn-by-turn directions
- [ ] Estimated total driving time and distance
- [ ] Option to manually reorder stops
- [ ] Export route to Google Maps or Apple Maps
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Reschedule or Cancel Showing
**Description:** As Owen, I want to reschedule or cancel a showing so that I can handle changes efficiently.

**Acceptance Criteria:**
- [ ] Edit showing date/time with new availability check
- [ ] Cancel with reason selection (client, weather, property issue)
- [ ] Automatic notification to client and listing agent
- [ ] Reschedule with one-click alternative time suggestions
- [ ] Audit trail of all changes
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Create showings linked to properties and clients from CRM
- FR-2: Date/time picker with duration and buffer time settings
- FR-3: Google Calendar and Outlook calendar integration
- FR-4: Send email/SMS confirmations and reminders to clients
- FR-5: Day, week, and agenda views of showing schedule
- FR-6: Secure encrypted storage for lockbox codes and access info
- FR-7: Auto-expire lockbox codes after showing date
- FR-8: Feedback form with ratings, likes/dislikes, deal-breakers
- FR-9: Route optimization using Google Maps or Mapbox API
- FR-10: Turn-by-turn directions with estimated travel times
- FR-11: Reschedule with conflict detection and notifications
- FR-12: Cancel with reason tracking and automatic notifications
- FR-13: Showing history with feedback and notes per property

## Non-Goals

- No direct integration with MLS lockbox systems (Supra, SentriLock)
- No video/virtual showing scheduling (in-person focus)
- No automated showing feedback to listing agents
- No open house management (private showings only)
- No payment processing for deposits or fees

## Technical Considerations

- Calendar API integration (Google Calendar, Microsoft Graph)
- SMS/Email gateway (Twilio, SendGrid)
- Maps API for routing (Google Maps Directions API, Mapbox)
- Encryption for sensitive lockbox data
- Geolocation for "nearby properties" suggestions
- Offline mode for viewing schedule without connectivity
- Mobile-first design for use while driving between showings

## Success Metrics

- Average time to schedule a showing under 2 minutes
- Route optimization reduces driving time by 20% on multi-property days
- Client feedback collected for 90%+ of showings
- Zero missed showings due to scheduling errors
- Client satisfaction with showing coordination >4.5/5

## Open Questions

- Should we integrate with Supra or SentriLock lockbox systems?
- Do we need a client mobile app for showing confirmations?
- Should we support video/virtual showing scheduling?
- Do we need integration with showing service companies?
