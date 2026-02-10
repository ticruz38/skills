#!/usr/bin/env node
import { RecipeSuggesterSkill, SuggestionRequest, DietaryType, CuisineType, DifficultyLevel, MealType } from './index';

const skill = new RecipeSuggesterSkill();

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function printRecipe(recipe: any, detailed = false) {
  console.log(`\n🍽️  ${recipe.name}`);
  console.log(`   ID: ${recipe.id}`);
  console.log(`   ${recipe.description}`);
  console.log(`   Cuisine: ${recipe.cuisine} | Difficulty: ${recipe.difficulty} | Meal: ${recipe.mealType}`);
  console.log(`   ⏱️  Prep: ${formatTime(recipe.prepTime)} | Cook: ${formatTime(recipe.cookTime)} | Serves: ${recipe.servings}`);
  
  if (recipe.dietary.length > 0) {
    console.log(`   🥗 Dietary: ${recipe.dietary.join(', ')}`);
  }
  
  if (recipe.calories) {
    console.log(`   📊 Calories: ${recipe.calories} | Protein: ${recipe.protein}g | Carbs: ${recipe.carbs}g | Fat: ${recipe.fat}g`);
  }

  if (detailed) {
    console.log(`\n   📋 Ingredients:`);
    recipe.ingredients.forEach((ing: any) => {
      const optional = ing.optional ? ' (optional)' : '';
      console.log(`      • ${ing.name}: ${ing.amount}${optional}`);
    });
    
    console.log(`\n   📝 Instructions:`);
    recipe.instructions.forEach((step: string, i: number) => {
      console.log(`      ${i + 1}. ${step}`);
    });
    
    if (recipe.tags.length > 0) {
      console.log(`\n   🏷️  Tags: ${recipe.tags.join(', ')}`);
    }
  }
  console.log();
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'health':
      case 'status': {
        const health = await skill.healthCheck();
        console.log(`Status: ${health.status}`);
        console.log(`Message: ${health.message}`);
        break;
      }

      case 'suggest':
      case 'search': {
        const request: SuggestionRequest = { count: 10 };
        
        for (let i = 1; i < args.length; i += 2) {
          const flag = args[i];
          const value = args[i + 1];
          
          switch (flag) {
            case '--dietary':
            case '-d':
              request.dietary = value.split(',').map(d => d.trim()) as DietaryType[];
              break;
            case '--cuisine':
            case '-c':
              request.cuisine = value as CuisineType;
              break;
            case '--difficulty':
              request.difficulty = value as DifficultyLevel;
              break;
            case '--meal':
            case '-m':
              request.mealType = value as MealType;
              break;
            case '--time':
            case '-t':
              request.maxTime = parseInt(value);
              break;
            case '--servings':
            case '-s':
              request.minServings = parseInt(value);
              request.maxServings = parseInt(value);
              break;
            case '--count':
            case '-n':
              request.count = parseInt(value);
              break;
            case '--exclude':
            case '-e':
              request.excludeIngredients = value.split(',').map(e => e.trim());
              break;
          }
        }

        const results = await skill.suggestRecipes(request);
        
        if (results.length === 0) {
          console.log('No recipes found matching your criteria.');
          console.log('Try broadening your search or use "list" to see all available options.');
        } else {
          console.log(`\nFound ${results.length} recipe(s):\n`);
          results.forEach((result, i) => {
            console.log(`${i + 1}. Score: ${result.matchScore}`);
            console.log(`   Reasons: ${result.matchReasons.join(', ')}`);
            printRecipe(result.recipe);
          });
        }
        break;
      }

      case 'by-ingredients':
      case 'ingredients': {
        const ingredientsArg = args.find((_, i) => args[i - 1] === '--ingredients' || args[i - 1] === '-i');
        const ingredients = ingredientsArg ? ingredientsArg.split(',').map(i => i.trim()) : args.slice(1);
        
        if (ingredients.length === 0) {
          console.log('Usage: recipe-suggester ingredients "chicken,rice,onion"');
          console.log('   or: recipe-suggester ingredients -i "chicken,rice,onion"');
          break;
        }

        const thresholdArg = args.find((_, i) => args[i - 1] === '--threshold' || args[i - 1] === '-t');
        const threshold = thresholdArg ? parseFloat(thresholdArg) : 0.3;

        const results = await skill.findByIngredients(ingredients, { matchThreshold: threshold });
        
        if (results.length === 0) {
          console.log('No recipes found with those ingredients.');
        } else {
          console.log(`\nFound ${results.length} recipe(s) matching your ingredients:\n`);
          results.slice(0, 10).forEach((result, i) => {
            const matchPct = Math.round(result.matchPercentage * 100);
            console.log(`${i + 1}. Match: ${matchPct}% (${result.matchedIngredients.length}/${result.matchedIngredients.length + result.missingIngredients.length} ingredients)`);
            console.log(`   Matched: ${result.matchedIngredients.slice(0, 3).join(', ')}${result.matchedIngredients.length > 3 ? '...' : ''}`);
            if (result.missingIngredients.length > 0) {
              console.log(`   Missing: ${result.missingIngredients.slice(0, 3).join(', ')}${result.missingIngredients.length > 3 ? ` (+${result.missingIngredients.length - 3} more)` : ''}`);
            }
            printRecipe(result.recipe);
          });
        }
        break;
      }

      case 'get':
      case 'view': {
        const recipeId = args[1];
        if (!recipeId) {
          console.log('Usage: recipe-suggester get <recipe-id>');
          break;
        }
        const recipe = await skill.getRecipeById(recipeId);
        if (recipe) {
          printRecipe(recipe, true);
        } else {
          console.log(`Recipe "${recipeId}" not found.`);
        }
        break;
      }

      case 'random': {
        const filters: any = {};
        const dietaryArg = args.find((_, i) => args[i - 1] === '--dietary' || args[i - 1] === '-d');
        const cuisineArg = args.find((_, i) => args[i - 1] === '--cuisine' || args[i - 1] === '-c');
        
        if (dietaryArg) filters.dietary = dietaryArg.split(',').map((d: string) => d.trim());
        if (cuisineArg) filters.cuisine = cuisineArg;

        const recipe = await skill.getRandomRecipe(filters);
        if (recipe) {
          console.log('\n🎲 Random suggestion:');
          printRecipe(recipe, true);
        } else {
          console.log('No recipes found matching your criteria.');
        }
        break;
      }

      case 'cuisine':
      case 'by-cuisine': {
        const cuisine = args[1] as CuisineType;
        if (!cuisine) {
          console.log('Usage: recipe-suggester cuisine <cuisine-name>');
          console.log('Available cuisines:');
          const cuisines = await skill.getAvailableCuisines();
          cuisines.forEach(c => console.log(`  - ${c}`));
          break;
        }
        const recipes = await skill.getRecipesByCuisine(cuisine);
        console.log(`\n${recipes.length} ${cuisine} recipe(s):\n`);
        recipes.forEach(recipe => printRecipe(recipe));
        break;
      }

      case 'dietary':
      case 'by-diet': {
        const dietary = args[1] as DietaryType;
        if (!dietary) {
          console.log('Usage: recipe-suggester dietary <dietary-type>');
          console.log('Available dietary types:');
          const diets = await skill.getAvailableDiets();
          diets.forEach(d => console.log(`  - ${d}`));
          break;
        }
        const recipes = await skill.getRecipesByDietary(dietary);
        console.log(`\n${recipes.length} ${dietary} recipe(s):\n`);
        recipes.forEach(recipe => printRecipe(recipe));
        break;
      }

      case 'difficulty':
      case 'by-difficulty': {
        const difficulty = args[1] as DifficultyLevel;
        if (!difficulty) {
          console.log('Usage: recipe-suggester difficulty <easy|medium|hard>');
          break;
        }
        const recipes = await skill.getRecipesByDifficulty(difficulty);
        console.log(`\n${recipes.length} ${difficulty} recipe(s):\n`);
        recipes.forEach(recipe => printRecipe(recipe));
        break;
      }

      case 'quick': {
        const maxTime = parseInt(args[1]) || 30;
        const recipes = await skill.getQuickRecipes(maxTime);
        console.log(`\n${recipes.length} quick recipes (under ${maxTime} minutes):\n`);
        recipes.forEach(recipe => printRecipe(recipe));
        break;
      }

      case 'diets':
      case 'list-diets': {
        const diets = await skill.getAvailableDiets();
        console.log('Available dietary filters:');
        diets.forEach(d => console.log(`  • ${d}`));
        break;
      }

      case 'cuisines':
      case 'list-cuisines': {
        const cuisines = await skill.getAvailableCuisines();
        console.log('Available cuisines:');
        cuisines.forEach(c => console.log(`  • ${c}`));
        break;
      }

      case 'meals':
      case 'list-meals': {
        const meals = await skill.getAvailableMealTypes();
        console.log('Available meal types:');
        meals.forEach(m => console.log(`  • ${m}`));
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        console.log('\n📊 Recipe Database Statistics:\n');
        console.log(`Total recipes: ${stats.totalRecipes}`);
        console.log(`\nBy Cuisine:`);
        Object.entries(stats.byCuisine).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
        console.log(`\nBy Difficulty:`);
        Object.entries(stats.byDifficulty).forEach(([d, n]) => console.log(`  ${d}: ${n}`));
        console.log(`\nBy Meal Type:`);
        Object.entries(stats.byMealType).forEach(([m, n]) => console.log(`  ${m}: ${n}`));
        console.log(`\nDietary Options:`);
        console.log(`  Vegetarian: ${stats.vegetarianCount}`);
        console.log(`  Vegan: ${stats.veganCount}`);
        console.log(`  Gluten-free: ${stats.glutenFreeCount}`);
        console.log(`\nAverage cooking time: ${formatTime(stats.averageCookingTime)}`);
        break;
      }

      case 'cooked': {
        const recipeId = args[1];
        if (!recipeId) {
          console.log('Usage: recipe-suggester cooked <recipe-id> [--rating 1-5] [--notes \"Notes\"]');
          break;
        }
        
        const ratingArg = args.find((_, i) => args[i - 1] === '--rating' || args[i - 1] === '-r');
        const notesArg = args.find((_, i) => args[i - 1] === '--notes' || args[i - 1] === '-n');
        
        const rating = ratingArg ? parseInt(ratingArg) : undefined;
        await skill.markAsCooked(recipeId, rating, notesArg);
        console.log(`✅ Marked recipe ${recipeId} as cooked!`);
        break;
      }

      case 'favorite':
      case 'fav': {
        const recipeId = args[1];
        if (!recipeId) {
          console.log('Usage: recipe-suggester favorite <recipe-id>');
          break;
        }
        const isFavorite = await skill.toggleFavorite(recipeId);
        console.log(isFavorite ? `⭐ Added ${recipeId} to favorites!` : `❌ Removed ${recipeId} from favorites`);
        break;
      }

      case 'favorites': {
        const favorites = await skill.getFavorites();
        console.log(`\n⭐ ${favorites.length} favorite recipe(s):\n`);
        favorites.forEach(recipe => printRecipe(recipe));
        break;
      }

      case 'help':
      default: {
        console.log('Recipe Suggester CLI\n');
        console.log('Commands:');
        console.log('  health                    Check system health');
        console.log('  suggest [options]         Search recipes with filters');
        console.log('    --dietary, -d          Filter by dietary requirement (comma-separated)');
        console.log('    --cuisine, -c          Filter by cuisine');
        console.log('    --difficulty           Filter by difficulty (easy/medium/hard)');
        console.log('    --meal, -m             Filter by meal type');
        console.log('    --time, -t             Maximum total time (minutes)');
        console.log('    --servings, -s         Number of servings needed');
        console.log('    --count, -n            Number of results (default: 10)');
        console.log('    --exclude, -e          Exclude ingredients (comma-separated)');
        console.log('  ingredients <list>        Find recipes by ingredients you have');
        console.log('    --threshold, -t        Minimum match percentage (0-1, default: 0.3)');
        console.log('  get <recipe-id>           View full recipe details');
        console.log('  random [options]          Get a random recipe suggestion');
        console.log('  cuisine <name>            List recipes by cuisine');
        console.log('  dietary <type>            List recipes by dietary filter');
        console.log('  difficulty <level>        List recipes by difficulty');
        console.log('  quick [max-minutes]       List quick recipes (default: 30)');
        console.log('  diets                     List available dietary filters');
        console.log('  cuisines                  List available cuisines');
        console.log('  meals                     List available meal types');
        console.log('  stats                     Show database statistics');
        console.log('  cooked <id> [options]     Mark recipe as cooked');
        console.log('    --rating, -r           Rate 1-5 stars');
        console.log('    --notes, -n            Add cooking notes');
        console.log('  favorite <id>             Toggle favorite status');
        console.log('  favorites                 List favorite recipes');
        console.log('  help                      Show this help message');
        console.log('\nExamples:');
        console.log('  recipe-suggester suggest --dietary vegetarian,gluten-free --time 30');
        console.log('  recipe-suggester ingredients chicken,rice,onion --threshold 0.5');
        console.log('  recipe-suggester random --cuisine italian');
        console.log('  recipe-suggester get ita-001');
      }
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
