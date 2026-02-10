---
title: Portfolio
version: 1.0.0
description: Track crypto portfolio positions with P&L and allocation
author: OpenClaw
license: MIT
---

# Portfolio Skill

Track crypto portfolio positions with cost basis, P&L calculation, and allocation charts.

## Features

- **Position Tracking**: Track quantity and average cost for each asset
- **P&L Calculation**: Real-time unrealized P&L based on current prices
- **Allocation Charts**: Visual breakdown of portfolio allocation
- **Historical Performance**: Track portfolio value over time
- **CSV Export**: Export portfolio data to CSV
- **Trade Recording**: Manual trade entry for cost basis tracking
- **Binance Sync**: Import current holdings from Binance

## Installation

```bash
npm install @openclaw/portfolio
```

## Dependencies

- `@openclaw/binance` - For price data
- `sqlite3` - For local storage

## Usage

### Programmatic API

```typescript
import { PortfolioSkill, getPortfolioSkill } from '@openclaw/portfolio';

// Create skill instance
const portfolio = new PortfolioSkill();
// or
const portfolio = getPortfolioSkill('default');

// Record a buy trade (updates cost basis)
await portfolio.recordTrade('BTC', 'BUY', '0.5', '45000', '10.00');

// Record a sell trade (realizes P&L)
await portfolio.recordTrade('BTC', 'SELL', '0.2', '50000', '5.00');

// Get all positions with current P&L
const positions = await portfolio.getPositions();
console.log(positions);
// [
//   {
//     asset: 'BTC',
//     quantity: '0.3',
//     averageCost: '45000',
//     currentPrice: '52000',
//     currentValue: '15600',
//     costBasis: '13500',
//     unrealizedPnL: '2100',
//     unrealizedPnLPercent: '15.56',
//     allocation: '65.2'
//   }
// ]

// Get portfolio summary
const summary = await portfolio.getSummary();
console.log(summary);
// {
//   totalValue: '23950.50',
//   totalCostBasis: '21000.00',
//   unrealizedPnL: '2950.50',
//   unrealizedPnLPercent: '14.05',
//   realizedPnL: '950.00',
//   positionCount: 5
// }

// Get allocation breakdown
const allocation = await portfolio.getAllocation();

// Take a snapshot for historical tracking
await portfolio.takeSnapshot();

// Get historical performance
const performance = await portfolio.getPerformance(30); // 30 days

// Export to CSV
const csv = await portfolio.exportToCsv();
fs.writeFileSync('portfolio.csv', csv.content);

// Sync with Binance balances
const result = await portfolio.syncWithBinance();
console.log(`Imported ${result.imported} positions`);

// Close connection
await portfolio.close();
```

### CLI Usage

```bash
# Check status
portfolio status
portfolio health

# View positions
portfolio positions
portfolio position BTC

# Record trades
portfolio record-buy BTC 0.5 45000 10.50
portfolio record-sell ETH 2.0 3200 5.00

# View history
portfolio history
portfolio history BTC --limit 10

# Portfolio overview
portfolio summary
portfolio allocation
portfolio chart

# Historical data
portfolio snapshot
portfolio performance 30
portfolio perf-chart 7

# Sync and export
portfolio sync
portfolio export-csv
```

## Database Schema

### positions
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| asset | TEXT | Asset symbol (e.g., BTC) |
| quantity | TEXT | Current quantity held |
| average_cost | TEXT | Average cost per unit |
| total_cost | TEXT | Total cost basis |
| realized_pnl | TEXT | Realized P&L from sales |
| created_at | TEXT | Created timestamp |
| updated_at | TEXT | Last updated timestamp |
| profile | TEXT | Profile name |

### trades
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| asset | TEXT | Asset symbol |
| side | TEXT | BUY or SELL |
| quantity | TEXT | Trade quantity |
| price | TEXT | Trade price |
| total | TEXT | Total trade value |
| fee | TEXT | Trading fee |
| timestamp | TEXT | Trade timestamp |
| profile | Text | Profile name |

### portfolio_snapshots
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| total_value | TEXT | Total portfolio value |
| cost_basis | TEXT | Total cost basis |
| unrealized_pnl | TEXT | Unrealized P&L |
| realized_pnl | TEXT | Realized P&L |
| timestamp | TEXT | Snapshot timestamp |
| profile | TEXT | Profile name |

## Configuration

```typescript
interface PortfolioSkillConfig {
  binanceProfile?: string;  // Binance profile to use (default: 'default')
  cacheDir?: string;        // Custom cache directory
  enableCache?: boolean;    // Enable SQLite storage (default: true)
}
```

## Data Storage

All data is stored locally in SQLite at:
- `~/.openclaw/skills/portfolio/portfolio.db`

## Cost Basis Calculation

The skill uses average cost basis method:
- **Buys**: Add to quantity, recalculate average cost
- **Sells**: Reduce quantity, realize P&L based on average cost
- **Realized P&L**: Tracked separately for tax reporting

## TypeScript Types

```typescript
interface Position {
  asset: string;
  quantity: string;
  averageCost: string;
  currentPrice: string;
  currentValue: string;
  costBasis: string;
  unrealizedPnL: string;
  unrealizedPnLPercent: string;
  allocation: string;
}

interface PortfolioSummary {
  totalValue: string;
  totalCostBasis: string;
  unrealizedPnL: string;
  unrealizedPnLPercent: string;
  realizedPnL: string;
  positionCount: number;
}

interface Allocation {
  asset: string;
  value: string;
  percentage: string;
}
```

## Related Skills

- `@openclaw/binance` - Required for price data
- `@openclaw/binance-auth` - Required for Binance authentication
- `@openclaw/alerts` - Can alert on portfolio changes
- `@openclaw/charts` - For advanced portfolio visualizations
