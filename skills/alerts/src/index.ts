/**
 * Alerts Skill
 * Monitor prices and send notifications
 * Built on top of binance and slack skills
 */

import { BinanceSkill } from '@openclaw/binance';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Dynamic import for ES module compatibility
let SlackSkillModule: any = null;
async function getSlackSkillModule() {
  if (!SlackSkillModule) {
    try {
      SlackSkillModule = await import('@openclaw/slack');
    } catch (e) {
      // Slack not available
    }
  }
  return SlackSkillModule;
}

/**
 * Alert types
 */
export type AlertType = 'threshold' | 'percentage';
export type AlertCondition = 'above' | 'below' | 'both';
export type AlertStatus = 'active' | 'paused' | 'triggered';
export type NotificationChannel = 'console' | 'slack';
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

/**
 * Price threshold alert configuration
 */
export interface ThresholdAlert {
  id?: number;
  symbol: string;
  condition: 'above' | 'below';
  price: number;
  message?: string;
  channels: NotificationChannel[];
  status: AlertStatus;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
  triggerCount: number;
}

/**
 * Percentage change alert configuration
 */
export interface PercentageAlert {
  id?: number;
  symbol: string;
  percentChange: number;
  direction: 'up' | 'down' | 'both';
  timeframe: Timeframe;
  message?: string;
  channels: NotificationChannel[];
  status: AlertStatus;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
  triggerCount: number;
  lastPrice?: string;
  lastPriceAt?: string;
}

/**
 * Union type for all alert types
 */
export type Alert = ThresholdAlert | PercentageAlert;

/**
 * Triggered alert record
 */
export interface AlertHistory {
  id: number;
  alertId: number;
  alertType: AlertType;
  symbol: string;
  triggerPrice: string;
  triggerCondition: string;
  message: string;
  channels: string;
  sentAt: string;
}

/**
 * Options for adding threshold alert
 */
export interface AddThresholdAlertOptions {
  symbol: string;
  above?: number;
  below?: number;
  message?: string;
  channels?: NotificationChannel[];
}

/**
 * Options for adding percentage alert
 */
export interface AddPercentageAlertOptions {
  symbol: string;
  percentChange: number;
  direction?: 'up' | 'down' | 'both';
  timeframe?: Timeframe;
  message?: string;
  channels?: NotificationChannel[];
}

/**
 * Notification result
 */
export interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  message?: string;
}

/**
 * Alert check result
 */
export interface AlertCheckResult {
  alertId: number;
  alertType: AlertType;
  symbol: string;
  triggered: boolean;
  price: string;
  message: string;
  notifications: NotificationResult[];
}

/**
 * Alerts skill configuration
 */
export interface AlertsSkillConfig {
  binanceProfile?: string;
  slackProfile?: string;
  cacheDir?: string;
  enableSlack?: boolean;
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
 * Alerts Skill - Price monitoring and notifications
 */
export class AlertsSkill {
  private binance: BinanceSkill;
  private slack: any = null;
  private cacheDir: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;
  private enableSlack: boolean;
  private slackProfile: string;

  constructor(config: AlertsSkillConfig = {}) {
    this.binance = new BinanceSkill({ profile: config.binanceProfile || 'default' });
    this.enableSlack = config.enableSlack !== false;
    this.slackProfile = config.slackProfile || 'default';
    this.cacheDir = config.cacheDir || path.join(os.homedir(), '.openclaw', 'skills', 'alerts');
    
    this.initPromise = this.init();
  }

  /**
   * Initialize database and optional slack
   */
  private async init(): Promise<void> {
    await this.initDatabase();
    
    if (this.enableSlack) {
      try {
        const mod = await getSlackSkillModule();
        if (mod && mod.SlackSkill) {
          this.slack = new mod.SlackSkill(this.slackProfile);
        }
      } catch (e) {
        // Slack not configured, continue without it
      }
    }
  }

  /**
   * Create AlertsSkill for specific profiles
   */
  static forProfiles(binanceProfile: string = 'default', slackProfile: string = 'default'): AlertsSkill {
    return new AlertsSkill({ binanceProfile, slackProfile });
  }

  /**
   * Initialize database
   */
  private async initDatabase(): Promise<void> {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true, mode: 0o700 });
      }

      const dbPath = path.join(this.cacheDir, 'alerts.db');
      
      this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
        const db = new (sqlite3 as any).Database(dbPath, (err: Error | null) => {
          if (err) reject(err);
          else resolve(db);
        });
      });

      // Create threshold alerts table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS threshold_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          condition TEXT NOT NULL,
          price TEXT NOT NULL,
          message TEXT,
          channels TEXT DEFAULT '["console"]',
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          last_triggered_at TEXT,
          trigger_count INTEGER DEFAULT 0
        )
      `);

      // Create percentage alerts table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS percentage_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          percent_change REAL NOT NULL,
          direction TEXT DEFAULT 'both',
          timeframe TEXT DEFAULT '1h',
          message TEXT,
          channels TEXT DEFAULT '["console"]',
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          last_triggered_at TEXT,
          trigger_count INTEGER DEFAULT 0,
          last_price TEXT,
          last_price_at TEXT
        )
      `);

      // Create alert history table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS alert_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alert_id INTEGER NOT NULL,
          alert_type TEXT NOT NULL,
          symbol TEXT NOT NULL,
          trigger_price TEXT NOT NULL,
          trigger_condition TEXT NOT NULL,
          message TEXT NOT NULL,
          channels TEXT NOT NULL,
          sent_at TEXT DEFAULT (datetime('now'))
        )
      `);

      // Create indexes
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_threshold_symbol ON threshold_alerts(symbol)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_threshold_status ON threshold_alerts(status)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_percentage_symbol ON percentage_alerts(symbol)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_percentage_status ON percentage_alerts(status)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_history_alert_id ON alert_history(alert_id)`);
      await run(this.db, `CREATE INDEX IF NOT EXISTS idx_history_sent_at ON alert_history(sent_at)`);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDatabase(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Add a price threshold alert
   */
  async addThresholdAlert(options: AddThresholdAlertOptions): Promise<ThresholdAlert> {
    await this.ensureDatabase();
    
    if (!options.above && !options.below) {
      throw new Error('Must specify either above or below price');
    }
    if (options.above && options.below) {
      throw new Error('Cannot specify both above and below');
    }

    const condition = options.above ? 'above' : 'below';
    const price = options.above || options.below || 0;
    const channels = JSON.stringify(options.channels || ['console']);
    const message = options.message || `${options.symbol} price is ${condition} ${price}`;

    const result = await runWithResult(this.db!, `
      INSERT INTO threshold_alerts (symbol, condition, price, message, channels)
      VALUES (?, ?, ?, ?, ?)
    `, [options.symbol.toUpperCase(), condition, price.toString(), message, channels]);

    return {
      id: result.lastID,
      symbol: options.symbol.toUpperCase(),
      condition: condition as 'above' | 'below',
      price,
      message,
      channels: options.channels || ['console'],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggerCount: 0,
    };
  }

  /**
   * Add a percentage change alert
   */
  async addPercentageAlert(options: AddPercentageAlertOptions): Promise<PercentageAlert> {
    await this.ensureDatabase();

    const direction = options.direction || 'both';
    const timeframe = options.timeframe || '1h';
    const channels = JSON.stringify(options.channels || ['console']);
    const message = options.message || 
      `${options.symbol} has ${direction === 'both' ? 'moved' : direction} ${options.percentChange}% in the last ${timeframe}`;

    const result = await runWithResult(this.db!, `
      INSERT INTO percentage_alerts (symbol, percent_change, direction, timeframe, message, channels)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      options.symbol.toUpperCase(),
      options.percentChange,
      direction,
      timeframe,
      message,
      channels,
    ]);

    return {
      id: result.lastID,
      symbol: options.symbol.toUpperCase(),
      percentChange: options.percentChange,
      direction: direction as 'up' | 'down' | 'both',
      timeframe: timeframe as Timeframe,
      message,
      channels: options.channels || ['console'],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggerCount: 0,
    };
  }

  /**
   * Get all threshold alerts
   */
  async getThresholdAlerts(status?: AlertStatus): Promise<ThresholdAlert[]> {
    await this.ensureDatabase();

    let sql = `SELECT * FROM threshold_alerts`;
    const params: any[] = [];

    if (status) {
      sql += ` WHERE status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC`;

    const rows = await all<{
      id: number;
      symbol: string;
      condition: string;
      price: string;
      message: string;
      channels: string;
      status: string;
      created_at: string;
      updated_at: string;
      last_triggered_at: string | null;
      trigger_count: number;
    }>(this.db!, sql, params);

    return rows.map(row => ({
      id: row.id,
      symbol: row.symbol,
      condition: row.condition as 'above' | 'below',
      price: parseFloat(row.price),
      message: row.message,
      channels: JSON.parse(row.channels),
      status: row.status as AlertStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastTriggeredAt: row.last_triggered_at || undefined,
      triggerCount: row.trigger_count,
    }));
  }

  /**
   * Get all percentage alerts
   */
  async getPercentageAlerts(status?: AlertStatus): Promise<PercentageAlert[]> {
    await this.ensureDatabase();

    let sql = `SELECT * FROM percentage_alerts`;
    const params: any[] = [];

    if (status) {
      sql += ` WHERE status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC`;

    const rows = await all<{
      id: number;
      symbol: string;
      percent_change: number;
      direction: string;
      timeframe: string;
      message: string;
      channels: string;
      status: string;
      created_at: string;
      updated_at: string;
      last_triggered_at: string | null;
      trigger_count: number;
      last_price: string | null;
      last_price_at: string | null;
    }>(this.db!, sql, params);

    return rows.map(row => ({
      id: row.id,
      symbol: row.symbol,
      percentChange: row.percent_change,
      direction: row.direction as 'up' | 'down' | 'both',
      timeframe: row.timeframe as Timeframe,
      message: row.message,
      channels: JSON.parse(row.channels),
      status: row.status as AlertStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastTriggeredAt: row.last_triggered_at || undefined,
      triggerCount: row.trigger_count,
      lastPrice: row.last_price || undefined,
      lastPriceAt: row.last_price_at || undefined,
    }));
  }

  /**
   * Get all alerts
   */
  async getAllAlerts(): Promise<{ threshold: ThresholdAlert[]; percentage: PercentageAlert[] }> {
    const [threshold, percentage] = await Promise.all([
      this.getThresholdAlerts(),
      this.getPercentageAlerts(),
    ]);

    return { threshold, percentage };
  }

  /**
   * Update alert status
   */
  async updateAlertStatus(
    alertType: AlertType,
    alertId: number,
    status: AlertStatus
  ): Promise<void> {
    await this.ensureDatabase();

    const table = alertType === 'threshold' ? 'threshold_alerts' : 'percentage_alerts';
    await run(this.db!, `
      UPDATE ${table} SET status = ?, updated_at = datetime('now') WHERE id = ?
    `, [status, alertId]);
  }

  /**
   * Enable an alert
   */
  async enableAlert(alertType: AlertType, alertId: number): Promise<void> {
    await this.updateAlertStatus(alertType, alertId, 'active');
  }

  /**
   * Disable (pause) an alert
   */
  async disableAlert(alertType: AlertType, alertId: number): Promise<void> {
    await this.updateAlertStatus(alertType, alertId, 'paused');
  }

  /**
   * Delete an alert
   */
  async deleteAlert(alertType: AlertType, alertId: number): Promise<void> {
    await this.ensureDatabase();

    const table = alertType === 'threshold' ? 'threshold_alerts' : 'percentage_alerts';
    await run(this.db!, `DELETE FROM ${table} WHERE id = ?`, [alertId]);
  }

  /**
   * Record triggered alert in history
   */
  private async recordAlert(
    alertId: number,
    alertType: AlertType,
    symbol: string,
    triggerPrice: string,
    triggerCondition: string,
    message: string,
    channels: NotificationChannel[]
  ): Promise<void> {
    await run(this.db!, `
      INSERT INTO alert_history 
      (alert_id, alert_type, symbol, trigger_price, trigger_condition, message, channels)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      alertId,
      alertType,
      symbol,
      triggerPrice,
      triggerCondition,
      message,
      JSON.stringify(channels),
    ]);

    // Update trigger count and last triggered
    const table = alertType === 'threshold' ? 'threshold_alerts' : 'percentage_alerts';
    await run(this.db!, `
      UPDATE ${table} 
      SET trigger_count = trigger_count + 1, 
          last_triggered_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `, [alertId]);
  }

  /**
   * Send notification to channels
   */
  private async sendNotification(
    message: string,
    channels: NotificationChannel[]
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const channel of channels) {
      try {
        if (channel === 'console') {
          console.log(`[ALERT] ${message}`);
          results.push({ channel, success: true });
        } else if (channel === 'slack' && this.slack) {
          const connected = await this.slack.isConnected();
          if (connected) {
            await this.slack.sendMessage({
              channel: '#alerts',
              text: message,
            });
            results.push({ channel, success: true });
          } else {
            results.push({ channel, success: false, message: 'Slack not connected' });
          }
        } else if (channel === 'slack' && !this.slack) {
          results.push({ channel, success: false, message: 'Slack not configured' });
        }
      } catch (error) {
        results.push({ 
          channel, 
          success: false, 
          message: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    return results;
  }

  /**
   * Check threshold alerts
   */
  private async checkThresholdAlerts(): Promise<AlertCheckResult[]> {
    const alerts = await this.getThresholdAlerts('active');
    const results: AlertCheckResult[] = [];

    for (const alert of alerts) {
      try {
        const price = await this.binance.getPrice(alert.symbol);
        const priceNum = parseFloat(price);
        let triggered = false;
        let triggerCondition = '';

        if (alert.condition === 'above' && priceNum > alert.price) {
          triggered = true;
          triggerCondition = `above ${alert.price}`;
        } else if (alert.condition === 'below' && priceNum < alert.price) {
          triggered = true;
          triggerCondition = `below ${alert.price}`;
        }

        if (triggered) {
          const message = alert.message || 
            `${alert.symbol} is ${triggerCondition} (current: ${price})`;
          
          const notifications = await this.sendNotification(message, alert.channels);
          
          await this.recordAlert(
            alert.id!,
            'threshold',
            alert.symbol,
            price,
            triggerCondition,
            message,
            alert.channels
          );

          results.push({
            alertId: alert.id!,
            alertType: 'threshold',
            symbol: alert.symbol,
            triggered: true,
            price,
            message,
            notifications,
          });
        } else {
          results.push({
            alertId: alert.id!,
            alertType: 'threshold',
            symbol: alert.symbol,
            triggered: false,
            price,
            message: '',
            notifications: [],
          });
        }
      } catch (error) {
        results.push({
          alertId: alert.id!,
          alertType: 'threshold',
          symbol: alert.symbol,
          triggered: false,
          price: '0',
          message: error instanceof Error ? error.message : String(error),
          notifications: [{ channel: 'console', success: false, message: String(error) }],
        });
      }
    }

    return results;
  }

  /**
   * Get kline interval for timeframe
   */
  private getIntervalForTimeframe(timeframe: Timeframe): string {
    const mapping: Record<Timeframe, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
    };
    return mapping[timeframe];
  }

  /**
   * Check percentage change alerts
   */
  private async checkPercentageAlerts(): Promise<AlertCheckResult[]> {
    const alerts = await this.getPercentageAlerts('active');
    const results: AlertCheckResult[] = [];

    for (const alert of alerts) {
      try {
        const currentPrice = await this.binance.getPrice(alert.symbol);
        const currentPriceNum = parseFloat(currentPrice);

        // If no last price recorded, store current and skip
        if (!alert.lastPrice) {
          await run(this.db!, `
            UPDATE percentage_alerts 
            SET last_price = ?, last_price_at = datetime('now')
            WHERE id = ?
          `, [currentPrice, alert.id!]);
          
          results.push({
            alertId: alert.id!,
            alertType: 'percentage',
            symbol: alert.symbol,
            triggered: false,
            price: currentPrice,
            message: 'Initial price recorded',
            notifications: [],
          });
          continue;
        }

        const lastPriceNum = parseFloat(alert.lastPrice);
        const percentChange = ((currentPriceNum - lastPriceNum) / lastPriceNum) * 100;
        const absPercentChange = Math.abs(percentChange);

        let triggered = false;
        let triggerCondition = '';

        if (absPercentChange >= alert.percentChange) {
          const direction = percentChange > 0 ? 'up' : 'down';
          
          if (alert.direction === 'both' || alert.direction === direction) {
            triggered = true;
            triggerCondition = `${direction} ${absPercentChange.toFixed(2)}%`;
          }
        }

        if (triggered) {
          const message = alert.message || 
            `${alert.symbol} has moved ${triggerCondition} (from ${alert.lastPrice} to ${currentPrice})`;
          
          const notifications = await this.sendNotification(message, alert.channels);
          
          await this.recordAlert(
            alert.id!,
            'percentage',
            alert.symbol,
            currentPrice,
            triggerCondition,
            message,
            alert.channels
          );

          // Update last price
          await run(this.db!, `
            UPDATE percentage_alerts 
            SET last_price = ?, last_price_at = datetime('now')
            WHERE id = ?
          `, [currentPrice, alert.id!]);

          results.push({
            alertId: alert.id!,
            alertType: 'percentage',
            symbol: alert.symbol,
            triggered: true,
            price: currentPrice,
            message,
            notifications,
          });
        } else {
          results.push({
            alertId: alert.id!,
            alertType: 'percentage',
            symbol: alert.symbol,
            triggered: false,
            price: currentPrice,
            message: '',
            notifications: [],
          });
        }
      } catch (error) {
        results.push({
          alertId: alert.id!,
          alertType: 'percentage',
          symbol: alert.symbol,
          triggered: false,
          price: '0',
          message: error instanceof Error ? error.message : String(error),
          notifications: [{ channel: 'console', success: false, message: String(error) }],
        });
      }
    }

    return results;
  }

  /**
   * Check all alerts
   */
  async checkAlerts(): Promise<{ threshold: AlertCheckResult[]; percentage: AlertCheckResult[] }> {
    await this.ensureDatabase();

    const [threshold, percentage] = await Promise.all([
      this.checkThresholdAlerts(),
      this.checkPercentageAlerts(),
    ]);

    return { threshold, percentage };
  }

  /**
   * Get alert history
   */
  async getAlertHistory(options: { limit?: number; alertId?: number; symbol?: string } = {}): Promise<AlertHistory[]> {
    await this.ensureDatabase();

    let sql = `SELECT * FROM alert_history WHERE 1=1`;
    const params: any[] = [];

    if (options.alertId) {
      sql += ` AND alert_id = ?`;
      params.push(options.alertId);
    }

    if (options.symbol) {
      sql += ` AND symbol = ?`;
      params.push(options.symbol.toUpperCase());
    }

    sql += ` ORDER BY sent_at DESC`;

    if (options.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    const rows = await all<{
      id: number;
      alert_id: number;
      alert_type: string;
      symbol: string;
      trigger_price: string;
      trigger_condition: string;
      message: string;
      channels: string;
      sent_at: string;
    }>(this.db!, sql, params);

    return rows.map(row => ({
      id: row.id,
      alertId: row.alert_id,
      alertType: row.alert_type as AlertType,
      symbol: row.symbol,
      triggerPrice: row.trigger_price,
      triggerCondition: row.trigger_condition,
      message: row.message,
      channels: row.channels,
      sentAt: row.sent_at,
    }));
  }

  /**
   * Get stats
   */
  async getStats(): Promise<{
    totalAlerts: number;
    activeAlerts: number;
    thresholdAlerts: number;
    percentageAlerts: number;
    totalTriggers: number;
  }> {
    await this.ensureDatabase();

    const thresholdStats = await get<{ count: number; active: number; triggers: number }>(this.db!, `
      SELECT 
        COUNT(*) as count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(trigger_count) as triggers
      FROM threshold_alerts
    `);

    const percentageStats = await get<{ count: number; active: number; triggers: number }>(this.db!, `
      SELECT 
        COUNT(*) as count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(trigger_count) as triggers
      FROM percentage_alerts
    `);

    return {
      totalAlerts: (thresholdStats?.count || 0) + (percentageStats?.count || 0),
      activeAlerts: (thresholdStats?.active || 0) + (percentageStats?.active || 0),
      thresholdAlerts: thresholdStats?.count || 0,
      percentageAlerts: percentageStats?.count || 0,
      totalTriggers: (thresholdStats?.triggers || 0) + (percentageStats?.triggers || 0),
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    binance?: { connected: boolean; message?: string };
    slack?: { connected: boolean; message?: string };
  }> {
    const binanceHealth = await this.binance.healthCheck();
    
    let slackHealth: { connected: boolean; message?: string } | undefined;
    if (this.slack) {
      const slackCheck = await this.slack.healthCheck();
      slackHealth = {
        connected: slackCheck.status === 'healthy',
        message: slackCheck.message,
      };
    }

    if (binanceHealth.status !== 'healthy') {
      return {
        status: 'unhealthy',
        message: 'Binance connection failed',
        binance: { connected: false, message: binanceHealth.message },
        slack: slackHealth,
      };
    }

    return {
      status: 'healthy',
      message: 'Alerts skill is ready',
      binance: { connected: true, message: binanceHealth.message },
      slack: slackHealth,
    };
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (e) {
        // Ignore init errors during close
      }
    }

    if (this.db) {
      await new Promise<void>((resolve) => {
        this.db!.close(() => resolve());
      });
      this.db = null;
    }

    await this.binance.close();
    
    if (this.slack && typeof this.slack.close === 'function') {
      await this.slack.close();
    }
  }
}

export default AlertsSkill;
