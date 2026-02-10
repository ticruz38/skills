#!/usr/bin/env node
/**
 * Binance Skill CLI
 * Command-line interface for crypto trading and monitoring
 */

import { BinanceSkill, getBinanceSkill, OrderSide, OrderType, TimeInForce, LocalTradeRecord } from './index';

const args = process.argv.slice(2);
const command = args[0];

// Helper to format currency
function formatCurrency(value: string | number, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Helper to format percentage
function formatPercent(value: string): string {
  const num = parseFloat(value);
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

// Helper to format date
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

async function showHelp() {
  console.log(`
Binance Skill CLI - Crypto Trading & Monitoring

USAGE:
  binance-cli <command> [options]

COMMANDS:
  Status & Connection:
    status              Show connection status
    health              Check API health
    env                 Show current environment (testnet/production)

  Market Data:
    price <symbol>      Get current price (e.g., BTCUSDT)
    prices              Get all prices or specific symbols
    ticker <symbol>     Get 24hr statistics
    symbols             List all trading symbols
    info <symbol>       Get symbol information
    klines <symbol> <interval> [limit]  Get candlestick data

  Account:
    balance             Show all account balances
    balance <asset>     Show balance for specific asset

  Trading:
    buy <symbol> <qty> [--market]       Place buy order
    sell <symbol> <qty> [--market]      Place sell order
    limit-buy <symbol> <qty> <price>    Place limit buy order
    limit-sell <symbol> <qty> <price>   Place limit sell order
    order <symbol> <orderId>            Get order status
    cancel <symbol> <orderId>           Cancel an order
    open                                List open orders
    history <symbol> [limit]            Get order history

  Local Trade History:
    trades              Show local trade history
    trades <symbol>     Show trades for specific symbol
    note <orderId> <text>  Add notes to a trade

  Options:
    --profile <name>    Use specific profile (default: default)
    --testnet           Use testnet (if connected to testnet)
    --help              Show this help message

EXAMPLES:
  binance-cli price BTCUSDT
  binance-cli balance USDT
  binance-cli buy BTCUSDT 0.001 --market
  binance-cli limit-sell BTCUSDT 0.001 65000
  binance-cli open
  binance-cli history BTCUSDT 10
`);
}

async function main() {
  const profileIdx = args.indexOf('--profile');
  const profile = profileIdx > -1 ? args[profileIdx + 1] : 'default';
  
  const skill = getBinanceSkill(profile);

  try {
    switch (command) {
      case 'status': {
        const status = await skill.getStatus();
        if (status.connected) {
          console.log('✓ Connected to Binance');
          console.log(`  Environment: ${status.environment?.toUpperCase()}`);
          console.log(`  Permissions: ${status.permissions?.join(', ') || 'None'}`);
        } else {
          console.log('✗ Not connected to Binance');
          console.log('  Run: binance-auth-cli connect');
        }
        break;
      }

      case 'health': {
        const health = await skill.healthCheck();
        if (health.status === 'healthy') {
          console.log('✓ Healthy');
          console.log(`  Environment: ${health.environment}`);
          console.log(`  Ping: ${health.pingMs}ms`);
        } else {
          console.log('✗ Unhealthy');
          console.log(`  ${health.message}`);
        }
        break;
      }

      case 'env': {
        const env = await skill.getEnvironment();
        if (env) {
          console.log(`Environment: ${env}`);
        } else {
          console.log('Not connected');
        }
        break;
      }

      case 'price': {
        const symbol = args[1];
        if (!symbol) {
          console.error('Error: Symbol required (e.g., BTCUSDT)');
          process.exit(1);
        }
        const price = await skill.getPrice(symbol);
        console.log(`${symbol.toUpperCase()}: $${formatCurrency(price, 8)}`);
        break;
      }

      case 'prices': {
        const symbols: string[] | undefined = args[1] 
          ? args[1].split(',') 
          : undefined;
        const prices = await skill.getPrices(symbols);
        
        if (Array.isArray(prices)) {
          // Sort by symbol
          prices.sort((a, b) => a.symbol.localeCompare(b.symbol));
          
          console.log('Symbol           Price');
          console.log('---------------- ------------------');
          for (const p of prices.slice(0, 50)) {
            const price = parseFloat(p.price);
            const decimals = price < 1 ? 8 : price < 1000 ? 4 : 2;
            console.log(`${p.symbol.padEnd(16)} ${formatCurrency(p.price, decimals)}`);
          }
          if (prices.length > 50) {
            console.log(`... and ${prices.length - 50} more`);
          }
        } else {
          const singlePrice = prices as { symbol: string; price: string };
          console.log(`${singlePrice.symbol}: ${formatCurrency(singlePrice.price, 8)}`);
        }
        break;
      }

      case 'ticker': {
        const symbol = args[1];
        if (!symbol) {
          console.error('Error: Symbol required (e.g., BTCUSDT)');
          process.exit(1);
        }
        const ticker = await skill.get24hrTicker(symbol) as import('./index').PriceTicker;
        if (Array.isArray(ticker)) {
          throw new Error('Expected single ticker but got array');
        }
        
        console.log(`${ticker.symbol} 24hr Statistics`);
        console.log('='.repeat(40));
        console.log(`Last Price:    $${formatCurrency(ticker.lastPrice, 8)}`);
        console.log(`Price Change:  $${formatCurrency(ticker.priceChange, 8)} (${formatPercent(ticker.priceChangePercent)})`);
        console.log(`High:          $${formatCurrency(ticker.highPrice, 8)}`);
        console.log(`Low:           $${formatCurrency(ticker.lowPrice, 8)}`);
        console.log(`Volume:        ${formatCurrency(ticker.volume, 4)} ${ticker.symbol.replace(/USDT|BUSD|USDC$/, '')}`);
        console.log(`Quote Volume:  $${formatCurrency(ticker.quoteVolume, 2)}`);
        console.log(`Open:          $${formatCurrency(ticker.openPrice, 8)}`);
        console.log(`Prev Close:    $${formatCurrency(ticker.prevClosePrice, 8)}`);
        console.log(`Bid:           $${formatCurrency(ticker.bidPrice, 8)}`);
        console.log(`Ask:           $${formatCurrency(ticker.askPrice, 8)}`);
        console.log(`Trades:        ${ticker.count.toLocaleString()}`);
        break;
      }

      case 'symbols': {
        const symbols = await skill.getSymbols();
        console.log(`Found ${symbols.length} trading symbols`);
        console.log('');
        console.log('Symbol    Base  Quote  Min Qty    Min Notional');
        console.log('--------- ----- ------ ---------- ------------');
        
        for (const s of symbols.slice(0, 30)) {
          console.log(
            `${s.symbol.padEnd(9)} ${s.baseAsset.padEnd(5)} ${s.quoteAsset.padEnd(6)} ` +
            `${s.minQty.padEnd(10)} ${s.minNotional}`
          );
        }
        if (symbols.length > 30) {
          console.log(`... and ${symbols.length - 30} more`);
        }
        break;
      }

      case 'info': {
        const symbol = args[1];
        if (!symbol) {
          console.error('Error: Symbol required');
          process.exit(1);
        }
        const info = await skill.getSymbolInfo(symbol);
        if (!info) {
          console.error(`Symbol ${symbol} not found`);
          process.exit(1);
        }
        
        console.log(`${info.symbol} Information`);
        console.log('='.repeat(40));
        console.log(`Status:            ${info.status}`);
        console.log(`Base Asset:        ${info.baseAsset} (precision: ${info.baseAssetPrecision})`);
        console.log(`Quote Asset:       ${info.quoteAsset} (precision: ${info.quoteAssetPrecision})`);
        console.log(`Min Price:         ${info.minPrice}`);
        console.log(`Max Price:         ${info.maxPrice}`);
        console.log(`Tick Size:         ${info.tickSize}`);
        console.log(`Min Quantity:      ${info.minQty}`);
        console.log(`Max Quantity:      ${info.maxQty}`);
        console.log(`Step Size:         ${info.stepSize}`);
        console.log(`Min Notional:      ${info.minNotional}`);
        break;
      }

      case 'klines': {
        const symbol = args[1];
        const interval = args[2] || '1h';
        const limit = parseInt(args[3] || '20');
        
        if (!symbol) {
          console.error('Error: Symbol required');
          process.exit(1);
        }
        
        const klines = await skill.getKlines(symbol, interval, { limit });
        
        console.log(`${symbol.toUpperCase()} ${interval} Candles`);
        console.log('Time                Open           High           Low            Close          Volume');
        console.log('------------------- -------------- -------------- -------------- -------------- --------------');
        
        for (const k of klines) {
          const time = new Date(k.openTime).toISOString().slice(0, 19).replace('T', ' ');
          console.log(
            `${time} ${parseFloat(k.open).toFixed(2).padStart(14)} ` +
            `${parseFloat(k.high).toFixed(2).padStart(14)} ` +
            `${parseFloat(k.low).toFixed(2).padStart(14)} ` +
            `${parseFloat(k.close).toFixed(2).padStart(14)} ` +
            `${parseFloat(k.volume).toFixed(4).padStart(14)}`
          );
        }
        break;
      }

      case 'balance': {
        const asset = args[1];
        if (asset) {
          const balance = await skill.getBalance(asset);
          if (balance) {
            console.log(`${balance.asset} Balance`);
            console.log(`  Free:   ${balance.free}`);
            console.log(`  Locked: ${balance.locked}`);
            console.log(`  Total:  ${balance.total}`);
          } else {
            console.log(`No balance found for ${asset.toUpperCase()}`);
          }
        } else {
          const balances = await skill.getBalances();
          if (balances.length === 0) {
            console.log('No balances found');
          } else {
            console.log('Asset    Free           Locked         Total');
            console.log('-------- -------------- -------------- --------------');
            for (const b of balances) {
              console.log(
                `${b.asset.padEnd(8)} ${b.free.padEnd(14)} ${b.locked.padEnd(14)} ${b.total.padEnd(14)}`
              );
            }
          }
        }
        break;
      }

      case 'buy': {
        const symbol = args[1];
        const quantity = args[2];
        const isMarket = args.includes('--market');
        
        if (!symbol || !quantity) {
          console.error('Error: Symbol and quantity required');
          console.error('Usage: buy <symbol> <quantity> [--market]');
          process.exit(1);
        }
        
        console.log(`Placing ${isMarket ? 'market' : 'limit'} buy order...`);
        console.log(`Symbol: ${symbol.toUpperCase()}`);
        console.log(`Quantity: ${quantity}`);
        
        const result = await skill.marketBuy(symbol, quantity);
        
        console.log('\n✓ Order placed successfully');
        console.log(`Order ID: ${result.orderId}`);
        console.log(`Status: ${result.status}`);
        console.log(`Executed: ${result.executedQty} / ${result.origQty}`);
        console.log(`Total: ${result.cummulativeQuoteQty}`);
        break;
      }

      case 'sell': {
        const symbol = args[1];
        const quantity = args[2];
        const isMarket = args.includes('--market');
        
        if (!symbol || !quantity) {
          console.error('Error: Symbol and quantity required');
          console.error('Usage: sell <symbol> <quantity> [--market]');
          process.exit(1);
        }
        
        console.log(`Placing ${isMarket ? 'market' : 'limit'} sell order...`);
        console.log(`Symbol: ${symbol.toUpperCase()}`);
        console.log(`Quantity: ${quantity}`);
        
        const result = await skill.marketSell(symbol, quantity);
        
        console.log('\n✓ Order placed successfully');
        console.log(`Order ID: ${result.orderId}`);
        console.log(`Status: ${result.status}`);
        console.log(`Executed: ${result.executedQty} / ${result.origQty}`);
        console.log(`Total: ${result.cummulativeQuoteQty}`);
        break;
      }

      case 'limit-buy': {
        const symbol = args[1];
        const quantity = args[2];
        const price = args[3];
        
        if (!symbol || !quantity || !price) {
          console.error('Error: Symbol, quantity, and price required');
          console.error('Usage: limit-buy <symbol> <quantity> <price>');
          process.exit(1);
        }
        
        console.log('Placing limit buy order...');
        console.log(`Symbol: ${symbol.toUpperCase()}`);
        console.log(`Quantity: ${quantity}`);
        console.log(`Price: ${price}`);
        
        const result = await skill.limitBuy(symbol, quantity, price);
        
        console.log('\n✓ Order placed successfully');
        console.log(`Order ID: ${result.orderId}`);
        console.log(`Status: ${result.status}`);
        console.log(`Price: ${result.price}`);
        console.log(`Quantity: ${result.origQty}`);
        break;
      }

      case 'limit-sell': {
        const symbol = args[1];
        const quantity = args[2];
        const price = args[3];
        
        if (!symbol || !quantity || !price) {
          console.error('Error: Symbol, quantity, and price required');
          console.error('Usage: limit-sell <symbol> <quantity> <price>');
          process.exit(1);
        }
        
        console.log('Placing limit sell order...');
        console.log(`Symbol: ${symbol.toUpperCase()}`);
        console.log(`Quantity: ${quantity}`);
        console.log(`Price: ${price}`);
        
        const result = await skill.limitSell(symbol, quantity, price);
        
        console.log('\n✓ Order placed successfully');
        console.log(`Order ID: ${result.orderId}`);
        console.log(`Status: ${result.status}`);
        console.log(`Price: ${result.price}`);
        console.log(`Quantity: ${result.origQty}`);
        break;
      }

      case 'order': {
        const symbol = args[1];
        const orderId = parseInt(args[2]);
        
        if (!symbol || isNaN(orderId)) {
          console.error('Error: Symbol and order ID required');
          console.error('Usage: order <symbol> <orderId>');
          process.exit(1);
        }
        
        const order = await skill.getOrder(symbol, orderId);
        
        console.log(`Order ${order.orderId}`);
        console.log('='.repeat(40));
        console.log(`Symbol:     ${order.symbol}`);
        console.log(`Side:       ${order.side}`);
        console.log(`Type:       ${order.type}`);
        console.log(`Status:     ${order.status}`);
        console.log(`Price:      ${order.price}`);
        console.log(`Quantity:   ${order.origQty}`);
        console.log(`Executed:   ${order.executedQty}`);
        console.log(`Total:      ${order.cummulativeQuoteQty}`);
        console.log(`Time:       ${formatDate(order.time)}`);
        break;
      }

      case 'cancel': {
        const symbol = args[1];
        const orderId = parseInt(args[2]);
        
        if (!symbol || isNaN(orderId)) {
          console.error('Error: Symbol and order ID required');
          console.error('Usage: cancel <symbol> <orderId>');
          process.exit(1);
        }
        
        console.log(`Cancelling order ${orderId}...`);
        const order = await skill.cancelOrder(symbol, orderId);
        
        console.log('\n✓ Order cancelled');
        console.log(`Status: ${order.status}`);
        break;
      }

      case 'open': {
        const symbol = args[1];
        const orders = await skill.getOpenOrders(symbol);
        
        if (orders.length === 0) {
          console.log('No open orders');
        } else {
          console.log(`Found ${orders.length} open order(s)`);
          console.log('');
          console.log('Order ID    Symbol      Side Type        Price          Quantity       Executed');
          console.log('----------- ----------- ---- ----------- -------------- -------------- --------------');
          
          for (const o of orders) {
            console.log(
              `${o.orderId.toString().padEnd(11)} ` +
              `${o.symbol.padEnd(11)} ` +
              `${o.side.padEnd(4)} ` +
              `${o.type.padEnd(11)} ` +
              `${o.price.padEnd(14)} ` +
              `${o.origQty.padEnd(14)} ` +
              `${o.executedQty}`
            );
          }
        }
        break;
      }

      case 'history': {
        const symbol = args[1];
        const limit = parseInt(args[2] || '20');
        
        if (!symbol) {
          console.error('Error: Symbol required');
          console.error('Usage: history <symbol> [limit]');
          process.exit(1);
        }
        
        const orders = await skill.getOrderHistory(symbol, { limit });
        
        if (orders.length === 0) {
          console.log('No order history');
        } else {
          console.log(`Order History for ${symbol.toUpperCase()}`);
          console.log('Order ID    Side Type        Status          Price          Quantity       Time');
          console.log('----------- ---- ----------- --------------- -------------- -------------- -------------------');
          
          for (const o of orders) {
            const time = new Date(o.time).toISOString().slice(0, 19).replace('T', ' ');
            console.log(
              `${o.orderId.toString().padEnd(11)} ` +
              `${o.side.padEnd(4)} ` +
              `${o.type.padEnd(11)} ` +
              `${o.status.padEnd(15)} ` +
              `${o.price.padEnd(14)} ` +
              `${o.origQty.padEnd(14)} ` +
              `${time}`
            );
          }
        }
        break;
      }

      case 'trades': {
        const symbol = args[1];
        const trades = await skill.getLocalTradeHistory({ symbol, limit: 50 });
        
        if (trades.length === 0) {
          console.log('No local trade records');
        } else {
          console.log(`Local Trade History${symbol ? ` for ${symbol.toUpperCase()}` : ''}`);
          console.log('Order ID    Symbol      Side Type   Status  Price          Quantity       Total          Time');
          console.log('----------- ----------- ---- ------ ------- -------------- -------------- -------------- -------------------');
          
          for (const t of trades) {
            console.log(
              `${t.order_id.toString().padEnd(11)} ` +
              `${t.symbol.padEnd(11)} ` +
              `${t.side.padEnd(4)} ` +
              `${t.type.padEnd(6)} ` +
              `${t.status.padEnd(7)} ` +
              `${t.price.padEnd(14)} ` +
              `${t.quantity.padEnd(14)} ` +
              `${t.total.padEnd(14)} ` +
              `${t.created_at}`
            );
          }
        }
        break;
      }

      case 'note': {
        const orderId = parseInt(args[1]);
        const noteText = args.slice(2).join(' ');
        
        if (isNaN(orderId) || !noteText) {
          console.error('Error: Order ID and note text required');
          console.error('Usage: note <orderId> <text>');
          process.exit(1);
        }
        
        await skill.addTradeNotes(orderId, noteText);
        console.log(`✓ Note added to order ${orderId}`);
        break;
      }

      case '--help':
      case '-h':
      case 'help':
      default:
        await showHelp();
        break;
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
