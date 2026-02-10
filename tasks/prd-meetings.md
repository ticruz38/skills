# PRD: Meetings Skill

## Introduction
Meeting scheduling and preparation skill for the Secretary profile (Terry) that enables finding optimal meeting times, sending invitations, and preparing agendas. This skill complements the existing calendar skill by focusing on the meeting lifecycle from scheduling to follow-up.

## Goals
- Enable Terry to schedule meetings with multiple participants
- Find available time slots across calendars
- Send and manage meeting invitations
- Generate meeting agendas automatically

## User Stories

### US-001: Schedule Meetings
**Description:** As a user, I want Terry to schedule meetings so that I don't have to coordinate availability manually.

**Acceptance Criteria:**
- [ ] Terry can create calendar events with title, time, and location
- [ ] Terry can add participants to meetings
- [ ] Terry can set meeting duration and buffer time
- [ ] Typecheck passes

### US-002: Find Available Slots
**Description:** As a user, I want Terry to find available time slots across multiple calendars so that scheduling is efficient.

**Acceptance Criteria:**
- [ ] Terry can check availability for all participants
- [ ] Terry can suggest multiple time options
- [ ] Terry respects timezone differences
- [ ] Typecheck passes

### US-003: Send Invitations
**Description:** As a user, I want Terry to send meeting invitations so that participants receive proper calendar invites.

**Acceptance Criteria:**
- [ ] Terry can send calendar invitations via email
- [ ] Invitations include meeting details and video links
- [ ] Terry can track RSVP status
- [ ] Typecheck passes

### US-004: Meeting Agendas
**Description:** As a user, I want Terry to prepare meeting agendas so that meetings are productive and focused.

**Acceptance Criteria:**
- [ ] Terry can generate agendas from meeting context
- [ ] Agendas include time allocations per topic
- [ ] Agendas can be shared with participants
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Create calendar events via Google Calendar and Outlook APIs
- FR-2: Query free/busy time for multiple participants
- FR-3: Find common available time slots within constraints
- FR-4: Send calendar invitations with proper ICS attachments
- FR-5: Support recurring meetings configuration
- FR-6: Generate meeting agendas from templates and context
- FR-7: Integrate with video conferencing (Zoom, Google Meet, Teams)
- FR-8: Track invitation responses (accepted/declined/tentative)
- FR-9: Reschedule meetings and notify participants
- FR-10: Send meeting reminders before start time

## Non-Goals
- In-meeting features (recording, transcription, note-taking)
- Conference room booking and resource management
- Meeting analytics and productivity scoring
- AI-generated meeting summaries (separate skill)
- Virtual background or video settings

## Technical Considerations
- **Authentication:** OAuth2 for Google Calendar and Microsoft Graph
- **Dependencies:** 
  - `google-api-python-client` for Google Calendar
  - `msal` and `requests` for Microsoft Graph
  - `pytz` for timezone handling
- **APIs:** Google Calendar API, Microsoft Graph Calendar API
- **Integrations:** Zoom API, Google Meet (auto-generated), Microsoft Teams
- **Rate Limits:** Google Calendar: 1,000,000,000 quota units per day, Microsoft Graph: 10,000 requests per 10 minutes

## Success Metrics
- Meeting scheduled within 30 seconds of request
- Available slot suggestions provided within 5 seconds
- 95% successful invitation delivery rate
- Agenda generated within 10 seconds
