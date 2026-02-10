/**
 * Binance Skill
 * Trade and monitor crypto via Binance API
 * Built on top of binance-auth skill
 */

import { BinanceAuthClient, getBinanceAuth, BinanceEnvironment } from '@openclaw/binance-auth';
import { BinanceProviderAdapter } from '@openclaw/auth-provider';
import * as sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';

/**
 * Symbol/Trading pair information
 */
export interface SymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  baseAssetPrecision: number;
  quoteAssetPrecision: number;
  minPrice: string;
  maxPrice: string;
  tickSize: string;
  minQty: string;
  maxQty: string;
  stepSize: string;
  minNotional: string;
}

/**
 * Real-time price ticker
 */
export interface Ticker {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  count: number;
}

/**
 * Simple price ticker (24hr stats)
 */
export interface PriceTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

/**
 * Account balance for an asset
 */
export interface Balance {
  asset: string;
  free: string;
  locked: string;
  total: string;
}

/**
 * Order types
 */
export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'LIMIT_MAKER';
export type OrderSide = 'BUY' | 'SELL';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK';
export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'PENDING_CANCEL' | 'REJECTED' | 'EXPIRED';

/**
 * Order information
 */
export interface Order {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: OrderStatus;
  timeInForce: TimeInForce;
  type: OrderType;
  side: OrderSide;
  stopPrice?: string;
  icebergQty?: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
  origQuoteOrderQty: string;
}

/**
 * Create order options
 */
export interface CreateOrderOptions {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity?: string;
  quoteOrderQty?: string;
  price?: string;
  timeInForce?: TimeInForce;
  stopPrice?: string;
  icebergQty?: string;
  newClientOrderId?: string;
}

/**
 * Trade information (fills)
 */
export interface Trade {
  symbol: string;
  id: number;
  orderId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
  isBestMatch: boolean;
}

/**
 * Order fill from create order response
 */
export interface OrderFill {
  price: string;
  qty: string;
  commission: string;
  commissionAsset: string;
  tradeId: number;
}

/**
 * Create order response
 */
export interface CreateOrderResponse {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: OrderStatus;
  timeInForce: TimeInForce;
  type: OrderType;
  side: OrderSide;
  fills?: OrderFill[];
}

/**
 * Candlestick/Kline data
 */
export interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  trades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

/**
 * Exchange information
 */
export interface ExchangeInfo {
  timezone: string;
  serverTime: number;
  rateLimits: Array<{
    rateLimitType: string;
    interval: string;
    intervalNum: number;
    limit: number;
  }>;
  symbols: SymbolInfo[];
}

/**
 * Trade record stored in local database
 */
export interface LocalTradeRecord {
  id: number;
  order_id: number;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: string;
  quantity: string;
  total: string;
  status: OrderStatus;
  commission: string;
  commission_asset: string;
  created_at: string;
  updated_at: string;
  notes?: string;
}

/**
 * Binance skill configuration
 */
export interface BinanceSkillConfig {
  profile?: string;
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
 * Binance Skill - Crypto trading and monitoring
 */
export class BinanceSkill {
  private authClient: BinanceAuthClient;
  private profile: string;
  private cacheDir: string;
  private enableCache: boolean;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: BinanceSkillConfig = {}) {
    this.profile = config.profile || 'default';
    this.cacheDir = config.cacheDir || path.join(os.homedir(), '.openclaw', 'skills', 'binance');
    this.enableCache = config.enableCache !== false;
    this.authClient = getBinanceAuth(this.profile);
    
    if (this.enableCache) {
      this.initPromise = this.initCache();
    }
  }

  /**
   * Create BinanceSkill for a specific profile
   */
  static forProfile(profile: string = 'default'): BinanceSkill {
    return new BinanceSkill({ profile });
  }

  /**
   * Initialize cache directory and database
   */
  private async initCache(): Promise<void> {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true, mode: 0o700 });
      }

      const dbPath = path.join(this.cacheDir, 'trades.db');
      
      // Wait for database to be ready
      this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
        const db = new (sqlite3 as any).Database(dbPath, (err: Error | null) => {
          if (err) reject(err);
          else resolve(db);
        });
      });

      // Create trades table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS trades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          symbol TEXT NOT NULL,
          side TEXT NOT NULL,
          type TEXT NOT NULL,
          price TEXT NOT NULL,
          quantity TEXT NOT NULL,
          total TEXT NOT NULL,
          status TEXT NOT NULL,
          commission TEXT DEFAULT '0',
          commission_asset TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          notes TEXT,
          profile TEXT DEFAULT 'default'
        )
      `);

      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_trades_profile ON trades(profile)
      `);
      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)
      `);
      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_trades_order_id ON trades(order_id)
      `);
      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at)
      `);

      // Create price history table
      await run(this.db, `
        CREATE TABLE IF NOT EXISTS price_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          price TEXT NOT NULL,
          timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          profile TEXT DEFAULT 'default'
        )
      `);

      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(symbol)
      `);
      await run(this.db, `
        CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp)
      `);
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
   * Get the adapter for making API calls
   */
  private async getAdapter(): Promise<BinanceProviderAdapter> {
    const adapter = await this.authClient.getAdapter();
    if (!adapter) {
      throw new Error('Not connected to Binance. Please authenticate first.');
    }
    return adapter;
  }

  /**
   * Make a signed request to Binance API (for methods not in adapter)
   */
  private async signedRequest(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    params?: Record<string, string>
  ): Promise<any> {
    const credentials = await this.authClient.getFullCredentials();
    if (!credentials) {
      throw new Error('Not connected to Binance');
    }

    const adapter = await this.getAdapter();
    const baseUrl = adapter.getBaseUrl();
    const timestamp = Date.now();
    
    let queryString = `timestamp=${timestamp}`;
    if (params) {
      const paramString = new URLSearchParams(params).toString();
      if (paramString) {
        queryString += `&${paramString}`;
      }
    }

    // Create signature
    const crypto = await import('crypto');
    const signature = crypto
      .createHmac('sha256', credentials.api_secret)
      .update(queryString)
      .digest('hex');

    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      method,
      headers: {
        'X-MBX-APIKEY': credentials.api_key,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Binance API error: ${error}`);
    }

    return response.json();
  }

  /**
   * Check if connected to Binance
   */
  async isConnected(): Promise<boolean> {
    return this.authClient.isConnected();
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    connected: boolean;
    environment?: BinanceEnvironment;
    permissions?: string[];
  }> {
    const connected = await this.isConnected();
    if (!connected) {
      return { connected: false };
    }

    const credentials = await this.authClient.getCredentials();
    const validation = await this.authClient.validatePermissions();

    return {
      connected: true,
      environment: credentials?.environment,
      permissions: validation.permissions,
    };
  }

  /**
   * Get exchange information
   */
  async getExchangeInfo(): Promise<ExchangeInfo> {
    const adapter = await this.getAdapter();
    const baseUrl = adapter.getBaseUrl();
    
    const response = await fetch(`${baseUrl}/api/v3/exchangeInfo`);
    
    if (!response.ok) {
      throw new Error(`Failed to get exchange info: ${response.statusText}`);
    }

    const data = await response.json() as ExchangeInfo;
    return data;
  }

  /**
   * Get all trading symbols
   */
  async getSymbols(): Promise<SymbolInfo[]> {
    const info = await this.getExchangeInfo();
    return info.symbols.filter(s => s.status === 'TRADING');
  }

  /**
   * Get symbol information
   */
  async getSymbolInfo(symbol: string): Promise<SymbolInfo | null> {
    const info = await this.getExchangeInfo();
    return info.symbols.find(s => s.symbol === symbol.toUpperCase()) || null;
  }

  /**
   * Get real-time price for a symbol
   */
  async getPrice(symbol: string): Promise<string> {
    const adapter = await this.getAdapter();
    const baseUrl = adapter.getBaseUrl();
    
    const response = await fetch(`${baseUrl}/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get price: ${response.statusText}`);
    }

    const data = await response.json() as { symbol: string; price: string };
    
    // Cache the price
    if (this.enableCache && this.db) {
      await this.ensureCache();
      await run(this.db, `
        INSERT INTO price_history (symbol, price, profile)
        VALUES (?, ?, ?)
      `, [symbol.toUpperCase(), data.price, this.profile]);
    }
    
    return data.price;
  }

  /**
   * Get prices for all symbols or specific symbols
   */
  async getPrices(symbols?: string[]): Promise<Array<{ symbol: string; price: string }>> {
    const adapter = await this.getAdapter();
    const baseUrl = adapter.getBaseUrl();
    
    let url = `${baseUrl}/api/v3/ticker/price`;
    if (symbols && symbols.length > 0) {
      if (symbols.length === 1) {
        url += `?symbol=${symbols[0].toUpperCase()}`;
      } else {
        url += `?symbols=${encodeURIComponent(JSON.stringify(symbols.map(s => s.toUpperCase())))}`;
      }
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to get prices: ${response.statusText}`);
    }

    const data = await response.json() as Array<{ symbol: string; price: string }> | { symbol: string; price: string };
    return Array.isArray(data) ? data : [data];
  }

  /**
   * Get 24hr ticker statistics
   */
  async get24hrTicker(symbol?: string): Promise<PriceTicker | PriceTicker[]> {
    const adapter = await this.getAdapter();
    const baseUrl = adapter.getBaseUrl();
    
    let url = `${baseUrl}/api/v3/ticker/24hr`;
    if (symbol) {
      url += `?symbol=${symbol.toUpperCase()}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to get 24hr ticker: ${response.statusText}`);
    }

    return await response.json() as PriceTicker | PriceTicker[];
  }

  /**
   * Get account balances
   */
  async getBalances(): Promise<Balance[]> {
    const adapter = await this.getAdapter();
    const accountInfo = await adapter.getAccountInfo();
    
    if (!accountInfo) {
      throw new Error('Failed to get account information');
    }
    
    return accountInfo.balances
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => ({
        asset: b.asset,
        free: b.free,
        locked: b.locked,
        total: (parseFloat(b.free) + parseFloat(b.locked)).toFixed(8),
      }));
  }

  /**
   * Get balance for a specific asset
   */
  async getBalance(asset: string): Promise<Balance | null> {
    const balances = await this.getBalances();
    return balances.find(b => b.asset === asset.toUpperCase()) || null;
  }

  /**
   * Create a new order
   */
  async createOrder(options: CreateOrderOptions): Promise<CreateOrderResponse> {
    const adapter = await this.getAdapter();
    
    // Validate permissions
    const validation = await this.authClient.validatePermissions();
    if (!validation.canTrade) {
      throw new Error('Account does not have trading permissions');
    }

    const params: Record<string, string> = {
      symbol: options.symbol.toUpperCase(),
      side: options.side,
      type: options.type,
    };

    if (options.quantity) {
      params.quantity = options.quantity;
    }
    if (options.quoteOrderQty) {
      params.quoteOrderQty = options.quoteOrderQty;
    }
    if (options.price) {
      params.price = options.price;
    }
    if (options.timeInForce) {
      params.timeInForce = options.timeInForce;
    }
    if (options.stopPrice) {
      params.stopPrice = options.stopPrice;
    }
    if (options.icebergQty) {
      params.icebergQty = options.icebergQty;
    }
    if (options.newClientOrderId) {
      params.newClientOrderId = options.newClientOrderId;
    }

    const result = await this.signedRequest('POST', '/api/v3/order', params) as CreateOrderResponse;
    
    // Store in local database
    if (this.enableCache && this.db) {
      await this.ensureCache();
      const total = parseFloat(result.cummulativeQuoteQty) > 0 
        ? result.cummulativeQuoteQty 
        : (parseFloat(result.price) * parseFloat(result.origQty)).toString();
      
      await run(this.db, `
        INSERT INTO trades 
        (order_id, symbol, side, type, price, quantity, total, status, profile)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        result.orderId,
        result.symbol,
        result.side,
        result.type,
        result.price,
        result.origQty,
        total,
        result.status,
        this.profile,
      ]);
    }

    return result;
  }

  /**
   * Place a market buy order
   */
  async marketBuy(symbol: string, quantity: string): Promise<CreateOrderResponse> {
    return this.createOrder({
      symbol,
      side: 'BUY',
      type: 'MARKET',
      quantity,
    });
  }

  /**
   * Place a market sell order
   */
  async marketSell(symbol: string, quantity: string): Promise<CreateOrderResponse> {
    return this.createOrder({
      symbol,
      side: 'SELL',
      type: 'MARKET',
      quantity,
    });
  }

  /**
   * Place a limit buy order
   */
  async limitBuy(symbol: string, quantity: string, price: string, timeInForce: TimeInForce = 'GTC'): Promise<CreateOrderResponse> {
    return this.createOrder({
      symbol,
      side: 'BUY',
      type: 'LIMIT',
      quantity,
      price,
      timeInForce,
    });
  }

  /**
   * Place a limit sell order
   */
  async limitSell(symbol: string, quantity: string, price: string, timeInForce: TimeInForce = 'GTC'): Promise<CreateOrderResponse> {
    return this.createOrder({
      symbol,
      side: 'SELL',
      type: 'LIMIT',
      quantity,
      price,
      timeInForce,
    });
  }

  /**
   * Get order status
   */
  async getOrder(symbol: string, orderId: number): Promise<Order> {
    const order = await this.signedRequest('GET', '/api/v3/order', {
      symbol: symbol.toUpperCase(),
      orderId: orderId.toString(),
    }) as Order;

    // Update local database
    if (this.enableCache && this.db) {
      await this.ensureCache();
      await run(this.db, `
        UPDATE trades 
        SET status = ?, updated_at = datetime('now')
        WHERE order_id = ? AND profile = ?
      `, [order.status, orderId, this.profile]);
    }

    return order;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(symbol: string, orderId: number): Promise<Order> {
    const order = await this.signedRequest('DELETE', '/api/v3/order', {
      symbol: symbol.toUpperCase(),
      orderId: orderId.toString(),
    }) as Order;
    
    // Update local database
    if (this.enableCache && this.db) {
      await this.ensureCache();
      await run(this.db, `
        UPDATE trades 
        SET status = ?, updated_at = datetime('now')
        WHERE order_id = ? AND profile = ?
      `, [order.status, orderId, this.profile]);
    }

    return order;
  }

  /**
   * Get all open orders
   */
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const params: Record<string, string> = {};
    if (symbol) {
      params.symbol = symbol.toUpperCase();
    }
    
    return await this.signedRequest('GET', '/api/v3/openOrders', params) as Order[];
  }

  /**
   * Get order history (all orders)
   */
  async getOrderHistory(symbol: string, options: {
    limit?: number;
    startTime?: number;
    endTime?: number;
  } = {}): Promise<Order[]> {
    const params: Record<string, string> = {
      symbol: symbol.toUpperCase(),
    };
    
    if (options.limit) {
      params.limit = options.limit.toString();
    }
    if (options.startTime) {
      params.startTime = options.startTime.toString();
    }
    if (options.endTime) {
      params.endTime = options.endTime.toString();
    }
    
    return await this.signedRequest('GET', '/api/v3/allOrders', params) as Order[];
  }

  /**
   * Get account trade list
   */
  async getTrades(symbol: string, options: {
    limit?: number;
    startTime?: number;
    endTime?: number;
  } = {}): Promise<Trade[]> {
    const params: Record<string, string> = {
      symbol: symbol.toUpperCase(),
    };
    
    if (options.limit) {
      params.limit = options.limit.toString();
    }
    if (options.startTime) {
      params.startTime = options.startTime.toString();
    }
    if (options.endTime) {
      params.endTime = options.endTime.toString();
    }
    
    const trades = await this.signedRequest('GET', '/api/v3/myTrades', params) as Trade[];
    
    // Update local database with trade details
    if (this.enableCache && this.db) {
      await this.ensureCache();
      for (const trade of trades) {
        await run(this.db, `
          UPDATE trades 
          SET commission = ?, commission_asset = ?, updated_at = datetime('now')
          WHERE order_id = ? AND profile = ?
        `, [trade.commission, trade.commissionAsset, trade.orderId, this.profile]);
      }
    }

    return trades;
  }

  /**
   * Get local trade history from SQLite
   */
  async getLocalTradeHistory(options: {
    symbol?: string;
    limit?: number;
    status?: OrderStatus;
  } = {}): Promise<LocalTradeRecord[]> {
    if (!this.enableCache || !this.db) {
      return [];
    }
    
    await this.ensureCache();
    
    let sql = `SELECT * FROM trades WHERE profile = ?`;
    const params: any[] = [this.profile];
    
    if (options.symbol) {
      sql += ` AND symbol = ?`;
      params.push(options.symbol.toUpperCase());
    }
    if (options.status) {
      sql += ` AND status = ?`;
      params.push(options.status);
    }
    
    sql += ` ORDER BY created_at DESC`;
    
    if (options.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }
    
    return await all<LocalTradeRecord>(this.db, sql, params);
  }

  /**
   * Get klines/candlestick data
   */
  async getKlines(symbol: string, interval: string, options: {
    limit?: number;
    startTime?: number;
    endTime?: number;
  } = {}): Promise<Kline[]> {
    const adapter = await this.getAdapter();
    const baseUrl = adapter.getBaseUrl();
    
    const params = new URLSearchParams();
    params.set('symbol', symbol.toUpperCase());
    params.set('interval', interval);
    
    if (options.limit) {
      params.set('limit', options.limit.toString());
    }
    if (options.startTime) {
      params.set('startTime', options.startTime.toString());
    }
    if (options.endTime) {
      params.set('endTime', options.endTime.toString());
    }
    
    const response = await fetch(`${baseUrl}/api/v3/klines?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get klines: ${response.statusText}`);
    }

    const data = await response.json() as Array<(string | number)[]>;
    
    return data.map(k => ({
      openTime: k[0] as number,
      open: k[1] as string,
      high: k[2] as string,
      low: k[3] as string,
      close: k[4] as string,
      volume: k[5] as string,
      closeTime: k[6] as number,
      quoteAssetVolume: k[7] as string,
      trades: k[8] as number,
      takerBuyBaseAssetVolume: k[9] as string,
      takerBuyQuoteAssetVolume: k[10] as string,
    }));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message?: string;
    environment?: string;
    pingMs?: number;
  }> {
    const connected = await this.isConnected();
    
    if (!connected) {
      return { status: 'unhealthy', message: 'Not connected to Binance' };
    }

    const start = Date.now();
    
    try {
      const adapter = await this.getAdapter();
      const connectivity = await adapter.testConnectivity();
      const pingMs = Date.now() - start;
      
      if (connectivity) {
        const credentials = await this.authClient.getCredentials();
        return { 
          status: 'healthy', 
          message: 'Binance API accessible', 
          environment: credentials?.environment,
          pingMs,
        };
      } else {
        return { status: 'unhealthy', message: 'Connectivity test failed' };
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Add notes to a local trade record
   */
  async addTradeNotes(orderId: number, notes: string): Promise<void> {
    if (!this.enableCache || !this.db) {
      throw new Error('Cache is not enabled');
    }
    
    await this.ensureCache();
    await run(this.db, `
      UPDATE trades 
      SET notes = ?, updated_at = datetime('now')
      WHERE order_id = ? AND profile = ?
    `, [notes, orderId, this.profile]);
  }

  /**
   * Get environment (testnet or production)
   */
  async getEnvironment(): Promise<BinanceEnvironment | null> {
    const credentials = await this.authClient.getCredentials();
    return credentials?.environment || null;
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
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * Factory function to get BinanceSkill instance
 */
export function getBinanceSkill(profile?: string): BinanceSkill {
  return new BinanceSkill({ profile });
}

// Re-export types
export { BinanceEnvironment } from '@openclaw/binance-auth';

export default BinanceSkill;
