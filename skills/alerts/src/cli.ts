#!/usr/bin/env node
/**
 * Alerts Skill CLI
 * Command-line interface for managing price alerts
 */

import { AlertsSkill, ThresholdAlert, PercentageAlert, AlertHistory, Timeframe, NotificationChannel } from './index.js';

interface CliOptions {
  [key: string]: string | boolean | number | undefined;
}

function parseArgs(): { command: string; options: CliOptions } {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const options: CliOptions = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-/g, '');
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  return { command, options };
}

function printHelp(): void {
  console.log(`
Alerts Skill CLI - Monitor prices and send notifications

Usage: npm run cli <command> [options]

Commands:
  check                      Check all alerts and send notifications
  list                       List all configured alerts
  add-threshold             Add a price threshold alert
    --symbol <symbol>        Trading pair (e.g., BTCUSDT)
    --above <price>          Trigger when price goes above this
    --below <price>          Trigger when price goes below this
    --message <text>         Custom alert message (optional)
    --channels <list>        Comma-separated: console,slack (default: console)
  
  add-percent               Add a percentage change alert
    --symbol <symbol>        Trading pair (e.g., ETHUSDT)
    --percent <number>       Percentage change to trigger
    --direction <dir>        up, down, or both (default: both)
    --timeframe <tf>         1m, 5m, 15m, 1h, 4h, 1d (default: 1h)
    --message <text>         Custom alert message (optional)
    --channels <list>        Comma-separated: console,slack (default: console)
  
  enable                    Enable an alert
    --type <type>            threshold or percentage
    --id <id>                Alert ID
  
  disable                   Disable (pause) an alert
    --type <type>            threshold or percentage
    --id <id>                Alert ID
  
  delete                    Delete an alert
    --type <type>            threshold or percentage
    --id <id>                Alert ID
  
  history                   Show alert history
    --limit <n>              Number of records (default: 20)
    --symbol <symbol>        Filter by symbol
  
  stats                     Show alert statistics
  health                    Check health of dependencies
  help                      Show this help message

Examples:
  npm run cli check
  npm run cli add-threshold -- --symbol BTCUSDT --above 50000
  npm run cli add-percent -- --symbol ETHUSDT --percent 5 --timeframe 1h
  npm run cli list
  npm run cli history -- --limit 10
`);
}

async function handleCheck(skill: AlertsSkill): Promise<void> {
  console.log('Checking all alerts...\n');
  
  const results = await skill.checkAlerts();
  
  let triggeredCount = 0;
  
  for (const result of results.threshold) {
    if (result.triggered) {
      triggeredCount++;
      console.log(`✓ Threshold Alert #${result.alertId} triggered for ${result.symbol}`);
      console.log(`  Price: ${result.price} | ${result.message}`);
      for (const notif of result.notifications) {
        const status = notif.success ? '✓' : '✗';
        console.log(`  ${status} ${notif.channel}: ${notif.message || 'sent'}`);
      }
      console.log();
    }
  }
  
  for (const result of results.percentage) {
    if (result.triggered) {
      triggeredCount++;
      console.log(`✓ Percentage Alert #${result.alertId} triggered for ${result.symbol}`);
      console.log(`  Price: ${result.price} | ${result.message}`);
      for (const notif of result.notifications) {
        const status = notif.success ? '✓' : '✗';
        console.log(`  ${status} ${notif.channel}: ${notif.message || 'sent'}`);
      }
      console.log();
    }
  }
  
  if (triggeredCount === 0) {
    console.log('No alerts triggered.');
  } else {
    console.log(`\nTotal alerts triggered: ${triggeredCount}`);
  }
}

async function handleList(skill: AlertsSkill): Promise<void> {
  const alerts = await skill.getAllAlerts();
  
  console.log('=== Threshold Alerts ===\n');
  if (alerts.threshold.length === 0) {
    console.log('No threshold alerts configured.\n');
  } else {
    for (const alert of alerts.threshold) {
      const status = alert.status === 'active' ? '●' : '○';
      console.log(`${status} #${alert.id} ${alert.symbol}`);
      console.log(`  Condition: ${alert.condition} ${alert.price}`);
      console.log(`  Message: ${alert.message}`);
      console.log(`  Channels: ${alert.channels.join(', ')}`);
      console.log(`  Status: ${alert.status} | Triggers: ${alert.triggerCount}`);
      if (alert.lastTriggeredAt) {
        console.log(`  Last triggered: ${alert.lastTriggeredAt}`);
      }
      console.log();
    }
  }
  
  console.log('=== Percentage Alerts ===\n');
  if (alerts.percentage.length === 0) {
    console.log('No percentage alerts configured.\n');
  } else {
    for (const alert of alerts.percentage) {
      const status = alert.status === 'active' ? '●' : '○';
      console.log(`${status} #${alert.id} ${alert.symbol}`);
      console.log(`  Change: ${alert.direction === 'both' ? '±' : alert.direction === 'up' ? '+' : '-'}${alert.percentChange}%`);
      console.log(`  Timeframe: ${alert.timeframe}`);
      console.log(`  Message: ${alert.message}`);
      console.log(`  Channels: ${alert.channels.join(', ')}`);
      console.log(`  Status: ${alert.status} | Triggers: ${alert.triggerCount}`);
      if (alert.lastTriggeredAt) {
        console.log(`  Last triggered: ${alert.lastTriggeredAt}`);
      }
      if (alert.lastPrice) {
        console.log(`  Last price: ${alert.lastPrice} (${alert.lastPriceAt})`);
      }
      console.log();
    }
  }
}

async function handleAddThreshold(skill: AlertsSkill, options: CliOptions): Promise<void> {
  const symbol = options.symbol as string;
  const above = options.above ? parseFloat(options.above as string) : undefined;
  const below = options.below ? parseFloat(options.below as string) : undefined;
  const message = options.message as string | undefined;
  const channels = options.channels ? (options.channels as string).split(',') as NotificationChannel[] : undefined;
  
  if (!symbol) {
    console.error('Error: --symbol is required');
    process.exit(1);
  }
  
  if (!above && !below) {
    console.error('Error: Either --above or --below is required');
    process.exit(1);
  }
  
  const alert = await skill.addThresholdAlert({
    symbol,
    above,
    below,
    message,
    channels,
  });
  
  console.log(`✓ Created threshold alert #${alert.id}`);
  console.log(`  Symbol: ${alert.symbol}`);
  console.log(`  Condition: ${alert.condition} ${alert.price}`);
  console.log(`  Channels: ${alert.channels.join(', ')}`);
}

async function handleAddPercent(skill: AlertsSkill, options: CliOptions): Promise<void> {
  const symbol = options.symbol as string;
  const percentChange = options.percent ? parseFloat(options.percent as string) : undefined;
  const direction = options.direction as 'up' | 'down' | 'both' | undefined;
  const timeframe = options.timeframe as Timeframe | undefined;
  const message = options.message as string | undefined;
  const channels = options.channels ? (options.channels as string).split(',') as NotificationChannel[] : undefined;
  
  if (!symbol) {
    console.error('Error: --symbol is required');
    process.exit(1);
  }
  
  if (!percentChange) {
    console.error('Error: --percent is required');
    process.exit(1);
  }
  
  const alert = await skill.addPercentageAlert({
    symbol,
    percentChange,
    direction,
    timeframe,
    message,
    channels,
  });
  
  console.log(`✓ Created percentage alert #${alert.id}`);
  console.log(`  Symbol: ${alert.symbol}`);
  console.log(`  Change: ${alert.direction === 'both' ? '±' : alert.direction === 'up' ? '+' : '-'}${alert.percentChange}%`);
  console.log(`  Timeframe: ${alert.timeframe}`);
  console.log(`  Channels: ${alert.channels.join(', ')}`);
}

async function handleEnable(skill: AlertsSkill, options: CliOptions): Promise<void> {
  const type = options.type as 'threshold' | 'percentage' | undefined;
  const id = options.id ? parseInt(options.id as string, 10) : undefined;
  
  if (!type || !id) {
    console.error('Error: --type and --id are required');
    process.exit(1);
  }
  
  await skill.enableAlert(type, id);
  console.log(`✓ Enabled ${type} alert #${id}`);
}

async function handleDisable(skill: AlertsSkill, options: CliOptions): Promise<void> {
  const type = options.type as 'threshold' | 'percentage' | undefined;
  const id = options.id ? parseInt(options.id as string, 10) : undefined;
  
  if (!type || !id) {
    console.error('Error: --type and --id are required');
    process.exit(1);
  }
  
  await skill.disableAlert(type, id);
  console.log(`✓ Disabled ${type} alert #${id}`);
}

async function handleDelete(skill: AlertsSkill, options: CliOptions): Promise<void> {
  const type = options.type as 'threshold' | 'percentage' | undefined;
  const id = options.id ? parseInt(options.id as string, 10) : undefined;
  
  if (!type || !id) {
    console.error('Error: --type and --id are required');
    process.exit(1);
  }
  
  await skill.deleteAlert(type, id);
  console.log(`✓ Deleted ${type} alert #${id}`);
}

async function handleHistory(skill: AlertsSkill, options: CliOptions): Promise<void> {
  const limit = options.limit ? parseInt(options.limit as string, 10) : 20;
  const symbol = options.symbol as string | undefined;
  
  const history = await skill.getAlertHistory({ limit, symbol });
  
  if (history.length === 0) {
    console.log('No alert history found.');
    return;
  }
  
  console.log(`=== Alert History (${history.length} records) ===\n`);
  
  for (const record of history) {
    console.log(`#${record.id} ${record.symbol} (${record.alertType})`);
    console.log(`  Trigger: ${record.triggerCondition} at ${record.triggerPrice}`);
    console.log(`  Message: ${record.message}`);
    console.log(`  Channels: ${JSON.parse(record.channels).join(', ')}`);
    console.log(`  Sent: ${record.sentAt}`);
    console.log();
  }
}

async function handleStats(skill: AlertsSkill): Promise<void> {
  const stats = await skill.getStats();
  
  console.log('=== Alert Statistics ===\n');
  console.log(`Total Alerts: ${stats.totalAlerts}`);
  console.log(`  - Active: ${stats.activeAlerts}`);
  console.log(`  - Threshold: ${stats.thresholdAlerts}`);
  console.log(`  - Percentage: ${stats.percentageAlerts}`);
  console.log(`\nTotal Triggers: ${stats.totalTriggers}`);
}

async function handleHealth(skill: AlertsSkill): Promise<void> {
  const health = await skill.healthCheck();
  
  console.log('=== Health Check ===\n');
  console.log(`Status: ${health.status.toUpperCase()}`);
  console.log(`Message: ${health.message}\n`);
  
  if (health.binance) {
    const status = health.binance.connected ? '✓' : '✗';
    console.log(`${status} Binance: ${health.binance.message}`);
  }
  
  if (health.slack) {
    const status = health.slack.connected ? '✓' : '✗';
    console.log(`${status} Slack: ${health.slack.message}`);
  }
}

async function main(): Promise<void> {
  const { command, options } = parseArgs();
  
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }
  
  const skill = new AlertsSkill();
  
  try {
    switch (command) {
      case 'check':
        await handleCheck(skill);
        break;
      case 'list':
        await handleList(skill);
        break;
      case 'add-threshold':
        await handleAddThreshold(skill, options);
        break;
      case 'add-percent':
        await handleAddPercent(skill, options);
        break;
      case 'enable':
        await handleEnable(skill, options);
        break;
      case 'disable':
        await handleDisable(skill, options);
        break;
      case 'delete':
        await handleDelete(skill, options);
        break;
      case 'history':
        await handleHistory(skill, options);
        break;
      case 'stats':
        await handleStats(skill);
        break;
      case 'health':
        await handleHealth(skill);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
