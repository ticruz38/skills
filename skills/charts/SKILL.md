---
title: Price Charts & Technical Analysis
skill_id: charts
category: finance
description: Generate price charts and technical overlays for crypto trading
version: 1.0.0
author: OpenClaw
requirements:
  - binance skill configured
  - Binance API connection (testnet or production)
---

# Charts Skill

Generate price charts and technical overlays for cryptocurrency trading. Creates beautiful SVG charts with candlesticks, line charts, volume bars, and moving averages.

## Features

- **Line Charts**: Simple price history visualization
- **Candlestick Charts**: OHLC (Open, High, Low, Close) charts with volume
- **Multiple Timeframes**: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M
- **Moving Averages**: SMA (Simple Moving Average) with configurable periods
- **Volume Overlay**: Show trading volume on charts
- **Export Options**: PNG (via SVG conversion) and SVG formats
- **Multi-profile**: Support multiple Binance accounts

## Installation

```bash
cd skills/charts
npm install
npm run build
```

## Configuration

This skill requires the `binance` skill to be configured first:

```bash
# Configure binance authentication
binance-auth-cli connect --testnet  # or without --testnet for production
```

## Usage

### Check Status

```bash
# Check connection status
charts-cli status

# Check health
charts-cli health
```

### Generate Charts

```bash
# Simple line chart (last 100 candles, 1h interval)
charts-cli line BTCUSDT

# Line chart with specific interval and limit
charts-cli line BTCUSDT --interval 1d --limit 30

# Candlestick chart with volume
charts-cli candle BTCUSDT --interval 4h --limit 50 --volume

# Chart with moving averages
charts-cli line BTCUSDT --ma 7 --ma 30

# Candlestick with MAs
charts-cli candle BTCUSDT --ma 20 --ma 50 --volume

# Save to specific file
charts-cli line BTCUSDT --output ./btc_chart.svg

# Generate PNG (via SVG)
charts-cli line BTCUSDT --format png --output ./btc_chart.png
```

### Available Intervals

- `1m` - 1 minute
- `5m` - 5 minutes
- `15m` - 15 minutes
- `30m` - 30 minutes
- `1h` - 1 hour
- `4h` - 4 hours
- `1d` - 1 day
- `1w` - 1 week
- `1M` - 1 month

### Chart Types

**Line Chart**: Simple price line showing closing prices
```bash
charts-cli line ETHUSDT --interval 1h --limit 100
```

**Candlestick Chart**: Full OHLC with wicks and bodies
```bash
charts-cli candle BTCUSDT --interval 4h --limit 50 --volume --ma 20
```

### Using Different Profiles

```bash
# Use a specific profile (for multiple accounts)
charts-cli --profile trading line BTCUSDT
charts-cli --profile hodl candle ETHUSDT
```

## Programmatic API

```typescript
import { ChartsSkill, getChartsSkill, ChartType, OutputFormat } from '@openclaw/charts';

// Create skill instance
const skill = getChartsSkill('default');

// Check connection
const connected = await skill.isConnected();

// Generate line chart
const lineChart = await skill.generateLineChart('BTCUSDT', {
  interval: '1h',
  limit: 100,
  movingAverages: [7, 30],
  width: 1200,
  height: 600,
});

// Generate candlestick chart
const candleChart = await skill.generateCandlestickChart('BTCUSDT', {
  interval: '4h',
  limit: 50,
  showVolume: true,
  movingAverages: [20, 50],
  width: 1200,
  height: 700,
});

// Save to file
await skill.saveChart(candleChart, './btc_chart.svg', 'svg');

// Calculate moving averages only
const klines = await skill.getKlines('BTCUSDT', '1h', 100);
const ma20 = skill.calculateSMA(klines, 20);
const ma50 = skill.calculateSMA(klines, 50);

// Cleanup
await skill.close();
```

## Chart Options

### Line Chart Options

```typescript
interface LineChartOptions {
  interval?: string;      // Kline interval (default: '1h')
  limit?: number;         // Number of candles (default: 100, max: 1000)
  movingAverages?: number[];  // MA periods to display (e.g., [7, 30])
  width?: number;         // Chart width in pixels (default: 1200)
  height?: number;        // Chart height in pixels (default: 600)
  theme?: 'light' | 'dark';  // Color theme (default: 'dark')
  title?: string;         // Custom chart title
}
```

### Candlestick Chart Options

```typescript
interface CandlestickChartOptions {
  interval?: string;      // Kline interval (default: '1h')
  limit?: number;         // Number of candles (default: 100)
  showVolume?: boolean;   // Show volume bars (default: false)
  movingAverages?: number[];  // MA periods to display
  width?: number;         // Chart width in pixels (default: 1200)
  height?: number;        // Chart height in pixels (default: 700)
  theme?: 'light' | 'dark';  // Color theme (default: 'dark')
  title?: string;         // Custom chart title
}
```

## Chart Output

Charts are generated as SVG strings that can be:
- Saved directly as `.svg` files
- Converted to PNG using external tools
- Embedded in HTML/web pages
- Used in reports and documents

### Output Formats

- **SVG**: Scalable vector graphics, best for web and editing
- **PNG**: Raster image (SVG converted via tool of choice)

## Technical Indicators

### Simple Moving Average (SMA)

Calculates the average price over a specified period.

```typescript
// Calculate 20-period SMA
const ma20 = skill.calculateSMA(klines, 20);

// Multiple MAs
const ma7 = skill.calculateSMA(klines, 7);
const ma30 = skill.calculateSMA(klines, 30);
```

## Chart Themes

**Dark Theme** (default):
- Background: #1a1a2e
- Grid lines: #2d2d44
- Price line/candles: #00d4aa (up), #ff4757 (down)
- Text: #e0e0e0

**Light Theme**:
- Background: #ffffff
- Grid lines: #e0e0e0
- Price line/candles: #26a69a (up), #ef5350 (down)
- Text: #333333

## Error Handling

Common errors and solutions:

- **"Not connected to Binance"**: Run `binance-auth-cli connect` first
- **"Failed to fetch klines"**: Check symbol exists and interval is valid
- **"Invalid symbol"**: Symbol must be valid on Binance (e.g., BTCUSDT)
- **"Chart generation failed"**: Check write permissions for output directory

## Dependencies

- `@openclaw/auth-provider`: Authentication provider
- `@openclaw/binance`: Binance skill for price data

## Data Source

Chart data comes from Binance API klines (candlestick) endpoint. All price data is real-time from the exchange.

## TypeScript Type Exports

```typescript
import {
  ChartsSkill,
  ChartsSkillConfig,
  LineChartOptions,
  CandlestickChartOptions,
  ChartType,
  OutputFormat,
  ChartResult,
  Theme
} from '@openclaw/charts';
```

## License

MIT
