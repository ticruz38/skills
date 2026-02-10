#!/usr/bin/env node

import { EngagementRepliesSkill, Platform, Tone, Sentiment } from './index';

const skill = new EngagementRepliesSkill();

function printHelp(): void {
  console.log(`
Engagement Replies CLI

Commands:
  generate, g      Generate reply suggestions for a message
    --message, -m     The incoming message to reply to (required)
    --context, -c     Context of the conversation/post
    --author, -a      Name of the author (for personalization)
    --platform, -p    Platform (twitter|linkedin|instagram|facebook|email|generic)
    --tone, -t        Reply tone (professional|casual|friendly|formal|enthusiastic|empathetic|authoritative|witty)
    --count, -n       Number of suggestions to generate (default: 3)

  sentiment, s     Analyze sentiment of a message
    --message, -m     Message to analyze (required)

  template, tmpl   Use a quick response template
    --name, -n        Template name (required)
    --variables, -v   JSON string of variables for template

  templates, t     List available templates
    --category, -c    Filter by category

  history, h       View generated reply history
    --limit, -l       Number of records to show (default: 20)

  stats            View usage statistics

  tones            List available tones

  platforms        List available platforms

  health           Check system health

Examples:
  npx engagement-replies generate -m "Great post!" -p twitter -t friendly
  npx engagement-replies sentiment -m "This is amazing! Love it!"
  npx engagement-replies template -n thank-you -v '{"name":"John","appreciation":"Means a lot!"}'
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

async function handleGenerate(args: Record<string, string | number | boolean>): Promise<void> {
  const message = args.message || args.m;
  
  if (!message || typeof message !== 'string') {
    console.error('Error: --message is required');
    process.exit(1);
  }

  const context = (args.context || args.c) as string | undefined;
  const authorName = (args.author || args.a) as string | undefined;
  const platform = (args.platform || args.p || 'generic') as Platform;
  const tone = (args.tone || args.t) as Tone | undefined;
  const count = parseInt((args.count || args.n || '3') as string, 10);

  console.log('Generating reply suggestions...\n');
  console.log(`Original message: "${message}"`);
  if (context) console.log(`Context: ${context}`);
  if (authorName) console.log(`Author: ${authorName}`);
  console.log(`Platform: ${platform}`);
  if (tone) console.log(`Tone: ${tone}`);
  console.log('');

  try {
    const replies = await skill.generateReplies({
      message,
      context,
      authorName,
      platform,
      tone,
      count
    });

    const sentiment = await skill.analyzeSentiment(message);
    console.log(`Detected sentiment: ${sentiment.sentiment} (score: ${sentiment.score.toFixed(2)}, confidence: ${sentiment.confidence.toFixed(2)})`);
    console.log(`Emotions: ${sentiment.emotions.join(', ')}`);
    console.log('');

    console.log('Reply suggestions:');
    console.log('='.repeat(60));
    replies.forEach((reply, index) => {
      console.log(`\nOption ${index + 1} (${reply.tone} tone):`);
      console.log('-'.repeat(40));
      console.log(reply.reply);
      console.log(`Length: ${reply.reply.length} characters`);
    });
    console.log('\n' + '='.repeat(60));
  } catch (error) {
    console.error('Error generating replies:', error);
    process.exit(1);
  }
}

async function handleSentiment(args: Record<string, string | number | boolean>): Promise<void> {
  const message = args.message || args.m;
  
  if (!message || typeof message !== 'string') {
    console.error('Error: --message is required');
    process.exit(1);
  }

  try {
    const analysis = await skill.analyzeSentiment(message);
    
    console.log('Sentiment Analysis');
    console.log('='.repeat(40));
    console.log(`Message: "${message}"`);
    console.log('');
    console.log(`Sentiment: ${analysis.sentiment.toUpperCase()}`);
    console.log(`Score: ${analysis.score.toFixed(2)} (0=negative, 1=positive)`);
    console.log(`Confidence: ${analysis.confidence.toFixed(2)}`);
    console.log(`Emotions: ${analysis.emotions.join(', ')}`);
    console.log('='.repeat(40));
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    process.exit(1);
  }
}

async function handleTemplate(args: Record<string, string | number | boolean>): Promise<void> {
  const name = args.name || args.n;
  
  if (!name || typeof name !== 'string') {
    console.error('Error: --name is required');
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
      process.exit(1);
    }

    const reply = skill.applyTemplate(template, variables);
    
    console.log('Template Applied');
    console.log('='.repeat(40));
    console.log(`Template: ${template.name}`);
    console.log(`Description: ${template.description}`);
    console.log(`Category: ${template.category}`);
    console.log(`Default tone: ${template.defaultTone}`);
    console.log('');
    console.log('Template:');
    console.log('-'.repeat(40));
    console.log(template.template);
    console.log('');
    console.log('Generated reply:');
    console.log('-'.repeat(40));
    console.log(reply);
    console.log('='.repeat(40));
  } catch (error) {
    console.error('Error applying template:', error);
    process.exit(1);
  }
}

async function handleTemplates(args: Record<string, string | number | boolean>): Promise<void> {
  const category = (args.category || args.c) as string | undefined;

  try {
    const templates = await skill.getTemplates(category);
    
    console.log('Available Templates');
    console.log('='.repeat(60));
    
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
        console.log(`    Variables: ${template.variables.join(', ')}`);
      });
    }
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error listing templates:', error);
    process.exit(1);
  }
}

async function handleHistory(args: Record<string, string | number | boolean>): Promise<void> {
  const limit = parseInt((args.limit || args.l || '20') as string, 10);

  try {
    const history = await skill.getHistory(limit);
    
    console.log('Generated Reply History');
    console.log('='.repeat(80));
    
    if (history.length === 0) {
      console.log('No history found.');
      return;
    }

    history.forEach((item, index) => {
      console.log(`\n${index + 1}. [${item.platform}] ${item.sentiment.toUpperCase()} | ${item.tone}`);
      console.log(`   Original: "${item.originalMessage.substring(0, 60)}${item.originalMessage.length > 60 ? '...' : ''}"`);
      console.log(`   Reply: "${item.reply.substring(0, 60)}${item.reply.length > 60 ? '...' : ''}"`);
      console.log(`   ${new Date(item.createdAt).toLocaleString()}`);
    });
    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('Error listing history:', error);
    process.exit(1);
  }
}

async function handleStats(): Promise<void> {
  try {
    const stats = await skill.getStats();
    
    console.log('Engagement Replies Statistics');
    console.log('='.repeat(60));
    console.log(`\nTotal replies generated: ${stats.totalGenerated}`);
    
    console.log('\nBy Platform:');
    for (const [platform, count] of Object.entries(stats.byPlatform)) {
      if (count > 0) {
        console.log(`  ${platform}: ${count}`);
      }
    }
    
    console.log('\nBy Tone:');
    for (const [tone, count] of Object.entries(stats.byTone)) {
      if (count > 0) {
        console.log(`  ${tone}: ${count}`);
      }
    }
    
    console.log('\nBy Sentiment:');
    for (const [sentiment, count] of Object.entries(stats.bySentiment)) {
      if (count > 0) {
        console.log(`  ${sentiment}: ${count}`);
      }
    }
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error getting stats:', error);
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

async function handlePlatforms(): Promise<void> {
  const platforms = skill.getAvailablePlatforms();
  console.log('Available Platforms');
  console.log('='.repeat(40));
  platforms.forEach(platform => {
    console.log(`  ${platform}`);
  });
  console.log('='.repeat(40));
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
      case 'generate':
      case 'g':
        await handleGenerate(parsedArgs);
        break;
      case 'sentiment':
      case 's':
        await handleSentiment(parsedArgs);
        break;
      case 'template':
      case 'tmpl':
        await handleTemplate(parsedArgs);
        break;
      case 'templates':
      case 't':
        await handleTemplates(parsedArgs);
        break;
      case 'history':
      case 'h':
        await handleHistory(parsedArgs);
        break;
      case 'stats':
        await handleStats();
        break;
      case 'tones':
        await handleTones();
        break;
      case 'platforms':
        await handlePlatforms();
        break;
      case 'health':
        await handleHealth();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    await skill.close();
    process.exit(1);
  }

  await skill.close();
}

main();
