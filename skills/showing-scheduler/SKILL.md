---
title: Showing Scheduler
skill_id: showing-scheduler
description: Real estate property showing scheduler with calendar coordination, lockbox management, client feedback, and route optimization
tags: [real-estate, showings, scheduler, calendar, crm, lockbox]
---

# Showing Scheduler

Schedule and manage property showings for real estate agents. Coordinate with calendar, track client CRM, store lockbox codes securely, collect feedback, and optimize routes for multiple showings.

## Features

- **Showing Scheduling**: Schedule property showings with date, time, and duration
- **Calendar Integration**: Sync showings to Google Calendar automatically
- **Client CRM Integration**: Link showings to clients from CRM
- **Lockbox Management**: Securely store and retrieve lockbox codes
- **Property Tracking**: Track property addresses and details
- **Client Feedback**: Collect and store showing feedback from clients
- **Route Optimization**: Optimize the order of multiple showings for efficiency
- **Showing Status**: Track scheduled, completed, cancelled, no-show statuses
- **Follow-up Reminders**: Automatic reminder scheduling

## Usage

```typescript
import { ShowingScheduler } from '@openclaw/showing-scheduler';

const scheduler = new ShowingScheduler();

// Schedule a showing
const showing = await scheduler.scheduleShowing({
  clientId: 'client-123',
  propertyAddress: '123 Main St, Austin, TX 78701',
  propertyDetails: '4 bed, 3 bath, $650,000',
  scheduledDate: '2024-01-20',
  scheduledTime: '14:00',
  duration: 60, // minutes
  lockboxCode: '4821',
  notes: 'Key under mat if lockbox fails'
});

// Add client feedback after showing
await scheduler.addFeedback(showing.id!, {
  rating: 4,
  interestLevel: 'high',
  comments: 'Loved the kitchen, concerned about traffic noise',
  followUpRequested: true
});

// Optimize route for multiple showings
const optimized = await scheduler.optimizeRoute([
  showing1.id!,
  showing2.id!,
  showing3.id!
]);

// List today's showings
const todayShowings = await scheduler.getTodayShowings();
```

## CLI

```bash
# Schedule a new showing
showing-scheduler schedule --client "John Smith" --address "123 Main St" --date "2024-01-20" --time "14:00"

# With lockbox code
showing-scheduler schedule --client "John Smith" --address "456 Oak Ave" --date "2024-01-20" --time "15:30" --lockbox "4821"

# List showings
showing-scheduler list
showing-scheduler list --today
showing-scheduler list --date "2024-01-20"
showing-scheduler list --client "client-123"

# Get showing details
showing-scheduler get <showing-id>

# Update showing
showing-scheduler update <showing-id> --time "15:00" --notes "Running late"

# Cancel showing
showing-scheduler cancel <showing-id> --reason "Client requested reschedule"

# Complete showing
showing-scheduler complete <showing-id>

# Mark no-show
showing-scheduler no-show <showing-id>

# Add feedback
showing-scheduler feedback <showing-id> --rating 4 --interest high --comments "Loved the kitchen"

# View feedback
showing-scheduler feedback-get <showing-id>

# Route optimization
showing-scheduler route --date "2024-01-20"

# Lockbox management
showing-scheduler lockbox <showing-id>
showing-scheduler lockbox-set <showing-id> --code "4821"

# Upcoming showings
showing-scheduler upcoming

# Stats
showing-scheduler stats
showing-scheduler health
```

## Showing Status

- **scheduled** - Upcoming showing
- **confirmed** - Client confirmed attendance
- **completed** - Showing finished
- **cancelled** - Cancelled by agent or client
- **no_show** - Client didn't arrive
- **rescheduled** - Moved to new time

## Client Interest Levels

- **very_high** - Ready to make offer
- **high** - Strong interest
- **medium** - Considering
- **low** - Not interested
- **none** - Definitely not interested

## Dependencies

- `@openclaw/calendar`: For calendar integration
- `@openclaw/client-crm`: For client data
- `sqlite3`: Local storage
