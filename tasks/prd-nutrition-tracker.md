# PRD: Nutrition Tracker

## Introduction

The Nutrition Tracker allows users to log their daily meals and track macronutrients (protein, carbs, fats) and calories. It provides goal setting, progress visualization through charts, and insights into eating patterns to help users maintain a balanced diet and achieve their nutritional goals.

## Goals

- Enable daily meal logging with automatic nutrition calculation
- Track macronutrients (protein, carbohydrates, fat) and calories
- Support custom nutrition goals (weight loss, maintenance, gain, specific macros)
- Provide visual progress charts and historical data
- Offer insights and trends about eating patterns
- Integrate with recipe data for automatic nutrition import

## User Stories

### US-001: Log daily meals
**Description:** As a health-conscious user, I want to log what I eat throughout the day so that I can track my nutrition intake.

**Acceptance Criteria:**
- [ ] Add meal entries by meal type: Breakfast, Lunch, Dinner, Snacks
- [ ] Search and select from recipe database or add custom food
- [ ] Specify portion size for each entry
- [ ] Quick-add recent or favorite items
- [ ] Edit or delete logged entries
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: View daily nutrition summary
**Description:** As a user tracking my diet, I want to see my daily nutrition totals so that I know if I'm meeting my goals.

**Acceptance Criteria:**
- [ ] Dashboard shows calories and macros (protein, carbs, fat) for current day
- [ ] Visual progress bars showing progress toward daily goals
- [ ] Color coding: green (on track), yellow (approaching limit), red (exceeded)
- [ ] Remaining calories/macros displayed
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Set nutrition goals
**Description:** As a user with specific health goals, I want to customize my nutrition targets so that the tracker aligns with my needs.

**Acceptance Criteria:**
- [ ] Set daily calorie target
- [ ] Set macro targets by percentage or grams (protein, carbs, fat)
- [ ] Preset goal templates: weight loss, maintenance, muscle gain, keto, low-carb
- [ ] Validation that macros sum to 100% when using percentages
- [ ] Goals persist across sessions
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: View weekly/monthly trends
**Description:** As a user monitoring long-term progress, I want to see nutrition trends over time so that I can identify patterns and adjust my habits.

**Acceptance Criteria:**
- [ ] Weekly view showing daily calorie/macro averages
- [ ] Monthly view with trend lines
- [ ] Charts: line chart for weight (if tracked), bar chart for calories, stacked bar for macros
- [ ] Compare current week/month to previous periods
- [ ] Export data as CSV
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Get nutrition insights
**Description:** As a user wanting to improve my diet, I want insights about my eating patterns so that I can make healthier choices.

**Acceptance Criteria:**
- [ ] Average nutrition stats for past 7 days
- [ ] Most logged foods or recipes
- [ ] Day-of-week patterns (e.g., higher calories on weekends)
- [ ] Goal achievement streak tracking
- [ ] Suggestions based on goal gaps (e.g., "You're low on protein today")
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Meal logging interface with search and portion input
- FR-2: Automatic nutrition calculation from recipe data
- FR-3: Daily nutrition dashboard with progress indicators
- FR-4: Customizable calorie and macro goal settings
- FR-5: Preset goal templates for common dietary approaches
- FR-6: Weekly and monthly trend charts with multiple chart types
- FR-7: Historical data browser with date navigation
- FR-8: Quick-add functionality for frequently consumed items
- FR-9: Nutrition insights and pattern analysis
- FR-10: Data export functionality (CSV format)

## Non-Goals

- No barcode scanning for packaged foods (handled by pantry tracker)
- No integration with fitness trackers or wearables (Fitbit, Apple Health, etc.)
- No food photo logging or AI food recognition
- No social features (sharing meals, following friends)
- No water intake tracking
- No supplement/vitamin tracking beyond basic nutrition
- No medical advice or personalized diet recommendations
- No restaurant menu database integration
- No meal timing or intermittent fasting features

## Technical Considerations

- Nutrition data requires comprehensive food database or API integration (USDA FoodData Central, Nutritionix)
- Recipe nutrition calculation needs ingredient-level nutrition data with portion scaling
- Charts library needed for visualizations (Chart.js, Recharts, or similar)
- Data aggregation for trends requires efficient database queries (daily summaries table)
- Consider timezone handling for users traveling across time zones
- Local storage for offline meal logging, sync when connected
- Privacy considerations for health data (encryption, opt-in analytics)

## Success Metrics

- Users log at least 3 meals per day on average
- 80%+ of daily nutrition goals are visible at a glance without scrolling
- Chart load time under 2 seconds for monthly views
- Users set personalized goals within first 3 days of use
- 60%+ of logged meals are from saved recipes (vs manual entry)
- Weekly trend view accessed at least once per week by active users

## Open Questions

- Should we track micronutrients (vitamins, minerals) or keep it macro-focused?
- How should we handle partial recipe consumption (e.g., ate half a casserole)?
- Should we support multiple goal profiles (e.g., weekday vs weekend targets)?
