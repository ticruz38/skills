---
title: Binance Crypto Trading
skill_id: binance
category: finance
description: Trade and monitor crypto via Binance API
version: 1.0.0
author: OpenClaw
requirements:
  - binance-auth skill configured
  - Binance API key with trading permissions
  - For real trading: Production API key
  - For testing: Testnet API key
---

# Binance Skill

Trade and monitor cryptocurrencies via the Binance API. Supports real-time price data, account balances, order management, and trade history tracking.

## Features

- **Real-time Prices**: Get current prices and 24hr statistics for any trading pair
- **Account Balances**: View all your crypto balances
- **Order Management**: Place market and limit orders, cancel orders, view order history
- **Trade Tracking**: Local SQLite storage for trade history with notes
- **Candlestick Data**: Get historical price data (klines) for technical analysis
- **Testnet Support**: Test trading strategies without real money
- **Multi-profile**: Support multiple Binance accounts

## Installation

```bash
cd skills/binance
npm install
npm run build
```

## Configuration

This skill requires the `binance-auth` skill to be configured first:

```bash
# For testnet (recommended for testing)
binance-auth-cli connect --testnet

# For production (real trading)
binance-auth-cli connect
```

## Usage

### Check Status

```bash
# Check connection status
binance-cli status

# Check API health
binance-cli health

# Show environment (testnet/production)
binance-cli env
```

### Market Data

```bash
# Get current price
binance-cli price BTCUSDT

# Get all prices
binance-cli prices

# Get specific symbols
binance-cli prices BTCUSDT,ETHUSDT,BNBUSDT

# Get 24hr statistics
binance-cli ticker BTCUSDT

# List all trading symbols
binance-cli symbols

# Get symbol information
binance-cli info BTCUSDT

# Get candlestick data (default: 20 candles, 1h interval)
binance-cli klines BTCUSDT 1h
binance-cli klines BTCUSDT 1d 100
```

### Account

```bash
# Show all balances
binance-cli balance

# Show specific asset balance
binance-cli balance USDT
binance-cli balance BTC
```

### Trading

```bash
# Market buy (executes immediately at market price)
binance-cli buy BTCUSDT 0.001 --market

# Market sell
binance-cli sell BTCUSDT 0.001 --market

# Limit buy (waits for price to reach target)
binance-cli limit-buy BTCUSDT 0.001 50000

# Limit sell
binance-cli limit-sell BTCUSDT 0.001 60000

# Check order status
binance-cli order BTCUSDT 12345678

# Cancel an order
binance-cli cancel BTCUSDT 12345678

# List open orders
binance-cli open
binance-cli open BTCUSDT

# Get order history
binance-cli history BTCUSDT
binance-cli history BTCUSDT 50
```

### Local Trade History

```bash
# Show all local trades
binance-cli trades

# Show trades for specific symbol
binance-cli trades BTCUSDT

# Add notes to a trade
binance-cli note 12345678 "Bought the dip"
```

### Using Different Profiles

```bash
# Use a specific profile (for multiple accounts)
binance-cli --profile trading balance
binance-cli --profile hodl balance
```

## Programmatic API

```typescript
import { BinanceSkill, getBinanceSkill } from '@openclaw/binance';

// Create skill instance
const skill = getBinanceSkill('default');

// Check connection
const connected = await skill.isConnected();

// Get prices
const price = await skill.getPrice('BTCUSDT');
const prices = await skill.getPrices(['BTCUSDT', 'ETHUSDT']);
const ticker = await skill.get24hrTicker('BTCUSDT');

// Get balances
const balances = await skill.getBalances();
const btcBalance = await skill.getBalance('BTC');

// Place orders
const buyOrder = await skill.marketBuy('BTCUSDT', '0.001');
const sellOrder = await skill.marketSell('BTCUSDT', '0.001');
const limitOrder = await skill.limitBuy('BTCUSDT', '0.001', '50000');

// Manage orders
const openOrders = await skill.getOpenOrders();
const order = await skill.getOrder('BTCUSDT', 12345678);
const cancelled = await skill.cancelOrder('BTCUSDT', 12345678);

// Get order history
const history = await skill.getOrderHistory('BTCUSDT', { limit: 50 });

// Get local trade history
const trades = await skill.getLocalTradeHistory({ symbol: 'BTCUSDT', limit: 10 });

// Add notes to trades
await skill.addTradeNotes(12345678, 'Entry point for long position');

// Get candlestick data
const klines = await skill.getKlines('BTCUSDT', '1h', { limit: 100 });

// Cleanup
await skill.close();
```

## Order Types

### Market Orders
- Execute immediately at the best available price
- Use `marketBuy()` and `marketSell()` methods
- No price control, guaranteed execution

### Limit Orders
- Execute only at the specified price or better
- Use `limitBuy()` and `limitSell()` methods
- Price control, but no guaranteed execution
- Time in force options: GTC (Good Till Cancelled), IOC (Immediate or Cancel), FOK (Fill or Kill)

### Advanced Order Types
The skill also supports STOP_LOSS, STOP_LOSS_LIMIT, TAKE_PROFIT, and TAKE_PROFIT_LIMIT orders via the `createOrder()` method.

## Data Storage

Trade history is stored locally in SQLite:
- **Location**: `~/.openclaw/skills/binance/trades.db`
- **Tables**:
  - `trades`: Local copy of all orders with notes
  - `price_history`: Historical price snapshots

## Safety Considerations

1. **Testnet First**: Always test strategies on testnet before using real funds
2. **API Permissions**: Use API keys with minimal required permissions
3. **IP Restrictions**: Consider restricting API keys to specific IP addresses
4. **Withdrawal Disabled**: For trading-only keys, disable withdrawal permissions

## Environment Variables

This skill uses the `binance-auth` skill for credentials. No direct environment variables required.

## Error Handling

Common errors and solutions:

- **"Not connected to Binance"**: Run `binance-auth-cli connect` first
- **"Account does not have trading permissions"**: Your API key lacks SPOT trading permission
- **"Invalid API key"**: Check your API key in binance-auth
- **"Insufficient balance"**: Not enough funds for the order

## Dependencies

- `@openclaw/auth-provider`: Authentication provider
- `@openclaw/binance-auth`: Binance authentication skill
- `sqlite3`: Local database for trade history

## TypeScript Type Exports

```typescript
import { 
  SymbolInfo, 
  Ticker, 
  PriceTicker, 
  Balance, 
  Order, 
  OrderType, 
  OrderSide, 
  TimeInForce,
  OrderStatus,
  CreateOrderOptions,
  CreateOrderResponse,
  Trade,
  Kline,
  ExchangeInfo,
  LocalTradeRecord,
  BinanceSkillConfig,
  BinanceEnvironment
} from '@openclaw/binance';
```

## License

MIT
