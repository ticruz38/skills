/**
 * Technical Analysis Skill
 * Calculate technical indicators and signals for crypto trading
 * Built on top of binance skill for price data
 */

import { BinanceSkill, getBinanceSkill, Kline } from '@openclaw/binance';

/**
 * RSI result
 */
export interface RSIResult {
  values: (number | null)[];
  period: number;
  overbought: number;
  oversold: number;
}

/**
 * MACD result
 */
export interface MACDResult {
  macdLine: (number | null)[];
  signalLine: (number | null)[];
  histogram: (number | null)[];
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
}

/**
 * Bollinger Bands result
 */
export interface BollingerBandsResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
  bandwidth: (number | null)[];
  percentB: (number | null)[];
  period: number;
  stdDev: number;
}

/**
 * Moving Average result
 */
export interface MovingAverageResult {
  values: (number | null)[];
  type: 'SMA' | 'EMA' | 'WMA';
  period: number;
}

/**
 * Signal types
 */
export type SignalType = 'buy' | 'sell' | 'neutral';

/**
 * Trading signal
 */
export interface TradingSignal {
  type: SignalType;
  indicator: string;
  confidence: number; // 0-1
  description: string;
  timestamp: number;
  price: number;
}

/**
 * Multi-indicator analysis result
 */
export interface AnalysisResult {
  symbol: string;
  interval: string;
  timestamp: number;
  currentPrice: number;
  signals: TradingSignal[];
  overallSignal: SignalType;
  overallConfidence: number;
  indicators: {
    rsi?: RSIResult;
    macd?: MACDResult;
    bollinger?: BollingerBandsResult;
    sma?: MovingAverageResult[];
    ema?: MovingAverageResult[];
  };
}

/**
 * Technical Analysis skill configuration
 */
export interface TechnicalAnalysisConfig {
  profile?: string;
}

/**
 * Technical Analysis Skill - Calculate indicators and generate signals
 */
export class TechnicalAnalysisSkill {
  private binanceSkill: BinanceSkill;
  private profile: string;

  constructor(config: TechnicalAnalysisConfig = {}) {
    this.profile = config.profile || 'default';
    this.binanceSkill = getBinanceSkill(this.profile);
  }

  /**
   * Create TechnicalAnalysisSkill for a specific profile
   */
  static forProfile(profile: string = 'default'): TechnicalAnalysisSkill {
    return new TechnicalAnalysisSkill({ profile });
  }

  /**
   * Check if connected to Binance
   */
  async isConnected(): Promise<boolean> {
    return this.binanceSkill.isConnected();
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    connected: boolean;
    environment?: string;
  }> {
    const status = await this.binanceSkill.getStatus();
    return {
      connected: status.connected,
      environment: status.environment,
    };
  }

  /**
   * Get klines/candlestick data from Binance
   */
  async getKlines(symbol: string, interval: string, limit: number = 100): Promise<Kline[]> {
    return this.binanceSkill.getKlines(symbol, interval, { limit });
  }

  /**
   * Calculate Simple Moving Average (SMA)
   */
  calculateSMA(data: Kline[], period: number): MovingAverageResult {
    const values: (number | null)[] = [];
    const closes = data.map(k => parseFloat(k.close));

    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        values.push(null);
        continue;
      }

      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += closes[i - j];
      }
      values.push(sum / period);
    }

    return {
      values,
      type: 'SMA',
      period,
    };
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   */
  calculateEMA(data: Kline[], period: number): MovingAverageResult {
    const values: (number | null)[] = [];
    const closes = data.map(k => parseFloat(k.close));
    const multiplier = 2 / (period + 1);

    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        values.push(null);
        continue;
      }

      if (i === period - 1) {
        // First EMA is SMA
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += closes[i - j];
        }
        values.push(sum / period);
      } else {
        // EMA = (Close - Previous EMA) * multiplier + Previous EMA
        const prevEma = values[i - 1]!;
        const ema = (closes[i] - prevEma) * multiplier + prevEma;
        values.push(ema);
      }
    }

    return {
      values,
      type: 'EMA',
      period,
    };
  }

  /**
   * Calculate Weighted Moving Average (WMA)
   */
  calculateWMA(data: Kline[], period: number): MovingAverageResult {
    const values: (number | null)[] = [];
    const closes = data.map(k => parseFloat(k.close));
    const denominator = (period * (period + 1)) / 2;

    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        values.push(null);
        continue;
      }

      let weightedSum = 0;
      for (let j = 0; j < period; j++) {
        // Most recent price gets highest weight
        weightedSum += closes[i - j] * (period - j);
      }
      values.push(weightedSum / denominator);
    }

    return {
      values,
      type: 'WMA',
      period,
    };
  }

  /**
   * Calculate Relative Strength Index (RSI)
   */
  calculateRSI(data: Kline[], period: number = 14, overbought: number = 70, oversold: number = 30): RSIResult {
    const closes = data.map(k => parseFloat(k.close));
    const gains: number[] = [];
    const losses: number[] = [];
    const rsiValues: (number | null)[] = [];

    // Calculate price changes
    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate RSI
    for (let i = 0; i < closes.length; i++) {
      if (i < period) {
        rsiValues.push(null);
        continue;
      }

      // Calculate average gain and loss
      let avgGain = 0;
      let avgLoss = 0;

      for (let j = 0; j < period; j++) {
        avgGain += gains[i - period + j];
        avgLoss += losses[i - period + j];
      }

      avgGain /= period;
      avgLoss /= period;

      if (avgLoss === 0) {
        rsiValues.push(100);
      } else {
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        rsiValues.push(rsi);
      }
    }

    return {
      values: rsiValues,
      period,
      overbought,
      oversold,
    };
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  calculateMACD(
    data: Kline[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): MACDResult {
    const closes = data.map(k => parseFloat(k.close));
    
    // Calculate fast and slow EMAs
    const fastEMA = this.calculateEMAValues(closes, fastPeriod);
    const slowEMA = this.calculateEMAValues(closes, slowPeriod);

    // MACD Line = Fast EMA - Slow EMA
    const macdLine: (number | null)[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (fastEMA[i] === null || slowEMA[i] === null) {
        macdLine.push(null);
      } else {
        macdLine.push(fastEMA[i]! - slowEMA[i]!);
      }
    }

    // Signal Line = EMA of MACD Line
    const signalLine = this.calculateEMAOfArray(macdLine, signalPeriod);

    // Histogram = MACD Line - Signal Line
    const histogram: (number | null)[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (macdLine[i] === null || signalLine[i] === null) {
        histogram.push(null);
      } else {
        histogram.push(macdLine[i]! - signalLine[i]!);
      }
    }

    return {
      macdLine,
      signalLine,
      histogram,
      fastPeriod,
      slowPeriod,
      signalPeriod,
    };
  }

  /**
   * Helper: Calculate EMA values from an array of numbers
   */
  private calculateEMAValues(data: number[], period: number): (number | null)[] {
    const values: (number | null)[] = [];
    const multiplier = 2 / (period + 1);

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        values.push(null);
        continue;
      }

      if (i === period - 1) {
        // First EMA is SMA
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j];
        }
        values.push(sum / period);
      } else {
        const prevEma = values[i - 1]!;
        const ema = (data[i] - prevEma) * multiplier + prevEma;
        values.push(ema);
      }
    }

    return values;
  }

  /**
   * Helper: Calculate EMA from an array that may contain nulls
   */
  private calculateEMAOfArray(data: (number | null)[], period: number): (number | null)[] {
    const values: (number | null)[] = [];
    const multiplier = 2 / (period + 1);
    let validCount = 0;
    let sum = 0;

    for (let i = 0; i < data.length; i++) {
      if (data[i] === null) {
        values.push(null);
        continue;
      }

      validCount++;

      if (validCount < period) {
        sum += data[i]!;
        values.push(null);
      } else if (validCount === period) {
        sum += data[i]!;
        values.push(sum / period);
      } else {
        const prevEma = values[i - 1]!;
        const ema = (data[i]! - prevEma) * multiplier + prevEma;
        values.push(ema);
      }
    }

    return values;
  }

  /**
   * Calculate Bollinger Bands
   */
  calculateBollingerBands(data: Kline[], period: number = 20, stdDev: number = 2): BollingerBandsResult {
    const closes = data.map(k => parseFloat(k.close));
    const upper: (number | null)[] = [];
    const middle: (number | null)[] = [];
    const lower: (number | null)[] = [];
    const bandwidth: (number | null)[] = [];
    const percentB: (number | null)[] = [];

    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        upper.push(null);
        middle.push(null);
        lower.push(null);
        bandwidth.push(null);
        percentB.push(null);
        continue;
      }

      // Calculate SMA (middle band)
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += closes[i - j];
      }
      const sma = sum / period;

      // Calculate standard deviation
      let variance = 0;
      for (let j = 0; j < period; j++) {
        variance += Math.pow(closes[i - j] - sma, 2);
      }
      const standardDeviation = Math.sqrt(variance / period);

      // Bollinger Bands
      const upperBand = sma + (standardDeviation * stdDev);
      const lowerBand = sma - (standardDeviation * stdDev);

      // Bandwidth = (Upper - Lower) / Middle
      const bw = (upperBand - lowerBand) / sma;

      // %B = (Price - Lower) / (Upper - Lower)
      const pb = (closes[i] - lowerBand) / (upperBand - lowerBand);

      upper.push(upperBand);
      middle.push(sma);
      lower.push(lowerBand);
      bandwidth.push(bw);
      percentB.push(pb);
    }

    return {
      upper,
      middle,
      lower,
      bandwidth,
      percentB,
      period,
      stdDev,
    };
  }

  /**
   * Generate trading signals from indicators
   */
  generateSignals(
    data: Kline[],
    rsi?: RSIResult,
    macd?: MACDResult,
    bollinger?: BollingerBandsResult,
    smas?: MovingAverageResult[]
  ): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const lastIndex = data.length - 1;
    const currentPrice = parseFloat(data[lastIndex].close);
    const timestamp = data[lastIndex].closeTime;

    // RSI Signals
    if (rsi && rsi.values[lastIndex] !== null) {
      const rsiValue = rsi.values[lastIndex]!;
      
      if (rsiValue > rsi.overbought) {
        signals.push({
          type: 'sell',
          indicator: 'RSI',
          confidence: Math.min((rsiValue - rsi.overbought) / 20, 0.9),
          description: `RSI overbought at ${rsiValue.toFixed(2)}`,
          timestamp,
          price: currentPrice,
        });
      } else if (rsiValue < rsi.oversold) {
        signals.push({
          type: 'buy',
          indicator: 'RSI',
          confidence: Math.min((rsi.oversold - rsiValue) / 20, 0.9),
          description: `RSI oversold at ${rsiValue.toFixed(2)}`,
          timestamp,
          price: currentPrice,
        });
      } else {
        signals.push({
          type: 'neutral',
          indicator: 'RSI',
          confidence: 0.5,
          description: `RSI neutral at ${rsiValue.toFixed(2)}`,
          timestamp,
          price: currentPrice,
        });
      }
    }

    // MACD Signals
    if (macd && macd.macdLine[lastIndex] !== null && macd.signalLine[lastIndex] !== null) {
      const macdValue = macd.macdLine[lastIndex]!;
      const signalValue = macd.signalLine[lastIndex]!;
      const histogramValue = macd.histogram[lastIndex] || 0;
      
      // Check for crossover at previous candle
      const prevMacd = macd.macdLine[lastIndex - 1];
      const prevSignal = macd.signalLine[lastIndex - 1];
      
      if (prevMacd !== null && prevSignal !== null) {
        const wasBelow = prevMacd < prevSignal;
        const wasAbove = prevMacd > prevSignal;
        const isAbove = macdValue > signalValue;
        const isBelow = macdValue < signalValue;

        if (wasBelow && isAbove) {
          // Bullish crossover
          signals.push({
            type: 'buy',
            indicator: 'MACD',
            confidence: Math.min(Math.abs(histogramValue) / Math.abs(macdValue) * 2, 0.9),
            description: 'MACD bullish crossover',
            timestamp,
            price: currentPrice,
          });
        } else if (wasAbove && isBelow) {
          // Bearish crossover
          signals.push({
            type: 'sell',
            indicator: 'MACD',
            confidence: Math.min(Math.abs(histogramValue) / Math.abs(macdValue) * 2, 0.9),
            description: 'MACD bearish crossover',
            timestamp,
            price: currentPrice,
          });
        } else {
          signals.push({
            type: 'neutral',
            indicator: 'MACD',
            confidence: 0.5,
            description: histogramValue > 0 ? 'MACD above signal' : 'MACD below signal',
            timestamp,
            price: currentPrice,
          });
        }
      }
    }

    // Bollinger Bands Signals
    if (bollinger && bollinger.percentB[lastIndex] !== null) {
      const percentB = bollinger.percentB[lastIndex]!;
      const upper = bollinger.upper[lastIndex]!;
      const lower = bollinger.lower[lastIndex]!;
      
      if (percentB > 1) {
        // Price above upper band
        signals.push({
          type: 'sell',
          indicator: 'Bollinger Bands',
          confidence: Math.min((percentB - 1) * 2, 0.8),
          description: `Price above upper band (${percentB.toFixed(2)})`,
          timestamp,
          price: currentPrice,
        });
      } else if (percentB < 0) {
        // Price below lower band
        signals.push({
          type: 'buy',
          indicator: 'Bollinger Bands',
          confidence: Math.min(Math.abs(percentB) * 2, 0.8),
          description: `Price below lower band (${percentB.toFixed(2)})`,
          timestamp,
          price: currentPrice,
        });
      } else {
        signals.push({
          type: 'neutral',
          indicator: 'Bollinger Bands',
          confidence: 0.5,
          description: `Price within bands (${percentB.toFixed(2)})`,
          timestamp,
          price: currentPrice,
        });
      }
    }

    // Moving Average Signals
    if (smas && smas.length >= 2) {
      const fastMA = smas[0].values[lastIndex];
      const slowMA = smas[1].values[lastIndex];
      const prevFastMA = smas[0].values[lastIndex - 1];
      const prevSlowMA = smas[1].values[lastIndex - 1];

      if (fastMA !== null && slowMA !== null && prevFastMA !== null && prevSlowMA !== null) {
        const wasBelow = prevFastMA < prevSlowMA;
        const wasAbove = prevFastMA > prevSlowMA;
        const isAbove = fastMA > slowMA;
        const isBelow = fastMA < slowMA;

        if (wasBelow && isAbove) {
          signals.push({
            type: 'buy',
            indicator: 'MA Crossover',
            confidence: 0.7,
            description: `Golden cross: ${smas[0].period}MA crossed above ${smas[1].period}MA`,
            timestamp,
            price: currentPrice,
          });
        } else if (wasAbove && isBelow) {
          signals.push({
            type: 'sell',
            indicator: 'MA Crossover',
            confidence: 0.7,
            description: `Death cross: ${smas[0].period}MA crossed below ${smas[1].period}MA`,
            timestamp,
            price: currentPrice,
          });
        } else {
          signals.push({
            type: isAbove ? 'buy' : 'sell',
            indicator: 'MA Trend',
            confidence: 0.5,
            description: `${smas[0].period}MA ${isAbove ? 'above' : 'below'} ${smas[1].period}MA`,
            timestamp,
            price: currentPrice,
          });
        }
      }
    }

    return signals;
  }

  /**
   * Calculate overall signal from multiple indicator signals
   */
  calculateOverallSignal(signals: TradingSignal[]): { signal: SignalType; confidence: number } {
    if (signals.length === 0) {
      return { signal: 'neutral', confidence: 0 };
    }

    let buyScore = 0;
    let sellScore = 0;
    let totalConfidence = 0;

    for (const signal of signals) {
      totalConfidence += signal.confidence;
      if (signal.type === 'buy') {
        buyScore += signal.confidence;
      } else if (signal.type === 'sell') {
        sellScore += signal.confidence;
      }
    }

    const avgConfidence = totalConfidence / signals.length;

    if (buyScore > sellScore * 1.5) {
      return { signal: 'buy', confidence: Math.min(buyScore / (buyScore + sellScore || 1), 0.95) };
    } else if (sellScore > buyScore * 1.5) {
      return { signal: 'sell', confidence: Math.min(sellScore / (buyScore + sellScore || 1), 0.95) };
    } else {
      return { signal: 'neutral', confidence: avgConfidence };
    }
  }

  /**
   * Perform comprehensive technical analysis
   */
  async analyze(
    symbol: string,
    interval: string = '1h',
    options: {
      rsiPeriod?: number;
      macdFast?: number;
      macdSlow?: number;
      macdSignal?: number;
      bollingerPeriod?: number;
      bollingerStdDev?: number;
      smaPeriods?: number[];
    } = {}
  ): Promise<AnalysisResult> {
    const {
      rsiPeriod = 14,
      macdFast = 12,
      macdSlow = 26,
      macdSignal = 9,
      bollingerPeriod = 20,
      bollingerStdDev = 2,
      smaPeriods = [20, 50],
    } = options;

    // Fetch enough data for all indicators
    const maxPeriod = Math.max(rsiPeriod, macdSlow, bollingerPeriod, ...smaPeriods) * 2;
    const data = await this.getKlines(symbol, interval, maxPeriod);

    if (data.length === 0) {
      throw new Error(`No data available for ${symbol}`);
    }

    // Calculate indicators
    const rsi = this.calculateRSI(data, rsiPeriod);
    const macd = this.calculateMACD(data, macdFast, macdSlow, macdSignal);
    const bollinger = this.calculateBollingerBands(data, bollingerPeriod, bollingerStdDev);
    const smas = smaPeriods.map(period => this.calculateSMA(data, period));

    // Generate signals
    const signals = this.generateSignals(data, rsi, macd, bollinger, smas.slice(0, 2));
    const { signal: overallSignal, confidence: overallConfidence } = this.calculateOverallSignal(signals);

    return {
      symbol: symbol.toUpperCase(),
      interval,
      timestamp: Date.now(),
      currentPrice: parseFloat(data[data.length - 1].close),
      signals,
      overallSignal,
      overallConfidence,
      indicators: {
        rsi,
        macd,
        bollinger,
        sma: smas,
      },
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message?: string;
    binanceStatus?: string;
  }> {
    const binanceHealth = await this.binanceSkill.healthCheck();
    
    if (binanceHealth.status === 'healthy') {
      return {
        status: 'healthy',
        message: 'Technical analysis skill ready',
        binanceStatus: binanceHealth.message,
      };
    } else {
      return {
        status: 'unhealthy',
        message: 'Binance connection required',
        binanceStatus: binanceHealth.message,
      };
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.binanceSkill.close();
  }
}

/**
 * Factory function to get TechnicalAnalysisSkill instance
 */
export function getTechnicalAnalysisSkill(profile?: string): TechnicalAnalysisSkill {
  return new TechnicalAnalysisSkill({ profile });
}

export default TechnicalAnalysisSkill;
