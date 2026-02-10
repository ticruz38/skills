#!/usr/bin/env node
/**
 * Monthly Reports CLI
 * Command-line interface for monthly expense reports
 */

import { MonthlyReportsSkill, MonthlyReport } from './index';

const args = process.argv.slice(2);
const command = args[0];

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function printHelp(): void {
  console.log(`
${colors.bright}Monthly Reports CLI${colors.reset}

Generate monthly expense summaries with spending breakdown, trends, and budget comparison.

${colors.bright}Usage:${colors.reset}
  monthly-reports <command> [options]

${colors.bright}Commands:${colors.reset}
  generate [year] [month]     Generate report for specified month (default: current month)
  current                     Generate report for current month
  last                        Generate report for last month
  list [limit]                List report history (default: 12 months)
  get [year] [month]          Get previously generated report for month
  budget [year] [month]       Set budget for a month
  budget-view [year] [month]  View budget for a month
  stats                       Show statistics
  health                      Check system health
  export [year] [month]       Export report to HTML file
  chart [year] [month]        Display ASCII chart of spending by category
  trend [months]              Show spending trend over last N months
  help                        Show this help message

${colors.bright}Examples:${colors.reset}
  monthly-reports generate 2024 1
  monthly-reports current
  monthly-reports budget 2024 2 --total 5000 --category Groceries=800 --category Dining=400
  monthly-reports list 6
  monthly-reports export 2024 1 --output ~/reports/jan-2024.html
`);
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function printReport(report: MonthlyReport): void {
  console.log(`\n${colors.bright}${colors.cyan}📊 Monthly Expense Report - ${report.monthName} ${report.year}${colors.reset}\n`);
  
  // Summary
  console.log(`${colors.bright}Summary:${colors.reset}`);
  console.log(`  Total Spending:    ${colors.bright}${formatCurrency(report.summary.totalSpending)}${colors.reset}`);
  console.log(`  Transactions:      ${report.summary.transactionCount}`);
  console.log(`  Avg Transaction:   ${formatCurrency(report.summary.averageTransaction)}`);
  console.log(`  Top Category:      ${colors.bright}${report.summary.topCategory}${colors.reset} (${formatCurrency(report.summary.topCategoryAmount)})`);
  
  // Trends
  console.log(`\n${colors.bright}Trends:${colors.reset}`);
  const vsPrev = report.trends.vsPreviousMonth;
  const trendColor = vsPrev.direction === 'decrease' ? colors.green : vsPrev.direction === 'increase' ? colors.red : colors.gray;
  const trendIcon = vsPrev.direction === 'decrease' ? '↓' : vsPrev.direction === 'increase' ? '↑' : '→';
  console.log(`  vs Previous Month: ${trendColor}${trendIcon} ${formatCurrency(Math.abs(vsPrev.amountChange))} (${formatPercentage(vsPrev.percentageChange)})${colors.reset}`);
  
  if (report.trends.vsSameMonthLastYear) {
    const vsYoy = report.trends.vsSameMonthLastYear;
    const yoyColor = vsYoy.direction === 'decrease' ? colors.green : vsYoy.direction === 'increase' ? colors.red : colors.gray;
    const yoyIcon = vsYoy.direction === 'decrease' ? '↓' : vsYoy.direction === 'increase' ? '↑' : '→';
    console.log(`  vs Last Year:      ${yoyColor}${yoyIcon} ${formatCurrency(Math.abs(vsYoy.amountChange))} (${formatPercentage(vsYoy.percentageChange)})${colors.reset}`);
  }
  console.log(`  Daily Average:     ${formatCurrency(report.trends.dailyAverage)}`);
  
  // Spending by Category
  console.log(`\n${colors.bright}Spending by Category:${colors.reset}`);
  const skill = new MonthlyReportsSkill();
  const chart = skill.generateAsciiChart(report.spendingByCategory);
  console.log(chart);
  
  // Budget Comparison
  if (report.budgetComparison) {
    console.log(`\n${colors.bright}Budget Comparison:${colors.reset}`);
    const bc = report.budgetComparison;
    const statusColor = bc.status === 'under' ? colors.green : bc.status === 'over' ? colors.red : colors.yellow;
    const statusText = bc.status === 'under' ? '✓ Under Budget' : bc.status === 'over' ? '✗ Over Budget' : '● On Track';
    console.log(`  Budget:   ${formatCurrency(bc.budgetAmount)}`);
    console.log(`  Actual:   ${formatCurrency(bc.actualAmount)}`);
    console.log(`  Variance: ${formatCurrency(bc.variance)} (${bc.variancePercentage.toFixed(1)}%)`);
    console.log(`  Status:   ${statusColor}${statusText}${colors.reset}`);
  }
  
  // Insights
  if (report.insights.length > 0) {
    console.log(`\n${colors.bright}Insights:${colors.reset}`);
    report.insights.forEach(insight => {
      console.log(`  • ${insight}`);
    });
  }
  
  console.log(`\n${colors.gray}Generated: ${new Date(report.generatedAt).toLocaleString()}${colors.reset}\n`);
}

async function main(): Promise<void> {
  const skill = new MonthlyReportsSkill();

  try {
    switch (command) {
      case 'generate': {
        const now = new Date();
        const year = parseInt(args[1]) || now.getFullYear();
        const month = parseInt(args[2]) || now.getMonth() + 1;
        
        console.log(`Generating report for ${year}-${String(month).padStart(2, '0')}...`);
        const report = await skill.generateReport(year, month);
        printReport(report);
        break;
      }

      case 'current': {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        
        console.log(`Generating report for current month (${year}-${String(month).padStart(2, '0')})...`);
        const report = await skill.generateReport(year, month);
        printReport(report);
        break;
      }

      case 'last': {
        const now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth();
        if (month === 0) {
          month = 12;
          year--;
        }
        
        console.log(`Generating report for last month (${year}-${String(month).padStart(2, '0')})...`);
        const report = await skill.generateReport(year, month);
        printReport(report);
        break;
      }

      case 'list': {
        const limit = parseInt(args[1]) || 12;
        const history = await skill.getReportHistory(limit);
        
        console.log(`\n${colors.bright}Report History (last ${history.length} reports):${colors.reset}\n`);
        console.log(`${'Year'.padEnd(6)} ${'Month'.padEnd(10)} ${'Spending'.padStart(12)} ${'Transactions'.padStart(12)} ${'Top Category'.padStart(15)}`);
        console.log('-'.repeat(70));
        
        history.forEach(report => {
          console.log(
            `${report.year.toString().padEnd(6)} ` +
            `${report.monthName.padEnd(10)} ` +
            `${formatCurrency(report.summary.totalSpending).padStart(12)} ` +
            `${report.summary.transactionCount.toString().padStart(12)} ` +
            `${report.summary.topCategory.padStart(15)}`
          );
        });
        console.log();
        break;
      }

      case 'get': {
        const year = parseInt(args[1]);
        const month = parseInt(args[2]);
        
        if (!year || !month) {
          console.error('Usage: monthly-reports get <year> <month>');
          process.exit(1);
        }
        
        const report = await skill.getReport(year, month);
        if (report) {
          printReport(report);
        } else {
          console.log(`No report found for ${year}-${String(month).padStart(2, '0')}. Generate one with: monthly-reports generate ${year} ${month}`);
        }
        break;
      }

      case 'budget': {
        const year = parseInt(args[1]);
        const month = parseInt(args[2]);
        
        if (!year || !month) {
          console.error('Usage: monthly-reports budget <year> <month> --total <amount> [--category <name>=<amount>...]');
          process.exit(1);
        }
        
        // Parse options
        let totalBudget = 0;
        const categoryBudgets: Record<string, number> = {};
        
        for (let i = 3; i < args.length; i++) {
          if (args[i] === '--total' && args[i + 1]) {
            totalBudget = parseFloat(args[i + 1]);
            i++;
          } else if (args[i] === '--category' && args[i + 1]) {
            const parts = args[i + 1].split('=');
            if (parts.length === 2) {
              categoryBudgets[parts[0]] = parseFloat(parts[1]);
            }
            i++;
          }
        }
        
        if (totalBudget <= 0) {
          console.error('Please provide a valid total budget amount with --total <amount>');
          process.exit(1);
        }
        
        const budget = await skill.setBudget(year, month, totalBudget, categoryBudgets);
        console.log(`\n${colors.green}✓ Budget set for ${year}-${String(month).padStart(2, '0')}${colors.reset}`);
        console.log(`  Total: ${formatCurrency(budget.totalBudget)}`);
        if (Object.keys(budget.categoryBudgets).length > 0) {
          console.log(`  Category Budgets:`);
          Object.entries(budget.categoryBudgets).forEach(([cat, amount]) => {
            console.log(`    ${cat}: ${formatCurrency(amount)}`);
          });
        }
        console.log();
        break;
      }

      case 'budget-view': {
        const year = parseInt(args[1]) || new Date().getFullYear();
        const month = parseInt(args[2]) || new Date().getMonth() + 1;
        
        const budget = await skill.getBudget(year, month);
        if (budget) {
          console.log(`\n${colors.bright}Budget for ${year}-${String(month).padStart(2, '0')}:${colors.reset}`);
          console.log(`  Total: ${formatCurrency(budget.totalBudget)}`);
          if (Object.keys(budget.categoryBudgets).length > 0) {
            console.log(`  Category Budgets:`);
            Object.entries(budget.categoryBudgets).forEach(([cat, amount]) => {
              console.log(`    ${cat}: ${formatCurrency(amount)}`);
            });
          }
          console.log();
        } else {
          console.log(`No budget set for ${year}-${String(month).padStart(2, '0')}`);
        }
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        console.log(`\n${colors.bright}Monthly Reports Statistics:${colors.reset}\n`);
        console.log(`  Total Reports Generated: ${stats.totalReports}`);
        console.log(`  Total Budgets Set:       ${stats.totalBudgets}`);
        if (stats.earliestReport) {
          console.log(`  Earliest Report:         ${new Date(stats.earliestReport).toLocaleString()}`);
        }
        if (stats.latestReport) {
          console.log(`  Latest Report:           ${new Date(stats.latestReport).toLocaleString()}`);
        }
        console.log();
        break;
      }

      case 'health': {
        const health = await skill.healthCheck();
        console.log(`\n${colors.bright}System Health:${colors.reset}\n`);
        console.log(`  Status: ${health.status === 'healthy' ? colors.green + '✓ Healthy' : colors.red + '✗ Unhealthy'}${colors.reset}`);
        console.log(`  Expense Categorizer: ${health.categorizer.connected ? colors.green + '✓ Connected' : colors.red + '✗ Disconnected'}${colors.reset}`);
        if (health.categorizer.message) {
          console.log(`    ${colors.gray}${health.categorizer.message}${colors.reset}`);
        }
        console.log();
        break;
      }

      case 'export': {
        const year = parseInt(args[1]);
        const month = parseInt(args[2]);
        
        if (!year || !month) {
          console.error('Usage: monthly-reports export <year> <month> [--output <path>]');
          process.exit(1);
        }
        
        let outputPath: string | undefined;
        const outputIndex = args.indexOf('--output');
        if (outputIndex !== -1 && args[outputIndex + 1]) {
          outputPath = args[outputIndex + 1];
        }
        
        // Generate or get existing report
        let report = await skill.getReport(year, month);
        if (!report) {
          console.log('Generating new report...');
          report = await skill.generateReport(year, month);
        }
        
        const savedPath = await skill.saveReportToFile(report, outputPath);
        console.log(`\n${colors.green}✓ Report exported to:${colors.reset} ${savedPath}\n`);
        break;
      }

      case 'chart': {
        const year = parseInt(args[1]);
        const month = parseInt(args[2]);
        
        if (!year || !month) {
          console.error('Usage: monthly-reports chart <year> <month>');
          process.exit(1);
        }
        
        let report = await skill.getReport(year, month);
        if (!report) {
          report = await skill.generateReport(year, month);
        }
        
        console.log(`\n${colors.bright}Spending by Category - ${report.monthName} ${report.year}${colors.reset}\n`);
        console.log(skill.generateAsciiChart(report.spendingByCategory));
        console.log();
        break;
      }

      case 'trend': {
        const months = parseInt(args[1]) || 6;
        const history = await skill.getReportHistory(months);
        
        if (history.length < 2) {
          console.log('Not enough historical data for trend analysis. Generate more reports first.');
          break;
        }
        
        const trendData = history
          .sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year)
          .map(r => ({
            month: `${r.monthName.substring(0, 3)} ${r.year}`,
            amount: r.summary.totalSpending,
          }));
        
        console.log(`\n${colors.bright}Spending Trend - Last ${trendData.length} Months${colors.reset}\n`);
        console.log(skill.generateTrendChart(trendData));
        console.log();
        break;
      }

      case 'help':
      case '--help':
      case '-h':
      default:
        printHelp();
        break;
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
