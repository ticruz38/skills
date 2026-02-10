/**
 * Client Tracker Skill
 * Track client payment behavior and history
 */

import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { InvoicesSkill, Invoice, Client, InvoiceStatus } from '@openclaw/invoices';

/**
 * Extended client profile with payment statistics
 */
export interface ClientProfile extends Client {
  totalInvoices: number;
  totalRevenue: number;
  totalPaid: number;
  totalOutstanding: number;
  averagePaymentDays: number;
  onTimePaymentRate: number;
  lastInvoiceDate?: string;
  lastPaymentDate?: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Payment history entry
 */
export interface PaymentHistoryEntry {
  id?: number;
  clientId: number;
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  paidDate: string;
  dueDate: string;
  daysLate: number;
}

/**
 * Payment history database record
 */
interface PaymentHistoryRecord {
  id?: number;
  client_id: number;
  invoice_id: number;
  invoice_number: string;
  amount: number;
  paid_date: string;
  due_date: string;
  days_late: number;
}

/**
 * Communication log entry
 */
export interface CommunicationLog {
  id?: number;
  clientId: number;
  type: 'email' | 'call' | 'meeting' | 'note' | 'reminder_sent';
  content: string;
  createdAt: string;
}

/**
 * Communication log database record
 */
interface CommunicationLogRecord {
  id?: number;
  client_id: number;
  type: string;
  content: string;
  created_at: string;
}

/**
 * Risk score calculation result
 */
export interface RiskScore {
  clientId: number;
  score: number; // 0-100, higher is better (lower risk)
  level: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
  recommendation: string;
}

/**
 * Risk factor affecting the score
 */
export interface RiskFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

/**
 * Outstanding balance entry
 */
export interface OutstandingBalance {
  clientId: number;
  clientName: string;
  email?: string;
  totalOutstanding: number;
  overdueAmount: number;
  invoiceCount: number;
  oldestInvoiceDate?: string;
  daysSinceLastPayment?: number;
}

/**
 * Client statistics
 */
export interface ClientStatistics {
  totalClients: number;
  totalRevenue: number;
  totalOutstanding: number;
  totalOverdue: number;
  averagePaymentDays: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
}

/**
 * Client tracker skill configuration
 */
export interface ClientTrackerConfig {
  dataDir?: string;
  invoicesSkill?: InvoicesSkill;
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
 * Client Tracker Skill - Track client payment behavior and history
 */
export class ClientTrackerSkill {
  private dataDir: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;
  private invoicesSkill: InvoicesSkill;

  constructor(config: ClientTrackerConfig = {}) {
    this.dataDir = config.dataDir || path.join(os.homedir(), '.openclaw', 'skills', 'client-tracker');
    this.invoicesSkill = config.invoicesSkill || new InvoicesSkill();
    this.initPromise = this.initDatabase();
  }

  /**
   * Initialize database and directories
   */
  private async initDatabase(): Promise<void> {
    // Create directories
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
    }

    const dbPath = path.join(this.dataDir, 'client-tracker.db');
    
    this.db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const db = new (sqlite3 as any).Database(dbPath, (err: Error | null) => {
        if (err) reject(err);
        else resolve(db);
      });
    });

    // Create tables
    await this.createTables();
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Payment history table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS payment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        invoice_id INTEGER NOT NULL UNIQUE,
        invoice_number TEXT NOT NULL,
        amount REAL NOT NULL,
        paid_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        days_late INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Communication log table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS communication_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create indexes
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_payment_client ON payment_history(client_id)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_payment_invoice ON payment_history(invoice_id)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_payment_date ON payment_history(paid_date)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_comm_client ON communication_log(client_id)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_comm_date ON communication_log(created_at)`);
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
   * Sync payment history from invoices
   */
  async syncPaymentHistory(): Promise<number> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    // Get all paid invoices
    const invoices = await this.invoicesSkill.listInvoices({ status: 'paid' });
    let syncedCount = 0;

    for (const invoice of invoices) {
      if (!invoice.clientId || !invoice.payments || invoice.payments.length === 0) continue;

      // Get the last payment date
      const lastPayment = invoice.payments[0]; // Already sorted by date DESC
      const paidDate = new Date(lastPayment.date);
      const dueDate = new Date(invoice.dueDate);
      
      // Calculate days late
      const diffTime = paidDate.getTime() - dueDate.getTime();
      const daysLate = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      // Insert or replace payment history
      await run(this.db, `
        INSERT OR REPLACE INTO payment_history 
        (client_id, invoice_id, invoice_number, amount, paid_date, due_date, days_late)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        invoice.clientId,
        invoice.id,
        invoice.invoiceNumber,
        invoice.amountPaid,
        lastPayment.date,
        invoice.dueDate,
        daysLate,
      ]);

      syncedCount++;
    }

    return syncedCount;
  }

  /**
   * Get all clients with extended profiles
   */
  async getAllClientProfiles(): Promise<ClientProfile[]> {
    await this.ensureDatabase();

    const clients = await this.invoicesSkill.listClients();
    const profiles: ClientProfile[] = [];

    for (const client of clients) {
      if (client.id) {
        const profile = await this.getClientProfile(client.id);
        if (profile) profiles.push(profile);
      }
    }

    return profiles;
  }

  /**
   * Get detailed client profile with payment statistics
   */
  async getClientProfile(clientId: number): Promise<ClientProfile | null> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    // Get base client info
    const client = await this.invoicesSkill.getClient(clientId);
    if (!client) return null;

    // Get all invoices for this client
    const invoices = await this.invoicesSkill.listInvoices({ clientId });
    const paidInvoices = invoices.filter(i => i.status === 'paid');
    const outstandingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    const overdueInvoices = invoices.filter(i => i.status === 'overdue');

    // Calculate totals
    const totalRevenue = invoices.reduce((sum, i) => sum + i.total, 0);
    const totalPaid = paidInvoices.reduce((sum, i) => sum + i.amountPaid, 0);
    const totalOutstanding = outstandingInvoices.reduce((sum, i) => sum + i.balanceDue, 0);

    // Calculate average payment days
    await this.syncPaymentHistory();
    const paymentHistory = await this.getPaymentHistory(clientId);
    const averagePaymentDays = paymentHistory.length > 0
      ? paymentHistory.reduce((sum, p) => sum + p.daysLate, 0) / paymentHistory.length
      : 0;

    // Calculate on-time payment rate
    const onTimePayments = paymentHistory.filter(p => p.daysLate === 0).length;
    const onTimePaymentRate = paymentHistory.length > 0
      ? (onTimePayments / paymentHistory.length) * 100
      : 100;

    // Get last invoice and payment dates
    const lastInvoice = invoices.sort((a, b) => 
      new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
    )[0];
    
    const lastPayment = paymentHistory.sort((a, b) => 
      new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime()
    )[0];

    // Calculate risk score
    const risk = await this.calculateRiskScore(clientId, {
      averagePaymentDays,
      onTimePaymentRate,
      totalOutstanding,
      totalOverdue: overdueInvoices.reduce((sum, i) => sum + i.balanceDue, 0),
      invoiceCount: invoices.length,
    });

    return {
      ...client,
      totalInvoices: invoices.length,
      totalRevenue,
      totalPaid,
      totalOutstanding,
      averagePaymentDays: Math.round(averagePaymentDays * 10) / 10,
      onTimePaymentRate: Math.round(onTimePaymentRate * 10) / 10,
      lastInvoiceDate: lastInvoice?.createdAt,
      lastPaymentDate: lastPayment?.paidDate,
      riskScore: risk.score,
      riskLevel: risk.level,
    };
  }

  /**
   * Get payment history for a client
   */
  async getPaymentHistory(clientId: number): Promise<PaymentHistoryEntry[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<PaymentHistoryRecord>(this.db,
      'SELECT * FROM payment_history WHERE client_id = ? ORDER BY paid_date DESC',
      [clientId]
    );

    return records.map(r => ({
      id: r.id,
      clientId: r.client_id,
      invoiceId: r.invoice_id,
      invoiceNumber: r.invoice_number,
      amount: r.amount,
      paidDate: r.paid_date,
      dueDate: r.due_date,
      daysLate: r.days_late,
    }));
  }

  /**
   * Calculate risk score for a client
   */
  private async calculateRiskScore(
    clientId: number,
    stats: {
      averagePaymentDays: number;
      onTimePaymentRate: number;
      totalOutstanding: number;
      totalOverdue: number;
      invoiceCount: number;
    }
  ): Promise<RiskScore> {
    const factors: RiskFactor[] = [];
    let score = 100;

    // Factor 1: On-time payment rate (weight: 40%)
    if (stats.invoiceCount > 0) {
      const onTimeImpact = stats.onTimePaymentRate >= 90 ? 'positive' : 
                          stats.onTimePaymentRate >= 70 ? 'neutral' : 'negative';
      factors.push({
        name: 'On-time Payment Rate',
        impact: onTimeImpact,
        weight: 40,
        description: `${stats.onTimePaymentRate.toFixed(1)}% of payments were on time`,
      });
      score -= (100 - stats.onTimePaymentRate) * 0.4;
    }

    // Factor 2: Average payment days (weight: 30%)
    if (stats.averagePaymentDays > 0) {
      const daysImpact = stats.averagePaymentDays <= 5 ? 'positive' : 
                         stats.averagePaymentDays <= 15 ? 'neutral' : 'negative';
      factors.push({
        name: 'Average Payment Days',
        impact: daysImpact,
        weight: 30,
        description: `Average ${stats.averagePaymentDays.toFixed(1)} days to pay`,
      });
      score -= Math.min(stats.averagePaymentDays * 2, 30);
    }

    // Factor 3: Outstanding vs overdue ratio (weight: 20%)
    if (stats.totalOutstanding > 0) {
      const overdueRatio = stats.totalOverdue / stats.totalOutstanding;
      const overdueImpact = overdueRatio === 0 ? 'positive' : 
                            overdueRatio <= 0.3 ? 'neutral' : 'negative';
      factors.push({
        name: 'Overdue Ratio',
        impact: overdueImpact,
        weight: 20,
        description: `${(overdueRatio * 100).toFixed(1)}% of outstanding amount is overdue`,
      });
      score -= overdueRatio * 20;
    }

    // Factor 4: Payment history length (weight: 10%)
    if (stats.invoiceCount === 0) {
      factors.push({
        name: 'Payment History',
        impact: 'neutral',
        weight: 10,
        description: 'No payment history available',
      });
      score -= 5;
    } else if (stats.invoiceCount >= 5) {
      factors.push({
        name: 'Payment History',
        impact: 'positive',
        weight: 10,
        description: `Established client with ${stats.invoiceCount} invoices`,
      });
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    // Determine risk level
    let level: 'low' | 'medium' | 'high';
    let recommendation: string;

    if (score >= 80) {
      level = 'low';
      recommendation = 'Reliable client. Standard terms acceptable.';
    } else if (score >= 60) {
      level = 'medium';
      recommendation = 'Some payment delays observed. Consider requiring deposits.';
    } else {
      level = 'high';
      recommendation = 'High risk client. Require upfront payment or strict terms.';
    }

    return {
      clientId,
      score,
      level,
      factors,
      recommendation,
    };
  }

  /**
   * Get risk score for a client
   */
  async getRiskScore(clientId: number): Promise<RiskScore | null> {
    const profile = await this.getClientProfile(clientId);
    if (!profile) return null;

    return this.calculateRiskScore(clientId, {
      averagePaymentDays: profile.averagePaymentDays,
      onTimePaymentRate: profile.onTimePaymentRate,
      totalOutstanding: profile.totalOutstanding,
      totalOverdue: 0, // Will be calculated within
      invoiceCount: profile.totalInvoices,
    });
  }

  /**
   * Get all outstanding balances
   */
  async getOutstandingBalances(): Promise<OutstandingBalance[]> {
    await this.ensureDatabase();

    const clients = await this.invoicesSkill.listClients();
    const balances: OutstandingBalance[] = [];
    const today = new Date();

    for (const client of clients) {
      if (!client.id) continue;

      const invoices = await this.invoicesSkill.listInvoices({ clientId: client.id });
      const outstandingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
      const overdueInvoices = invoices.filter(i => i.status === 'overdue');
      const paidInvoices = invoices.filter(i => i.status === 'paid');

      if (outstandingInvoices.length === 0 && paidInvoices.length === 0) continue;

      const totalOutstanding = outstandingInvoices.reduce((sum, i) => sum + i.balanceDue, 0);
      const overdueAmount = overdueInvoices.reduce((sum, i) => sum + i.balanceDue, 0);

      // Find oldest invoice
      const sortedOutstanding = outstandingInvoices.sort((a, b) => 
        new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime()
      );
      const oldestInvoiceDate = sortedOutstanding[0]?.issueDate;

      // Calculate days since last payment
      const sortedPaid = paidInvoices.sort((a, b) => {
        const dateA = a.payments && a.payments[0] ? new Date(a.payments[0].date) : new Date(0);
        const dateB = b.payments && b.payments[0] ? new Date(b.payments[0].date) : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      
      let daysSinceLastPayment: number | undefined;
      if (sortedPaid.length > 0 && sortedPaid[0].payments && sortedPaid[0].payments[0]) {
        const lastPaymentDate = new Date(sortedPaid[0].payments[0].date);
        daysSinceLastPayment = Math.floor((today.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      balances.push({
        clientId: client.id,
        clientName: client.name,
        email: client.email,
        totalOutstanding,
        overdueAmount,
        invoiceCount: outstandingInvoices.length,
        oldestInvoiceDate,
        daysSinceLastPayment,
      });
    }

    // Sort by total outstanding (highest first)
    return balances.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }

  /**
   * Add communication log entry
   */
  async addCommunication(
    clientId: number, 
    entry: { type: CommunicationLog['type']; content: string }
  ): Promise<CommunicationLog> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, `
      INSERT INTO communication_log (client_id, type, content)
      VALUES (?, ?, ?)
    `, [clientId, entry.type, entry.content]);

    const log = await get<CommunicationLogRecord>(this.db,
      'SELECT * FROM communication_log WHERE id = ?',
      [result.lastID]
    );

    if (!log) throw new Error('Failed to create communication log');

    return {
      id: log.id,
      clientId: log.client_id,
      type: log.type as CommunicationLog['type'],
      content: log.content,
      createdAt: log.created_at,
    };
  }

  /**
   * Get communication history for a client
   */
  async getCommunications(clientId: number, limit: number = 50): Promise<CommunicationLog[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<CommunicationLogRecord>(this.db,
      'SELECT * FROM communication_log WHERE client_id = ? ORDER BY created_at DESC LIMIT ?',
      [clientId, limit]
    );

    return records.map(r => ({
      id: r.id,
      clientId: r.client_id,
      type: r.type as CommunicationLog['type'],
      content: r.content,
      createdAt: r.created_at,
    }));
  }

  /**
   * Get overall statistics
   */
  async getStatistics(): Promise<ClientStatistics> {
    await this.ensureDatabase();

    const profiles = await this.getAllClientProfiles();
    
    const totalRevenue = profiles.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalOutstanding = profiles.reduce((sum, p) => sum + p.totalOutstanding, 0);
    
    // Calculate total overdue
    let totalOverdue = 0;
    for (const profile of profiles) {
      const invoices = await this.invoicesSkill.listInvoices({ clientId: profile.id! });
      const overdue = invoices.filter(i => i.status === 'overdue');
      totalOverdue += overdue.reduce((sum, i) => sum + i.balanceDue, 0);
    }

    const avgPaymentDays = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.averagePaymentDays, 0) / profiles.length
      : 0;

    const riskDistribution = {
      low: profiles.filter(p => p.riskLevel === 'low').length,
      medium: profiles.filter(p => p.riskLevel === 'medium').length,
      high: profiles.filter(p => p.riskLevel === 'high').length,
    };

    return {
      totalClients: profiles.length,
      totalRevenue,
      totalOutstanding,
      totalOverdue,
      averagePaymentDays: Math.round(avgPaymentDays * 10) / 10,
      riskDistribution,
    };
  }

  /**
   * Export client data to CSV
   */
  async exportToCSV(filePath: string): Promise<void> {
    await this.ensureDatabase();

    const profiles = await this.getAllClientProfiles();
    
    const headers = [
      'Client ID',
      'Name',
      'Email',
      'Phone',
      'Total Invoices',
      'Total Revenue',
      'Total Paid',
      'Total Outstanding',
      'Avg Payment Days',
      'On-time Rate %',
      'Risk Score',
      'Risk Level',
    ];

    const rows = profiles.map(p => [
      p.id,
      p.name,
      p.email || '',
      p.phone || '',
      p.totalInvoices,
      p.totalRevenue.toFixed(2),
      p.totalPaid.toFixed(2),
      p.totalOutstanding.toFixed(2),
      p.averagePaymentDays,
      p.onTimePaymentRate,
      p.riskScore,
      p.riskLevel,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(field => 
      `"${String(field).replace(/"/g, '""')}"`
    ).join(','))].join('\n');

    fs.writeFileSync(filePath, csv, 'utf-8');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    invoicesStatus?: { status: 'healthy' | 'unhealthy'; message: string };
  }> {
    try {
      await this.ensureDatabase();
      if (!this.db) {
        return { status: 'unhealthy', message: 'Database not initialized' };
      }

      // Test database
      await get(this.db, 'SELECT 1');

      // Check invoices skill
      const invoicesHealth = await this.invoicesSkill.healthCheck();

      return {
        status: 'healthy',
        message: 'Client tracker skill is ready',
        invoicesStatus: invoicesHealth,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
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

    // Close invoices skill
    await this.invoicesSkill.close();
  }
}

/**
 * Factory function
 */
export function getClientTrackerSkill(config?: ClientTrackerConfig): ClientTrackerSkill {
  return new ClientTrackerSkill(config);
}

export default ClientTrackerSkill;
