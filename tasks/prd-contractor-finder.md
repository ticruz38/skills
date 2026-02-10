# PRD: Contractor Finder

## Introduction

A local contractor discovery and vetting system for Hank the Home Handyman to find, evaluate, and manage relationships with home service professionals. This includes searching by trade, reading reviews, requesting quotes, and tracking work history.

## Goals

- Enable discovery of local contractors by trade/specialty
- Provide contractor vetting through reviews and ratings
- Support quote comparison and selection
- Track contractor work history and performance
- Maintain contractor contact information and availability

## User Stories

### US-001: Search for contractors
**Description:** As Hank, I want to find contractors by trade so I can hire the right professional for the job.

**Acceptance Criteria:**
- [ ] Search by trade: Plumbing, Electrical, HVAC, Roofing, Painting, Landscaping, General, etc.
- [ ] Filter by: location radius, rating, availability, licensed/bonded status
- [ ] Sort by: rating, distance, review count
- [ ] Display contractor cards with: name, photo, rating, specialties, distance
- [ ] View count of projects completed
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Contractor profile view
**Description:** As Hank, I want to see detailed information about a contractor before hiring.

**Acceptance Criteria:**
- [ ] Profile shows: business info, license numbers, insurance, years in business
- [ ] Services offered with pricing estimates if available
- [ ] Photo gallery of past work
- [ ] Reviews with ratings and verified badges
- [ ] Contact buttons: call, email, request quote
- [ ] Business hours and service area map
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Request and compare quotes
**Description:** As Hank, I want to request quotes from multiple contractors and compare them.

**Acceptance Criteria:**
- [ ] Form to submit job details with photos
- [ ] Send to multiple contractors simultaneously
- [ ] Quote tracking dashboard: requested, received, accepted, declined
- [ ] Side-by-side quote comparison view
- [ ] Quote details: price breakdown, timeline, materials, warranty
- [ ] Accept/decline quote with optional feedback
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Review and rate contractors
**Description:** As Hank, I want to leave reviews for contractors I've hired to help others.

**Acceptance Criteria:**
- [ ] Review form: rating (1-5), work description, pros/cons, would hire again
- [ ] Upload photos of completed work
- [ ] Tag review with work type and date
- [ ] Verified hire badge for confirmed customers
- [ ] Edit or update review later
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Contractor history tracking
**Description:** As Hank, I want to keep a history of contractors I've worked with.

**Acceptance Criteria:**
- [ ] "My Contractors" list of all hired professionals
- [ ] Work history per contractor: dates, jobs, costs, ratings given
- [ ] Notes field for private reminders (e.g., "great work but slow")
- [ ] Favorite contractors list for quick access
- [ ] Re-hire button to request new quote
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Database schema for contractors with fields: id, business_name, contact_name, trade, phone, email, license_number, insurance_info, years_experience, service_area, hourly_rate_range, bio
- FR-2: Search and filter by trade, location, rating, availability
- FR-3: Review system with ratings, text, photos, verified badges
- FR-4: Quote request workflow with job details and photo attachments
- FR-5: Quote comparison interface with side-by-side view
- FR-6: User's contractor history tracking with notes and favorites
- FR-7: Photo gallery for contractor portfolios
- FR-8: Integration with map service for service area display

## Non-Goals

- No real-time scheduling or calendar booking
- No payment processing or invoicing
- No background check or credential verification (user-managed)
- No automated contractor matching algorithm
- No contractor subscription or advertising features

## Technical Considerations

- Location-based search requires geocoding and radius calculation
- Photo storage for portfolios and review images
- Review moderation system for content quality
- Rate limiting on quote requests to prevent spam

## Success Metrics

- User can find and contact a contractor in under 5 minutes
- Quote comparison loads within 2 seconds
- Review submission takes under 3 minutes
- 90%+ of searches return relevant results within user's area

## Open Questions

- Should contractors be able to claim profiles and update info?
- Should we integrate with third-party review sources (Yelp, Google)?
- Should there be an emergency/quick-response contractor category?
