# PRD: Tax Export

## Introduction
Enable users to export their expense data in formats suitable for tax filing and accountant review. This feature filters deductible expenses, maps categories to tax codes, and generates clean reports that simplify tax preparation.

## Goals
- Export expenses to CSV and PDF formats
- Filter by tax-deductible categories and custom date ranges
- Map app categories to standard tax category codes
- Generate accountant-friendly formatted reports
- Support multiple tax years and amendment exports

## User Stories

### US-001: CSV Export
**Description:** As a user preparing my taxes, I want to export my expenses as a CSV file so that I can import them into tax software or share with my accountant.

**Acceptance Criteria:**
- [ ] Export button generates CSV with standard columns: Date, Merchant, Category, Amount, Tax Amount, Receipt URL
- [ ] CSV uses UTF-8 encoding with BOM for Excel compatibility
- [ ] Date format selectable: MM/DD/YYYY or DD/MM/YYYY or ISO 8601
- [ ] Amount format includes 2 decimal places and currency symbol option
- [ ] File download triggers automatically with timestamped filename
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: PDF Report Generation
**Description:** As a user preparing my taxes, I want a formatted PDF report of my expenses so that I have a professional document for records or submission.

**Acceptance Criteria:**
- [ ] PDF includes summary page with totals by category
- [ ] Individual expense details in table format
- [ ] Receipt thumbnails embedded (optional, configurable)
- [ ] Page numbers and date range in footer
- [ ] PDF is searchable (not scanned image)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Deductible Expense Filtering
**Description:** As a user preparing my taxes, I want to filter only tax-deductible expenses so that I don't include personal expenses in my business tax filing.

**Acceptance Criteria:**
- [ ] Toggle to show only tax-deductible categories
- [ ] Custom tag for "Deductible" that can be applied to any expense
- [ ] Filter by tax year (Jan 1 - Dec 31) or custom date range
- [ ] Filter by minimum amount threshold
- [ ] Saved filter presets for common scenarios
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Tax Category Mapping
**Description:** As a user preparing my taxes, I want my expense categories mapped to standard tax categories so that my accountant understands the breakdown.

**Acceptance Criteria:**
- [ ] Default mapping from app categories to IRS Schedule C categories
- [ ] User can customize mapping per category
- [ ] Mapping editor shows preview of how expenses will be grouped
- [ ] Support for Schedule C, Schedule E, and custom tax category schemes
- [ ] Export includes tax category code column
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Accountant Package Export
**Description:** As a user working with an accountant, I want to export a complete package with all receipts and summaries so that my accountant has everything needed.

**Acceptance Criteria:**
- [ ] Generate ZIP file containing: CSV export, PDF summary, and receipt images folder
- [ ] Receipt images organized by month or category (user choice)
- [ ] README file included explaining file structure
- [ ] Summary Excel file with pivot tables pre-built
- [ ] File size warning if export exceeds 100MB
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Export formats: CSV (RFC 4180 compliant), PDF (PDF/A for archival)
- FR-2: Default tax categories map to IRS Schedule C: Advertising, Car/Truck, Commissions, Contract Labor, Depletion, Depreciation, Employee Benefits, Insurance, Interest, Legal/Professional, Office Expense, Pension, Rent/Leasing, Repairs, Supplies, Taxes/Licenses, Travel, Meals, Utilities, Wages, Other
- FR-3: Date range selection: preset (This Year, Last Year, Quarter 1-4, Custom)
- FR-4: Export includes: total count, total amount, total tax amount
- FR-5: Receipt images included as: embedded (PDF), linked files (ZIP), or URLs only (CSV)
- FR-6: Export history logged with timestamp and filter criteria used

## Non-Goals
- No direct integration with TurboTax, H&R Block, etc. in v1
- No automatic tax calculation or form filling
- No multi-currency conversion (export in original currency)
- No expense splitting (e.g., 50% business meals)
- No audit trail or tamper-proof certification

## Technical Considerations
- CSV Generation: Server-side streaming to handle large datasets (>10k expenses)
- PDF Generation: jsPDF or Puppeteer for server-side rendering
- ZIP Creation: Streamed zip generation to minimize memory usage
- Storage: Temporary export files deleted after 24 hours
- Security: Exports require re-authentication for sensitive operations

## Success Metrics
- 90%+ of exports successfully generated without errors
- Average export time: <10 seconds for 1000 expenses
- 70%+ of users export at least once per tax year
- Zero PII leaks in exported files (verified via audit)
