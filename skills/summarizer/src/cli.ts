#!/usr/bin/env node

import { SummarizerSkill, SummaryLength, SummaryFormat, DocumentType } from './index';
import * as fs from 'fs';

const skill = new SummarizerSkill();

function printHelp(): void {
  console.log(`
Summarizer CLI - Summarize articles and documents with key point extraction

Commands:
  summarize, s     Summarize text or file
    --text, -t        Text to summarize (required if no file)
    --file, -f        File path to summarize
    --length, -l      Summary length: short|medium|long (default: medium)
    --format, -F      Output format: paragraph|bullet|numbered (default: paragraph)
    --type, -T        Document type: article|document|email|meeting|research (default: document)
    --title           Title for the summary
    --key-points, -k  Number of key points to extract (default: 5, 0 to disable)
    --focus           Comma-separated list of keywords to focus on

  file             Summarize a file (shortcut for summarize --file)

  history, h       View summary history
    --type            Filter by document type
    --limit, -n       Number of records (default: 20)

  get              Get a specific summary by ID
    --id, -i          Summary ID (required)

  stats            View usage statistics

  clear            Clear history
    --days, -d        Delete summaries older than N days (optional)

  delete           Delete a specific summary
    --id, -i          Summary ID (required)

  health           Check system health

Examples:
  npx summarizer summarize -t "Long article text here..." -l short -k 3
  npx summarizer summarize -f article.txt --type article --format bullet
  npx summarizer s -t "Meeting notes..." -T meeting -l medium -k 5
  npx summarizer file report.pdf -T document -l long
  npx summarizer history --type article -n 10
`);
}

function parseArgs(args: string[]): Record<string, string | number | boolean> {
  const parsed: Record<string, string | number | boolean> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (nextArg && !nextArg.startsWith('-')) {
        parsed[key] = nextArg;
        i++;
      } else {
        parsed[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (nextArg && !nextArg.startsWith('-')) {
        parsed[key] = nextArg;
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }
  
  return parsed;
}

async function handleSummarize(args: Record<string, string | number | boolean>): Promise<void> {
  const text = args.text || args.t;
  const file = args.file || args.f;

  if (!text && !file) {
    console.error('Error: Either --text or --file is required');
    process.exit(1);
  }

  const length = (args.length || args.l || 'medium') as SummaryLength;
  const format = (args.format || args.F || 'paragraph') as SummaryFormat;
  const documentType = (args.type || args.T || 'document') as DocumentType;
  const title = (args.title) as string | undefined;
  const keyPoints = parseInt((args['key-points'] || args.k || '5') as string, 10);
  const focusStr = (args.focus || '') as string;
  const focus = focusStr ? focusStr.split(',').map(s => s.trim()).filter(s => s) : [];

  try {
    let result;

    if (file) {
      console.log(`Summarizing file: ${file}...\n`);
      result = await skill.summarizeFile(file as string, {
        length,
        format,
        documentType,
        title,
        extractKeyPoints: keyPoints > 0,
        maxKeyPoints: keyPoints,
        focus
      });
    } else {
      console.log('Summarizing text...\n');
      result = await skill.summarize({
        text: text as string,
        length,
        format,
        documentType,
        title,
        extractKeyPoints: keyPoints > 0,
        maxKeyPoints: keyPoints,
        focus
      });
    }

    console.log('='.repeat(60));
    if (result.title) {
      console.log(`Title: ${result.title}`);
    }
    console.log(`Document Type: ${result.documentType}`);
    console.log(`Length: ${result.length}`);
    console.log(`Format: ${result.format}`);
    console.log(`Compression: ${(result.compressionRatio * 100).toFixed(1)}% (${result.originalLength} → ${result.summaryLength} chars)`);
    console.log('='.repeat(60));
    console.log();
    console.log('SUMMARY:');
    console.log('-'.repeat(60));
    console.log(result.summary);
    console.log();

    if (result.keyPoints.length > 0) {
      console.log('KEY POINTS:');
      console.log('-'.repeat(60));
      result.keyPoints.forEach((point, i) => {
        console.log(`${i + 1}. ${point}`);
      });
      console.log();
    }

    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

async function handleHistory(args: Record<string, string | number | boolean>): Promise<void> {
  const documentType = (args.type) as DocumentType | undefined;
  const limit = parseInt((args.limit || args.n || '20') as string, 10);

  try {
    const history = await skill.getHistory(documentType, limit);

    console.log('Summary History');
    console.log('='.repeat(80));

    if (history.length === 0) {
      console.log('No summaries found.');
      return;
    }

    history.forEach((item, index) => {
      console.log(`\n${index + 1}. [${item.id}] ${item.documentType.toUpperCase()} | ${item.length} | ${item.format}`);
      if (item.title) {
        console.log(`   Title: ${item.title}`);
      }
      console.log(`   Summary: "${item.summary.substring(0, 70)}${item.summary.length > 70 ? '...' : ''}"`);
      console.log(`   ${item.originalLength} → ${item.summaryLength} chars (${(item.compressionRatio * 100).toFixed(1)}%)`);
      console.log(`   Key Points: ${item.keyPoints.length} | ${item.createdAt.toLocaleString()}`);
    });
    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

async function handleGet(args: Record<string, string | number | boolean>): Promise<void> {
  const id = parseInt((args.id || args.i) as string, 10);

  if (isNaN(id)) {
    console.error('Error: --id is required and must be a number');
    process.exit(1);
  }

  try {
    const summary = await skill.getSummary(id);

    if (!summary) {
      console.error(`Summary with ID ${id} not found`);
      process.exit(1);
    }

    console.log('='.repeat(60));
    if (summary.title) {
      console.log(`Title: ${summary.title}`);
    }
    console.log(`Document Type: ${summary.documentType}`);
    console.log(`Length: ${summary.length}`);
    console.log(`Format: ${summary.format}`);
    console.log(`Created: ${summary.createdAt.toLocaleString()}`);
    console.log(`Compression: ${(summary.compressionRatio * 100).toFixed(1)}%`);
    console.log('='.repeat(60));
    console.log();
    console.log('SUMMARY:');
    console.log('-'.repeat(60));
    console.log(summary.summary);
    console.log();

    if (summary.keyPoints.length > 0) {
      console.log('KEY POINTS:');
      console.log('-'.repeat(60));
      summary.keyPoints.forEach((point, i) => {
        console.log(`${i + 1}. ${point}`);
      });
      console.log();
    }

    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

async function handleStats(): Promise<void> {
  try {
    const stats = await skill.getStats();

    console.log('Summarizer Statistics');
    console.log('='.repeat(60));
    console.log(`\nTotal Summaries: ${stats.totalSummaries}`);
    console.log(`Average Compression: ${(stats.avgCompressionRatio * 100).toFixed(1)}%`);

    console.log('\nBy Document Type:');
    Object.entries(stats.byDocumentType).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`  ${type}: ${count}`);
      }
    });

    console.log('\nBy Length:');
    Object.entries(stats.byLength).forEach(([length, count]) => {
      if (count > 0) {
        console.log(`  ${length}: ${count}`);
      }
    });

    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

async function handleClear(args: Record<string, string | number | boolean>): Promise<void> {
  const days = args.days || args.d;
  const daysNum = days ? parseInt(days as string, 10) : undefined;

  try {
    const count = await skill.clearHistory(daysNum);

    if (daysNum) {
      console.log(`Deleted ${count} summaries older than ${daysNum} days`);
    } else {
      console.log(`Deleted all ${count} summaries`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

async function handleDelete(args: Record<string, string | number | boolean>): Promise<void> {
  const id = parseInt((args.id || args.i) as string, 10);

  if (isNaN(id)) {
    console.error('Error: --id is required and must be a number');
    process.exit(1);
  }

  try {
    const deleted = await skill.deleteSummary(id);

    if (deleted) {
      console.log(`Summary ${id} deleted successfully`);
    } else {
      console.log(`Summary ${id} not found`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

async function handleHealth(): Promise<void> {
  const health = await skill.healthCheck();
  console.log('Health Check');
  console.log('='.repeat(40));
  console.log(`Status: ${health.healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
  console.log(`Message: ${health.message}`);
  console.log('='.repeat(40));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const parsedArgs = parseArgs(args.slice(1));

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    await skill.close();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'summarize':
      case 's':
        await handleSummarize(parsedArgs);
        break;
      case 'file':
        parsedArgs.file = parsedArgs.file || parsedArgs.t || parsedArgs._ || args[1];
        await handleSummarize(parsedArgs);
        break;
      case 'history':
      case 'h':
        await handleHistory(parsedArgs);
        break;
      case 'get':
        await handleGet(parsedArgs);
        break;
      case 'stats':
        await handleStats();
        break;
      case 'clear':
        await handleClear(parsedArgs);
        break;
      case 'delete':
        await handleDelete(parsedArgs);
        break;
      case 'health':
        await handleHealth();
        break;
      default:
        if (fs.existsSync(command)) {
          parsedArgs.file = command;
          await handleSummarize(parsedArgs);
        } else {
          console.error(`Unknown command: ${command}`);
          printHelp();
          process.exit(1);
        }
    }
  } catch (error) {
    console.error('Error:', error);
    await skill.close();
    process.exit(1);
  }

  await skill.close();
}

main();
