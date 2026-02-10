# Monthly Reports

Generate monthly expense summaries with spending breakdown, trend analysis, budget comparison, and visual charts.

## Dependencies

- `expense-categorizer` - For categorized expense data
- `receipts-ocr` - For receipt information

## Capabilities

### Core Features

- **Monthly Expense Reports**: Generate comprehensive reports for any month
- **Spending Breakdown**: View expenses categorized with percentages
- **Trend Analysis**: Compare month-over-month and year-over-year spending
- **Budget Tracking**: Set budgets and compare against actual spending
- **Visual Charts**: ASCII charts for terminal viewing, HTML export for sharing
- **Insights**: Automated insights and observations about spending patterns

### Report Data

Each monthly report includes:
- Total spending and transaction count
- Average transaction amount
- Top spending category
- Spending breakdown by category with trends
- Month-over-month comparison
- Year-over-year comparison (if available)
- Daily average spending
- Budget variance analysis
- Personalized insights

### Budget Management

- Set total monthly budget
- Configure category-specific budgets
- Track budget vs actual spending
- Visual indicators for over/under budget status

## Usage

### CLI Commands

```bash
# Generate report for current month
monthly-reports current

# Generate report for specific month
monthly-reports generate 2024 1

# Generate report for last month
monthly-reports last

# List report history
monthly-reports list 12

# View a specific report
monthly-reports get 2024 1

# Set budget for a month
monthly-reports budget 2024 2 --total 5000 --category Groceries=800 --category Dining=400

# View budget
monthly-reports budget-view 2024 2

# Export to HTML
monthly-reports export 2024 1 --output ~/reports/january.html

# Display ASCII chart
monthly-reports chart 2024 1

# Show spending trend
monthly-reports trend 6

# System health check
monthly-reports health

# Statistics
monthly-reports stats
```

### Library Usage

```typescript
import { MonthlyReportsSkill } from '@openclaw/monthly-reports';

const skill = new MonthlyReportsSkill();

// Generate a monthly report
const report = await skill.generateReport(2024, 1);

// Access report data
console.log(`Total spending: $${report.summary.totalSpending}`);
console.log(`Top category: ${report.summary.topCategory}`);

// View spending by category
report.spendingByCategory.forEach(cat => {
  console.log(`${cat.category}: $${cat.amount} (${cat.percentage}%)`);
});

// Check trends
console.log(`vs last month: ${report.trends.vsPreviousMonth.percentageChange}%`);

// Set a budget
await skill.setBudget(2024, 2, 5000, {
  'Groceries': 800,
  'Dining': 400,
  'Entertainment': 200
});

// Generate and save HTML report
const html = skill.exportToHTML(report);
await skill.saveReportToFile(report, './report.html');

// Close connections
await skill.close();
```

### Generating ASCII Charts

```typescript
// Category spending chart
const chart = skill.generateAsciiChart(report.spendingByCategory);
console.log(chart);

// Trend chart over multiple months
const history = await skill.getReportHistory(6);
const trendData = history.map(r => ({
  month: r.monthName,
  amount: r.summary.totalSpending
}));
const trendChart = skill.generateTrendChart(trendData);
console.log(trendChart);
```

## Data Storage

All data is stored locally in SQLite:
- `~/.openclaw/skills/monthly-reports/monthly-reports.db`
- `~/.openclaw/skills/monthly-reports/reports/` - HTML exports

### Database Schema

**budgets table**
- `year`, `month` - Budget period
- `total_budget` - Total budget amount
- `category_budgets` - JSON object of category budgets

**report_history table**
- `year`, `month` - Report period
- `total_spending`, `transaction_count` - Summary stats
- `report_data` - Full report JSON
- Historical trend data

## Report Structure

```typescript
interface MonthlyReport {
  year: number;
  month: number;
  monthName: string;
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
    vsPreviousMonth: { amountChange, percentageChange, direction };
    vsSameMonthLastYear?: { amountChange, percentageChange, direction };
    dailyAverage: number;
  };
  budgetComparison?: {
    budgetAmount: number;
    actualAmount: number;
    variance: number;
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
```

## Insights

Reports automatically generate insights such as:
- Spending changes vs previous month
- Top category analysis
- Budget status and variance
- Category distribution patterns
- Trends in spending behavior

## HTML Export

Reports can be exported as styled HTML documents with:
- Professional layout and styling
- Summary cards
- Data tables
- Budget comparison visualization
- Insights section
- Print-friendly formatting
