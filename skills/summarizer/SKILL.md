---
title: Summarizer
skill_id: summarizer
description: Summarize articles and documents with key point extraction
category: content
tags: [summarization, nlp, text-processing, analysis]
author: OpenClaw
version: 1.0.0
---

# Summarizer

Summarize articles, documents, emails, and meeting notes with adjustable length and key point extraction. No external API required - uses local text processing algorithms.

## Capabilities

- **Text Summarization**: Condense long texts into short, medium, or long summaries
- **Key Point Extraction**: Automatically identify and extract the most important points
- **Multiple Formats**: Output as paragraph, bullet points, or numbered list
- **Document Types**: Optimized for articles, documents, emails, meetings, and research papers
- **Focus Keywords**: Emphasize specific topics or keywords in the summary
- **History Tracking**: All summaries are saved to SQLite for future reference

## Installation

```bash
cd skills/summarizer
npm install
npm run build
```

## Usage

### CLI

```bash
# Summarize text directly
npx summarizer summarize -t "Your long text here..." -l short

# Summarize a file
npx summarizer summarize -f article.txt --type article --format bullet

# Summarize with key points and specific length
npx summarizer s -t "Meeting notes..." -T meeting -l medium -k 5

# Focus on specific keywords
npx summarizer s -f report.pdf -T document --focus "revenue,growth,profit"

# View summary history
npx summarizer history --type article -n 10

# Get specific summary by ID
npx summarizer get -i 1

# View statistics
npx summarizer stats
```

### Library

```typescript
import { SummarizerSkill } from '@openclaw/summarizer';

const summarizer = new SummarizerSkill();

// Summarize text
const result = await summarizer.summarize({
  text: longArticleText,
  title: "Article Title",
  length: 'medium',      // 'short' | 'medium' | 'long'
  format: 'paragraph',   // 'paragraph' | 'bullet' | 'numbered'
  documentType: 'article', // 'article' | 'document' | 'email' | 'meeting' | 'research'
  extractKeyPoints: true,
  maxKeyPoints: 5,
  focus: ['technology', 'innovation']
});

console.log(result.summary);
console.log(result.keyPoints);
console.log(`Compression: ${(result.compressionRatio * 100).toFixed(1)}%`);

// Summarize a file
const fileResult = await summarizer.summarizeFile('/path/to/document.txt', {
  length: 'long',
  documentType: 'document',
  extractKeyPoints: true
});

// Get history
const history = await summarizer.getHistory('article', 10);

// Get specific summary
const summary = await summarizer.getSummary(1);

// Get statistics
const stats = await summarizer.getStats();

await summarizer.close();
```

## Summary Lengths

- **Short**: ~10% of original text (brief overview)
- **Medium**: ~20% of original text (balanced detail)
- **Long**: ~35% of original text (comprehensive summary)

## Output Formats

- **Paragraph**: Flowing text summary
- **Bullet**: Bullet point format (• point)
- **Numbered**: Numbered list format (1. point)

## Document Types

Document type affects key point extraction with type-specific keyword weighting:

- **Article**: News, blog posts (focus on findings, quotes, announcements)
- **Document**: General documents (focus on conclusions, results)
- **Email**: Email threads (focus on actions, requests, deadlines)
- **Meeting**: Meeting notes (focus on decisions, next steps)
- **Research**: Research papers (focus on methods, findings, analysis)

## Algorithm

The summarizer uses an extractive summarization algorithm:

1. **Sentence Tokenization**: Split text into sentences
2. **Scoring**: Score sentences based on:
   - Document-type keywords (higher weight)
   - Focus keywords (highest weight)
   - Statistical indicators (percentages, currency)
   - Structural cues (first/last sentences, transition words)
   - Optimal sentence length
3. **Selection**: Select top-scoring sentences up to target length
4. **Reordering**: Arrange selected sentences in original order
5. **Formatting**: Apply chosen format (paragraph/bullet/numbered)

## Database

Summaries are stored in SQLite at `~/.openclaw/skills/summarizer/summaries.db`:

- **summaries**: All summaries with metadata, key points, and compression stats

## No External Dependencies

This skill uses local text processing algorithms and does not require external API keys. It works entirely offline.
