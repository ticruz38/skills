/**
 * Report Builder Skill
 * Build automated data reports with scheduled delivery
 * Built on top of data-connector, chart-generator, and email skills
 */

import * as sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Dynamic imports for ES module dependencies
async function loadDependencies() {
  const { DataConnectorSkill } = await import('@openclaw/data-connector');
  const { ChartGeneratorSkill } = await import('@openclaw/chart-generator');
  const { EmailSkill } = await import('@openclaw/email');
  return { DataConnectorSkill, ChartGeneratorSkill, EmailSkill };
}

/**
 * Report period type
 */
export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * Report format type
 */
export type ReportFormat = 'html' | 'csv' | 'json' | 'pdf';

/**
 * Report template configuration
 */
export interface ReportTemplate {
  id?: number;
  name: string;
  description?: string;
  connectionId: number;
  query?: string;
  aggregationType?: 'sum' | 'average' | 'count' | 'min' | 'max' | 'none';
  groupByColumn?: string;
  valueColumn?: string;
  labelColumn?: string;
  chartType?: 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'none';
  includeChart: boolean;
  includeTable: boolean;
  includeSummary: boolean;
  filters?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Scheduled report configuration
 */
export interface ScheduledReport {
  id?: number;
  templateId: number;
  name: string;
  period: ReportPeriod;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  timeOfDay: string; // HH:MM format
  formats: ReportFormat[];
  emailRecipients: string[];
  emailSubject?: string;
  emailBody?: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt?: string;
}

/**
 * Report execution result
 */
export interface ReportResult {
  id?: number;
  scheduleId: number;
  templateId: number;
  generatedAt: string;
  format: ReportFormat;
  filePath?: string;
  fileSize?: number;
  recordCount: number;
  status: 'success' | 'failed';
  errorMessage?: string;
  emailedTo?: string[];
}

/**
 * Report data result
 */
export interface ReportData {
  headers: string[];
  rows: any[][];
  summary: {
    total: number;
    aggregated?: { [key: string]: number };
  };
}

/**
 * Report builder skill configuration
 */
export interface ReportBuilderConfig {
  dataDir?: string;
}

// SQLite run result helper
function runWithResult(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Report Builder Skill
 */
export class ReportBuilderSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private dataDir: string;
  private initPromise: Promise<void> | null = null;
  private dataConnector: any = null;
  private chartGenerator: any = null;
  private emailSkill: any = null;

  constructor(config: ReportBuilderConfig = {}) {
    this.dataDir = config.dataDir || path.join(os.homedir(), '.openclaw', 'skills', 'report-builder');
    this.dbPath = path.join(this.dataDir, 'reports.db');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Initialize the database
   */
  private async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, async (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          await this.createTables();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    
    return this.initPromise;
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const schema = `
      CREATE TABLE IF NOT EXISTS report_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        connection_id INTEGER NOT NULL,
        query TEXT,
        aggregation_type TEXT,
        group_by_column TEXT,
        value_column TEXT,
        label_column TEXT,
        chart_type TEXT DEFAULT 'none',
        include_chart INTEGER DEFAULT 1,
        include_table INTEGER DEFAULT 1,
        include_summary INTEGER DEFAULT 1,
        filters TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS scheduled_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        period TEXT NOT NULL,
        day_of_week INTEGER,
        day_of_month INTEGER,
        time_of_day TEXT NOT NULL,
        formats TEXT NOT NULL,
        email_recipients TEXT NOT NULL,
        email_subject TEXT,
        email_body TEXT,
        enabled INTEGER DEFAULT 1,
        last_run_at DATETIME,
        next_run_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES report_templates(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS report_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id INTEGER,
        template_id INTEGER NOT NULL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        format TEXT NOT NULL,
        file_path TEXT,
        file_size INTEGER,
        record_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'success',
        error_message TEXT,
        emailed_to TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON scheduled_reports(enabled);
      CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON scheduled_reports(next_run_at);
      CREATE INDEX IF NOT EXISTS idx_history_generated ON report_history(generated_at);
    `;

    return new Promise((resolve, reject) => {
      this.db!.exec(schema, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Initialize dependencies
   */
  private async initDependencies(): Promise<void> {
    if (!this.dataConnector) {
      const { DataConnectorSkill, ChartGeneratorSkill, EmailSkill } = await loadDependencies();
      this.dataConnector = new DataConnectorSkill();
      this.chartGenerator = new ChartGeneratorSkill();
      this.emailSkill = new EmailSkill();
    }
  }

  /**
   * Create a report template
   */
  async createTemplate(template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReportTemplate> {
    await this.init();
    
    const sql = `
      INSERT INTO report_templates 
      (name, description, connection_id, query, aggregation_type, group_by_column, value_column, 
       label_column, chart_type, include_chart, include_table, include_summary, filters)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await runWithResult(this.db!, sql, [
      template.name,
      template.description || null,
      template.connectionId,
      template.query || null,
      template.aggregationType || null,
      template.groupByColumn || null,
      template.valueColumn || null,
      template.labelColumn || null,
      template.chartType || 'none',
      template.includeChart ? 1 : 0,
      template.includeTable ? 1 : 0,
      template.includeSummary ? 1 : 0,
      template.filters || null
    ]);
    
    return this.getTemplate(result.lastID);
  }

  /**
   * Get a template by ID
   */
  async getTemplate(id: number): Promise<ReportTemplate> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM report_templates WHERE id = ?',
        [id],
        (err, row: any) => {
          if (err) reject(err);
          else if (!row) reject(new Error(`Template ${id} not found`));
          else resolve(this.mapTemplateRow(row));
        }
      );
    });
  }

  /**
   * List all templates
   */
  async listTemplates(): Promise<ReportTemplate[]> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM report_templates ORDER BY created_at DESC',
        [],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(r => this.mapTemplateRow(r)));
        }
      );
    });
  }

  /**
   * Update a template
   */
  async updateTemplate(id: number, updates: Partial<ReportTemplate>): Promise<ReportTemplate> {
    await this.init();
    
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.connectionId !== undefined) { fields.push('connection_id = ?'); values.push(updates.connectionId); }
    if (updates.query !== undefined) { fields.push('query = ?'); values.push(updates.query); }
    if (updates.aggregationType !== undefined) { fields.push('aggregation_type = ?'); values.push(updates.aggregationType); }
    if (updates.groupByColumn !== undefined) { fields.push('group_by_column = ?'); values.push(updates.groupByColumn); }
    if (updates.valueColumn !== undefined) { fields.push('value_column = ?'); values.push(updates.valueColumn); }
    if (updates.labelColumn !== undefined) { fields.push('label_column = ?'); values.push(updates.labelColumn); }
    if (updates.chartType !== undefined) { fields.push('chart_type = ?'); values.push(updates.chartType); }
    if (updates.includeChart !== undefined) { fields.push('include_chart = ?'); values.push(updates.includeChart ? 1 : 0); }
    if (updates.includeTable !== undefined) { fields.push('include_table = ?'); values.push(updates.includeTable ? 1 : 0); }
    if (updates.includeSummary !== undefined) { fields.push('include_summary = ?'); values.push(updates.includeSummary ? 1 : 0); }
    if (updates.filters !== undefined) { fields.push('filters = ?'); values.push(updates.filters); }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const sql = `UPDATE report_templates SET ${fields.join(', ')} WHERE id = ?`;
    await runWithResult(this.db!, sql, values);
    
    return this.getTemplate(id);
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: number): Promise<void> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.run('DELETE FROM report_templates WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Map database row to template
   */
  private mapTemplateRow(row: any): ReportTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      connectionId: row.connection_id,
      query: row.query,
      aggregationType: row.aggregation_type,
      groupByColumn: row.group_by_column,
      valueColumn: row.value_column,
      labelColumn: row.label_column,
      chartType: row.chart_type,
      includeChart: !!row.include_chart,
      includeTable: !!row.include_table,
      includeSummary: !!row.include_summary,
      filters: row.filters,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Create a scheduled report
   */
  async createSchedule(schedule: Omit<ScheduledReport, 'id' | 'createdAt' | 'lastRunAt' | 'nextRunAt'>): Promise<ScheduledReport> {
    await this.init();
    
    // Validate template exists
    await this.getTemplate(schedule.templateId);
    
    const nextRunAt = this.calculateNextRun(schedule);
    
    const sql = `
      INSERT INTO scheduled_reports 
      (template_id, name, period, day_of_week, day_of_month, time_of_day, formats, 
       email_recipients, email_subject, email_body, enabled, next_run_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await runWithResult(this.db!, sql, [
      schedule.templateId,
      schedule.name,
      schedule.period,
      schedule.dayOfWeek || null,
      schedule.dayOfMonth || null,
      schedule.timeOfDay,
      JSON.stringify(schedule.formats),
      JSON.stringify(schedule.emailRecipients),
      schedule.emailSubject || null,
      schedule.emailBody || null,
      schedule.enabled ? 1 : 0,
      nextRunAt.toISOString()
    ]);
    
    return this.getSchedule(result.lastID);
  }

  /**
   * Get a schedule by ID
   */
  async getSchedule(id: number): Promise<ScheduledReport> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM scheduled_reports WHERE id = ?',
        [id],
        (err, row: any) => {
          if (err) reject(err);
          else if (!row) reject(new Error(`Schedule ${id} not found`));
          else resolve(this.mapScheduleRow(row));
        }
      );
    });
  }

  /**
   * List all schedules
   */
  async listSchedules(enabledOnly = false): Promise<ScheduledReport[]> {
    await this.init();
    
    const sql = enabledOnly 
      ? 'SELECT * FROM scheduled_reports WHERE enabled = 1 ORDER BY next_run_at'
      : 'SELECT * FROM scheduled_reports ORDER BY created_at DESC';
    
    return new Promise((resolve, reject) => {
      this.db!.all(sql, [], (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(r => this.mapScheduleRow(r)));
      });
    });
  }

  /**
   * Update a schedule
   */
  async updateSchedule(id: number, updates: Partial<ScheduledReport>): Promise<ScheduledReport> {
    await this.init();
    
    const current = await this.getSchedule(id);
    
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.templateId !== undefined) { fields.push('template_id = ?'); values.push(updates.templateId); }
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.period !== undefined) { fields.push('period = ?'); values.push(updates.period); }
    if (updates.dayOfWeek !== undefined) { fields.push('day_of_week = ?'); values.push(updates.dayOfWeek); }
    if (updates.dayOfMonth !== undefined) { fields.push('day_of_month = ?'); values.push(updates.dayOfMonth); }
    if (updates.timeOfDay !== undefined) { fields.push('time_of_day = ?'); values.push(updates.timeOfDay); }
    if (updates.formats !== undefined) { fields.push('formats = ?'); values.push(JSON.stringify(updates.formats)); }
    if (updates.emailRecipients !== undefined) { fields.push('email_recipients = ?'); values.push(JSON.stringify(updates.emailRecipients)); }
    if (updates.emailSubject !== undefined) { fields.push('email_subject = ?'); values.push(updates.emailSubject); }
    if (updates.emailBody !== undefined) { fields.push('email_body = ?'); values.push(updates.emailBody); }
    if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
    
    values.push(id);
    
    const sql = `UPDATE scheduled_reports SET ${fields.join(', ')} WHERE id = ?`;
    await runWithResult(this.db!, sql, values);
    
    // Recalculate next run if schedule params changed
    if (updates.period || updates.dayOfWeek !== undefined || updates.dayOfMonth !== undefined || updates.timeOfDay) {
      const updated = await this.getSchedule(id);
      const nextRun = this.calculateNextRun(updated);
      await runWithResult(this.db!, 'UPDATE scheduled_reports SET next_run_at = ? WHERE id = ?', 
        [nextRun.toISOString(), id]);
    }
    
    return this.getSchedule(id);
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: number): Promise<void> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.run('DELETE FROM scheduled_reports WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Map database row to schedule
   */
  private mapScheduleRow(row: any): ScheduledReport {
    return {
      id: row.id,
      templateId: row.template_id,
      name: row.name,
      period: row.period,
      dayOfWeek: row.day_of_week,
      dayOfMonth: row.day_of_month,
      timeOfDay: row.time_of_day,
      formats: JSON.parse(row.formats),
      emailRecipients: JSON.parse(row.email_recipients),
      emailSubject: row.email_subject,
      emailBody: row.email_body,
      enabled: !!row.enabled,
      lastRunAt: row.last_run_at,
      nextRunAt: row.next_run_at,
      createdAt: row.created_at
    };
  }

  /**
   * Calculate next run time for a schedule
   */
  private calculateNextRun(schedule: Partial<ScheduledReport>): Date {
    const now = new Date();
    const [hours, minutes] = (schedule.timeOfDay || '09:00').split(':').map(Number);
    let nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    switch (schedule.period) {
      case 'daily':
        // Already set to next occurrence
        break;
        
      case 'weekly':
        const targetDay = schedule.dayOfWeek ?? 1; // Default to Monday
        while (nextRun.getDay() !== targetDay) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
        
      case 'monthly':
        const targetDate = schedule.dayOfMonth ?? 1;
        nextRun.setDate(targetDate);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
        
      case 'quarterly':
        nextRun.setDate(schedule.dayOfMonth ?? 1);
        const currentQuarter = Math.floor(now.getMonth() / 3);
        nextRun.setMonth((currentQuarter + 1) * 3);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 3);
        }
        break;
        
      case 'yearly':
        nextRun.setMonth(0);
        nextRun.setDate(1);
        if (nextRun <= now) {
          nextRun.setFullYear(nextRun.getFullYear() + 1);
        }
        break;
    }
    
    return nextRun;
  }

  /**
   * Generate report data from template
   */
  async generateReportData(templateId: number): Promise<ReportData> {
    await this.init();
    await this.initDependencies();
    
    const template = await this.getTemplate(templateId);
    const connection = await this.dataConnector.getConnection(template.connectionId);
    
    let data = await this.dataConnector.readFromSource(connection);
    
    // Apply filters if specified
    if (template.filters) {
      const filters = JSON.parse(template.filters);
      data = data.filter((row: any) => {
        return Object.entries(filters).every(([key, value]) => row[key] === value);
      });
    }
    
    // Apply aggregation if specified
    let aggregated: { [key: string]: number } = {};
    if (template.aggregationType && template.groupByColumn && template.valueColumn) {
      const grouped: { [key: string]: number[] } = {};
      
      data.forEach((row: any) => {
        const key = String(row[template.groupByColumn!] || 'Unknown');
        const value = parseFloat(row[template.valueColumn!]) || 0;
        
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(value);
      });
      
      Object.entries(grouped).forEach(([key, values]) => {
        switch (template.aggregationType) {
          case 'sum':
            aggregated[key] = values.reduce((a, b) => a + b, 0);
            break;
          case 'average':
            aggregated[key] = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'count':
            aggregated[key] = values.length;
            break;
          case 'min':
            aggregated[key] = Math.min(...values);
            break;
          case 'max':
            aggregated[key] = Math.max(...values);
            break;
        }
      });
      
      // Transform data to aggregated format
      data = Object.entries(aggregated).map(([key, value]) => ({
        [template.groupByColumn!]: key,
        [template.valueColumn!]: value
      }));
    }
    
    // Build report structure
    const headers = data.length > 0 ? Object.keys(data[0]).filter(k => !k.startsWith('_')) : [];
    const rows = data.map((row: any) => headers.map(h => row[h]));
    
    return {
      headers,
      rows,
      summary: {
        total: data.length,
        aggregated: Object.keys(aggregated).length > 0 ? aggregated : undefined
      }
    };
  }

  /**
   * Generate HTML report
   */
  async generateHtmlReport(templateId: number, data?: ReportData): Promise<string> {
    await this.init();
    await this.initDependencies();
    
    const template = await this.getTemplate(templateId);
    const reportData = data || await this.generateReportData(templateId);
    
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${template.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
    .meta { color: #666; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; color: #333; }
    tr:hover { background: #f8f9fa; }
    .summary { background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .summary h3 { margin-top: 0; color: #2e7d32; }
    .chart { margin: 20px 0; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${template.name}</h1>
    <p class="meta">Generated: ${new Date().toLocaleString()}</p>
    ${template.description ? `<p>${template.description}</p>` : ''}
`;

    if (template.includeSummary) {
      html += `
    <div class="summary">
      <h3>Summary</h3>
      <p>Total Records: <strong>${reportData.summary.total.toLocaleString()}</strong></p>
      ${reportData.summary.aggregated ? `
        <p>Aggregated Values:</p>
        <ul>
          ${Object.entries(reportData.summary.aggregated).map(([k, v]) => 
            `<li>${k}: ${typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v}</li>`
          ).join('')}
        </ul>
      ` : ''}
    </div>
`;
    }

    if (template.includeChart && template.chartType && template.chartType !== 'none' && template.valueColumn) {
      try {
        const chartData = reportData.rows.map((row, i) => ({
          label: String(row[reportData.headers.indexOf(template.labelColumn || template.groupByColumn || 'Label')] || `Item ${i + 1}`),
          value: parseFloat(String(row[reportData.headers.indexOf(template.valueColumn!)])) || 0
        }));
        
        const chartResult = this.chartGenerator.generateChart(chartData, {
          type: template.chartType as any,
          title: template.name,
          width: 800,
          height: 400,
          theme: 'light'
        });
        
        html += `
    <div class="chart">
      ${chartResult.svg}
    </div>
`;
      } catch (error) {
        html += `<p class="error">Chart generation failed: ${error}</p>`;
      }
    }

    if (template.includeTable) {
      html += `
    <table>
      <thead>
        <tr>${reportData.headers.map(h => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${reportData.rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
`;
    }

    html += `
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Generate CSV report
   */
  async generateCsvReport(templateId: number, data?: ReportData): Promise<string> {
    const reportData = data || await this.generateReportData(templateId);
    
    const escapeCsv = (value: any): string => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    let csv = reportData.headers.map(escapeCsv).join(',') + '\n';
    csv += reportData.rows.map(row => row.map(escapeCsv).join(',')).join('\n');
    
    return csv;
  }

  /**
   * Generate JSON report
   */
  async generateJsonReport(templateId: number, data?: ReportData): Promise<string> {
    const reportData = data || await this.generateReportData(templateId);
    
    const jsonData = reportData.rows.map(row => {
      const obj: any = {};
      reportData.headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    
    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      summary: reportData.summary,
      data: jsonData
    }, null, 2);
  }

  /**
   * Execute a scheduled report
   */
  async executeReport(scheduleId: number, dryRun = false): Promise<ReportResult[]> {
    await this.init();
    await this.initDependencies();
    
    const schedule = await this.getSchedule(scheduleId);
    const template = await this.getTemplate(schedule.templateId);
    const data = await this.generateReportData(schedule.templateId);
    
    const results: ReportResult[] = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    for (const format of schedule.formats) {
      let content: string;
      let extension: string;
      
      switch (format) {
        case 'html':
          content = await this.generateHtmlReport(schedule.templateId, data);
          extension = 'html';
          break;
        case 'csv':
          content = await this.generateCsvReport(schedule.templateId, data);
          extension = 'csv';
          break;
        case 'json':
          content = await this.generateJsonReport(schedule.templateId, data);
          extension = 'json';
          break;
        case 'pdf':
          content = await this.generateHtmlReport(schedule.templateId, data);
          extension = 'html';
          break;
        default:
          continue;
      }
      
      const fileName = `${template.name.replace(/\s+/g, '_')}_${timestamp}.${extension}`;
      const filePath = path.join(this.dataDir, fileName);
      
      if (!dryRun) {
        fs.writeFileSync(filePath, content);
      }
      
      const result: ReportResult = {
        scheduleId,
        templateId: schedule.templateId,
        generatedAt: new Date().toISOString(),
        format,
        filePath: dryRun ? undefined : filePath,
        fileSize: Buffer.byteLength(content),
        recordCount: data.summary.total,
        status: 'success',
        emailedTo: []
      };
      
      // Send email if recipients specified
      if (schedule.emailRecipients.length > 0 && !dryRun) {
        try {
          for (const recipient of schedule.emailRecipients) {
            await this.emailSkill.sendEmail({
              to: recipient,
              subject: schedule.emailSubject || `Report: ${template.name}`,
              bodyHtml: schedule.emailBody ? `<p>${schedule.emailBody.replace(/\n/g, '<br>')}</p>` : undefined,
              bodyText: schedule.emailBody || `Please find the attached report: ${template.name}`,
              attachments: [{
                filename: fileName,
                content: Buffer.from(content),
                mimeType: format === 'html' ? 'text/html' : format === 'csv' ? 'text/csv' : 'application/json'
              }]
            });
          }
          result.emailedTo = schedule.emailRecipients;
        } catch (error: any) {
          result.status = 'failed';
          result.errorMessage = `Email failed: ${error.message}`;
        }
      }
      
      // Save to history
      if (!dryRun) {
        const sql = `
          INSERT INTO report_history 
          (schedule_id, template_id, format, file_path, file_size, record_count, status, error_message, emailed_to)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await runWithResult(this.db!, sql, [
          result.scheduleId,
          result.templateId,
          result.format,
          result.filePath,
          result.fileSize,
          result.recordCount,
          result.status,
          result.errorMessage || null,
          result.emailedTo ? JSON.stringify(result.emailedTo) : null
        ]);
      }
      
      results.push(result);
    }
    
    // Update schedule last run time
    if (!dryRun) {
      const nextRun = this.calculateNextRun(schedule);
      await runWithResult(this.db!, 
        'UPDATE scheduled_reports SET last_run_at = ?, next_run_at = ? WHERE id = ?',
        [new Date().toISOString(), nextRun.toISOString(), scheduleId]
      );
    }
    
    return results;
  }

  /**
   * Get report history
   */
  async getReportHistory(limit = 50): Promise<ReportResult[]> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT * FROM report_history ORDER BY generated_at DESC LIMIT ?`,
        [limit],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(r => ({
            id: r.id,
            scheduleId: r.schedule_id,
            templateId: r.template_id,
            generatedAt: r.generated_at,
            format: r.format,
            filePath: r.file_path,
            fileSize: r.file_size,
            recordCount: r.record_count,
            status: r.status,
            errorMessage: r.error_message,
            emailedTo: r.emailed_to ? JSON.parse(r.emailed_to) : undefined
          })));
        }
      );
    });
  }

  /**
   * Check for due reports and execute them
   */
  async checkAndExecuteDueReports(dryRun = false): Promise<ReportResult[][]> {
    await this.init();
    
    const now = new Date().toISOString();
    const dueSchedules = await new Promise<ScheduledReport[]>((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM scheduled_reports WHERE enabled = 1 AND next_run_at <= ?',
        [now],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(r => this.mapScheduleRow(r)));
        }
      );
    });
    
    const results: ReportResult[][] = [];
    for (const schedule of dueSchedules) {
      try {
        const reportResults = await this.executeReport(schedule.id!, dryRun);
        results.push(reportResults);
      } catch (error: any) {
        console.error(`Failed to execute report ${schedule.name}:`, error.message);
      }
    }
    
    return results;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    templates: number;
    schedules: { total: number; enabled: number };
    history: { total: number; last7Days: number; last30Days: number };
    formats: { [key: string]: number };
  }> {
    await this.init();
    
    const templates = await new Promise<number>((resolve, reject) => {
      this.db!.get('SELECT COUNT(*) as count FROM report_templates', [], (err, row: any) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    
    const schedules = await new Promise<{ total: number; enabled: number }>((resolve, reject) => {
      this.db!.get(
        'SELECT COUNT(*) as total, SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled FROM scheduled_reports',
        [],
        (err, row: any) => {
          if (err) reject(err);
          else resolve({ total: row.total || 0, enabled: row.enabled || 0 });
        }
      );
    });
    
    const history = await new Promise<{ total: number; last7Days: number; last30Days: number }>((resolve, reject) => {
      this.db!.get(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN generated_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as last7Days,
          SUM(CASE WHEN generated_at > datetime('now', '-30 days') THEN 1 ELSE 0 END) as last30Days
        FROM report_history
      `, [], (err, row: any) => {
        if (err) reject(err);
        else resolve({ total: row.total || 0, last7Days: row.last7Days || 0, last30Days: row.last30Days || 0 });
      });
    });
    
    const formatCounts = await new Promise<{ [key: string]: number }>((resolve, reject) => {
      this.db!.all('SELECT format, COUNT(*) as count FROM report_history GROUP BY format', [], (err, rows: any[]) => {
        if (err) reject(err);
        else {
          const result: { [key: string]: number } = {};
          rows.forEach(r => result[r.format] = r.count);
          resolve(result);
        }
      });
    });
    
    return { templates, schedules, history, formats: formatCounts };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    database: boolean;
    dataConnector: boolean;
    chartGenerator: boolean;
    email: boolean;
    message?: string;
  }> {
    try {
      await this.init();
      
      const checks = {
        database: !!this.db,
        dataConnector: false,
        chartGenerator: false,
        email: false
      };
      
      try {
        await this.initDependencies();
        checks.dataConnector = await this.dataConnector.healthCheck().then((r: any) => r.status === 'connected' || r.status === 'ok');
        checks.chartGenerator = true; // chart-generator has no external deps
        checks.email = await this.emailSkill.healthCheck().then((r: any) => r.connected);
      } catch (e) {
        // Dependencies not available
      }
      
      const allHealthy = checks.database && checks.dataConnector && checks.chartGenerator && checks.email;
      const someHealthy = checks.database || checks.dataConnector || checks.chartGenerator || checks.email;
      
      return {
        status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
        ...checks,
        message: allHealthy ? 'All systems operational' : 'Some dependencies unavailable'
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        database: false,
        dataConnector: false,
        chartGenerator: false,
        email: false,
        message: error.message
      };
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.db = null;
    }
    
    if (this.dataConnector) await this.dataConnector.close();
    if (this.chartGenerator) await this.chartGenerator.close();
    if (this.emailSkill) await this.emailSkill.close();
  }
}

export default ReportBuilderSkill;
