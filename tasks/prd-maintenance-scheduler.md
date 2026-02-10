# PRD: Maintenance Scheduler

## Introduction

A recurring maintenance scheduling system for Hank the Home Handyman to manage seasonal tasks, filter changes, inspections, and custom maintenance schedules. This feature ensures home maintenance tasks are never forgotten by providing timely reminders and a clear overview of upcoming and overdue maintenance.

## Goals

- Allow Hank to create and manage recurring maintenance schedules for his home
- Provide timely notifications for upcoming and overdue maintenance tasks
- Support seasonal, monthly, weekly, and custom recurrence patterns
- Enable filtering and sorting of maintenance tasks by type, priority, and due date
- Track completion history for maintenance records

## User Stories

### US-001: Create maintenance task
**Description:** As Hank, I want to create a maintenance task with a schedule so that I don't forget important home upkeep.

**Acceptance Criteria:**
- [ ] Form to create maintenance task with: title, description, recurrence pattern, start date
- [ ] Recurrence options: daily, weekly, monthly, seasonal (quarterly), yearly, custom
- [ ] Optional fields: priority level, estimated duration, notes
- [ ] Task saves to database and appears on dashboard
- [ ] Typecheck/lint passes

### US-002: View maintenance dashboard
**Description:** As Hank, I want to see all my maintenance tasks in one place so I can plan my work.

**Acceptance Criteria:**
- [ ] Dashboard shows upcoming tasks (next 30 days)
- [ ] Visual indicators for overdue (red), due soon (yellow), upcoming (green)
- [ ] Filter by: all, overdue, upcoming, completed
- [ ] Sort by due date, priority, or task type
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Mark task as complete
**Description:** As Hank, I want to mark a maintenance task as complete so I can track what's been done.

**Acceptance Criteria:**
- [ ] One-click "Complete" button on each task
- [ ] Confirmation dialog before marking complete
- [ ] Option to add completion notes
- [ ] Next occurrence automatically scheduled based on recurrence pattern
- [ ] Completion history stored and viewable
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Seasonal task templates
**Description:** As Hank, I want pre-built seasonal maintenance checklists so I don't have to create common tasks from scratch.

**Acceptance Criteria:**
- [ ] Templates for: Spring, Summer, Fall, Winter maintenance
- [ ] Each template includes 8-12 common seasonal tasks
- [ ] One-click import of template with all tasks
- [ ] Tasks can be edited or deleted after import
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Maintenance notifications
**Description:** As Hank, I want to receive reminders when maintenance is due so I don't miss important tasks.

**Acceptance Criteria:**
- [ ] Email/push notification 7 days before due date
- [ ] Follow-up notification on due date
- [ ] Notification preferences configurable per task
- [ ] Notification history viewable
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Database schema for maintenance tasks with fields: id, title, description, recurrence_pattern, start_date, next_due_date, priority, estimated_duration, status, completion_history
- FR-2: Recurrence patterns supported: daily, weekly, monthly, quarterly (seasonal), yearly, custom (X days/weeks/months)
- FR-3: Dashboard displays tasks with visual status indicators
- FR-4: Filtering by: status (pending/overdue/completed), priority, category, date range
- FR-5: Completion of a task automatically schedules the next occurrence
- FR-6: Pre-built templates for seasonal maintenance (Spring, Summer, Fall, Winter)
- FR-7: Notification system with configurable lead times
- FR-8: Task history tracking with completion dates and notes

## Non-Goals

- No integration with smart home devices or IoT sensors
- No automatic weather-based schedule adjustments
- No contractor/vendor dispatch integration
- No cost tracking or budgeting features
- No photo/documentation upload for completed tasks

## Technical Considerations

- Use cron-like scheduling logic for recurrence calculation
- Store next_due_date denormalized for efficient querying
- Consider timezone handling for notification delivery
- Pagination for task history (limit 50 per page)

## Success Metrics

- 100% of created tasks have valid recurrence patterns
- Dashboard loads within 2 seconds with 100+ tasks
- Notifications delivered within 1 hour of scheduled time
- Users can create a task in under 60 seconds

## Open Questions

- Should tasks support sub-tasks/checklists?
- Should we support multiple properties/homes per user?
- Should there be a "snooze" option for notifications?
