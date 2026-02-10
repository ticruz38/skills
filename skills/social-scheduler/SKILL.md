---
title: Social Scheduler
description: Schedule posts to social platforms with queue management and optimal timing
---

# Social Scheduler

Schedule posts to social platforms with queue management, optimal timing suggestions, and draft approval workflow.

## Features

- **Queue Management**: Manage a queue of scheduled posts
- **Optimal Timing Suggestions**: Get AI-recommended best times to post
- **Multi-Platform Support**: Support for Twitter/X, LinkedIn, Facebook, Instagram, YouTube
- **Draft Approval Workflow**: Draft posts can be approved before scheduling
- **SQLite Storage**: Local database for post management

## Usage

```typescript
import { SocialSchedulerSkill } from '@openclaw/social-scheduler';

const scheduler = new SocialSchedulerSkill();

// Queue a post for scheduling
const post = await scheduler.queuePost({
  content: 'Hello world!',
  platform: 'twitter',
  scheduledAt: new Date('2026-02-15T09:00:00'),
  requiresApproval: true
});

// Approve a draft post
await scheduler.approvePost(post.id);

// Get optimal posting times
const optimalTimes = scheduler.getOptimalTimes('twitter');
```

## CLI Usage

```bash
# Queue a new post
npm run cli -- queue "Hello world!" --platform twitter --when "tomorrow 9am"

# List queued posts
npm run cli -- list

# Approve a draft post
npm run cli -- approve <post-id>

# Get optimal times for a platform
npm run cli -- optimal-times twitter

# Publish due posts
npm run cli -- publish-due
```
