# PRD: Shopping List Generator

## Introduction

The Shopping List Generator automatically creates organized shopping lists from meal plans. It categorizes items by store section, checks pantry inventory to avoid duplicates, merges similar ingredients, and provides a streamlined grocery shopping experience that saves time and reduces forgotten items.

## Goals

- Generate shopping lists automatically from weekly meal plans
- Organize items by store section (produce, dairy, pantry, etc.) for efficient shopping
- Check pantry inventory and exclude items already in stock
- Merge duplicate ingredients (e.g., "2 tomatoes" + "3 tomatoes" = "5 tomatoes")
- Allow manual addition and removal of items
- Support multiple store preferences with custom layouts

## User Stories

### US-001: Generate list from meal plan
**Description:** As a meal planner, I want to generate a shopping list from my weekly meal plan so that I know exactly what to buy.

**Acceptance Criteria:**
- [ ] One-click generation from any saved meal plan
- [ ] System aggregates all ingredients from planned recipes
- [ ] Quantities are summed across multiple recipes using same ingredient
- [ ] Generated list shows recipe source for each ingredient
- [ ] Option to regenerate if meal plan changes
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Pantry check and exclusion
**Description:** As a pantry-conscious shopper, I want the system to check what I already have so that I don't buy duplicates.

**Acceptance Criteria:**
- [ ] System compares required ingredients against pantry inventory
- [ ] Ingredients already in sufficient quantity are marked as "have" or excluded
- [ ] User can override pantry check for specific items
- [ ] Low-stock items (below threshold) are still included with warning
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Categorize by store section
**Description:** As an efficient shopper, I want my list organized by store section so that I can navigate the grocery store without backtracking.

**Acceptance Criteria:**
- [ ] Items automatically categorized: Produce, Dairy, Meat/Seafood, Bakery, Frozen, Pantry, Beverages, Household
- [ ] Sections ordered logically (typically: produce → bakery → meat → dairy → frozen → pantry)
- [ ] User can customize section order per store preference
- [ ] Uncategorized items shown in "Other" section at bottom
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Merge and consolidate duplicates
**Description:** As an organized shopper, I want duplicate ingredients merged so that my list is concise and easy to follow.

**Acceptance Criteria:**
- [ ] Same ingredients from different recipes are merged with summed quantities
- [ ] Different units are converted where possible (e.g., 2 cups + 1 pint flour)
- [ ] Merged items show all source recipes
- [ ] User can unmerge to see original breakdown
- [ ] Typecheck passes

### US-005: Check off items while shopping
**Description:** As a shopper in the store, I want to check off items as I add them to my cart so that I can track my progress.

**Acceptance Criteria:**
- [ ] Checkbox for each item to mark as purchased
- [ ] Checked items visually distinct (strikethrough, grayed out, moved to bottom)
- [ ] Progress indicator showing X of Y items completed
- [ ] Option to clear all checks for reuse
- [ ] Persist check state during session
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Import ingredients from meal plan recipes with quantities
- FR-2: Pantry inventory integration to exclude in-stock items
- FR-3: Ingredient categorization algorithm mapping items to store sections
- FR-4: Duplicate detection and quantity merging with unit normalization
- FR-5: Manual item add/remove/edit functionality
- FR-6: Check off/toggle purchased state for each item
- FR-7: Progress tracking with visual indicator
- FR-8: Multiple store layout presets (standard grocery, bulk store, farmers market)
- FR-9: Export/print shopping list as formatted text or PDF
- FR-10: Share list via email or messaging apps

## Non-Goals

- No price tracking or budget optimization
- No store inventory checking or availability verification
- No coupon integration or deal finding
- No delivery service integration (Instacart, Amazon Fresh, etc.)
- No barcode scanning for adding items (handled by pantry tracker)
- No recipe suggestions based on sales items
- No nutrition analysis of shopping list
- No multi-store route optimization

## Technical Considerations

- Ingredient categorization requires comprehensive mapping (thousands of items to ~8 categories)
- Unit conversion needs standardized unit library (convert-units or similar)
- Pantry check requires fuzzy matching ("chicken breast" vs "chicken breasts")
- Store layouts should be user-customizable and persist per user
- Shopping list state should sync across devices if user is logged in
- Consider offline mode for use in stores with poor signal
- Print/PDF export needs clean formatting without UI elements

## Success Metrics

- Shopping list generated in under 3 seconds for meal plans up to 7 days
- 95%+ of ingredients correctly categorized to store sections
- Duplicate merging reduces list length by average of 30%
- Pantry check prevents 80%+ of duplicate purchases
- Users complete shopping trips 25% faster with organized list
- Less than 5% of items remain uncategorized

## Open Questions

- Should we support different unit systems (metric/imperial) per user preference?
- How to handle "to taste" or optional ingredients in shopping lists?
- Should we suggest substitutions if pantry item is similar but not exact?
