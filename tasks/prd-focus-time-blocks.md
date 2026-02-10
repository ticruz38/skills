# PRD: Focus Time Blocks

## Introduction

Protect deep work time by creating recurring focus blocks that prevent meeting scheduling during designated periods. This feature helps Terry maintain productivity by safeguarding uninterrupted time for complex tasks.

## Goals

- Allow creation of recurring focus time blocks on the calendar
- Automatically block focus time from meeting invitations
- Provide do-not-disturb integration during focus periods
- Track productivity metrics related to protected focus time

## User Stories

### US-001: Create Recurring Focus Blocks
**Description:** As Terry, I want to set up recurring focus time blocks so that I always have protected time for deep work.

**Acceptance Criteria:**
- [ ] Create focus time events with title, duration, and recurrence pattern
- [ ] Support daily, weekly, and custom recurrence options
- [ ] Set focus block priority (can/cannot be overridden by meetings)
- [ ] Choose focus block categories: "Deep Work", "Creative", "Planning", "Learning"
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Auto-Decline Meetings During Focus Time
**Description:** As Terry, I want meeting invitations during focus time to be automatically declined so that my deep work is protected.

**Acceptance Criteria:**
- [ ] Auto-decline calendar invites that overlap with focus blocks
- [ ] Send customizable auto-decline message explaining focus time policy
- [ ] Option to allow urgent/override meetings from specific people
- [ ] Notify user of declined meetings with summary
- [ ] Typecheck/lint passes

### US-003: Do-Not-Disturb Integration
**Description:** As Terry, I want my status to show "Do Not Disturb" during focus time so that colleagues know not to interrupt.

**Acceptance Criteria:**
- [ ] Sync focus time with Slack/Teams status to "Do Not Disturb"
- [ ] Pause notifications on connected platforms during focus blocks
- [ ] Automatically resume normal status after focus time ends
- [ ] Option to allow notifications from specific contacts/channels
- [ ] Typecheck/lint passes

### US-004: Focus Time Analytics
**Description:** As Terry, I want to see analytics on my focus time so that I can optimize my schedule for productivity.

**Acceptance Criteria:**
- [ ] Dashboard showing focus time scheduled vs. actual protected
- [ ] Track interruptions: meetings scheduled over focus time, manual cancellations
- [ ] Calculate focus time compliance percentage
- [ ] Weekly/monthly focus time reports
- [ ] Insights: best days/times for focus based on historical data
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Smart Focus Scheduling
**Description:** As Terry, I want the system to suggest optimal focus time placement so that I can maximize productivity.

**Acceptance Criteria:**
- [ ] Analyze calendar patterns to identify low-interruption periods
- [ ] Suggest focus block placement based on meeting density
- [ ] Recommend focus time adjustments when schedule changes
- [ ] Consider chronotype preferences (morning vs. evening focus)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Focus Time Templates
**Description:** As Terry, I want pre-configured focus time templates so that I can quickly set up different types of deep work sessions.

**Acceptance Criteria:**
- [ ] Template library: "Morning Deep Work" (9-11am), "Afternoon Creative" (2-4pm), etc.
- [ ] Custom template creation with saved settings
- [ ] One-click application of templates to calendar
- [ ] Template sharing with team members
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Create and manage recurring focus time calendar events
- FR-2: Mark focus blocks as "busy" to prevent meeting scheduling
- FR-3: Auto-decline meeting invitations that conflict with focus time
- FR-4: Integrate with communication platforms (Slack, Teams) for DND status
- FR-5: Track focus time metrics: scheduled hours, interrupted hours, compliance rate
- FR-6: Provide focus time analytics dashboard with trends and insights
- FR-7: Support focus time templates for quick setup
- FR-8: Allow override list for urgent meetings during focus time
- FR-9: Send daily/weekly focus time summaries and upcoming focus blocks
- FR-10: Sync focus time across all connected calendar platforms

## Non-Goals

- No website/app blocking during focus time (use dedicated tools like Freedom)
- No time tracking or task completion within focus blocks
- No AI task prioritization for what to work on during focus time
- No automatic focus time rescheduling when meetings are canceled
- No team-wide focus time coordination (individual only)

## Design Considerations

- Focus blocks displayed in distinct colors (deep blue, purple) on calendar
- Minimal UI for focus time setup to encourage adoption
- Notification center for focus time interruptions and summaries
- Analytics dashboard with clean charts and actionable insights
- Integration settings page for connecting Slack/Teams

## Technical Considerations

- Focus events stored as calendar events with "focus_time" category tag
- Webhook integration with Slack/Teams for status updates
- Background job for auto-decline processing
- Privacy: focus time analytics stored locally, not server-side

## Success Metrics

- Users schedule average 10+ hours of focus time per week
- 85% of focus time remains uninterrupted by meetings
- 90% of users report improved productivity after 4 weeks
- Focus time compliance rate above 80%

## Open Questions

- Should focus blocks be visible to teammates or shown as generic "busy"?
- How do we handle recurring meetings that overlap with focus time?
- Should we support "focus time goals" (e.g., 20 hours/week target)?
