#!/usr/bin/env node
/**
 * Technical Analysis Skill CLI
 * Command-line interface for technical indicators and signals
 */

import { TechnicalAnalysisSkill, getTechnicalAnalysisSkill, SignalType } from './index.js';

function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (price >= 1) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  } else {
    return price.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
  }
}

function formatSignalEmoji(type: SignalType): string {
  switch (type) {
    case 'buy': return '🟢';
    case 'sell': return '🔴';
    case 'neutral': return '⚪';
    default: return '⚪';
  }
}

function printUsage() {
  console.log(`
Technical Analysis Skill CLI

Usage:
  npx ts-node cli.ts <command> [options]

Commands:
  status                    Check connection status
  health                    Health check
  rsi <symbol>             Calculate RSI indicator
  macd <symbol>            Calculate MACD indicator
  bb <symbol>              Calculate Bollinger Bands
  sma <symbol>             Calculate Simple Moving Average
  ema <symbol>             Calculate Exponential Moving Average
  wma <symbol>             Calculate Weighted Moving Average
  analyze <symbol>         Complete technical analysis with all indicators
  signals <symbol>         Generate trading signals

Options:
  --symbol, -s             Trading pair symbol (e.g., BTCUSDT)
  --interval, -i           Candle interval (default: 1h)
  --period, -p             Indicator period (default varies)
  --limit, -l              Number of candles to fetch
  --profile                Use specific profile
  --fast                   MACD fast period (default: 12)
  --slow                   MACD slow period (default: 26)
  --signal                 MACD signal period (default: 9)
  --stdDev                 Bollinger Bands standard deviation (default: 2)

Examples:
  npx ts-node cli.ts rsi BTCUSDT --period 14
  npx ts-node cli.ts macd ETHUSDT --interval 4h
  npx ts-node cli.ts bb BTCUSDT --period 20 --stdDev 2.5
  npx ts-node cli.ts analyze BTCUSDT --interval 1h
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  // Parse options
  const options: Record<string, string> = {};
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      options[key] = value;
      if (value !== 'true') i++;
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      const value = args[i + 1] && !args[i + 1].startsWith('-') ? args[i + 1] : 'true';
      options[key] = value;
      if (value !== 'true') i++;
    } else if (!options.symbol) {
      options.symbol = arg;
    }
  }

  const profile = options.profile || options.p || 'default';
  const skill = getTechnicalAnalysisSkill(profile);

  try {
    switch (command) {
      case 'status': {
        const status = await skill.getStatus();
        console.log('\n📊 Technical Analysis Status\n');
        console.log(`  Connected: ${status.connected ? '✅ Yes' : '❌ No'}`);
        if (status.environment) {
          console.log(`  Environment: ${status.environment}`);
        }
        console.log();
        break;
      }

      case 'health': {
        const health = await skill.healthCheck();
        console.log('\n🏥 Health Check\n');
        console.log(`  Status: ${health.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
        if (health.message) {
          console.log(`  Message: ${health.message}`);
        }
        if (health.binanceStatus) {
          console.log(`  Binance: ${health.binanceStatus}`);
        }
        console.log();
        break;
      }

      case 'rsi': {
        const symbol = options.symbol || options.s;
        if (!symbol) {
          console.error('Error: Symbol required (e.g., BTCUSDT)');
          process.exit(1);
        }
        const period = parseInt(options.period || options.p || '14', 10);
        const interval = options.interval || options.i || '1h';
        const limit = parseInt(options.limit || options.l || '100', 10);

        console.log(`\n📈 Calculating RSI for ${symbol}...\n`);
        
        const data = await skill.getKlines(symbol, interval, limit);
        const rsi = skill.calculateRSI(data, period);
        
        const lastValue = rsi.values[rsi.values.length - 1];
        const prevValue = rsi.values[rsi.values.length - 2];
        
        console.log(`  Symbol: ${symbol}`);
        console.log(`  Interval: ${interval}`);
        console.log(`  Period: ${period}`);
        console.log(`  Current RSI: ${lastValue !== null ? lastValue.toFixed(2) : 'N/A'}`);
        if (prevValue !== null) {
          console.log(`  Previous RSI: ${prevValue.toFixed(2)}`);
        }
        
        if (lastValue !== null) {
          if (lastValue > rsi.overbought) {
            console.log(`  Signal: 🔴 OVERBOUGHT (> ${rsi.overbought})`);
          } else if (lastValue < rsi.oversold) {
            console.log(`  Signal: 🟢 OVERSOLD (< ${rsi.oversold})`);
          } else {
            console.log(`  Signal: ⚪ Neutral (${rsi.oversold} - ${rsi.overbought})`);
          }
        }
        console.log();
        break;
      }

      case 'macd': {
        const symbol = options.symbol || options.s;
        if (!symbol) {
          console.error('Error: Symbol required (e.g., BTCUSDT)');
          process.exit(1);
        }
        const fast = parseInt(options.fast || '12', 10);
        const slow = parseInt(options.slow || '26', 10);
        const signalPeriod = parseInt(options.signal || '9', 10);
        const interval = options.interval || options.i || '1h';
        const limit = parseInt(options.limit || options.l || '100', 10);

        console.log(`\n📈 Calculating MACD for ${symbol}...\n`);
        
        const data = await skill.getKlines(symbol, interval, limit);
        const macd = skill.calculateMACD(data, fast, slow, signalPeriod);
        
        const lastMacd = macd.macdLine[macd.macdLine.length - 1];
        const lastSignal = macd.signalLine[macd.signalLine.length - 1];
        const lastHistogram = macd.histogram[macd.histogram.length - 1];
        const prevMacd = macd.macdLine[macd.macdLine.length - 2];
        const prevSignal = macd.signalLine[macd.signalLine.length - 2];
        
        console.log(`  Symbol: ${symbol}`);
        console.log(`  Interval: ${interval}`);
        console.log(`  Fast Period: ${fast}`);
        console.log(`  Slow Period: ${slow}`);
        console.log(`  Signal Period: ${signalPeriod}`);
        console.log();
        console.log(`  MACD Line: ${lastMacd !== null ? lastMacd.toFixed(6) : 'N/A'}`);
        console.log(`  Signal Line: ${lastSignal !== null ? lastSignal.toFixed(6) : 'N/A'}`);
        console.log(`  Histogram: ${lastHistogram !== null ? lastHistogram.toFixed(6) : 'N/A'}`);
        console.log();
        
        if (prevMacd !== null && prevSignal !== null && lastMacd !== null && lastSignal !== null) {
          if (prevMacd < prevSignal && lastMacd > lastSignal) {
            console.log('  Signal: 🟢 BULLISH CROSSOVER');
          } else if (prevMacd > prevSignal && lastMacd < lastSignal) {
            console.log('  Signal: 🔴 BEARISH CROSSOVER');
          } else if (lastMacd > lastSignal) {
            console.log('  Signal: ⚪ MACD above signal (bullish)');
          } else {
            console.log('  Signal: ⚪ MACD below signal (bearish)');
          }
        }
        console.log();
        break;
      }

      case 'bb':
      case 'bollinger': {
        const symbol = options.symbol || options.s;
        if (!symbol) {
          console.error('Error: Symbol required (e.g., BTCUSDT)');
          process.exit(1);
        }
        const period = parseInt(options.period || options.p || '20', 10);
        const stdDev = parseFloat(options.stdDev || '2');
        const interval = options.interval || options.i || '1h';
        const limit = parseInt(options.limit || options.l || '100', 10);

        console.log(`\n📈 Calculating Bollinger Bands for ${symbol}...\n`);
        
        const data = await skill.getKlines(symbol, interval, limit);
        const bb = skill.calculateBollingerBands(data, period, stdDev);
        
        const lastPrice = parseFloat(data[data.length - 1].close);
        const upper = bb.upper[bb.upper.length - 1];
        const middle = bb.middle[bb.middle.length - 1];
        const lower = bb.lower[bb.lower.length - 1];
        const percentB = bb.percentB[bb.percentB.length - 1];
        const bandwidth = bb.bandwidth[bb.bandwidth.length - 1];
        
        console.log(`  Symbol: ${symbol}`);
        console.log(`  Interval: ${interval}`);
        console.log(`  Period: ${period}`);
        console.log(`  Std Dev: ${stdDev}`);
        console.log();
        console.log(`  Current Price: ${formatPrice(lastPrice)}`);
        console.log(`  Upper Band: ${upper !== null ? formatPrice(upper) : 'N/A'}`);
        console.log(`  Middle Band: ${middle !== null ? formatPrice(middle) : 'N/A'}`);
        console.log(`  Lower Band: ${lower !== null ? formatPrice(lower) : 'N/A'}`);
        console.log();
        console.log(`  %B: ${percentB !== null ? percentB.toFixed(4) : 'N/A'}`);
        console.log(`  Bandwidth: ${bandwidth !== null ? bandwidth.toFixed(4) : 'N/A'}`);
        console.log();
        
        if (percentB !== null) {
          if (percentB > 1) {
            console.log('  Signal: 🔴 Price above upper band (overbought)');
          } else if (percentB < 0) {
            console.log('  Signal: 🟢 Price below lower band (oversold)');
          } else if (percentB > 0.8) {
            console.log('  Signal: 🟡 Price near upper band');
          } else if (percentB < 0.2) {
            console.log('  Signal: 🟡 Price near lower band');
          } else {
            console.log('  Signal: ⚪ Price within normal range');
          }
        }
        console.log();
        break;
      }

      case 'sma': {
        const symbol = options.symbol || options.s;
        if (!symbol) {
          console.error('Error: Symbol required (e.g., BTCUSDT)');
          process.exit(1);
        }
        const period = parseInt(options.period || options.p || '20', 10);
        const interval = options.interval || options.i || '1h';
        const limit = parseInt(options.limit || options.l || '100', 10);

        console.log(`\n📈 Calculating SMA(${period}) for ${symbol}...\n`);
        
        const data = await skill.getKlines(symbol, interval, limit);
        const sma = skill.calculateSMA(data, period);
        
        const lastValue = sma.values[sma.values.length - 1];
        const lastPrice = parseFloat(data[data.length - 1].close);
        
        console.log(`  Symbol: ${symbol}`);
        console.log(`  Interval: ${interval}`);
        console.log(`  Period: ${period}`);
        console.log();
        console.log(`  Current Price: ${formatPrice(lastPrice)}`);
        console.log(`  SMA(${period}): ${lastValue !== null ? formatPrice(lastValue) : 'N/A'}`);
        
        if (lastValue !== null) {
          const diff = ((lastPrice - lastValue) / lastValue * 100);
          console.log(`  Distance: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`);
          
          if (lastPrice > lastValue * 1.05) {
            console.log('  Signal: 🟢 Price well above SMA (bullish)');
          } else if (lastPrice < lastValue * 0.95) {
            console.log('  Signal: 🔴 Price well below SMA (bearish)');
          } else {
            console.log('  Signal: ⚪ Price near SMA');
          }
        }
        console.log();
        break;
      }

      case 'ema': {
        const symbol = options.symbol || options.s;
        if (!symbol) {
          console.error('Error: Symbol required (e.g., BTCUSDT)');
          process.exit(1);
        }
        const period = parseInt(options.period || options.p || '20', 10);
        const interval = options.interval || options.i || '1h';
        const limit = parseInt(options.limit || options.l || '100', 10);

        console.log(`\n📈 Calculating EMA(${period}) for ${symbol}...\n`);
        
        const data = await skill.getKlines(symbol, interval, limit);
        const ema = skill.calculateEMA(data, period);
        
        const lastValue = ema.values[ema.values.length - 1];
        const lastPrice = parseFloat(data[data.length - 1].close);
        
        console.log(`  Symbol: ${symbol}`);
        console.log(`  Interval: ${interval}`);
        console.log(`  Period: ${period}`);
        console.log();
        console.log(`  Current Price: ${formatPrice(lastPrice)}`);
        console.log(`  EMA(${period}): ${lastValue !== null ? formatPrice(lastValue) : 'N/A'}`);
        
        if (lastValue !== null) {
          const diff = ((lastPrice - lastValue) / lastValue * 100);
          console.log(`  Distance: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`);
        }
        console.log();
        break;
      }

      case 'wma': {
        const symbol = options.symbol || options.s;
        if (!symbol) {
          console.error('Error: Symbol required (e.g., BTCUSDT)');
          process.exit(1);
        }
        const period = parseInt(options.period || options.p || '20', 10);
        const interval = options.interval || options.i || '1h';
        const limit = parseInt(options.limit || options.l || '100', 10);

        console.log(`\n📈 Calculating WMA(${period}) for ${symbol}...\n`);
        
        const data = await skill.getKlines(symbol, interval, limit);
        const wma = skill.calculateWMA(data, period);
        
        const lastValue = wma.values[wma.values.length - 1];
        const lastPrice = parseFloat(data[data.length - 1].close);
        
        console.log(`  Symbol: ${symbol}`);
        console.log(`  Interval: ${interval}`);
        console.log(`  Period: ${period}`);
        console.log();
        console.log(`  Current Price: ${formatPrice(lastPrice)}`);
        console.log(`  WMA(${period}): ${lastValue !== null ? formatPrice(lastValue) : 'N/A'}`);
        
        if (lastValue !== null) {
          const diff = ((lastPrice - lastValue) / lastValue * 100);
          console.log(`  Distance: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`);
        }
        console.log();
        break;
      }

      case 'analyze': {
        const symbol = options.symbol || options.s;
        if (!symbol) {
          console.error('Error: Symbol required (e.g., BTCUSDT)');
          process.exit(1);
        }
        const interval = options.interval || options.i || '1h';

        console.log(`\n📊 Technical Analysis for ${symbol}\n`);
        console.log(`  Interval: ${interval}`);
        console.log(`  Loading...\n`);
        
        const analysis = await skill.analyze(symbol, interval);
        
        console.log(`  Current Price: ${formatPrice(analysis.currentPrice)}`);
        console.log(`  Analysis Time: ${new Date(analysis.timestamp).toLocaleString()}`);
        console.log();
        
        // RSI
        const rsi = analysis.indicators.rsi;
        if (rsi) {
          const rsiValue = rsi.values[rsi.values.length - 1];
          console.log('  RSI:');
          console.log(`    Current: ${rsiValue !== null ? rsiValue.toFixed(2) : 'N/A'}`);
          console.log(`    Period: ${rsi.period}`);
          console.log(`    Overbought: ${rsi.overbought}, Oversold: ${rsi.oversold}`);
          console.log();
        }
        
        // MACD
        const macd = analysis.indicators.macd;
        if (macd) {
          const macdValue = macd.macdLine[macd.macdLine.length - 1];
          const signalValue = macd.signalLine[macd.signalLine.length - 1];
          const histValue = macd.histogram[macd.histogram.length - 1];
          console.log('  MACD:');
          console.log(`    MACD: ${macdValue !== null ? macdValue.toFixed(6) : 'N/A'}`);
          console.log(`    Signal: ${signalValue !== null ? signalValue.toFixed(6) : 'N/A'}`);
          console.log(`    Histogram: ${histValue !== null ? histValue.toFixed(6) : 'N/A'}`);
          console.log(`    (${macd.fastPeriod}, ${macd.slowPeriod}, ${macd.signalPeriod})`);
          console.log();
        }
        
        // Bollinger Bands
        const bb = analysis.indicators.bollinger;
        if (bb) {
          const upper = bb.upper[bb.upper.length - 1];
          const middle = bb.middle[bb.middle.length - 1];
          const lower = bb.lower[bb.lower.length - 1];
          const percentB = bb.percentB[bb.percentB.length - 1];
          console.log('  Bollinger Bands:');
          console.log(`    Upper: ${upper !== null ? formatPrice(upper) : 'N/A'}`);
          console.log(`    Middle: ${middle !== null ? formatPrice(middle) : 'N/A'}`);
          console.log(`    Lower: ${lower !== null ? formatPrice(lower) : 'N/A'}`);
          console.log(`    %B: ${percentB !== null ? percentB.toFixed(4) : 'N/A'}`);
          console.log(`    (${bb.period}, ${bb.stdDev})`);
          console.log();
        }
        
        // Moving Averages
        const smas = analysis.indicators.sma;
        if (smas && smas.length > 0) {
          console.log('  Moving Averages:');
          for (const ma of smas) {
            const value = ma.values[ma.values.length - 1];
            console.log(`    ${ma.type}(${ma.period}): ${value !== null ? formatPrice(value) : 'N/A'}`);
          }
          console.log();
        }
        
        // Overall Signal
        console.log('  📋 Summary:\n');
        console.log(`    Overall Signal: ${formatSignalEmoji(analysis.overallSignal)} ${analysis.overallSignal.toUpperCase()}`);
        console.log(`    Confidence: ${(analysis.overallConfidence * 100).toFixed(1)}%`);
        console.log();
        
        // Individual Signals
        if (analysis.signals.length > 0) {
          console.log('  Indicator Signals:');
          for (const signal of analysis.signals) {
            console.log(`    ${formatSignalEmoji(signal.type)} [${signal.indicator}] ${signal.description}`);
            console.log(`       Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
          }
          console.log();
        }
        break;
      }

      case 'signals': {
        const symbol = options.symbol || options.s;
        if (!symbol) {
          console.error('Error: Symbol required (e.g., BTCUSDT)');
          process.exit(1);
        }
        const interval = options.interval || options.i || '1h';

        console.log(`\n🎯 Trading Signals for ${symbol}\n`);
        console.log(`  Interval: ${interval}`);
        console.log(`  Analyzing...\n`);
        
        const analysis = await skill.analyze(symbol, interval);
        
        console.log(`  Current Price: ${formatPrice(analysis.currentPrice)}`);
        console.log();
        console.log(`  📊 Overall: ${formatSignalEmoji(analysis.overallSignal)} ${analysis.overallSignal.toUpperCase()}`);
        console.log(`     Confidence: ${(analysis.overallConfidence * 100).toFixed(1)}%`);
        console.log();
        
        if (analysis.signals.length > 0) {
          console.log('  Signals:\n');
          for (const signal of analysis.signals) {
            console.log(`  ${formatSignalEmoji(signal.type)} ${signal.indicator}`);
            console.log(`     ${signal.description}`);
            console.log(`     Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
            console.log();
          }
        } else {
          console.log('  No signals generated.');
          console.log();
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
