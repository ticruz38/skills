#!/usr/bin/env node

import { ContentWriterSkill, ContentRequest, ContentType, SocialPlatform, EmailType, Tone } from './index';

const args = process.argv.slice(2);
const command = args[0];

const skill = new ContentWriterSkill();

function printUsage(): void {
  console.log(`
Content Writer CLI - Generate AI-powered content

Usage: npx content-writer <command> [options]

Commands:
  generate, g          Generate new content
  history, h           View generation history
  get <id>             Get specific content by ID
  templates, t         List available templates
  template-get <name>  Get a specific template
  stats                View usage statistics
  tones                List available tones
  platforms            List social media platforms
  health               Check system health

Generate Options:
  --topic, -T          Topic/subject of the content
  --type, -t           Content type: blog, social, email
  --platform, -p       Social platform: twitter, linkedin, instagram, facebook, generic
  --email-type, -e     Email type: welcome, follow-up, promotional, newsletter, cold-outreach, thank-you
  --tone               Tone: professional, casual, friendly, formal, enthusiastic, empathetic, authoritative, witty
  --keywords, -k       Comma-separated keywords for SEO/hashtags
  --words, -w          Target word count (for blog posts)
  --audience, -a       Target audience description
  --cta                Call to action text
  --save, -s           Save output to file

Examples:
  npx content-writer generate --topic "AI in Business" --type blog --tone professional --words 500
  npx content-writer generate -T "Product Launch" -t social -p linkedin --tone enthusiastic
  npx content-writer generate -T "Welcome Email" -t email -e welcome --tone friendly
  npx content-writer history --limit 10
  npx content-writer stats
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  let i = 1;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--topic' || arg === '-T') {
      options.topic = args[++i];
    } else if (arg === '--type' || arg === '-t') {
      options.type = args[++i];
    } else if (arg === '--platform' || arg === '-p') {
      options.platform = args[++i];
    } else if (arg === '--email-type' || arg === '-e') {
      options.emailType = args[++i];
    } else if (arg === '--tone') {
      options.tone = args[++i];
    } else if (arg === '--keywords' || arg === '-k') {
      options.keywords = args[++i];
    } else if (arg === '--words' || arg === '-w') {
      options.words = args[++i];
    } else if (arg === '--audience' || arg === '-a') {
      options.audience = args[++i];
    } else if (arg === '--cta') {
      options.cta = args[++i];
    } else if (arg === '--save' || arg === '-s') {
      options.save = args[++i] || 'true';
    } else if (arg === '--limit' || arg === '-l') {
      options.limit = args[++i];
    } else if (arg === '--type-filter') {
      options.typeFilter = args[++i];
    }

    i++;
  }

  return options;
}

async function generateCommand(): Promise<void> {
  const options = parseArgs(args);

  if (!options.topic) {
    console.error('Error: --topic is required');
    process.exit(1);
  }

  if (!options.type) {
    console.error('Error: --type is required (blog, social, email)');
    process.exit(1);
  }

  const contentType = options.type as ContentType;
  if (!['blog', 'social', 'email'].includes(contentType)) {
    console.error(`Error: Invalid content type "${contentType}". Must be: blog, social, email`);
    process.exit(1);
  }

  const request: ContentRequest = {
    topic: options.topic,
    contentType: contentType,
    tone: (options.tone as Tone) || 'professional'
  };

  if (contentType === 'social' && options.platform) {
    request.platform = options.platform as SocialPlatform;
  }

  if (contentType === 'email' && options.emailType) {
    request.emailType = options.emailType as EmailType;
  }

  if (options.keywords) {
    request.keywords = options.keywords.split(',').map(k => k.trim());
  }

  if (options.words) {
    request.wordCount = parseInt(options.words, 10);
  }

  if (options.audience) {
    request.audience = options.audience;
  }

  if (options.cta) {
    request.callToAction = options.cta;
  }

  console.log('Generating content...');
  console.log(`  Topic: ${request.topic}`);
  console.log(`  Type: ${request.contentType}`);
  console.log(`  Tone: ${request.tone}`);
  if (request.platform) console.log(`  Platform: ${request.platform}`);
  if (request.emailType) console.log(`  Email Type: ${request.emailType}`);
  console.log('');

  try {
    const result = await skill.generateContent(request);

    console.log('='.repeat(60));
    console.log(`ID: ${result.id}`);
    console.log(`Title: ${result.title}`);
    console.log(`Word Count: ${result.wordCount}`);
    console.log(`Created: ${result.createdAt}`);
    console.log('='.repeat(60));
    console.log('');
    console.log(result.content);
    console.log('');
    console.log('='.repeat(60));

    if (options.save && options.save !== 'true') {
      const fs = await import('fs');
      fs.writeFileSync(options.save, result.content);
      console.log(`Content saved to: ${options.save}`);
    }

    await skill.close();
  } catch (error) {
    console.error('Error generating content:', error);
    await skill.close();
    process.exit(1);
  }
}

async function historyCommand(): Promise<void> {
  const options = parseArgs(args);
  const limit = parseInt(options.limit || '20', 10);
  const typeFilter = options.typeFilter as ContentType | undefined;

  try {
    const history = await skill.getHistory(typeFilter, limit);

    if (history.length === 0) {
      console.log('No content generated yet.');
      await skill.close();
      return;
    }

    console.log(`Generated Content History (${history.length} items):\n`);
    console.log('ID  | Type   | Platform     | Tone         | Words | Title');
    console.log('-'.repeat(100));

    for (const item of history) {
      const platform = item.platform || item.emailType || 'N/A';
      const platformDisplay = platform.length > 12 ? platform.substring(0, 12) : platform.padEnd(12);
      const toneDisplay = item.tone.padEnd(12);
      const titleDisplay = item.title.length > 40 ? item.title.substring(0, 37) + '...' : item.title;

      console.log(
        `${String(item.id).padEnd(3)} | ${item.contentType.padEnd(6)} | ${platformDisplay} | ${toneDisplay} | ${String(item.wordCount).padEnd(5)} | ${titleDisplay}`
      );
    }

    await skill.close();
  } catch (error) {
    console.error('Error fetching history:', error);
    await skill.close();
    process.exit(1);
  }
}

async function getCommand(): Promise<void> {
  const id = parseInt(args[1], 10);

  if (isNaN(id)) {
    console.error('Error: Please provide a valid ID');
    process.exit(1);
  }

  try {
    const content = await skill.getById(id);

    if (!content) {
      console.error(`Content with ID ${id} not found`);
      await skill.close();
      process.exit(1);
    }

    console.log('='.repeat(60));
    console.log(`ID: ${content.id}`);
    console.log(`Type: ${content.contentType}`);
    if (content.platform) console.log(`Platform: ${content.platform}`);
    if (content.emailType) console.log(`Email Type: ${content.emailType}`);
    console.log(`Tone: ${content.tone}`);
    console.log(`Word Count: ${content.wordCount}`);
    console.log(`Created: ${content.createdAt}`);
    console.log(`Title: ${content.title}`);
    console.log('='.repeat(60));
    console.log('');
    console.log(content.content);

    await skill.close();
  } catch (error) {
    console.error('Error fetching content:', error);
    await skill.close();
    process.exit(1);
  }
}

async function templatesCommand(): Promise<void> {
  const options = parseArgs(args);
  const typeFilter = options.typeFilter as ContentType | undefined;

  try {
    const templates = await skill.getTemplates(typeFilter);

    console.log(`Available Templates (${templates.length}):\n`);
    console.log('Name                    | Type   | Platform     | Default Tone');
    console.log('-'.repeat(80));

    for (const template of templates) {
      const platform = template.platform || template.emailType || 'N/A';
      const platformDisplay = platform.length > 12 ? platform.substring(0, 12) : platform.padEnd(12);

      console.log(
        `${template.name.padEnd(23)} | ${template.contentType.padEnd(6)} | ${platformDisplay} | ${template.defaultTone}`
      );
      console.log(`  Description: ${template.description}`);
      console.log(`  Variables: ${template.variables.join(', ')}`);
      console.log('');
    }

    await skill.close();
  } catch (error) {
    console.error('Error fetching templates:', error);
    await skill.close();
    process.exit(1);
  }
}

async function templateGetCommand(): Promise<void> {
  const templateName = args[1];

  if (!templateName) {
    console.error('Error: Please provide a template name');
    process.exit(1);
  }

  try {
    const templates = await skill.getTemplates();
    const template = templates.find(t => t.name.toLowerCase() === templateName.toLowerCase());

    if (!template) {
      console.error(`Template "${templateName}" not found`);
      console.log('\nAvailable templates:');
      templates.forEach(t => console.log(`  - ${t.name}`));
      await skill.close();
      process.exit(1);
    }

    console.log('='.repeat(60));
    console.log(`Name: ${template.name}`);
    console.log(`Description: ${template.description}`);
    console.log(`Content Type: ${template.contentType}`);
    if (template.platform) console.log(`Platform: ${template.platform}`);
    if (template.emailType) console.log(`Email Type: ${template.emailType}`);
    console.log(`Default Tone: ${template.defaultTone}`);
    console.log(`Variables: ${template.variables.join(', ')}`);
    console.log('='.repeat(60));
    console.log('');
    console.log('Template:');
    console.log(template.template);

    await skill.close();
  } catch (error) {
    console.error('Error fetching template:', error);
    await skill.close();
    process.exit(1);
  }
}

async function statsCommand(): Promise<void> {
  try {
    const stats = await skill.getStats();

    console.log('Content Writer Statistics\n');
    console.log(`Total Content Generated: ${stats.totalGenerated}`);
    console.log('');

    console.log('By Content Type:');
    for (const [type, count] of Object.entries(stats.byType)) {
      console.log(`  ${type}: ${count}`);
    }
    console.log('');

    console.log('By Tone:');
    for (const [tone, count] of Object.entries(stats.byTone)) {
      if (count > 0) {
        console.log(`  ${tone}: ${count}`);
      }
    }

    await skill.close();
  } catch (error) {
    console.error('Error fetching stats:', error);
    await skill.close();
    process.exit(1);
  }
}

async function tonesCommand(): Promise<void> {
  const tones = skill.getAvailableTones();

  console.log('Available Tones:\n');
  for (const tone of tones) {
    console.log(`  ${tone}`);
  }
}

async function platformsCommand(): Promise<void> {
  const platforms: SocialPlatform[] = ['twitter', 'linkedin', 'instagram', 'facebook', 'generic'];

  console.log('Social Media Platforms:\n');
  for (const platform of platforms) {
    const constraints = skill.getPlatformConstraints(platform);
    console.log(`  ${platform}`);
    console.log(`    Max Length: ${constraints.maxLength} characters`);
    console.log(`    Recommended Hashtags: ${constraints.hashtagCount}`);
    console.log('');
  }
}

async function healthCommand(): Promise<void> {
  try {
    const health = await skill.healthCheck();

    console.log('Content Writer Health Check\n');
    console.log(`Status: ${health.healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
    console.log(`Message: ${health.message}`);

    await skill.close();
  } catch (error) {
    console.error('Error checking health:', error);
    await skill.close();
    process.exit(1);
  }
}

// Main command dispatcher
async function main(): Promise<void> {
  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case 'generate':
    case 'g':
      await generateCommand();
      break;
    case 'history':
    case 'h':
      await historyCommand();
      break;
    case 'get':
      await getCommand();
      break;
    case 'templates':
    case 't':
      await templatesCommand();
      break;
    case 'template-get':
      await templateGetCommand();
      break;
    case 'stats':
      await statsCommand();
      break;
    case 'tones':
      await tonesCommand();
      break;
    case 'platforms':
      await platformsCommand();
      break;
    case 'health':
      await healthCommand();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
