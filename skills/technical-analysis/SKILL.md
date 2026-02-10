---
title: Technical Analysis Skill
description: Calculate technical indicators and signals for crypto trading
---

# Technical Analysis Skill

Calculate technical indicators and generate trading signals for cryptocurrency trading.

## Installation

```bash
cd skills/technical-analysis
npm install
npm run build
```

## Usage

### Library

```typescript
import { TechnicalAnalysisSkill, getTechnicalAnalysisSkill } from '@openclaw/technical-analysis';

// Create skill instance
const ta = getTechnicalAnalysisSkill('default');

// Full analysis with all indicators
const analysis = await ta.analyze('BTCUSDT', '1h', {
  rsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  bollingerPeriod: 20,
});

console.log('Overall Signal:', analysis.overallSignal);
console.log('Confidence:', analysis.overallConfidence);
console.log('Signals:', analysis.signals);

// Individual indicators
const data = await ta.getKlines('BTCUSDT', '1h', 100);

const rsi = ta.calculateRSI(data, 14);
const macd = ta.calculateMACD(data, 12, 26, 9);
const bollinger = ta.calculateBollingerBands(data, 20, 2);
const sma20 = ta.calculateSMA(data, 20);
const ema20 = ta.calculateEMA(data, 20);

await ta.close();
```

### CLI

```bash
# Check status
npm run cli status

# RSI indicator
npm run cli rsi BTCUSDT --period 14

# MACD indicator
npm run cli macd ETHUSDT --interval 4h

# Bollinger Bands
npm run cli bb BTCUSDT --period 20 --stdDev 2

# Moving averages
npm run cli sma BTCUSDT --period 50
npm run cli ema BTCUSDT --period 20

# Complete analysis
npm run cli analyze BTCUSDT --interval 1h

# Trading signals
npm run cli signals BTCUSDT --interval 1h
```

## Features

### Indicators

- **RSI** - Relative Strength Index with configurable period and thresholds
- **MACD** - Moving Average Convergence Divergence with custom parameters
- **Bollinger Bands** - Volatility bands with %B and bandwidth calculations
- **SMA** - Simple Moving Average
- **EMA** - Exponential Moving Average
- **WMA** - Weighted Moving Average

### Signal Generation

The skill generates trading signals based on:
- RSI overbought/oversold conditions
- MACD crossovers
- Bollinger Bands %B position
- Moving average crossovers (golden/death cross)

Signals include:
- Type: buy, sell, or neutral
- Confidence score (0-1)
- Description of the signal
- Timestamp and price

### Analysis Result

```typescript
interface AnalysisResult {
  symbol: string;
  interval: string;
  timestamp: number;
  currentPrice: number;
  signals: TradingSignal[];
  overallSignal: 'buy' | 'sell' | 'neutral';
  overallConfidence: number;
  indicators: {
    rsi?: RSIResult;
    macd?: MACDResult;
    bollinger?: BollingerBandsResult;
    sma?: MovingAverageResult[];
    ema?: MovingAverageResult[];
  };
}
```

## Dependencies

- `@openclaw/binance` - Price data and klines
- `@openclaw/auth-provider` - Authentication

## Configuration

Uses the same profile-based authentication as the binance skill. No additional configuration needed.

## API

### TechnicalAnalysisSkill

```typescript
class TechnicalAnalysisSkill {
  // Constructor
  constructor(config?: { profile?: string })
  
  // Factory method
  static forProfile(profile?: string): TechnicalAnalysisSkill
  
  // Indicators
  calculateRSI(data: Kline[], period?: number, overbought?: number, oversold?: number): RSIResult
  calculateMACD(data: Kline[], fastPeriod?: number, slowPeriod?: number, signalPeriod?: number): MACDResult
  calculateBollingerBands(data: Kline[], period?: number, stdDev?: number): BollingerBandsResult
  calculateSMA(data: Kline[], period: number): MovingAverageResult
  calculateEMA(data: Kline[], period: number): MovingAverageResult
  calculateWMA(data: Kline[], period: number): MovingAverageResult
  
  // Signal generation
  generateSignals(data: Kline[], ...indicators): TradingSignal[]
  calculateOverallSignal(signals: TradingSignal[]): { signal: SignalType; confidence: number }
  
  // Complete analysis
  analyze(symbol: string, interval?: string, options?: object): Promise<AnalysisResult>
  
  // Utility
  getKlines(symbol: string, interval: string, limit?: number): Promise<Kline[]>
  isConnected(): Promise<boolean>
  healthCheck(): Promise<HealthStatus>
  close(): Promise<void>
}
```

## License

MIT
