---
title: Receipts OCR
skill_id: receipts-ocr
description: Extract data from receipt photos using Google Vision API
author: OpenClaw
version: 1.0.0
dependencies:
  - google-oauth
---

# Receipts OCR Skill

Extract data from receipt photos using Google Vision API. Automatically identifies merchant names, amounts, dates, and line items with confidence scoring.

## Features

- **OCR Processing**: Uses Google Vision API for accurate text extraction
- **Smart Parsing**: Automatically extracts merchant, total, tax, date, and line items
- **Confidence Scoring**: Each field includes confidence level (0-100%)
- **Category Detection**: Auto-categorizes receipts (Groceries, Dining, Gas, etc.)
- **Manual Correction**: Update any extracted field manually
- **Image Storage**: Optionally copies images to local storage
- **Export**: Export to CSV for accounting software

## Installation

```bash
cd skills/receipts-ocr
npm install
npm run build
```

## Configuration

Uses the same Google OAuth profile as other Google services. Ensure you have connected Google OAuth first:

```bash
npm run cli -- status
```

## Usage

### CLI

```bash
# Check status
npm run cli -- status

# Scan a receipt
npm run cli -- scan receipt.jpg --copy --notes "Business lunch"

# Extract text without saving
npm run cli -- text receipt.jpg

# List all receipts
npm run cli -- list
npm run cli -- list --status pending --limit 10

# Get receipt details
npm run cli -- get 1

# Update receipt
npm run cli -- update 1 --merchant "Starbucks" --total 12.50 --category "Dining"

# Confirm/reject receipt
npm run cli -- confirm 1
npm run cli -- reject 1

# Delete receipt
npm run cli -- delete 1

# Statistics
npm run cli -- stats

# Export to CSV
npm run cli -- export receipts.csv
```

### Library

```typescript
import { ReceiptsOCRSkill } from '@openclaw/receipts-ocr';

const skill = new ReceiptsOCRSkill({ profile: 'default' });

// Process a receipt
const receipt = await skill.processReceipt('/path/to/receipt.jpg', {
  copyImage: true,
  notes: 'Business expense'
});

console.log(receipt.merchant);  // "Starbucks"
console.log(receipt.totalAmount);  // 12.50
console.log(receipt.totalConfidence);  // 0.85

// List receipts
const receipts = await skill.listReceipts({ status: 'pending' });

// Update with corrections
await skill.updateReceipt(receipt.id!, {
  merchant: 'Corrected Name',
  totalAmount: 15.00,
  status: 'corrected'
});

// Export to CSV
const csv = await skill.exportToCSV();
fs.writeFileSync('receipts.csv', csv);

await skill.close();
```

## Data Storage

Receipts are stored in `~/.openclaw/skills/receipts-ocr/`:
- `receipts.db` - SQLite database with receipt data and line items
- `images/` - Copied receipt images (if --copy flag used)

## Confidence Scoring

Each extracted field has a confidence score:
- **High (80-100%)**: Green - Likely accurate
- **Medium (50-79%)**: Yellow - Review recommended
- **Low (<50%)**: Red - Manual verification needed

## Supported Image Formats

- JPEG/JPG
- PNG
- GIF
- BMP
- TIFF
- WebP

## Categories

Auto-detected categories include:
- Groceries
- Dining
- Gas
- Pharmacy
- Office
- Electronics
- Transportation
- Entertainment
- Retail

## Schema

### Receipts Table
- `id` - Primary key
- `image_path` - Path to receipt image
- `merchant` - Store/restaurant name
- `merchant_confidence` - OCR confidence (0-1)
- `total_amount` - Total amount
- `total_confidence` - OCR confidence (0-1)
- `tax_amount` - Tax amount
- `tax_confidence` - OCR confidence (0-1)
- `date` - Transaction date (ISO format)
- `date_confidence` - OCR confidence (0-1)
- `category` - Expense category
- `payment_method` - Payment type
- `raw_text` - Full OCR text
- `status` - pending/confirmed/corrected/rejected
- `notes` - User notes

### Line Items Table
- `id` - Primary key
- `receipt_id` - Foreign key to receipt
- `description` - Item description
- `quantity` - Quantity purchased
- `unit_price` - Price per unit
- `total` - Line total
- `confidence` - OCR confidence (0-1)
