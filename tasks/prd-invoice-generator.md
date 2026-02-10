# PRD: Invoice Generator

## Introduction
A professional invoice generation system for freelancers and small business owners to create, customize, and send branded PDF invoices to clients. This tool eliminates the need for manual invoice creation in spreadsheets or expensive accounting software, providing a streamlined workflow for billing clients.

## Goals
- Generate professional PDF invoices with customizable templates
- Support flexible line items with quantities, rates, and automatic calculations
- Handle tax calculations (VAT, GST, sales tax) based on jurisdiction
- Allow branding customization (logo, colors, business details)
- Enable recurring invoices for subscription-based billing

## User Stories

### US-001: Create Basic Invoice
**Description:** As a freelancer, I want to create a professional invoice with my business details so that I can bill clients professionally.

**Acceptance Criteria:**
- [ ] Invoice form with business name, address, and contact details
- [ ] Client information fields (name, email, billing address)
- [ ] Invoice number and date fields with auto-generation
- [ ] Due date selection with configurable default (e.g., Net 30)
- [ ] Typecheck passes

### US-002: Add Line Items
**Description:** As a business owner, I want to add multiple line items with descriptions, quantities, and rates so that I can itemize my services/products.

**Acceptance Criteria:**
- [ ] Dynamic line item rows (add/remove)
- [ ] Fields: description, quantity, unit price
- [ ] Automatic subtotal calculation per line
- [ ] Automatic invoice total calculation
- [ ] Typecheck passes

### US-003: Configure Tax Settings
**Description:** As a freelancer, I want to add tax to my invoices based on my location and client location so that I remain compliant with tax regulations.

**Acceptance Criteria:**
- [ ] Tax rate input with preset options (e.g., 0%, 5%, 10%, 20%)
- [ ] Tax name customization (VAT, GST, Sales Tax, etc.)
- [ ] Tax calculation displayed separately from subtotal
- [ ] Option to make invoice tax-inclusive or tax-exclusive
- [ ] Typecheck passes

### US-004: Customize Invoice Template
**Description:** As a business owner, I want to customize my invoice appearance with my logo and brand colors so that it looks professional and on-brand.

**Acceptance Criteria:**
- [ ] Logo upload functionality (PNG/JPG/SVG)
- [ ] Accent color picker for headers and highlights
- [ ] Font selection (serif, sans-serif, monospace)
- [ ] Template layout options (modern, classic, minimal)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Generate PDF Invoice
**Description:** As a freelancer, I want to generate a downloadable PDF of my invoice so that I can send it to clients via email or other channels.

**Acceptance Criteria:**
- [ ] PDF generation with proper formatting
- [ ] Page breaks handled correctly for multi-page invoices
- [ ] Download button with filename format: "Invoice-[Number]-[Client].pdf"
- [ ] PDF includes all branding, line items, and totals
- [ ] Typecheck passes

### US-006: Save and Manage Invoice Drafts
**Description:** As a business owner, I want to save invoice drafts so that I can complete them later without losing my work.

**Acceptance Criteria:**
- [ ] Auto-save functionality with timestamp
- [ ] Draft status indicator
- [ ] List view of all drafts with client name and date
- [ ] Ability to edit and finalize drafts
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Invoice data model with fields: invoice number, issue date, due date, business info, client info, line items, tax, total
- FR-2: Line item model with: description, quantity, unit price, subtotal
- FR-3: PDF generation using headless browser or PDF library
- FR-4: Logo image storage and retrieval
- FR-5: Invoice numbering with customizable prefix and auto-increment
- FR-6: Draft saving with local storage or database persistence
- FR-7: Template system supporting multiple layouts
- FR-8: Tax calculation engine supporting various tax types

## Non-Goals
- Payment processing or payment gateway integration
- Multi-currency support (single currency only for MVP)
- Inventory management
- Accounting ledger or bookkeeping features
- Client portal for viewing invoices
- Electronic signature collection

## Technical Considerations
- **PDF Generation:** Use libraries like Puppeteer, Playwright, or jsPDF for server/client-side PDF creation
- **Image Handling:** Store uploaded logos with size limits and format validation
- **Data Persistence:** LocalStorage for drafts, database for finalized invoices
- **Template Engine:** React components or HTML templates with CSS for styling
- **File Storage:** Cloud storage or local file system for generated PDFs

## Success Metrics
- Invoice created in under 3 minutes from start to PDF
- PDF renders correctly on all major devices and PDF readers
- Logo uploads succeed for standard formats (PNG, JPG up to 2MB)
- Invoice numbering remains sequential with no duplicates

## Open Questions
- Should we support multiple currencies in future versions?
- Should invoice templates be exportable/importable?
- Do we need to support multiple tax rates per invoice (e.g., different rates per line item)?
