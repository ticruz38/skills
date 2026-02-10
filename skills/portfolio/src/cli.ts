#!/usr/bin/env node
/**
 * Portfolio Skill CLI
 * Command-line interface for portfolio tracking
 */

import { PortfolioSkill, getPortfolioSkill } from './index';
import * as fs from 'fs';

const USAGE = `
Portfolio Skill - Track crypto positions with P&L

Usage: portfolio <command> [options]

Commands:
  status                    Check connection status
  health                    Run health check
  
  positions                 List all positions with P&L
  position <asset>          Show details for specific asset
  
  record-buy <asset> <qty> <price> [fee]
                            Record a buy trade
  record-sell <asset> <qty> <price> [fee]
                            Record a sell trade
  
  history [asset] [--limit N]
                            Show trade history
  
  summary                   Show portfolio summary
  allocation                Show allocation breakdown
  
  snapshot                  Take portfolio snapshot
  performance [days]        Show historical performance (default 30 days)
  
  chart                     Show ASCII allocation chart
  perf-chart [days]         Show ASCII performance chart
  
  sync                      Import positions from Binance
  
  export-csv                Export portfolio to CSV
  
  help                      Show this help message

Options:
  --profile <name>          Use specific profile (default: default)
  --limit <number>          Limit results (default: 100)

Examples:
  portfolio positions
  portfolio record-buy BTC 0.5 45000 10.50
  portfolio record-sell ETH 2.0 3200
  portfolio history BTC --limit 10
  portfolio performance 7
  portfolio export-csv
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Parse global options
  let profile = 'default';
  const profileIndex = args.indexOf('--profile');
  if (profileIndex !== -1 && args[profileIndex + 1]) {
    profile = args[profileIndex + 1];
  }

  // Parse limit option
  let limit = 100;
  const limitIndex = args.indexOf('--limit');
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    limit = parseInt(args[limitIndex + 1], 10);
  }

  const skill = getPortfolioSkill(profile);

  try {
    switch (command) {
      case 'status':
      case 'health': {
        const health = await skill.healthCheck();
        console.log(JSON.stringify(health, null, 2));
        break;
      }

      case 'positions': {
        const positions = await skill.getPositions();
        if (positions.length === 0) {
          console.log('No positions found. Use sync to import from Binance or record-buy to add manually.');
        } else {
          console.log('\nPositions:');
          console.log('─'.repeat(100));
          console.log(`${'Asset'.padEnd(8)} ${'Qty'.padStart(12)} ${'Avg Cost'.padStart(12)} ${'Price'.padStart(12)} ${'Value'.padStart(12)} ${'Cost Basis'.padStart(12)} ${'P&L'.padStart(12)} ${'P&L %'.padStart(8)} ${'Alloc %'.padStart(8)}`);
          console.log('─'.repeat(100));
          for (const p of positions) {
            const pnlSign = parseFloat(p.unrealizedPnL) >= 0 ? '+' : '';
            console.log(
              `${p.asset.padEnd(8)} ${p.quantity.padStart(12)} ${p.averageCost.padStart(12)} ${p.currentPrice.padStart(12)} ` +
              `${p.currentValue.padStart(12)} ${p.costBasis.padStart(12)} ${(pnlSign + p.unrealizedPnL).padStart(12)} ` +
              `${(pnlSign + p.unrealizedPnLPercent).padStart(8)} ${p.allocation.padStart(8)}`
            );
          }
          console.log('─'.repeat(100));
        }
        break;
      }

      case 'position': {
        const asset = args[1];
        if (!asset) {
          console.error('Error: Asset required');
          process.exit(1);
        }
        const position = await skill.getPosition(asset);
        if (position) {
          console.log(JSON.stringify(position, null, 2));
        } else {
          console.log(`No position found for ${asset.toUpperCase()}`);
        }
        break;
      }

      case 'record-buy': {
        const [asset, qty, price, fee] = args.slice(1);
        if (!asset || !qty || !price) {
          console.error('Error: Asset, quantity, and price required');
          console.error('Usage: portfolio record-buy <asset> <qty> <price> [fee]');
          process.exit(1);
        }
        await skill.recordTrade(asset.toUpperCase(), 'BUY', qty, price, fee || '0');
        console.log(`✓ Recorded buy: ${qty} ${asset.toUpperCase()} @ $${price}`);
        break;
      }

      case 'record-sell': {
        const [asset, qty, price, fee] = args.slice(1);
        if (!asset || !qty || !price) {
          console.error('Error: Asset, quantity, and price required');
          console.error('Usage: portfolio record-sell <asset> <qty> <price> [fee]');
          process.exit(1);
        }
        await skill.recordTrade(asset.toUpperCase(), 'SELL', qty, price, fee || '0');
        console.log(`✓ Recorded sell: ${qty} ${asset.toUpperCase()} @ $${price}`);
        break;
      }

      case 'history': {
        const asset = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
        const history = await skill.getTradeHistory(asset, limit);
        if (history.length === 0) {
          console.log('No trade history found.');
        } else {
          console.log('\nTrade History:');
          console.log('─'.repeat(90));
          console.log(`${'ID'.padStart(4)} ${'Asset'.padEnd(8)} ${'Side'.padEnd(6)} ${'Quantity'.padStart(12)} ${'Price'.padStart(12)} ${'Total'.padStart(12)} ${'Fee'.padStart(12)} ${'Timestamp'.padStart(20)}`);
          console.log('─'.repeat(90));
          for (const t of history) {
            console.log(
              `${t.id.toString().padStart(4)} ${t.asset.padEnd(8)} ${t.side.padEnd(6)} ` +
              `${t.quantity.padStart(12)} ${t.price.padStart(12)} ${t.total.padStart(12)} ` +
              `${t.fee.padStart(12)} ${t.timestamp.padStart(20)}`
            );
          }
          console.log('─'.repeat(90));
        }
        break;
      }

      case 'summary': {
        const summary = await skill.getSummary();
        console.log('\nPortfolio Summary');
        console.log('─'.repeat(40));
        console.log(`Total Value:      $${summary.totalValue}`);
        console.log(`Total Cost Basis: $${summary.totalCostBasis}`);
        const pnlSign = parseFloat(summary.unrealizedPnL) >= 0 ? '+' : '';
        console.log(`Unrealized P&L:   ${pnlSign}$${summary.unrealizedPnL} (${pnlSign}${summary.unrealizedPnLPercent}%)`);
        console.log(`Realized P&L:     ${parseFloat(summary.realizedPnL) >= 0 ? '+' : ''}$${summary.realizedPnL}`);
        console.log(`Positions:        ${summary.positionCount}`);
        console.log('─'.repeat(40));
        break;
      }

      case 'allocation': {
        const allocation = await skill.getAllocation();
        if (allocation.length === 0) {
          console.log('No positions found.');
        } else {
          console.log('\nAllocation:');
          console.log('─'.repeat(40));
          for (const item of allocation) {
            const bar = '█'.repeat(Math.round(parseFloat(item.percentage) / 2));
            console.log(`${item.asset.padEnd(8)} ${bar} ${item.percentage}% ($${parseFloat(item.value).toFixed(2)})`);
          }
          console.log('─'.repeat(40));
        }
        break;
      }

      case 'snapshot': {
        await skill.takeSnapshot();
        console.log('✓ Portfolio snapshot saved');
        break;
      }

      case 'performance': {
        const days = parseInt(args[1] || '30', 10);
        const performance = await skill.getPerformance(days);
        if (performance.length === 0) {
          console.log('No historical data. Use snapshot command to save portfolio state.');
        } else {
          console.log(`\n${days} Day Performance:`);
          console.log('─'.repeat(80));
          console.log(`${'Timestamp'.padStart(20)} ${'Total Value'.padStart(15)} ${'Cost Basis'.padStart(15)} ${'Unrealized P&L'.padStart(15)} ${'Realized P&L'.padStart(15)}`);
          console.log('─'.repeat(80));
          for (const p of performance) {
            console.log(
              `${p.timestamp.padStart(20)} ${p.totalValue.padStart(15)} ${p.costBasis.padStart(15)} ` +
              `${p.unrealizedPnL.padStart(15)} ${p.realizedPnL.padStart(15)}`
            );
          }
          console.log('─'.repeat(80));
        }
        break;
      }

      case 'chart': {
        const chart = await skill.getAllocationChart();
        console.log('\n' + chart);
        break;
      }

      case 'perf-chart': {
        const days = parseInt(args[1] || '30', 10);
        const chart = await skill.getPerformanceChart(days);
        console.log('\n' + chart);
        break;
      }

      case 'sync': {
        console.log('Syncing with Binance...');
        const result = await skill.syncWithBinance();
        console.log(`✓ Imported ${result.imported} positions`);
        if (result.errors.length > 0) {
          console.log('\nWarnings:');
          for (const error of result.errors) {
            console.log(`  - ${error}`);
          }
        }
        break;
      }

      case 'export-csv': {
        const csv = await skill.exportToCsv();
        const filePath = `/tmp/${csv.filename}`;
        fs.writeFileSync(filePath, csv.content);
        console.log(`✓ Exported to ${filePath}`);
        console.log('\nPreview:');
        console.log(csv.content);
        break;
      }

      case 'help':
      case '--help':
      case '-h':
      default:
        console.log(USAGE);
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
