# PRD: Receipt OCR

## Introduction
Enable users to extract structured data from receipt photos using Optical Character Recognition (OCR). This feature eliminates manual data entry by automatically identifying key fields like merchant name, total amount, date, and category from receipt images.

## Goals
- Allow users to upload receipt photos from camera or gallery
- Extract merchant name, total amount, date, and category with >85% accuracy
- Provide confidence scores for each extracted field
- Enable quick manual correction for low-confidence extractions
- Process receipts in under 3 seconds on average

## User Stories

### US-001: Upload Receipt Photo
**Description:** As a user tracking expenses, I want to upload a receipt photo from my camera or photo gallery so that I can digitize my paper receipts.

**Acceptance Criteria:**
- [ ] Camera capture button opens device camera with receipt-optimized settings
- [ ] Gallery picker allows selecting multiple photos at once
- [ ] Image preview shown before processing with option to retake/reselect
- [ ] Photos are compressed to <5MB before upload
- [ ] Typecheck passes

### US-002: OCR Data Extraction
**Description:** As a user tracking expenses, I want the app to automatically read my receipt so that I don't have to manually type in the details.

**Acceptance Criteria:**
- [ ] System extracts merchant name with >80% accuracy
- [ ] System extracts total amount with >95% accuracy
- [ ] System extracts transaction date with >90% accuracy
- [ ] System suggests category based on merchant name
- [ ] Processing completes within 3 seconds for standard receipts
- [ ] Typecheck passes

### US-003: Confidence Scoring
**Description:** As a user tracking expenses, I want to know how confident the system is about each extracted field so that I know which fields to verify.

**Acceptance Criteria:**
- [ ] Each extracted field displays a confidence indicator (high/medium/low)
- [ ] Fields with confidence <70% are visually highlighted
- [ ] Overall receipt confidence score shown at top
- [ ] Low-confidence fields automatically focused for review
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Manual Correction
**Description:** As a user tracking expenses, I want to quickly correct any mistakes in the extracted data so that my records are accurate.

**Acceptance Criteria:**
- [ ] All extracted fields are editable in a single form view
- [ ] Tapping a field value opens keyboard with appropriate input type
- [ ] Receipt image visible alongside form for reference
- [ ] Pinch-to-zoom on receipt image to verify small text
- [ ] Save button disabled until at least merchant and amount are filled
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Receipt Storage
**Description:** As a user tracking expenses, I want my receipt photos stored securely so that I have proof of purchase for tax purposes.

**Acceptance Criteria:**
- [ ] Original receipt image stored with expense record
- [ ] Thumbnail generated for list view (<100KB)
- [ ] Images encrypted at rest using AES-256
- [ ] User can download original receipt image anytime
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Support JPG, PNG, HEIC image formats up to 10MB
- FR-2: OCR engine must extract: merchant name, total amount, tax amount (if present), date, and items list (optional)
- FR-3: Confidence score calculated per field (0-100%)
- FR-4: Manual correction form with validation for required fields
- FR-5: Receipt images stored in cloud storage with user-specific encryption
- FR-6: Support batch upload of up to 10 receipts at once
- FR-7: Auto-rotate receipts based on text orientation detection

## Non-Goals
- No handwriting recognition (printed receipts only)
- No support for non-Latin scripts (v2 consideration)
- No automatic currency conversion
- No line-item extraction in v1 (total amount only)
- No duplicate receipt detection in v1

## Technical Considerations
- OCR Engine: Google Vision API or Tesseract.js for on-device processing
- Image preprocessing: deskew, contrast enhancement, noise reduction
- Storage: Cloud object storage with server-side encryption
- Mobile: React Native or Flutter camera integration
- Offline mode: Queue receipts for processing when connection restored

## Success Metrics
- 85%+ of receipts successfully processed without manual intervention
- Average time from photo to saved expense: <30 seconds
- User correction rate: <15% of fields need editing
- NPS score for receipt capture feature: >40
