# PRD: Appliance Tracker

## Introduction

A comprehensive appliance and equipment tracking system for Hank the Home Handyman to manage his home appliances, store manuals and documentation, track model numbers, and record purchase dates. This centralizes all appliance information in one accessible location.

## Goals

- Provide a centralized database of all home appliances and equipment
- Store and organize appliance manuals, receipts, and documentation
- Track key information: model numbers, serial numbers, purchase dates, warranty info
- Enable quick lookup when repair or support is needed
- Support appliance categorization and location tagging

## User Stories

### US-001: Add new appliance
**Description:** As Hank, I want to add a new appliance to my database so I can track its information.

**Acceptance Criteria:**
- [ ] Form to add appliance with: name, category, brand, model number, serial number, purchase date, purchase price, location in home
- [ ] Category dropdown: Kitchen, Laundry, HVAC, Outdoor, Electronics, Other
- [ ] Optional fields: retailer, warranty length, notes
- [ ] Appliance saves and appears in list
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Upload appliance manual
**Description:** As Hank, I want to upload and store appliance manuals so I can access them when needed.

**Acceptance Criteria:**
- [ ] PDF upload support for manuals and documentation
- [ ] Multiple files per appliance allowed
- [ ] File size limit: 25MB per file
- [ ] View PDF in browser without download
- [ ] Download option for offline access
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: View appliance list
**Description:** As Hank, I want to browse all my appliances so I can quickly find information.

**Acceptance Criteria:**
- [ ] Grid/list view toggle for appliances
- [ ] Each card shows: name, brand, location, thumbnail if available
- [ ] Filter by category, location, brand
- [ ] Search by name, model number, or serial number
- [ ] Sort by purchase date, name, or category
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Appliance detail view
**Description:** As Hank, I want to see all details for a specific appliance in one place.

**Acceptance Criteria:**
- [ ] Detail page shows all stored information
- [ ] Tabs for: Info, Manuals, Service History, Warranty
- [ ] Quick actions: Edit, Delete, Print Info
- [ ] Warranty countdown display (days remaining)
- [ ] Link to manufacturer support website
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Capture appliance info via photo
**Description:** As Hank, I want to take a photo of an appliance info sticker to auto-fill details.

**Acceptance Criteria:**
- [ ] Photo upload for info sticker (model/serial plate)
- [ ] OCR extraction of model number and serial number
- [ ] Manual review and edit of extracted text
- [ ] Attach photo as backup reference
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Database schema for appliances with fields: id, name, category, brand, model_number, serial_number, purchase_date, purchase_price, location, retailer, warranty_months, notes, created_at
- FR-2: File storage for manuals and documents with metadata
- FR-3: List view with filtering by category, location, brand
- FR-4: Search functionality across name, model number, serial number, brand
- FR-5: Detail view with tabbed interface for organized information
- FR-6: PDF viewer integration for in-browser manual viewing
- FR-7: OCR integration for extracting text from appliance info stickers
- FR-8: Export functionality (CSV/JSON) for backup

## Non-Goals

- No automatic appliance discovery via network scanning
- No integration with retailer APIs for auto-import
- No repair scheduling or service booking
- No parts inventory management
- No energy usage tracking or monitoring

## Technical Considerations

- File storage should support S3-compatible or local filesystem
- OCR requires image preprocessing for better accuracy
- Consider PDF thumbnail generation for manual previews
- Search should be case-insensitive and support partial matches

## Success Metrics

- User can add an appliance in under 2 minutes
- Manual PDFs load within 3 seconds
- Search returns results in under 500ms
- OCR accuracy of 80%+ on clear photos

## Open Questions

- Should we support QR code generation for quick appliance lookup?
- Should there be sharing capability with family members?
- Should we track appliance value depreciation?
