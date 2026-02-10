#!/usr/bin/env node

/**
 * Chart Generator CLI
 * Command-line interface for generating charts and visualizations
 */

import { ChartGeneratorSkill, ChartConfig, DataPoint, ChartType, Theme } from './index';
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const command = args[0];

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Chart Generator CLI

Usage:
  chart-generator <command> [options]

Commands:
  generate <type>          Generate a chart from JSON data
    --data <file>          JSON file with data points
    --output <file>        Output file path (.svg)
    --title <title>        Chart title
    --width <pixels>       Chart width (default: 800)
    --height <pixels>      Chart height (default: 600)
    --theme <theme>        Color theme: light, dark, colorful (default: light)
    --x-label <label>      X-axis label
    --y-label <label>      Y-axis label
    --no-legend            Hide legend
    --no-grid              Hide grid lines

  from-connection <id>     Generate chart from data connector connection
    --label-column <col>   Column name for labels
    --value-column <col>   Column name for values
    --type <type>          Chart type: bar, line, pie, doughnut, area
    --output <file>        Output file path
    [other options as above]

  template                 Template management
    save <name>            Save current config as template
    list                   List all templates
    get <name>             Get template details
    delete <name>          Delete a template
    generate <name>        Generate chart from template

  stats                    Show statistics
  health                   Health check
  help                     Show this help

Chart Types:
  bar        Bar chart (supports multiple series)
  line       Line chart (supports multiple series)
  pie        Pie chart
  doughnut   Doughnut chart
  area       Area chart (stacked)

Examples:
  chart-generator generate bar --data sales.json --output chart.svg --title "Sales Report"
  chart-generator from-connection 1 --label-column "Month" --value-column "Revenue" --type line --output revenue.svg
  chart-generator template list
`);
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): Record<string, string | boolean> {
  const options: Record<string, string | boolean> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '').replace(/-/g, '');
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    }
  }
  
  return options;
}

/**
 * Generate chart from JSON data file
 */
async function generateChart(args: string[]) {
  const options = parseArgs(args.slice(1));
  const type = args[0] as ChartType;
  
  if (!type) {
    console.error('Error: Chart type required (bar, line, pie, doughnut, area)');
    process.exit(1);
  }

  const validTypes: ChartType[] = ['bar', 'line', 'pie', 'doughnut', 'area'];
  if (!validTypes.includes(type)) {
    console.error(`Error: Invalid chart type '${type}'`);
    process.exit(1);
  }

  const dataFile = options.data as string;
  if (!dataFile) {
    console.error('Error: --data <file> required');
    process.exit(1);
  }

  if (!fs.existsSync(dataFile)) {
    console.error(`Error: Data file not found: ${dataFile}`);
    process.exit(1);
  }

  const data: DataPoint[] = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  
  const config: ChartConfig = {
    type,
    title: options.title as string,
    width: parseInt(options.width as string) || 800,
    height: parseInt(options.height as string) || 600,
    theme: (options.theme as Theme) || 'light',
    xAxisLabel: options.xlabel as string,
    yAxisLabel: options.ylabel as string,
    showLegend: options.nolegend !== true,
    showGrid: options.nogrid !== true
  };

  const skill = new ChartGeneratorSkill();
  
  try {
    const result = skill.generateChart(data, config);
    
    const outputFile = options.output as string || `chart-${Date.now()}.svg`;
    skill.saveChart(result, outputFile);
    
    console.log(`Chart generated: ${outputFile}`);
    console.log(`  Type: ${type}`);
    console.log(`  Size: ${config.width}x${config.height}`);
    console.log(`  Theme: ${config.theme}`);
  } finally {
    await skill.close();
  }
}

/**
 * Generate chart from data connection
 */
async function generateFromConnection(args: string[]) {
  const options = parseArgs(args);
  const connectionId = parseInt(args[0]);
  
  if (isNaN(connectionId)) {
    console.error('Error: Connection ID required');
    process.exit(1);
  }

  const labelColumn = options.labelcolumn as string;
  const valueColumn = options.valuecolumn as string;
  
  if (!labelColumn || !valueColumn) {
    console.error('Error: --label-column and --value-column required');
    process.exit(1);
  }

  const type = (options.type as ChartType) || 'bar';
  const validTypes: ChartType[] = ['bar', 'line', 'pie', 'doughnut', 'area'];
  if (!validTypes.includes(type)) {
    console.error(`Error: Invalid chart type '${type}'`);
    process.exit(1);
  }

  const config: ChartConfig = {
    type,
    title: options.title as string,
    width: parseInt(options.width as string) || 800,
    height: parseInt(options.height as string) || 600,
    theme: (options.theme as Theme) || 'light',
    xAxisLabel: options.xlabel as string,
    yAxisLabel: options.ylabel as string,
    showLegend: options.nolegend !== true,
    showGrid: options.nogrid !== true
  };

  const skill = new ChartGeneratorSkill();
  
  try {
    const result = await skill.generateFromConnection(connectionId, labelColumn, valueColumn, config);
    
    const outputFile = options.output as string || `chart-${Date.now()}.svg`;
    skill.saveChart(result, outputFile);
    
    console.log(`Chart generated from connection ${connectionId}: ${outputFile}`);
    console.log(`  Type: ${type}`);
    console.log(`  Label column: ${labelColumn}`);
    console.log(`  Value column: ${valueColumn}`);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

/**
 * Template management commands
 */
async function templateCommand(subcommand: string, args: string[]) {
  const skill = new ChartGeneratorSkill();
  const options = parseArgs(args);
  
  try {
    switch (subcommand) {
      case 'save': {
        const name = args[0];
        if (!name) {
          console.error('Error: Template name required');
          process.exit(1);
        }

        const type = (options.type as ChartType) || 'bar';
        const config: ChartConfig = {
          type,
          title: options.title as string,
          width: parseInt(options.width as string) || 800,
          height: parseInt(options.height as string) || 600,
          theme: (options.theme as Theme) || 'light',
          xAxisLabel: options.xlabel as string,
          yAxisLabel: options.ylabel as string,
          showLegend: options.nolegend !== true,
          showGrid: options.nogrid !== true
        };

        const dataSource = options.connectionid ? {
          connectionId: parseInt(options.connectionid as string),
          labelColumn: options.labelcolumn as string,
          valueColumn: options.valuecolumn as string
        } : undefined;

        await skill.saveTemplate({
          name,
          type,
          config,
          dataSource
        });

        console.log(`Template saved: ${name}`);
        break;
      }

      case 'list': {
        const templates = await skill.listTemplates();
        if (templates.length === 0) {
          console.log('No templates found');
        } else {
          console.log('Templates:');
          templates.forEach(t => {
            const ds = t.dataSource ? ' (with data source)' : '';
            console.log(`  - ${t.name} (${t.type})${ds}`);
          });
        }
        break;
      }

      case 'get': {
        const name = args[0];
        if (!name) {
          console.error('Error: Template name required');
          process.exit(1);
        }

        const template = await skill.getTemplate(name);
        if (!template) {
          console.error(`Template not found: ${name}`);
          process.exit(1);
        }

        console.log(`Template: ${template.name}`);
        console.log(`  Type: ${template.type}`);
        console.log(`  Title: ${template.config.title || '(none)'}`);
        console.log(`  Size: ${template.config.width}x${template.config.height}`);
        console.log(`  Theme: ${template.config.theme}`);
        if (template.dataSource) {
          console.log(`  Data Source:`);
          console.log(`    Connection ID: ${template.dataSource.connectionId}`);
          console.log(`    Label Column: ${template.dataSource.labelColumn}`);
          console.log(`    Value Column: ${template.dataSource.valueColumn}`);
        }
        break;
      }

      case 'delete': {
        const name = args[0];
        if (!name) {
          console.error('Error: Template name required');
          process.exit(1);
        }

        const deleted = await skill.deleteTemplate(name);
        if (deleted) {
          console.log(`Template deleted: ${name}`);
        } else {
          console.error(`Template not found: ${name}`);
          process.exit(1);
        }
        break;
      }

      case 'generate': {
        const name = args[0];
        if (!name) {
          console.error('Error: Template name required');
          process.exit(1);
        }

        const outputFile = options.output as string || `chart-${Date.now()}.svg`;
        const result = await skill.generateFromTemplate(name);
        skill.saveChart(result, outputFile);

        console.log(`Chart generated from template '${name}': ${outputFile}`);
        break;
      }

      default:
        console.log('Template commands: save, list, get, delete, generate');
    }
  } finally {
    await skill.close();
  }
}

/**
 * Show statistics
 */
async function showStats() {
  const skill = new ChartGeneratorSkill();
  
  try {
    const stats = await skill.getStats();
    console.log('Chart Generator Statistics');
    console.log(`  Templates: ${stats.templates}`);
    console.log(`  Total charts generated: ${stats.totalCharts}`);
  } finally {
    await skill.close();
  }
}

/**
 * Health check
 */
async function healthCheck() {
  const skill = new ChartGeneratorSkill();
  
  try {
    const health = await skill.healthCheck();
    console.log(`Health: ${health.healthy ? 'OK' : 'ERROR'}`);
    console.log(`  ${health.message}`);
    process.exit(health.healthy ? 0 : 1);
  } finally {
    await skill.close();
  }
}

/**
 * Main CLI handler
 */
async function main() {
  switch (command) {
    case 'generate':
      await generateChart(args.slice(1));
      break;

    case 'from-connection':
      await generateFromConnection(args.slice(1));
      break;

    case 'template':
      await templateCommand(args[1], args.slice(2));
      break;

    case 'stats':
      await showStats();
      break;

    case 'health':
      await healthCheck();
      break;

    case 'help':
    case '--help':
    case '-h':
    default:
      printUsage();
      break;
  }
}

main().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
