---
title: Image Prompts
skill_id: image-prompts
description: Generate AI image prompts for Midjourney, DALL-E, and Stable Diffusion
category: creative
tags: [ai, image, prompts, midjourney, dalle, stable-diffusion, art]
author: OpenClaw
version: 1.0.0
---

# Image Prompts

Generate optimized AI image prompts for popular image generation platforms including Midjourney, DALL-E, Stable Diffusion, and Leonardo AI.

## Capabilities

- **Multi-Platform Support**: Generate prompts optimized for Midjourney, DALL-E, Stable Diffusion, and Leonardo AI
- **Style-Aware Prompts**: 15+ art styles with optimized keywords (photorealistic, anime, oil painting, cyberpunk, etc.)
- **Subject Enhancement**: Automatically enhance subject descriptions with relevant modifiers
- **Parameter Suggestions**: Platform-specific parameters (aspect ratio, quality, stylize, etc.)
- **Prompt Variations**: Generate multiple variations of prompts for A/B testing
- **Negative Prompts**: Auto-generate appropriate negative prompts per style
- **Template System**: Pre-built templates for common use cases
- **History Tracking**: SQLite storage for generated prompts

## Installation

```bash
cd skills/image-prompts
npm install
npm run build
```

## Usage

### CLI

```bash
# Generate prompts for a subject
npx image-prompts generate "a mystical forest" --style fantasy --mood mysterious

# Generate with specific platform settings
npx image-prompts g "cyberpunk city" -p midjourney -s cyberpunk -m futuristic -l neon -a 16:9

# Use a template
npx image-prompts template character-portrait --var '{"subject":"a brave warrior"}'

# List available templates
npx image-prompts templates

# View prompt history
npx image-prompts history --limit 10

# List available options
npx image-prompts styles
npx image-prompts moods
npx image-prompts platforms
```

### Library

```typescript
import { ImagePromptsSkill } from '@openclaw/image-prompts';

const skill = new ImagePromptsSkill();

// Generate prompts
const prompts = await skill.generatePrompts({
  subject: 'a mystical forest with ancient trees',
  platform: 'midjourney',
  style: 'fantasy',
  mood: 'mysterious',
  lighting: 'volumetric',
  quality: 'ultra',
  aspectRatio: '16:9',
  count: 3
});

console.log(prompts[0].prompt);
// "fantasy art, magical, ethereal, mythical, enchanted, dreamlike of a mystical forest with ancient trees, mysterious, enigmatic, shadowy, intriguing, atmospheric, volumetric lighting, god rays, atmospheric lighting, ultra detailed, 8k, hyperrealistic, maximum quality, intricate details"

console.log(prompts[0].negativePrompt);
// "blurry, low quality, distorted, deformed, ugly, bad anatomy, watermark..."

console.log(prompts[0].parameters);
// { version: "6", stylize: 100, chaos: 0, ar: "16:9" }

// Get formatted command for Midjourney
const command = skill.formatPromptWithParameters(
  prompts[0].prompt,
  'midjourney',
  prompts[0].parameters
);
console.log(command);
// "fantasy art, magical... --ar 16:9 --stylize 100 --v 6"

// Use templates
const template = await skill.getTemplate('character-portrait');
const prompt = skill.applyTemplate(template, {
  subject: 'a brave warrior',
  style: 'digital art',
  mood: 'dramatic',
  lighting: 'cinematic',
  quality: 'ultra detailed',
  perspective: 'close up'
});

await skill.close();
```

## Art Styles

- **photorealistic**: Ultra-realistic photography style
- **digital-art**: Modern digital illustration
- **oil-painting**: Classic oil painting aesthetic
- **watercolor**: Soft watercolor wash effects
- **pencil-sketch**: Hand-drawn pencil sketch
- **anime**: Japanese anime/manga style
- **3d-render**: 3D computer generated imagery
- **pixel-art**: Retro pixel art style
- **concept-art**: Professional concept art
- **cyberpunk**: Futuristic cyberpunk aesthetic
- **fantasy**: High fantasy art style
- **minimalist**: Clean minimalist design
- **surrealism**: Surreal dreamlike imagery
- **impressionist**: Impressionist painting style
- **pop-art**: Bold pop art style

## Moods

peaceful, dramatic, mysterious, joyful, melancholic, epic, whimsical, dark, romantic, futuristic

## Lighting Options

natural, studio, dramatic, soft, golden-hour, neon, cinematic, backlit, volumetric, moonlight

## Camera Perspectives

eye-level, birds-eye, worms-eye, close-up, wide-angle, macro, portrait, aerial, isometric, dutch-angle

## Supported Platforms

### Midjourney
Parameters: `version`, `stylize`, `chaos`, `weird`, `tile`, `no`

### DALL-E
Parameters: `quality` (standard/hd), `style` (vivid/natural), `size`

### Stable Diffusion
Parameters: `steps`, `cfg_scale`, `seed`, `sampler`, `width`, `height`

### Leonardo
Parameters: `photoReal`, `alchemy`, `guidance_scale`

### Generic
No platform-specific parameters

## Templates

Built-in templates for common use cases:

- **character-portrait**: Detailed character portrait with personality
- **landscape-scene**: Breathtaking landscape environment
- **product-shot**: Professional product photography
- **abstract-art**: Abstract artistic composition
- **architectural**: Architectural visualization

## Database

Prompts are stored in SQLite at `~/.openclaw/skills/image-prompts/prompts.db`:

- **generated_prompts**: All generated prompts with metadata
- **prompt_templates**: Reusable prompt templates
- **style_presets**: Custom style configurations

## No External Dependencies

This skill uses local prompt generation patterns and does not require external API keys. It works entirely offline.
