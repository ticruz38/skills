/**
 * Monthly Reports Skill
 * Generate monthly expense summaries with spending breakdown, trend analysis, and budget comparison
 * Built on top of expense-categorizer for categorized receipt data
 */

import { ExpenseCategorizerSkill, CategoryStats } from '@openclaw/expense-categorizer';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Monthly report data
 */
export interface MonthlyReport {
  id?: number;
  year: number;
  month: number;
  monthName: string;
  generatedAt: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalSpending: number;
    transactionCount: number;
    averageTransaction: number;
    topCategory: string;
    topCategoryAmount: number;
  };
  spendingByCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
    transactionCount: number;
    trend: 'up' | 'down' | 'stable';
    trendPercentage: number;
  }>;
  trends: {
    vsPreviousMonth: {
      amountChange: number;
      percentageChange: number;
      direction: 'increase' | 'decrease' | 'stable';
    };
    vsSameMonthLastYear?: {
      amountChange: number;
      percentageChange: number;
      direction: 'increase' | 'decrease' | 'stable';
    };
    dailyAverage: number;
    highestSpendingDay?: {
      date: string;
      amount: number;
    };
  };
  budgetComparison?: {
    budgetAmount: number;
    actualAmount: number;
    variance: number;
    variancePercentage: number;
    status: 'under' | 'over' | 'on_track';
    byCategory: Array<{
      category: string;
      budget: number;
      actual: number;
      variance: number;
    }>;
  };
  insights: string[];
}

/**
 * Budget definition
 */
export interface Budget {
  id?: number;
  year: number;
  month: number;
  totalBudget: number;
  categoryBudgets: Record<string, number>;
  createdAt?: string;
}

/**
 * Budget database record
 */
interface BudgetRecord {
  id?: number;
  year: number;
  month: number;
  total_budget: number;
  category_budgets: string;
  created_at?: string;
}

/**
 * Historical report record
 */
interface MonthlyReportRecord {
  id?: number;
  year: number;
  month: number;
  generated_at: string;
  start_date: string;
  end_date: string;
  total_spending: number;
  transaction_count: number;
  top_category: string;
  top_category_amount: number;
  vs_previous_amount: number;
  vs_previous_percentage: number;
  report_data: string;
}

/**
 * Skill configuration
 */
export interface MonthlyReportsSkillConfig {
  dataDir?: string;
  receiptsProfile?: string;
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
 * Monthly Reports Skill
 */
export class MonthlyReportsSkill {
  private dataDir: string;
  private reportsDir: string;
  private db: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;
  private categorizer: ExpenseCategorizerSkill;

  constructor(config: MonthlyReportsSkillConfig = {}) {
    this.dataDir = config.dataDir || path.join(os.homedir(), '.openclaw', 'skills', 'monthly-reports');
    this.reportsDir = path.join(this.dataDir, 'reports');
    this.categorizer = new ExpenseCategorizerSkill({ receiptsProfile: config.receiptsProfile || 'default' });
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
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true, mode: 0o700 });
    }

    const dbPath = path.join(this.dataDir, 'monthly-reports.db');
    
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

    // Budgets table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        total_budget REAL NOT NULL,
        category_budgets TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(year, month)
      )
    `);

    // Report history table
    await run(this.db, `
      CREATE TABLE IF NOT EXISTS report_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        generated_at TEXT DEFAULT (datetime('now')),
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        total_spending REAL NOT NULL,
        transaction_count INTEGER NOT NULL,
        top_category TEXT,
        top_category_amount REAL,
        vs_previous_amount REAL,
        vs_previous_percentage REAL,
        report_data TEXT NOT NULL
      )
    `);

    // Create indexes
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_budgets_year_month ON budgets(year, month)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_report_history_year_month ON report_history(year, month)`);
    await run(this.db, `CREATE INDEX IF NOT EXISTS idx_report_history_generated ON report_history(generated_at)`);
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
   * Close database connections
   */
  async close(): Promise<void> {
    await this.ensureDatabase();
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.db = null;
    }
    await this.categorizer.close();
  }

  /**
   * Check health of dependencies
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    categorizer: { connected: boolean; message?: string };
  }> {
    let categorizerStatus = { connected: false, message: 'Not checked' };

    try {
      const stats = await this.categorizer.getStats();
      categorizerStatus = { 
        connected: true, 
        message: `${stats.totalReceipts} receipts in database` 
      };
    } catch (err) {
      categorizerStatus = { connected: false, message: String(err) };
    }

    return {
      status: categorizerStatus.connected ? 'healthy' : 'unhealthy',
      categorizer: categorizerStatus,
    };
  }

  /**
   * Get month name
   */
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Unknown';
  }

  /**
   * Get date range for a month
   */
  private getMonthDateRange(year: number, month: number): { startDate: string; endDate: string } {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }

  /**
   * Set budget for a month
   */
  async setBudget(year: number, month: number, totalBudget: number, categoryBudgets: Record<string, number> = {}): Promise<Budget> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, `
      INSERT INTO budgets (year, month, total_budget, category_budgets)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(year, month) DO UPDATE SET
        total_budget = excluded.total_budget,
        category_budgets = excluded.category_budgets
    `, [year, month, totalBudget, JSON.stringify(categoryBudgets)]);

    return {
      id: result.lastID,
      year,
      month,
      totalBudget,
      categoryBudgets,
    };
  }

  /**
   * Get budget for a month
   */
  async getBudget(year: number, month: number): Promise<Budget | null> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<BudgetRecord>(this.db,
      'SELECT * FROM budgets WHERE year = ? AND month = ?',
      [year, month]
    );

    if (!record) return null;

    return {
      id: record.id,
      year: record.year,
      month: record.month,
      totalBudget: record.total_budget,
      categoryBudgets: JSON.parse(record.category_budgets),
      createdAt: record.created_at,
    };
  }

  /**
   * Get category statistics for a date range
   */
  private async getCategoryStatsForRange(startDate: string, endDate: string): Promise<CategoryStats[]> {
    // Get all categories
    const categories = await this.categorizer.getCategories();
    const stats: CategoryStats[] = [];

    for (const category of categories) {
      const categoryStats = await this.categorizer.getCategoryStats(category.name, { startDate, endDate });
      if (categoryStats && categoryStats.receiptCount > 0) {
        stats.push(categoryStats);
      }
    }

    return stats.sort((a, b) => b.totalAmount - a.totalAmount);
  }

  /**
   * Generate monthly report
   */
  async generateReport(year: number, month: number, options: {
    includeInsights?: boolean;
  } = {}): Promise<MonthlyReport> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const includeInsights = options.includeInsights ?? true;
    const dateRange = this.getMonthDateRange(year, month);
    const monthName = this.getMonthName(month);

    // Get current month data
    const currentStats = await this.getCategoryStatsForRange(dateRange.startDate, dateRange.endDate);
    
    // Calculate totals
    const totalSpending = currentStats.reduce((sum, stat) => sum + stat.totalAmount, 0);
    const transactionCount = currentStats.reduce((sum, stat) => sum + stat.receiptCount, 0);
    const averageTransaction = transactionCount > 0 ? totalSpending / transactionCount : 0;
    
    const topCategory = currentStats[0]?.category || 'None';
    const topCategoryAmount = currentStats[0]?.totalAmount || 0;

    // Get previous month data for trends
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevDateRange = this.getMonthDateRange(prevYear, prevMonth);
    const prevStats = await this.getCategoryStatsForRange(prevDateRange.startDate, prevDateRange.endDate);
    const prevTotal = prevStats.reduce((sum, stat) => sum + stat.totalAmount, 0);

    const vsPreviousAmount = totalSpending - prevTotal;
    const vsPreviousPercentage = prevTotal > 0 ? (vsPreviousAmount / prevTotal) * 100 : 0;

    // Build spending by category with trends
    const spendingByCategory = await Promise.all(
      currentStats.map(async (stat) => {
        // Get previous month data for this category
        const prevCategoryStat = prevStats.find(s => s.category === stat.category);
        const prevAmount = prevCategoryStat?.totalAmount || 0;
        const amountChange = stat.totalAmount - prevAmount;
        const trendPercentage = prevAmount > 0 ? (amountChange / prevAmount) * 100 : 0;
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (trendPercentage > 5) trend = 'up';
        else if (trendPercentage < -5) trend = 'down';

        return {
          category: stat.category,
          amount: stat.totalAmount,
          percentage: totalSpending > 0 ? (stat.totalAmount / totalSpending) * 100 : 0,
          transactionCount: stat.receiptCount,
          trend,
          trendPercentage: Math.abs(trendPercentage),
        };
      })
    );

    // Get same month last year for YoY comparison
    let vsSameMonthLastYear: MonthlyReport['trends']['vsSameMonthLastYear'] | undefined;
    try {
      const lastYearDateRange = this.getMonthDateRange(year - 1, month);
      const lastYearStats = await this.getCategoryStatsForRange(lastYearDateRange.startDate, lastYearDateRange.endDate);
      const lastYearTotal = lastYearStats.reduce((sum, stat) => sum + stat.totalAmount, 0);
      
      const yoyChange = totalSpending - lastYearTotal;
      vsSameMonthLastYear = {
        amountChange: yoyChange,
        percentageChange: lastYearTotal > 0 ? (yoyChange / lastYearTotal) * 100 : 0,
        direction: yoyChange > 0 ? 'increase' : yoyChange < 0 ? 'decrease' : 'stable',
      };
    } catch {
      // Ignore if no data for last year
    }

    // Calculate daily average
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyAverage = totalSpending / daysInMonth;

    // Get budget comparison
    const budget = await this.getBudget(year, month);
    let budgetComparison: MonthlyReport['budgetComparison'] | undefined;
    
    if (budget) {
      const variance = totalSpending - budget.totalBudget;
      const variancePercentage = budget.totalBudget > 0 ? (variance / budget.totalBudget) * 100 : 0;
      
      budgetComparison = {
        budgetAmount: budget.totalBudget,
        actualAmount: totalSpending,
        variance,
        variancePercentage: Math.abs(variancePercentage),
        status: variance > 0 ? 'over' : variance < 0 ? 'under' : 'on_track',
        byCategory: currentStats.map(stat => {
          const catBudget = budget.categoryBudgets[stat.category] || 0;
          return {
            category: stat.category,
            budget: catBudget,
            actual: stat.totalAmount,
            variance: stat.totalAmount - catBudget,
          };
        }),
      };
    }

    // Generate insights
    const insights: string[] = [];
    if (includeInsights) {
      insights.push(...this.generateInsights(
        totalSpending,
        currentStats,
        vsPreviousAmount,
        budgetComparison,
        monthName
      ));
    }

    const report: MonthlyReport = {
      year,
      month,
      monthName,
      generatedAt: new Date().toISOString(),
      dateRange,
      summary: {
        totalSpending,
        transactionCount,
        averageTransaction,
        topCategory,
        topCategoryAmount,
      },
      spendingByCategory,
      trends: {
        vsPreviousMonth: {
          amountChange: vsPreviousAmount,
          percentageChange: vsPreviousPercentage,
          direction: vsPreviousAmount > 0 ? 'increase' : vsPreviousAmount < 0 ? 'decrease' : 'stable',
        },
        vsSameMonthLastYear,
        dailyAverage,
      },
      budgetComparison,
      insights,
    };

    // Save to history
    await this.saveReportHistory(report);

    return report;
  }

  /**
   * Generate insights from report data
   */
  private generateInsights(
    totalSpending: number,
    stats: CategoryStats[],
    vsPreviousAmount: number,
    budgetComparison: MonthlyReport['budgetComparison'] | undefined,
    monthName: string
  ): string[] {
    const insights: string[] = [];

    // Spending change insight
    if (Math.abs(vsPreviousAmount) > 0) {
      const direction = vsPreviousAmount > 0 ? 'increased' : 'decreased';
      const absAmount = Math.abs(vsPreviousAmount).toFixed(2);
      insights.push(`Your spending ${direction} by $${absAmount} compared to last month.`);
    }

    // Top category insight
    if (stats.length > 0) {
      const top = stats[0];
      const percentage = ((top.totalAmount / totalSpending) * 100).toFixed(1);
      insights.push(`${top.category} was your top spending category at ${percentage}% of total ($${top.totalAmount.toFixed(2)}).`);
    }

    // Budget insight
    if (budgetComparison) {
      if (budgetComparison.status === 'over') {
        insights.push(`You exceeded your budget by $${budgetComparison.variance.toFixed(2)} (${budgetComparison.variancePercentage.toFixed(1)}%).`);
      } else if (budgetComparison.status === 'under') {
        insights.push(`Great job! You stayed $${Math.abs(budgetComparison.variance).toFixed(2)} under budget.`);
      } else {
        insights.push('You hit your budget exactly this month.');
      }
    }

    // Category distribution insight
    if (stats.length >= 3) {
      const top3 = stats.slice(0, 3);
      const top3Total = top3.reduce((sum, s) => sum + s.totalAmount, 0);
      const top3Percentage = ((top3Total / totalSpending) * 100).toFixed(1);
      insights.push(`Your top 3 categories accounted for ${top3Percentage}% of total spending.`);
    }

    return insights;
  }

  /**
   * Save report to history
   */
  private async saveReportHistory(report: MonthlyReport): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await runWithResult(this.db, `
      INSERT INTO report_history 
      (year, month, start_date, end_date, total_spending, transaction_count, 
       top_category, top_category_amount, vs_previous_amount, vs_previous_percentage, report_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      report.year,
      report.month,
      report.dateRange.startDate,
      report.dateRange.endDate,
      report.summary.totalSpending,
      report.summary.transactionCount,
      report.summary.topCategory,
      report.summary.topCategoryAmount,
      report.trends.vsPreviousMonth.amountChange,
      report.trends.vsPreviousMonth.percentageChange,
      JSON.stringify(report),
    ]);
  }

  /**
   * Get report history
   */
  async getReportHistory(limit: number = 12): Promise<MonthlyReport[]> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const records = await all<MonthlyReportRecord>(this.db, `
      SELECT * FROM report_history 
      ORDER BY year DESC, month DESC 
      LIMIT ?
    `, [limit]);

    return records.map(r => JSON.parse(r.report_data) as MonthlyReport);
  }

  /**
   * Get report for a specific month
   */
  async getReport(year: number, month: number): Promise<MonthlyReport | null> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const record = await get<MonthlyReportRecord>(this.db, `
      SELECT * FROM report_history 
      WHERE year = ? AND month = ?
      ORDER BY generated_at DESC
      LIMIT 1
    `, [year, month]);

    if (!record) return null;

    return JSON.parse(record.report_data) as MonthlyReport;
  }

  /**
   * Generate ASCII chart for spending by category
   */
  generateAsciiChart(categories: Array<{ category: string; amount: number; percentage: number }>, maxWidth: number = 40): string {
    if (categories.length === 0) return 'No data available';

    const maxAmount = Math.max(...categories.map(c => c.amount));
    const maxLabelLength = Math.max(...categories.map(c => c.category.length));
    const lines: string[] = [];

    for (const cat of categories.slice(0, 10)) { // Top 10
      const barLength = maxAmount > 0 ? Math.round((cat.amount / maxAmount) * maxWidth) : 0;
      const bar = '█'.repeat(barLength);
      const label = cat.category.padEnd(maxLabelLength);
      const amount = `$${cat.amount.toFixed(2)}`.padStart(10);
      const percentage = `${cat.percentage.toFixed(1)}%`.padStart(6);
      
      lines.push(`${label} │${bar.padEnd(maxWidth)}│ ${amount} ${percentage}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate trend chart comparing months
   */
  generateTrendChart(monthlyData: Array<{ month: string; amount: number }>, maxWidth: number = 40): string {
    if (monthlyData.length === 0) return 'No data available';

    const maxAmount = Math.max(...monthlyData.map(d => d.amount));
    const maxLabelLength = Math.max(...monthlyData.map(d => d.month.length));
    const lines: string[] = [];

    for (const data of monthlyData) {
      const barLength = maxAmount > 0 ? Math.round((data.amount / maxAmount) * maxWidth) : 0;
      const bar = '█'.repeat(barLength);
      const label = data.month.padEnd(maxLabelLength);
      const amount = `$${data.amount.toFixed(2)}`.padStart(10);
      
      lines.push(`${label} │${bar.padEnd(maxWidth)}│ ${amount}`);
    }

    return lines.join('\n');
  }

  /**
   * Export report to HTML
   */
  exportToHTML(report: MonthlyReport): string {
    const categoryRows = report.spendingByCategory.map(cat => `
      <tr>
        <td>${cat.category}</td>
        <td>$${cat.amount.toFixed(2)}</td>
        <td>${cat.percentage.toFixed(1)}%</td>
        <td>${cat.transactionCount}</td>
        <td><span class="trend-${cat.trend}">${cat.trend === 'up' ? '↑' : cat.trend === 'down' ? '↓' : '→'} ${cat.trendPercentage.toFixed(1)}%</span></td>
      </tr>
    `).join('');

    const budgetSection = report.budgetComparison ? `
      <div class="section">
        <h2>Budget Comparison</h2>
        <div class="budget-summary ${report.budgetComparison.status}">
          <p><strong>Budget:</strong> $${report.budgetComparison.budgetAmount.toFixed(2)}</p>
          <p><strong>Actual:</strong> $${report.budgetComparison.actualAmount.toFixed(2)}</p>
          <p><strong>Variance:</strong> $${report.budgetComparison.variance.toFixed(2)} (${report.budgetComparison.variancePercentage.toFixed(1)}%)</p>
          <p><strong>Status:</strong> ${report.budgetComparison.status === 'over' ? 'Over Budget ⚠️' : report.budgetComparison.status === 'under' ? 'Under Budget ✅' : 'On Track'}</p>
        </div>
        <table>
          <thead>
            <tr><th>Category</th><th>Budget</th><th>Actual</th><th>Variance</th></tr>
          </thead>
          <tbody>
            ${report.budgetComparison.byCategory.map(bc => `
              <tr>
                <td>${bc.category}</td>
                <td>$${bc.budget.toFixed(2)}</td>
                <td>$${bc.actual.toFixed(2)}</td>
                <td class="${bc.variance > 0 ? 'negative' : 'positive'}">$${bc.variance.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    const insightsSection = report.insights.length > 0 ? `
      <div class="section">
        <h2>Insights</h2>
        <ul class="insights">
          ${report.insights.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Monthly Expense Report - ${report.monthName} ${report.year}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; background: #f5f5f5; }
    .report { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .summary-card { background: #f9f9f9; padding: 15px; border-radius: 6px; text-align: center; }
    .summary-card .value { font-size: 24px; font-weight: bold; color: #4CAF50; }
    .summary-card .label { font-size: 12px; color: #666; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; }
    tr:hover { background: #f9f9f9; }
    .trend-up { color: #f44336; }
    .trend-down { color: #4CAF50; }
    .trend-stable { color: #999; }
    .budget-summary { padding: 15px; border-radius: 6px; margin: 15px 0; }
    .budget-summary.under { background: #e8f5e9; }
    .budget-summary.over { background: #ffebee; }
    .budget-summary.on_track { background: #e3f2fd; }
    .positive { color: #4CAF50; }
    .negative { color: #f44336; }
    .insights { background: #fff3e0; padding: 15px 30px; border-radius: 6px; }
    .insights li { margin: 8px 0; }
    .trends { background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .section { margin: 30px 0; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="report">
    <h1>📊 Monthly Expense Report - ${report.monthName} ${report.year}</h1>
    <p class="generated">Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
    
    <div class="section">
      <h2>Summary</h2>
      <div class="summary">
        <div class="summary-card">
          <div class="value">$${report.summary.totalSpending.toFixed(2)}</div>
          <div class="label">Total Spending</div>
        </div>
        <div class="summary-card">
          <div class="value">${report.summary.transactionCount}</div>
          <div class="label">Transactions</div>
        </div>
        <div class="summary-card">
          <div class="value">$${report.summary.averageTransaction.toFixed(2)}</div>
          <div class="label">Avg Transaction</div>
        </div>
        <div class="summary-card">
          <div class="value">${report.summary.topCategory}</div>
          <div class="label">Top Category</div>
        </div>
      </div>
    </div>

    <div class="trends">
      <h3>Trends</h3>
      <p><strong>vs Previous Month:</strong> 
        ${report.trends.vsPreviousMonth.direction === 'increase' ? '↑' : report.trends.vsPreviousMonth.direction === 'decrease' ? '↓' : '→'}
        $${Math.abs(report.trends.vsPreviousMonth.amountChange).toFixed(2)} 
        (${Math.abs(report.trends.vsPreviousMonth.percentageChange).toFixed(1)}%)
      </p>
      ${report.trends.vsSameMonthLastYear ? `
      <p><strong>vs Same Month Last Year:</strong> 
        ${report.trends.vsSameMonthLastYear.direction === 'increase' ? '↑' : report.trends.vsSameMonthLastYear.direction === 'decrease' ? '↓' : '→'}
        $${Math.abs(report.trends.vsSameMonthLastYear.amountChange).toFixed(2)} 
        (${Math.abs(report.trends.vsSameMonthLastYear.percentageChange).toFixed(1)}%)
      </p>
      ` : ''}
      <p><strong>Daily Average:</strong> $${report.trends.dailyAverage.toFixed(2)}</p>
    </div>

    <div class="section">
      <h2>Spending by Category</h2>
      <table>
        <thead>
          <tr><th>Category</th><th>Amount</th><th>%</th><th>Transactions</th><th>Trend</th></tr>
        </thead>
        <tbody>
          ${categoryRows}
        </tbody>
      </table>
    </div>

    ${budgetSection}
    ${insightsSection}

    <div class="footer">
      <p>Generated by OpenClaw Monthly Reports</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Save report to file
   */
  async saveReportToFile(report: MonthlyReport, filePath?: string): Promise<string> {
    const outputPath = filePath || path.join(
      this.reportsDir,
      `expense-report-${report.year}-${String(report.month).padStart(2, '0')}.html`
    );

    const html = this.exportToHTML(report);
    fs.writeFileSync(outputPath, html, 'utf-8');

    return outputPath;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalReports: number;
    totalBudgets: number;
    earliestReport: string | null;
    latestReport: string | null;
  }> {
    await this.ensureDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const reportCount = await get<{ count: number }>(this.db, 'SELECT COUNT(*) as count FROM report_history');
    const budgetCount = await get<{ count: number }>(this.db, 'SELECT COUNT(*) as count FROM budgets');
    const earliest = await get<{ date: string }>(this.db, 'SELECT MIN(generated_at) as date FROM report_history');
    const latest = await get<{ date: string }>(this.db, 'SELECT MAX(generated_at) as date FROM report_history');

    return {
      totalReports: reportCount?.count || 0,
      totalBudgets: budgetCount?.count || 0,
      earliestReport: earliest?.date || null,
      latestReport: latest?.date || null,
    };
  }
}
