#!/usr/bin/env node

/**
 * Charts Skill CLI
 * Generate price charts and technical overlays
 */

import { ChartsSkill, getChartsSkill, ChartResult } from './index';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
function parseArgs(args: string[]): {
  command: string;
  symbol?: string;
  options: Record<string, any>;
} {
  const result: {
    command: string;
    symbol?: string;
    options: Record<string, any>;
  } = {
    command: '',
    options: {},
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--profile') {
      result.options.profile = args[++i];
    } else if (arg === '--interval' || arg === '-i') {
      result.options.interval = args[++i];
    } else if (arg === '--limit' || arg === '-l') {
      result.options.limit = parseInt(args[++i], 10);
    } else if (arg === '--output' || arg === '-o') {
      result.options.output = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      result.options.format = args[++i];
    } else if (arg === '--theme' || arg === '-t') {
      result.options.theme = args[++i];
    } else if (arg === '--width' || arg === '-w') {
      result.options.width = parseInt(args[++i], 10);
    } else if (arg === '--height' || arg === '-h') {
      result.options.height = parseInt(args[++i], 10);
    } else if (arg === '--volume' || arg === '-v') {
      result.options.volume = true;
    } else if (arg === '--ma') {
      if (!result.options.movingAverages) {
        result.options.movingAverages = [];
      }
      result.options.movingAverages.push(parseInt(args[++i], 10));
    } else if (arg === '--title') {
      result.options.title = args[++i];
    } else if (!arg.startsWith('-') && !result.command) {
      result.command = arg;
    } else if (!arg.startsWith('-') && result.command && !result.symbol) {
      result.symbol = arg;
    }

    i++;
  }

  return result;
}

// Show help
function showHelp(): void {
  console.log(`
Charts Skill CLI - Generate price charts and technical overlays

Usage:
  charts-cli <command> [options]

Commands:
  status                    Check connection status
  health                    Check health of dependencies
  line <symbol>             Generate line chart
  candle <symbol>           Generate candlestick chart

Options:
  --profile <name>          Use specific profile (default: default)
  --interval, -i <interval> Kline interval (default: 1h)
                            Options: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M
  --limit, -l <number>      Number of candles (default: 100, max: 1000)
  --output, -o <path>       Output file path
  --format, -f <format>     Output format: svg (default: svg)
  --theme, -t <theme>       Color theme: light | dark (default: dark)
  --width, -w <pixels>      Chart width (default: 1200)
  --height, -h <pixels>     Chart height (default: 600 for line, 700 for candle)
  --volume, -v              Show volume bars (candlestick only)
  --ma <period>             Add moving average (can be used multiple times)
  --title <text>            Custom chart title

Examples:
  charts-cli status
  charts-cli line BTCUSDT
  charts-cli line ETHUSDT --interval 1d --limit 30 --ma 7 --ma 30
  charts-cli candle BTCUSDT --interval 4h --volume --ma 20 --ma 50
  charts-cli line BTCUSDT --output ./btc_chart.svg --theme dark
  charts-cli --profile trading candle ETHUSDT --interval 1h -v
`);
}

// Main function
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  const { command, symbol, options } = parseArgs(args);
  const profile = options.profile || 'default';
  const skill = getChartsSkill(profile);

  try {
    switch (command) {
      case 'status': {
        const status = await skill.getStatus();
        if (status.connected) {
          console.log('✓ Connected to Binance');
          console.log(`  Environment: ${status.environment || 'unknown'}`);
          console.log(`  Profile: ${profile}`);
        } else {
          console.log('✗ Not connected to Binance');
          console.log('  Run: binance-auth-cli connect');
          process.exit(1);
        }
        break;
      }

      case 'health': {
        const health = await skill.healthCheck();
        console.log(`Status: ${health.status}`);
        if (health.message) {
          console.log(`Message: ${health.message}`);
        }
        if (health.binanceStatus) {
          console.log(`Binance: ${health.binanceStatus}`);
        }
        if (health.status === 'unhealthy') {
          process.exit(1);
        }
        break;
      }

      case 'line': {
        if (!symbol) {
          console.error('Error: Symbol required (e.g., BTCUSDT)');
          process.exit(1);
        }

        console.log(`Generating line chart for ${symbol}...`);
        
        const result = await skill.generateLineChart(symbol, {
          interval: options.interval,
          limit: options.limit,
          movingAverages: options.movingAverages,
          width: options.width,
          height: options.height,
          theme: options.theme,
          title: options.title,
        });

        // Save or output
        if (options.output) {
          const format = options.format || 'svg';
          await skill.saveChart(result, options.output, format);
          console.log(`✓ Chart saved to: ${options.output}`);
        } else {
          console.log(result.svg);
        }

        console.log(`\nChart Info:`);
        console.log(`  Symbol: ${result.symbol}`);
        console.log(`  Interval: ${result.interval}`);
        console.log(`  Data points: ${result.dataPoints}`);
        console.log(`  Price range: ${result.minPrice.toFixed(2)} - ${result.maxPrice.toFixed(2)}`);
        console.log(`  Generated: ${new Date(result.generatedAt).toLocaleString()}`);
        break;
      }

      case 'candle':
      case 'candlestick': {
        if (!symbol) {
          console.error('Error: Symbol required (e.g., BTCUSDT)');
          process.exit(1);
        }

        console.log(`Generating candlestick chart for ${symbol}...`);
        
        const result = await skill.generateCandlestickChart(symbol, {
          interval: options.interval,
          limit: options.limit,
          showVolume: options.volume,
          movingAverages: options.movingAverages,
          width: options.width,
          height: options.height,
          theme: options.theme,
          title: options.title,
        });

        // Save or output
        if (options.output) {
          const format = options.format || 'svg';
          await skill.saveChart(result, options.output, format);
          console.log(`✓ Chart saved to: ${options.output}`);
        } else {
          console.log(result.svg);
        }

        console.log(`\nChart Info:`);
        console.log(`  Symbol: ${result.symbol}`);
        console.log(`  Interval: ${result.interval}`);
        console.log(`  Data points: ${result.dataPoints}`);
        console.log(`  Price range: ${result.minPrice.toFixed(2)} - ${result.maxPrice.toFixed(2)}`);
        console.log(`  Volume: ${options.volume ? 'Yes' : 'No'}`);
        console.log(`  Generated: ${new Date(result.generatedAt).toLocaleString()}`);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await skill.close();
  }
}

// Run main
main();
