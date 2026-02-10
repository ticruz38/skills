---
title: Report Builder
skill_id: report-builder
description: Build automated data reports with scheduled delivery
category: data
tags: [reports, automation, scheduling, charts, email, data-analysis]
requirements:
  - data-connector (for data source integration)
  - chart-generator (for visualizations)
  - email (for report delivery)
actions:
  - create-template
  - schedule
  - generate
  - export
  - email
---

# Report Builder

Build automated data reports with scheduled delivery. Create report templates, schedule automated generation, and deliver reports via email in multiple formats.

## Features

- **Report Templates**: Define reusable report configurations with aggregation and filtering
- **Scheduled Reports**: Automate report generation on daily, weekly, monthly, or custom schedules
- **Data Aggregation**: Sum, average, count, min, max operations on data
- **Visualizations**: Integrated charts from chart-generator
- **Multi-format Export**: HTML, CSV, JSON, PDF-ready reports
- **Email Delivery**: Automatic report delivery to specified recipients
- **Report History**: Track all generated reports with metadata

## Installation

```bash
npm install
npm run build
```

## Configuration

The report builder requires the following dependencies to be configured:

1. **data-connector**: Set up data connections to your sources
2. **chart-generator**: No additional config needed
3. **email**: Configure Gmail OAuth for email delivery

## Usage

### CLI

```bash
# Check health
npm run status

# Create a report template
npm run cli -- template-create --name "Sales Report" --connection 1 --value Revenue --label Month --chart bar

# List templates
npm run cli -- template-list

# Create a scheduled report
npm run cli -- schedule-create --template 1 --name "Weekly Sales" --period weekly --day-of-week 1 --time 09:00 --formats html,csv --recipients team@company.com

# Generate report immediately
npm run cli -- generate 1 --output report.html

# Execute a scheduled report
npm run cli -- execute 1

# Check and run due reports
npm run cli -- due

# View report history
npm run cli -- history

# Show statistics
npm run cli -- stats
```

### Library

```typescript
import { ReportBuilderSkill } from '@openclaw/report-builder';

const skill = new ReportBuilderSkill();

// Create a report template
const template = await skill.createTemplate({
  name: 'Monthly Sales Report',
  description: 'Revenue by month',
  connectionId: 1,
  aggregationType: 'sum',
  groupByColumn: 'Month',
  valueColumn: 'Revenue',
  labelColumn: 'Month',
  chartType: 'bar',
  includeChart: true,
  includeTable: true,
  includeSummary: true
});

// Create a scheduled report
const schedule = await skill.createSchedule({
  templateId: template.id!,
  name: 'Weekly Sales Email',
  period: 'weekly',
  dayOfWeek: 1, // Monday
  timeOfDay: '09:00',
  formats: ['html', 'csv'],
  emailRecipients: ['boss@company.com', 'team@company.com'],
  emailSubject: 'Weekly Sales Report',
  enabled: true
});

// Generate report immediately
const htmlReport = await skill.generateHtmlReport(template.id!);
fs.writeFileSync('report.html', htmlReport);

// Execute scheduled report
const results = await skill.executeReport(schedule.id!);

// Check for and run due reports
const dueResults = await skill.checkAndExecuteDueReports();

// Close
await skill.close();
```

## Report Templates

Templates define the structure and content of reports:

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Template name |
| `description` | string | Optional description |
| `connectionId` | number | Data connection ID |
| `query` | string | Optional SQL-like filter |
| `aggregationType` | string | sum, average, count, min, max, none |
| `groupByColumn` | string | Column to group by |
| `valueColumn` | string | Column to aggregate/chart |
| `labelColumn` | string | Column for chart labels |
| `chartType` | string | bar, line, pie, doughnut, area, none |
| `includeChart` | boolean | Include visualization |
| `includeTable` | boolean | Include data table |
| `includeSummary` | boolean | Include summary section |
| `filters` | string | JSON filter conditions |

## Scheduled Reports

Schedules control when and how reports are generated:

| Property | Type | Description |
|----------|------|-------------|
| `templateId` | number | Template to use |
| `name` | string | Schedule name |
| `period` | string | daily, weekly, monthly, quarterly, yearly |
| `dayOfWeek` | number | 0-6 for weekly (0=Sunday) |
| `dayOfMonth` | number | 1-31 for monthly |
| `timeOfDay` | string | HH:MM format |
| `formats` | string[] | html, csv, json, pdf |
| `emailRecipients` | string[] | Email addresses |
| `emailSubject` | string | Email subject |
| `emailBody` | string | Email message |
| `enabled` | boolean | Whether schedule is active |

## Report Formats

### HTML
Full-featured report with:
- Professional styling
- Summary statistics
- Interactive charts (SVG)
- Sortable data tables

### CSV
Raw data export:
- Header row
- Comma-separated values
- Proper escaping for special characters

### JSON
Structured data export:
```json
{
  "generatedAt": "2024-01-15T10:00:00Z",
  "summary": {
    "total": 150,
    "aggregated": { "Q1": 45000, "Q2": 52000 }
  },
  "data": [...]
}
```

### PDF
PDF-ready HTML output - convert using external tools:
```bash
# Using Chrome headless
google-chrome --headless --print-to-pdf report.html

# Using wkhtmltopdf
wkhtmltopdf report.html report.pdf
```

## Aggregation Types

- **sum**: Total of values
- **average**: Mean of values
- **count**: Number of records
- **min**: Minimum value
- **max**: Maximum value
- **none**: No aggregation (raw data)

## Automation

Set up a cron job to check for due reports:

```bash
# Edit crontab
crontab -e

# Run every hour
0 * * * * cd /path/to/report-builder && npm run cli -- due
```

Or use with systemd timer for more control.

## Report History

All generated reports are tracked with:
- Generation timestamp
- Format and file location
- Record count
- Success/failure status
- Email delivery status

## Examples

### Sales Dashboard Report
```bash
# Create template with chart
npm run cli -- template-create \
  --name "Sales Dashboard" \
  --connection 1 \
  --aggregation sum \
  --group-by Region \
  --value Sales \
  --label Region \
  --chart bar \
  --include-chart \
  --include-summary

# Schedule weekly delivery
npm run cli -- schedule-create \
  --template 1 \
  --name "Weekly Sales Dashboard" \
  --period weekly \
  --day-of-week 1 \
  --time 08:00 \
  --formats html,csv \
  --recipients sales@company.com \
  --subject "Weekly Sales Report"
```

### Monthly Financial Report
```bash
# Create template
npm run cli -- template-create \
  --name "Monthly P&L" \
  --connection 2 \
  --aggregation sum \
  --group-by Category \
  --value Amount \
  --chart pie

# Schedule monthly
npm run cli -- schedule-create \
  --template 2 \
  --name "Monthly P&L Report" \
  --period monthly \
  --day-of-month 1 \
  --time 09:00 \
  --formats html,pdf \
  --recipients cfo@company.com,finance@company.com
```

### Ad-hoc Report Generation
```bash
# Generate immediately
npm run cli -- generate 1 --output /tmp/sales.html

# Preview data
npm run cli -- preview 1
```
