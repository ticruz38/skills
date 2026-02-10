# PRD: Itinerary Builder

## Introduction

Enable travelers to create detailed day-by-day trip itineraries with intuitive drag-and-drop scheduling, time estimates, and automatic travel time calculations between locations. This feature helps users organize their trip activities and optimize their daily schedules.

## Goals

- Provide visual day-by-day itinerary planning interface
- Enable drag-and-drop reordering of activities
- Calculate and display travel time between locations
- Support time estimates for each activity
- Allow exporting and sharing itineraries

## User Stories

### US-001: Create day-by-day itinerary structure
**Description:** As a traveler, I want to create a structured itinerary for each day of my trip so that I can organize my activities.

**Acceptance Criteria:**
- [ ] Add/remove days to itinerary
- [ ] Set date for each day
- [ ] Display day summary with activity count and total duration
- [ ] Duplicate day functionality for similar schedules
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Add activities to itinerary
**Description:** As a traveler, I want to add activities, attractions, and reservations to my itinerary so that I can plan my time.

**Acceptance Criteria:**
- [ ] Search and add activities from database
- [ ] Add custom activities with title, duration, and notes
- [ ] Categorize activities (sightseeing, dining, transit, etc.)
- [ ] Add reservation details (confirmation numbers, booking references)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Drag-and-drop scheduling
**Description:** As a traveler, I want to reorder activities by dragging and dropping so that I can adjust my schedule easily.

**Acceptance Criteria:**
- [ ] Drag to reorder within a day
- [ ] Drag to move between days
- [ ] Visual feedback during drag operation
- [ ] Auto-scroll when dragging near edge of container
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Calculate travel times between locations
**Description:** As a traveler, I want to see travel time between activities so that I can plan realistic schedules.

**Acceptance Criteria:**
- [ ] Auto-calculate walking time between nearby locations
- [ ] Auto-calculate driving/transit time for longer distances
- [ ] Show transport mode options (walk, drive, transit)
- [ ] Display travel time as separate blocks between activities
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Time estimates and scheduling
**Description:** As a traveler, I want to set start times and durations for activities so that I can see my full daily schedule.

**Acceptance Criteria:**
- [ ] Set start time for each activity
- [ ] Set duration (with quick presets: 30min, 1hr, 2hr, custom)
- [ ] Visual timeline view showing schedule by hour
- [ ] Warning for scheduling conflicts or impossible timing
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Create multi-day itineraries with customizable day labels
- FR-2: Add activities from search or create custom entries
- FR-3: Drag-and-drop reordering within and between days
- FR-4: Calculate and display travel time between consecutive activities
- FR-5: Set start times and duration for each activity
- FR-6: Display visual timeline with hour-by-hour view
- FR-7: Detect and warn about scheduling conflicts
- FR-8: Export itinerary as PDF or shareable link
- FR-9: Copy/duplicate activities across days

## Non-Goals

- No real-time navigation or turn-by-turn directions
- No automatic route optimization (traveling salesman)
- No weather-based activity suggestions
- No budget tracking or cost estimates per day
- No collaborative editing (single user only for v1)

## Design Considerations

- Timeline view with vertical hour markers
- Card-based activity blocks with color coding by category
- Mini-map showing activity locations for each day
- Compact list view for quick overview
- Mobile-optimized touch drag-and-drop

## Technical Considerations

- Integrate with mapping API for travel time calculations (Google Maps or Mapbox)
- Use drag-and-drop library (react-beautiful-dnd or @dnd-kit)
- Store itinerary data with day/activity hierarchy
- Debounce travel time calculations to limit API calls
- Optimistic UI updates for drag operations

## Success Metrics

- Average itinerary creation time: under 15 minutes
- 80% of users create itineraries with 3+ days
- Drag-and-drop usage rate: 90%+
- Export/share rate: 40%+

## Open Questions

- Should we suggest optimal routes between activities?
- Do we need offline access to itineraries?
- Should we integrate with calendar apps (Google Calendar, iCal)?
