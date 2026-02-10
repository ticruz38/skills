---
title: Tax Preparation
skill_id: tax-prep
description: Compile tax documents and summaries from invoices and receipts
category: accounting
tags: [tax, accounting, schedule-c, deductions, 1099, turbotax]
author: OpenClaw
version: 1.0.0
---

# Tax Preparation Skill

Compile tax documents and summaries for tax filing from your invoices and receipts.

## Features

- **Deductible Expense Categorization**: Auto-categorize expenses using IRS categories
- **Schedule C Generation**: Generate Schedule C (Profit or Loss from Business) summaries
- **1099 Tracking**: Track payments to contractors requiring 1099 forms
- **TurboTax Export**: Export data compatible with TurboTax
- **Accountant Package**: Generate comprehensive package for your accountant

## Installation

```bash
cd skills/tax-prep
npm install
npm run build
```

## Dependencies

- `invoices` skill - for income tracking
- `receipts-ocr` skill - for expense tracking

## CLI Usage

### Check Status
```bash
npm run status
```

### Categorize Expenses
```bash
# Categorize all uncategorized expenses
npm run cli -- categorize

# Categorize specific date range
npm run cli -- categorize --year 2024
npm run cli -- categorize --start-date 2024-01-01 --end-date 2024-12-31
```

### View Deductions
```bash
# View all deductible expenses
npm run cli -- deductions

# View by category
npm run cli -- deductions --category "Office Expenses"

# Export deductions
npm run cli -- deductions --export deductions-2024.csv
```

### Generate Schedule C
```bash
# Generate Schedule C for tax year
npm run cli -- schedule-c --year 2024

# Export to file
npm run cli -- schedule-c --year 2024 --export schedule-c-2024.html
```

### Track 1099 Contractors
```bash
# List contractors requiring 1099s
npm run cli -- contractors

# Check specific contractor
npm run cli -- contractors --name "John Smith"

# Export 1099 summary
npm run cli -- contractors --year 2024 --export 1099s-2024.csv
```

### Export for TurboTax
```bash
npm run cli -- turbotax --year 2024 --output turbotax-2024.csv
```

### Generate Accountant Package
```bash
# Generate complete package
npm run cli -- package --year 2024 --output ./tax-package-2024

# Package includes:
# - Income summary
# - Expense breakdown by category
# - Schedule C worksheet
# - 1099 contractor list
# - Receipt images (optional)
```

## Library Usage

```typescript
import { TaxPrepSkill } from '@openclaw/tax-prep';

const taxPrep = new TaxPrepSkill();

// Categorize expenses
await taxPrep.categorizeExpenses({ year: 2024 });

// Get deductions by category
const deductions = await taxPrep.getDeductions({
  startDate: '2024-01-01',
  endDate: '2024-12-31'
});

// Generate Schedule C
const scheduleC = await taxPrep.generateScheduleC(2024);

// Get 1099 contractors
const contractors = await taxPrep.get1099Contractors({ year: 2024 });

// Export for TurboTax
const turbotaxData = await taxPrep.exportForTurboTax(2024);

// Generate accountant package
await taxPrep.generateAccountantPackage(2024, './tax-package');
```

## IRS Expense Categories

The skill uses standard IRS Schedule C categories:

- **Advertising**: Marketing, advertising, promotion costs
- **Car and Truck Expenses**: Vehicle expenses, mileage
- **Commissions and Fees**: Payments to subcontractors
- **Contract Labor**: Independent contractor payments
- **Depletion**: Natural resource depletion
- **Depreciation**: Asset depreciation
- **Employee Benefit Programs**: Health insurance, retirement plans
- **Insurance**: Business insurance premiums
- **Interest**: Business loan interest
- **Legal and Professional Services**: Legal fees, accounting
- **Office Expense**: Office supplies, equipment
- **Pension and Profit Sharing Plans**: Retirement contributions
- **Rent or Lease**: Equipment, vehicle, property rent
- **Repairs and Maintenance**: Equipment repairs
- **Supplies**: Materials and supplies
- **Taxes and Licenses**: Business licenses, property taxes
- **Travel**: Business travel expenses
- **Meals**: Business meals (50% deductible)
- **Utilities**: Electricity, water, internet, phone
- **Wages**: Employee salaries and wages
- **Other Expenses**: Miscellaneous business expenses

## Data Storage

Data is stored in SQLite at `~/.openclaw/skills/tax-prep/`:
- `tax_categories` - IRS category mappings
- `expense_categories` - Receipt categorization
- `tax_years` - Tax year summaries
- `contractor_payments` - 1099 tracking

## Notes

- This skill provides data organization for tax preparation
- Consult a tax professional for tax advice
- Keep original receipts for audit purposes
- Review auto-categorizations for accuracy
