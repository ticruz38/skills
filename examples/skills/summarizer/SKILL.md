---
name: summarizer
description: "Summarize long text using AI"
version: 1.0.0
author: ticruz38
entry: node summarize.js
type: script
---

# Summarizer Skill

Summarize long text into short summaries.

## Capabilities

- `summarize <text> [maxLength]` - Summarize text
  - Returns: `{ "summary": "...", "originalLength": 1234, "summaryLength": 150 }`
  - Example: `summarize.js "Long text here..." 100`

## Setup

No setup required! Works immediately.

Optional: Set `OPENAI_API_KEY` for better summaries using GPT-4.

## Examples

```bash
# Basic summarization (local algorithm)
./summarize.js "This is a very long article about something interesting..."

# With custom length
./summarize.js "Long text..." 200

# With OpenAI for better quality
OPENAI_API_KEY=sk-xxx ./summarize.js "Long text..."
```

## Note

This is a simple example skill with no onboarding questions.
