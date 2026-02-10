---
name: calendar
description: "Google Calendar integration for events and availability. Built on top of google-oauth for authentication, with SQLite caching, free/busy queries, and full Calendar API capabilities."
version: 1.0.0
author: OpenClaw
entry: ./dist/cli.js
type: script
---

# Calendar Skill

Google Calendar integration for managing events and checking availability through your agent. Built on top of the google-oauth skill for secure authentication.

## Features

- **List Events**: Browse events with time filters and pagination
- **Create & Update**: Add and modify events with attendees
- **Free Time Finder**: Find available time slots across calendars
- **Recurring Events**: Support for recurring event patterns
- **Multiple Calendars**: Work with any calendar in your account
- **Today & Upcoming**: Quick access to relevant events
- **SQLite Cache**: Local metadata caching for performance

## Installation

```bash
npm install
npm run build
```

## Prerequisites

The calendar skill requires Calendar authorization through the google-oauth skill:

```bash
# Connect your Google account with Calendar scope
node ../google-oauth/dist/cli.js connect default calendar
```

## CLI Usage

### Check Status

```bash
# Check connection status
node dist/cli.js status
```

### Health Check

```bash
node dist/cli.js health
```

### List Calendars

```bash
node dist/cli.js calendars
```

### List Events

```bash
# List events for next 7 days
node dist/cli.js list

# List more events
node dist/cli.js list --max 50 --days 14

# Search events
node dist/cli.js list --query "meeting"

# Specific calendar
node dist/cli.js list --calendar work@company.com
```

### Today's Events

```bash
node dist/cli.js today

# Specific calendar
node dist/cli.js today --calendar work@company.com
```

### Upcoming Events

```bash
# Next 10 events
node dist/cli.js upcoming

# Next 20 events for next 14 days
node dist/cli.js upcoming --max 20 --days 14
```

### Get Event Details

```bash
node dist/cli.js get <event-id>
```

### Create Event

```bash
# Quick create (1 hour, starting next hour)
node dist/cli.js create --summary "Team Meeting"

# With details
node dist/cli.js create \
  --summary "Project Review" \
  --description "Quarterly project review" \
  --location "Conference Room A" \
  --start "2024-01-15T10:00:00" \
  --duration 90 \
  --attendees "alice@example.com,bob@example.com"

# With end time
node dist/cli.js create \
  --summary "Lunch" \
  --start "2024-01-15T12:00:00" \
  --end "2024-01-15T13:00:00"
```

### Update Event

```bash
# Change title
node dist/cli.js update <event-id> --summary "New Title"

# Change time
node dist/cli.js update <event-id> \
  --start "2024-01-15T14:00:00" \
  --end "2024-01-15T15:00:00"

# Cancel event
node dist/cli.js update <event-id> --status cancelled
```

### Delete Event

```bash
node dist/cli.js delete <event-id>
```

### Find Free Time

```bash
# Find 60-minute slots in next 7 days
node dist/cli.js free

# Find 30-minute slots in next 3 days
node dist/cli.js free --duration 30 --days 3

# Check specific calendars
node dist/cli.js free --calendars "primary,work@company.com"
```

## JavaScript/TypeScript API

### Initialize

```typescript
import { CalendarSkill } from '@openclaw/calendar';

// Create skill for default profile
const calendar = new CalendarSkill();

// Or for specific profile
const workCalendar = CalendarSkill.forProfile('work');
```

### Check Status

```typescript
const status = await calendar.getStatus();
console.log('Connected:', status.connected);
console.log('Email:', status.email);
console.log('Has Calendar:', status.hasCalendarScope);
```

### List Calendars

```typescript
const calendars = await calendar.listCalendars();

for (const cal of calendars) {
  console.log(`${cal.summary}: ${cal.id}`);
  if (cal.primary) {
    console.log('  (Primary calendar)');
  }
}
```

### List Events

```typescript
const result = await calendar.listEvents({
  timeMin: new Date().toISOString(),
  timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  maxResults: 50,
  singleEvents: true,
  orderBy: 'startTime',
});

for (const event of result.events) {
  console.log(`${event.summary}: ${event.start.dateTime}`);
}

// Pagination
const nextPage = await calendar.listEvents({
  pageToken: result.nextPageToken,
  // ... other options
});
```

### Get Single Event

```typescript
const event = await calendar.getEvent('event-id');

console.log('Title:', event.summary);
console.log('Description:', event.description);
console.log('Location:', event.location);
console.log('Start:', event.start.dateTime);
console.log('End:', event.end.dateTime);

// Attendees
for (const attendee of event.attendees || []) {
  console.log(`${attendee.email}: ${attendee.responseStatus}`);
}
```

### Create Event

```typescript
const event = await calendar.createEvent({
  summary: 'Team Meeting',
  description: 'Weekly sync',
  location: 'Conference Room A',
  start: {
    dateTime: '2024-01-15T10:00:00',
    timeZone: 'America/New_York',
  },
  end: {
    dateTime: '2024-01-15T11:00:00',
    timeZone: 'America/New_York',
  },
  attendees: [
    { email: 'alice@example.com' },
    { email: 'bob@example.com', optional: true },
  ],
});

console.log('Created:', event.htmlLink);
```

### Create Recurring Event

```typescript
const event = await calendar.createEvent({
  summary: 'Weekly Standup',
  start: { dateTime: '2024-01-15T09:00:00' },
  end: { dateTime: '2024-01-15T09:30:00' },
  recurrence: [
    {
      frequency: 'WEEKLY',
      byDay: ['MO', 'WE', 'FR'],
      until: '2024-12-31',
    },
  ],
});
```

### Update Event

```typescript
await calendar.updateEvent('event-id', {
  summary: 'Updated Title',
  description: 'New description',
  location: 'New Location',
  start: { dateTime: '2024-01-15T14:00:00' },
  end: { dateTime: '2024-01-15T15:00:00' },
});
```

### Delete Event

```typescript
await calendar.deleteEvent('event-id');
```

### Find Free Time

```typescript
const freeSlots = await calendar.findFreeTime({
  timeMin: new Date().toISOString(),
  timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  duration: 60, // 60 minutes
  calendars: ['primary', 'work@company.com'],
});

for (const slot of freeSlots) {
  console.log(`Free: ${slot.start} - ${slot.end}`);
}
```

### Get Upcoming Events

```typescript
const events = await calendar.getUpcomingEvents({
  maxResults: 10,
  days: 7,
});

for (const event of events) {
  console.log(`${event.summary}: ${event.start.dateTime}`);
}
```

### Get Today's Events

```typescript
const events = await calendar.getTodayEvents();

console.log(`You have ${events.length} events today`);
```

### Health Check

```typescript
const health = await calendar.healthCheck();

if (health.status === 'healthy') {
  console.log('Calendar API is accessible');
} else {
  console.error('Issue:', health.message);
}
```

## Event Types

### All-Day Events

```typescript
// All-day event (no time)
const event = await calendar.createEvent({
  summary: 'Vacation Day',
  start: { date: '2024-01-15' },
  end: { date: '2024-01-16' },  // End date is exclusive
});
```

### Timed Events

```typescript
// Timed event
const event = await calendar.createEvent({
  summary: 'Meeting',
  start: { dateTime: '2024-01-15T10:00:00', timeZone: 'America/New_York' },
  end: { dateTime: '2024-01-15T11:00:00', timeZone: 'America/New_York' },
});
```

## Recurrence Patterns

### Daily

```typescript
recurrence: [{
  frequency: 'DAILY',
  interval: 1,  // Every day
  count: 10,    // For 10 occurrences
}]
```

### Weekly

```typescript
recurrence: [{
  frequency: 'WEEKLY',
  byDay: ['MO', 'WE', 'FR'],  // Monday, Wednesday, Friday
  until: '2024-12-31',        // Until end of year
}]
```

### Monthly

```typescript
recurrence: [{
  frequency: 'MONTHLY',
  byMonthDay: [15],  // 15th of each month
}]
```

## Storage

Cached event metadata is stored in:
```
~/.openclaw/skills/calendar/cache.db
```

Tables:
- `events` - Cached event data
- `calendars` - Calendar list
- `sync_tokens` - Sync state for incremental updates

## Multi-Profile Support

Manage multiple Google accounts:

```typescript
import { CalendarSkill } from '@openclaw/calendar';

// Work account
const work = CalendarSkill.forProfile('work');

// Personal account  
const personal = CalendarSkill.forProfile('personal');

// Use independently
const workEvents = await work.listEvents({ maxResults: 10 });
const personalEvents = await personal.listEvents({ maxResults: 10 });
```

Each profile needs separate authentication:
```bash
node ../google-oauth/dist/cli.js connect work calendar
node ../google-oauth/dist/cli.js connect personal calendar
```

## Error Handling

```typescript
try {
  const events = await calendar.listEvents();
} catch (error) {
  if (error.message.includes('Not connected')) {
    console.log('Please authenticate first');
  } else if (error.message.includes('Calendar scope')) {
    console.log('Re-authenticate with Calendar permissions');
  } else {
    console.error('Error:', error.message);
  }
}
```

## Testing

```bash
# Type checking
npm run typecheck

# Build
npm run build

# Check status
npm run status

# List calendars
npm run cli -- calendars

# List events
npm run cli -- list --max 5

# Find free time
npm run cli -- free --duration 60
```

## Troubleshooting

### "Not connected" error

Authenticate with google-oauth first:
```bash
node ../google-oauth/dist/cli.js connect default calendar
```

### "Calendar scope not authorized"

Your Google account is connected but without Calendar permissions. Reconnect:
```bash
node ../google-oauth/dist/cli.js disconnect default
node ../google-oauth/dist/cli.js connect default calendar
```

### API errors

Check health status:
```bash
node dist/cli.js health
```

## Dependencies

- `@openclaw/google-oauth`: For Calendar authentication
- `@openclaw/auth-provider`: Base authentication (via google-oauth)
- `sqlite3`: Local caching

## Security Notes

- OAuth tokens stored encrypted by auth-provider
- Cache database has 0600 permissions (user read/write only)
- Uses Calendar API with least-privilege scope
- Free/busy queries don't expose event details
