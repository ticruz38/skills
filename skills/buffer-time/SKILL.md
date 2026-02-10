---
title: Buffer Time
skill_id: buffer-time
description: Auto-add buffers between meetings for travel time and preparation
category: productivity
version: 1.0.0
author: OpenClaw
dependencies:
  - calendar
---

# Buffer Time Skill

Automatically add buffer time between calendar meetings for travel, preparation, and decompression.

## Features

- Configurable buffer times between meetings
- Travel time calculation based on location changes
- Prep time blocks before important meetings
- Auto-adjustment of existing meetings
- Skip buffers for back-to-back meetings in same location

## Usage

```typescript
import { BufferTimeSkill } from '@openclaw/buffer-time';

const buffers = new BufferTimeSkill();

// Configure default buffer (15 minutes)
await buffers.setDefaultBuffer(15);

// Add a meeting with buffer
await buffers.scheduleWithBuffer({
  summary: 'Client Meeting',
  start: { dateTime: '2024-01-15T10:00:00' },
  end: { dateTime: '2024-01-15T11:00:00' },
  location: 'Downtown Office',
  bufferMinutes: 30  // Extra buffer for this meeting
});

// Analyze existing meetings for missing buffers
const gaps = await buffers.findMissingBuffers();

// Close connection
await buffers.close();
```

## CLI

```bash
# Status check
npx @openclaw/buffer-time status

# Set default buffer
npx @openclaw/buffer-time set-default 15

# Check existing meetings for buffer gaps
npx @openclaw/buffer-time analyze

# Add buffers to existing meetings
npx @openclaw/buffer-time apply --dry-run
```
