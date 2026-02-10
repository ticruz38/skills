# PRD: Scheduler Skill

## Introduction
Calendar optimization skill for the Secretary profile (Terry) that optimizes schedules, manages focus blocks, adds buffer time, and generates scheduling links. This skill complements the existing calendar skill by focusing on schedule optimization rather than basic calendar operations.

## Goals
- Enable Terry to optimize existing schedules for productivity
- Automatically add buffer time between meetings
- Create and protect focus time blocks
- Generate scheduling links for external parties

## User Stories

### US-001: Schedule Optimization
**Description:** As a user, I want Terry to optimize my schedule so that I have a more productive workday.

**Acceptance Criteria:**
- [ ] Terry can analyze existing calendar for conflicts and gaps
- [ ] Terry can suggest schedule improvements
- [ ] Terry can batch similar meetings together
- [ ] Typecheck passes

### US-002: Buffer Time Management
**Description:** As a user, I want Terry to automatically add buffer time between meetings so that I have breaks and travel time.

**Acceptance Criteria:**
- [ ] Terry can detect back-to-back meetings
- [ ] Terry can suggest or auto-add buffer time between meetings
- [ ] Buffer duration is configurable per meeting type
- [ ] Typecheck passes

### US-003: Focus Blocks
**Description:** As a user, I want Terry to create and protect focus time blocks so that I have uninterrupted work time.

**Acceptance Criteria:**
- [ ] Terry can schedule recurring focus blocks
- [ ] Terry can protect focus blocks from meeting invites
- [ ] Focus blocks respect user preferences for time of day
- [ ] Typecheck passes

### US-004: Scheduling Links
**Description:** As a user, I want Terry to generate scheduling links so that others can book time with me easily.

**Acceptance Criteria:**
- [ ] Terry can generate shareable booking links
- [ ] Links respect availability and preferences
- [ ] Bookings through links auto-add to calendar
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Analyze calendar for meeting density and gaps
- FR-2: Suggest optimal meeting times based on energy levels
- FR-3: Automatically insert buffer time between meetings
- FR-4: Create recurring focus time blocks
- FR-5: Mark focus blocks as "busy" to prevent conflicts
- FR-6: Generate scheduling links with availability rules
- FR-7: Configure scheduling link parameters (duration, buffer, advance notice)
- FR-8: Batch similar meeting types together (1:1s, standups, etc.)
- FR-9: Suggest meeting consolidation opportunities
- FR-10: Apply user-defined scheduling rules and preferences

## Non-Goals
- Basic calendar CRUD operations (handled by calendar skill)
- Meeting scheduling with multiple parties (handled by meetings skill)
- AI-generated agenda creation (handled by meetings skill)
- Automatic meeting rescheduling without user approval
- External calendar sync (assumed handled by calendar skill)

## Technical Considerations
- **Dependencies:** 
  - Integration with existing calendar skill for read/write
  - `calcom` or similar for scheduling links, or custom implementation
  - Calendar analysis algorithms for optimization suggestions
- **APIs:** Google Calendar API, Microsoft Graph API (via calendar skill)
- **Configuration:** User preferences for focus times, buffer durations, working hours
- **Scheduling Link Options:** Cal.com API, Savvycal, or custom booking page

## Success Metrics
- Schedule optimization suggestions generated within 5 seconds
- 100% success rate for scheduling link generation
- Focus block conflicts reduced by 80%
- Average buffer time between meetings increases by 10 minutes
