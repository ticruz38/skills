# PRD: Recipient Profiles

## Introduction
A comprehensive profile management system for storing detailed information about gift recipients including preferences, gift history, sizes, wishlists, and personal notes to enable more thoughtful and personalized gift-giving.

## Goals
- Create detailed profiles for each gift recipient
- Track complete gift history to avoid duplicates
- Store personal preferences, sizes, and interests
- Maintain wishlists for each recipient
- Enable personalized notes and reminders

## User Stories

### US-001: Create Recipient Profile
**Description:** As a gift giver, I want to create a profile for each person I buy gifts for so that I can keep their preferences organized.

**Acceptance Criteria:**
- [ ] Profile includes name, relationship, birthday, and photo (optional)
- [ ] Relationship types: Family, Friend, Partner, Colleague, Other
- [ ] Quick-add option for minimal information entry
- [ ] Typecheck passes

### US-002: Add Gift History
**Description:** As a gift giver, I want to record gifts I've given to each recipient so that I don't accidentally give the same gift twice.

**Acceptance Criteria:**
- [ ] Gift history shows: item name, occasion, date, price, recipient reaction
- [ ] Duplicate detection warning when adding similar items
- [ ] Gift history searchable and filterable by year/occasion
- [ ] Typecheck passes

### US-003: Manage Preferences and Sizes
**Description:** As a gift giver, I want to store preferences and sizes for each recipient so that I always give appropriate gifts.

**Acceptance Criteria:**
- [ ] Preference categories: interests, colors, styles, dietary restrictions, brands
- [ ] Size fields: clothing, shoes, accessories with standard sizing options
- [ ] Free-form notes section for additional details
- [ ] Typecheck passes

### US-004: Maintain Wishlists
**Description:** As a gift giver, I want to create and manage wishlists for recipients so that I know exactly what they want.

**Acceptance Criteria:**
- [ ] Multiple wishlists per recipient (e.g., "Birthday 2025", "General")
- [ ] Wishlist items include: name, description, priority, source URL
- [ ] Items can be marked as purchased (hidden from default view)
- [ ] Typecheck passes

### US-005: Personal Notes
**Description:** As a gift giver, I want to add private notes about recipients so that I can remember important details and conversation hints.

**Acceptance Criteria:**
- [ ] Notes are private and not visible to recipients
- [ ] Timestamped notes with edit history
- [ ] Searchable note content
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Users can create, edit, and delete recipient profiles
- FR-2: Each profile must store: name, relationship, birthday, photo, contact info
- FR-3: System must maintain complete gift history with dates, occasions, and reactions
- FR-4: Profile must include structured fields for preferences and sizes
- FR-5: Users can create multiple wishlists per recipient with priority levels
- FR-6: System must provide duplicate gift detection based on gift history
- FR-7: Private notes must be encrypted and accessible only to the profile owner
- FR-8: Profiles must be searchable and sortable by various criteria

## Non-Goals
- No recipient-facing features (profiles are giver-only)
- No automated data extraction from social media
- No sharing of profiles between users
- No integration with retailer wishlist APIs (manual entry only)
- No automatic preference learning from browsing history

## Technical Considerations
- Local storage with optional encrypted cloud backup
- Data structure optimized for quick retrieval of gift history
- Image handling for profile photos and gift images
- Search indexing for notes and preferences
- Privacy controls to ensure recipient data remains confidential

## Success Metrics
- Average of 5+ recipients per active user
- 90% of gifts given are recorded in history
- Duplicate gift incidents reduced to under 5%
- User satisfaction with profile completeness rated 4+ stars
