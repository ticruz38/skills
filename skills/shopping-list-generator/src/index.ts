import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { Recipe, Ingredient, RecipeSuggesterSkill } from '@openclaw/recipe-suggester';

// Types
export type StoreSection = 
  | 'produce' 
  | 'meat' 
  | 'seafood' 
  | 'dairy' 
  | 'bakery' 
  | 'frozen' 
  | 'pantry' 
  | 'beverages' 
  | 'household' 
  | 'other';

export interface ShoppingItem {
  id?: number;
  name: string;
  amount: string;
  section: StoreSection;
  recipeId?: string;
  recipeName?: string;
  checked: boolean;
  notes?: string;
}

export interface PantryItem {
  id?: number;
  name: string;
  amount: string;
  section: StoreSection;
  expiresAt?: string;
  notes?: string;
  addedAt: string;
}

export interface MealPlanRecipe {
  recipeId: string;
  servings: number;
  day?: string; // ISO date string
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface ShoppingList {
  id?: number;
  name: string;
  items: ShoppingItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingListRecord {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ShoppingItemRecord {
  id: number;
  list_id: number;
  name: string;
  amount: string;
  section: string;
  recipe_id?: string;
  recipe_name?: string;
  checked: number;
  notes?: string;
}

export interface PantryItemRecord {
  id: number;
  name: string;
  amount: string;
  section: string;
  expires_at?: string;
  notes?: string;
  added_at: string;
}

export interface GenerateOptions {
  pantryCheck?: boolean;
  mergeDuplicates?: boolean;
  includeOptional?: boolean;
  scaleServings?: number;
}

// Store section mappings for common ingredients
const SECTION_KEYWORDS: Record<StoreSection, string[]> = {
  produce: [
    'tomato', 'onion', 'garlic', 'lettuce', 'spinach', 'kale', 'carrot', 'potato', 
    'broccoli', 'pepper', 'cucumber', 'zucchini', 'eggplant', 'cabbage', 'celery',
    'asparagus', 'mushroom', 'avocado', 'lemon', 'lime', 'orange', 'apple', 'banana',
    'berry', 'strawberry', 'blueberry', 'basil', 'cilantro', 'parsley', 'mint',
    'ginger', 'scallion', 'green onion', 'shallot', 'corn', 'peas', 'beans', 'green beans',
    'cauliflower', 'brussels sprout', 'artichoke', 'radish', 'beet', 'turnip',
    'sweet potato', 'squash', 'pumpkin', 'melon', 'watermelon', 'grape', 'cherry',
    'peach', 'plum', 'pear', 'mango', 'pineapple', 'kiwi', 'coconut', 'fig', 'date'
  ],
  meat: [
    'chicken', 'beef', 'pork', 'turkey', 'lamb', 'duck', 'bacon', 'sausage',
    'ham', 'steak', 'ground beef', 'ground pork', 'ground turkey', 'roast',
    'rib', 'brisket', 'tenderloin', 'thigh', 'breast', 'wing', 'drumstick',
    'meatball', 'meatloaf', 'hot dog', 'salami', 'prosciutto', 'chorizo'
  ],
  seafood: [
    'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'trout', 'mackerel',
    'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster',
    'squid', 'calamari', 'octopus', 'anchovy', 'sardine', 'fish', 'fillet'
  ],
  dairy: [
    'milk', 'cream', 'butter', 'cheese', 'yogurt', 'sour cream', 'cottage cheese',
    'mozzarella', 'cheddar', 'parmesan', 'feta', 'brie', 'cream cheese',
    'whipped cream', 'half and half', 'buttermilk', 'ghee', 'margarine',
    'egg', 'eggs', 'mayonnaise'
  ],
  bakery: [
    'bread', 'bun', 'roll', 'bagel', 'croissant', 'muffin', 'cake', 'pastry',
    'tortilla', 'pita', 'naan', 'baguette', 'loaf', 'sliced bread', 'hamburger bun',
    'hot dog bun', 'english muffin', 'pizza dough', 'pie crust', 'puff pastry'
  ],
  frozen: [
    'frozen', 'ice cream', 'pizza', 'tv dinner', 'frozen vegetable', 'frozen fruit',
    'waffle', 'pancake', 'burrito', 'frozen meal'
  ],
  pantry: [
    'flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'rice', 'pasta', 'noodle',
    'spaghetti', 'cereal', 'oat', 'oatmeal', 'quinoa', 'couscous', 'lentil',
    'bean', 'chickpea', 'black bean', 'kidney bean', 'canned', 'can', 'soup',
    'broth', 'stock', 'sauce', 'ketchup', 'mustard', 'mayo', 'relish',
    'peanut butter', 'jam', 'jelly', 'honey', 'syrup', 'maple syrup',
    'baking powder', 'baking soda', 'yeast', 'vanilla', 'cinnamon', 'spice',
    'herb', 'seasoning', 'mix', 'crouton', 'cracker', 'chip', 'pretzel',
    'popcorn', 'nut', 'almond', 'walnut', 'pecan', 'cashew', 'pistachio',
    'seed', 'sesame seed', 'chia seed', 'flax seed', 'sunflower seed',
    'tahini', 'cocoa', 'chocolate', 'chip', 'raisin', 'prune', 'apricot',
    'olive', 'pickle', 'caper', 'sundried tomato', 'dried fruit', 'granola',
    'protein powder', 'breadcrumbs', 'panko', 'cornstarch', 'gelatin'
  ],
  beverages: [
    'water', 'juice', 'soda', 'coffee', 'tea', 'wine', 'beer', 'spirit',
    'milk', 'smoothie', 'energy drink', 'sports drink', 'sparkling water',
    'coconut water', 'kombucha', 'kefir'
  ],
  household: [
    'soap', 'shampoo', 'toothpaste', 'toilet paper', 'paper towel', 'tissue',
    'cleaner', 'detergent', 'sponge', 'trash bag', 'aluminum foil', 'plastic wrap',
    'parchment paper', 'napkin', 'zip bag', 'storage bag'
  ],
  other: []
};

// Helper function for SQLite run with result
function runWithResult(
  db: sqlite3.Database,
  sql: string,
  params: any[] = []
): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Helper to get section for an ingredient
function getSectionForIngredient(ingredientName: string): StoreSection {
  const lowerName = ingredientName.toLowerCase();
  
  for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
    if (section === 'other') continue;
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return section as StoreSection;
      }
    }
  }
  
  return 'other';
}

// Main ShoppingListGenerator class
export class ShoppingListGeneratorSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private recipeSkill: RecipeSuggesterSkill;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const skillDir = path.join(os.homedir(), '.openclaw', 'skills', 'shopping-list-generator');
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }
    this.dbPath = path.join(skillDir, 'shopping.db');
    this.recipeSkill = new RecipeSuggesterSkill();
  }

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, async (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          await this.createTables();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Shopping lists table
    await runWithResult(this.db, `
      CREATE TABLE IF NOT EXISTS shopping_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Shopping items table
    await runWithResult(this.db, `
      CREATE TABLE IF NOT EXISTS shopping_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        amount TEXT,
        section TEXT NOT NULL,
        recipe_id TEXT,
        recipe_name TEXT,
        checked INTEGER DEFAULT 0,
        notes TEXT,
        FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE
      )
    `);

    // Pantry items table
    await runWithResult(this.db, `
      CREATE TABLE IF NOT EXISTS pantry_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount TEXT,
        section TEXT NOT NULL,
        expires_at TEXT,
        notes TEXT,
        added_at TEXT NOT NULL
      )
    `);

    // Create indexes
    await runWithResult(this.db, `CREATE INDEX IF NOT EXISTS idx_items_list ON shopping_items(list_id)`);
    await runWithResult(this.db, `CREATE INDEX IF NOT EXISTS idx_items_section ON shopping_items(section)`);
    await runWithResult(this.db, `CREATE INDEX IF NOT EXISTS idx_pantry_name ON pantry_items(name)`);
  }

  // Generate shopping list from recipes
  async generateFromRecipes(
    recipes: MealPlanRecipe[],
    listName: string,
    options: GenerateOptions = {}
  ): Promise<ShoppingList> {
    await this.initialize();
    
    const { pantryCheck = true, mergeDuplicates = true, includeOptional = false, scaleServings } = options;
    
    const items: Map<string, ShoppingItem> = new Map();
    
    for (const plan of recipes) {
      const recipe = await this.recipeSkill.getRecipeById(plan.recipeId);
      if (!recipe) continue;
      
      // Calculate scaling factor
      let scale = 1;
      if (scaleServings) {
        scale = scaleServings / recipe.servings;
      } else if (plan.servings) {
        scale = plan.servings / recipe.servings;
      }
      
      for (const ingredient of recipe.ingredients) {
        if (ingredient.optional && !includeOptional) continue;
        
        // Check pantry if enabled
        if (pantryCheck && await this.hasInPantry(ingredient.name)) {
          continue;
        }
        
        const scaledAmount = scale !== 1 
          ? this.scaleAmount(ingredient.amount, scale)
          : ingredient.amount;
        
        const key = ingredient.name.toLowerCase();
        
        if (mergeDuplicates && items.has(key)) {
          // Merge with existing item
          const existing = items.get(key)!;
          existing.amount = this.combineAmounts(existing.amount, scaledAmount);
          if (recipe.name && !existing.recipeName?.includes(recipe.name)) {
            existing.recipeName = existing.recipeName 
              ? `${existing.recipeName}, ${recipe.name}`
              : recipe.name;
          }
        } else {
          items.set(key, {
            name: ingredient.name,
            amount: scaledAmount,
            section: getSectionForIngredient(ingredient.name),
            recipeId: recipe.id,
            recipeName: recipe.name,
            checked: false
          });
        }
      }
    }
    
    // Create the list
    return this.createList(listName, Array.from(items.values()));
  }

  // Generate from recipe IDs
  async generateFromRecipeIds(
    recipeIds: string[],
    listName: string,
    options: GenerateOptions = {}
  ): Promise<ShoppingList> {
    const recipes: MealPlanRecipe[] = recipeIds.map(id => ({ recipeId: id, servings: 0 }));
    return this.generateFromRecipes(recipes, listName, options);
  }

  // Create a new shopping list
  async createList(name: string, items: ShoppingItem[] = []): Promise<ShoppingList> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    
    const listResult = await runWithResult(this.db, 
      'INSERT INTO shopping_lists (name, created_at, updated_at) VALUES (?, ?, ?)',
      [name, now, now]
    );
    
    const listId = listResult.lastID;
    
    // Insert items
    for (const item of items) {
      await runWithResult(this.db,
        `INSERT INTO shopping_items (list_id, name, amount, section, recipe_id, recipe_name, checked, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [listId, item.name, item.amount, item.section, item.recipeId || null, item.recipeName || null, item.checked ? 1 : 0, item.notes || null]
      );
    }
    
    return {
      id: listId,
      name,
      items,
      createdAt: now,
      updatedAt: now
    };
  }

  // Get shopping list by ID
  async getList(listId: number): Promise<ShoppingList | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const listRow = await new Promise<ShoppingListRecord | undefined>((resolve, reject) => {
      this.db!.get('SELECT * FROM shopping_lists WHERE id = ?', [listId], (err, row) => {
        if (err) reject(err);
        else resolve(row as ShoppingListRecord);
      });
    });
    
    if (!listRow) return null;
    
    const itemRows = await new Promise<ShoppingItemRecord[]>((resolve, reject) => {
      this.db!.all('SELECT * FROM shopping_items WHERE list_id = ? ORDER BY section, name', [listId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows as ShoppingItemRecord[]);
      });
    });
    
    return {
      id: listRow.id,
      name: listRow.name,
      items: itemRows.map(row => ({
        id: row.id,
        name: row.name,
        amount: row.amount,
        section: row.section as StoreSection,
        recipeId: row.recipe_id,
        recipeName: row.recipe_name,
        checked: row.checked === 1,
        notes: row.notes
      })),
      createdAt: listRow.created_at,
      updatedAt: listRow.updated_at
    };
  }

  // List all shopping lists
  async listLists(limit: number = 50): Promise<{ id: number; name: string; createdAt: string; itemCount: number }[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await new Promise<Array<{ id: number; name: string; created_at: string; item_count: number }>>((resolve, reject) => {
      this.db!.all(
        `SELECT l.id, l.name, l.created_at, COUNT(i.id) as item_count 
         FROM shopping_lists l 
         LEFT JOIN shopping_items i ON l.id = i.list_id 
         GROUP BY l.id 
         ORDER BY l.created_at DESC 
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as any);
        }
      );
    });
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      itemCount: row.item_count
    }));
  }

  // Add item to list
  async addItem(listId: number, item: Omit<ShoppingItem, 'id'>): Promise<number> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await runWithResult(this.db,
      `INSERT INTO shopping_items (list_id, name, amount, section, recipe_id, recipe_name, checked, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [listId, item.name, item.amount, item.section, item.recipeId || null, item.recipeName || null, item.checked ? 1 : 0, item.notes || null]
    );
    
    await this.updateListTimestamp(listId);
    return result.lastID;
  }

  // Toggle item checked status
  async toggleItem(itemId: number): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const item = await new Promise<ShoppingItemRecord | undefined>((resolve, reject) => {
      this.db!.get('SELECT * FROM shopping_items WHERE id = ?', [itemId], (err, row) => {
        if (err) reject(err);
        else resolve(row as ShoppingItemRecord);
      });
    });
    
    if (!item) return false;
    
    const newChecked = item.checked === 0 ? 1 : 0;
    await runWithResult(this.db, 'UPDATE shopping_items SET checked = ? WHERE id = ?', [newChecked, itemId]);
    
    if (item.list_id) {
      await this.updateListTimestamp(item.list_id);
    }
    
    return true;
  }

  // Delete item from list
  async deleteItem(itemId: number): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await runWithResult(this.db, 'DELETE FROM shopping_items WHERE id = ?', [itemId]);
    return result.changes > 0;
  }

  // Delete shopping list
  async deleteList(listId: number): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await runWithResult(this.db, 'DELETE FROM shopping_lists WHERE id = ?', [listId]);
    return result.changes > 0;
  }

  // Update list timestamp
  private async updateListTimestamp(listId: number): Promise<void> {
    if (!this.db) return;
    await runWithResult(this.db, 
      'UPDATE shopping_lists SET updated_at = ? WHERE id = ?',
      [new Date().toISOString(), listId]
    );
  }

  // Panry management
  async addToPantry(item: Omit<PantryItem, 'id' | 'addedAt'>): Promise<number> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await runWithResult(this.db,
      `INSERT INTO pantry_items (name, amount, section, expires_at, notes, added_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [item.name, item.amount || '', item.section, item.expiresAt || null, item.notes || null, new Date().toISOString()]
    );
    
    return result.lastID;
  }

  async removeFromPantry(itemId: number): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await runWithResult(this.db, 'DELETE FROM pantry_items WHERE id = ?', [itemId]);
    return result.changes > 0;
  }

  async listPantry(section?: StoreSection): Promise<PantryItem[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    let sql = 'SELECT * FROM pantry_items';
    const params: any[] = [];
    
    if (section) {
      sql += ' WHERE section = ?';
      params.push(section);
    }
    
    sql += ' ORDER BY section, name';
    
    const rows = await new Promise<PantryItemRecord[]>((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as PantryItemRecord[]);
      });
    });
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      amount: row.amount,
      section: row.section as StoreSection,
      expiresAt: row.expires_at,
      notes: row.notes,
      addedAt: row.added_at
    }));
  }

  async hasInPantry(ingredientName: string): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await new Promise<{ count: number } | undefined>((resolve, reject) => {
      this.db!.get(
        'SELECT COUNT(*) as count FROM pantry_items WHERE LOWER(name) LIKE ?',
        [`%${ingredientName.toLowerCase()}%`],
        (err, row) => {
          if (err) reject(err);
          else resolve(row as { count: number });
        }
      );
    });
    
    return (row?.count || 0) > 0;
  }

  async searchPantry(query: string): Promise<PantryItem[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await new Promise<PantryItemRecord[]>((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM pantry_items WHERE LOWER(name) LIKE ? ORDER BY name',
        [`%${query.toLowerCase()}%`],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as PantryItemRecord[]);
        }
      );
    });
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      amount: row.amount,
      section: row.section as StoreSection,
      expiresAt: row.expires_at,
      notes: row.notes,
      addedAt: row.added_at
    }));
  }

  // Clear checked items from list
  async clearChecked(listId: number): Promise<number> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await runWithResult(this.db, 
      'DELETE FROM shopping_items WHERE list_id = ? AND checked = 1',
      [listId]
    );
    
    await this.updateListTimestamp(listId);
    return result.changes;
  }

  // Get items by section
  async getItemsBySection(listId: number): Promise<Record<StoreSection, ShoppingItem[]>> {
    const list = await this.getList(listId);
    if (!list) return { produce: [], meat: [], seafood: [], dairy: [], bakery: [], frozen: [], pantry: [], beverages: [], household: [], other: [] };
    
    const bySection: Record<StoreSection, ShoppingItem[]> = {
      produce: [], meat: [], seafood: [], dairy: [], bakery: [], frozen: [], pantry: [], beverages: [], household: [], other: []
    };
    
    for (const item of list.items) {
      bySection[item.section].push(item);
    }
    
    return bySection;
  }

  // Export list to text format
  async exportToText(listId: number): Promise<string | null> {
    const list = await this.getList(listId);
    if (!list) return null;
    
    const bySection = await this.getItemsBySection(listId);
    
    let output = `Shopping List: ${list.name}\n`;
    output += `Created: ${new Date(list.createdAt).toLocaleDateString()}\n`;
    output += '='.repeat(50) + '\n\n';
    
    for (const [section, items] of Object.entries(bySection)) {
      if (items.length === 0) continue;
      
      output += `[${section.toUpperCase()}]\n`;
      for (const item of items) {
        const check = item.checked ? '[x]' : '[ ]';
        output += `  ${check} ${item.name}`;
        if (item.amount) output += ` (${item.amount})`;
        if (item.notes) output += ` - ${item.notes}`;
        output += '\n';
      }
      output += '\n';
    }
    
    return output;
  }

  // Get statistics
  async getStats(): Promise<{
    listCount: number;
    totalItems: number;
    checkedItems: number;
    pantryCount: number;
    expiringItems: number;
  }> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const listCount = await new Promise<number>((resolve, reject) => {
      this.db!.get('SELECT COUNT(*) as count FROM shopping_lists', [], (err, row: any) => {
        if (err) reject(err);
        else resolve(row?.count || 0);
      });
    });
    
    const itemStats = await new Promise<{ total: number; checked: number }>((resolve, reject) => {
      this.db!.get(
        'SELECT COUNT(*) as total, SUM(CASE WHEN checked = 1 THEN 1 ELSE 0 END) as checked FROM shopping_items',
        [],
        (err, row: any) => {
          if (err) reject(err);
          else resolve({ total: row?.total || 0, checked: row?.checked || 0 });
        }
      );
    });
    
    const pantryCount = await new Promise<number>((resolve, reject) => {
      this.db!.get('SELECT COUNT(*) as count FROM pantry_items', [], (err, row: any) => {
        if (err) reject(err);
        else resolve(row?.count || 0);
      });
    });
    
    const expiringSoon = new Date();
    expiringSoon.setDate(expiringSoon.getDate() + 7);
    
    const expiringItems = await new Promise<number>((resolve, reject) => {
      this.db!.get(
        'SELECT COUNT(*) as count FROM pantry_items WHERE expires_at IS NOT NULL AND expires_at <= ?',
        [expiringSoon.toISOString()],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row?.count || 0);
        }
      );
    });
    
    return {
      listCount,
      totalItems: itemStats.total,
      checkedItems: itemStats.checked,
      pantryCount,
      expiringItems
    };
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.initialize();
      const stats = await this.getStats();
      return {
        healthy: true,
        message: `Shopping list generator ready. ${stats.listCount} lists, ${stats.pantryCount} pantry items.`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // Close database connection
  async close(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.db = null;
    }
    
    await this.recipeSkill.close();
  }

  // Helper: Scale an amount by a factor
  private scaleAmount(amount: string, scale: number): string {
    // Try to extract numeric value
    const match = amount.match(/^([\d./]+)\s*(.*)$/);
    if (!match) return amount;
    
    const numStr = match[1];
    const unit = match[2];
    
    let num: number;
    if (numStr.includes('/')) {
      const [numer, denom] = numStr.split('/');
      num = parseInt(numer) / parseInt(denom);
    } else {
      num = parseFloat(numStr);
    }
    
    if (isNaN(num)) return amount;
    
    const scaled = num * scale;
    
    // Format nicely
    let formatted: string;
    if (scaled < 0.25) {
      formatted = scaled.toFixed(2);
    } else if (scaled < 1) {
      formatted = scaled.toFixed(1);
    } else if (scaled % 1 === 0) {
      formatted = scaled.toFixed(0);
    } else {
      formatted = scaled.toFixed(1);
    }
    
    return unit ? `${formatted} ${unit}` : formatted;
  }

  // Helper: Combine two amounts
  private combineAmounts(amount1: string, amount2: string): string {
    // Simple case: if they're the same, just return one
    if (amount1 === amount2) return amount1;
    
    // Try to extract numeric values with same unit
    const match1 = amount1.match(/^([\d./]+)\s*(.*)$/);
    const match2 = amount2.match(/^([\d./]+)\s*(.*)$/);
    
    if (match1 && match2 && match1[2] === match2[2]) {
      const unit = match1[2];
      
      const parseNum = (s: string): number => {
        if (s.includes('/')) {
          const [n, d] = s.split('/');
          return parseInt(n) / parseInt(d);
        }
        return parseFloat(s);
      };
      
      const num1 = parseNum(match1[1]);
      const num2 = parseNum(match2[1]);
      
      if (!isNaN(num1) && !isNaN(num2)) {
        const sum = num1 + num2;
        let formatted: string;
        if (sum % 1 === 0) {
          formatted = sum.toFixed(0);
        } else {
          formatted = sum.toFixed(1);
        }
        return unit ? `${formatted} ${unit}` : formatted;
      }
    }
    
    // Fallback: just concatenate
    return `${amount1} + ${amount2}`;
  }
}

export default ShoppingListGeneratorSkill;
