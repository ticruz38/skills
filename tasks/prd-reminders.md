# PRD: Reminders Skill

## Introduction
Follow-up and task reminder skill for the Secretary profile (Terry) that enables setting reminders, managing recurring tasks, and delivering notifications through various channels. This skill ensures important tasks and follow-ups are never missed.

## Goals
- Enable Terry to set one-time and recurring reminders
- Support multiple notification delivery channels
- Allow context-aware reminders (email, meeting, task-based)
- Provide snooze and reschedule functionality

## User Stories

### US-001: Set Reminders
**Description:** As a user, I want Terry to set reminders for me so that I don't forget important tasks or deadlines.

**Acceptance Criteria:**
- [ ] Terry can create reminders with custom messages
- [ ] Terry can set specific date/time for reminders
- [ ] Terry supports natural language time parsing ("in 30 minutes")
- [ ] Typecheck passes

### US-002: Recurring Reminders
**Description:** As a user, I want Terry to set recurring reminders so that regular tasks are automatically tracked.

**Acceptance Criteria:**
- [ ] Terry can set daily, weekly, monthly recurring reminders
- [ ] Terry supports custom recurrence patterns
- [ ] Recurring reminders can be ended or paused
- [ ] Typecheck passes

### US-003: Context-Aware Reminders
**Description:** As a user, I want Terry to set reminders based on context so that follow-ups are timely and relevant.

**Acceptance Criteria:**
- [ ] Terry can set "reply to email" reminders
- [ ] Terry can set "follow up after meeting" reminders
- [ ] Terry can set "task deadline" reminders
- [ ] Typecheck passes

### US-004: Notification Delivery
**Description:** As a user, I want Terry to deliver reminders through my preferred channel so that I receive them promptly.

**Acceptance Criteria:**
- [ ] Terry can send reminders via email
- [ ] Terry can send reminders via Slack
- [ ] Terry can send reminders via system notifications
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Create one-time reminders with specific datetime
- FR-2: Create recurring reminders (daily, weekly, monthly, custom)
- FR-3: Parse natural language time expressions
- FR-4: Link reminders to context (email ID, meeting ID, task ID)
- FR-5: Support multiple notification channels (email, Slack, push)
- FR-6: Allow snoozing reminders for custom durations
- FR-7: Enable rescheduling or editing existing reminders
- FR-8: List all active and completed reminders
- FR-9: Mark reminders as complete or dismiss them
- FR-10: Send reminder notifications at scheduled times

## Non-Goals
- Complex project management with dependencies
- Time tracking or pomodoro timers
- Location-based reminders (geofencing)
- Shared reminders between multiple users
- Smartwatch or IoT device integrations

## Technical Considerations
- **Storage:** Persistent storage for reminder data (SQLite/PostgreSQL)
- **Scheduler:** Background job scheduler (APScheduler, Celery, or cron)
- **Dependencies:** 
  - `dateparser` for natural language date parsing
  - `APScheduler` or `celery` for scheduled task execution
  - `pytz` for timezone handling
- **Notification Channels:** Email (SMTP/API), Slack Web API, OS notification libraries
- **Persistence:** Reminder state must survive service restarts

## Success Metrics
- Reminders triggered within 1 minute of scheduled time
- 99.9% reminder delivery success rate
- Natural language parsing accuracy > 90%
- User can set a reminder in under 10 seconds
