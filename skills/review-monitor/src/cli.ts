#!/usr/bin/env node

import { ReviewMonitorSkill, ReviewPlatform, Sentiment, ResponseTone, AlertChannel } from './index';

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log(`
Review Monitor CLI

Usage: npm run cli -- <command> [options]

Commands:
  add-business      Add a business to monitor
                    Options: --name, --platform (google|yelp), --external-id, --location, --website
  
  update-business   Update a business
                    Options: --id, --name, --active (true|false), --alert-channels
  
  delete-business   Delete a business
                    Options: --id
  
  businesses        List all businesses
  
  add-review        Manually add a review (for testing)
                    Options: --business-id, --author, --rating (1-5), --content, --date
  
  reviews           List reviews
                    Options: --business-id, --platform, --sentiment, --unread, --limit
  
  get-review        Get a specific review
                    Options: --id
  
  read              Mark review as read
                    Options: --id
  
  unread            Mark review as unread
                    Options: --id
  
  respond           Add a response to a review
                    Options: --id, --response
  
  delete-review     Delete a review
                    Options: --id
  
  analyze           Analyze sentiment of a review
                    Options: --id, --text (for testing without db)
  
  respond           Generate a response for a review
                    Options: --id, --tone (grateful|apologetic|professional|follow-up|appreciation)
  
  templates         List response templates
                    Options: --tone, --sentiment
  
  add-template      Add a custom response template
                    Options: --name, --tone, --content, --for-sentiment, --variables
  
  delete-template   Delete a response template
                    Options: --id
  
  fetch             Fetch reviews for a business
                    Options: --business-id
  
  alerts            Send pending alerts
  
  stats             Show overall statistics
  
  business-stats    Show statistics for a specific business
                    Options: --business-id
  
  health            Check system health

Examples:
  npm run cli -- add-business --name "My Restaurant" --platform google --external-id "ChIJ123"
  npm run cli -- add-review --business-id 1 --author "John Doe" --rating 5 --content "Great place!"
  npm run cli -- reviews --unread
  npm run cli -- analyze --id 1
  npm run cli -- respond --id 1 --tone grateful
  npm run cli -- stats
`);
}

function getOption(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

async function main() {
  const skill = new ReviewMonitorSkill();

  try {
    switch (command) {
      case 'add-business': {
        const name = getOption('name');
        const platform = getOption('platform') as ReviewPlatform;
        const externalId = getOption('external-id');
        const location = getOption('location');
        const website = getOption('website');

        if (!name || !platform || !externalId) {
          console.log('Error: --name, --platform, and --external-id are required');
          process.exit(1);
        }

        if (!['google', 'yelp'].includes(platform)) {
          console.log('Error: platform must be google or yelp');
          process.exit(1);
        }

        const business = await skill.addBusiness({
          name,
          platform,
          externalId,
          location,
          website,
          isActive: true,
          alertChannels: ['console']
        });

        console.log(`Business added successfully:`);
        console.log(`  ID: ${business.id}`);
        console.log(`  Name: ${business.name}`);
        console.log(`  Platform: ${business.platform}`);
        console.log(`  External ID: ${business.externalId}`);
        break;
      }

      case 'update-business': {
        const id = parseInt(getOption('id') || '0');
        if (!id) {
          console.log('Error: --id is required');
          process.exit(1);
        }

        const updates: any = {};
        if (getOption('name')) updates.name = getOption('name');
        if (hasFlag('active') || getOption('active')) {
          updates.isActive = getOption('active') === 'true' || hasFlag('active');
        }
        if (getOption('location')) updates.location = getOption('location');
        if (getOption('website')) updates.website = getOption('website');
        if (getOption('alert-channels')) {
          updates.alertChannels = getOption('alert-channels')!.split(',') as AlertChannel[];
        }

        await skill.updateBusiness(id, updates);
        console.log(`Business ${id} updated successfully`);
        break;
      }

      case 'delete-business': {
        const id = parseInt(getOption('id') || '0');
        if (!id) {
          console.log('Error: --id is required');
          process.exit(1);
        }

        await skill.deleteBusiness(id);
        console.log(`Business ${id} deleted successfully`);
        break;
      }

      case 'businesses': {
        const platform = getOption('platform') as ReviewPlatform | undefined;
        const activeOnly = !hasFlag('all');
        
        const businesses = await skill.listBusinesses({ platform, activeOnly });
        
        console.log(`\n${businesses.length} businesses found:\n`);
        for (const b of businesses) {
          console.log(`  [${b.id}] ${b.name}`);
          console.log(`    Platform: ${b.platform}`);
          console.log(`    Location: ${b.location || 'N/A'}`);
          console.log(`    Status: ${b.isActive ? 'Active' : 'Inactive'}`);
          console.log(`    Alerts: ${b.alertChannels.join(', ')}`);
          console.log(`    Last fetched: ${b.lastFetchedAt || 'Never'}`);
          console.log();
        }
        break;
      }

      case 'add-review': {
        const businessId = parseInt(getOption('business-id') || '0');
        const author = getOption('author') || 'Anonymous';
        const rating = parseInt(getOption('rating') || '0');
        const content = getOption('content');
        const date = getOption('date') || new Date().toISOString().split('T')[0];

        if (!businessId || !rating || !content) {
          console.log('Error: --business-id, --rating, and --content are required');
          process.exit(1);
        }

        if (rating < 1 || rating > 5) {
          console.log('Error: rating must be between 1 and 5');
          process.exit(1);
        }

        const business = await skill.getBusiness(businessId);
        if (!business) {
          console.log(`Error: Business ${businessId} not found`);
          process.exit(1);
        }

        const review = await skill.addReview({
          businessId,
          externalId: `manual-${Date.now()}`,
          platform: business.platform,
          authorName: author,
          rating,
          content,
          reviewDate: date,
          sentiment: undefined as any, // Will be auto-analyzed
          sentimentScore: undefined as any,
          isRead: false
        });

        console.log(`Review added successfully:`);
        console.log(`  ID: ${review.id}`);
        console.log(`  Rating: ${'⭐'.repeat(review.rating)}`);
        console.log(`  Sentiment: ${review.sentiment} (${review.sentimentScore.toFixed(2)})`);
        console.log(`  Author: ${review.authorName}`);
        console.log(`  Content: ${review.content.substring(0, 100)}${review.content.length > 100 ? '...' : ''}`);
        break;
      }

      case 'reviews': {
        const businessId = parseInt(getOption('business-id') || '0');
        const platform = getOption('platform') as ReviewPlatform | undefined;
        const sentiment = getOption('sentiment') as Sentiment | undefined;
        const unreadOnly = hasFlag('unread');
        const limit = parseInt(getOption('limit') || '20');

        let reviews;
        if (businessId) {
          reviews = await skill.getReviewsByBusiness(businessId, { 
            sentiment, 
            unreadOnly,
            limit 
          });
        } else {
          reviews = await skill.getAllReviews({ platform, sentiment, unreadOnly, limit });
        }

        console.log(`\n${reviews.length} reviews found:\n`);
        for (const r of reviews) {
          const readIcon = r.isRead ? '✓' : '●';
          const respondedIcon = r.response ? '↩' : ' ';
          console.log(`  [${readIcon}${respondedIcon}] [${r.id}] ${r.authorName} - ${'⭐'.repeat(r.rating)}`);
          console.log(`      ${r.sentiment.toUpperCase()} (${r.sentimentScore.toFixed(2)}) | ${r.platform} | ${r.reviewDate}`);
          console.log(`      ${r.content.substring(0, 80)}${r.content.length > 80 ? '...' : ''}`);
          console.log();
        }
        break;
      }

      case 'get-review': {
        const id = parseInt(getOption('id') || '0');
        if (!id) {
          console.log('Error: --id is required');
          process.exit(1);
        }

        const review = await skill.getReview(id);
        if (!review) {
          console.log(`Review ${id} not found`);
          process.exit(1);
        }

        console.log(`\nReview #${review.id}:`);
        console.log(`  Author: ${review.authorName}`);
        console.log(`  Platform: ${review.platform}`);
        console.log(`  Rating: ${'⭐'.repeat(review.rating)}`);
        console.log(`  Sentiment: ${review.sentiment} (${review.sentimentScore.toFixed(2)})`);
        console.log(`  Date: ${review.reviewDate}`);
        console.log(`  Read: ${review.isRead ? 'Yes' : 'No'}`);
        console.log(`  Content:`);
        console.log(`    ${review.content.split('\n').join('\n    ')}`);
        if (review.response) {
          console.log(`  Response:`);
          console.log(`    ${review.response.split('\n').join('\n    ')}`);
          console.log(`  Responded at: ${review.respondedAt}`);
        }
        break;
      }

      case 'read': {
        const id = parseInt(getOption('id') || '0');
        if (!id) {
          console.log('Error: --id is required');
          process.exit(1);
        }

        await skill.markReviewAsRead(id);
        console.log(`Review ${id} marked as read`);
        break;
      }

      case 'unread': {
        const id = parseInt(getOption('id') || '0');
        if (!id) {
          console.log('Error: --id is required');
          process.exit(1);
        }

        await skill.markReviewAsUnread(id);
        console.log(`Review ${id} marked as unread`);
        break;
      }

      case 'respond': {
        const id = parseInt(getOption('id') || '0');
        const tone = getOption('tone') as ResponseTone | undefined;
        const responseText = getOption('response');

        if (!id) {
          console.log('Error: --id is required');
          process.exit(1);
        }

        const review = await skill.getReview(id);
        if (!review) {
          console.log(`Review ${id} not found`);
          process.exit(1);
        }

        if (responseText) {
          await skill.addResponse(id, responseText);
          console.log(`Response added to review ${id}`);
        } else if (tone) {
          const response = await skill.generateResponse(id, tone);
          if (response) {
            console.log(`\nGenerated response for review #${id}:\n`);
            console.log(response);
            console.log(`\nTo save this response, run:`);
            console.log(`  npm run cli -- respond --id ${id} --response "${response.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
          } else {
            console.log('Could not generate response');
          }
        } else {
          console.log('Error: Either --response or --tone is required');
          process.exit(1);
        }
        break;
      }

      case 'delete-review': {
        const id = parseInt(getOption('id') || '0');
        if (!id) {
          console.log('Error: --id is required');
          process.exit(1);
        }

        await skill.deleteReview(id);
        console.log(`Review ${id} deleted`);
        break;
      }

      case 'analyze': {
        const id = parseInt(getOption('id') || '0');
        const text = getOption('text');
        const rating = parseInt(getOption('rating') || '0') || undefined;

        if (text) {
          const analysis = skill.analyzeSentimentLocal(text, rating);
          console.log(`\nSentiment Analysis:`);
          console.log(`  Sentiment: ${analysis.sentiment}`);
          console.log(`  Score: ${analysis.score.toFixed(3)}`);
          console.log(`  Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
          console.log(`  Keywords: ${analysis.keywords.join(', ')}`);
          console.log(`  Explanation: ${analysis.explanation}`);
        } else if (id) {
          const analysis = await skill.analyzeSentiment(id);
          if (!analysis) {
            console.log(`Review ${id} not found`);
            process.exit(1);
          }
          console.log(`\nSentiment Analysis for Review #${id}:`);
          console.log(`  Sentiment: ${analysis.sentiment}`);
          console.log(`  Score: ${analysis.score.toFixed(3)}`);
          console.log(`  Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
          console.log(`  Keywords: ${analysis.keywords.join(', ')}`);
          console.log(`  Explanation: ${analysis.explanation}`);
        } else {
          console.log('Error: Either --id or --text is required');
          process.exit(1);
        }
        break;
      }

      case 'templates': {
        const tone = getOption('tone') as ResponseTone | undefined;
        const sentiment = getOption('sentiment') as Sentiment | undefined;

        const templates = await skill.getResponseTemplates({ tone, forSentiment: sentiment });

        console.log(`\n${templates.length} templates found:\n`);
        for (const t of templates) {
          console.log(`  [${t.id}] ${t.name}`);
          console.log(`    Tone: ${t.tone}`);
          console.log(`    For sentiment: ${t.forSentiment || 'any'}`);
          console.log(`    Variables: ${t.variables.join(', ')}`);
          console.log(`    Content: ${t.content.substring(0, 60)}...`);
          console.log();
        }
        break;
      }

      case 'add-template': {
        const name = getOption('name');
        const tone = getOption('tone') as ResponseTone;
        const content = getOption('content');
        const forSentiment = getOption('for-sentiment') as Sentiment | undefined;
        const vars = getOption('variables')?.split(',') || [];

        if (!name || !tone || !content) {
          console.log('Error: --name, --tone, and --content are required');
          process.exit(1);
        }

        const template = await skill.addResponseTemplate({
          name,
          tone,
          content,
          forSentiment,
          variables: vars
        });

        console.log(`Template added successfully:`);
        console.log(`  ID: ${template.id}`);
        console.log(`  Name: ${template.name}`);
        console.log(`  Tone: ${template.tone}`);
        break;
      }

      case 'delete-template': {
        const id = parseInt(getOption('id') || '0');
        if (!id) {
          console.log('Error: --id is required');
          process.exit(1);
        }

        await skill.deleteResponseTemplate(id);
        console.log(`Template ${id} deleted`);
        break;
      }

      case 'fetch': {
        const businessId = parseInt(getOption('business-id') || '0');
        if (!businessId) {
          console.log('Error: --business-id is required');
          process.exit(1);
        }

        console.log(`Fetching reviews for business ${businessId}...`);
        const reviews = await skill.fetchReviews(businessId);
        console.log(`Found ${reviews.length} reviews`);
        break;
      }

      case 'alerts': {
        const result = await skill.sendAlerts();
        console.log(`Alerts sent: ${result.sent}, failed: ${result.failed}`);
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();

        console.log(`\n📊 Review Monitor Statistics\n`);
        console.log(`Total Reviews: ${stats.totalReviews}`);
        console.log(`Average Rating: ${stats.averageRating.toFixed(1)} ⭐`);
        console.log(`\nSentiment Distribution:`);
        console.log(`  😊 Positive: ${stats.sentimentDistribution.positive}`);
        console.log(`  😐 Neutral: ${stats.sentimentDistribution.neutral}`);
        console.log(`  😞 Negative: ${stats.sentimentDistribution.negative}`);
        console.log(`\nPlatform Distribution:`);
        console.log(`  Google: ${stats.platformDistribution.google}`);
        console.log(`  Yelp: ${stats.platformDistribution.yelp}`);
        console.log(`\nAction Items:`);
        console.log(`  Unread Reviews: ${stats.unreadCount}`);
        console.log(`  Unresponded Reviews: ${stats.unrespondedCount}`);
        console.log(`\nRecent Trend: ${stats.recentTrend}`);
        break;
      }

      case 'business-stats': {
        const businessId = parseInt(getOption('business-id') || '0');
        if (!businessId) {
          console.log('Error: --business-id is required');
          process.exit(1);
        }

        const stats = await skill.getBusinessStats(businessId);
        if (!stats) {
          console.log(`Business ${businessId} not found`);
          process.exit(1);
        }

        console.log(`\n📊 Statistics for ${stats.business.name}\n`);
        console.log(`Total Reviews: ${stats.totalReviews}`);
        console.log(`Average Rating: ${stats.averageRating.toFixed(1)} ⭐`);
        console.log(`Response Rate: ${stats.responseRate}%`);
        console.log(`\nSentiment Distribution:`);
        console.log(`  😊 Positive: ${stats.sentimentDistribution.positive}`);
        console.log(`  😐 Neutral: ${stats.sentimentDistribution.neutral}`);
        console.log(`  😞 Negative: ${stats.sentimentDistribution.negative}`);
        break;
      }

      case 'health': {
        const health = await skill.healthCheck();
        console.log(`\nHealth Status: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
        console.log(`Message: ${health.message}`);
        if (health.stats) {
          console.log(`Businesses: ${health.stats.businesses}`);
          console.log(`Reviews: ${health.stats.reviews}`);
        }
        break;
      }

      default:
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
