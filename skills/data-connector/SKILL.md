---
title: Data Connector
skill_id: data-connector
description: Connect to Google Sheets, Airtable, and CSV files for data management
category: data
tags: [spreadsheets, google-sheets, airtable, csv, data-sync]
requirements:
  - google-oauth (for Google Sheets access)
  - AIRTABLE_API_KEY environment variable (for Airtable)
actions:
  - connect
  - read
  - write
  - sync
  - cache
  - export
  - import
---

# Data Connector

Connect to Google Sheets, Airtable, and CSV files for unified data management.

## Features

- **Google Sheets**: Read, write, and append data to spreadsheets
- **Airtable**: Full CRUD operations with batch support
- **CSV**: Import/export with type conversion and flexible parsing
- **Caching**: Local SQLite cache for offline access and performance
- **Sync**: One-command sync from any source to local cache

## Installation

```bash
npm install
npm run build
```

## Configuration

### Google Sheets
Requires `google-oauth` skill to be connected with Sheets scopes:
```bash
google-oauth connect sheets
```

### Airtable
Set environment variable:
```bash
export AIRTABLE_API_KEY=your_api_key
```

Or provide key per connection during setup.

## Usage

### CLI

```bash
# Check health
npm run status

# List connections
npm run cli -- list

# Add connections
npm run cli -- add my-sheet google-sheets
npm run cli -- add my-base airtable
npm run cli -- add local-data csv

# Sync data to cache
npm run cli -- sync

# Read data
npm run cli -- read 1

# Import/export CSV
npm run cli -- import data.csv my-sheet
npm run cli -- export 1 output.csv
```

### Library

```typescript
import { DataConnectorSkill } from '@openclaw/data-connector';

const skill = new DataConnectorSkill();

// Create connection
const conn = await skill.createConnection('sales-data', 'google-sheets', {
  spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
  sheetName: 'Sheet1',
  range: 'A1:Z1000',
  hasHeaderRow: true
});

// Read data
const data = await skill.readFromSource(conn);

// Sync to cache
await skill.cacheData(conn.id!, data);

// Close
await skill.close();
```

## Connection Types

### Google Sheets
- `spreadsheetId`: From URL (e.g., `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`)
- `sheetName`: Tab name (default: `Sheet1`)
- `range`: A1 notation range (default: `A1:Z1000`)
- `hasHeaderRow`: First row contains headers (default: true)

### Airtable
- `baseId`: From API documentation
- `tableName`: Name of the table
- `apiKey`: Optional override for env var

### CSV
- `filePath`: Path to CSV file
- `delimiter`: Field separator (default: `,`)
- `hasHeaderRow`: First row contains headers (default: true)
- `encoding`: File encoding (default: `utf-8`)

## Data Format

All data is returned as arrays of objects:
```typescript
[
  { _rowIndex: 2, Name: 'Alice', Age: 30, Active: true },
  { _rowIndex: 3, Name: 'Bob', Age: 25, Active: false }
]
```

Internal fields (starting with `_`) are automatically managed:
- `_rowIndex`: Row number in source
- `_airtableId`: Airtable record ID
- `_createdTime`: Airtable record creation time
