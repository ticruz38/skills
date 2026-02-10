import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Types
export type DietaryType = 'vegetarian' | 'vegan' | 'gluten-free' | 'keto' | 'paleo' | 'dairy-free' | 'nut-free' | 'low-carb' | 'low-sodium';
export type CuisineType = 'italian' | 'mexican' | 'asian' | 'mediterranean' | 'american' | 'indian' | 'french' | 'thai' | 'japanese' | 'chinese' | 'greek' | 'spanish';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | 'appetizer';

export interface Recipe {
  id: string;
  name: string;
  description: string;
  cuisine: CuisineType;
  dietary: DietaryType[];
  difficulty: DifficultyLevel;
  mealType: MealType;
  prepTime: number; // minutes
  cookTime: number; // minutes
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  tags: string[];
  calories?: number;
  protein?: number; // grams
  carbs?: number; // grams
  fat?: number; // grams
}

export interface Ingredient {
  name: string;
  amount: string;
  optional?: boolean;
}

export interface RecipeRecord {
  id: string;
  name: string;
  description: string;
  cuisine: string;
  dietary: string;
  difficulty: string;
  meal_type: string;
  prep_time: number;
  cook_time: number;
  servings: number;
  ingredients: string;
  instructions: string;
  tags: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  is_favorite: number;
  times_cooked: number;
  last_cooked?: string;
}

export interface SuggestionRequest {
  dietary?: DietaryType[];
  cuisine?: CuisineType;
  difficulty?: DifficultyLevel;
  mealType?: MealType;
  maxTime?: number; // total time limit in minutes
  minServings?: number;
  maxServings?: number;
  tags?: string[];
  excludeIngredients?: string[];
  count?: number;
}

export interface SuggestionResult {
  recipe: Recipe;
  matchScore: number;
  matchReasons: string[];
}

export interface IngredientSearchRequest {
  ingredients: string[];
  matchThreshold?: number; // 0-1, minimum percentage of ingredients to match
  maxMissing?: number; // maximum number of missing ingredients
}

// Curated Recipe Database
const RECIPE_DATABASE: Recipe[] = [
  // Italian - Vegetarian
  {
    id: 'ita-001',
    name: 'Classic Margherita Pizza',
    description: 'Traditional Neapolitan pizza with fresh mozzarella, tomatoes, and basil',
    cuisine: 'italian',
    dietary: ['vegetarian'],
    difficulty: 'medium',
    mealType: 'dinner',
    prepTime: 60,
    cookTime: 15,
    servings: 4,
    ingredients: [
      { name: 'pizza dough', amount: '1 lb' },
      { name: 'San Marzano tomatoes', amount: '14 oz can' },
      { name: 'fresh mozzarella', amount: '8 oz' },
      { name: 'fresh basil', amount: '1 bunch' },
      { name: 'olive oil', amount: '2 tbsp' },
      { name: 'salt', amount: '1 tsp' },
    ],
    instructions: [
      'Preheat oven to 475°F with pizza stone inside.',
      'Stretch dough into a 12-inch circle.',
      'Crush tomatoes and spread over dough.',
      'Tear mozzarella and distribute evenly.',
      'Drizzle with olive oil and sprinkle salt.',
      'Bake for 12-15 minutes until crust is golden.',
      'Top with fresh basil and serve.',
    ],
    tags: ['pizza', 'classic', 'cheese', 'tomato'],
    calories: 280,
    protein: 12,
    carbs: 35,
    fat: 10,
  },
  {
    id: 'ita-002',
    name: 'Spaghetti Aglio e Olio',
    description: 'Simple pasta with garlic, olive oil, and red pepper flakes',
    cuisine: 'italian',
    dietary: ['vegetarian', 'vegan', 'dairy-free'],
    difficulty: 'easy',
    mealType: 'dinner',
    prepTime: 5,
    cookTime: 15,
    servings: 4,
    ingredients: [
      { name: 'spaghetti', amount: '1 lb' },
      { name: 'garlic', amount: '6 cloves' },
      { name: 'olive oil', amount: '1/3 cup' },
      { name: 'red pepper flakes', amount: '1/2 tsp' },
      { name: 'parsley', amount: '1/4 cup chopped' },
      { name: 'salt', amount: 'to taste' },
    ],
    instructions: [
      'Cook spaghetti in salted boiling water until al dente.',
      'Slice garlic thinly.',
      'Heat olive oil in a large pan over medium heat.',
      'Add garlic and cook until golden (2-3 minutes).',
      'Add red pepper flakes.',
      'Drain pasta, reserving 1 cup pasta water.',
      'Toss pasta in oil with parsley and pasta water.',
      'Serve immediately.',
    ],
    tags: ['pasta', 'garlic', 'spicy', 'quick'],
    calories: 420,
    protein: 12,
    carbs: 58,
    fat: 16,
  },
  {
    id: 'ita-003',
    name: 'Caprese Salad',
    description: 'Fresh mozzarella, tomatoes, and basil with balsamic glaze',
    cuisine: 'italian',
    dietary: ['vegetarian', 'gluten-free', 'low-carb'],
    difficulty: 'easy',
    mealType: 'appetizer',
    prepTime: 10,
    cookTime: 0,
    servings: 4,
    ingredients: [
      { name: 'fresh mozzarella', amount: '8 oz' },
      { name: 'ripe tomatoes', amount: '3 large' },
      { name: 'fresh basil', amount: '1 bunch' },
      { name: 'balsamic glaze', amount: '2 tbsp' },
      { name: 'olive oil', amount: '2 tbsp' },
      { name: 'salt and pepper', amount: 'to taste' },
    ],
    instructions: [
      'Slice mozzarella and tomatoes into 1/4 inch rounds.',
      'Arrange alternating slices on a platter.',
      'Tuck basil leaves between slices.',
      'Drizzle with olive oil and balsamic glaze.',
      'Season with salt and pepper.',
      'Serve immediately.',
    ],
    tags: ['salad', 'fresh', 'no-cook', 'summer'],
    calories: 220,
    protein: 14,
    carbs: 8,
    fat: 16,
  },
  {
    id: 'ita-004',
    name: 'Chicken Parmigiana',
    description: 'Breaded chicken breast with marinara and melted mozzarella',
    cuisine: 'italian',
    dietary: [],
    difficulty: 'medium',
    mealType: 'dinner',
    prepTime: 20,
    cookTime: 25,
    servings: 4,
    ingredients: [
      { name: 'chicken breasts', amount: '4 (6 oz each)' },
      { name: 'breadcrumbs', amount: '1 cup' },
      { name: 'parmesan cheese', amount: '1/2 cup grated' },
      { name: 'eggs', amount: '2' },
      { name: 'marinara sauce', amount: '2 cups' },
      { name: 'mozzarella cheese', amount: '8 oz sliced' },
      { name: 'olive oil', amount: '1/4 cup' },
    ],
    instructions: [
      'Pound chicken to 1/2 inch thickness.',
      'Mix breadcrumbs with parmesan.',
      'Dredge chicken in beaten eggs, then breadcrumb mixture.',
      'Fry chicken in oil until golden, about 4 minutes per side.',
      'Place chicken in baking dish, top with marinara and mozzarella.',
      'Bake at 400°F for 15 minutes until cheese melts.',
      'Serve with pasta or salad.',
    ],
    tags: ['chicken', 'cheese', 'baked', 'classic'],
    calories: 580,
    protein: 48,
    carbs: 28,
    fat: 32,
  },

  // Mexican
  {
    id: 'mex-001',
    name: 'Chicken Tacos',
    description: 'Soft corn tortillas with seasoned chicken and fresh toppings',
    cuisine: 'mexican',
    dietary: ['dairy-free', 'nut-free'],
    difficulty: 'easy',
    mealType: 'dinner',
    prepTime: 15,
    cookTime: 15,
    servings: 4,
    ingredients: [
      { name: 'chicken thighs', amount: '1.5 lbs' },
      { name: 'corn tortillas', amount: '12' },
      { name: 'cumin', amount: '1 tbsp' },
      { name: 'chili powder', amount: '1 tbsp' },
      { name: 'lime', amount: '2' },
      { name: 'onion', amount: '1' },
      { name: 'cilantro', amount: '1/2 bunch' },
      { name: 'salsa', amount: '1 cup' },
    ],
    instructions: [
      'Season chicken with cumin, chili powder, salt, and pepper.',
      'Cook chicken in a skillet over medium-high heat until done.',
      'Shred chicken with two forks.',
      'Warm tortillas in a dry skillet.',
      'Dice onion and chop cilantro.',
      'Assemble tacos with chicken, onion, cilantro, and salsa.',
      'Squeeze lime juice over top.',
    ],
    tags: ['tacos', 'quick', 'street-food', 'spicy'],
    calories: 320,
    protein: 28,
    carbs: 24,
    fat: 14,
  },
  {
    id: 'mex-002',
    name: 'Guacamole',
    description: 'Fresh avocado dip with lime, cilantro, and jalapeño',
    cuisine: 'mexican',
    dietary: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'low-carb'],
    difficulty: 'easy',
    mealType: 'appetizer',
    prepTime: 10,
    cookTime: 0,
    servings: 6,
    ingredients: [
      { name: 'avocados', amount: '3 ripe' },
      { name: 'lime', amount: '1' },
      { name: 'red onion', amount: '1/4 cup diced' },
      { name: 'jalapeño', amount: '1' },
      { name: 'cilantro', amount: '1/4 cup chopped' },
      { name: 'salt', amount: '1 tsp' },
    ],
    instructions: [
      'Cut avocados in half, remove pit, and scoop into bowl.',
      'Mash with a fork to desired consistency.',
      'Finely dice jalapeño (remove seeds for less heat).',
      'Add lime juice, onion, jalapeño, and cilantro.',
      'Season with salt and mix well.',
      'Serve immediately with chips.',
    ],
    tags: ['dip', 'avocado', 'no-cook', 'party'],
    calories: 150,
    protein: 2,
    carbs: 8,
    fat: 14,
  },
  {
    id: 'mex-003',
    name: 'Vegetarian Enchiladas',
    description: 'Corn tortillas filled with beans, cheese, and vegetables',
    cuisine: 'mexican',
    dietary: ['vegetarian'],
    difficulty: 'medium',
    mealType: 'dinner',
    prepTime: 25,
    cookTime: 30,
    servings: 6,
    ingredients: [
      { name: 'corn tortillas', amount: '12' },
      { name: 'black beans', amount: '15 oz can' },
      { name: 'cheddar cheese', amount: '2 cups shredded' },
      { name: 'bell peppers', amount: '2' },
      { name: 'onion', amount: '1' },
      { name: 'enchilada sauce', amount: '2 cups' },
      { name: 'cumin', amount: '1 tsp' },
    ],
    instructions: [
      'Preheat oven to 375°F.',
      'Sauté diced peppers and onion until soft.',
      'Mix beans, vegetables, 1 cup cheese, and cumin.',
      'Warm tortillas to make them pliable.',
      'Fill each tortilla with bean mixture and roll.',
      'Place seam-down in baking dish.',
      'Cover with enchilada sauce and remaining cheese.',
      'Bake for 25-30 minutes until bubbly.',
    ],
    tags: ['enchiladas', 'beans', 'cheese', 'baked'],
    calories: 380,
    protein: 16,
    carbs: 42,
    fat: 18,
  },

  // Asian
  {
    id: 'asi-001',
    name: 'Vegetable Stir Fry',
    description: 'Quick stir-fried vegetables with ginger and soy sauce',
    cuisine: 'asian',
    dietary: ['vegetarian', 'vegan', 'dairy-free', 'low-sodium'],
    difficulty: 'easy',
    mealType: 'dinner',
    prepTime: 10,
    cookTime: 10,
    servings: 4,
    ingredients: [
      { name: 'broccoli', amount: '2 cups florets' },
      { name: 'bell peppers', amount: '2' },
      { name: 'carrots', amount: '2' },
      { name: 'snow peas', amount: '1 cup' },
      { name: 'garlic', amount: '3 cloves' },
      { name: 'ginger', amount: '1 tbsp minced' },
      { name: 'soy sauce', amount: '3 tbsp' },
      { name: 'sesame oil', amount: '1 tbsp' },
      { name: 'vegetable oil', amount: '2 tbsp' },
    ],
    instructions: [
      'Cut all vegetables into bite-sized pieces.',
      'Heat vegetable oil in wok over high heat.',
      'Add garlic and ginger, stir for 30 seconds.',
      'Add broccoli and carrots, stir-fry 3 minutes.',
      'Add peppers and snow peas, stir-fry 2 minutes.',
      'Add soy sauce and sesame oil, toss to coat.',
      'Serve immediately over rice.',
    ],
    tags: ['stir-fry', 'vegetables', 'quick', 'healthy'],
    calories: 120,
    protein: 4,
    carbs: 14,
    fat: 6,
  },
  {
    id: 'asi-002',
    name: 'Chicken Fried Rice',
    description: 'Classic fried rice with chicken, eggs, and vegetables',
    cuisine: 'asian',
    dietary: ['dairy-free', 'nut-free'],
    difficulty: 'easy',
    mealType: 'dinner',
    prepTime: 10,
    cookTime: 15,
    servings: 4,
    ingredients: [
      { name: 'cooked rice', amount: '3 cups cold' },
      { name: 'chicken breast', amount: '8 oz diced' },
      { name: 'eggs', amount: '2' },
      { name: 'frozen peas', amount: '1/2 cup' },
      { name: 'carrots', amount: '1/2 cup diced' },
      { name: 'green onions', amount: '3' },
      { name: 'soy sauce', amount: '3 tbsp' },
      { name: 'sesame oil', amount: '1 tsp' },
      { name: 'vegetable oil', amount: '2 tbsp' },
    ],
    instructions: [
      'Season chicken with salt and pepper.',
      'Heat 1 tbsp oil in wok, cook chicken until done, remove.',
      'Scramble eggs in wok, remove and set aside.',
      'Heat remaining oil, add rice and break up clumps.',
      'Add peas, carrots, and chicken.',
      'Stir in soy sauce and sesame oil.',
      'Add eggs back, break into pieces.',
      'Top with green onions and serve.',
    ],
    tags: ['fried-rice', 'chicken', 'leftover-rice', 'comfort-food'],
    calories: 380,
    protein: 22,
    carbs: 48,
    fat: 12,
  },
  {
    id: 'asi-003',
    name: 'Thai Green Curry',
    description: 'Aromatic coconut curry with vegetables and basil',
    cuisine: 'thai',
    dietary: ['gluten-free', 'dairy-free'],
    difficulty: 'medium',
    mealType: 'dinner',
    prepTime: 15,
    cookTime: 25,
    servings: 4,
    ingredients: [
      { name: 'green curry paste', amount: '3 tbsp' },
      { name: 'coconut milk', amount: '14 oz can' },
      { name: 'chicken breast', amount: '1 lb' },
      { name: 'bamboo shoots', amount: '1 cup' },
      { name: 'bell peppers', amount: '2' },
      { name: 'Thai basil', amount: '1 cup' },
      { name: 'fish sauce', amount: '2 tbsp' },
      { name: 'palm sugar', amount: '1 tbsp' },
      { name: 'lime leaves', amount: '4', optional: true },
    ],
    instructions: [
      'Cut chicken into bite-sized pieces.',
      'Heat 1/4 cup coconut cream in wok over medium heat.',
      'Add curry paste and fry until fragrant (2 minutes).',
      'Add chicken and cook until sealed.',
      'Add remaining coconut milk and simmer 10 minutes.',
      'Add bamboo shoots and peppers, cook 5 minutes.',
      'Season with fish sauce and palm sugar.',
      'Stir in Thai basil and lime leaves.',
      'Serve with jasmine rice.',
    ],
    tags: ['curry', 'spicy', 'coconut', 'aromatic'],
    calories: 420,
    protein: 32,
    carbs: 16,
    fat: 28,
  },

  // Mediterranean
  {
    id: 'med-001',
    name: 'Greek Salad',
    description: 'Classic salad with tomatoes, cucumbers, olives, and feta',
    cuisine: 'greek',
    dietary: ['vegetarian', 'gluten-free', 'low-carb'],
    difficulty: 'easy',
    mealType: 'lunch',
    prepTime: 15,
    cookTime: 0,
    servings: 4,
    ingredients: [
      { name: 'tomatoes', amount: '4 large' },
      { name: 'cucumber', amount: '1' },
      { name: 'red onion', amount: '1/2' },
      { name: 'kalamata olives', amount: '1/2 cup' },
      { name: 'feta cheese', amount: '8 oz' },
      { name: 'oregano', amount: '1 tsp dried' },
      { name: 'olive oil', amount: '1/4 cup' },
    ],
    instructions: [
      'Cut tomatoes into wedges.',
      'Slice cucumber into half-moons.',
      'Thinly slice red onion.',
      'Combine vegetables in a large bowl.',
      'Add olives and block of feta on top.',
      'Sprinkle with oregano.',
      'Drizzle generously with olive oil.',
      'Serve with crusty bread.',
    ],
    tags: ['salad', 'fresh', 'no-cook', 'summer'],
    calories: 240,
    protein: 8,
    carbs: 10,
    fat: 20,
  },
  {
    id: 'med-002',
    name: 'Hummus',
    description: 'Creamy chickpea dip with tahini and lemon',
    cuisine: 'mediterranean',
    dietary: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free'],
    difficulty: 'easy',
    mealType: 'appetizer',
    prepTime: 10,
    cookTime: 0,
    servings: 8,
    ingredients: [
      { name: 'chickpeas', amount: '15 oz can' },
      { name: 'tahini', amount: '1/4 cup' },
      { name: 'lemon juice', amount: '3 tbsp' },
      { name: 'garlic', amount: '2 cloves' },
      { name: 'olive oil', amount: '2 tbsp' },
      { name: 'cumin', amount: '1/2 tsp' },
      { name: 'paprika', amount: 'for garnish' },
    ],
    instructions: [
      'Drain chickpeas, reserving liquid.',
      'Blend chickpeas, tahini, lemon juice, and garlic in food processor.',
      'Add olive oil and cumin.',
      'Blend until smooth, adding reserved liquid as needed.',
      'Season with salt to taste.',
      'Transfer to bowl, drizzle with olive oil.',
      'Sprinkle with paprika.',
      'Serve with pita or vegetables.',
    ],
    tags: ['dip', 'chickpeas', 'healthy', 'party'],
    calories: 140,
    protein: 5,
    carbs: 14,
    fat: 8,
  },
  {
    id: 'med-003',
    name: 'Mediterranean Baked Cod',
    description: 'Light fish with tomatoes, olives, and herbs',
    cuisine: 'mediterranean',
    dietary: ['gluten-free', 'dairy-free', 'low-carb', 'keto'],
    difficulty: 'easy',
    mealType: 'dinner',
    prepTime: 10,
    cookTime: 20,
    servings: 4,
    ingredients: [
      { name: 'cod fillets', amount: '4 (6 oz each)' },
      { name: 'cherry tomatoes', amount: '2 cups' },
      { name: 'kalamata olives', amount: '1/2 cup' },
      { name: 'capers', amount: '2 tbsp' },
      { name: 'garlic', amount: '3 cloves' },
      { name: 'olive oil', amount: '3 tbsp' },
      { name: 'dill', amount: '2 tbsp fresh' },
      { name: 'lemon', amount: '1' },
    ],
    instructions: [
      'Preheat oven to 400°F.',
      'Place cod in baking dish.',
      'Halve tomatoes and scatter around fish.',
      'Add olives, capers, and sliced garlic.',
      'Drizzle with olive oil.',
      'Bake for 15-20 minutes until fish flakes.',
      'Top with fresh dill and lemon juice.',
      'Serve with roasted vegetables.',
    ],
    tags: ['fish', 'healthy', 'low-carb', 'quick'],
    calories: 240,
    protein: 36,
    carbs: 6,
    fat: 10,
  },

  // American
  {
    id: 'ame-001',
    name: 'Classic Cheeseburger',
    description: 'Juicy beef patty with melted cheese and fresh toppings',
    cuisine: 'american',
    dietary: ['nut-free'],
    difficulty: 'easy',
    mealType: 'dinner',
    prepTime: 10,
    cookTime: 15,
    servings: 4,
    ingredients: [
      { name: 'ground beef', amount: '1.5 lbs (80/20)' },
      { name: 'hamburger buns', amount: '4' },
      { name: 'cheddar cheese', amount: '4 slices' },
      { name: 'lettuce', amount: '4 leaves' },
      { name: 'tomato', amount: '1 sliced' },
      { name: 'onion', amount: '1 sliced' },
      { name: 'pickles', amount: '8 slices' },
      { name: 'ketchup and mustard', amount: 'to taste' },
    ],
    instructions: [
      'Form beef into 4 patties, season with salt and pepper.',
      'Grill or pan-fry over medium-high heat.',
      'Cook 4 minutes per side for medium.',
      'Add cheese in last minute to melt.',
      'Toast buns on grill.',
      'Assemble burgers with toppings.',
      'Serve with fries or coleslaw.',
    ],
    tags: ['burger', 'beef', 'grilling', 'classic'],
    calories: 580,
    protein: 36,
    carbs: 32,
    fat: 34,
  },
  {
    id: 'ame-002',
    name: 'Buttermilk Pancakes',
    description: 'Fluffy pancakes perfect for weekend breakfast',
    cuisine: 'american',
    dietary: ['vegetarian', 'nut-free'],
    difficulty: 'easy',
    mealType: 'breakfast',
    prepTime: 10,
    cookTime: 15,
    servings: 4,
    ingredients: [
      { name: 'all-purpose flour', amount: '2 cups' },
      { name: 'buttermilk', amount: '2 cups' },
      { name: 'eggs', amount: '2' },
      { name: 'butter', amount: '4 tbsp melted' },
      { name: 'baking powder', amount: '2 tsp' },
      { name: 'baking soda', amount: '1/2 tsp' },
      { name: 'sugar', amount: '2 tbsp' },
      { name: 'salt', amount: '1/2 tsp' },
    ],
    instructions: [
      'Whisk together dry ingredients in large bowl.',
      'In separate bowl, whisk buttermilk, eggs, and melted butter.',
      'Pour wet into dry, mix until just combined (lumps are okay).',
      'Heat griddle or pan over medium heat.',
      'Pour 1/4 cup batter per pancake.',
      'Cook until bubbles form, flip and cook 1-2 more minutes.',
      'Serve with butter and maple syrup.',
    ],
    tags: ['breakfast', 'pancakes', 'sweet', 'weekend'],
    calories: 380,
    protein: 12,
    carbs: 52,
    fat: 14,
  },
  {
    id: 'ame-003',
    name: 'Mac and Cheese',
    description: 'Creamy baked macaroni and cheese with breadcrumb topping',
    cuisine: 'american',
    dietary: ['vegetarian', 'nut-free'],
    difficulty: 'medium',
    mealType: 'dinner',
    prepTime: 15,
    cookTime: 35,
    servings: 6,
    ingredients: [
      { name: 'elbow macaroni', amount: '1 lb' },
      { name: 'cheddar cheese', amount: '3 cups shredded' },
      { name: 'gruyere cheese', amount: '1 cup shredded' },
      { name: 'milk', amount: '3 cups' },
      { name: 'butter', amount: '4 tbsp' },
      { name: 'flour', amount: '1/4 cup' },
      { name: 'breadcrumbs', amount: '1/2 cup' },
      { name: 'paprika', amount: '1/2 tsp' },
    ],
    instructions: [
      'Cook macaroni until al dente, drain.',
      'Make roux: melt butter, whisk in flour for 2 minutes.',
      'Gradually add milk, whisking until thickened.',
      'Remove from heat, stir in 2 cups cheddar and all gruyere.',
      'Mix cheese sauce with pasta.',
      'Transfer to baking dish.',
      'Top with remaining cheddar and breadcrumbs mixed with paprika.',
      'Bake at 350°F for 25 minutes until bubbly.',
    ],
    tags: ['pasta', 'cheese', 'comfort-food', 'baked'],
    calories: 620,
    protein: 28,
    carbs: 58,
    fat: 32,
  },

  // Indian
  {
    id: 'ind-001',
    name: 'Chana Masala',
    description: 'Spicy chickpea curry with tomatoes and spices',
    cuisine: 'indian',
    dietary: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free'],
    difficulty: 'medium',
    mealType: 'dinner',
    prepTime: 10,
    cookTime: 30,
    servings: 4,
    ingredients: [
      { name: 'chickpeas', amount: '2 cans (15 oz each)' },
      { name: 'onion', amount: '1 large' },
      { name: 'tomatoes', amount: '14 oz can' },
      { name: 'ginger', amount: '1 tbsp minced' },
      { name: 'garlic', amount: '3 cloves' },
      { name: 'garam masala', amount: '1 tbsp' },
      { name: 'cumin', amount: '1 tsp' },
      { name: 'turmeric', amount: '1/2 tsp' },
      { name: 'cayenne', amount: '1/2 tsp' },
    ],
    instructions: [
      'Sauté diced onion until golden brown.',
      'Add ginger and garlic, cook 1 minute.',
      'Add spices and toast for 30 seconds.',
      'Add tomatoes and simmer 10 minutes.',
      'Add drained chickpeas and 1 cup water.',
      'Simmer 15 minutes until thickened.',
      'Mash some chickpeas against pot side.',
      'Garnish with cilantro, serve with rice or naan.',
    ],
    tags: ['curry', 'chickpeas', 'spicy', 'healthy'],
    calories: 280,
    protein: 12,
    carbs: 42,
    fat: 8,
  },
  {
    id: 'ind-002',
    name: 'Chicken Tikka Masala',
    description: 'Creamy tomato curry with marinated grilled chicken',
    cuisine: 'indian',
    dietary: ['gluten-free', 'nut-free'],
    difficulty: 'medium',
    mealType: 'dinner',
    prepTime: 30,
    cookTime: 40,
    servings: 4,
    ingredients: [
      { name: 'chicken thighs', amount: '1.5 lbs' },
      { name: 'yogurt', amount: '1/2 cup' },
      { name: 'garam masala', amount: '2 tbsp' },
      { name: 'tomatoes', amount: '14 oz can' },
      { name: 'heavy cream', amount: '1/2 cup' },
      { name: 'butter', amount: '4 tbsp' },
      { name: 'ginger', amount: '1 tbsp' },
      { name: 'garlic', amount: '4 cloves' },
      { name: 'cumin', amount: '1 tsp' },
    ],
    instructions: [
      'Marinate chicken in yogurt, 1 tbsp garam masala, salt for 2 hours.',
      'Grill or broil chicken until charred, cut into pieces.',
      'Melt butter, sauté ginger and garlic.',
      'Add remaining garam masala and cumin.',
      'Add tomatoes, simmer 15 minutes.',
      'Stir in cream and chicken.',
      'Simmer 10 more minutes.',
      'Serve with basmati rice and naan.',
    ],
    tags: ['curry', 'chicken', 'creamy', 'spicy'],
    calories: 480,
    protein: 38,
    carbs: 12,
    fat: 32,
  },

  // Japanese
  {
    id: 'jap-001',
    name: 'Miso Soup',
    description: 'Traditional Japanese soup with tofu and seaweed',
    cuisine: 'japanese',
    dietary: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'low-carb', 'low-sodium'],
    difficulty: 'easy',
    mealType: 'appetizer',
    prepTime: 5,
    cookTime: 10,
    servings: 4,
    ingredients: [
      { name: 'dashi stock', amount: '4 cups' },
      { name: 'miso paste', amount: '3 tbsp' },
      { name: 'tofu', amount: '8 oz cubed' },
      { name: 'wakame seaweed', amount: '2 tbsp dried' },
      { name: 'green onions', amount: '2 sliced' },
    ],
    instructions: [
      'Heat dashi in pot until simmering.',
      'Soak wakame in water for 5 minutes, drain.',
      'Add tofu and wakame to dashi.',
      'Simmer 2 minutes.',
      'Remove 1/2 cup hot dashi, dissolve miso in it.',
      'Return miso mixture to pot, do not boil.',
      'Garnish with green onions.',
    ],
    tags: ['soup', 'tofu', 'light', 'traditional'],
    calories: 80,
    protein: 6,
    carbs: 6,
    fat: 4,
  },
  {
    id: 'jap-002',
    name: 'Teriyaki Salmon',
    description: 'Glazed salmon with sweet and savory teriyaki sauce',
    cuisine: 'japanese',
    dietary: ['gluten-free', 'dairy-free', 'low-carb', 'paleo'],
    difficulty: 'easy',
    mealType: 'dinner',
    prepTime: 10,
    cookTime: 15,
    servings: 4,
    ingredients: [
      { name: 'salmon fillets', amount: '4 (6 oz each)' },
      { name: 'soy sauce', amount: '1/4 cup' },
      { name: 'mirin', amount: '2 tbsp' },
      { name: 'sake', amount: '2 tbsp' },
      { name: 'brown sugar', amount: '2 tbsp' },
      { name: 'ginger', amount: '1 tsp grated' },
      { name: 'garlic', amount: '1 clove minced' },
      { name: 'sesame seeds', amount: 'for garnish' },
    ],
    instructions: [
      'Mix soy sauce, mirin, sake, sugar, ginger, and garlic.',
      'Marinate salmon in half the sauce for 15 minutes.',
      'Heat oil in pan over medium-high heat.',
      'Cook salmon 4 minutes per side until done.',
      'Remove salmon, add remaining sauce to pan.',
      'Simmer until thickened, pour over salmon.',
      'Garnish with sesame seeds and green onions.',
    ],
    tags: ['salmon', 'teriyaki', 'fish', 'glazed'],
    calories: 340,
    protein: 38,
    carbs: 12,
    fat: 14,
  },

  // French
  {
    id: 'fre-001',
    name: 'French Omelette',
    description: 'Classic French-style omelette with herbs',
    cuisine: 'french',
    dietary: ['vegetarian', 'gluten-free', 'low-carb', 'keto'],
    difficulty: 'medium',
    mealType: 'breakfast',
    prepTime: 5,
    cookTime: 5,
    servings: 1,
    ingredients: [
      { name: 'eggs', amount: '3' },
      { name: 'butter', amount: '1 tbsp' },
      { name: 'chives', amount: '1 tbsp chopped' },
      { name: 'parsley', amount: '1 tsp chopped' },
      { name: 'gruyere cheese', amount: '2 tbsp grated', optional: true },
      { name: 'salt and pepper', amount: 'to taste' },
    ],
    instructions: [
      'Whisk eggs with salt, pepper, and herbs.',
      'Heat butter in non-stick pan over medium-low heat.',
      'Pour in eggs, let set for 10 seconds.',
      'Use spatula to stir gently, forming curds.',
      'When mostly set but still wet, tilt pan.',
      'Fold omelette onto itself.',
      'Slide onto plate, seam side down.',
      'Serve immediately.',
    ],
    tags: ['eggs', 'breakfast', 'classic', 'elegant'],
    calories: 280,
    protein: 18,
    carbs: 2,
    fat: 22,
  },
  {
    id: 'fre-002',
    name: 'Ratatouille',
    description: 'Provençal vegetable stew with eggplant, zucchini, and tomatoes',
    cuisine: 'french',
    dietary: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'low-carb'],
    difficulty: 'medium',
    mealType: 'dinner',
    prepTime: 20,
    cookTime: 45,
    servings: 6,
    ingredients: [
      { name: 'eggplant', amount: '1 large' },
      { name: 'zucchini', amount: '2' },
      { name: 'bell peppers', amount: '2' },
      { name: 'tomatoes', amount: '4' },
      { name: 'onion', amount: '1' },
      { name: 'garlic', amount: '4 cloves' },
      { name: 'herbs de Provence', amount: '1 tbsp' },
      { name: 'olive oil', amount: '1/4 cup' },
    ],
    instructions: [
      'Dice all vegetables into 1-inch cubes.',
      'Sauté onion and garlic in olive oil.',
      'Add eggplant, cook 5 minutes.',
      'Add peppers and zucchini, cook 5 minutes.',
      'Add tomatoes and herbs.',
      'Simmer 30 minutes until vegetables are tender.',
      'Season with salt and pepper.',
      'Serve hot or at room temperature.',
    ],
    tags: ['vegetables', 'stew', 'healthy', 'summer'],
    calories: 140,
    protein: 3,
    carbs: 16,
    fat: 8,
  },

  // Desserts
  {
    id: 'des-001',
    name: 'Chocolate Chip Cookies',
    description: 'Classic chewy chocolate chip cookies',
    cuisine: 'american',
    dietary: ['vegetarian', 'nut-free'],
    difficulty: 'easy',
    mealType: 'dessert',
    prepTime: 15,
    cookTime: 12,
    servings: 24,
    ingredients: [
      { name: 'all-purpose flour', amount: '2.25 cups' },
      { name: 'butter', amount: '1 cup softened' },
      { name: 'brown sugar', amount: '3/4 cup' },
      { name: 'granulated sugar', amount: '3/4 cup' },
      { name: 'eggs', amount: '2' },
      { name: 'vanilla extract', amount: '2 tsp' },
      { name: 'baking soda', amount: '1 tsp' },
      { name: 'chocolate chips', amount: '2 cups' },
    ],
    instructions: [
      'Preheat oven to 375°F.',
      'Cream butter and sugars until fluffy.',
      'Beat in eggs and vanilla.',
      'Mix in flour and baking soda.',
      'Fold in chocolate chips.',
      'Drop by tablespoon onto baking sheets.',
      'Bake 10-12 minutes until golden.',
      'Cool on wire rack.',
    ],
    tags: ['cookies', 'chocolate', 'baking', 'classic'],
    calories: 180,
    protein: 2,
    carbs: 22,
    fat: 10,
  },
  {
    id: 'des-002',
    name: 'Tiramisu',
    description: 'Italian coffee-flavored layered dessert',
    cuisine: 'italian',
    dietary: ['vegetarian', 'nut-free'],
    difficulty: 'hard',
    mealType: 'dessert',
    prepTime: 30,
    cookTime: 0,
    servings: 12,
    ingredients: [
      { name: 'mascarpone cheese', amount: '16 oz' },
      { name: 'espresso', amount: '1.5 cups cooled' },
      { name: 'ladyfingers', amount: '40' },
      { name: 'eggs', amount: '6 separated' },
      { name: 'sugar', amount: '1/2 cup' },
      { name: 'cocoa powder', amount: 'for dusting' },
      { name: 'marsala wine', amount: '2 tbsp', optional: true },
    ],
    instructions: [
      'Beat egg yolks with sugar until pale.',
      'Mix in mascarpone until smooth.',
      'Whip egg whites to stiff peaks.',
      'Fold whites into mascarpone mixture.',
      'Dip ladyfingers briefly in espresso.',
      'Layer in dish: cookies, cream, repeat.',
      'Refrigerate at least 4 hours.',
      'Dust with cocoa before serving.',
    ],
    tags: ['dessert', 'coffee', 'italian', 'no-bake'],
    calories: 320,
    protein: 6,
    carbs: 28,
    fat: 22,
  },
  {
    id: 'des-003',
    name: 'Fresh Fruit Salad',
    description: 'Colorful mix of seasonal fruits with honey lime dressing',
    cuisine: 'mediterranean',
    dietary: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'low-sodium'],
    difficulty: 'easy',
    mealType: 'dessert',
    prepTime: 15,
    cookTime: 0,
    servings: 6,
    ingredients: [
      { name: 'strawberries', amount: '2 cups sliced' },
      { name: 'blueberries', amount: '1 cup' },
      { name: 'pineapple', amount: '2 cups cubed' },
      { name: 'grapes', amount: '2 cups halved' },
      { name: 'kiwi', amount: '3 sliced' },
      { name: 'honey', amount: '2 tbsp' },
      { name: 'lime juice', amount: '2 tbsp' },
      { name: 'mint', amount: '1/4 cup chopped', optional: true },
    ],
    instructions: [
      'Wash and prepare all fruit.',
      'Combine in large bowl.',
      'Whisk honey and lime juice.',
      'Drizzle over fruit and toss gently.',
      'Garnish with fresh mint.',
      'Chill until ready to serve.',
      'Best served within 2 hours.',
    ],
    tags: ['fruit', 'fresh', 'healthy', 'no-cook'],
    calories: 120,
    protein: 1,
    carbs: 30,
    fat: 0,
  },

  // Breakfast items
  {
    id: 'brk-001',
    name: 'Avocado Toast',
    description: 'Smashed avocado on toasted bread with toppings',
    cuisine: 'american',
    dietary: ['vegetarian', 'vegan', 'dairy-free', 'nut-free'],
    difficulty: 'easy',
    mealType: 'breakfast',
    prepTime: 5,
    cookTime: 5,
    servings: 1,
    ingredients: [
      { name: 'bread', amount: '2 slices' },
      { name: 'avocado', amount: '1 ripe' },
      { name: 'lemon juice', amount: '1 tsp' },
      { name: 'red pepper flakes', amount: 'pinch' },
      { name: 'salt', amount: 'to taste' },
      { name: 'everything bagel seasoning', amount: '1 tsp', optional: true },
    ],
    instructions: [
      'Toast bread until golden.',
      'Mash avocado with lemon juice and salt.',
      'Spread avocado on toast.',
      'Sprinkle with red pepper flakes.',
      'Add optional toppings as desired.',
      'Serve immediately.',
    ],
    tags: ['breakfast', 'avocado', 'quick', 'trendy'],
    calories: 280,
    protein: 6,
    carbs: 24,
    fat: 20,
  },
  {
    id: 'brk-002',
    name: 'Greek Yogurt Parfait',
    description: 'Layered yogurt with granola and fresh berries',
    cuisine: 'mediterranean',
    dietary: ['vegetarian', 'gluten-free'],
    difficulty: 'easy',
    mealType: 'breakfast',
    prepTime: 5,
    cookTime: 0,
    servings: 1,
    ingredients: [
      { name: 'Greek yogurt', amount: '1 cup' },
      { name: 'granola', amount: '1/2 cup' },
      { name: 'mixed berries', amount: '1/2 cup' },
      { name: 'honey', amount: '1 tbsp' },
      { name: 'chia seeds', amount: '1 tsp', optional: true },
    ],
    instructions: [
      'Layer half the yogurt in a glass or bowl.',
      'Add half the granola and berries.',
      'Repeat layers.',
      'Drizzle with honey.',
      'Sprinkle with chia seeds if using.',
      'Serve immediately.',
    ],
    tags: ['breakfast', 'yogurt', 'healthy', 'quick'],
    calories: 320,
    protein: 18,
    carbs: 42,
    fat: 10,
  },
  {
    id: 'brk-003',
    name: 'Shakshuka',
    description: 'Eggs poached in spicy tomato sauce',
    cuisine: 'mediterranean',
    dietary: ['vegetarian', 'gluten-free', 'nut-free'],
    difficulty: 'medium',
    mealType: 'breakfast',
    prepTime: 10,
    cookTime: 25,
    servings: 4,
    ingredients: [
      { name: 'eggs', amount: '6' },
      { name: 'tomatoes', amount: '28 oz can crushed' },
      { name: 'bell pepper', amount: '1 diced' },
      { name: 'onion', amount: '1 diced' },
      { name: 'garlic', amount: '3 cloves' },
      { name: 'cumin', amount: '1 tsp' },
      { name: 'paprika', amount: '1 tbsp' },
      { name: 'cayenne', amount: '1/4 tsp' },
    ],
    instructions: [
      'Sauté onion and pepper until soft.',
      'Add garlic and spices, cook 1 minute.',
      'Add tomatoes, simmer 15 minutes.',
      'Make wells in sauce with spoon.',
      'Crack eggs into wells.',
      'Cover and cook 5-8 minutes until eggs set.',
      'Garnish with cilantro or parsley.',
      'Serve with crusty bread.',
    ],
    tags: ['eggs', 'breakfast', 'spicy', 'one-pan'],
    calories: 220,
    protein: 14,
    carbs: 14,
    fat: 12,
  },

  // Quick meals (<30 min)
  {
    id: 'qck-001',
    name: 'Sheet Pan Chicken and Vegetables',
    description: 'Easy one-pan meal with roasted chicken and seasonal veggies',
    cuisine: 'american',
    dietary: ['gluten-free', 'dairy-free', 'low-carb', 'keto'],
    difficulty: 'easy',
    mealType: 'dinner',
    prepTime: 10,
    cookTime: 25,
    servings: 4,
    ingredients: [
      { name: 'chicken thighs', amount: '4' },
      { name: 'broccoli', amount: '2 cups' },
      { name: 'bell peppers', amount: '2' },
      { name: 'red onion', amount: '1' },
      { name: 'olive oil', amount: '3 tbsp' },
      { name: 'garlic powder', amount: '1 tsp' },
      { name: 'paprika', amount: '1 tsp' },
    ],
    instructions: [
      'Preheat oven to 425°F.',
      'Cut vegetables into chunks.',
      'Toss vegetables with half the oil and seasonings.',
      'Place chicken and vegetables on sheet pan.',
      'Drizzle chicken with remaining oil, season.',
      'Roast 25 minutes until chicken is done.',
      'Rest 5 minutes before serving.',
    ],
    tags: ['sheet-pan', 'quick', 'healthy', 'one-pan'],
    calories: 380,
    protein: 32,
    carbs: 12,
    fat: 22,
  },
  {
    id: 'qck-002',
    name: 'Quick Quinoa Bowl',
    description: 'Nutritious grain bowl with vegetables and tahini dressing',
    cuisine: 'mediterranean',
    dietary: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free'],
    difficulty: 'easy',
    mealType: 'lunch',
    prepTime: 10,
    cookTime: 15,
    servings: 2,
    ingredients: [
      { name: 'quinoa', amount: '1 cup' },
      { name: 'water', amount: '2 cups' },
      { name: 'chickpeas', amount: '15 oz can' },
      { name: 'cucumber', amount: '1 diced' },
      { name: 'cherry tomatoes', amount: '1 cup' },
      { name: 'tahini', amount: '2 tbsp' },
      { name: 'lemon juice', amount: '1 tbsp' },
    ],
    instructions: [
      'Rinse quinoa and cook in water for 15 minutes.',
      'Drain and rinse chickpeas.',
      'Halve tomatoes, dice cucumber.',
      'Whisk tahini with lemon juice and water.',
      'Divide quinoa into bowls.',
      'Top with chickpeas and vegetables.',
      'Drizzle with tahini dressing.',
    ],
    tags: ['bowl', 'quinoa', 'healthy', 'quick'],
    calories: 420,
    protein: 14,
    carbs: 58,
    fat: 14,
  },
];

// Helper function for SQLite run with result
function runWithResult(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export class RecipeSuggesterSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const baseDir = path.join(os.homedir(), '.openclaw', 'skills', 'recipe-suggester');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    this.dbPath = path.join(baseDir, 'data.db');
  }

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (this.db) return;

    this.initPromise = new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        this.initSchema().then(resolve).catch(reject);
      });
    });

    return this.initPromise;
  }

  private async initSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        // Recipe tracking table
        this.db!.run(`
          CREATE TABLE IF NOT EXISTS recipe_tracking (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            cuisine TEXT,
            dietary TEXT,
            difficulty TEXT,
            meal_type TEXT,
            prep_time INTEGER,
            cook_time INTEGER,
            servings INTEGER,
            ingredients TEXT,
            instructions TEXT,
            tags TEXT,
            calories INTEGER,
            protein INTEGER,
            carbs INTEGER,
            fat INTEGER,
            is_favorite INTEGER DEFAULT 0,
            times_cooked INTEGER DEFAULT 0,
            last_cooked TEXT
          )
        `);

        // User preferences
        this.db!.run(`
          CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            default_dietary TEXT,
            preferred_cuisines TEXT,
            max_difficulty TEXT,
            default_servings INTEGER
          )
        `);

        // Recipe history
        this.db!.run(`
          CREATE TABLE IF NOT EXISTS recipe_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipe_id TEXT NOT NULL,
            cooked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            rating INTEGER,
            notes TEXT,
            FOREIGN KEY (recipe_id) REFERENCES recipe_tracking(id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async suggestRecipes(request: SuggestionRequest): Promise<SuggestionResult[]> {
    await this.initialize();

    const { dietary, cuisine, difficulty, mealType, maxTime, minServings, maxServings, tags, excludeIngredients, count = 10 } = request;

    // Score all recipes
    const scoredRecipes: SuggestionResult[] = RECIPE_DATABASE.map(recipe => {
      let score = 0;
      const reasons: string[] = [];

      // Dietary matching (highest weight)
      if (dietary && dietary.length > 0) {
        const matches = recipe.dietary.filter(d => dietary.includes(d));
        if (matches.length === dietary.length) {
          score += 30;
          reasons.push(`Matches all dietary requirements (${matches.length})`);
        } else if (matches.length > 0) {
          score += matches.length * 10;
          reasons.push(`Matches ${matches.length} dietary requirement(s)`);
        }
      }

      // Cuisine matching
      if (cuisine && recipe.cuisine === cuisine) {
        score += 25;
        reasons.push(`Authentic ${cuisine} cuisine`);
      }

      // Difficulty matching
      if (difficulty && recipe.difficulty === difficulty) {
        score += 15;
        reasons.push(`${difficulty} difficulty level`);
      }

      // Meal type matching
      if (mealType && recipe.mealType === mealType) {
        score += 20;
        reasons.push(`Perfect for ${mealType}`);
      }

      // Time constraint
      const totalTime = recipe.prepTime + recipe.cookTime;
      if (maxTime && totalTime <= maxTime) {
        score += 10;
        reasons.push(`Ready in ${totalTime} minutes`);
      }

      // Servings matching
      if (minServings && recipe.servings >= minServings) {
        score += 5;
      }
      if (maxServings && recipe.servings <= maxServings) {
        score += 5;
      }

      // Tag matching
      if (tags && tags.length > 0) {
        const tagMatches = recipe.tags.filter(t => 
          tags.some(tag => t.toLowerCase().includes(tag.toLowerCase()))
        );
        score += tagMatches.length * 8;
        if (tagMatches.length > 0) {
          reasons.push(`Matches ${tagMatches.length} tag(s)`);
        }
      }

      // Exclude ingredients penalty
      if (excludeIngredients && excludeIngredients.length > 0) {
        const hasExcluded = recipe.ingredients.some(ing => 
          excludeIngredients.some(ex => 
            ing.name.toLowerCase().includes(ex.toLowerCase())
          )
        );
        if (hasExcluded) {
          score = -1; // Exclude entirely
        }
      }

      return { recipe, matchScore: score, matchReasons: reasons };
    });

    // Sort by score and return top results
    return scoredRecipes
      .filter(r => r.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, count);
  }

  async findByIngredients(
    ingredients: string[],
    options: { matchThreshold?: number; maxMissing?: number } = {}
  ): Promise<{ recipe: Recipe; matchedIngredients: string[]; missingIngredients: string[]; matchPercentage: number }[]> {
    await this.initialize();

    const { matchThreshold = 0.5, maxMissing = Infinity } = options;
    const normalizedIngredients = ingredients.map(i => i.toLowerCase().trim());

    const results = RECIPE_DATABASE.map(recipe => {
      const recipeIngredients = recipe.ingredients.map(ing => ing.name.toLowerCase());
      
      const matchedIngredients: string[] = [];
      const missingIngredients: string[] = [];

      for (const recipeIng of recipeIngredients) {
        const isMatched = normalizedIngredients.some(userIng => 
          recipeIng.includes(userIng) || userIng.includes(recipeIng)
        );
        
        if (isMatched) {
          matchedIngredients.push(recipeIng);
        } else {
          missingIngredients.push(recipeIng);
        }
      }

      const matchPercentage = matchedIngredients.length / recipeIngredients.length;

      return {
        recipe,
        matchedIngredients,
        missingIngredients,
        matchPercentage
      };
    });

    return results
      .filter(r => r.matchPercentage >= matchThreshold && r.missingIngredients.length <= maxMissing)
      .sort((a, b) => b.matchPercentage - a.matchPercentage);
  }

  async getRecipeById(id: string): Promise<Recipe | null> {
    return RECIPE_DATABASE.find(r => r.id === id) || null;
  }

  async getRandomRecipe(filters: Partial<SuggestionRequest> = {}): Promise<Recipe | null> {
    const suggestions = await this.suggestRecipes({ ...filters, count: 1000 });
    if (suggestions.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * suggestions.length);
    return suggestions[randomIndex].recipe;
  }

  async getRecipesByCuisine(cuisine: CuisineType): Promise<Recipe[]> {
    return RECIPE_DATABASE.filter(r => r.cuisine === cuisine);
  }

  async getRecipesByDietary(dietary: DietaryType): Promise<Recipe[]> {
    return RECIPE_DATABASE.filter(r => r.dietary.includes(dietary));
  }

  async getRecipesByDifficulty(difficulty: DifficultyLevel): Promise<Recipe[]> {
    return RECIPE_DATABASE.filter(r => r.difficulty === difficulty);
  }

  async getQuickRecipes(maxTime: number = 30): Promise<Recipe[]> {
    return RECIPE_DATABASE.filter(r => r.prepTime + r.cookTime <= maxTime);
  }

  async getAvailableDiets(): Promise<DietaryType[]> {
    const diets = new Set<DietaryType>();
    RECIPE_DATABASE.forEach(r => r.dietary.forEach(d => diets.add(d)));
    return Array.from(diets).sort();
  }

  async getAvailableCuisines(): Promise<CuisineType[]> {
    const cuisines = new Set<CuisineType>();
    RECIPE_DATABASE.forEach(r => cuisines.add(r.cuisine));
    return Array.from(cuisines).sort();
  }

  async getAvailableDifficulties(): Promise<DifficultyLevel[]> {
    return ['easy', 'medium', 'hard'];
  }

  async getAvailableMealTypes(): Promise<MealType[]> {
    const types = new Set<MealType>();
    RECIPE_DATABASE.forEach(r => types.add(r.mealType));
    return Array.from(types).sort();
  }

  async getStats(): Promise<{
    totalRecipes: number;
    byCuisine: Record<string, number>;
    byDifficulty: Record<string, number>;
    byMealType: Record<string, number>;
    vegetarianCount: number;
    veganCount: number;
    glutenFreeCount: number;
    averageCookingTime: number;
  }> {
    const byCuisine: Record<string, number> = {};
    const byDifficulty: Record<string, number> = {};
    const byMealType: Record<string, number> = {};
    
    let vegetarianCount = 0;
    let veganCount = 0;
    let glutenFreeCount = 0;
    let totalCookingTime = 0;

    RECIPE_DATABASE.forEach(recipe => {
      byCuisine[recipe.cuisine] = (byCuisine[recipe.cuisine] || 0) + 1;
      byDifficulty[recipe.difficulty] = (byDifficulty[recipe.difficulty] || 0) + 1;
      byMealType[recipe.mealType] = (byMealType[recipe.mealType] || 0) + 1;
      
      if (recipe.dietary.includes('vegetarian')) vegetarianCount++;
      if (recipe.dietary.includes('vegan')) veganCount++;
      if (recipe.dietary.includes('gluten-free')) glutenFreeCount++;
      
      totalCookingTime += recipe.prepTime + recipe.cookTime;
    });

    return {
      totalRecipes: RECIPE_DATABASE.length,
      byCuisine,
      byDifficulty,
      byMealType,
      vegetarianCount,
      veganCount,
      glutenFreeCount,
      averageCookingTime: Math.round(totalCookingTime / RECIPE_DATABASE.length)
    };
  }

  async markAsCooked(recipeId: string, rating?: number, notes?: string): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const recipe = await this.getRecipeById(recipeId);
    if (!recipe) throw new Error('Recipe not found');

    // Insert or update recipe tracking
    await runWithResult(this.db, `
      INSERT INTO recipe_tracking 
        (id, name, description, cuisine, dietary, difficulty, meal_type, prep_time, cook_time, servings, ingredients, instructions, tags, calories, protein, carbs, fat, times_cooked, last_cooked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET 
        times_cooked = times_cooked + 1,
        last_cooked = datetime('now')
    `, [
      recipe.id, recipe.name, recipe.description, recipe.cuisine, JSON.stringify(recipe.dietary),
      recipe.difficulty, recipe.mealType, recipe.prepTime, recipe.cookTime, recipe.servings,
      JSON.stringify(recipe.ingredients), JSON.stringify(recipe.instructions), JSON.stringify(recipe.tags),
      recipe.calories || null, recipe.protein || null, recipe.carbs || null, recipe.fat || null
    ]);

    // Add to history
    await runWithResult(this.db, `
      INSERT INTO recipe_history (recipe_id, rating, notes) VALUES (?, ?, ?)
    `, [recipeId, rating || null, notes || null]);
  }

  async toggleFavorite(recipeId: string): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const recipe = await this.getRecipeById(recipeId);
    if (!recipe) throw new Error('Recipe not found');

    // Get current favorite status
    const current = await new Promise<any>((resolve, reject) => {
      this.db!.get('SELECT is_favorite FROM recipe_tracking WHERE id = ?', [recipeId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const newStatus = current ? (current.is_favorite ? 0 : 1) : 1;

    await runWithResult(this.db, `
      INSERT INTO recipe_tracking (id, name, is_favorite) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET is_favorite = ?
    `, [recipeId, recipe.name, newStatus, newStatus]);

    return newStatus === 1;
  }

  async getFavorites(): Promise<Recipe[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const rows = await new Promise<any[]>((resolve, reject) => {
      this.db!.all('SELECT id FROM recipe_tracking WHERE is_favorite = 1', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const recipes: Recipe[] = [];
    for (const row of rows) {
      const recipe = await this.getRecipeById(row.id);
      if (recipe) recipes.push(recipe);
    }
    return recipes;
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      await this.initialize();
      return { 
        status: 'healthy', 
        message: `Recipe suggester is operational with ${RECIPE_DATABASE.length} recipes` 
      };
    } catch (error) {
      return { status: 'unhealthy', message: `Error: ${error}` };
    }
  }

  async close(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
        this.db = null;
        this.initPromise = null;
      });
    }
  }
}

export default RecipeSuggesterSkill;
