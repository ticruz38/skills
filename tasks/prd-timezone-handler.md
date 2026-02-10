# PRD: Timezone Handler

## Introduction

Automatically handle timezone detection, display, and conversion for seamless multi-timezone scheduling. This feature ensures Terry and meeting participants always see times in their local timezone, eliminating confusion and missed meetings due to timezone errors.

## Goals

- Automatically detect and apply user timezones
- Display times in each participant's local timezone
- Handle timezone conversion for scheduling across regions
- Properly manage daylight saving time (DST) transitions

## User Stories

### US-001: Automatic Timezone Detection
**Description:** As Terry, I want the system to automatically detect my timezone so that I don't have to manually configure it.

**Acceptance Criteria:**
- [ ] Detect timezone from browser/ device settings on first visit
- [ ] Detect timezone from calendar imports (Google, Outlook)
- [ ] Prompt user to confirm detected timezone
- [ ] Auto-update timezone when user travels (optional, with permission)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Timezone Display Preferences
**Description:** As Terry, I want to see my own timezone displayed clearly so that I'm always aware of what time zone is being used.

**Acceptance Criteria:**
- [ ] Display current timezone indicator in UI header
- [ ] Show timezone abbreviation (PST, EST, GMT+1) alongside times
- [ ] Quick timezone switcher for viewing calendar in different zones
- [ ] Save preferred display format (12h/24h, timezone label style)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Multi-Timezone Meeting Display
**Description:** As Terry, I want to see meeting times in both my timezone and participants' timezones so that I can coordinate across regions.

**Acceptance Criteria:**
- [ ] Display participant timezones on meeting details
- [ ] Show time conversion tooltip on hover (e.g., "2pm PST = 5pm EST")
- [ ] Side-by-side comparison for meetings with 3+ timezones
- [ ] Visual indicator of "next day" for international meetings
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Timezone-Aware Scheduling
**Description:** As Terry, I want to schedule meetings that work across timezones so that all participants can join at reasonable hours.

**Acceptance Criteria:**
- [ ] Show availability grid with timezone overlay
- [ ] Highlight "working hours overlap" across timezones
- [ ] Warn when proposed time is outside typical hours (8am-8pm) for any participant
- [ ] Suggest optimal meeting times considering all participant timezones
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: DST Transition Handling
**Description:** As Terry, I want DST changes handled automatically so that meetings aren't affected by clock changes.

**Acceptance Criteria:**
- [ ] Track DST start/end dates for all supported timezones
- [ ] Adjust recurring meetings during DST transitions
- [ ] Send notifications before DST changes affecting upcoming meetings
- [ ] Handle "ambiguous" hours (fall back) and "skipped" hours (spring forward)
- [ ] Typecheck/lint passes

### US-006: Timezone in Calendar Invites
**Description:** As Terry, I want calendar invites to include proper timezone information so that recipients see correct times regardless of their location.

**Acceptance Criteria:**
- [ ] Generate ICS files with timezone VTIMEZONE components
- [ ] Include timezone info in invite email text
- [ ] Support floating times (no timezone) for all-day events
- [ ] UTC timestamps in calendar feed exports
- [ ] Typecheck/lint passes

### US-007: Timezone Override for Travel
**Description:** As Terry, I want to temporarily view my calendar in a different timezone when traveling so that I can plan while abroad.

**Acceptance Criteria:**
- [ ] Temporary timezone override setting
- [ ] Visual indicator when viewing in non-local timezone
- [ ] Quick revert to local timezone
- [ ] Persist override preference per session
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Detect user timezone from browser, OS, and calendar imports
- FR-2: Store and manage timezone preferences per user
- FR-3: Display times with timezone indicators (abbreviations, offsets)
- FR-4: Convert meeting times to each participant's local timezone
- FR-5: Calculate working hours overlap across multiple timezones
- FR-6: Generate timezone-aware ICS calendar files with VTIMEZONE data
- FR-7: Track and handle DST transitions for all IANA timezones
- FR-8: Warn users of timezone-related conflicts or edge cases
- FR-9: Support temporary timezone override for travel planning
- FR-10: Display multi-timezone comparison views for complex scheduling
- FR-11: Store all meeting times in UTC internally with timezone metadata
- FR-12: Update recurring meeting series correctly across DST boundaries

## Non-Goals

- No historical timezone data (only current rules, not past changes)
- No support for non-standard timezones (only IANA database)
- No automatic meeting rescheduling based on timezone changes
- No flight/travel booking integration for automatic timezone updates
- No "follow the sun" handoff scheduling for global teams

## Design Considerations

- Subtle timezone indicators that don't clutter the UI
- Color coding for timezone overlaps (green=good, yellow=early/late, red=outside hours)
- Inline timezone conversion on hover for quick reference
- Clear visual distinction when viewing in non-local timezone
- DST warning banners before transitions

## Technical Considerations

- Use IANA timezone database (tzdb) for accurate zone information
- Store all times in UTC internally, convert for display
- moment-timezone or date-fns-tz for client-side conversions
- Handle edge cases: ambiguous local times, invalid local times
- Account for timezone definition updates (political changes)

## Success Metrics

- Zero missed meetings due to timezone confusion
- 100% accurate timezone conversion across all supported zones
- DST transitions handled without user intervention
- Average 3-second load time for timezone-aware calendar views

## Open Questions

- Should we support "frequent flyer" mode with multiple home timezones?
- How should we handle timezone changes for existing recurring meetings?
- Should we integrate with travel apps for automatic timezone updates?
