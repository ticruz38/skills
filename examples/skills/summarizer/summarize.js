#!/usr/bin/env node
/**
 * Summarizer Skill
 * Simple text summarization - no dependencies!
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Simple extractive summarization (no AI needed)
function simpleSummarize(text, maxLength = 150) {
    // Split into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    if (sentences.length <= 2) {
        return text.trim();
    }

    // Score sentences by word frequency
    const wordFreq = {};
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    
    words.forEach(word => {
        if (word.length > 3) {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
    });

    // Score each sentence
    const scored = sentences.map(sentence => {
        const sWords = sentence.toLowerCase().match(/\b\w+\b/g) || [];
        const score = sWords.reduce((sum, word) => sum + (wordFreq[word] || 0), 0);
        return { sentence: sentence.trim(), score };
    });

    // Take top 3 sentences
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 3);
    
    // Restore original order
    top.sort((a, b) => sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence));
    
    let summary = top.map(s => s.sentence).join(' ');
    
    // Truncate if still too long
    if (summary.length > maxLength) {
        summary = summary.substring(0, maxLength).trim() + '...';
    }

    return summary;
}

// OpenAI-based summarization (better quality)
async function openAiSummarize(text, maxLength) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{
                role: 'user',
                content: `Summarize this in ${maxLength} characters:\n\n${text}`
            }],
            max_tokens: Math.ceil(maxLength / 2)
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}

// Main
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        console.log('Usage: summarize.js <text> [maxLength]');
        console.log('  text       - Text to summarize (or "-" for stdin)');
        console.log('  maxLength  - Maximum summary length (default: 150)');
        process.exit(0);
    }

    let text;
    let maxLength = 150;

    // Check if text is "-" (read from stdin)
    if (args[0] === '-') {
        const chunks = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        text = Buffer.concat(chunks).toString();
        maxLength = parseInt(args[1]) || 150;
    } else {
        text = args[0];
        maxLength = parseInt(args[1]) || 150;
    }

    try {
        let summary;
        
        if (OPENAI_API_KEY) {
            summary = await openAiSummarize(text, maxLength);
        } else {
            summary = simpleSummarize(text, maxLength);
        }

        const result = {
            summary,
            originalLength: text.length,
            summaryLength: summary.length,
            compressionRatio: (summary.length / text.length).toFixed(2),
            method: OPENAI_API_KEY ? 'openai' : 'local'
        };

        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error(JSON.stringify({ error: error.message }, null, 2));
        process.exit(1);
    }
}

main();
