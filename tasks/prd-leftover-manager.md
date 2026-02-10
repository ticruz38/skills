# PRD: Leftover Manager

## Introduction

The Leftover Manager helps users track their leftovers, suggests creative recipes to use them up, sends expiration alerts, and reduces food waste. It turns leftovers from a burden into an opportunity for new meals while promoting sustainable kitchen practices.

## Goals

- Enable easy tracking of leftovers with quantity and storage location
- Suggest recipes that incorporate available leftovers as ingredients
- Send expiration alerts before food goes bad
- Track waste reduction metrics to motivate users
- Provide creative "leftover transformation" ideas
- Support freezer inventory for long-term storage

## User Stories

### US-001: Log new leftovers
**Description:** As a home cook, I want to log my leftovers after a meal so that I can remember to use them before they go bad.

**Acceptance Criteria:**
- [ ] Quick-add form: food name, quantity, storage location (fridge/freezer), date stored
- [ ] Optional: photo upload for visual identification
- [ ] Auto-suggest common leftovers from recent meals
- [ ] Default expiration date based on food type (customizable)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: View and manage leftovers inventory
**Description:** As a user, I want to see all my current leftovers so that I can plan meals around them.

**Acceptance Criteria:**
- [ ] List view sorted by expiration date (soonest first)
- [ ] Visual indicators: green (fresh), yellow (expires soon), red (expired)
- [ ] Filter by storage location: refrigerator, freezer, pantry
- [ ] Search by food name
- [ ] Edit quantity or mark as used/consumed
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Get expiration alerts
**Description:** As a busy user, I want to receive alerts when food is about to expire so that I can use it in time and reduce waste.

**Acceptance Criteria:**
- [ ] Configurable alert timing: 1 day, 2 days, 3 days before expiration
- [ ] Alert types: in-app notification, email (optional)
- [ ] Daily digest of items expiring soon
- [ ] One-click from alert to recipe suggestions for that item
- [ ] Mark item as "used" or "discarded" from alert
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Get recipe suggestions using leftovers
**Description:** As a user with leftovers to use up, I want recipe suggestions that incorporate my available leftovers so that I can create new meals.

**Acceptance Criteria:**
- [ ] Suggest recipes where leftover is main ingredient
- [ ] "Transformation" ideas: e.g., roast chicken → chicken salad → chicken soup
- [ ] Filter suggestions by expiring-soon items first
- [ ] Show how much of the leftover each recipe uses
- [ ] Option to combine multiple leftovers in one recipe
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Track waste reduction
**Description:** As a sustainability-minded user, I want to see my waste reduction stats so that I can feel motivated to continue the habit.

**Acceptance Criteria:**
- [ ] Counter: number of items used before expiration
- [ ] Counter: estimated money saved by using leftovers
- [ ] Counter: estimated food waste prevented (in weight or meals)
- [ ] Weekly/monthly waste reduction reports
- [ ] Streak tracking: consecutive days without food waste
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Leftover entry form with food name, quantity, unit, storage location, storage date
- FR-2: Automatic expiration date calculation based on food type defaults
- FR-3: Leftover inventory list with expiration-based sorting and color coding
- FR-4: Expiration alert system with configurable timing and notification methods
- FR-5: Recipe suggestion engine that prioritizes expiring leftovers
- FR-6: "Leftover transformation" recipe database (ways to repurpose common leftovers)
- FR-7: Mark items as used/consumed/wasted with timestamp
- FR-8: Waste reduction dashboard with stats and streaks
- FR-9: Freezer inventory with long-term storage dates
- FR-10: Integration with meal planner to suggest leftover nights

## Non-Goals

- No smart fridge or IoT device integration
- No photo recognition for automatic leftover identification
- No sharing/selling leftovers with neighbors
- No composting guidance or garden integration
- No nutrition tracking of leftovers (handled by nutrition tracker)
- No automatic grocery deductions from pantry (manual only)
- No food donation location finder
- No price tracking of wasted food

## Technical Considerations

- Expiration dates need food-type database with typical storage durations
- Alert system requires background job scheduler or cron (daily check)
- Recipe matching needs ingredient alias handling ("roasted chicken" = "cooked chicken")
- Photo storage requires image optimization and CDN for performance
- Waste calculations need baseline assumptions (average cost per meal, average food weight)
- Consider push notifications for mobile users
- Freezer items need different expiration logic (months vs days)

## Success Metrics

- 70%+ of logged leftovers are marked as "used" before expiration
- Average time from logging to use is under 3 days
- Users check leftover suggestions at least twice per week
- 50%+ reduction in reported food waste for active users
- Average of 3+ leftovers tracked per user at any time
- Alert click-through rate to recipe suggestions above 40%

## Open Questions

- Should we integrate with grocery receipts to auto-log potential leftovers?
- How should we handle "fuzzy" expiration dates (e.g., "best by" vs "use by")?
- Should we support household member assignment (who ate/claimed which leftover)?
