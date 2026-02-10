---
title: Alerts
skill_id: alerts
description: Monitor prices and send alerts
---

# Alerts Skill

Monitor cryptocurrency prices and receive notifications when price thresholds or percentage changes are triggered.

## Features

- **Price Threshold Alerts**: Get notified when a price goes above or below a specific value
- **Percentage Change Alerts**: Track price movements with percentage-based triggers
- **Multi-Channel Notifications**: Send alerts via Slack or console
- **Alert History**: Track all triggered alerts in SQLite database
- **Batch Notifications**: Group multiple alerts together to avoid spam

## Configuration

### Environment Variables

- `SLACK_PROFILE` - Slack profile to use for notifications (optional, defaults to 'default')
- `BINANCE_PROFILE` - Binance profile to use for price data (optional, defaults to 'default')

## Usage

### CLI

```bash
# Check all alerts (run this on a schedule)
npm run cli check

# List all configured alerts
npm run cli list

# Add a price threshold alert
npm run cli add-threshold -- --symbol BTCUSDT --above 50000 --message "BTC hit $50k!"

# Add a percentage change alert
npm run cli add-percent -- --symbol ETHUSDT --percent 5 --message "ETH moved 5%!"

# View alert history
npm run cli history

# Enable/disable an alert
npm run cli enable -- --id 1
npm run cli disable -- --id 1

# Delete an alert
npm run cli delete -- --id 1

# Check health
npm run cli health
```

### Library

```typescript
import { AlertsSkill } from '@openclaw/alerts';

const alerts = new AlertsSkill();

// Add a price threshold alert
await alerts.addThresholdAlert({
  symbol: 'BTCUSDT',
  above: 50000,
  message: 'Bitcoin has crossed $50,000!'
});

// Add a percentage change alert
await alerts.addPercentageAlert({
  symbol: 'ETHUSDT',
  percentChange: 5,
  timeframe: '1h',  // Check every hour
  message: 'Ethereum has moved 5% in the last hour'
});

// Check all alerts
const triggered = await alerts.checkAlerts();

// Get alert history
const history = await alerts.getAlertHistory({ limit: 50 });
```

## Alert Types

### Price Threshold Alert

Triggers when the price crosses a specified value.

```typescript
await alerts.addThresholdAlert({
  symbol: 'BTCUSDT',
  above: 50000,      // Trigger when price goes above $50,000
  // OR
  below: 40000,      // Trigger when price goes below $40,000
  message: 'Custom alert message',
  channels: ['slack', 'console']  // Where to send notification
});
```

### Percentage Change Alert

Triggers when the price changes by a specified percentage within a timeframe.

```typescript
await alerts.addPercentageAlert({
  symbol: 'ETHUSDT',
  percentChange: 5,   // Trigger on 5% change
  timeframe: '1h',    // Check change over 1 hour (1m, 5m, 15m, 1h, 4h, 1d)
  direction: 'both',  // 'up', 'down', or 'both'
  message: 'Custom alert message',
  channels: ['slack', 'console']
});
```

## Notification Channels

- `console` - Print to stdout (default, always enabled)
- `slack` - Send to configured Slack channel

## Dependencies

- `@openclaw/binance` - For price data
- `@openclaw/slack` - For Slack notifications
- `sqlite3` - For local storage
