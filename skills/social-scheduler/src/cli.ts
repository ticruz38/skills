#!/usr/bin/env node
/**
 * Social Scheduler CLI
 * Command-line interface for managing social media post scheduling
 */

import { SocialSchedulerSkill, SocialPlatform, PostStatus } from './index';

const PLATFORMS: SocialPlatform[] = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'generic'];

function printUsage() {
  console.log(`
Social Scheduler CLI

Usage:
  npm run cli -- <command> [options]

Commands:
  queue <content> --platform <platform> --when <time>  Queue a new post
  list [status]                                       List queued posts
  get <id>                                            Get post details
  approve <id> [--by <name>] [--notes <text>]         Approve a pending post
  reject <id> [--by <name>] [--reason <text>]         Reject a pending post
  update <id> [--content <text>] [--when <time>]      Update a post
  cancel <id>                                         Cancel a post
  delete <id>                                         Delete a post permanently
  due                                                 List posts due for publishing
  optimal-times <platform>                            Show optimal posting times
  suggest-time <platform>                             Suggest next optimal time
  stats                                               Show queue statistics
  health                                              Check system health

Options:
  --platform, -p    Target platform (twitter, linkedin, facebook, instagram, youtube)
  --when, -w        Scheduled time (ISO datetime, "tomorrow 9am", "in 2 hours", etc.)
  --approval        Require approval before publishing
  --by              Name of approver/rejector
  --notes, --reason Notes or reason for action
  --content         Post content
  --limit           Limit number of results
  --offset          Offset for pagination

Examples:
  npm run cli -- queue "Hello world!" -p twitter -w "tomorrow 9am"
  npm run cli -- queue "Check this out!" -p linkedin -w "2026-02-15 14:00" --approval
  npm run cli -- list scheduled
  npm run cli -- approve 5 --by "John Doe" --notes "Looks good!"
  npm run cli -- optimal-times twitter
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const skill = new SocialSchedulerSkill();

  try {
    const command = args[0];

    switch (command) {
      case 'queue':
      case 'add': {
        const contentIndex = args.findIndex(a => !a.startsWith('--') && a !== command);
        if (contentIndex === -1) {
          console.error('Error: Content required');
          process.exit(1);
        }
        const content = args[contentIndex];

        const platformIdx = args.indexOf('--platform') !== -1 ? args.indexOf('--platform') : args.indexOf('-p');
        if (platformIdx === -1 || !args[platformIdx + 1]) {
          console.error('Error: --platform required');
          process.exit(1);
        }
        const platform = args[platformIdx + 1] as SocialPlatform;
        if (!PLATFORMS.includes(platform)) {
          console.error(`Error: Invalid platform. Use: ${PLATFORMS.join(', ')}`);
          process.exit(1);
        }

        const whenIdx = args.indexOf('--when') !== -1 ? args.indexOf('--when') : args.indexOf('-w');
        let scheduledAt: Date;
        if (whenIdx === -1 || !args[whenIdx + 1]) {
          // Use next optimal time
          scheduledAt = skill.getNextOptimalTime(platform);
          console.log(`No time specified, using optimal time: ${scheduledAt.toLocaleString()}`);
        } else {
          scheduledAt = skill.parseNaturalDateTime(args[whenIdx + 1]);
        }

        const requiresApproval = args.includes('--approval');

        const post = await skill.queuePost({
          content,
          platform,
          scheduledAt,
          requiresApproval,
        });

        console.log('✓ Post queued successfully');
        console.log(`  ID: ${post.id}`);
        console.log(`  Platform: ${post.platform}`);
        console.log(`  Scheduled: ${new Date(post.scheduledAt).toLocaleString()}`);
        console.log(`  Status: ${post.status}`);
        if (post.requiresApproval) {
          console.log(`  ⚠️  Requires approval before publishing`);
        }
        break;
      }

      case 'list': {
        const options: { status?: PostStatus; platform?: SocialPlatform; limit?: number; offset?: number; upcoming?: boolean } = {};
        
        // Check for status argument
        if (args[1] && !args[1].startsWith('--')) {
          options.status = args[1] as PostStatus;
        }

        const platformIdx = args.indexOf('--platform') !== -1 ? args.indexOf('--platform') : args.indexOf('-p');
        if (platformIdx !== -1 && args[platformIdx + 1]) {
          options.platform = args[platformIdx + 1] as SocialPlatform;
        }

        const limitIdx = args.indexOf('--limit');
        if (limitIdx !== -1 && args[limitIdx + 1]) {
          options.limit = parseInt(args[limitIdx + 1]);
        }

        const offsetIdx = args.indexOf('--offset');
        if (offsetIdx !== -1 && args[offsetIdx + 1]) {
          options.offset = parseInt(args[offsetIdx + 1]);
        }

        if (args.includes('--upcoming')) {
          options.upcoming = true;
        }

        const posts = await skill.listPosts(options);

        if (posts.length === 0) {
          console.log('No posts found');
          break;
        }

        console.log(`Found ${posts.length} post(s):\n`);
        console.log('ID  | Platform  | Status            | Scheduled           | Content');
        console.log('-'.repeat(100));

        for (const post of posts) {
          const scheduled = new Date(post.scheduledAt).toLocaleString();
          const shortContent = post.content.length > 40 ? post.content.substring(0, 40) + '...' : post.content;
          const status = post.status.padEnd(17);
          console.log(`${post.id.toString().padStart(3)} | ${post.platform.padEnd(9)} | ${status} | ${scheduled.padEnd(19)} | ${shortContent}`);
        }
        break;
      }

      case 'get': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid post ID required');
          process.exit(1);
        }

        const post = await skill.getPost(id);
        if (!post) {
          console.error(`Error: Post ${id} not found`);
          process.exit(1);
        }

        console.log(`Post #${post.id}`);
        console.log('=' .repeat(50));
        console.log(`Content: ${post.content}`);
        console.log(`Platform: ${post.platform}`);
        console.log(`Status: ${post.status}`);
        console.log(`Scheduled: ${new Date(post.scheduledAt).toLocaleString()}`);
        console.log(`Requires Approval: ${post.requiresApproval ? 'Yes' : 'No'}`);
        if (post.approvedAt) {
          console.log(`Approved: ${new Date(post.approvedAt).toLocaleString()} by ${post.approvedBy}`);
        }
        if (post.publishedAt) {
          console.log(`Published: ${new Date(post.publishedAt).toLocaleString()}`);
        }
        if (post.publishError) {
          console.log(`Error: ${post.publishError}`);
        }
        console.log(`Created: ${new Date(post.createdAt).toLocaleString()}`);
        console.log(`Updated: ${new Date(post.updatedAt).toLocaleString()}`);

        // Show approval history
        const approvalHistory = await skill.getApprovalHistory(id);
        if (approvalHistory.length > 0) {
          console.log('\nApproval History:');
          for (const log of approvalHistory) {
            console.log(`  ${log.action} by ${log.performedBy || 'unknown'} at ${new Date(log.performedAt).toLocaleString()}`);
            if (log.notes) console.log(`    Note: ${log.notes}`);
          }
        }

        // Show publish history
        const publishHistory = await skill.getPublishHistory(id);
        if (publishHistory.length > 0) {
          console.log('\nPublish History:');
          for (const log of publishHistory) {
            const status = log.success ? '✓ success' : '✗ failed';
            console.log(`  ${status} at ${new Date(log.publishedAt).toLocaleString()}`);
            if (log.errorMessage) console.log(`    Error: ${log.errorMessage}`);
          }
        }
        break;
      }

      case 'approve': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid post ID required');
          process.exit(1);
        }

        const byIdx = args.indexOf('--by');
        const approvedBy = byIdx !== -1 ? args[byIdx + 1] : undefined;

        const notesIdx = args.indexOf('--notes');
        const notes = notesIdx !== -1 ? args[notesIdx + 1] : undefined;

        const post = await skill.approvePost(id, approvedBy, notes);
        console.log(`✓ Post #${post.id} approved`);
        console.log(`  Status: ${post.status}`);
        console.log(`  Scheduled for: ${new Date(post.scheduledAt).toLocaleString()}`);
        break;
      }

      case 'reject': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid post ID required');
          process.exit(1);
        }

        const byIdx = args.indexOf('--by');
        const rejectedBy = byIdx !== -1 ? args[byIdx + 1] : undefined;

        const reasonIdx = args.indexOf('--reason');
        const reason = reasonIdx !== -1 ? args[reasonIdx + 1] : undefined;

        const post = await skill.rejectPost(id, rejectedBy, reason);
        console.log(`✗ Post #${post.id} rejected`);
        console.log(`  Status: ${post.status}`);
        if (reason) console.log(`  Reason: ${reason}`);
        break;
      }

      case 'update': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid post ID required');
          process.exit(1);
        }

        const updates: { content?: string; scheduledAt?: Date } = {};

        const contentIdx = args.indexOf('--content');
        if (contentIdx !== -1 && args[contentIdx + 1]) {
          updates.content = args[contentIdx + 1];
        }

        const whenIdx = args.indexOf('--when') !== -1 ? args.indexOf('--when') : args.indexOf('-w');
        if (whenIdx !== -1 && args[whenIdx + 1]) {
          updates.scheduledAt = skill.parseNaturalDateTime(args[whenIdx + 1]);
        }

        if (!updates.content && !updates.scheduledAt) {
          console.error('Error: Nothing to update (use --content or --when)');
          process.exit(1);
        }

        const post = await skill.updatePost(id, updates);
        console.log(`✓ Post #${post.id} updated`);
        console.log(`  Content: ${post.content.substring(0, 50)}${post.content.length > 50 ? '...' : ''}`);
        console.log(`  Scheduled: ${new Date(post.scheduledAt).toLocaleString()}`);
        break;
      }

      case 'cancel': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid post ID required');
          process.exit(1);
        }

        const success = await skill.cancelPost(id);
        if (success) {
          console.log(`✓ Post #${id} cancelled`);
        } else {
          console.error(`Error: Post ${id} not found`);
          process.exit(1);
        }
        break;
      }

      case 'delete': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid post ID required');
          process.exit(1);
        }

        const success = await skill.deletePost(id);
        if (success) {
          console.log(`✓ Post #${id} deleted`);
        } else {
          console.error(`Error: Post ${id} not found`);
          process.exit(1);
        }
        break;
      }

      case 'due': {
        const posts = await skill.getDuePosts();
        
        if (posts.length === 0) {
          console.log('No posts due for publishing');
          break;
        }

        console.log(`${posts.length} post(s) due for publishing:\n`);
        for (const post of posts) {
          console.log(`#${post.id} - ${post.platform} - Scheduled: ${new Date(post.scheduledAt).toLocaleString()}`);
          console.log(`  "${post.content.substring(0, 60)}${post.content.length > 60 ? '...' : ''}"`);
          console.log();
        }
        break;
      }

      case 'optimal-times': {
        const platform = args[1] as SocialPlatform;
        if (!platform || !PLATFORMS.includes(platform)) {
          console.error(`Error: Valid platform required (${PLATFORMS.join(', ')})`);
          process.exit(1);
        }

        const times = skill.getOptimalTimes(platform);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        console.log(`Optimal posting times for ${platform}:\n`);
        console.log('Score | Day       | Time | Description');
        console.log('-'.repeat(60));

        for (const slot of times) {
          const timeStr = `${slot.hour.toString().padStart(2, '0')}:00`;
          console.log(`${slot.score.toString().padStart(5)} | ${days[slot.dayOfWeek].padEnd(9)} | ${timeStr} | ${slot.description}`);
        }
        break;
      }

      case 'suggest-time': {
        const platform = args[1] as SocialPlatform;
        if (!platform || !PLATFORMS.includes(platform)) {
          console.error(`Error: Valid platform required (${PLATFORMS.join(', ')})`);
          process.exit(1);
        }

        const nextTime = skill.getNextOptimalTime(platform);
        console.log(`Next optimal posting time for ${platform}:`);
        console.log(`  ${nextTime.toLocaleString()}`);
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        
        console.log('Queue Statistics');
        console.log('=' .repeat(40));
        console.log(`Total posts: ${stats.total}`);
        console.log(`Upcoming: ${stats.upcoming}`);
        console.log(`Overdue: ${stats.overdue}`);
        
        console.log('\nBy Status:');
        for (const [status, count] of Object.entries(stats.byStatus)) {
          if (count > 0) {
            console.log(`  ${status}: ${count}`);
          }
        }

        console.log('\nBy Platform:');
        for (const [platform, count] of Object.entries(stats.byPlatform)) {
          if (count > 0) {
            console.log(`  ${platform}: ${count}`);
          }
        }
        break;
      }

      case 'health': {
        const health = await skill.healthCheck();
        console.log(health.healthy ? '✓ Healthy' : '✗ Unhealthy');
        console.log(health.message);
        process.exit(health.healthy ? 0 : 1);
      }

      case 'help':
      case '--help':
      case '-h':
        printUsage();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
