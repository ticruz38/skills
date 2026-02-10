---
title: Review Monitor
skill_id: review-monitor
version: 1.0.0
description: Monitor and respond to reviews on Google and Yelp with sentiment analysis
author: OpenClaw
tags: [reviews, reputation, sentiment, google, yelp, monitoring]
---

# Review Monitor

Monitor and respond to reviews on Google and Yelp with sentiment analysis and response templates.

## Overview

This skill helps businesses monitor their online reputation by:
- Tracking reviews from Google and Yelp
- Analyzing sentiment (positive, neutral, negative)
- Suggesting response templates
- Sending alerts for new reviews
- Maintaining review history

## Features

- **Multi-Platform Support**: Monitor Google and Yelp reviews
- **Sentiment Analysis**: Automatic sentiment detection using keyword analysis
- **Response Templates**: Pre-built templates for different review types and sentiments
- **Alert Notifications**: Get notified of new reviews
- **Review History**: Track all reviews over time
- **Statistics**: Analytics on review trends and sentiment distribution

## Installation

```bash
cd skills/review-monitor
npm install
npm run build
```

## Usage

### CLI

```bash
# Add a business to monitor
npm run cli -- add-business --name "My Restaurant" --platform google --location-id "ChIJ..."

# List monitored businesses
npm run cli -- businesses

# Fetch new reviews
npm run cli -- fetch

# View reviews
npm run cli -- reviews --platform google

# Analyze sentiment
npm run cli -- analyze --review-id 123

# Generate response
npm run cli -- respond --review-id 123

# View statistics
npm run cli -- stats
```

### Library

```typescript
import { ReviewMonitorSkill } from '@openclaw/review-monitor';

const monitor = new ReviewMonitorSkill();

// Add a business
const business = await monitor.addBusiness({
  name: 'My Restaurant',
  platform: 'google',
  externalId: 'ChIJ...',
  location: 'New York, NY'
});

// Fetch reviews
const reviews = await monitor.fetchReviews(business.id!);

// Analyze sentiment
const sentiment = await monitor.analyzeSentiment(reviews[0].id!);

// Generate response
const response = await monitor.generateResponse(reviews[0].id!, 'grateful');

// Close connection
await monitor.close();
```

## Configuration

The skill stores data in `~/.openclaw/skills/review-monitor/`.

## Response Templates

Available template types:
- `grateful` - For positive reviews
- `apologetic` - For negative reviews
- `professional` - For neutral reviews
- `follow-up` - For questions or concerns
- `appreciation` - General thank you

## Sentiment Analysis

Sentiment is determined by:
- Positive keywords (excellent, great, amazing, etc.)
- Negative keywords (terrible, awful, disappointed, etc.)
- Rating correlation
- Context analysis

Scores range from -1.0 (very negative) to +1.0 (very positive).
