#!/usr/bin/env node

import { DraftResponsesSkill, Tone } from './index';

const skill = new DraftResponsesSkill();

function printHelp(): void {
  console.log(`
Draft Responses CLI

Generate email reply suggestions with multiple tone options

Commands:
  generate, g <email-id>   Generate draft reply suggestions
    --tones, -t             Comma-separated tones (default: professional,friendly)
    --count, -c             Number of drafts to generate (default: 3)
    --no-context            Don't use thread context

  drafts, d [email-id]     List draft suggestions
    --limit, -l             Number of drafts to show (default: 20)

  send <draft-id>          Send a draft reply

  delete <draft-id>        Delete a draft

  template, tmpl <name>    Apply a response template
    --variables, -v         JSON string of variables

  templates, ts            List available templates
    --category, -c          Filter by category

  tones                    List available tones

  stats                    View usage statistics

  health, h                Check system health

  help                     Show this help

Examples:
  npx draft-responses generate 12345abc
  npx draft-responses generate 12345abc --tones professional,casual --count 2
  npx draft-responses send 1
  npx draft-responses template thank-you --variables '{"name":"John","reason":"your help"}'
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
    } else if (!parsed._arg1) {
      parsed._arg1 = arg;
    } else if (!parsed._arg2) {
      parsed._arg2 = arg;
    }
  }
  
  return parsed;
}

async function handleGenerate(args: Record<string, string | number | boolean>): Promise<void> {
  const emailId = args._arg1 as string;
  
  if (!emailId) {
    console.error('Error: Email ID is required');
    console.log('Usage: draft-responses generate <email-id> [options]');
    process.exit(1);
  }

  const tonesStr = (args.tones || args.t || 'professional,friendly') as string;
  const tones = tonesStr.split(',').map(t => t.trim()) as Tone[];
  const count = parseInt((args.count || args.c || '3') as string, 10);
  const useContext = !(args['no-context'] === true);

  console.log(`Generating drafts for email: ${emailId}`);
  console.log(`Tones: ${tones.join(', ')}`);
  console.log(`Count: ${count}`);
  console.log(`Use context: ${useContext}`);
  console.log('');

  try {
    const drafts = await skill.generateDrafts(emailId, { tones, count, useThreadContext: useContext });

    console.log('Generated Drafts:');
    console.log('='.repeat(80));
    
    drafts.forEach((draft, index) => {
      console.log(`\nDraft ${index + 1} (ID: ${draft.id}) - Tone: ${draft.tone}`);
      console.log('-'.repeat(80));
      console.log(`Subject: ${draft.subject}`);
      console.log('');
      console.log(draft.draft);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log(`\nTo send a draft: draft-responses send <draft-id>`);
  } catch (error: any) {
    console.error('Error generating drafts:', error.message);
    process.exit(1);
  }
}

async function handleDrafts(args: Record<string, string | number | boolean>): Promise<void> {
  const emailId = args._arg1 as string | undefined;
  const limit = parseInt((args.limit || args.l || '20') as string, 10);

  try {
    let drafts;
    if (emailId) {
      drafts = await skill.getDraftsForEmail(emailId);
      console.log(`Drafts for email: ${emailId}`);
    } else {
      drafts = await skill.getAllDrafts(limit);
      console.log('All Draft Suggestions');
    }

    console.log('='.repeat(80));

    if (drafts.length === 0) {
      console.log('No drafts found.');
      return;
    }

    drafts.forEach((draft, index) => {
      const status = draft.sentAt ? '✓ Sent' : '○ Pending';
      console.log(`\n${index + 1}. [ID: ${draft.id}] ${status} | Tone: ${draft.tone}`);
      console.log(`   Subject: ${draft.subject}`);
      console.log(`   Created: ${new Date(draft.createdAt).toLocaleString()}`);
      if (draft.sentAt) {
        console.log(`   Sent: ${new Date(draft.sentAt).toLocaleString()}`);
      }
      console.log(`   Preview: "${draft.draft.substring(0, 60)}${draft.draft.length > 60 ? '...' : ''}"`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('Use "draft-responses send <id>" to send a pending draft');
  } catch (error: any) {
    console.error('Error listing drafts:', error.message);
    process.exit(1);
  }
}

async function handleSend(args: Record<string, string | number | boolean>): Promise<void> {
  const draftIdStr = args._arg1 as string;
  
  if (!draftIdStr) {
    console.error('Error: Draft ID is required');
    console.log('Usage: draft-responses send <draft-id>');
    process.exit(1);
  }

  const draftId = parseInt(draftIdStr, 10);
  if (isNaN(draftId)) {
    console.error('Error: Invalid draft ID');
    process.exit(1);
  }

  console.log(`Sending draft ${draftId}...`);

  try {
    const result = await skill.sendDraft(draftId);
    
    if (result.success) {
      console.log('✓', result.message);
    } else {
      console.error('✗', result.message);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('Error sending draft:', error.message);
    process.exit(1);
  }
}

async function handleDelete(args: Record<string, string | number | boolean>): Promise<void> {
  const draftIdStr = args._arg1 as string;
  
  if (!draftIdStr) {
    console.error('Error: Draft ID is required');
    console.log('Usage: draft-responses delete <draft-id>');
    process.exit(1);
  }

  const draftId = parseInt(draftIdStr, 10);
  if (isNaN(draftId)) {
    console.error('Error: Invalid draft ID');
    process.exit(1);
  }

  console.log(`Deleting draft ${draftId}...`);

  try {
    await skill.deleteDraft(draftId);
    console.log('✓ Draft deleted');
  } catch (error: any) {
    console.error('Error deleting draft:', error.message);
    process.exit(1);
  }
}

async function handleTemplate(args: Record<string, string | number | boolean>): Promise<void> {
  const name = args._arg1 as string;
  
  if (!name) {
    console.error('Error: Template name is required');
    console.log('Usage: draft-responses template <name> [options]');
    process.exit(1);
  }

  const variablesStr = (args.variables || args.v) as string | undefined;
  let variables: Record<string, string> = {};
  
  if (variablesStr) {
    try {
      variables = JSON.parse(variablesStr);
    } catch (e) {
      console.error('Error: Invalid JSON in --variables');
      process.exit(1);
    }
  }

  try {
    const template = await skill.getTemplate(name);
    
    if (!template) {
      console.error(`Error: Template "${name}" not found`);
      console.log('Use "draft-responses templates" to list available templates');
      process.exit(1);
    }

    const result = skill.applyTemplate(template, variables);
    
    console.log('Template Applied');
    console.log('='.repeat(60));
    console.log(`Template: ${template.name}`);
    console.log(`Description: ${template.description}`);
    console.log(`Category: ${template.category}`);
    console.log(`Default tone: ${template.defaultTone}`);
    console.log('');
    console.log('Template:');
    console.log('-'.repeat(60));
    console.log(template.template);
    console.log('');
    console.log('Generated response:');
    console.log('-'.repeat(60));
    console.log(result);
    console.log('='.repeat(60));
  } catch (error: any) {
    console.error('Error applying template:', error.message);
    process.exit(1);
  }
}

async function handleTemplates(args: Record<string, string | number | boolean>): Promise<void> {
  const category = (args.category || args.c) as string | undefined;

  try {
    const templates = await skill.getTemplates(category);
    
    console.log('Available Templates');
    console.log('='.repeat(70));
    
    if (templates.length === 0) {
      console.log('No templates found.');
      return;
    }

    const grouped = templates.reduce((acc, template) => {
      if (!acc[template.category]) acc[template.category] = [];
      acc[template.category].push(template);
      return acc;
    }, {} as Record<string, typeof templates>);

    for (const [cat, items] of Object.entries(grouped)) {
      console.log(`\n${cat.toUpperCase()}:`);
      items.forEach(template => {
        console.log(`  ${template.name}`);
        console.log(`    ${template.description}`);
        console.log(`    Tone: ${template.defaultTone}`);
        console.log(`    Variables: ${template.variables.join(', ')}`);
      });
    }
    console.log('\n' + '='.repeat(70));
    console.log('Use: draft-responses template <name> --variables \'{"key":"value"}\'');
  } catch (error: any) {
    console.error('Error listing templates:', error.message);
    process.exit(1);
  }
}

async function handleTones(): Promise<void> {
  const tones = skill.getAvailableTones();
  
  console.log('Available Tones');
  console.log('='.repeat(40));
  tones.forEach(tone => {
    console.log(`  ${tone}`);
  });
  console.log('='.repeat(40));
}

async function handleStats(): Promise<void> {
  try {
    const stats = await skill.getStats();
    
    console.log('Draft Responses Statistics');
    console.log('='.repeat(60));
    console.log(`\nTotal drafts generated: ${stats.totalDrafts}`);
    console.log(`Drafts sent: ${stats.sentDrafts}`);
    
    if (stats.totalDrafts > 0) {
      const percentage = ((stats.sentDrafts / stats.totalDrafts) * 100).toFixed(1);
      console.log(`Send rate: ${percentage}%`);
    }
    
    console.log('\nDrafts by Tone:');
    for (const [tone, count] of Object.entries(stats.byTone)) {
      if (count > 0) {
        console.log(`  ${tone}: ${count}`);
      }
    }
    console.log('='.repeat(60));
  } catch (error: any) {
    console.error('Error getting stats:', error.message);
    process.exit(1);
  }
}

async function handleHealth(): Promise<void> {
  console.log('Checking health...');
  
  try {
    const health = await skill.healthCheck();
    
    console.log('\nHealth Check');
    console.log('='.repeat(40));
    console.log(`Status: ${health.status === 'healthy' ? '✓ Healthy' : '✗ Unhealthy'}`);
    console.log(`Message: ${health.message}`);
    console.log('='.repeat(40));

    if (health.status !== 'healthy') {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('Health check failed:', error.message);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const parsedArgs = parseArgs(args.slice(1));

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    await skill.close();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'generate':
      case 'g':
        await handleGenerate(parsedArgs);
        break;
      case 'drafts':
      case 'd':
        await handleDrafts(parsedArgs);
        break;
      case 'send':
        await handleSend(parsedArgs);
        break;
      case 'delete':
        await handleDelete(parsedArgs);
        break;
      case 'template':
      case 'tmpl':
        await handleTemplate(parsedArgs);
        break;
      case 'templates':
      case 'ts':
        await handleTemplates(parsedArgs);
        break;
      case 'tones':
        await handleTones();
        break;
      case 'stats':
        await handleStats();
        break;
      case 'health':
      case 'h':
        await handleHealth();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    await skill.close();
    process.exit(1);
  }

  await skill.close();
}

main();
