# PRD: Property Alerts

## Introduction

Enable Realtor Owen to automatically monitor property listings that match his clients' search criteria. The Property Alerts system integrates with Zillow and Redfin to track new listings, price changes, and status updates, delivering instant notifications when relevant properties become available. This reduces manual search time and ensures clients never miss opportunities in a competitive market.

## Goals

- Provide real-time alerts for new listings matching saved search criteria
- Integrate with Zillow and Redfin APIs for comprehensive market coverage
- Support complex filtering (price, location, beds/baths, property type, amenities)
- Enable multiple saved searches per client with customizable alert frequency
- Reduce time spent manually checking listing sites by 80%

## User Stories

### US-001: Connect Zillow/Redfin API
**Description:** As Owen, I want to connect my Zillow and Redfin accounts so that the system can fetch listing data automatically.

**Acceptance Criteria:**
- [ ] OAuth connection flow for Zillow API
- [ ] OAuth connection flow for Redfin API
- [ ] API credentials stored securely (encrypted at rest)
- [ ] Connection status indicator in settings
- [ ] Graceful handling of API rate limits and errors
- [ ] Typecheck/lint passes

### US-002: Create Saved Search
**Description:** As Owen, I want to create a saved search for a client so that they receive alerts for matching properties.

**Acceptance Criteria:**
- [ ] Search form with location (address, neighborhood, city, ZIP, or draw on map)
- [ ] Price range filters (min/max)
- [ ] Property type selector (single family, condo, townhouse, multi-family)
- [ ] Bedroom and bathroom count filters
- [ ] Square footage range
- [ ] Lot size, year built, and other advanced filters
- [ ] Assign search to specific client
- [ ] Set alert frequency (instant, daily digest, weekly digest)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Receive Instant Alerts
**Description:** As Owen, I want to receive instant notifications when a new matching property is listed so that I can act quickly for my clients.

**Acceptance Criteria:**
- [ ] Real-time monitoring of new listings via APIs
- [ ] Push notification or email alert within 5 minutes of listing appearing
- [ ] Alert includes property photo, price, address, key details
- [ ] One-click to view full property details
- [ ] Deduplication of alerts across Zillow/Redfin sources
- [ ] Typecheck/lint passes

### US-004: View and Manage Saved Searches
**Description:** As Owen, I want to view and edit my clients' saved searches so that I can keep their criteria up to date.

**Acceptance Criteria:**
- [ ] List view of all saved searches with client names
- [ ] Edit search criteria in-place
- [ ] Pause/resume alerts per search
- [ ] Delete saved search with confirmation
- [ ] View search results preview before saving
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Client Alert Preferences
**Description:** As Owen, I want to set different alert preferences per client so that they receive notifications how they prefer.

**Acceptance Criteria:**
- [ ] Per-client notification settings (email, SMS, in-app)
- [ ] Quiet hours configuration
- [ ] Price change alerts toggle
- [ ] Status change alerts (pending, sold, price drop)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Integrate with Zillow API for property search and listing data
- FR-2: Integrate with Redfin API for additional market coverage
- FR-3: Support location-based search by address, city, ZIP, neighborhood, or map polygon
- FR-4: Filter by price range, beds, baths, property type, square footage, lot size, year built
- FR-5: Support advanced filters: pool, garage, waterfront, view, HOA fees, days on market
- FR-6: Allow multiple saved searches per client with unique criteria
- FR-7: Alert frequency options: instant, daily at 8am, weekly on Monday
- FR-8: Alert channels: in-app, email, SMS
- FR-9: Deduplicate listings across Zillow and Redfin sources
- FR-10: Track price changes and status updates for watched properties
- FR-11: Store alert history with read/unread status
- FR-12: API rate limiting with exponential backoff

## Non-Goals

- No automated offer generation or submission
- No direct messaging between clients and sellers
- No virtual tour scheduling (covered in showing-scheduler)
- No mortgage calculator or financing tools
- No historical sales data analysis (covered in market-reports)
- No MLS data integration (Zillow/Redfin only for MVP)

## Technical Considerations

- Zillow API: Partner API for real-time listing data
- Redfin API: Unofficial scraping or official if available
- Background job queue for polling listings (every 15 minutes)
- WebSocket or SSE for instant push notifications
- Geocoding service for address validation and map features
- Database indexing on location and price for fast filtering
- Caching layer for frequently accessed searches

## Success Metrics

- New matching listings alerted within 5 minutes of appearing online
- 100% coverage of client's search criteria in alerts
- Zero duplicate alerts for same property across sources
- Owen checks listing sites manually less than once per week
- Client response time to new listings under 2 hours

## Open Questions

- Should we support custom alert rules (e.g., only alert if price/sqft under $X)?
- Do we need school district or walk score filtering?
- Should clients be able to create their own saved searches?
