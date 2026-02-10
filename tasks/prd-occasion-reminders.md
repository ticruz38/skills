# PRD: Occasion Reminders

## Introduction
A calendar-based reminder system that helps users remember important gift-giving occasions like birthdays, anniversaries, and holidays. The system provides advance notice and suggested timelines for gift planning.

## Goals
- Ensure users never miss important gift-giving occasions
- Provide advance notice for adequate gift planning time
- Offer gift planning timelines based on occasion importance
- Sync with external calendar systems for convenience
- Reduce last-minute gift shopping stress

## User Stories

### US-001: Add Occasion Reminder
**Description:** As a gift giver, I want to add important occasions with specific dates so that I receive timely reminders.

**Acceptance Criteria:**
- [ ] Users can add occasion with name, date, recipient, and occasion type
- [ ] Occasion types: Birthday, Anniversary, Holiday, Graduation, Custom
- [ ] Recurring option available for annual events
- [ ] Typecheck passes

### US-002: Set Advance Notice Preferences
**Description:** As a gift giver, I want to customize how far in advance I receive reminders so that I have enough time to plan and purchase gifts.

**Acceptance Criteria:**
- [ ] Reminder options: 1 day, 3 days, 1 week, 2 weeks, 1 month before
- [ ] Multiple reminders can be set per occasion
- [ ] Default reminder setting configurable at account level
- [ ] Typecheck passes

### US-003: View Upcoming Occasions
**Description:** As a gift giver, I want to see a timeline of upcoming occasions so that I can plan my gift-giving schedule.

**Acceptance Criteria:**
- [ ] Dashboard shows next 30 days of occasions by default
- [ ] List view and calendar view options available
- [ ] Occasions sorted by date with days remaining indicator
- [ ] Typecheck passes

### US-004: Calendar Sync
**Description:** As a gift giver, I want to sync occasions with my external calendar so that all my reminders are in one place.

**Acceptance Criteria:**
- [ ] Export to Google Calendar, Apple Calendar, Outlook
- [ ] Sync includes occasion name, date, and notes
- [ ] Manual sync button and auto-sync option
- [ ] Typecheck passes

### US-005: Gift Planning Timeline
**Description:** As a gift giver, I want suggested planning timelines for each occasion so that I know when to start shopping.

**Acceptance Criteria:**
- [ ] System suggests start date based on occasion importance
- [ ] Timeline shows: research phase, purchase deadline, wrap/deliver date
- [ ] Visual progress indicator for each planned gift
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Users can create, edit, and delete occasion reminders
- FR-2: System must support multiple reminder times per occasion (e.g., 2 weeks + 3 days before)
- FR-3: Occasions must be viewable in list and calendar formats
- FR-4: System must provide export/sync functionality for popular calendar applications
- FR-5: Gift planning timeline must be calculated based on occasion type and user preferences
- FR-6: System must handle recurring annual occasions (birthdays, anniversaries)
- FR-7: Reminder notifications must be delivered via email and/or in-app
- FR-8: Past occasions must be archived but accessible for reference

## Non-Goals
- No social features (sharing occasions with other users)
- No automated gift purchasing based on reminders
- No SMS/text message reminders (email and in-app only)
- No automatic recipient profile creation from calendar events
- No integration with social media birthday notifications

## Technical Considerations
- Calendar integration via ICS/iCal format for broad compatibility
- Local storage for offline access to occasion data
- Notification system using browser push notifications or email
- Date calculation logic for recurring events and countdown timers
- Timezone handling for accurate reminder delivery

## Success Metrics
- 90% of reminders result in gift purchase or acknowledgment
- Average advance notice period of 7+ days before occasion
- 80% of users set up at least 3 recurring occasions
- Zero missed occasions reported by active users
