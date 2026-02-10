# PRD: Expense Categorizer

## Introduction
Automatically categorize expenses using machine learning and rule-based systems to reduce manual sorting. The system learns from user corrections to improve accuracy over time, enabling users to understand their spending patterns effortlessly.

## Goals
- Automatically categorize 80%+ of expenses correctly on first pass
- Learn from user corrections to improve future categorizations
- Support custom categories defined by users
- Provide category suggestions within 500ms
- Enable bulk categorization for similar expenses

## User Stories

### US-001: Automatic Category Suggestion
**Description:** As a user tracking expenses, I want my expenses automatically categorized so that I can see where my money goes without manual sorting.

**Acceptance Criteria:**
- [ ] Each new expense shows a suggested category based on merchant name
- [ ] Suggestion appears immediately after receipt OCR or manual entry
- [ ] System suggests from 15+ default categories (Food, Transport, Utilities, etc.)
- [ ] Confidence indicator shown for auto-categorization
- [ ] User can accept or change suggestion with one tap
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: ML-Based Categorization Learning
**Description:** As a user tracking expenses, I want the app to learn from my corrections so that future similar expenses are categorized correctly.

**Acceptance Criteria:**
- [ ] System tracks user corrections to category suggestions
- [ ] After 2+ corrections for same merchant, auto-apply learned category
- [ ] ML model retrains weekly on user's historical data
- [ ] Learning progress indicator shows in settings
- [ ] User can reset learned patterns if needed
- [ ] Typecheck passes

### US-003: Custom Categories
**Description:** As a user tracking expenses, I want to create my own categories so that I can organize expenses in a way that makes sense for my business.

**Acceptance Criteria:**
- [ ] User can create unlimited custom categories
- [ ] Each category has name, color, and optional icon
- [ ] Custom categories appear in suggestion dropdown
- [ ] User can edit or delete custom categories (affects uncategorized only)
- [ ] Categories can be marked as "tax deductible" for filtering
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Rule-Based Categorization
**Description:** As a user tracking expenses, I want to set rules for automatic categorization so that recurring expenses are always sorted correctly.

**Acceptance Criteria:**
- [ ] User can create rules based on: merchant name (contains), amount range, or date pattern
- [ ] Rules can be prioritized (ordered execution)
- [ ] Rules preview shows matching expenses before saving
- [ ] Rules can be enabled/disabled individually
- [ ] Bulk apply rules to existing uncategorized expenses
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Bulk Categorization
**Description:** As a user tracking expenses, I want to categorize multiple expenses at once so that I can quickly clean up my expense list.

**Acceptance Criteria:**
- [ ] Multi-select mode for expenses list
- [ ] Apply category to all selected expenses with one action
- [ ] "Categorize similar" option for uncategorized expenses from same merchant
- [ ] Undo available for bulk operations
- [ ] Progress indicator for large bulk operations
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements
- FR-1: 20 default categories: Food & Dining, Transportation, Shopping, Entertainment, Health, Travel, Utilities, Rent/Mortgage, Insurance, Personal Care, Education, Gifts & Donations, Business Services, Office Supplies, Professional Development, Subscriptions, Taxes, Fees & Charges, Uncategorized
- FR-2: ML model uses merchant name, amount, and transaction date features
- FR-3: Custom categories support: name (max 50 chars), hex color, icon from set of 50
- FR-4: Rules engine supports: contains, starts with, exact match for merchant; min/max for amount; day of week/week of month for date
- FR-5: System maintains accuracy metric: correct predictions / total predictions
- FR-6: Model fallback to keyword matching when ML confidence <60%

## Non-Goals
- No receipt image-based categorization (uses extracted merchant name only)
- No automatic sub-category creation
- No category budget enforcement in v1
- No sharing/standardizing categories across organizations
- No AI-generated category descriptions

## Technical Considerations
- ML Model: Lightweight classifier (Random Forest or Naive Bayes) trained per user
- Storage: User category preferences and learned patterns in PostgreSQL
- Performance: Categorization suggestions cached for common merchants
- Privacy: ML training happens on-device or with anonymized data only
- Fallback: Keyword matching using merchant name database for offline support

## Success Metrics
- 80%+ auto-categorization accuracy after 30 days of use
- 50% reduction in time spent categorizing expenses
- User creates average of 3+ custom categories
- <5% of expenses remain uncategorized after 90 days
