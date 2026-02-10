---
title: Chart Generator
skill_id: chart-generator
description: Generate charts and visualizations from data sources
category: data
tags: [charts, visualization, graphs, svg, data-viz]
requirements:
  - data-connector (for data source integration)
actions:
  - generate
  - customize
  - export
  - template
---

# Chart Generator

Generate beautiful charts and visualizations from data sources. Supports bar, line, pie, doughnut, and area charts with customizable themes and export options.

## Features

- **Chart Types**: Bar, line, pie, doughnut, and area charts
- **Data Sources**: JSON files, data-connector cached data
- **Customization**: Themes, colors, titles, axis labels
- **Export**: SVG format (PNG-compatible via conversion tools)
- **Templates**: Save and reuse chart configurations
- **Embeddable**: Generate HTML code for web pages

## Installation

```bash
npm install
npm run build
```

## Configuration

No additional configuration required. Charts are generated locally with no external API dependencies.

## Usage

### CLI

```bash
# Generate a bar chart from JSON data
npm run cli -- generate bar --data sales.json --output chart.svg --title "Sales Report"

# Generate a line chart from data connection
npm run cli -- from-connection 1 --label-column "Month" --value-column "Revenue" --type line --output revenue.svg

# Generate a pie chart
npm run cli -- generate pie --data categories.json --output pie.svg --theme colorful

# Save a template
npm run cli -- template save monthly-sales --type bar --title "Monthly Sales" --width 1000

# List templates
npm run cli -- template list

# Generate from template
npm run cli -- template generate monthly-sales --output report.svg

# Check health
npm run cli -- health
```

### Library

```typescript
import { ChartGeneratorSkill, ChartConfig, DataPoint } from '@openclaw/chart-generator';

const skill = new ChartGeneratorSkill();

// Generate from data
const data: DataPoint[] = [
  { label: 'Jan', value: 100 },
  { label: 'Feb', value: 150 },
  { label: 'Mar', value: 200 }
];

const config: ChartConfig = {
  type: 'bar',
  title: 'Monthly Sales',
  width: 800,
  height: 600,
  theme: 'light'
};

const result = skill.generateChart(data, config);

// Save to file
skill.saveChart(result, 'chart.svg');

// Or get embeddable HTML
const html = skill.generateEmbeddableCode(result);

// Close
await skill.close();
```

### Generate from Data Connection

```typescript
// Generate chart from cached data connector data
const result = await skill.generateFromConnection(
  1, // connection ID
  'Month', // label column
  'Revenue', // value column
  {
    type: 'line',
    title: 'Revenue Trend',
    theme: 'colorful'
  }
);

skill.saveChart(result, 'revenue.svg');
```

### Templates

```typescript
// Save a template
await skill.saveTemplate({
  name: 'monthly-sales',
  type: 'bar',
  config: {
    type: 'bar',
    title: 'Monthly Sales',
    width: 1000,
    height: 600
  },
  dataSource: {
    connectionId: 1,
    labelColumn: 'Month',
    valueColumn: 'Sales'
  }
});

// Generate from template
const result = await skill.generateFromTemplate('monthly-sales');
skill.saveChart(result, 'output.svg');

// List templates
const templates = await skill.listTemplates();
```

## Data Format

JSON data file format:
```json
[
  { "label": "January", "value": 1000 },
  { "label": "February", "value": 1500 },
  { "label": "March", "value": 1200 }
]
```

For multi-series charts:
```json
[
  {
    "name": "Product A",
    "data": [
      { "label": "Q1", "value": 100 },
      { "label": "Q2", "value": 150 }
    ]
  },
  {
    "name": "Product B",
    "data": [
      { "label": "Q1", "value": 80 },
      { "label": "Q2", "value": 200 }
    ]
  }
]
```

## Chart Types

### Bar Chart
- Single or multi-series
- Vertical bars
- Value labels on bars
- Legend for multi-series

### Line Chart
- Single or multi-series
- Points and connecting lines
- Smooth connections
- Configurable grid

### Area Chart
- Stacked area visualization
- Filled regions under lines
- Good for showing volume/totals

### Pie Chart
- Single series only
- Percentage labels
- Color-coded slices
- Interactive tooltips

### Doughnut Chart
- Single series only
- Center area for total display
- Modern alternative to pie charts

## Themes

- **light**: Clean white background, professional colors
- **dark**: Dark background, vibrant colors
- **colorful**: Light background, bright accent colors

## Custom Colors

```typescript
const config: ChartConfig = {
  type: 'bar',
  colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4']
};
```

## Export Formats

- **SVG**: Scalable vector graphics (default)
- **HTML**: Embeddable div with inline SVG
- **PNG**: Convert SVG to PNG using external tools like:
  - `rsvg-convert` (librsvg)
  - Inkscape
  - Online converters

Example PNG conversion:
```bash
rsvg-convert chart.svg -o chart.png
```
