# PRD: Mileage Tracker

## Introduction
Enable users to track business mileage for tax deductions and reimbursement purposes. Features include GPS-based automatic trip detection, manual trip entry, and IRS-compliant mileage logs with required documentation fields.

## Goals
- Automatically detect and log trips via GPS (with user consent)
- Support manual trip entry for forgotten or future trips
- Classify trips as business or personal
- Generate IRS-compliant mileage logs
- Calculate deduction amounts using standard mileage rates

## User Stories

### US-001: GPS Trip Detection
**Description:** As a business traveler, I want my trips automatically detected and logged so that I don't have to remember to track every drive.

**Acceptance Criteria:**
- [ ] App detects trip start when moving >5mph for 60+ seconds
- [ ] Trip ends when stationary for 5+ minutes or manually stopped
- [ ] Background location permission requested with clear explanation
- [ ] Battery optimization mode available (less frequent GPS checks)
- [ ] Trip notification shown at end with option to classify
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Manual Trip Entry
**Description:** As a business traveler, I want to manually add trips I forgot to track so that my mileage log is complete.

**Acceptance Criteria:**
- [ ] Form allows entry of: start address, end address, date, purpose
- [ ] Distance auto-calculated from addresses using geocoding API
- [ ] Round-trip checkbox doubles the distance
- [ ] Odometer reading fields as alternative to address entry
- [ ] Quick add for frequent destinations (home, office, client sites)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Trip Classification
**Description:** As a business traveler, I want to classify my trips as business or personal so that only deductible miles are included in my tax report.

**Acceptance Criteria:**
- [ ] Swipe or tap to classify trip immediately after completion
- [ ] Bulk classify multiple trips at once
- [ ] Default classification rules (e.g., during work hours = business)
- [ ] Classification can be changed later with history preserved
- [ ] Personal trips hidden from tax reports by default
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: IRS-Compliant Log
**Description:** As a business traveler, I want an IRS-compliant mileage log so that I can claim deductions or reimbursements without issues.

**Acceptance Criteria:**
- [ ] Log includes required fields: date, starting odometer, ending odometer, total miles, business purpose, destination
- [ ] Log can be exported as PDF or CSV
- [ ] Signature field for taxpayer certification
- [ ] Sequential trip numbering without gaps
- [ ] Tamper-evident format (no deletions, only corrections with history)
- [ ] Typecheck passes

### US-005: Mileage Rate Calculation
**Description:** As a business traveler, I want my deduction calculated using the correct IRS rate so that I know my tax savings.

**Acceptance Criteria:**
- [ ] Current IRS standard mileage rate applied automatically
- [ ] Historical rates used for past trips based on trip date
- [ ] Manual rate override available for employer reimbursements
- [ ] Annual summary shows: total business miles, calculated deduction
- [ ] Separate tracking for medical/moving miles if applicable
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements
- FR-1: GPS tracking: minimum accuracy 50m, minimum trip distance 0.5 miles
- FR-2: Manual entry fields: start location, end location, date, time, purpose, vehicle
- FR-3: IRS required fields: date, business purpose, destination, start odometer, end odometer, total miles
- FR-4: Classification options: Business, Personal, Medical, Moving, Charity
- FR-5: IRS mileage rates: auto-updated annually, manual override available
- FR-6: Vehicle management: multiple vehicles per user, default vehicle setting
- FR-7: Trip merging: combine multi-stop trips into single log entry

## Non-Goals
- No real-time navigation or route optimization
- No vehicle expense tracking (fuel, maintenance) in v1
- No integration with rideshare apps (Uber/Lyft)
- No passenger tracking or carpool management
- No automatic business/personal detection based on location patterns (v2)

## Technical Considerations
- GPS: Background location with significant-change monitoring for battery efficiency
- Geocoding: Google Maps or Mapbox API for address-to-coordinate conversion
- Offline: Queue trips locally when no signal, sync when restored
- Storage: Trip data encrypted, location history purged after tax retention period (7 years)
- Accuracy: GPS drift filtering to remove false trips (e.g., walking, GPS noise)
- Platform: Native location APIs for iOS (Core Location) and Android (Fused Location)

## Success Metrics
- 70%+ of trips auto-detected without manual start/stop
- 95%+ of detected trips correctly classified by user
- Average monthly business miles tracked: >200 miles per active user
- IRS audit success rate: 100% of exported logs accepted (if audited)
