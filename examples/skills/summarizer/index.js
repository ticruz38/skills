/**
 * Summarizer Skill
 * Simple skill with no auth required
 */

class SummarizerSkill {
  constructor() {
    this.name = 'summarizer';
    this.config = {};
  }

  async init(config) {
    this.config = {
      defaultMaxLength: parseInt(config.DEFAULT_MAX_LENGTH) || 150,
      style: config.SUMMARY_STYLE || 'concise'
    };
    
    console.log('[Summarizer] Initialized');
    return { success: true };
  }

  /**
   * Summarize text
   * In a real implementation, this would call an LLM API
   */
  async summarize(text, maxLength = this.config.defaultMaxLength, style = this.config.style) {
    // Simple extractive summary for demo
    // In production, use: OpenAI, Claude, or local LLM
    
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    if (sentences.length <= 3) {
      return text.trim();
    }

    // Take first sentence, last sentence, and most important middle sentence
    const first = sentences[0].trim();
    const last = sentences[sentences.length - 1].trim();
    const middle = sentences[Math.floor(sentences.length / 2)].trim();
    
    let summary;
    switch (style) {
      case 'bullet_points':
        summary = `• ${first}\n• ${middle}\n• ${last}`;
        break;
      case 'detailed':
        summary = `${first} ${middle} ${last}`;
        break;
      case 'concise':
      default:
        summary = first;
    }

    // Truncate if too long
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength).trim() + '...';
    }

    return {
      success: true,
      summary,
      originalLength: text.length,
      summaryLength: summary.length,
      compressionRatio: (summary.length / text.length).toFixed(2)
    };
  }

  async summarizeUrl(url, maxLength) {
    // In production: fetch URL content, then summarize
    // For demo, return mock
    return {
      success: true,
      url,
      summary: `[Summary of ${url}]`,
      note: 'In production, this would fetch and summarize the actual webpage'
    };
  }

  async health() {
    return { 
      status: 'healthy',
      version: '1.0.0'
    };
  }
}

module.exports = SummarizerSkill;
