#!/usr/bin/env node
import { ImagePromptsSkill, PromptRequest, ImagePlatform, ArtStyle, Mood, Lighting, Perspective, Quality, AspectRatio } from './index';

const skill = new ImagePromptsSkill();

function showHelp(): void {
  console.log(`
Image Prompts Generator - Create AI image prompts for Midjourney, DALL-E, and Stable Diffusion

Usage: npx image-prompts <command> [options]

Commands:
  generate, g <subject>           Generate image prompts
    Options:
      -p, --platform <platform>   Target platform (midjourney|dalle|stable-diffusion|leonardo|generic)
      -s, --style <style>         Art style (photorealistic|digital-art|oil-painting|...)
      -m, --mood <mood>           Mood/atmosphere (peaceful|dramatic|mysterious|...)
      -l, --lighting <lighting>   Lighting style (natural|studio|dramatic|...)
      --perspective <perspective> Camera angle (eye-level|birds-eye|close-up|...)
      -q, --quality <quality>     Quality level (low|medium|high|ultra)
      -a, --aspect <ratio>        Aspect ratio (1:1|4:3|16:9|9:16|21:9|3:2|2:3)
      -n, --count <number>        Number of prompts to generate (default: 3)
      -d, --details <items>       Additional details (comma-separated)
      --negative <prompt>         Negative prompt to exclude
      --params                    Show platform-specific parameters

  template, t <name>              Generate using a template
    Options:
      --var <json>                Template variables as JSON
      -p, --platform <platform>   Override platform

  templates                       List available templates
    Options:
      --category <cat>            Filter by category
      --platform <platform>       Filter by platform

  history, h                      Show prompt history
    Options:
      --limit <number>            Number of entries (default: 10)

  styles                          List available art styles
  moods                           List available moods
  lighting                        List available lighting options
  perspectives                    List available camera angles
  platforms                       List supported platforms
  aspect-ratios                   List available aspect ratios

  parameters, params <platform>   Show platform-specific parameters

  stats                           Show generation statistics
  health                          Check system health

Examples:
  npx image-prompts generate "a mystical forest" --style fantasy --mood mysterious
  npx image-prompts g "cyberpunk city" -p midjourney -s cyberpunk -m futuristic -l neon
  npx image-prompts template character-portrait --var '{"subject":"a brave warrior"}'
  npx image-prompts generate "portrait" -s photorealistic -q ultra -a 16:9 -n 5
`);
}

async function generatePrompts(args: string[]): Promise<void> {
  const subjectIndex = args.findIndex(arg => !arg.startsWith('-'));
  if (subjectIndex === -1) {
    console.error('Error: Subject is required');
    process.exit(1);
  }

  const subject = args[subjectIndex];
  const request: PromptRequest = { subject };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '-p':
      case '--platform':
        request.platform = nextArg as ImagePlatform;
        i++;
        break;
      case '-s':
      case '--style':
        request.style = nextArg as ArtStyle;
        i++;
        break;
      case '-m':
      case '--mood':
        request.mood = nextArg as Mood;
        i++;
        break;
      case '-l':
      case '--lighting':
        request.lighting = nextArg as Lighting;
        i++;
        break;
      case '--perspective':
        request.perspective = nextArg as Perspective;
        i++;
        break;
      case '-q':
      case '--quality':
        request.quality = nextArg as Quality;
        i++;
        break;
      case '-a':
      case '--aspect':
      case '--ar':
        request.aspectRatio = nextArg as AspectRatio;
        i++;
        break;
      case '-n':
      case '--count':
        request.count = parseInt(nextArg, 10);
        i++;
        break;
      case '-d':
      case '--details':
        request.details = nextArg.split(',').map(d => d.trim());
        i++;
        break;
      case '--negative':
        request.negativePrompt = nextArg;
        i++;
        break;
      case '--params':
        const platform = request.platform || 'midjourney';
        const params = skill.getPlatformParameters(platform);
        console.log(`\n${platform} Parameters:`);
        for (const [key, config] of Object.entries(params)) {
          console.log(`  --${key}: ${config.description} (default: ${config.default})`);
        }
        return;
    }
  }

  try {
    const prompts = await skill.generatePrompts(request);

    console.log(`\nGenerated ${prompts.length} prompt(s) for "${subject}"`);
    console.log(`Platform: ${request.platform || 'midjourney'}`);
    if (request.style) console.log(`Style: ${request.style}`);
    if (request.mood) console.log(`Mood: ${request.mood}`);
    if (request.lighting) console.log(`Lighting: ${request.lighting}`);
    if (request.aspectRatio) console.log(`Aspect Ratio: ${request.aspectRatio}`);
    console.log('');

    prompts.forEach((p, index) => {
      console.log(`\n--- Prompt ${index + 1} ---`);
      console.log(p.prompt);
      
      if (p.negativePrompt) {
        console.log(`\nNegative: ${p.negativePrompt}`);
      }

      if (Object.keys(p.parameters).length > 0) {
        console.log('\nParameters:');
        for (const [key, value] of Object.entries(p.parameters)) {
          console.log(`  ${key}: ${value}`);
        }
      }

      // Show formatted command for Midjourney
      if (p.platform === 'midjourney') {
        const formatted = skill.formatPromptWithParameters(p.prompt, p.platform, p.parameters);
        console.log(`\nFull Command:`);
        console.log(formatted);
      }
    });

    if (prompts[0].variations.length > 0) {
      console.log('\n\n--- Variations ---');
      prompts[0].variations.forEach((v, i) => {
        console.log(`${i + 1}. ${v}`);
      });
    }

    await skill.close();
  } catch (error) {
    console.error('Error:', error);
    await skill.close();
    process.exit(1);
  }
}

async function useTemplate(args: string[]): Promise<void> {
  const nameIndex = args.findIndex(arg => !arg.startsWith('-'));
  if (nameIndex === -1) {
    console.error('Error: Template name is required');
    process.exit(1);
  }

  const templateName = args[nameIndex];
  let variables: Record<string, string> = {};
  let overrides: Partial<PromptRequest> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--var':
      case '--vars':
        try {
          variables = JSON.parse(nextArg);
        } catch {
          console.error('Error: Invalid JSON in --var');
          process.exit(1);
        }
        i++;
        break;
      case '-p':
      case '--platform':
        overrides.platform = nextArg as ImagePlatform;
        i++;
        break;
      case '-s':
      case '--style':
        overrides.style = nextArg as ArtStyle;
        i++;
        break;
      case '-m':
      case '--mood':
        overrides.mood = nextArg as Mood;
        i++;
        break;
    }
  }

  try {
    const result = await skill.generateFromTemplate(templateName, variables, overrides.platform, overrides);

    console.log(`\nGenerated from template: ${templateName}`);
    console.log(`Subject: ${result.subject}`);
    console.log(`\n--- Prompt ---`);
    console.log(result.prompt);

    if (result.negativePrompt) {
      console.log(`\nNegative: ${result.negativePrompt}`);
    }

    if (Object.keys(result.parameters).length > 0) {
      console.log('\nParameters:');
      for (const [key, value] of Object.entries(result.parameters)) {
        console.log(`  ${key}: ${value}`);
      }
    }

    // Show full command for Midjourney
    if (result.platform === 'midjourney') {
      const formatted = skill.formatPromptWithParameters(result.prompt, result.platform, result.parameters);
      console.log(`\nFull Command:`);
      console.log(formatted);
    }

    await skill.close();
  } catch (error) {
    console.error('Error:', error);
    await skill.close();
    process.exit(1);
  }
}

async function listTemplates(args: string[]): Promise<void> {
  let category: string | undefined;
  let platform: ImagePlatform | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--category') {
      category = nextArg;
      i++;
    } else if (arg === '--platform') {
      platform = nextArg as ImagePlatform;
      i++;
    }
  }

  try {
    const templates = await skill.getTemplates(category, platform);

    console.log('\nAvailable Templates:');
    console.log('===================\n');

    const grouped = templates.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    }, {} as Record<string, typeof templates>);

    for (const [cat, temps] of Object.entries(grouped)) {
      console.log(`\n${cat.toUpperCase()}:`);
      temps.forEach(t => {
        console.log(`  ${t.name} (${t.platform})`);
        console.log(`    ${t.description}`);
        console.log(`    Variables: ${t.variables.join(', ')}`);
      });
    }

    await skill.close();
  } catch (error) {
    console.error('Error:', error);
    await skill.close();
    process.exit(1);
  }
}

async function showHistory(args: string[]): Promise<void> {
  let limit = 10;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit') {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  try {
    const history = await skill.getHistory(limit);

    console.log(`\nPrompt History (last ${history.length}):`);
    console.log('=====================================\n');

    history.forEach((h, index) => {
      console.log(`\n${index + 1}. ${h.subject}`);
      console.log(`   Platform: ${h.platform} | Style: ${h.style || 'none'} | Quality: ${h.quality}`);
      console.log(`   Prompt: ${h.prompt.substring(0, 100)}${h.prompt.length > 100 ? '...' : ''}`);
      console.log(`   Created: ${new Date(h.createdAt).toLocaleString()}`);
    });

    await skill.close();
  } catch (error) {
    console.error('Error:', error);
    await skill.close();
    process.exit(1);
  }
}

async function listStyles(): Promise<void> {
  const styles = skill.getAvailableStyles();
  console.log('\nAvailable Art Styles:');
  console.log('====================\n');
  styles.forEach(s => console.log(`  - ${s}`));
  await skill.close();
}

async function listMoods(): Promise<void> {
  const moods = skill.getAvailableMoods();
  console.log('\nAvailable Moods:');
  console.log('===============\n');
  moods.forEach(m => console.log(`  - ${m}`));
  await skill.close();
}

async function listLighting(): Promise<void> {
  const lighting = skill.getAvailableLighting();
  console.log('\nAvailable Lighting Options:');
  console.log('==========================\n');
  lighting.forEach(l => console.log(`  - ${l}`));
  await skill.close();
}

async function listPerspectives(): Promise<void> {
  const perspectives = skill.getAvailablePerspectives();
  console.log('\nAvailable Camera Angles:');
  console.log('=======================\n');
  perspectives.forEach(p => console.log(`  - ${p}`));
  await skill.close();
}

async function listPlatforms(): Promise<void> {
  const platforms = skill.getAvailablePlatforms();
  console.log('\nSupported Platforms:');
  console.log('===================\n');
  platforms.forEach(p => {
    const params = skill.getPlatformParameters(p);
    console.log(`  - ${p}`);
    if (Object.keys(params).length > 0) {
      console.log(`    Parameters: ${Object.keys(params).join(', ')}`);
    }
  });
  await skill.close();
}

async function listAspectRatios(): Promise<void> {
  const ratios = skill.getAvailableAspectRatios();
  console.log('\nAvailable Aspect Ratios:');
  console.log('=======================\n');
  ratios.forEach(r => console.log(`  - ${r}`));
  await skill.close();
}

async function showParameters(args: string[]): Promise<void> {
  const platformIndex = args.findIndex(arg => !arg.startsWith('-'));
  if (platformIndex === -1) {
    console.error('Error: Platform name is required');
    process.exit(1);
  }

  const platform = args[platformIndex] as ImagePlatform;
  const params = skill.getPlatformParameters(platform);

  console.log(`\n${platform} Parameters:`);
  console.log('=====================\n');

  for (const [key, config] of Object.entries(params)) {
    console.log(`  --${key}`);
    console.log(`    Type: ${config.type}`);
    console.log(`    Default: ${config.default}`);
    console.log(`    ${config.description}`);
    console.log('');
  }

  await skill.close();
}

async function showStats(): Promise<void> {
  try {
    const stats = await skill.getStats();

    console.log('\nGeneration Statistics:');
    console.log('=====================\n');
    console.log(`Total Prompts Generated: ${stats.totalGenerated}`);

    console.log('\nBy Platform:');
    for (const [platform, count] of Object.entries(stats.byPlatform)) {
      console.log(`  ${platform}: ${count}`);
    }

    console.log('\nBy Style:');
    for (const [style, count] of Object.entries(stats.byStyle)) {
      console.log(`  ${style}: ${count}`);
    }

    await skill.close();
  } catch (error) {
    console.error('Error:', error);
    await skill.close();
    process.exit(1);
  }
}

async function checkHealth(): Promise<void> {
  try {
    const health = await skill.healthCheck();
    console.log(`\nHealth Status: ${health.healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
    console.log(`Message: ${health.message}`);
    await skill.close();
    process.exit(health.healthy ? 0 : 1);
  } catch (error) {
    console.error('Error:', error);
    await skill.close();
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    await skill.close();
    return;
  }

  switch (command) {
    case 'generate':
    case 'g':
      await generatePrompts(args.slice(1));
      break;
    case 'template':
    case 't':
      await useTemplate(args.slice(1));
      break;
    case 'templates':
      await listTemplates(args.slice(1));
      break;
    case 'history':
    case 'h':
      await showHistory(args.slice(1));
      break;
    case 'styles':
      await listStyles();
      break;
    case 'moods':
      await listMoods();
      break;
    case 'lighting':
      await listLighting();
      break;
    case 'perspectives':
      await listPerspectives();
      break;
    case 'platforms':
      await listPlatforms();
      break;
    case 'aspect-ratios':
      await listAspectRatios();
      break;
    case 'parameters':
    case 'params':
      await showParameters(args.slice(1));
      break;
    case 'stats':
      await showStats();
      break;
    case 'health':
      await checkHealth();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      await skill.close();
      process.exit(1);
  }
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await skill.close();
  process.exit(1);
});
