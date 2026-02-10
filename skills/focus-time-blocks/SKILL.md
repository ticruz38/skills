---
title: Focus Time Blocks
description: Protect focus time on calendar for deep work
author: OpenClaw
version: 1.0.0
---

# Focus Time Blocks

Protect focus time on your calendar for deep work. This skill helps you create recurring focus blocks, auto-decline meetings during focus time, enable DND mode, and track your productivity analytics.

## Features

- **Recurring Focus Blocks**: Schedule regular deep work sessions
- **Auto-Decline Meetings**: Automatically decline meeting invites during focus time
- **DND Integration**: Mark focus time as "busy" to prevent interruptions
- **Productivity Analytics**: Track completion rates, interruptions, and trends

## Installation

```bash
cd skills/focus-time-blocks
npm install
npm run build
```

## Configuration

No configuration required. The skill stores data in `~/.openclaw/skills/focus-time-blocks/`.

Requires calendar skill to be connected to Google Calendar.

## Usage

### Create a Focus Block

```bash
# Create a morning deep work block (Monday-Friday 9am-11am)
npx focus-time-blocks block-create "Morning Deep Work" \
  --days 1,2,3,4,5 \
  --start 09:00 \
  --end 11:00 \
  --description "Deep work session - no meetings"

# Create a creative session (Tue/Thu 1pm-4pm)
npx focus-time-blocks block-create "Creative Time" \
  --days 2,4 \
  --start 13:00 \
  --end 16:00 \
  --color 6
```

### List Focus Blocks

```bash
# List all blocks
npx focus-time-blocks block-list

# List only active blocks
npx focus-time-blocks block-list --active
```

### Schedule Sessions

```bash
# Schedule focus sessions for next 14 days
npx focus-time-blocks schedule

# Schedule for next 30 days
npx focus-time-blocks schedule 30
```

### View Sessions

```bash
# View upcoming sessions
npx focus-time-blocks sessions

# View today's sessions
npx focus-time-blocks sessions --today
```

### Track Sessions

```bash
# Start a session
npx focus-time-blocks session-start <session-id>

# Complete a session
npx focus-time-blocks session-complete <session-id> --notes "Great progress!"

# Mark as interrupted
npx focus-time-blocks session-interrupt <session-id>
```

### Auto-Decline Rules

```bash
# Add auto-decline rule for meetings with "standup" in title
npx focus-time-blocks decline-add <block-id> \
  --pattern "standup" \
  --message "I'm in focus time, will catch up later"

# List auto-decline rules
npx focus-time-blocks decline-list <block-id>
```

### View Analytics

```bash
# View last 30 days analytics
npx focus-time-blocks analytics

# View last 7 days
npx focus-time-blocks analytics --days 7
```

### Use Templates

```bash
# View available templates
npx focus-time-blocks templates

# Apply a template
npx focus-time-blocks template-apply "Morning Deep Work"
```

## API

```typescript
import { FocusTimeSkill } from '@openclaw/focus-time-blocks';

const skill = new FocusTimeSkill();

// Create focus block
const block = await skill.createFocusBlock({
  name: 'Deep Work',
  durationMinutes: 120,
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '11:00',
  autoDecline: true,
  dndEnabled: true,
  isActive: true,
});

// Schedule sessions
await skill.scheduleFocusBlocks(new Date(), new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));

// Get analytics
const analytics = await skill.getAnalytics(30);
```

## CLI Reference

See `focus-time-blocks help` for full command reference.
