---
title: Tax Export
skill_id: tax-export
description: Export expenses for tax filing with multiple formats
author: OpenClaw
version: 1.0.0
dependencies:
  - expense-categorizer
---

# Tax Export Skill

Export categorized expenses for tax filing in multiple formats including CSV, PDF, and bundled receipt attachments.

## Features

- **CSV Export**: Export expenses to CSV format for spreadsheet applications
- **PDF Reports**: Generate professional PDF expense reports
- **Deductible Filtering**: Filter expenses by deductible status and category
- **IRS Category Mapping**: Map expense categories to IRS tax categories
- **Receipt Attachment Bundling**: Bundle receipt images with export for audit support

## Installation

```bash
cd skills/tax-export
npm install
npm run build
```

## Usage

### CLI

```bash
# Check status
npm run cli -- status

# Export to CSV
npm run cli -- csv --year 2024 --output expenses-2024.csv

# Export with deductible filtering
npm run cli -- csv --year 2024 --deductible-only --output deductible-2024.csv

# Export by category
npm run cli -- csv --category "Office Expenses" --output office-expenses.csv

# Generate PDF report
npm run cli -- pdf --year 2024 --output report-2024.pdf

# Bundle receipt attachments
npm run cli -- bundle --year 2024 --output receipts-2024.zip

# Combined export with receipts
npm run cli -- export --year 2024 --output tax-package-2024/
```

### Library

```typescript
import { TaxExportSkill } from '@openclaw/tax-export';

const taxExport = new TaxExportSkill();

// Export to CSV
const csv = await taxExport.exportToCSV({ year: 2024 });
await taxExport.saveExport(csv, 'expenses-2024.csv');

// Export with filters
const deductibleCsv = await taxExport.exportToCSV({
  year: 2024,
  deductibleOnly: true,
  category: 'Office Expenses'
});

// Generate PDF report
const pdf = await taxExport.generatePDF({ year: 2024 });
await taxExport.saveExport(pdf, 'report-2024.pdf');

// Bundle receipts
const bundle = await taxExport.bundleReceipts({ year: 2024 });
await taxExport.saveExport(bundle, 'receipts-2024.zip');

// Full tax export package
await taxExport.exportTaxPackage(2024, './tax-package-2024');
```

## IRS Category Mappings

Default mappings from expense categories to IRS Schedule C categories:

| Expense Category | IRS Category |
|-----------------|--------------|
| Office | Office Expense |
| Electronics | Office Expense |
| Dining | Meals (50%) |
| Travel | Travel |
| Transportation | Car and Truck Expenses |
| Gas | Car and Truck Expenses |
| Utilities | Utilities |
| Healthcare | Employee Benefit Programs |
| Entertainment | Entertainment |
| Professional Services | Legal and Professional Services |
| Advertising | Advertising |

## Data Storage

Data is stored in SQLite at `~/.openclaw/skills/tax-export/`:
- `export_history` - Track all exports with metadata
- `irs_mappings` - Custom IRS category mappings
- `export_templates` - Saved export configurations
