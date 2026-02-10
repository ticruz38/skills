/**
 * Charts Skill
 * Generate price charts and technical overlays for crypto trading
 * Built on top of binance skill for price data
 */

import { BinanceSkill, getBinanceSkill, Kline } from '@openclaw/binance';

/**
 * Chart color theme
 */
export type Theme = 'light' | 'dark';

/**
 * Chart output format
 */
export type OutputFormat = 'svg' | 'png';

/**
 * Chart type
 */
export type ChartType = 'line' | 'candlestick';

/**
 * Chart generation result
 */
export interface ChartResult {
  svg: string;
  symbol: string;
  interval: string;
  dataPoints: number;
  minPrice: number;
  maxPrice: number;
  generatedAt: string;
}

/**
 * Line chart options
 */
export interface LineChartOptions {
  interval?: string;
  limit?: number;
  movingAverages?: number[];
  width?: number;
  height?: number;
  theme?: Theme;
  title?: string;
}

/**
 * Candlestick chart options
 */
export interface CandlestickChartOptions {
  interval?: string;
  limit?: number;
  showVolume?: boolean;
  movingAverages?: number[];
  width?: number;
  height?: number;
  theme?: Theme;
  title?: string;
}

/**
 * Charts skill configuration
 */
export interface ChartsSkillConfig {
  profile?: string;
}

/**
 * Theme colors
 */
interface ThemeColors {
  background: string;
  grid: string;
  text: string;
  textMuted: string;
  line: string;
  lineUp: string;
  lineDown: string;
  candleUp: string;
  candleDown: string;
  volume: string;
  ma: string[];
}

const THEMES: Record<Theme, ThemeColors> = {
  dark: {
    background: '#1a1a2e',
    grid: '#2d2d44',
    text: '#e0e0e0',
    textMuted: '#888888',
    line: '#00d4aa',
    lineUp: '#00d4aa',
    lineDown: '#ff4757',
    candleUp: '#00d4aa',
    candleDown: '#ff4757',
    volume: '#4a4a6a',
    ma: ['#ffd700', '#ff6b6b', '#4ecdc4', '#95e1d3', '#f38181'],
  },
  light: {
    background: '#ffffff',
    grid: '#e0e0e0',
    text: '#333333',
    textMuted: '#666666',
    line: '#26a69a',
    lineUp: '#26a69a',
    lineDown: '#ef5350',
    candleUp: '#26a69a',
    candleDown: '#ef5350',
    volume: '#90a4ae',
    ma: ['#ffa726', '#ef5350', '#42a5f5', '#66bb6a', '#ab47bc'],
  },
};

/**
 * Charts Skill - Generate price charts and technical overlays
 */
export class ChartsSkill {
  private binanceSkill: BinanceSkill;
  private profile: string;

  constructor(config: ChartsSkillConfig = {}) {
    this.profile = config.profile || 'default';
    this.binanceSkill = getBinanceSkill(this.profile);
  }

  /**
   * Create ChartsSkill for a specific profile
   */
  static forProfile(profile: string = 'default'): ChartsSkill {
    return new ChartsSkill({ profile });
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
  calculateSMA(data: Kline[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }
      
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += parseFloat(data[i - j].close);
      }
      result.push(sum / period);
    }
    
    return result;
  }

  /**
   * Format price for display
   */
  private formatPrice(price: number): string {
    if (price >= 1000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (price >= 1) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    } else {
      return price.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
    }
  }

  /**
   * Format date for display
   */
  private formatDate(timestamp: number, interval: string): string {
    const date = new Date(timestamp);
    const intervalMinutes = this.intervalToMinutes(interval);
    
    if (intervalMinutes < 60) {
      // Intraday - show time
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (intervalMinutes < 1440) {
      // Hourly - show date and hour
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
             date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
      // Daily or higher - show date only
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    }
  }

  /**
   * Convert interval to minutes
   */
  private intervalToMinutes(interval: string): number {
    const unit = interval.slice(-1);
    const value = parseInt(interval.slice(0, -1), 10);
    
    switch (unit) {
      case 'm': return value;
      case 'h': return value * 60;
      case 'd': return value * 1440;
      case 'w': return value * 10080;
      case 'M': return value * 43200;
      default: return 60;
    }
  }

  /**
   * Generate a line chart
   */
  async generateLineChart(symbol: string, options: LineChartOptions = {}): Promise<ChartResult> {
    const {
      interval = '1h',
      limit = 100,
      movingAverages = [],
      width = 1200,
      height = 600,
      theme = 'dark',
      title,
    } = options;

    // Fetch data
    const klines = await this.getKlines(symbol, interval, limit);
    
    if (klines.length === 0) {
      throw new Error(`No data available for ${symbol}`);
    }

    // Calculate moving averages
    const maData: { period: number; values: (number | null)[] }[] = [];
    for (const period of movingAverages) {
      maData.push({ period, values: this.calculateSMA(klines, period) });
    }

    // Chart dimensions
    const padding = { top: 60, right: 80, bottom: 50, left: 80 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate price range
    const prices = klines.map(k => parseFloat(k.close));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const pricePadding = priceRange * 0.1;
    const yMin = minPrice - pricePadding;
    const yMax = maxPrice + pricePadding;

    // Colors
    const colors = THEMES[theme];

    // Helper functions
    const getX = (index: number) => padding.left + (index / (klines.length - 1)) * chartWidth;
    const getY = (price: number) => padding.top + chartHeight - ((price - yMin) / (yMax - yMin)) * chartHeight;

    // Build SVG
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.line};stop-opacity:0.3" />
      <stop offset="100%" style="stop-color:${colors.line};stop-opacity:0" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${colors.background}"/>
  
  <!-- Title -->
  <text x="${width / 2}" y="30" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" 
        font-size="18" font-weight="bold" fill="${colors.text}">
    ${title || `${symbol} - ${interval} Chart`}
  </text>
`;

    // Grid lines
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      const price = yMax - (yMax - yMin) * (i / gridLines);
      
      svg += `
  <!-- Horizontal grid line ${i} -->
  <line x1="${padding.left}" y1="${y}" x2="${padding.left + chartWidth}" y2="${y}" 
        stroke="${colors.grid}" stroke-width="1" opacity="0.5"/>
  <text x="${padding.left + chartWidth + 10}" y="${y + 4}" font-family="system-ui, -apple-system, sans-serif" 
        font-size="11" fill="${colors.textMuted}">${this.formatPrice(price)}</text>
`;
    }

    // Price line path
    let pathD = `M ${getX(0)} ${getY(prices[0])}`;
    for (let i = 1; i < prices.length; i++) {
      pathD += ` L ${getX(i)} ${getY(prices[i])}`;
    }

    // Area fill
    let areaD = pathD + ` L ${getX(prices.length - 1)} ${padding.top + chartHeight} L ${getX(0)} ${padding.top + chartHeight} Z`;

    svg += `
  <!-- Area fill -->
  <path d="${areaD}" fill="url(#priceGradient)"/>
  
  <!-- Price line -->
  <path d="${pathD}" fill="none" stroke="${colors.line}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
`;

    // Moving averages
    maData.forEach((ma, index) => {
      const color = colors.ma[index % colors.ma.length];
      let maPath = '';
      let started = false;
      
      for (let i = 0; i < ma.values.length; i++) {
        const value = ma.values[i];
        if (value !== null) {
          const x = getX(i);
          const y = getY(value);
          if (!started) {
            maPath = `M ${x} ${y}`;
            started = true;
          } else {
            maPath += ` L ${x} ${y}`;
          }
        }
      }
      
      if (maPath) {
        svg += `
  <!-- MA ${ma.period} -->
  <path d="${maPath}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="5,3"/>
`;
      }
    });

    // X-axis labels
    const labelCount = Math.min(6, klines.length);
    const labelStep = Math.floor(klines.length / labelCount);
    
    for (let i = 0; i < klines.length; i += labelStep) {
      const x = getX(i);
      const date = this.formatDate(klines[i].openTime, interval);
      
      svg += `
  <text x="${x}" y="${height - 15}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" 
        font-size="10" fill="${colors.textMuted}">${date}</text>
`;
    }

    // Legend
    if (maData.length > 0) {
      let legendX = padding.left;
      const legendY = height - 35;
      
      svg += `
  <!-- Legend -->
`;
      maData.forEach((ma, index) => {
        const color = colors.ma[index % colors.ma.length];
        svg += `
  <line x1="${legendX}" y1="${legendY}" x2="${legendX + 20}" y2="${legendY}" stroke="${color}" stroke-width="2"/>
  <text x="${legendX + 25}" y="${legendY + 4}" font-family="system-ui, -apple-system, sans-serif" 
        font-size="11" fill="${colors.text}">MA${ma.period}</text>
`;
        legendX += 60;
      });
    }

    // Current price label
    const currentPrice = prices[prices.length - 1];
    const currentY = getY(currentPrice);
    
    svg += `
  <!-- Current price line -->
  <line x1="${padding.left}" y1="${currentY}" x2="${padding.left + chartWidth}" y2="${currentY}" 
        stroke="${colors.line}" stroke-width="1" stroke-dasharray="3,3" opacity="0.7"/>
  <rect x="${padding.left + chartWidth + 5}" y="${currentY - 10}" width="70" height="20" 
        fill="${colors.line}" rx="3"/>
  <text x="${padding.left + chartWidth + 40}" y="${currentY + 4}" text-anchor="middle" 
        font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="${colors.background}" font-weight="bold">
    ${this.formatPrice(currentPrice)}
  </text>
`;

    svg += `</svg>`;

    return {
      svg,
      symbol: symbol.toUpperCase(),
      interval,
      dataPoints: klines.length,
      minPrice,
      maxPrice,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a candlestick chart
   */
  async generateCandlestickChart(symbol: string, options: CandlestickChartOptions = {}): Promise<ChartResult> {
    const {
      interval = '1h',
      limit = 100,
      showVolume = false,
      movingAverages = [],
      width = 1200,
      height = showVolume ? 700 : 600,
      theme = 'dark',
      title,
    } = options;

    // Fetch data
    const klines = await this.getKlines(symbol, interval, limit);
    
    if (klines.length === 0) {
      throw new Error(`No data available for ${symbol}`);
    }

    // Calculate moving averages
    const maData: { period: number; values: (number | null)[] }[] = [];
    for (const period of movingAverages) {
      maData.push({ period, values: this.calculateSMA(klines, period) });
    }

    // Chart dimensions
    const padding = { top: 60, right: 80, bottom: showVolume ? 150 : 50, left: 80 };
    const chartWidth = width - padding.left - padding.right;
    const priceChartHeight = showVolume 
      ? height - padding.top - padding.bottom - 100 
      : height - padding.top - padding.bottom;

    // Calculate price range
    const highs = klines.map(k => parseFloat(k.high));
    const lows = klines.map(k => parseFloat(k.low));
    const minPrice = Math.min(...lows);
    const maxPrice = Math.max(...highs);
    const priceRange = maxPrice - minPrice;
    const pricePadding = priceRange * 0.05;
    const yMin = minPrice - pricePadding;
    const yMax = maxPrice + pricePadding;

    // Volume data
    const volumes = klines.map(k => parseFloat(k.volume));
    const maxVolume = Math.max(...volumes);

    // Colors
    const colors = THEMES[theme];

    // Helper functions
    const candleWidth = chartWidth / klines.length * 0.7;
    const getX = (index: number) => padding.left + (index + 0.5) * (chartWidth / klines.length);
    const getY = (price: number) => padding.top + priceChartHeight - ((price - yMin) / (yMax - yMin)) * priceChartHeight;
    const getVolumeY = (volume: number) => height - 100 - (volume / maxVolume) * 80;

    // Build SVG
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${colors.background}"/>
  
  <!-- Title -->
  <text x="${width / 2}" y="30" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" 
        font-size="18" font-weight="bold" fill="${colors.text}">
    ${title || `${symbol} - ${interval} Candlestick Chart`}
  </text>
`;

    // Grid lines for price
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (priceChartHeight / gridLines) * i;
      const price = yMax - (yMax - yMin) * (i / gridLines);
      
      svg += `
  <!-- Horizontal grid line ${i} -->
  <line x1="${padding.left}" y1="${y}" x2="${padding.left + chartWidth}" y2="${y}" 
        stroke="${colors.grid}" stroke-width="1" opacity="0.3"/>
  <text x="${padding.left + chartWidth + 10}" y="${y + 4}" font-family="system-ui, -apple-system, sans-serif" 
        font-size="11" fill="${colors.textMuted}">${this.formatPrice(price)}</text>
`;
    }

    // Candlesticks
    klines.forEach((kline, index) => {
      const open = parseFloat(kline.open);
      const high = parseFloat(kline.high);
      const low = parseFloat(kline.low);
      const close = parseFloat(kline.close);
      const isUp = close >= open;
      
      const x = getX(index);
      const yOpen = getY(open);
      const yClose = getY(close);
      const yHigh = getY(high);
      const yLow = getY(low);
      
      const candleColor = isUp ? colors.candleUp : colors.candleDown;
      
      // Wick
      svg += `
  <!-- Candle ${index} wick -->
  <line x1="${x}" y1="${yHigh}" x2="${x}" y2="${yLow}" stroke="${candleColor}" stroke-width="1"/>
`;
      
      // Body
      const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1);
      const bodyY = Math.min(yOpen, yClose);
      
      svg += `
  <!-- Candle ${index} body -->
  <rect x="${x - candleWidth / 2}" y="${bodyY}" width="${candleWidth}" height="${bodyHeight}" 
        fill="${candleColor}"${isUp ? '' : ` stroke="${candleColor}" stroke-width="1`}/>
`;
    });

    // Volume bars
    if (showVolume) {
      svg += `
  <!-- Volume separator -->
  <line x1="${padding.left}" y1="${height - 110}" x2="${padding.left + chartWidth}" y2="${height - 110}" 
        stroke="${colors.grid}" stroke-width="1"/>
`;
      
      klines.forEach((kline, index) => {
        const close = parseFloat(kline.close);
        const open = parseFloat(kline.open);
        const isUp = close >= open;
        
        const x = getX(index);
        const volume = parseFloat(kline.volume);
        const y = getVolumeY(volume);
        const barHeight = height - 100 - y;
        
        const barColor = isUp ? colors.candleUp : colors.candleDown;
        
        svg += `
  <!-- Volume ${index} -->
  <rect x="${x - candleWidth / 2}" y="${y}" width="${candleWidth}" height="${barHeight}" 
        fill="${barColor}" opacity="0.5"/>
`;
      });
    }

    // Moving averages
    maData.forEach((ma, index) => {
      const color = colors.ma[index % colors.ma.length];
      let maPath = '';
      let started = false;
      
      for (let i = 0; i < ma.values.length; i++) {
        const value = ma.values[i];
        if (value !== null) {
          const x = getX(i);
          const y = getY(value);
          if (!started) {
            maPath = `M ${x} ${y}`;
            started = true;
          } else {
            maPath += ` L ${x} ${y}`;
          }
        }
      }
      
      if (maPath) {
        svg += `
  <!-- MA ${ma.period} -->
  <path d="${maPath}" fill="none" stroke="${color}" stroke-width="1.5"/>
`;
      }
    });

    // X-axis labels
    const labelCount = Math.min(6, klines.length);
    const labelStep = Math.floor(klines.length / labelCount);
    
    for (let i = 0; i < klines.length; i += labelStep) {
      const x = getX(i);
      const date = this.formatDate(klines[i].openTime, interval);
      
      svg += `
  <text x="${x}" y="${height - 15}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" 
        font-size="10" fill="${colors.textMuted}">${date}</text>
`;
    }

    // Legend
    if (maData.length > 0) {
      let legendX = padding.left;
      const legendY = height - 130;
      
      svg += `
  <!-- Legend -->
`;
      maData.forEach((ma, index) => {
        const color = colors.ma[index % colors.ma.length];
        svg += `
  <line x1="${legendX}" y1="${legendY}" x2="${legendX + 20}" y2="${legendY}" stroke="${color}" stroke-width="2"/>
  <text x="${legendX + 25}" y="${legendY + 4}" font-family="system-ui, -apple-system, sans-serif" 
        font-size="11" fill="${colors.text}">MA${ma.period}</text>
`;
        legendX += 60;
      });
    }

    svg += `</svg>`;

    return {
      svg,
      symbol: symbol.toUpperCase(),
      interval,
      dataPoints: klines.length,
      minPrice,
      maxPrice,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Save chart to file
   */
  async saveChart(result: ChartResult, filepath: string, format: OutputFormat = 'svg'): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    
    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (format === 'svg') {
      fs.writeFileSync(filepath, result.svg);
    } else {
      throw new Error('PNG format requires external conversion. Save as SVG and convert using a tool like rsvg-convert or sharp.');
    }
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
        message: 'Charts skill ready',
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
 * Factory function to get ChartsSkill instance
 */
export function getChartsSkill(profile?: string): ChartsSkill {
  return new ChartsSkill({ profile });
}

export default ChartsSkill;
