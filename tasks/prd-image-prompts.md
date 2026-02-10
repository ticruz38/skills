# PRD: Image Prompts

## Introduction
A skill that generates optimized prompts for AI image generation tools like Midjourney, DALL-E, and Stable Diffusion. Casey needs compelling visuals to accompany her content but lacks design skills.

## Goals
- Create optimized prompts for major AI image generation tools
- Provide style references and visual inspiration
- Generate prompt variations for A/B testing
- Ensure prompts produce consistent, brand-aligned imagery
- Ensure all prompt generation passes type checking

## User Stories

### US-001: Midjourney Prompt Generation
**Description:** As a content creator, I want Midjourney-optimized prompts so that I can generate stunning visuals for my content.

**Acceptance Criteria:**
- [ ] Generate prompts with proper parameter syntax (--ar, --style, --v)
- [ ] Include aspect ratio recommendations per platform
- [ ] Support advanced features (image prompts, remix, blend)
- [ ] Preview expected style and composition
- [ ] Typecheck passes

### US-002: DALL-E Prompt Generation
**Description:** As a content creator, I want DALL-E-optimized prompts so that I can generate realistic and artistic images.

**Acceptance Criteria:**
- [ ] Generate prompts optimized for DALL-E 3 capabilities
- [ ] Support style modifiers (photorealistic, illustration, 3D render)
- [ ] Include negative prompt suggestions
- [ ] Optimize for DALL-E's natural language understanding
- [ ] Typecheck passes

### US-003: Style Reference Library
**Description:** As a content creator, I want access to style references so that I can maintain visual consistency.

**Acceptance Criteria:**
- [ ] Curated style categories (minimalist, vibrant, vintage, corporate)
- [ ] Artist style references (legal/safe suggestions only)
- [ ] Brand color palette integration
- [ ] Save and reuse favorite styles
- [ ] Typecheck passes

### US-004: Prompt Variations
**Description:** As a content creator, I want variations of the same prompt so that I can choose the best visual direction.

**Acceptance Criteria:**
- [ ] Generate 3-5 variations per base prompt
- [ ] Vary style, composition, lighting, or mood
- [ ] Compare variations side-by-side
- [ ] Iterate on selected variations
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Generate platform-specific prompts (Midjourney, DALL-E, Stable Diffusion)
- FR-2: Include technical parameters (aspect ratios, quality settings, stylize values)
- FR-3: Style library with searchable categories and examples
- FR-4: Prompt variation generation with controlled randomization
- FR-5: Save and organize favorite prompts into collections
- FR-6: Prompt history and version tracking
- FR-7: Export prompts in tool-compatible formats
- FR-8: Image-to-prompt analysis (reverse engineer from reference images)
- FR-9: Brand style guide integration for consistent visuals
- FR-10: Prompt optimization tips and best practices

## Non-Goals
- Direct image generation (only prompt creation)
- Image editing or post-processing
- Stock photo search or recommendations
- Copyright verification of generated images
- Video prompt generation (static images only)
- 3D model generation prompts
- Automated image selection from results
- Integration with design tools (Figma, Canva)

## Technical Considerations
- **Prompt Engineering:** Expert-crafted prompt templates and modifiers
- **Style Database:** JSON-based style reference library
- **LLM Integration:** GPT-4 for prompt expansion and optimization
- **Parameters Mapping:** Tool-specific parameter translation
- **Version Control:** Track prompt iterations and results
- **Image Analysis:** Vision API for reference image understanding
- **Storage:** Prompt library and user collections
- **Type Safety:** TypeScript types for all prompt structures and tool configurations

## Success Metrics
- 80%+ of generated prompts produce usable images on first generation
- Users save 15+ prompts to collections per month
- Style library covers 50+ distinct visual styles
- Prompt variation feature used in 60%+ of generation sessions
- User satisfaction with prompt quality: 4.5+/5
