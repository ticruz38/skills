#!/usr/bin/env node
/**
 * Report Builder CLI
 * Command-line interface for building automated reports
 */

import { ReportBuilderSkill, ReportTemplate, ScheduledReport, ReportPeriod, ReportFormat } from './index';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
Report Builder - Automated Report Generation

Usage:
  npm run cli -- <command> [options]

Commands:
  status                    Check system health
  health                    Alias for status

  Templates:
    template-create         Create a new report template
    template-list           List all templates
    template-get <id>       Get template details
    template-update <id>    Update a template
    template-delete <id>    Delete a template

  Schedules:
    schedule-create         Create a scheduled report
    schedule-list           List all schedules
    schedule-get <id>       Get schedule details
    schedule-update <id>    Update a schedule
    schedule-enable <id>    Enable a schedule
    schedule-disable <id>   Disable a schedule
    schedule-delete <id>    Delete a schedule

  Reports:
    generate <template-id>  Generate a report immediately
    execute <schedule-id>   Execute a scheduled report
    preview <template-id>   Preview report (dry run)
    due                     Check and execute due reports
    history                 View report history
    stats                   Show statistics

Options:
  --name <name>             Report/template name
  --description <text>      Description
  --connection <id>         Data connection ID
  --query <sql>             SQL query (if applicable)
  --aggregation <type>      Aggregation: sum, average, count, min, max, none
  --group-by <column>       Group by column
  --value <column>          Value column for aggregation/chart
  --label <column>          Label column for chart
  --chart <type>            Chart type: bar, line, pie, doughnut, area, none
  --include-chart           Include chart in report
  --include-table           Include data table
  --include-summary         Include summary section
  --template <id>           Template ID for schedule
  --period <period>         Schedule period: daily, weekly, monthly, quarterly, yearly
  --day-of-week <n>         Day of week (0-6) for weekly
  --day-of-month <n>        Day of month (1-31) for monthly
  --time <HH:MM>            Time of day (default: 09:00)
  --formats <list>          Comma-separated formats: html,csv,json,pdf
  --recipients <emails>     Comma-separated email addresses
  --subject <text>          Email subject
  --body <text>             Email body
  --output <path>           Output file path
  --dry-run                 Simulate without executing

Examples:
  npm run cli -- template-create --name "Sales Report" --connection 1 --value Revenue --label Month --chart bar
  npm run cli -- schedule-create --template 1 --name "Weekly Sales" --period weekly --day-of-week 1 --time 09:00 --formats html,csv --recipients boss@company.com
  npm run cli -- generate 1 --output report.html
`);
}

function getArg(name: string, short?: string): string | undefined {
  const index = args.findIndex((a, i) => 
    (a === `--${name}` || a === `-${short}`) && i < args.length - 1
  );
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(name: string, short?: string): boolean {
  return args.some(a => a === `--${name}` || a === `-${short}`);
}

async function main() {
  const skill = new ReportBuilderSkill();

  try {
    switch (command) {
      case 'help':
      case '--help':
      case '-h':
        printHelp();
        break;

      case 'status':
      case 'health': {
        const health = await skill.healthCheck();
        console.log('\nReport Builder Health');
        console.log('=====================');
        console.log(`Status: ${health.status}`);
        console.log(`Database: ${health.database ? '✓' : '✗'}`);
        console.log(`Data Connector: ${health.dataConnector ? '✓' : '✗'}`);
        console.log(`Chart Generator: ${health.chartGenerator ? '✓' : '✗'}`);
        console.log(`Email: ${health.email ? '✓' : '✗'}`);
        if (health.message) console.log(`\n${health.message}`);
        break;
      }

      case 'template-create': {
        const template: any = {
          name: getArg('name', 'n'),
          description: getArg('description', 'd'),
          connectionId: parseInt(getArg('connection', 'c') || '0'),
          query: getArg('query', 'q'),
          aggregationType: getArg('aggregation', 'a') as any,
          groupByColumn: getArg('group-by', 'g'),
          valueColumn: getArg('value', 'v'),
          labelColumn: getArg('label', 'l'),
          chartType: (getArg('chart') || 'none') as any,
          includeChart: hasFlag('include-chart') || !!getArg('chart'),
          includeTable: hasFlag('include-table', 't') || true,
          includeSummary: hasFlag('include-summary', 's') || true,
          filters: getArg('filters') ? JSON.parse(getArg('filters')!) : undefined
        };

        if (!template.name) throw new Error('Name is required (--name)');
        if (!template.connectionId) throw new Error('Connection ID is required (--connection)');

        const created = await skill.createTemplate(template);
        console.log(`\n✓ Template created: ${created.name}`);
        console.log(`  ID: ${created.id}`);
        console.log(`  Connection: ${created.connectionId}`);
        console.log(`  Chart Type: ${created.chartType}`);
        break;
      }

      case 'template-list': {
        const templates = await skill.listTemplates();
        console.log('\nReport Templates');
        console.log('================');
        if (templates.length === 0) {
          console.log('No templates found.');
        } else {
          templates.forEach(t => {
            console.log(`\n${t.id}: ${t.name}`);
            console.log(`  Connection: ${t.connectionId}, Chart: ${t.chartType}`);
            if (t.description) console.log(`  ${t.description}`);
          });
        }
        break;
      }

      case 'template-get': {
        const id = parseInt(args[1]);
        if (!id) throw new Error('Template ID required');
        
        const template = await skill.getTemplate(id);
        console.log(`\nTemplate: ${template.name}`);
        console.log('=========' + '='.repeat(template.name.length));
        console.log(`ID: ${template.id}`);
        console.log(`Description: ${template.description || 'N/A'}`);
        console.log(`Connection ID: ${template.connectionId}`);
        console.log(`Query: ${template.query || 'N/A'}`);
        console.log(`Aggregation: ${template.aggregationType || 'none'}`);
        console.log(`Group By: ${template.groupByColumn || 'N/A'}`);
        console.log(`Value Column: ${template.valueColumn || 'N/A'}`);
        console.log(`Label Column: ${template.labelColumn || 'N/A'}`);
        console.log(`Chart Type: ${template.chartType}`);
        console.log(`Include Chart: ${template.includeChart}`);
        console.log(`Include Table: ${template.includeTable}`);
        console.log(`Include Summary: ${template.includeSummary}`);
        console.log(`Filters: ${template.filters || 'N/A'}`);
        console.log(`Created: ${template.createdAt}`);
        break;
      }

      case 'template-update': {
        const id = parseInt(args[1]);
        if (!id) throw new Error('Template ID required');
        
        const updates: any = {};
        if (getArg('name')) updates.name = getArg('name');
        if (getArg('description')) updates.description = getArg('description');
        if (getArg('connection')) updates.connectionId = parseInt(getArg('connection')!);
        if (getArg('query')) updates.query = getArg('query');
        if (getArg('aggregation')) updates.aggregationType = getArg('aggregation');
        if (getArg('group-by')) updates.groupByColumn = getArg('group-by');
        if (getArg('value')) updates.valueColumn = getArg('value');
        if (getArg('label')) updates.labelColumn = getArg('label');
        if (getArg('chart')) updates.chartType = getArg('chart');
        if (hasFlag('include-chart')) updates.includeChart = true;
        if (hasFlag('no-include-chart')) updates.includeChart = false;
        if (hasFlag('include-table')) updates.includeTable = true;
        if (hasFlag('no-include-table')) updates.includeTable = false;
        if (hasFlag('include-summary')) updates.includeSummary = true;
        if (hasFlag('no-include-summary')) updates.includeSummary = false;
        
        const updated = await skill.updateTemplate(id, updates);
        console.log(`\n✓ Template updated: ${updated.name}`);
        break;
      }

      case 'template-delete': {
        const id = parseInt(args[1]);
        if (!id) throw new Error('Template ID required');
        
        await skill.deleteTemplate(id);
        console.log(`\n✓ Template ${id} deleted`);
        break;
      }

      case 'schedule-create': {
        const schedule: any = {
          templateId: parseInt(getArg('template') || '0'),
          name: getArg('name', 'n'),
          period: (getArg('period') || 'daily') as ReportPeriod,
          dayOfWeek: getArg('day-of-week') ? parseInt(getArg('day-of-week')!) : undefined,
          dayOfMonth: getArg('day-of-month') ? parseInt(getArg('day-of-month')!) : undefined,
          timeOfDay: getArg('time') || '09:00',
          formats: (getArg('formats') || 'html').split(',').map((f: string) => f.trim()) as ReportFormat[],
          emailRecipients: getArg('recipients') ? getArg('recipients')!.split(',').map((e: string) => e.trim()) : [],
          emailSubject: getArg('subject'),
          emailBody: getArg('body'),
          enabled: !hasFlag('disabled')
        };

        if (!schedule.templateId) throw new Error('Template ID is required (--template)');
        if (!schedule.name) throw new Error('Name is required (--name)');

        const created = await skill.createSchedule(schedule);
        console.log(`\n✓ Schedule created: ${created.name}`);
        console.log(`  ID: ${created.id}`);
        console.log(`  Template: ${created.templateId}`);
        console.log(`  Period: ${created.period}`);
        console.log(`  Next Run: ${created.nextRunAt}`);
        console.log(`  Formats: ${created.formats.join(', ')}`);
        console.log(`  Recipients: ${created.emailRecipients.join(', ') || 'None'}`);
        break;
      }

      case 'schedule-list': {
        const schedules = await skill.listSchedules();
        console.log('\nScheduled Reports');
        console.log('=================');
        if (schedules.length === 0) {
          console.log('No schedules found.');
        } else {
          schedules.forEach(s => {
            const status = s.enabled ? '✓' : '✗';
            console.log(`\n[${status}] ${s.id}: ${s.name}`);
            console.log(`  Template: ${s.templateId}, Period: ${s.period}`);
            console.log(`  Next Run: ${s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : 'N/A'}`);
            console.log(`  Formats: ${s.formats.join(', ')}`);
          });
        }
        break;
      }

      case 'schedule-get': {
        const id = parseInt(args[1]);
        if (!id) throw new Error('Schedule ID required');
        
        const schedule = await skill.getSchedule(id);
        console.log(`\nSchedule: ${schedule.name}`);
        console.log('=========' + '='.repeat(schedule.name.length));
        console.log(`ID: ${schedule.id}`);
        console.log(`Template ID: ${schedule.templateId}`);
        console.log(`Period: ${schedule.period}`);
        console.log(`Day of Week: ${schedule.dayOfWeek ?? 'N/A'}`);
        console.log(`Day of Month: ${schedule.dayOfMonth ?? 'N/A'}`);
        console.log(`Time: ${schedule.timeOfDay}`);
        console.log(`Formats: ${schedule.formats.join(', ')}`);
        console.log(`Recipients: ${schedule.emailRecipients.join(', ') || 'None'}`);
        console.log(`Email Subject: ${schedule.emailSubject || 'N/A'}`);
        console.log(`Enabled: ${schedule.enabled}`);
        console.log(`Last Run: ${schedule.lastRunAt || 'Never'}`);
        console.log(`Next Run: ${schedule.nextRunAt || 'N/A'}`);
        break;
      }

      case 'schedule-update': {
        const id = parseInt(args[1]);
        if (!id) throw new Error('Schedule ID required');
        
        const updates: any = {};
        if (getArg('template')) updates.templateId = parseInt(getArg('template')!);
        if (getArg('name')) updates.name = getArg('name');
        if (getArg('period')) updates.period = getArg('period');
        if (getArg('day-of-week') !== undefined) updates.dayOfWeek = parseInt(getArg('day-of-week')!);
        if (getArg('day-of-month') !== undefined) updates.dayOfMonth = parseInt(getArg('day-of-month')!);
        if (getArg('time')) updates.timeOfDay = getArg('time');
        if (getArg('formats')) updates.formats = getArg('formats')!.split(',').map(f => f.trim());
        if (getArg('recipients')) updates.emailRecipients = getArg('recipients')!.split(',').map(e => e.trim());
        if (getArg('subject')) updates.emailSubject = getArg('subject');
        if (getArg('body')) updates.emailBody = getArg('body');
        
        const updated = await skill.updateSchedule(id, updates);
        console.log(`\n✓ Schedule updated: ${updated.name}`);
        console.log(`  Next Run: ${updated.nextRunAt}`);
        break;
      }

      case 'schedule-enable': {
        const id = parseInt(args[1]);
        if (!id) throw new Error('Schedule ID required');
        
        await skill.updateSchedule(id, { enabled: true });
        console.log(`\n✓ Schedule ${id} enabled`);
        break;
      }

      case 'schedule-disable': {
        const id = parseInt(args[1]);
        if (!id) throw new Error('Schedule ID required');
        
        await skill.updateSchedule(id, { enabled: false });
        console.log(`\n✓ Schedule ${id} disabled`);
        break;
      }

      case 'schedule-delete': {
        const id = parseInt(args[1]);
        if (!id) throw new Error('Schedule ID required');
        
        await skill.deleteSchedule(id);
        console.log(`\n✓ Schedule ${id} deleted`);
        break;
      }

      case 'generate': {
        const templateId = parseInt(args[1]);
        if (!templateId) throw new Error('Template ID required');
        
        const format = (getArg('format') || 'html') as ReportFormat;
        const output = getArg('output', 'o');
        
        console.log(`\nGenerating report for template ${templateId}...`);
        
        let content: string;
        switch (format) {
          case 'csv':
            content = await skill.generateCsvReport(templateId);
            break;
          case 'json':
            content = await skill.generateJsonReport(templateId);
            break;
          case 'html':
          case 'pdf':
          default:
            content = await skill.generateHtmlReport(templateId);
            break;
        }
        
        if (output) {
          const fs = require('fs');
          fs.writeFileSync(output, content);
          console.log(`✓ Report saved to: ${output}`);
        } else {
          console.log('\n--- Report Output ---\n');
          console.log(content);
        }
        
        const data = await skill.generateReportData(templateId);
        console.log(`\nRecords: ${data.summary.total}`);
        break;
      }

      case 'preview': {
        const templateId = parseInt(args[1]);
        if (!templateId) throw new Error('Template ID required');
        
        console.log(`\nPreviewing report for template ${templateId}...`);
        
        const data = await skill.generateReportData(templateId);
        console.log('\nData Preview:');
        console.log('=============');
        console.log(`Headers: ${data.headers.join(', ')}`);
        console.log(`Records: ${data.summary.total}`);
        
        if (data.summary.aggregated) {
          console.log('\nAggregated Values:');
          Object.entries(data.summary.aggregated).forEach(([k, v]) => {
            console.log(`  ${k}: ${v}`);
          });
        }
        
        console.log('\nFirst 5 rows:');
        data.rows.slice(0, 5).forEach((row, i) => {
          console.log(`  ${i + 1}. ${row.join(' | ')}`);
        });
        break;
      }

      case 'execute': {
        const scheduleId = parseInt(args[1]);
        if (!scheduleId) throw new Error('Schedule ID required');
        
        const dryRun = hasFlag('dry-run');
        
        console.log(`\n${dryRun ? 'Simulating' : 'Executing'} scheduled report ${scheduleId}...`);
        
        const results = await skill.executeReport(scheduleId, dryRun);
        
        results.forEach(r => {
          console.log(`\n${r.format.toUpperCase()}:`);
          console.log(`  Status: ${r.status}`);
          console.log(`  Records: ${r.recordCount}`);
          console.log(`  Size: ${r.fileSize} bytes`);
          if (r.filePath) console.log(`  File: ${r.filePath}`);
          if (r.emailedTo?.length) console.log(`  Emailed to: ${r.emailedTo.join(', ')}`);
          if (r.errorMessage) console.log(`  Error: ${r.errorMessage}`);
        });
        break;
      }

      case 'due': {
        const dryRun = hasFlag('dry-run');
        
        console.log(`\n${dryRun ? 'Checking' : 'Executing'} due reports...`);
        
        const results = await skill.checkAndExecuteDueReports(dryRun);
        
        if (results.length === 0) {
          console.log('No due reports found.');
        } else {
          console.log(`\nProcessed ${results.length} due reports`);
          results.forEach((reportResults, i) => {
            console.log(`\nReport ${i + 1}:`);
            reportResults.forEach(r => {
              console.log(`  ${r.format}: ${r.status} (${r.recordCount} records)`);
            });
          });
        }
        break;
      }

      case 'history': {
        const limit = parseInt(getArg('limit', 'l') || '20');
        const history = await skill.getReportHistory(limit);
        
        console.log('\nReport History');
        console.log('==============');
        
        if (history.length === 0) {
          console.log('No reports generated yet.');
        } else {
          history.forEach(h => {
            const date = new Date(h.generatedAt).toLocaleString();
            const status = h.status === 'success' ? '✓' : '✗';
            console.log(`\n${status} ${h.id}: Template ${h.templateId} (${h.format.toUpperCase()})`);
            console.log(`  Generated: ${date}`);
            console.log(`  Records: ${h.recordCount}, Size: ${h.fileSize} bytes`);
            if (h.emailedTo?.length) console.log(`  Emailed: ${h.emailedTo.join(', ')}`);
            if (h.errorMessage) console.log(`  Error: ${h.errorMessage}`);
          });
        }
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        
        console.log('\nReport Builder Statistics');
        console.log('=========================');
        console.log(`\nTemplates: ${stats.templates}`);
        console.log(`Schedules: ${stats.schedules.total} (${stats.schedules.enabled} enabled)`);
        console.log(`\nReport History:`);
        console.log(`  Total: ${stats.history.total}`);
        console.log(`  Last 7 days: ${stats.history.last7Days}`);
        console.log(`  Last 30 days: ${stats.history.last30Days}`);
        console.log(`\nFormats Generated:`);
        Object.entries(stats.formats).forEach(([format, count]) => {
          console.log(`  ${format.toUpperCase()}: ${count}`);
        });
        break;
      }

      default:
        if (command) {
          console.error(`Unknown command: ${command}`);
        }
        printHelp();
        process.exit(1);
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
