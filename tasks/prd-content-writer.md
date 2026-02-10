# PRD: Content Writer

## Introduction
A skill that generates posts, blogs, and captions in the user's unique voice. Casey, a content creator, needs to produce platform-optimized content across LinkedIn, Twitter/X, Instagram, and blogs while maintaining a consistent personal brand voice.

## Goals
- Generate engaging content tailored for different platforms and formats
- Maintain consistent voice and tone across all content pieces
- Provide reusable templates for common content types
- Reduce content creation time from hours to minutes
- Ensure all generated content passes type checking and validation

## User Stories

### US-001: Platform-Specific Post Generation
**Description:** As a content creator, I want to generate posts optimized for specific platforms so that I can maximize engagement on each channel.

**Acceptance Criteria:**
- [ ] Generate LinkedIn posts (professional, longer-form, 1,300 char limit awareness)
- [ ] Generate Twitter/X posts (concise, thread support, 280 char limit)
- [ ] Generate Instagram captions (visual-first, emoji-friendly, hashtag-ready)
- [ ] Generate blog outlines and drafts (SEO-optimized, structured)
- [ ] Typecheck passes

### US-002: Voice Consistency Maintenance
**Description:** As a content creator, I want the skill to learn and maintain my unique voice so that my audience recognizes my content instantly.

**Acceptance Criteria:**
- [ ] Analyze user's writing samples to extract voice characteristics
- [ ] Store voice profile (tone, vocabulary, sentence structure, humor level)
- [ ] Apply voice profile consistently across all generated content
- [ ] Allow voice profile updates based on feedback
- [ ] Typecheck passes

### US-003: Template-Based Content Creation
**Description:** As a content creator, I want access to proven content templates so that I can quickly create common content types.

**Acceptance Criteria:**
- [ ] Provide hook-based templates (question, story, contrarian, listicle)
- [ ] Provide call-to-action templates
- [ ] Allow custom template creation and saving
- [ ] Support template variables and placeholders
- [ ] Typecheck passes

### US-004: Content Variations and A/B Testing
**Description:** As a content creator, I want multiple variations of the same content so that I can test what resonates best.

**Acceptance Criteria:**
- [ ] Generate 3-5 variations of any content piece
- [ ] Vary hooks, angles, or CTAs while maintaining core message
- [ ] Compare variations side-by-side
- [ ] Track performance metrics if published
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Accept content briefs (topic, key points, target platform, tone preference)
- FR-2: Generate platform-optimized content with appropriate formatting
- FR-3: Store and apply user voice profiles for consistency
- FR-4: Provide content templates for common formats (how-to, story, listicle, opinion)
- FR-5: Generate multiple variations of content for A/B testing
- FR-6: Support editing and refinement of generated content
- FR-7: Export content in platform-ready formats (plain text, markdown)
- FR-8: Character count validation for platform limits
- FR-9: Integration with social-scheduler skill for direct posting

## Non-Goals
- Image or video generation (handled by image-prompts skill)
- Direct publishing to platforms (handled by social-scheduler skill)
- Analytics and performance tracking
- Plagiarism detection (assume user responsibility)
- Multi-language content generation (English-only for MVP)
- Real-time collaboration features

## Technical Considerations
- **LLM Integration:** OpenAI GPT-4 or Claude for high-quality generation
- **Voice Profile Storage:** JSON-based voice profiles with characteristics extraction
- **Template Engine:** Jinja2 or similar for variable substitution
- **API Requirements:** RESTful API with JSON request/response
- **Auth:** OAuth 2.0 for user authentication and voice profile access
- **Caching:** Redis for voice profiles and generated content caching
- **Validation:** Strict type checking with TypeScript or similar
- **Rate Limiting:** Implement to manage LLM API costs

## Success Metrics
- Content generation time reduced by 70% (from 2 hours to 30 minutes per post)
- User satisfaction score of 4.5+/5 for voice accuracy
- 90%+ of generated content requires minimal editing before posting
- Template library grows to 20+ proven formats within 3 months
- 80%+ of users generate content at least 3x per week
