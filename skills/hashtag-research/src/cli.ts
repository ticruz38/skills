#!/usr/bin/env node

import { HashtagResearchSkill, ResearchRequest, NicheRequest, SocialPlatform, HashtagCategory } from './index';

const skill = new HashtagResearchSkill();

function formatHashtag(tag: string): string {
  return tag.startsWith('#') ? tag : `#${tag}`;
}

function printHashtagList(hashtags: Array<{ tag: string; trendingScore: number; competitionLevel: string; category: string }>, title: string): void {
  console.log(`\n${title}:`);
  console.log('-'.repeat(60));
  
  if (hashtags.length === 0) {
    console.log('No hashtags found.');
    return;
  }

  hashtags.forEach((h, i) => {
    const score = `⭐ ${h.trendingScore.toFixed(1)}`;
    const comp = `[${h.competitionLevel}]`;
    console.log(`${(i + 1).toString().padStart(2)}. ${formatHashtag(h.tag).padEnd(20)} ${score.padEnd(10)} ${comp.padEnd(10)} ${h.category}`);
  });
}

async function researchCommand(args: string[]): Promise<void> {
  const keywords: string[] = [];
  let platform: SocialPlatform = 'generic';
  let category: HashtagCategory | undefined;
  let limit = 30;
  let includeTrending = true;
  let includeNiche = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--platform' || arg === '-p') {
      platform = args[++i] as SocialPlatform;
    } else if (arg === '--category' || arg === '-c') {
      category = args[++i] as HashtagCategory;
    } else if (arg === '--limit' || arg === '-l') {
      limit = parseInt(args[++i], 10);
    } else if (arg === '--no-trending') {
      includeTrending = false;
    } else if (arg === '--no-niche') {
      includeNiche = false;
    } else if (!arg.startsWith('-')) {
      keywords.push(arg);
    }
  }

  if (keywords.length === 0) {
    console.error('Error: Please provide at least one keyword.');
    console.log('Usage: research <keyword> [keyword2...] [options]');
    console.log('Options:');
    console.log('  -p, --platform    Platform (instagram, twitter, tiktok, linkedin, facebook)');
    console.log('  -c, --category    Category filter');
    console.log('  -l, --limit       Maximum results (default: 30)');
    console.log('  --no-trending     Exclude trending hashtags');
    console.log('  --no-niche        Exclude niche hashtags');
    process.exit(1);
  }

  console.log(`🔍 Researching hashtags for: ${keywords.join(', ')}`);
  console.log(`Platform: ${platform}`);
  if (category) console.log(`Category: ${category}`);

  const result = await skill.research({
    keywords,
    platform,
    category,
    limit,
    includeTrending,
    includeNiche,
  });

  printHashtagList(result.hashtags, `Recommended Hashtags (${result.hashtags.length})`);
  
  if (includeTrending && result.trending.length > 0) {
    printHashtagList(result.trending, 'Trending');
  }
  
  if (includeNiche && result.niche.length > 0) {
    printHashtagList(result.niche, 'Niche (Low Competition)');
  }

  if (result.relatedKeywords.length > 0) {
    console.log('\nRelated Keywords:');
    console.log(result.relatedKeywords.join(', '));
  }

  console.log(`\nGenerated at: ${result.generatedAt}`);
}

async function suggestCommand(args: string[]): Promise<void> {
  const contentParts: string[] = [];
  let platform: SocialPlatform = 'generic';
  let limit = 15;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--platform' || arg === '-p') {
      platform = args[++i] as SocialPlatform;
    } else if (arg === '--limit' || arg === '-l') {
      limit = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      contentParts.push(arg);
    }
  }

  const content = contentParts.join(' ');
  
  if (!content) {
    console.error('Error: Please provide content to analyze.');
    console.log('Usage: suggest <content> [options]');
    console.log('Options:');
    console.log('  -p, --platform    Platform (instagram, twitter, tiktok, linkedin, facebook)');
    console.log('  -l, --limit       Maximum results (default: 15)');
    process.exit(1);
  }

  console.log('📝 Analyzing content for hashtag suggestions...\n');
  console.log(`Content: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
  console.log(`Platform: ${platform}\n`);

  const hashtags = await skill.suggestHashtags(content, platform, limit);
  
  printHashtagList(hashtags, `Suggested Hashtags (${hashtags.length})`);
  
  // Output as copy-paste ready string
  if (hashtags.length > 0) {
    console.log('\nCopy-paste ready:');
    console.log(hashtags.map(h => formatHashtag(h.tag)).join(' '));
  }
}

async function trendingCommand(args: string[]): Promise<void> {
  let platform: SocialPlatform = 'generic';
  let category: HashtagCategory | undefined;
  let limit = 20;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--platform' || arg === '-p') {
      platform = args[++i] as SocialPlatform;
    } else if (arg === '--category' || arg === '-c') {
      category = args[++i] as HashtagCategory;
    } else if (arg === '--limit' || arg === '-l') {
      limit = parseInt(args[++i], 10);
    }
  }

  console.log(`📈 Trending Hashtags`);
  console.log(`Platform: ${platform}`);
  if (category) console.log(`Category: ${category}`);
  console.log();

  const hashtags = await skill.getTrending(platform, category, limit);
  printHashtagList(hashtags, `Top ${hashtags.length} Trending`);
}

async function nicheCommand(args: string[]): Promise<void> {
  const topicParts: string[] = [];
  let platform: SocialPlatform = 'generic';
  let depth = 20;
  let maxCompetition: 'low' | 'medium' | 'high' = 'medium';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--platform' || arg === '-p') {
      platform = args[++i] as SocialPlatform;
    } else if (arg === '--depth' || arg === '-d') {
      depth = parseInt(args[++i], 10);
    } else if (arg === '--max-competition') {
      maxCompetition = args[++i] as 'low' | 'medium' | 'high';
    } else if (!arg.startsWith('-')) {
      topicParts.push(arg);
    }
  }

  const topic = topicParts.join(' ');

  if (!topic) {
    console.error('Error: Please provide a topic to explore.');
    console.log('Usage: niche <topic> [options]');
    console.log('Options:');
    console.log('  -p, --platform          Platform (instagram, twitter, tiktok, linkedin, facebook)');
    console.log('  -d, --depth             Number of results (default: 20)');
    console.log('  --max-competition       Max competition level (low, medium, high)');
    process.exit(1);
  }

  console.log(`🎯 Discovering Niche Hashtags`);
  console.log(`Topic: ${topic}`);
  console.log(`Platform: ${platform}`);
  console.log(`Max Competition: ${maxCompetition}\n`);

  const hashtags = await skill.discoverNiches({
    topic,
    platform,
    depth,
    maxCompetition,
  });

  printHashtagList(hashtags, `Niche Hashtags (${hashtags.length})`);
}

async function addCommand(args: string[]): Promise<void> {
  let tag = '';
  let category: HashtagCategory = 'general';
  let platform: SocialPlatform = 'generic';
  let competition: 'low' | 'medium' | 'high' = 'medium';
  let related: string[] = [];
  let trendingScore = 50;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tag' || arg === '-t') {
      tag = args[++i];
    } else if (arg === '--category' || arg === '-c') {
      category = args[++i] as HashtagCategory;
    } else if (arg === '--platform' || arg === '-p') {
      platform = args[++i] as SocialPlatform;
    } else if (arg === '--competition') {
      competition = args[++i] as 'low' | 'medium' | 'high';
    } else if (arg === '--related' || arg === '-r') {
      related = args[++i].split(',').map(s => s.trim());
    } else if (arg === '--score' || arg === '-s') {
      trendingScore = parseFloat(args[++i]);
    }
  }

  if (!tag) {
    console.error('Error: Please provide a hashtag tag.');
    console.log('Usage: add --tag <hashtag> [options]');
    console.log('Options:');
    console.log('  -c, --category       Category (default: general)');
    console.log('  -p, --platform       Platform (default: generic)');
    console.log('  --competition        Competition level (low, medium, high)');
    console.log('  -r, --related        Comma-separated related tags');
    console.log('  -s, --score          Trending score (0-100)');
    process.exit(1);
  }

  // Clean the tag
  tag = tag.toLowerCase().replace(/^#/, '').replace(/[^\w]/g, '');

  const id = await skill.addCustomHashtag({
    tag,
    platform,
    category,
    competitionLevel: competition,
    trendingScore,
    relatedTags: related,
  });

  console.log(`✅ Added hashtag: #${tag} (ID: ${id})`);
}

async function statsCommand(): Promise<void> {
  const stats = await skill.getStats();

  console.log('📊 Hashtag Research Statistics\n');
  console.log(`Total Hashtags: ${stats.totalHashtags}`);
  console.log(`Total Searches: ${stats.totalSearches}\n`);

  console.log('By Category:');
  console.log('-'.repeat(30));
  Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  ${cat.padEnd(15)} ${count}`);
    });

  console.log('\nBy Competition Level:');
  console.log('-'.repeat(30));
  Object.entries(stats.byCompetition)
    .forEach(([level, count]) => {
      console.log(`  ${level.padEnd(15)} ${count}`);
    });
}

async function historyCommand(args: string[]): Promise<void> {
  const limit = parseInt(args[0] || '20', 10);
  const history = await skill.getSearchHistory(limit);

  console.log(`📜 Search History (last ${history.length})\n`);
  
  if (history.length === 0) {
    console.log('No search history found.');
    return;
  }

  history.forEach((h, i) => {
    const date = new Date(h.createdAt).toLocaleString();
    console.log(`${(i + 1).toString().padStart(2)}. [${h.platform}] "${h.query}" - ${date}`);
  });
}

async function categoriesCommand(): Promise<void> {
  const categories: HashtagCategory[] = [
    'general', 'lifestyle', 'business', 'tech', 'fashion', 'food', 
    'travel', 'fitness', 'art', 'photography', 'music', 'sports', 
    'health', 'education', 'marketing', 'entrepreneur'
  ];

  console.log('📂 Available Categories:\n');
  categories.forEach((cat, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${cat}`);
  });
}

async function platformsCommand(): Promise<void> {
  const platforms: { name: SocialPlatform; description: string }[] = [
    { name: 'instagram', description: 'Instagram hashtags' },
    { name: 'twitter', description: 'Twitter/X hashtags' },
    { name: 'tiktok', description: 'TikTok hashtags' },
    { name: 'linkedin', description: 'LinkedIn hashtags' },
    { name: 'facebook', description: 'Facebook hashtags' },
    { name: 'generic', description: 'Platform-agnostic' },
  ];

  console.log('📱 Supported Platforms:\n');
  platforms.forEach(p => {
    console.log(`  ${p.name.padEnd(12)} ${p.description}`);
  });
}

async function healthCommand(): Promise<void> {
  const health = await skill.healthCheck();
  
  console.log('🏥 Health Check\n');
  if (health.status === 'ok') {
    console.log('✅ Status: OK');
  } else {
    console.log('❌ Status: Error');
  }
  console.log(`Message: ${health.message}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log('Hashtag Research Skill - Find trending and relevant hashtags\n');
    console.log('Commands:');
    console.log('  research <keyword> [keywords...]  Research hashtags by keywords');
    console.log('  suggest <content>                 Suggest hashtags for content');
    console.log('  trending                          Show trending hashtags');
    console.log('  niche <topic>                     Discover niche hashtags');
    console.log('  add --tag <hashtag>               Add custom hashtag');
    console.log('  stats                             Show database statistics');
    console.log('  history                           Show search history');
    console.log('  categories                        List available categories');
    console.log('  platforms                         List supported platforms');
    console.log('  health                            Check system health');
    console.log('  help                              Show this help message\n');
    console.log('Global Options:');
    console.log('  -p, --platform <platform>         Set platform (instagram, twitter, etc.)');
    console.log('  -c, --category <category>         Filter by category');
    console.log('  -l, --limit <number>              Limit results\n');
    console.log('Examples:');
    console.log('  research fitness workout -p instagram -l 20');
    console.log('  suggest "Check out my new workout routine!" -p instagram');
    console.log('  trending -c fitness -l 10');
    console.log('  niche "vegan recipes" --max-competition low');
    process.exit(0);
  }

  try {
    await skill.initialize();

    switch (command) {
      case 'research':
      case 'r':
        await researchCommand(args.slice(1));
        break;
      case 'suggest':
      case 's':
        await suggestCommand(args.slice(1));
        break;
      case 'trending':
      case 't':
        await trendingCommand(args.slice(1));
        break;
      case 'niche':
      case 'n':
        await nicheCommand(args.slice(1));
        break;
      case 'add':
      case 'a':
        await addCommand(args.slice(1));
        break;
      case 'stats':
        await statsCommand();
        break;
      case 'history':
      case 'h':
        await historyCommand(args.slice(1));
        break;
      case 'categories':
        await categoriesCommand();
        break;
      case 'platforms':
        await platformsCommand();
        break;
      case 'health':
        await healthCommand();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.log('Run "hashtag-research help" for usage information.');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
