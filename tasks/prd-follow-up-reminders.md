# PRD: Follow-Up Reminders

## Introduction
A proactive reminder system that tracks sent emails awaiting responses, schedules intelligent follow-up reminders, and provides snooze functionality to ensure important conversations don't fall through the cracks.

## Goals
- Track sent emails that require responses
- Automatically schedule and send follow-up reminders
- Provide flexible snooze options for reminder timing
- Surface conversations at risk of being forgotten

## User Stories

### US-001: Sent Email Tracking
**Description:** As someone managing email, I want sent emails requiring responses to be automatically tracked so that I know which conversations are awaiting replies.

**Acceptance Criteria:**
- [ ] System identifies emails likely to need responses based on content (questions, requests, etc.)
- [ ] Users can manually mark any sent email for follow-up tracking
- [ ] Tracked emails are organized in a "Waiting for Response" view
- [ ] Typecheck passes

### US-002: Reminder Scheduling
**Description:** As someone managing email, I want automatic reminders when responses are overdue so that I can follow up on important conversations.

**Acceptance Criteria:**
- [ ] System suggests reminder timing based on email urgency and content
- [ ] Default reminders: 2 days for normal emails, 24 hours for urgent
- [ ] Users can customize reminder timing per email or globally
- [ ] Typecheck passes

### US-003: Snooze Functionality
**Description:** As someone managing email, I want to snooze reminders so that I can be reminded at a more convenient time.

**Acceptance Criteria:**
- [ ] Quick snooze options: Later today, Tomorrow, Next week, Custom date
- [ ] Snoozed reminders return to active tracking at scheduled time
- [ ] Users can view and manage all snoozed items
- [ ] Typecheck passes

### US-004: Follow-Up Draft Suggestions
**Description:** As someone managing email, I want suggested follow-up messages so that I can quickly send polite reminders without composing from scratch.

**Acceptance Criteria:**
- [ ] System generates polite follow-up draft options
- [ ] Drafts reference the original email and time elapsed
- [ ] Tone options: Gentle reminder, Urgent follow-up, Friendly check-in
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Automatic detection of emails requiring responses
- FR-2: Sent email tracking with "Waiting for Response" status
- FR-3: Intelligent reminder scheduling with customization options
- FR-4: Snooze functionality with preset and custom timing
- FR-5: AI-generated follow-up draft suggestions
- FR-6: Integration with calendar for reminder timing
- FR-7: Integration with Gmail and Outlook sent folders

## Non-Goals
- Automatic sending of follow-up emails
- Response rate tracking for external analytics
- Integration with CRM systems
- Email open tracking or read receipts

## Technical Considerations
- Gmail API for sent mail access and threading
- Microsoft Graph API for Outlook sent items
- LLM integration for response detection and draft generation
- Background job scheduler for reminder delivery
- Notification system (in-app, email, or push)
- User preference storage for default reminder settings

## Success Metrics
- 90% of important sent emails tracked for follow-up
- Reminder delivery accuracy: 95% on scheduled time
- 60% of reminders result in user follow-up action
- Average response time improved by 30%
- 50% reduction in "forgot to follow up" incidents
