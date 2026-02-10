/**
 * Chart Generator Skill
 * Generate charts and visualizations from data sources
 * Built on top of data-connector skill for data access
 */

import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Data connector dependency
let DataConnector: typeof import('@openclaw/data-connector') | null = null;

/**
 * Chart types supported
 */
export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'area';

/**
 * Output formats
 */
export type OutputFormat = 'svg' | 'png' | 'html';

/**
 * Color theme
 */
export type Theme = 'light' | 'dark' | 'colorful';

/**
 * Chart data point
 */
export interface DataPoint {
  label: string;
  value: number;
  category?: string;
  color?: string;
}

/**
 * Chart series for multi-series charts
 */
export interface ChartSeries {
  name: string;
  data: DataPoint[];
  color?: string;
}

/**
 * Chart configuration
 */
export interface ChartConfig {
  type: ChartType;
  title?: string;
  width?: number;
  height?: number;
  theme?: Theme;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  colors?: string[];
}

/**
 * Chart generation result
 */
export interface ChartResult {
  format: OutputFormat;
  content: string;
  width: number;
  height: number;
  generatedAt: string;
}

/**
 * Saved chart template
 */
export interface ChartTemplate {
  id?: number;
  name: string;
  type: ChartType;
  config: ChartConfig;
  dataSource?: {
    connectionId: number;
    labelColumn: string;
    valueColumn: string;
  };
  createdAt?: string;
}

/**
 * Template database record
 */
interface TemplateRecord {
  id?: number;
  name: string;
  type: ChartType;
  config: string;
  data_source?: string | null;
  created_at?: string;
}

/**
 * Color palettes
 */
const COLOR_PALETTES: Record<Theme, string[]> = {
  light: [
    '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
    '#00BCD4', '#795548', '#607D8B', '#E91E63', '#3F51B5'
  ],
  dark: [
    '#81C784', '#64B5F6', '#FFB74D', '#BA68C8', '#E57373',
    '#4DD0E1', '#A1887F', '#90A4AE', '#F06292', '#7986CB'
  ],
  colorful: [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ]
};

/**
 * Theme colors for backgrounds and text
 */
const THEME_COLORS: Record<Theme, { background: string; text: string; grid: string; title: string }> = {
  light: {
    background: '#ffffff',
    text: '#333333',
    grid: '#e0e0e0',
    title: '#212121'
  },
  dark: {
    background: '#1e1e1e',
    text: '#e0e0e0',
    grid: '#424242',
    title: '#ffffff'
  },
  colorful: {
    background: '#f8f9fa',
    text: '#495057',
    grid: '#dee2e6',
    title: '#212529'
  }
};

/**
 * Helper to run SQL and get lastID
 */
function runWithResult(
  db: sqlite3.Database,
  sql: string,
  params: any[] = []
): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Chart Generator Skill
 */
export class ChartGeneratorSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const storageDir = path.join(os.homedir(), '.openclaw', 'skills', 'chart-generator');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.dbPath = path.join(storageDir, 'charts.db');
  }

  /**
   * Initialize database
   */
  private async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        this.createTables().then(resolve).catch(reject);
      });
    });
    
    return this.initPromise;
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = [
      `CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        config TEXT NOT NULL,
        data_source TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS chart_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER,
        format TEXT NOT NULL,
        output_path TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
      )`
    ];

    for (const sql of tables) {
      await new Promise<void>((resolve, reject) => {
        this.db!.run(sql, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  /**
   * Load data connector module dynamically
   */
  private async loadDataConnector(): Promise<typeof import('@openclaw/data-connector')> {
    if (!DataConnector) {
      DataConnector = await import('@openclaw/data-connector');
    }
    return DataConnector;
  }

  /**
   * Generate a chart from data
   */
  generateChart(data: DataPoint[] | ChartSeries[], config: ChartConfig): ChartResult {
    const width = config.width || 800;
    const height = config.height || 600;
    const theme = config.theme || 'light';
    const format: OutputFormat = 'svg';

    let svg: string;
    
    switch (config.type) {
      case 'bar':
        svg = this.generateBarChart(data, config, width, height, theme);
        break;
      case 'line':
        svg = this.generateLineChart(data, config, width, height, theme);
        break;
      case 'pie':
      case 'doughnut':
        svg = this.generatePieChart(data, config, width, height, theme);
        break;
      case 'area':
        svg = this.generateAreaChart(data, config, width, height, theme);
        break;
      default:
        throw new Error(`Unsupported chart type: ${config.type}`);
    }

    return {
      format,
      content: svg,
      width,
      height,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate bar chart SVG
   */
  private generateBarChart(
    data: DataPoint[] | ChartSeries[],
    config: ChartConfig,
    width: number,
    height: number,
    theme: Theme
  ): string {
    const colors = config.colors || COLOR_PALETTES[theme];
    const themeColors = THEME_COLORS[theme];
    const margin = { top: 60, right: 40, bottom: 80, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Normalize data to ChartSeries format
    const series = this.normalizeToSeries(data);
    const allLabels = this.getAllLabels(series);
    const maxValue = Math.max(...series.flatMap(s => s.data.map(d => d.value)), 0);

    const barGroupWidth = chartWidth / allLabels.length;
    const barWidth = (barGroupWidth * 0.8) / series.length;
    const barSpacing = barGroupWidth * 0.2;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${themeColors.background}"/>
  ${config.title ? `<text x="${width / 2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="${themeColors.title}">${this.escapeXml(config.title)}</text>` : ''}
  <g transform="translate(${margin.left}, ${margin.top})">`;

    // Grid lines
    if (config.showGrid !== false) {
      const gridCount = 5;
      for (let i = 0; i <= gridCount; i++) {
        const y = chartHeight - (i * chartHeight / gridCount);
        const value = (maxValue * i / gridCount).toFixed(0);
        svg += `
    <line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="${themeColors.grid}" stroke-width="1"/>
    <text x="-10" y="${y + 4}" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="${themeColors.text}">${value}</text>`;
      }
    }

    // Bars
    allLabels.forEach((label, labelIndex) => {
      const groupX = labelIndex * barGroupWidth + barSpacing / 2;
      
      series.forEach((s, seriesIndex) => {
        const dataPoint = s.data.find(d => d.label === label);
        if (dataPoint) {
          const barHeight = (dataPoint.value / maxValue) * chartHeight;
          const x = groupX + seriesIndex * barWidth;
          const y = chartHeight - barHeight;
          const color = s.color || dataPoint.color || colors[seriesIndex % colors.length];
          
          svg += `
    <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="2"/>
    <text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="${themeColors.text}">${dataPoint.value}</text>`;
        }
      });

      // X-axis label
      const labelX = groupX + (series.length * barWidth) / 2;
      svg += `
    <text x="${labelX}" y="${chartHeight + 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="${themeColors.text}">${this.escapeXml(label)}</text>`;
    });

    // X axis line
    svg += `
    <line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="${themeColors.text}" stroke-width="2"/>`;

    // Y axis label
    if (config.yAxisLabel) {
      svg += `
    <text x="${-chartHeight / 2}" y="${-60}" transform="rotate(-90)" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${themeColors.text}">${this.escapeXml(config.yAxisLabel)}</text>`;
    }

    // X axis label
    if (config.xAxisLabel) {
      svg += `
    <text x="${chartWidth / 2}" y="${chartHeight + 50}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${themeColors.text}">${this.escapeXml(config.xAxisLabel)}</text>`;
    }

    // Legend
    if (config.showLegend !== false && series.length > 1) {
      const legendY = chartHeight + 60;
      series.forEach((s, i) => {
        const legendX = i * 100;
        const color = s.color || colors[i % colors.length];
        svg += `
    <rect x="${legendX}" y="${legendY}" width="12" height="12" fill="${color}"/>
    <text x="${legendX + 18}" y="${legendY + 10}" font-family="Arial, sans-serif" font-size="11" fill="${themeColors.text}">${this.escapeXml(s.name)}</text>`;
      });
    }

    svg += `
  </g>
</svg>`;

    return svg;
  }

  /**
   * Generate line chart SVG
   */
  private generateLineChart(
    data: DataPoint[] | ChartSeries[],
    config: ChartConfig,
    width: number,
    height: number,
    theme: Theme
  ): string {
    const colors = config.colors || COLOR_PALETTES[theme];
    const themeColors = THEME_COLORS[theme];
    const margin = { top: 60, right: 40, bottom: 80, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const series = this.normalizeToSeries(data);
    const allLabels = this.getAllLabels(series);
    const maxValue = Math.max(...series.flatMap(s => s.data.map(d => d.value)), 0);
    const minValue = Math.min(0, ...series.flatMap(s => s.data.map(d => d.value)));
    const valueRange = maxValue - minValue;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${themeColors.background}"/>
  ${config.title ? `<text x="${width / 2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="${themeColors.title}">${this.escapeXml(config.title)}</text>` : ''}
  <g transform="translate(${margin.left}, ${margin.top})">`;

    // Grid lines
    if (config.showGrid !== false) {
      const gridCount = 5;
      for (let i = 0; i <= gridCount; i++) {
        const y = chartHeight - (i * chartHeight / gridCount);
        const value = (minValue + valueRange * i / gridCount).toFixed(0);
        svg += `
    <line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="${themeColors.grid}" stroke-width="1"/>
    <text x="-10" y="${y + 4}" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="${themeColors.text}">${value}</text>`;
      }
    }

    // Lines
    const xStep = chartWidth / (allLabels.length - 1 || 1);
    
    series.forEach((s, seriesIndex) => {
      const color = s.color || colors[seriesIndex % colors.length];
      let pathD = '';
      const points: { x: number; y: number; value: number }[] = [];

      allLabels.forEach((label, i) => {
        const dataPoint = s.data.find(d => d.label === label);
        const x = i * xStep;
        const y = dataPoint 
          ? chartHeight - ((dataPoint.value - minValue) / valueRange) * chartHeight
          : chartHeight;
        
        points.push({ x, y, value: dataPoint?.value || 0 });
        
        if (i === 0) {
          pathD += `M ${x} ${y}`;
        } else {
          pathD += ` L ${x} ${y}`;
        }
      });

      svg += `
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

      // Points
      points.forEach(p => {
        svg += `
    <circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" stroke="${themeColors.background}" stroke-width="2"/>`;
      });
    });

    // X-axis labels
    allLabels.forEach((label, i) => {
      const x = i * xStep;
      svg += `
    <text x="${x}" y="${chartHeight + 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="${themeColors.text}">${this.escapeXml(label)}</text>`;
    });

    // Axes
    svg += `
    <line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="${themeColors.text}" stroke-width="2"/>
    <line x1="0" y1="0" x2="0" y2="${chartHeight}" stroke="${themeColors.text}" stroke-width="2"/>`;

    // Axis labels
    if (config.yAxisLabel) {
      svg += `
    <text x="${-chartHeight / 2}" y="${-60}" transform="rotate(-90)" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${themeColors.text}">${this.escapeXml(config.yAxisLabel)}</text>`;
    }
    if (config.xAxisLabel) {
      svg += `
    <text x="${chartWidth / 2}" y="${chartHeight + 50}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${themeColors.text}">${this.escapeXml(config.xAxisLabel)}</text>`;
    }

    // Legend
    if (config.showLegend !== false && series.length > 1) {
      const legendY = chartHeight + 65;
      series.forEach((s, i) => {
        const legendX = i * 100;
        const color = s.color || colors[i % colors.length];
        svg += `
    <line x1="${legendX}" y1="${legendY + 6}" x2="${legendX + 12}" y2="${legendY + 6}" stroke="${color}" stroke-width="3"/>
    <text x="${legendX + 18}" y="${legendY + 10}" font-family="Arial, sans-serif" font-size="11" fill="${themeColors.text}">${this.escapeXml(s.name)}</text>`;
      });
    }

    svg += `
  </g>
</svg>`;

    return svg;
  }

  /**
   * Generate area chart SVG
   */
  private generateAreaChart(
    data: DataPoint[] | ChartSeries[],
    config: ChartConfig,
    width: number,
    height: number,
    theme: Theme
  ): string {
    const colors = config.colors || COLOR_PALETTES[theme];
    const themeColors = THEME_COLORS[theme];
    const margin = { top: 60, right: 40, bottom: 80, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const series = this.normalizeToSeries(data);
    const allLabels = this.getAllLabels(series);
    const maxValue = Math.max(...series.flatMap(s => s.data.map(d => d.value)), 0);
    const minValue = Math.min(0, ...series.flatMap(s => s.data.map(d => d.value)));
    const valueRange = maxValue - minValue;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${themeColors.background}"/>
  ${config.title ? `<text x="${width / 2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="${themeColors.title}">${this.escapeXml(config.title)}</text>` : ''}
  <g transform="translate(${margin.left}, ${margin.top})">`;

    // Grid lines
    if (config.showGrid !== false) {
      const gridCount = 5;
      for (let i = 0; i <= gridCount; i++) {
        const y = chartHeight - (i * chartHeight / gridCount);
        const value = (minValue + valueRange * i / gridCount).toFixed(0);
        svg += `
    <line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="${themeColors.grid}" stroke-width="1"/>
    <text x="-10" y="${y + 4}" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="${themeColors.text}">${value}</text>`;
      }
    }

    // Areas
    const xStep = chartWidth / (allLabels.length - 1 || 1);
    
    series.forEach((s, seriesIndex) => {
      const color = s.color || colors[seriesIndex % colors.length];
      const fillColor = this.hexToRgba(color, 0.3);
      
      let pathD = '';
      const points: { x: number; y: number }[] = [];

      allLabels.forEach((label, i) => {
        const dataPoint = s.data.find(d => d.label === label);
        const x = i * xStep;
        const y = dataPoint 
          ? chartHeight - ((dataPoint.value - minValue) / valueRange) * chartHeight
          : chartHeight;
        
        points.push({ x, y });
        
        if (i === 0) {
          pathD += `M ${x} ${chartHeight} L ${x} ${y}`;
        } else {
          pathD += ` L ${x} ${y}`;
        }
      });

      // Close the area
      const lastX = (allLabels.length - 1) * xStep;
      pathD += ` L ${lastX} ${chartHeight} Z`;

      svg += `
    <path d="${pathD}" fill="${fillColor}" stroke="none"/>`;

      // Line on top
      let lineD = '';
      points.forEach((p, i) => {
        if (i === 0) {
          lineD += `M ${p.x} ${p.y}`;
        } else {
          lineD += ` L ${p.x} ${p.y}`;
        }
      });

      svg += `
    <path d="${lineD}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

      // Points
      points.forEach(p => {
        svg += `
    <circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" stroke="${themeColors.background}" stroke-width="2"/>`;
      });
    });

    // X-axis labels
    allLabels.forEach((label, i) => {
      const x = i * xStep;
      svg += `
    <text x="${x}" y="${chartHeight + 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="${themeColors.text}">${this.escapeXml(label)}</text>`;
    });

    // Axes
    svg += `
    <line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="${themeColors.text}" stroke-width="2"/>
    <line x1="0" y1="0" x2="0" y2="${chartHeight}" stroke="${themeColors.text}" stroke-width="2"/>`;

    // Axis labels
    if (config.yAxisLabel) {
      svg += `
    <text x="${-chartHeight / 2}" y="${-60}" transform="rotate(-90)" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${themeColors.text}">${this.escapeXml(config.yAxisLabel)}</text>`;
    }
    if (config.xAxisLabel) {
      svg += `
    <text x="${chartWidth / 2}" y="${chartHeight + 50}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${themeColors.text}">${this.escapeXml(config.xAxisLabel)}</text>`;
    }

    // Legend
    if (config.showLegend !== false && series.length > 1) {
      const legendY = chartHeight + 65;
      series.forEach((s, i) => {
        const legendX = i * 100;
        const color = s.color || colors[i % colors.length];
        svg += `
    <rect x="${legendX}" y="${legendY}" width="12" height="12" fill="${color}" opacity="0.7"/>
    <text x="${legendX + 18}" y="${legendY + 10}" font-family="Arial, sans-serif" font-size="11" fill="${themeColors.text}">${this.escapeXml(s.name)}</text>`;
      });
    }

    svg += `
  </g>
</svg>`;

    return svg;
  }

  /**
   * Generate pie/doughnut chart SVG
   */
  private generatePieChart(
    data: DataPoint[] | ChartSeries[],
    config: ChartConfig,
    width: number,
    height: number,
    theme: Theme
  ): string {
    const colors = config.colors || COLOR_PALETTES[theme];
    const themeColors = THEME_COLORS[theme];
    const isDoughnut = config.type === 'doughnut';
    const margin = { top: 60, right: 40, bottom: 40, left: 40 };
    
    // Adjust for legend
    const legendWidth = config.showLegend !== false ? 150 : 0;
    const chartWidth = width - margin.left - margin.right - legendWidth;
    const chartHeight = height - margin.top - margin.bottom;
    
    const centerX = chartWidth / 2;
    const centerY = chartHeight / 2;
    const radius = Math.min(centerX, centerY) - 20;
    const innerRadius = isDoughnut ? radius * 0.5 : 0;

    // Get data from first series or single array
    const points = Array.isArray(data) && 'data' in data[0] 
      ? (data as ChartSeries[])[0].data 
      : data as DataPoint[];
    
    const total = points.reduce((sum, p) => sum + p.value, 0);

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${themeColors.background}"/>
  ${config.title ? `<text x="${width / 2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="${themeColors.title}">${this.escapeXml(config.title)}</text>` : ''}
  <g transform="translate(${margin.left}, ${margin.top})">`;

    // Generate pie slices
    let currentAngle = -Math.PI / 2; // Start from top
    
    points.forEach((point, i) => {
      const angle = (point.value / total) * 2 * Math.PI;
      const endAngle = currentAngle + angle;
      const color = point.color || colors[i % colors.length];
      
      // Calculate path
      const x1 = centerX + Math.cos(currentAngle) * radius;
      const y1 = centerY + Math.sin(currentAngle) * radius;
      const x2 = centerX + Math.cos(endAngle) * radius;
      const y2 = centerY + Math.sin(endAngle) * radius;
      
      const largeArcFlag = angle > Math.PI ? 1 : 0;
      
      let pathD: string;
      if (isDoughnut) {
        const x1Inner = centerX + Math.cos(currentAngle) * innerRadius;
        const y1Inner = centerY + Math.sin(currentAngle) * innerRadius;
        const x2Inner = centerX + Math.cos(endAngle) * innerRadius;
        const y2Inner = centerY + Math.sin(endAngle) * innerRadius;
        
        pathD = `M ${x1Inner} ${y1Inner} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x2Inner} ${y2Inner} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner}`;
      } else {
        pathD = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
      }
      
      const percentage = ((point.value / total) * 100).toFixed(1);
      
      svg += `
    <path d="${pathD}" fill="${color}" stroke="${themeColors.background}" stroke-width="2">
      <title>${this.escapeXml(point.label)}: ${point.value} (${percentage}%)</title>
    </path>`;

      // Label for larger slices
      if (angle > 0.3) {
        const labelAngle = currentAngle + angle / 2;
        const labelRadius = isDoughnut ? (radius + innerRadius) / 2 : radius * 0.7;
        const labelX = centerX + Math.cos(labelAngle) * labelRadius;
        const labelY = centerY + Math.sin(labelAngle) * labelRadius;
        
        svg += `
    <text x="${labelX}" y="${labelY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#ffffff" font-weight="bold">${percentage}%</text>`;
      }
      
      currentAngle = endAngle;
    });

    // Center text for doughnut
    if (isDoughnut) {
      svg += `
    <text x="${centerX}" y="${centerY - 5}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${themeColors.text}">Total</text>
    <text x="${centerX}" y="${centerY + 15}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="${themeColors.title}">${total.toLocaleString()}</text>`;
    }

    // Legend
    if (config.showLegend !== false) {
      const legendX = chartWidth + 20;
      let legendY = 20;
      
      points.forEach((point, i) => {
        const color = point.color || colors[i % colors.length];
        const percentage = ((point.value / total) * 100).toFixed(1);
        
        svg += `
    <rect x="${legendX}" y="${legendY}" width="12" height="12" fill="${color}"/>
    <text x="${legendX + 18}" y="${legendY + 10}" font-family="Arial, sans-serif" font-size="11" fill="${themeColors.text}">${this.escapeXml(point.label)}</text>
    <text x="${legendX + 18}" y="${legendY + 24}" font-family="Arial, sans-serif" font-size="10" fill="${themeColors.text}">${point.value} (${percentage}%)</text>`;
        
        legendY += 40;
      });
    }

    svg += `
  </g>
</svg>`;

    return svg;
  }

  /**
   * Normalize data to ChartSeries format
   */
  private normalizeToSeries(data: DataPoint[] | ChartSeries[]): ChartSeries[] {
    if (data.length === 0) {
      return [{ name: 'Series 1', data: [] }];
    }
    
    if ('data' in data[0]) {
      return data as ChartSeries[];
    }
    
    return [{ name: 'Series 1', data: data as DataPoint[] }];
  }

  /**
   * Get all unique labels from series
   */
  private getAllLabels(series: ChartSeries[]): string[] {
    const labels = new Set<string>();
    series.forEach(s => {
      s.data.forEach(d => labels.add(d.label));
    });
    return Array.from(labels);
  }

  /**
   * Convert hex color to rgba
   */
  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate chart from data source connection
   */
  async generateFromConnection(
    connectionId: number,
    labelColumn: string,
    valueColumn: string,
    config: ChartConfig
  ): Promise<ChartResult> {
    const connector = await this.loadDataConnector();
    const skill = new connector.DataConnectorSkill();
    
    try {
      const data = await skill.getCachedData(connectionId);
      
      if (!data) {
        throw new Error(`No cached data found for connection ${connectionId}. Run sync first.`);
      }
      
      // Convert rows to DataPoints
      const points: DataPoint[] = data.map((row: any) => ({
        label: String(row[labelColumn] || ''),
        value: parseFloat(row[valueColumn]) || 0
      })).filter((p: DataPoint) => p.label);

      await skill.close();
      return this.generateChart(points, config);
    } catch (error) {
      await skill.close();
      throw error;
    }
  }

  /**
   * Save chart to file
   */
  saveChart(result: ChartResult, filePath: string): void {
    fs.writeFileSync(filePath, result.content);
  }

  /**
   * Generate embeddable HTML code
   */
  generateEmbeddableCode(result: ChartResult): string {
    return `<div style="width:100%;max-width:${result.width}px;">
${result.content}
</div>`;
  }

  // ==================== Template Management ====================

  /**
   * Save a chart template
   */
  async saveTemplate(template: Omit<ChartTemplate, 'id' | 'createdAt'>): Promise<ChartTemplate> {
    await this.init();
    
    const configJson = JSON.stringify(template.config);
    const dataSourceJson = template.dataSource ? JSON.stringify(template.dataSource) : null;
    
    const result = await runWithResult(
      this.db!,
      `INSERT INTO templates (name, type, config, data_source) VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET type=excluded.type, config=excluded.config, data_source=excluded.data_source`,
      [template.name, template.type, configJson, dataSourceJson]
    );

    return {
      id: result.lastID,
      ...template,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Get a template by name
   */
  async getTemplate(name: string): Promise<ChartTemplate | null> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.get<TemplateRecord>(
        `SELECT * FROM templates WHERE name = ?`,
        [name],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          if (!row) {
            resolve(null);
            return;
          }
          resolve({
            id: row.id,
            name: row.name,
            type: row.type,
            config: JSON.parse(row.config),
            dataSource: row.data_source ? JSON.parse(row.data_source) : undefined,
            createdAt: row.created_at
          });
        }
      );
    });
  }

  /**
   * List all templates
   */
  async listTemplates(): Promise<ChartTemplate[]> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.all<TemplateRecord>(
        `SELECT * FROM templates ORDER BY created_at DESC`,
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map(row => ({
            id: row.id,
            name: row.name,
            type: row.type,
            config: JSON.parse(row.config),
            dataSource: row.data_source ? JSON.parse(row.data_source) : undefined,
            createdAt: row.created_at
          })));
        }
      );
    });
  }

  /**
   * Delete a template
   */
  async deleteTemplate(name: string): Promise<boolean> {
    await this.init();
    
    const result = await runWithResult(
      this.db!,
      `DELETE FROM templates WHERE name = ?`,
      [name]
    );
    
    return result.changes > 0;
  }

  /**
   * Generate chart from template
   */
  async generateFromTemplate(templateName: string): Promise<ChartResult> {
    const template = await this.getTemplate(templateName);
    
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    if (template.dataSource) {
      return this.generateFromConnection(
        template.dataSource.connectionId,
        template.dataSource.labelColumn,
        template.dataSource.valueColumn,
        template.config
      );
    }

    throw new Error(`Template '${templateName}' has no data source configured`);
  }

  /**
   * Log chart generation to history
   */
  async logChartGeneration(templateId: number | undefined, format: string, outputPath?: string): Promise<void> {
    await this.init();
    
    await runWithResult(
      this.db!,
      `INSERT INTO chart_history (template_id, format, output_path) VALUES (?, ?, ?)`,
      [templateId || null, format, outputPath || null]
    );
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{ templates: number; totalCharts: number }> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.get<{ templates: number; charts: number }>(
        `SELECT 
          (SELECT COUNT(*) FROM templates) as templates,
          (SELECT COUNT(*) FROM chart_history) as charts`,
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            templates: row?.templates || 0,
            totalCharts: row?.charts || 0
          });
        }
      );
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.init();
      return { healthy: true, message: 'Chart generator is operational' };
    } catch (error) {
      return { 
        healthy: false, 
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.db = null;
      this.initPromise = null;
    }
  }
}

/**
 * Create default chart generator skill instance
 */
export function getChartGeneratorSkill(): ChartGeneratorSkill {
  return new ChartGeneratorSkill();
}
