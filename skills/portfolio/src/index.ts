/**
 * Portfolio Skill
 * Track crypto portfolio positions with P&L and allocation
 * Built on top of binance skill
 */

import { BinanceSkill, Balance } from '@openclaw/binance';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Portfolio position for an asset
 */
export interface Position {
  asset: string;
  quantity: string;
  averageCost: string;
  currentPrice: string;
  currentValue: string;
  costBasis: string;
  unrealizedPnL: string;
  unrealizedPnLPercent: string;
  allocation: string;
}

/**
 * Position record stored in database
 */
export interface PositionRecord {
  id: number;
  asset: string;
  quantity: string;
  average_cost: string;
  total_cost: string;
  realized_pnl: string;
  created_at: string;
  updated_at: string;
  profile: string;
}

/**
 * Trade record for cost basis calculation
 */
export interface TradeRecord {
  id: number;
  asset: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  total: string;
  fee: string;
  timestamp: string;
  profile: string;
}

/**
 * Portfolio snapshot for historical tracking
 */
export interface PortfolioSnapshot {
  id: number;
  total_value: string;
  cost_basis: string;
  unrealized_pnl: string;
  realized_pnl: string;
  timestamp: string;
  profile: string;
}

/**
 * Portfolio allocation by asset
 */
export interface Allocation {
  asset: string;
  value: string;
  percentage: string;
}

/**
 * Portfolio summary
 */
export interface PortfolioSummary {
  totalValue: string;
  totalCostBasis: string;
  unrealizedPnL: string;
  unrealizedPnLPercent: string;
  realizedPnL: string;
  positionCount: number;
}

/**
 * Historical performance data point
 */
export interface PerformancePoint {
  timestamp: string;
  totalValue: string;
  costBasis: string;
  unrealizedPnL: string;
  realizedPnL: string;
}

/**
 * CSV export data
 */
export interface CsvExport {
  filename: string;
  content: string;
}

/**
 * Portfolio skill configuration
 */
export interface PortfolioSkillConfig {
  binanceProfile?: string;
  cacheDir?: string;
  enableCache?: boolean;
}

// Promisify database operations
function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

function runWithResult(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

function all<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

/**
 * Portfolio Skill - Track crypto positions with P&L
 */
export class PortfolioSkill {
  private binance: BinanceSkill;
  private profile: string;
  private cacheDir: string;
  private enableCache: boolean;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: PortfolioSkillConfig = {}) {
    this.profile = config.binanceProfile || 'default';
    this.cacheDir = config.cacheDir || path.join(os.homedir(), '.openclaw', 'skills', 'portfolio');
    this.enableCache = config.enableCache !== false;
    this.binance = new BinanceSkill({ profile: this.profile });
    
    if (this.enableCache) {
      this.initPromise = this.initCache();
    }
  }

  /**
   * Create PortfolioSkill for a specific profile
   */
  static forProfile(profile: string = 'default'): PortfolioSkill {
    return new PortfolioSkill({ binanceProfile: profile });
  }

  /**
   * Initialize cache directory and database
   */
  private async initCache(): Promise<void> {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true, mode: 0o700 });
      }

      const dbPath = path.join(this.cacheDir, 'portfolio.db');
      
      this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
        const db = new (sqlite3 as any).Database(dbPath, (err: Error | null) => {
          if (err) reject(err);
          else resolve(db);
        });
      });

      // Create positions table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS positions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          asset TEXT NOT NULL UNIQUE,
          quantity TEXT NOT NULL DEFAULT '0',
          average_cost TEXT NOT NULL DEFAULT '0',
          total_cost TEXT NOT NULL DEFAULT '0',
          realized_pnl TEXT NOT NULL DEFAULT '0',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          profile TEXT DEFAULT 'default'
        )
      `);

      // Create trades table for cost basis
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS trades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          asset TEXT NOT NULL,
          side TEXT NOT NULL,
          quantity TEXT NOT NULL,
          price TEXT NOT NULL,
          total TEXT NOT NULL,
          fee TEXT DEFAULT '0',
          timestamp TEXT DEFAULT (datetime('now')),
          profile TEXT DEFAULT 'default'
        )
      `);

      // Create portfolio snapshots table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS portfolio_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          total_value TEXT NOT NULL,
          cost_basis TEXT NOT NULL,
          unrealized_pnl TEXT NOT NULL,
          realized_pnl TEXT NOT NULL,
          timestamp TEXT DEFAULT (datetime('now')),
          profile TEXT DEFAULT 'default'
        )
      `);

      // Create indexes
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_positions_profile ON positions(profile)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_positions_asset ON positions(asset)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_trades_profile ON trades(profile)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_trades_asset ON trades(asset)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_snapshots_profile ON portfolio_snapshots(profile)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON portfolio_snapshots(timestamp)`);
    } catch (error) {
      console.error('Failed to initialize cache:', error);
      this.enableCache = false;
      this.db = null;
    }
  }

  /**
   * Ensure cache is initialized
   */
  private async ensureCache(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Record a trade and update position
   */
  async recordTrade(
    asset: string,
    side: 'BUY' | 'SELL',
    quantity: string,
    price: string,
    fee: string = '0'
  ): Promise<void> {
    await this.ensureCache();
    if (!this.db) throw new Error('Cache not initialized');

    const total = (parseFloat(quantity) * parseFloat(price)).toFixed(8);
    const assetUpper = asset.toUpperCase();

    // Record the trade
    await run(this.db, `
      INSERT INTO trades (asset, side, quantity, price, total, fee, profile)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [assetUpper, side, quantity, price, total, fee, this.profile]);

    // Update position
    const position = await get<PositionRecord>(this.db, `
      SELECT * FROM positions WHERE asset = ? AND profile = ?
    `, [assetUpper, this.profile]);

    if (side === 'BUY') {
      if (position) {
        const newQuantity = parseFloat(position.quantity) + parseFloat(quantity);
        const newTotalCost = parseFloat(position.total_cost) + parseFloat(total);
        const newAvgCost = newQuantity > 0 ? newTotalCost / newQuantity : 0;

        await run(this.db, `
          UPDATE positions 
          SET quantity = ?, average_cost = ?, total_cost = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [newQuantity.toFixed(8), newAvgCost.toFixed(8), newTotalCost.toFixed(8), position.id]);
      } else {
        await run(this.db, `
          INSERT INTO positions (asset, quantity, average_cost, total_cost, profile)
          VALUES (?, ?, ?, ?, ?)
        `, [assetUpper, quantity, price, total, this.profile]);
      }
    } else {
      // SELL
      if (position) {
        const sellQty = parseFloat(quantity);
        const currentQty = parseFloat(position.quantity);
        const avgCost = parseFloat(position.average_cost);
        const realizedPnL = (parseFloat(price) - avgCost) * sellQty;
        const currentRealizedPnL = parseFloat(position.realized_pnl || '0');

        if (sellQty >= currentQty) {
          // Selling entire position
          await run(this.db, `
            UPDATE positions 
            SET quantity = '0', average_cost = '0', total_cost = '0', 
                realized_pnl = ?, updated_at = datetime('now')
            WHERE id = ?
          `, [(currentRealizedPnL + realizedPnL).toFixed(8), position.id]);
        } else {
          // Partial sell - reduce quantity proportionally
          const newQty = currentQty - sellQty;
          const newTotalCost = newQty * avgCost;
          
          await run(this.db, `
            UPDATE positions 
            SET quantity = ?, total_cost = ?, realized_pnl = ?, updated_at = datetime('now')
            WHERE id = ?
          `, [newQty.toFixed(8), newTotalCost.toFixed(8), (currentRealizedPnL + realizedPnL).toFixed(8), position.id]);
        }
      }
    }
  }

  /**
   * Get position for an asset
   */
  async getPosition(asset: string): Promise<Position | null> {
    await this.ensureCache();
    if (!this.db) throw new Error('Cache not initialized');

    const positions = await this.getPositions();
    return positions.find(p => p.asset === asset.toUpperCase()) || null;
  }

  /**
   * Get all positions
   */
  async getPositions(): Promise<Position[]> {
    await this.ensureCache();
    if (!this.db) throw new Error('Cache not initialized');

    // Get stored positions
    const records = await all<PositionRecord>(this.db, `
      SELECT * FROM positions WHERE profile = ? AND quantity != '0'
    `, [this.profile]);

    if (records.length === 0) {
      return [];
    }

    // Get current prices
    const positions: Position[] = [];
    let totalValue = 0;

    for (const record of records) {
      try {
        // Get current price - try USDT pair first
        const symbol = `${record.asset}USDT`;
        let currentPrice = '0';
        
        try {
          currentPrice = await this.binance.getPrice(symbol);
        } catch (e) {
          // Try BTC pair as fallback
          try {
            const btcPrice = await this.binance.getPrice(`${record.asset}BTC`);
            const btcUsdPrice = await this.binance.getPrice('BTCUSDT');
            currentPrice = (parseFloat(btcPrice) * parseFloat(btcUsdPrice)).toFixed(8);
          } catch (e2) {
            // Skip if no price available
            continue;
          }
        }

        const quantity = parseFloat(record.quantity);
        const avgCost = parseFloat(record.average_cost);
        const currentPriceNum = parseFloat(currentPrice);
        const currentValue = quantity * currentPriceNum;
        const costBasis = quantity * avgCost;
        const unrealizedPnL = currentValue - costBasis;
        const unrealizedPnLPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

        positions.push({
          asset: record.asset,
          quantity: record.quantity,
          averageCost: record.average_cost,
          currentPrice,
          currentValue: currentValue.toFixed(2),
          costBasis: costBasis.toFixed(2),
          unrealizedPnL: unrealizedPnL.toFixed(2),
          unrealizedPnLPercent: unrealizedPnLPercent.toFixed(2),
          allocation: '0', // Will be calculated after we have total
        });

        totalValue += currentValue;
      } catch (error) {
        console.warn(`Failed to get price for ${record.asset}:`, error);
      }
    }

    // Calculate allocation percentages
    for (const position of positions) {
      position.allocation = totalValue > 0 
        ? ((parseFloat(position.currentValue) / totalValue) * 100).toFixed(2)
        : '0';
    }

    // Sort by value descending
    return positions.sort((a, b) => parseFloat(b.currentValue) - parseFloat(a.currentValue));
  }

  /**
   * Get portfolio summary
   */
  async getSummary(): Promise<PortfolioSummary> {
    const positions = await this.getPositions();
    
    let totalValue = 0;
    let totalCostBasis = 0;

    for (const position of positions) {
      totalValue += parseFloat(position.currentValue);
      totalCostBasis += parseFloat(position.costBasis);
    }

    const unrealizedPnL = totalValue - totalCostBasis;
    const unrealizedPnLPercent = totalCostBasis > 0 ? (unrealizedPnL / totalCostBasis) * 100 : 0;

    // Get realized PnL from positions
    let realizedPnL = 0;
    if (this.db) {
      const result = await get<{ total: string }>(this.db, `
        SELECT SUM(CAST(realized_pnl AS REAL)) as total FROM positions WHERE profile = ?
      `, [this.profile]);
      realizedPnL = parseFloat(result?.total || '0');
    }

    return {
      totalValue: totalValue.toFixed(2),
      totalCostBasis: totalCostBasis.toFixed(2),
      unrealizedPnL: unrealizedPnL.toFixed(2),
      unrealizedPnLPercent: unrealizedPnLPercent.toFixed(2),
      realizedPnL: realizedPnL.toFixed(2),
      positionCount: positions.length,
    };
  }

  /**
   * Get allocation breakdown
   */
  async getAllocation(): Promise<Allocation[]> {
    const positions = await this.getPositions();
    return positions.map(p => ({
      asset: p.asset,
      value: p.currentValue,
      percentage: p.allocation,
    }));
  }

  /**
   * Take a portfolio snapshot
   */
  async takeSnapshot(): Promise<void> {
    await this.ensureCache();
    if (!this.db) throw new Error('Cache not initialized');

    const summary = await this.getSummary();
    
    await run(this.db, `
      INSERT INTO portfolio_snapshots (total_value, cost_basis, unrealized_pnl, realized_pnl, profile)
      VALUES (?, ?, ?, ?, ?)
    `, [
      summary.totalValue,
      summary.totalCostBasis,
      summary.unrealizedPnL,
      summary.realizedPnL,
      this.profile,
    ]);
  }

  /**
   * Get historical performance
   */
  async getPerformance(days: number = 30): Promise<PerformancePoint[]> {
    await this.ensureCache();
    if (!this.db) return [];

    const records = await all<PortfolioSnapshot>(this.db, `
      SELECT * FROM portfolio_snapshots 
      WHERE profile = ? 
        AND timestamp >= datetime('now', '-${days} days')
      ORDER BY timestamp ASC
    `, [this.profile]);

    return records.map(r => ({
      timestamp: r.timestamp,
      totalValue: r.total_value,
      costBasis: r.cost_basis,
      unrealizedPnL: r.unrealized_pnl,
      realizedPnL: r.realized_pnl,
    }));
  }

  /**
   * Get trade history for an asset
   */
  async getTradeHistory(asset?: string, limit: number = 100): Promise<TradeRecord[]> {
    await this.ensureCache();
    if (!this.db) return [];

    let sql = `SELECT * FROM trades WHERE profile = ?`;
    const params: any[] = [this.profile];

    if (asset) {
      sql += ` AND asset = ?`;
      params.push(asset.toUpperCase());
    }

    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    return await all<TradeRecord>(this.db, sql, params);
  }

  /**
   * Export positions to CSV
   */
  async exportToCsv(): Promise<CsvExport> {
    const positions = await this.getPositions();
    const summary = await this.getSummary();

    const lines: string[] = [
      'Asset,Quantity,Average Cost,Current Price,Current Value,Cost Basis,Unrealized P&L,P&L %,Allocation %',
    ];

    for (const p of positions) {
      lines.push(`${p.asset},${p.quantity},${p.averageCost},${p.currentPrice},${p.currentValue},${p.costBasis},${p.unrealizedPnL},${p.unrealizedPnLPercent},${p.allocation}`);
    }

    lines.push('');
    lines.push('Summary');
    lines.push(`Total Value,${summary.totalValue}`);
    lines.push(`Total Cost Basis,${summary.totalCostBasis}`);
    lines.push(`Unrealized P&L,${summary.unrealizedPnL}`);
    lines.push(`Unrealized P&L %,${summary.unrealizedPnLPercent}`);
    lines.push(`Realized P&L,${summary.realizedPnL}`);

    const timestamp = new Date().toISOString().split('T')[0];
    return {
      filename: `portfolio-${this.profile}-${timestamp}.csv`,
      content: lines.join('\n'),
    };
  }

  /**
   * Generate simple ASCII allocation chart
   */
  async getAllocationChart(width: number = 40): Promise<string> {
    const allocation = await this.getAllocation();
    
    if (allocation.length === 0) {
      return 'No positions to display.';
    }

    const lines: string[] = ['Portfolio Allocation', ''];

    for (const item of allocation.slice(0, 10)) {
      const barLength = Math.round((parseFloat(item.percentage) / 100) * width);
      const bar = '█'.repeat(barLength);
      lines.push(`${item.asset.padEnd(8)} ${bar} ${item.percentage}% ($${parseFloat(item.value).toFixed(2)})`);
    }

    return lines.join('\n');
  }

  /**
   * Generate performance chart (ASCII sparkline)
   */
  async getPerformanceChart(days: number = 30, width: number = 40): Promise<string> {
    const performance = await this.getPerformance(days);
    
    if (performance.length < 2) {
      return 'Not enough historical data. Run take-snapshot regularly to build history.';
    }

    const values = performance.map(p => parseFloat(p.totalValue));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const sparkline = values.map(v => {
      const idx = Math.floor(((v - min) / range) * (blocks.length - 1));
      return blocks[Math.min(idx, blocks.length - 1)];
    }).join('');

    const first = performance[0];
    const last = performance[performance.length - 1];
    const change = parseFloat(last.totalValue) - parseFloat(first.totalValue);
    const changePercent = parseFloat(first.totalValue) > 0 
      ? (change / parseFloat(first.totalValue)) * 100 
      : 0;

    return [
      `${days} Day Performance`,
      '',
      sparkline,
      '',
      `Start: $${parseFloat(first.totalValue).toFixed(2)}`,
      `End: $${parseFloat(last.totalValue).toFixed(2)}`,
      `Change: $${change.toFixed(2)} (${changePercent.toFixed(2)}%)`,
    ].join('\n');
  }

  /**
   * Sync with Binance balances (import current holdings)
   */
  async syncWithBinance(): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      const balances = await this.binance.getBalances();
      
      for (const balance of balances) {
        const quantity = parseFloat(balance.total);
        if (quantity <= 0 || balance.asset === 'USDT') continue;

        try {
          // Check if position exists
          const existing = await this.getPosition(balance.asset);
          
          if (!existing) {
            // Create position with current price as cost basis
            const symbol = `${balance.asset}USDT`;
            let price = '0';
            
            try {
              price = await this.binance.getPrice(symbol);
            } catch (e) {
              errors.push(`Could not get price for ${balance.asset}`);
              continue;
            }

            // Record as a synthetic buy at current price
            await this.recordTrade(balance.asset, 'BUY', balance.total, price, '0');
            imported++;
          }
        } catch (e) {
          errors.push(`Failed to import ${balance.asset}: ${e}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to sync: ${error}`);
    }

    return { imported, errors };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    binance?: { connected: boolean; message?: string };
  }> {
    const binanceHealth = await this.binance.healthCheck();

    if (binanceHealth.status !== 'healthy') {
      return {
        status: 'unhealthy',
        message: 'Binance connection failed',
        binance: { connected: false, message: binanceHealth.message },
      };
    }

    return {
      status: 'healthy',
      message: 'Portfolio skill is ready',
      binance: { connected: true, message: binanceHealth.message },
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (e) {
        // Ignore init errors
      }
    }

    if (this.db) {
      await new Promise<void>((resolve) => {
        this.db!.close(() => resolve());
      });
      this.db = null;
    }

    await this.binance.close();
  }
}

/**
 * Factory function to get PortfolioSkill instance
 */
export function getPortfolioSkill(profile?: string): PortfolioSkill {
  return new PortfolioSkill({ binanceProfile: profile });
}

export default PortfolioSkill;
