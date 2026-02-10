# Gift Suggestions Skill

Suggest personalized gift ideas based on recipient profiles, interests, and budget.

## Usage

```typescript
import { GiftSuggestionsSkill } from '@openclaw/gift-suggestions';

const skill = new GiftSuggestionsSkill();

// Add a recipient profile
const recipientId = await skill.addRecipient({
  name: 'Sarah',
  relationship: 'sister',
  age: 28,
  interests: ['reading', 'yoga', 'tea', 'wellness'],
  notes: 'Prefers experiences over physical gifts'
});

// Get personalized suggestions
const suggestions = await skill.suggestGifts({
  recipientId,
  budgetMax: 100,
  occasion: 'birthday',
  excludePrevious: true,
  count: 5
});

// View suggestions with match scores
suggestions.forEach(result => {
  console.log(`${result.suggestion.name} - Match: ${result.matchScore}`);
  console.log(`Reasons: ${result.matchReasons.join(', ')}`);
});
```

## CLI Usage

```bash
# Add a recipient
gift-suggestions add-recipient "Sarah" "sister" \
  --interests "reading,yoga,tea" \
  --age 28 \
  --notes "Prefers experiences"

# List all recipients
gift-suggestions list-recipients

# Get gift suggestions
gift-suggestions suggest 1 --budget 100 --occasion birthday --count 5

# Browse trending gifts
gift-suggestions trending --limit 10

# View gifts by category
gift-suggestions categories

# View gifts under budget
gift-suggestions budget 50

# Track gift history
gift-suggestions add-history 1 "Yoga Mat" "birthday" "2024-03-15" --price 45
```

## Features

### Recipient Profiles
- Store recipient information (name, relationship, age, gender)
- Track interests for better matching
- Add personal notes
- Gift history tracking with reactions

### Smart Suggestions
- Interest-based matching algorithm
- Budget filtering (min/max)
- Occasion-appropriate suggestions
- Age and gender considerations
- Exclude previously gifted items
- Match scoring with detailed reasons

### Gift Database
- 64 curated gift ideas across 8 categories
- Price ranges for all budgets
- Trending indicators
- Interest tags
- Occasion appropriateness

### Categories
- **Tech**: Gadgets, electronics, smart devices
- **Experiences**: Activities, classes, adventures
- **Home**: Decor, appliances, comfort items
- **Fashion**: Accessories, apparel, jewelry
- **Books & Learning**: Books, courses, educational
- **Wellness**: Fitness, health, self-care
- **Food & Drink**: Gourmet items, subscriptions

### Gift History
- Track all gifts given
- Record recipient reactions
- Monitor spending
- Avoid duplicate gifts
