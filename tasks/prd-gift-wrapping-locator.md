# PRD: Gift Wrapping Locator

## Introduction
A local service discovery feature that helps users find nearby gift-related services including gift shops, wrapping services, flower delivery, and specialty stores with ratings and contact information.

## Goals
- Help users discover local gift-related services quickly
- Provide ratings and reviews for service quality assessment
- Show location-based results with distance and directions
- Include diverse service types (shops, wrapping, flowers, delivery)
- Enable contact and basic information access

## User Stories

### US-001: Search Local Services
**Description:** As a gift giver, I want to search for gift services near me so that I can find convenient options for last-minute needs.

**Acceptance Criteria:**
- [ ] Search by location (current or entered address)
- [ ] Service type filters: gift shops, wrapping services, flower shops, delivery services
- [ ] Results show within configurable radius (1, 5, 10, 25 miles/km)
- [ ] Typecheck passes

### US-002: View Service Details
**Description:** As a gift giver, I want to see detailed information about each service so that I can choose the best option.

**Acceptance Criteria:**
- [ ] Details include: name, address, phone, hours, website
- [ ] List of services offered (wrapping, custom gifts, delivery, etc.)
- [ ] Price range indicator if available
- [ ] Typecheck passes

### US-003: Check Ratings and Reviews
**Description:** As a gift giver, I want to see ratings and reviews for services so that I can choose reputable businesses.

**Acceptance Criteria:**
- [ ] Star rating display (1-5 stars)
- [ ] Number of reviews shown
- [ ] Recent review excerpts visible
- [ ] Typecheck passes

### US-004: Get Directions
**Description:** As a gift giver, I want to get directions to a service location so that I can navigate there easily.

**Acceptance Criteria:**
- [ ] One-click directions opening in native maps app
- [ ] Address copyable for manual navigation
- [ ] Public transit and driving options indicated
- [ ] Typecheck passes

### US-005: Save Favorite Services
**Description:** As a gift giver, I want to save my favorite local services so that I can quickly find them again.

**Acceptance Criteria:**
- [ ] Save/unsave toggle for each service
- [ ] Favorites list accessible from main menu
- [ ] Quick access to saved service details
- [ ] Typecheck passes

## Functional Requirements
- FR-1: System must support location-based search with radius filtering
- FR-2: Service categories must include: gift shops, wrapping services, flower shops, delivery services
- FR-3: Each service listing must display: name, address, phone, hours, website, services offered
- FR-4: System must display ratings and review counts for each service
- FR-5: Users must be able to get directions via external maps applications
- FR-6: Users can save favorite services for quick access
- FR-7: Results must be sortable by distance, rating, or relevance
- FR-8: System must handle location permission gracefully with fallback to manual entry

## Non-Goals
- No in-app purchase or booking functionality (external links only)
- No real-time inventory checking from stores
- No delivery tracking integration
- No user-generated reviews (read-only from external sources)
- No price comparison across services
- No online ordering or payment processing

## Technical Considerations
- Integration with mapping/geocoding APIs (Google Maps, Mapbox, or OpenStreetMap)
- Local storage for saved favorite services
- Caching strategy for service data to reduce API calls
- Fallback mechanism when location services are unavailable
- Mobile-responsive design for on-the-go usage

## Success Metrics
- 60% of searches result in user visiting or contacting a service
- Average search-to-visit time under 10 minutes
- 40% of users save at least one favorite service
- User satisfaction with service recommendations rated 4+ stars
