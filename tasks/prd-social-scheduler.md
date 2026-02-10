# PRD: Social Scheduler

## Introduction
A skill that schedules posts to LinkedIn, Twitter/X, and other social platforms. Casey needs to maintain a consistent posting schedule across multiple channels without manually publishing each post in real-time.

## Goals
- Schedule posts across multiple social platforms from a single interface
- Manage a content queue with drag-and-drop reordering
- Optimize posting times based on audience activity
- Support multi-platform posting with platform-specific formatting
- Ensure all scheduling operations pass type checking

## User Stories

### US-001: Multi-Platform Scheduling
**Description:** As a content creator, I want to schedule the same post across multiple platforms with platform-specific formatting so that I can maximize reach efficiently.

**Acceptance Criteria:**
- [ ] Schedule posts to LinkedIn, Twitter/X, and Instagram
- [ ] Auto-format content for each platform's requirements
- [ ] Preview how posts will appear on each platform
- [ ] Select which platforms to publish to per post
- [ ] Typecheck passes

### US-002: Queue Management
**Description:** As a content creator, I want to manage my content queue visually so that I can organize my posting calendar easily.

**Acceptance Criteria:**
- [ ] View scheduled posts in calendar and list views
- [ ] Drag and drop to reschedule posts
- [ ] Bulk edit or delete scheduled posts
- [ ] Filter queue by platform, status, or date range
- [ ] Typecheck passes

### US-003: Optimal Timing Suggestions
**Description:** As a content creator, I want the system to suggest optimal posting times so that I can maximize engagement.

**Acceptance Criteria:**
- [ ] Analyze historical post performance by time
- [ ] Suggest best times per platform based on audience activity
- [ ] Allow manual override of suggested times
- [ ] Set default posting windows per platform
- [ ] Typecheck passes

### US-004: Recurring Post Series
**Description:** As a content creator, I want to set up recurring post series so that I can maintain consistent content themes.

**Acceptance Criteria:**
- [ ] Create recurring posts (daily, weekly, monthly)
- [ ] Set end dates or occurrence limits for series
- [ ] Modify individual instances without affecting series
- [ ] Pause and resume recurring series
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Connect and authenticate with LinkedIn, Twitter/X, and Instagram APIs
- FR-2: Schedule posts for specific dates and times
- FR-3: Support media attachments (images, videos) per platform limits
- FR-4: Queue management with calendar, list, and board views
- FR-5: Optimal time recommendations based on historical data
- FR-6: Recurring post scheduling with flexible patterns
- FR-7: Draft saving and editing before scheduling
- FR-8: Post status tracking (scheduled, published, failed)
- FR-9: Failed post retry with notifications
- FR-10: Integration with content-writer skill for seamless content creation to scheduling

## Non-Goals
- Content creation/editing (handled by content-writer skill)
- Social listening or mention monitoring
- Analytics dashboard (beyond basic post status)
- Team collaboration features
- Client approval workflows
- Automated content generation (content must be provided)
- Direct message automation

## Technical Considerations
- **APIs Required:**
  - LinkedIn API (Marketing Developer Platform)
  - Twitter/X API v2 (Elevated access for posting)
  - Instagram Graph API (via Facebook)
- **Authentication:** OAuth 2.0 flow for each platform
- **Scheduling Engine:** Celery/Redis or similar task queue for reliable execution
- **Timezone Handling:** Store all times in UTC, display in user's local timezone
- **Media Storage:** S3 or similar for image/video hosting before posting
- **Rate Limiting:** Respect platform API limits (Twitter: 300 tweets/day, etc.)
- **Webhook Handling:** Receive post status updates from platforms
- **Type Safety:** Strict TypeScript types for all scheduling operations

## Success Metrics
- 95%+ of scheduled posts publish successfully on first attempt
- Users schedule an average of 15+ posts per week
- Optimal timing suggestions increase engagement by 25%+
- Queue management tasks (reschedule, edit) take under 30 seconds
- 90%+ user retention after first month of use
