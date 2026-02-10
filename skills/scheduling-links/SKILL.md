---
title: Scheduling Links
skill_id: scheduling-links
description: Generate Calendly-style booking links with availability windows and embeddable widgets
tags: [scheduling, booking, calendar, appointments]
provider: openclaw
---

# Scheduling Links

Generate Calendly-style booking links with availability windows and embeddable widgets. Built on top of the calendar skill for automatic event creation.

## Capabilities

- **Meeting Types**: Define different meeting types with custom durations (15, 30, 45, 60 min, etc.)
- **Availability Windows**: Set custom availability per meeting type (days of week, time ranges)
- **Booking Links**: Create shareable booking links with customizable settings
- **Embeddable Widgets**: Generate HTML iframe code for website integration
- **Buffer Times**: Add buffer minutes before and after appointments
- **Booking Constraints**: Configure min/max advance booking times
- **Calendar Integration**: Automatically create calendar events when bookings are made
- **Booking Management**: Track, cancel, and mark no-shows for appointments

## Installation

```bash
cd skills/scheduling-links
npm install
npm run build
```

## CLI Usage

### Meeting Types

Create a meeting type:
```bash
npm run cli -- type-create consult "Consultation Call" 30 --desc "Initial consultation" --color "#4285f4"
```

List meeting types:
```bash
npm run cli -- type-list
npm run cli -- type-list --all  # Include inactive
```

Get meeting type details:
```bash
npm run cli -- type-get consult
```

Update meeting type:
```bash
npm run cli -- type-update consult --name "Updated Name" --duration 45
```

Enable/disable/delete:
```bash
npm run cli -- type-disable consult
npm run cli -- type-enable consult
npm run cli -- type-delete consult
```

### Availability Windows

Show current availability:
```bash
npm run cli -- availability consult
```

Set availability (format: day:start-end, where day is 0=Sun to 6=Sat):
```bash
npm run cli -- set-availability consult "1:09:00-17:00,2:09:00-17:00,3:09:00-17:00,4:09:00-17:00,5:09:00-17:00"
```

### Booking Links

Create a booking link:
```bash
npm run cli -- link-create consult book-consult \
  --title "Book a Consultation" \
  --welcome "Welcome! Please select a time." \
  --buffer-before 5 \
  --buffer-after 5 \
  --max-days 14 \
  --min-hours 2
```

List booking links:
```bash
npm run cli -- link-list
```

Get booking link details:
```bash
npm run cli -- link-get book-consult
```

Generate booking URL:
```bash
npm run cli -- link-url book-consult --base "https://my-site.com"
```

Generate embed widget code:
```bash
npm run cli -- widget book-consult --width "100%" --height "700px" --theme light
```

### Available Slots

Get available slots for a date:
```bash
npm run cli -- slots book-consult 2024-02-15
```

### Bookings

Book an appointment:
```bash
npm run cli -- book book-consult "2024-02-15T10:00:00" "John Doe" "john@example.com" \
  --phone "+1234567890" \
  --notes "Looking forward to our discussion"
```

List bookings:
```bash
npm run cli -- bookings book-consult
npm run cli -- bookings book-consult --status confirmed
```

List upcoming bookings:
```bash
npm run cli -- upcoming
```

Cancel or mark no-show:
```bash
npm run cli -- cancel 1
npm run cli -- no-show 1
```

### System Commands

Health check:
```bash
npm run cli -- status
```

Statistics:
```bash
npm run cli -- stats
```

## Library Usage

```typescript
import { SchedulingLinksSkill } from '@openclaw/scheduling-links';

const skill = new SchedulingLinksSkill();

// Create a meeting type
const meetingType = await skill.createMeetingType({
  slug: 'consult',
  name: 'Consultation Call',
  duration: 30,
  color: '#4285f4'
});

// Set availability (Monday-Friday 9am-5pm)
await skill.setAvailabilityWindows('consult', [
  { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' }
]);

// Create a booking link
const link = await skill.createBookingLink({
  meetingTypeSlug: 'consult',
  slug: 'book-consult',
  title: 'Book a Consultation',
  maxAdvanceDays: 14,
  minAdvanceHours: 2,
  bufferMinutesBefore: 5,
  bufferMinutesAfter: 5
});

// Get available slots for a date
const slots = await skill.getAvailableSlots('book-consult', new Date('2024-02-15'));

// Book an appointment
const booking = await skill.bookAppointment({
  linkSlug: 'book-consult',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  notes: 'Looking forward to our discussion',
  startTime: slots[0].start
});

// Generate embed code
const widgetCode = skill.generateWidgetCode('book-consult', {
  width: '100%',
  height: '700px',
  theme: 'light'
});

await skill.close();
```

## Data Storage

Data is stored in SQLite at `~/.openclaw/skills/scheduling-links/scheduling.db`:

- **meeting_types**: Meeting type definitions
- **availability_windows**: Weekly availability per meeting type
- **booking_links**: Shareable booking links with configuration
- **bookings**: Appointment records with calendar event IDs

## Integration

The skill integrates with the calendar skill to automatically create calendar events when bookings are made. If the calendar skill is not connected, bookings are still stored locally.

## Configuration

### Buffer Times

Add padding before/after appointments to prevent back-to-back bookings:
- `bufferMinutesBefore`: Minutes to block before each appointment
- `bufferMinutesAfter`: Minutes to block after each appointment

### Booking Constraints

Control when people can book:
- `minAdvanceHours`: Minimum hours in advance (e.g., 24 = next-day booking)
- `maxAdvanceDays`: Maximum days in advance (e.g., 30 = up to 1 month ahead)

### Required Fields

Configure what information bookers must provide:
- `requireEmail`: Always required
- `requirePhone`: Optional phone number collection
- `requireNotes`: Optional notes field
