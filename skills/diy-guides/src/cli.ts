#!/usr/bin/env node

import { DIYGuidesSkill, DifficultyLevel, RepairCategory, DIYGuide } from './index';

const difficultyColors: Record<DifficultyLevel, string> = {
  easy: '\x1b[32m',    // Green
  medium: '\x1b[33m', // Yellow
  hard: '\x1b[31m'    // Red
};

const categoryIcons: Record<RepairCategory, string> = {
  plumbing: '🔧',
  electrical: '⚡',
  appliance: '🔌',
  furniture: '🪑',
  outdoor: '🌳',
  automotive: '🚗',
  painting: '🎨',
  flooring: '🏠',
  hvac: '❄️',
  general: '🔨'
};

const resetColor = '\x1b[0m';

function printGuide(guide: DIYGuide): void {
  const categoryIcon = categoryIcons[guide.category] || '🔨';
  const diffColor = difficultyColors[guide.difficulty] || '';
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${categoryIcon} ${guide.title}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Description: ${guide.description}`);
  console.log(`Category: ${guide.category}`);
  console.log(`Difficulty: ${diffColor}${guide.difficulty.toUpperCase()}${resetColor}`);
  console.log(`Time: ${guide.estimatedTime}`);
  console.log(`Cost: ${guide.costEstimate || 'N/A'}`);
  console.log(`Skill Level: ${guide.skillLevel || 'N/A'}`);
  
  console.log(`\n📋 Tools Needed:`);
  guide.tools.forEach((tool: string) => console.log(`  • ${tool}`));
  
  console.log(`\n📦 Materials:`);
  guide.materials.forEach((material: string) => console.log(`  • ${material}`));
  
  console.log(`\n📖 Steps:`);
  guide.steps.forEach((step) => {
    console.log(`\n  Step ${step.stepNumber}: ${step.title}`);
    console.log(`    ${step.description}`);
  });
  
  if (guide.videoLinks && guide.videoLinks.length > 0) {
    console.log(`\n🎥 Video Resources:`);
    guide.videoLinks.forEach((video) => {
      console.log(`  • ${video.title} (${video.platform})${video.duration ? ` - ${video.duration}` : ''}`);
      console.log(`    ${video.url}`);
    });
  }
  
  if (guide.tips && guide.tips.length > 0) {
    console.log(`\n💡 Pro Tips:`);
    guide.tips.forEach((tip: string) => console.log(`  💡 ${tip}`));
  }
  
  if (guide.warnings && guide.warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    guide.warnings.forEach((warning: string) => console.log(`  ⚠️  ${warning}`));
  }
  
  console.log(`\n${'='.repeat(60)}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const skill = new DIYGuidesSkill();

  try {
    switch (command) {
      case 'health':
      case 'status': {
        const health = await skill.healthCheck();
        console.log(health.healthy ? '✅' : '❌', health.message);
        break;
      }

      case 'list':
      case 'ls': {
        const guides = await skill.listGuides();
        console.log(`\n📚 DIY Repair Guides (${guides.length} total)\n`);
        console.log('ID  Category     Difficulty  Title');
        console.log('-'.repeat(70));
        guides.forEach(guide => {
          const diffColor = difficultyColors[guide.difficulty];
          console.log(
            `${String(guide.id).padEnd(3)} ` +
            `${guide.category.padEnd(12)} ` +
            `${diffColor}${guide.difficulty.padEnd(10)}${resetColor} ` +
            `${guide.title}`
          );
        });
        break;
      }

      case 'get':
      case 'view':
      case 'show': {
        const id = parseInt(args[1]);
        if (!id) {
          console.error('Usage: diy-guides get <id>');
          process.exit(1);
        }
        const guide = await skill.getGuide(id);
        if (guide) {
          printGuide(guide);
        } else {
          console.log(`Guide with ID ${id} not found.`);
        }
        break;
      }

      case 'search':
      case 'find': {
        const term = args.slice(1).join(' ');
        if (!term) {
          console.error('Usage: diy-guides search <search term>');
          process.exit(1);
        }
        const guides = await skill.searchGuides({ searchTerm: term });
        console.log(`\n🔍 Search results for "${term}" (${guides.length} found)\n`);
        if (guides.length === 0) {
          console.log('No guides found matching your search.');
        } else {
          guides.forEach(guide => {
            console.log(`${guide.id}. ${categoryIcons[guide.category]} ${guide.title} [${guide.difficulty}]`);
          });
        }
        break;
      }

      case 'category':
      case 'cat': {
        const category = args[1] as RepairCategory;
        if (!category) {
          console.error('Usage: diy-guides category <category>');
          console.log('\nAvailable categories:');
          Object.keys(categoryIcons).forEach(cat => console.log(`  • ${cat}`));
          process.exit(1);
        }
        const guides = await skill.getGuidesByCategory(category);
        console.log(`\n${categoryIcons[category] || '🔨'} ${category} Guides (${guides.length})\n`);
        if (guides.length === 0) {
          console.log('No guides found in this category.');
        } else {
          guides.forEach(guide => {
            console.log(`${guide.id}. ${guide.title} [${guide.difficulty}] - ${guide.estimatedTime}`);
          });
        }
        break;
      }

      case 'difficulty':
      case 'diff': {
        const difficulty = args[1] as DifficultyLevel;
        if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
          console.error('Usage: diy-guides difficulty <easy|medium|hard>');
          process.exit(1);
        }
        const guides = await skill.getGuidesByDifficulty(difficulty);
        const color = difficultyColors[difficulty];
        console.log(`\n${color}${difficulty.toUpperCase()}${resetColor} Difficulty Guides (${guides.length})\n`);
        if (guides.length === 0) {
          console.log('No guides found at this difficulty level.');
        } else {
          guides.forEach(guide => {
            console.log(`${guide.id}. ${categoryIcons[guide.category]} ${guide.title} - ${guide.estimatedTime}`);
          });
        }
        break;
      }

      case 'categories': {
        const categories = await skill.getCategories();
        console.log('\n📂 Categories\n');
        categories.forEach(({ category, count }) => {
          console.log(`  ${categoryIcons[category] || '🔨'} ${category.padEnd(12)} ${count} guides`);
        });
        break;
      }

      case 'difficulties': {
        const difficulties = await skill.getDifficultyStats();
        console.log('\n📊 Difficulty Distribution\n');
        difficulties.forEach(({ difficulty, count }) => {
          const color = difficultyColors[difficulty];
          console.log(`  ${color}${difficulty.padEnd(10)}${resetColor} ${count} guides`);
        });
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        console.log('\n📈 DIY Guides Statistics\n');
        console.log(`Total Guides: ${stats.total}`);
        console.log('\nBy Category:');
        stats.byCategory.forEach(({ category, count }) => {
          console.log(`  ${categoryIcons[category] || '🔨'} ${category}: ${count}`);
        });
        console.log('\nBy Difficulty:');
        stats.byDifficulty.forEach(({ difficulty, count }) => {
          const color = difficultyColors[difficulty];
          console.log(`  ${color}${difficulty}${resetColor}: ${count}`);
        });
        break;
      }

      case 'tools': {
        const id = parseInt(args[1]);
        if (!id) {
          console.error('Usage: diy-guides tools <guide-id>');
          process.exit(1);
        }
        const guide = await skill.getGuide(id);
        if (guide) {
          console.log(`\n🔧 Tools for: ${guide.title}\n`);
          guide.tools.forEach((tool, i) => console.log(`  ${i + 1}. ${tool}`));
        } else {
          console.log(`Guide with ID ${id} not found.`);
        }
        break;
      }

      case 'materials': {
        const id = parseInt(args[1]);
        if (!id) {
          console.error('Usage: diy-guides materials <guide-id>');
          process.exit(1);
        }
        const guide = await skill.getGuide(id);
        if (guide) {
          console.log(`\n📦 Materials for: ${guide.title}\n`);
          guide.materials.forEach((material, i) => console.log(`  ${i + 1}. ${material}`));
        } else {
          console.log(`Guide with ID ${id} not found.`);
        }
        break;
      }

      case 'steps': {
        const id = parseInt(args[1]);
        if (!id) {
          console.error('Usage: diy-guides steps <guide-id>');
          process.exit(1);
        }
        const guide = await skill.getGuide(id);
        if (guide) {
          console.log(`\n📖 Steps for: ${guide.title}\n`);
          guide.steps.forEach(step => {
            console.log(`\nStep ${step.stepNumber}: ${step.title}`);
            console.log(`  ${step.description}`);
          });
        } else {
          console.log(`Guide with ID ${id} not found.`);
        }
        break;
      }

      case 'tips': {
        const id = parseInt(args[1]);
        if (!id) {
          console.error('Usage: diy-guides tips <guide-id>');
          process.exit(1);
        }
        const guide = await skill.getGuide(id);
        if (guide && guide.tips) {
          console.log(`\n💡 Pro Tips for: ${guide.title}\n`);
          guide.tips.forEach((tip, i) => console.log(`  ${i + 1}. ${tip}`));
        } else {
          console.log(guide ? 'No tips available for this guide.' : `Guide with ID ${id} not found.`);
        }
        break;
      }

      case 'warnings': {
        const id = parseInt(args[1]);
        if (!id) {
          console.error('Usage: diy-guides warnings <guide-id>');
          process.exit(1);
        }
        const guide = await skill.getGuide(id);
        if (guide && guide.warnings) {
          console.log(`\n⚠️  Warnings for: ${guide.title}\n`);
          guide.warnings.forEach((warning, i) => console.log(`  ${i + 1}. ${warning}`));
        } else {
          console.log(guide ? 'No warnings for this guide.' : `Guide with ID ${id} not found.`);
        }
        break;
      }

      case 'videos': {
        const id = parseInt(args[1]);
        if (!id) {
          console.error('Usage: diy-guides videos <guide-id>');
          process.exit(1);
        }
        const guide = await skill.getGuide(id);
        if (guide && guide.videoLinks) {
          console.log(`\n🎥 Videos for: ${guide.title}\n`);
          guide.videoLinks.forEach((video, i) => {
            console.log(`  ${i + 1}. ${video.title}`);
            console.log(`     Platform: ${video.platform}`);
            if (video.duration) console.log(`     Duration: ${video.duration}`);
            console.log(`     URL: ${video.url}`);
          });
        } else {
          console.log(guide ? 'No videos available for this guide.' : `Guide with ID ${id} not found.`);
        }
        break;
      }

      case 'help':
      default: {
        console.log(`
DIY Guides - Step-by-Step Home Repair Guides

Usage: diy-guides <command> [options]

Commands:
  health/status              Check system health
  list/ls                    List all guides
  get/view/show <id>         View complete guide details
  search/find <term>         Search guides by title/description
  category/cat <category>    Filter by category
  difficulty/diff <level>    Filter by difficulty (easy/medium/hard)
  categories                 List all categories
  difficulties               Show difficulty distribution
  stats                      Show system statistics
  
Guide Details:
  tools <id>                 Show tools needed
  materials <id>             Show materials needed
  steps <id>                 Show step-by-step instructions
  tips <id>                  Show pro tips
  warnings <id>              Show safety warnings
  videos <id>                Show video resources

Categories: ${Object.keys(categoryIcons).join(', ')}

Examples:
  diy-guides list
  diy-guides get 1
  diy-guides search "faucet"
  diy-guides category plumbing
  diy-guides difficulty easy
  diy-guides tools 1
`);
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
