---
name: binance
description: "Binance exchange integration for trading and market data"
version: 1.0.0
author: ticruz38
entry: ./binance.sh
type: script
---

# Binance Skill

Trade cryptocurrencies via Binance API. Supports both real trading and paper trading (testnet).

## Capabilities

- `balance [asset]` - Get account balance for asset (e.g., BTC, USDT)
  - Returns: JSON with `asset`, `free`, `locked`
  - Example: `binance.sh balance BTC` → `{"asset":"BTC","free":"0.5","locked":"0"}`

- `ticker [symbol]` - Get current price for trading pair
  - Returns: JSON with `symbol`, `price`
  - Example: `binance.sh ticker BTCUSDT` → `{"symbol":"BTCUSDT","price":"43250.00"}`

- `buy [symbol] [quantity]` - Place market buy order (requires trading permission)
  - ⚠️ Uses real funds if not on testnet
  - Returns: Order details

- `sell [symbol] [quantity]` - Place market sell order (requires trading permission)
  - ⚠️ Uses real funds if not on testnet
  - Returns: Order details

## Setup

Requires Binance API keys:
1. Go to [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. Create a new API key
3. Enable "Enable Reading" for balance/price checks
4. Enable "Enable Spot & Margin Trading" for buy/sell
5. **Recommended**: Enable "Restrict access to trusted IPs only"

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BINANCE_API_KEY` | Yes | Your API key |
| `BINANCE_API_SECRET` | Yes | Your API secret |
| `BINANCE_TESTNET` | No | Set to "true" for paper trading (default: true) |

## Safety

⚠️ **Always use testnet for testing!**

- Testnet uses fake money
- Testnet URL: https://testnet.binance.vision
- When `BINANCE_TESTNET=true`, all calls go to testnet

## Examples

```bash
# Check BTC balance (testnet by default)
BINANCE_API_KEY=xxx BINANCE_API_SECRET=yyy ./binance.sh balance BTC

# Get BTC price
./binance.sh ticker BTCUSDT

# Buy 0.001 BTC (only works with trading permission)
./binance.sh buy BTCUSDT 0.001
```

## Rate Limits

Binance API limits:
- 1200 request weight per minute
- This skill uses ~10 weight per call

## See Also

- [Binance API Docs](https://binance-docs.github.io/apidocs/spot/en/)
