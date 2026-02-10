# PRD: Recipe Suggester

## Introduction

The Recipe Suggester helps users discover recipes tailored to their specific needs. It considers dietary restrictions, available ingredients, cuisine preferences, and cooking difficulty to provide personalized recipe recommendations that match the user's current situation and preferences.

## Goals

- Enable users to find recipes matching their dietary restrictions (vegetarian, vegan, gluten-free, etc.)
- Suggest recipes based on ingredients already available to reduce waste
- Support cuisine preference filtering (Italian, Asian, Mexican, etc.)
- Allow filtering by difficulty level (beginner, intermediate, advanced)
- Provide quick recipe preview with cooking time and ingredient count
- Surface recipes that maximize ingredient usage from user's pantry

## User Stories

### US-001: Filter recipes by dietary restrictions
**Description:** As a user with dietary restrictions, I want to filter recipes by my diet type so that I only see recipes I can actually eat.

**Acceptance Criteria:**
- [ ] Dietary restriction filters available: vegetarian, vegan, gluten-free, dairy-free, nut-free, keto, paleo
- [ ] Multiple dietary filters can be applied simultaneously
- [ ] Filtered results update immediately without page reload
- [ ] Active filters are visually indicated and easily removable
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Suggest recipes based on available ingredients
**Description:** As a home cook, I want recipe suggestions based on ingredients I already have so that I can minimize grocery shopping and reduce food waste.

**Acceptance Criteria:**
- [ ] User can input or select available ingredients from their pantry
- [ ] System suggests recipes sorted by percentage of ingredients already owned
- [ ] Each suggestion shows which ingredients are missing
- [ ] Option to exclude recipes requiring more than X missing ingredients
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Filter by cuisine and difficulty
**Description:** As a user planning a dinner party, I want to filter recipes by cuisine type and difficulty so that I can find the perfect dish for the occasion.

**Acceptance Criteria:**
- [ ] Cuisine filter with options: Italian, Mexican, Asian, Indian, Mediterranean, American, French, Thai, Japanese, Other
- [ ] Difficulty filter: Beginner (under 30 min, 5 ingredients), Intermediate, Advanced
- [ ] Combined filters work together (cuisine + difficulty + dietary)
- [ ] Results show cuisine tag and difficulty badge on each recipe card
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Save favorite recipes
**Description:** As a user, I want to save recipes I like so that I can easily find them later when planning meals.

**Acceptance Criteria:**
- [ ] Heart/save button on each recipe card
- [ ] Saved recipes stored in user's favorites list
- [ ] Favorites are persisted across sessions
- [ ] Quick access to favorites from main navigation
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Quick recipe preview
**Description:** As a busy user, I want to see key recipe information at a glance so that I can quickly decide if I want to view the full recipe.

**Acceptance Criteria:**
- [ ] Recipe cards display: cooking time, prep time, total time, ingredient count, serving size
- [ ] Thumbnail image of the finished dish
- [ ] Calorie estimate per serving
- [ ] One-click to view full recipe details
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Recipe database schema supporting dietary tags, cuisine type, difficulty level, ingredients, and nutrition info
- FR-2: Filter interface with dietary restrictions as toggle chips
- FR-3: Ingredient-based search with autocomplete from pantry database
- FR-4: Cuisine selector dropdown with 10+ cuisine options
- FR-5: Difficulty selector with visual indicators (beginner=easy, intermediate=medium, advanced=hard)
- FR-6: Recipe results grid with sorting options (by relevance, time, difficulty, rating)
- FR-7: Recipe detail view with full ingredients list, step-by-step instructions, and nutrition facts
- FR-8: Favorite/save functionality with dedicated favorites page
- FR-9: Ingredient match percentage calculation showing how many ingredients user already has
- FR-10: Smart suggestions based on user's saved preferences and past selections

## Non-Goals

- No meal planning or calendar integration (handled by separate feature)
- No shopping list generation (handled by separate feature)
- No user-generated recipe submissions
- No social features (sharing, commenting, ratings from other users)
- No nutritional goal tracking or meal logging (handled by nutrition tracker)
- No price comparison or store locator features
- No video cooking tutorials
- No AI-generated recipes

## Technical Considerations

- Recipe data can be seeded from external APIs (Spoonacular, Edamam) or curated dataset
- Ingredient matching requires normalized ingredient names (e.g., "tomato" matches "roma tomatoes")
- Search should be debounced (300ms) to prevent excessive API calls
- Recipe images should be lazy-loaded for performance
- Filters should be stored in URL params for shareable filtered views
- Consider caching popular search results
- Dietary tags should be filterable via bitmask or array operations for performance

## Success Metrics

- Users find a suitable recipe within 3 clicks/filters
- Ingredient match percentage shown for 90%+ of suggestions
- Average time to find recipe under 60 seconds
- 70%+ of suggested recipes use at least 50% of user's available ingredients
- Filter combination response time under 500ms
- Users save at least 3 recipes within first week of use

## Open Questions

- Should we include estimated cost per serving in recipe preview?
- How should we handle recipes with optional ingredients in match calculations?
- Should we prioritize recipes that use ingredients nearing expiration?
