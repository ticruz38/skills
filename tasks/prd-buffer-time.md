# PRD: Buffer Time

## Introduction

Automatically add configurable buffer time between meetings to account for travel, preparation, and mental transitions. This feature helps Terry protect their schedule from back-to-back meetings that lead to burnout and rushed transitions.

## Goals

- Automatically insert buffer time between meetings based on configurable rules
- Support different buffer types: travel time, prep time, and recovery time
- Allow per-meeting and global buffer configuration
- Provide automatic schedule adjustment when buffers are added or modified

## User Stories

### US-001: Configure Global Buffer Defaults
**Description:** As Terry, I want to set default buffer times so that all my meetings automatically have appropriate spacing.

**Acceptance Criteria:**
- [ ] Settings page with buffer configuration options
- [ ] Set default buffer duration (5, 10, 15, 30 minutes, custom)
- [ ] Configure buffer rules by meeting type (internal, external, 1:1, group)
- [ ] Enable/disable buffers globally
- [ ] Save preferences to user profile
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Auto-Add Buffers on Meeting Creation
**Description:** As Terry, I want buffers to be automatically added when I create meetings so that I don't have to manually block time.

**Acceptance Criteria:**
- [ ] Detect meeting creation and apply buffer rules automatically
- [ ] Insert buffer events before and/or after meetings based on configuration
- [ ] Buffer events appear as "busy" blocks on calendar
- [ ] Buffer titles indicate purpose (e.g., "Travel: Client Meeting", "Prep: Presentation")
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Travel Time Buffer
**Description:** As Terry, I want travel time automatically calculated for in-person meetings so that I don't get overbooked during transit.

**Acceptance Criteria:**
- [ ] Detect meeting location (physical address vs. video call)
- [ ] Calculate travel time based on meeting location and current location
- [ ] Integrate with maps API for realistic travel estimates
- [ ] Add travel buffer before and/or after physical meetings
- [ ] Allow manual override of calculated travel time
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Prep Time Buffer
**Description:** As Terry, I want prep time blocked before important meetings so that I can review agendas and materials.

**Acceptance Criteria:**
- [ ] Mark meetings as requiring prep time in meeting details
- [ ] Automatically block prep buffer before designated meetings
- [ ] Configurable prep duration per meeting or meeting type
- [ ] Prep blocks include meeting title reference for context
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Buffer Collision Handling
**Description:** As Terry, I want the system to handle buffer overlaps intelligently so that my calendar doesn't get cluttered.

**Acceptance Criteria:**
- [ ] Merge adjacent buffers instead of creating duplicate blocks
- [ ] Prioritize longer buffer when conflicts occur
- [ ] Option to truncate buffers if scheduling constraints require it
- [ ] Visual indicator when buffers have been adjusted
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Automatic Buffer Adjustment
**Description:** As Terry, I want buffers to adjust automatically when meetings are moved or canceled so that my calendar stays organized.

**Acceptance Criteria:**
- [ ] Delete/move associated buffers when meetings are rescheduled
- [ ] Recalculate buffers when meeting duration changes
- [ ] Remove orphaned buffer blocks when meetings are canceled
- [ ] Preserve manually modified buffers (don't auto-delete)
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Store global buffer configuration: default duration, position (before/after/both), meeting type rules
- FR-2: Automatically create buffer calendar events when meetings are scheduled
- FR-3: Calculate travel time using location data and mapping APIs
- FR-4: Support per-meeting buffer overrides (duration, enabled/disabled)
- FR-5: Merge adjacent buffers to prevent calendar clutter
- FR-6: Update or delete buffers when associated meetings change
- FR-7: Distinguish buffer blocks visually from regular meetings
- FR-8: Allow buffer templates: "Light" (5 min), "Standard" (15 min), "Deep" (30 min)
- FR-9: Support "no-buffer" meeting types (quick syncs, standups)
- FR-10: Provide buffer analytics: average buffer time per day, buffer compliance rate

## Non-Goals

- No AI prediction of meeting importance for automatic buffer sizing
- No integration with transportation apps for real-time traffic updates
- No automatic meeting rescheduling to accommodate buffers
- No support for shared/collective buffers across team calendars
- No buffer "borrowing" from low-priority meetings

## Design Considerations

- Buffer blocks shown in muted colors (gray, light patterns) to distinguish from meetings
- Buffer duration visible on calendar without cluttering view
- Quick-toggle to show/hide buffer blocks
- Settings UI with intuitive duration sliders
- Visual distinction between travel, prep, and recovery buffers

## Technical Considerations

- Buffer events stored as regular calendar events with metadata tags
- Background job for buffer synchronization when meetings change
- Location data privacy: only process addresses when travel buffers enabled
- Performance: batch buffer updates for bulk meeting changes

## Success Metrics

- 100% of meetings have appropriate buffers applied automatically
- Zero back-to-back meetings without intentional override
- Average 15 minutes of buffer time per meeting
- 95% user satisfaction with buffer configuration flexibility

## Open Questions

- Should buffers be visible to other calendar viewers or marked as private?
- How should we handle recurring meetings with varying locations?
- Should we support "recovery time" buffers after intensive meetings?
