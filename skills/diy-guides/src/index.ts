import sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type RepairCategory = 'plumbing' | 'electrical' | 'appliance' | 'furniture' | 'outdoor' | 'automotive' | 'painting' | 'flooring' | 'hvac' | 'general';

export interface DIYGuide {
  id?: number;
  title: string;
  description: string;
  category: RepairCategory;
  difficulty: DifficultyLevel;
  estimatedTime: string;
  tools: string[];
  materials: string[];
  steps: GuideStep[];
  videoLinks?: VideoLink[];
  tips?: string[];
  warnings?: string[];
  skillLevel?: string;
  costEstimate?: string;
}

export interface GuideStep {
  stepNumber: number;
  title: string;
  description: string;
  imageUrl?: string;
}

export interface VideoLink {
  title: string;
  url: string;
  platform: 'youtube' | 'vimeo' | 'other';
  duration?: string;
}

interface DIYGuideRecord {
  id: number;
  title: string;
  description: string;
  category: RepairCategory;
  difficulty: DifficultyLevel;
  estimated_time: string;
  tools: string;
  materials: string;
  steps: string;
  video_links: string | null;
  tips: string | null;
  warnings: string | null;
  skill_level: string | null;
  cost_estimate: string | null;
}

interface SearchFilters {
  category?: RepairCategory;
  difficulty?: DifficultyLevel;
  maxTime?: string;
  searchTerm?: string;
}

function runWithResult(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export class DIYGuidesSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const skillDir = path.join(os.homedir(), '.openclaw', 'skills', 'diy-guides');
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }
    this.dbPath = path.join(skillDir, 'guides.db');
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.db = new (sqlite3 as any).Database(this.dbPath, (err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }
          // Use Promise.resolve().then() to handle async operations
          Promise.resolve()
            .then(() => this.createTables())
            .then(() => this.seedDefaultGuides())
            .then(() => resolve())
            .catch((error) => reject(error));
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const queries = [
      `CREATE TABLE IF NOT EXISTS guides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        estimated_time TEXT NOT NULL,
        tools TEXT NOT NULL,
        materials TEXT NOT NULL,
        steps TEXT NOT NULL,
        video_links TEXT,
        tips TEXT,
        warnings TEXT,
        skill_level TEXT,
        cost_estimate TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_category ON guides(category)`,
      `CREATE INDEX IF NOT EXISTS idx_difficulty ON guides(difficulty)`,
      `CREATE INDEX IF NOT EXISTS idx_title ON guides(title)`
    ];

    for (const query of queries) {
      await new Promise<void>((resolve, reject) => {
        this.db!.run(query, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  private async seedDefaultGuides(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const count = await new Promise<number>((resolve, reject) => {
      this.db!.get('SELECT COUNT(*) as count FROM guides', (err: Error | null, row: { count: number }) => {
        if (err) reject(err);
        else resolve(row?.count || 0);
      });
    });

    if (count === 0) {
      const defaultGuides: DIYGuide[] = [
        {
          title: 'Fix a Leaky Faucet',
          description: 'Repair a dripping kitchen or bathroom faucet by replacing the washer or cartridge.',
          category: 'plumbing',
          difficulty: 'easy',
          estimatedTime: '30-60 minutes',
          tools: ['Adjustable wrench', 'Screwdriver', 'Replacement washer/cartridge', 'Plumber\'s tape'],
          materials: ['Replacement washer or cartridge', 'Plumber\'s grease'],
          steps: [
            { stepNumber: 1, title: 'Turn off water supply', description: 'Locate the shutoff valves under the sink and turn them clockwise to stop water flow.' },
            { stepNumber: 2, title: 'Remove the handle', description: 'Use a screwdriver to remove the decorative cap and unscrew the handle.' },
            { stepNumber: 3, title: 'Remove the cartridge', description: 'Use the wrench to loosen and remove the retaining nut, then pull out the old cartridge.' },
            { stepNumber: 4, title: 'Install new parts', description: 'Apply plumber\'s grease to the new cartridge and install it in reverse order.' },
            { stepNumber: 5, title: 'Reassemble and test', description: 'Put everything back together and turn the water back on to test.' }
          ],
          videoLinks: [
            { title: 'How to Fix a Leaky Faucet', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', platform: 'youtube', duration: '8:45' }
          ],
          tips: ['Take photos before disassembling for reference', 'Lay out parts in order of removal'],
          warnings: ['Ensure water is completely off before starting', 'Don\'t overtighten plastic parts'],
          skillLevel: 'Beginner',
          costEstimate: '$5-20'
        },
        {
          title: 'Unclog a Drain',
          description: 'Clear a clogged sink, shower, or tub drain using common household tools.',
          category: 'plumbing',
          difficulty: 'easy',
          estimatedTime: '15-45 minutes',
          tools: ['Plunger', 'Drain snake/auger', 'Bucket', 'Rubber gloves', 'Old towel'],
          materials: ['Baking soda', 'White vinegar', 'Hot water'],
          steps: [
            { stepNumber: 1, title: 'Try the plunger', description: 'Create a seal and plunge vigorously up and down 10-15 times.' },
            { stepNumber: 2, title: 'Baking soda and vinegar', description: 'Pour 1/2 cup baking soda down drain, followed by 1 cup vinegar. Wait 15 minutes.' },
            { stepNumber: 3, title: 'Flush with hot water', description: 'Pour boiling water down the drain to flush away the dissolved clog.' },
            { stepNumber: 4, title: 'Use drain snake if needed', description: 'Insert the snake and turn the handle to catch and pull out hair/debris.' }
          ],
          videoLinks: [
            { title: 'How to Unclog Any Drain', url: 'https://www.youtube.com/watch?v=example1', platform: 'youtube', duration: '6:30' }
          ],
          tips: ['Prevention: use drain strainers to catch hair', 'Monthly maintenance: flush with hot water'],
          warnings: ['Never mix drain cleaners with other chemicals', 'Wear gloves to protect from bacteria'],
          skillLevel: 'Beginner',
          costEstimate: '$0-15'
        },
        {
          title: 'Replace a Light Switch',
          description: 'Safely replace a standard light switch with a new one.',
          category: 'electrical',
          difficulty: 'medium',
          estimatedTime: '20-30 minutes',
          tools: ['Flathead screwdriver', 'Phillips screwdriver', 'Voltage tester', 'Wire stripper', 'Needle-nose pliers'],
          materials: ['New light switch', 'Wire nuts (if needed)', 'Electrical tape'],
          steps: [
            { stepNumber: 1, title: 'Turn off power', description: 'Switch off the circuit breaker and verify with voltage tester.' },
            { stepNumber: 2, title: 'Remove old switch', description: 'Unscrew faceplate, then remove switch from electrical box.' },
            { stepNumber: 3, title: 'Note wire positions', description: 'Take a photo of wire connections before disconnecting.' },
            { stepNumber: 4, title: 'Disconnect wires', description: 'Loosen terminal screws and remove wires from old switch.' },
            { stepNumber: 5, title: 'Connect new switch', description: 'Connect wires to matching terminals (black to brass, white to silver, green to green).' },
            { stepNumber: 6, title: 'Install and test', description: 'Secure switch in box, attach faceplate, turn power back on.' }
          ],
          videoLinks: [
            { title: 'How to Replace a Light Switch', url: 'https://www.youtube.com/watch?v=example2', platform: 'youtube', duration: '10:15' }
          ],
          tips: ['Label wires with tape if needed', 'Three-way switches require special wiring - consult diagram'],
          warnings: ['Always verify power is off before touching wires', 'Call electrician if wiring looks damaged'],
          skillLevel: 'Intermediate',
          costEstimate: '$3-15'
        },
        {
          title: 'Patch Drywall Holes',
          description: 'Repair small to medium holes in drywall for a smooth finish.',
          category: 'general',
          difficulty: 'medium',
          estimatedTime: '1-2 hours (plus drying time)',
          tools: ['Utility knife', 'Putty knife', 'Sandpaper (120 and 220 grit)', 'Drywall saw', 'Drill', 'Paint roller'],
          materials: ['Drywall patch or scrap piece', 'Joint compound', 'Drywall tape', 'Primer', 'Paint to match'],
          steps: [
            { stepNumber: 1, title: 'Prepare the hole', description: 'Cut away loose drywall and create clean edges around the hole.' },
            { stepNumber: 2, title: 'Cut patch', description: 'Cut a drywall patch slightly smaller than the hole opening.' },
            { stepNumber: 3, title: 'Install backing', description: 'For larger holes, add wooden backing strips inside the wall.' },
            { stepNumber: 4, title: 'Apply patch', description: 'Secure patch with drywall screws, countersinking slightly.' },
            { stepNumber: 5, title: 'Apply joint compound', description: 'Cover seams with tape, then apply thin layer of compound. Let dry.' },
            { stepNumber: 6, title: 'Sand and repeat', description: 'Sand smooth, apply second coat, sand again with finer grit.' },
            { stepNumber: 7, title: 'Prime and paint', description: 'Apply primer, then paint to match wall.' }
          ],
          videoLinks: [
            { title: 'Drywall Repair Made Easy', url: 'https://www.youtube.com/watch?v=example3', platform: 'youtube', duration: '15:20' }
          ],
          tips: ['Feather edges of compound beyond repair area', 'Multiple thin coats are better than one thick coat'],
          warnings: ['Wear dust mask when sanding', 'Lead paint in homes built before 1978 - test first'],
          skillLevel: 'Intermediate',
          costEstimate: '$15-40'
        },
        {
          title: 'Fix a Running Toilet',
          description: 'Stop a toilet from running continuously by replacing the flapper or adjusting the fill valve.',
          category: 'plumbing',
          difficulty: 'easy',
          estimatedTime: '20-40 minutes',
          tools: ['Adjustable wrench', 'Sponge', 'Towel', 'Replacement flapper'],
          materials: ['Replacement flapper', 'Replacement fill valve (if needed)'],
          steps: [
            { stepNumber: 1, title: 'Diagnose the problem', description: 'Add food coloring to tank - if color appears in bowl without flushing, flapper is leaking.' },
            { stepNumber: 2, title: 'Turn off water', description: 'Shut off water supply valve behind toilet.' },
            { stepNumber: 3, title: 'Drain tank', description: 'Flush toilet and hold lever down to drain most water. Sponge out remaining water.' },
            { stepNumber: 4, title: 'Replace flapper', description: 'Disconnect old flapper from chain and overflow tube, attach new one.' },
            { stepNumber: 5, title: 'Adjust chain length', description: 'Chain should have slight slack when flapper is closed - about 1/2 inch.' },
            { stepNumber: 6, title: 'Test and adjust', description: 'Turn water back on, let tank fill, test flush. Adjust chain if needed.' }
          ],
          videoLinks: [
            { title: 'Toilet Repair - Fix Running Toilet', url: 'https://www.youtube.com/watch?v=example4', platform: 'youtube', duration: '7:45' }
          ],
          tips: ['Take old flapper to store to match size', 'Clean flush valve seat with sponge for better seal'],
          warnings: ['Don\'t overtighten toilet supply line', 'Check for cracks in tank or bowl'],
          skillLevel: 'Beginner',
          costEstimate: '$5-25'
        },
        {
          title: 'Replace Cabinet Hardware',
          description: 'Update kitchen or bathroom cabinets with new knobs and pulls.',
          category: 'furniture',
          difficulty: 'easy',
          estimatedTime: '1-2 hours',
          tools: ['Screwdriver', 'Drill', 'Drill bits', 'Measuring tape', 'Pencil', 'Template (optional)'],
          materials: ['New knobs/pulls', 'Screws', 'Wood filler (if needed)'],
          steps: [
            { stepNumber: 1, title: 'Remove old hardware', description: 'Unscrew and remove existing knobs or pulls.' },
            { stepNumber: 2, title: 'Fill old holes if needed', description: 'If new hardware has different hole spacing, fill old holes with wood filler.' },
            { stepNumber: 3, title: 'Mark new positions', description: 'Use measuring tape and template to mark exact center locations.' },
            { stepNumber: 4, title: 'Drill pilot holes', description: 'Drill holes slightly smaller than screw diameter to prevent splitting.' },
            { stepNumber: 5, title: 'Install new hardware', description: 'Insert screws from back and attach knobs/pulls from front.' },
            { stepNumber: 6, title: 'Align and tighten', description: 'Ensure all hardware is straight and tighten securely.' }
          ],
          videoLinks: [
            { title: 'How to Install Cabinet Hardware', url: 'https://www.youtube.com/watch?v=example5', platform: 'youtube', duration: '8:00' }
          ],
          tips: ['Use a cabinet hardware jig for consistent placement', 'Buy one extra knob/pull as backup'],
          warnings: ['Don\'t overtighten - can strip wood', 'Check screw length - too long will poke through'],
          skillLevel: 'Beginner',
          costEstimate: '$20-100+'
        },
        {
          title: 'Caulk a Bathtub or Shower',
          description: 'Remove old caulk and apply new silicone sealant for a waterproof seal.',
          category: 'plumbing',
          difficulty: 'medium',
          estimatedTime: '2-3 hours (plus curing time)',
          tools: ['Caulk gun', 'Utility knife', 'Caulk removal tool', 'Rubber gloves', 'Rags', 'Painter\'s tape'],
          materials: ['Silicone caulk (mold-resistant)', 'Caulk softener (optional)', 'Mineral spirits', 'Rubbing alcohol'],
          steps: [
            { stepNumber: 1, title: 'Remove old caulk', description: 'Apply caulk softener, wait, then scrape out all old caulk with removal tool.' },
            { stepNumber: 2, title: 'Clean thoroughly', description: 'Clean area with rubbing alcohol to remove all residue and soap scum.' },
            { stepNumber: 3, title: 'Dry completely', description: 'Let area dry for at least 2 hours - moisture prevents adhesion.' },
            { stepNumber: 4, title: 'Apply tape', description: 'Apply painter\'s tape along edges for clean lines.' },
            { stepNumber: 5, title: 'Apply new caulk', description: 'Cut caulk tube at 45-degree angle, apply steady pressure for smooth bead.' },
            { stepNumber: 6, title: 'Smooth the bead', description: 'Wet finger and smooth caulk in one continuous motion.' },
            { stepNumber: 7, title: 'Remove tape and cure', description: 'Remove tape immediately, let caulk cure 24 hours before using shower.' }
          ],
          videoLinks: [
            { title: 'How to Caulk Like a Pro', url: 'https://www.youtube.com/watch?v=example6', platform: 'youtube', duration: '12:30' }
          ],
          tips: ['Buy caulk labeled "shower/tub" or "kitchen/bath"', 'Use masking tape for perfect edges'],
          warnings: ['Ensure complete removal of old caulk', 'Work in well-ventilated area - caulk fumes are strong'],
          skillLevel: 'Intermediate',
          costEstimate: '$10-25'
        },
        {
          title: 'Replace an HVAC Filter',
          description: 'Change the air filter in your furnace or AC unit for better air quality and efficiency.',
          category: 'hvac',
          difficulty: 'easy',
          estimatedTime: '5-10 minutes',
          tools: ['Flashlight (optional)'],
          materials: ['New filter (correct size)', 'Trash bag'],
          steps: [
            { stepNumber: 1, title: 'Turn off system', description: 'Turn off HVAC system at thermostat for safety.' },
            { stepNumber: 2, title: 'Locate filter', description: 'Find filter slot - usually in return air duct or blower compartment.' },
            { stepNumber: 3, title: 'Note filter direction', description: 'Observe airflow arrows on old filter before removing.' },
            { stepNumber: 4, title: 'Remove old filter', description: 'Slide out old filter carefully to avoid dropping dust.' },
            { stepNumber: 5, title: 'Check filter size', description: 'Verify printed dimensions match new filter.' },
            { stepNumber: 6, title: 'Install new filter', description: 'Insert new filter with arrows pointing toward the blower/furnace.' },
            { stepNumber: 7, title: 'Turn system back on', description: 'Restore power and verify system runs normally.' }
          ],
          videoLinks: [
            { title: 'How to Change HVAC Filter', url: 'https://www.youtube.com/watch?v=example7', platform: 'youtube', duration: '4:15' }
          ],
          tips: ['Set phone reminder every 1-3 months', 'Buy filters in bulk to save money'],
          warnings: ['Wrong size filter allows dust bypass', 'Never run system without a filter'],
          skillLevel: 'Beginner',
          costEstimate: '$5-25'
        },
        {
          title: 'Fix Squeaky Floors',
          description: 'Eliminate squeaks in hardwood or subflooring by securing loose boards.',
          category: 'flooring',
          difficulty: 'medium',
          estimatedTime: '1-3 hours',
          tools: ['Drill', 'Screws (2-3 inch)', 'Stud finder', 'Hammer', 'Nails', 'Wood shims', 'Construction adhesive'],
          materials: ['Deck screws', 'Finish nails', 'Baby powder or talc', 'Construction adhesive'],
          steps: [
            { stepNumber: 1, title: 'Locate the squeak', description: 'Walk slowly and mark exact spot with tape.' },
            { stepNumber: 2, title: 'Find floor joists', description: 'Use stud finder to locate joists beneath squeaky area.' },
            { stepNumber: 3, title: 'Try quick fix from above', description: 'Sprinkle baby powder into cracks to lubricate - temporary fix.' },
            { stepNumber: 4, title: 'Secure from above', description: 'Drill pilot holes and drive screws into joist below.' },
            { stepNumber: 5, title: 'Use counter-snap kit if needed', description: 'Special screws break off below surface for invisible repair.' },
            { stepNumber: 6, title: 'Secure from below (if accessible)', description: 'From basement, have someone walk on spot while you shim.' }
          ],
          videoLinks: [
            { title: 'Fix Squeaky Floors', url: 'https://www.youtube.com/watch?v=example8', platform: 'youtube', duration: '9:45' }
          ],
          tips: ['Have someone walk on floor while you work below', 'Use shorter screws for engineered flooring'],
          warnings: ['Avoid electrical/plumbing when drilling', 'Don\'t overtighten - can strip or split wood'],
          skillLevel: 'Intermediate',
          costEstimate: '$10-40'
        },
        {
          title: 'Change a Tire',
          description: 'Safely replace a flat tire with a spare.',
          category: 'automotive',
          difficulty: 'medium',
          estimatedTime: '15-30 minutes',
          tools: ['Jack', 'Lug wrench', 'Spare tire', 'Wheel chocks', 'Flashlight', 'Gloves'],
          materials: ['Owner\'s manual'],
          steps: [
            { stepNumber: 1, title: 'Find safe location', description: 'Pull completely off road on level ground, turn on hazard lights.' },
            { stepNumber: 2, title: 'Apply parking brake', description: 'Engage parking brake and place wheel chocks if available.' },
            { stepNumber: 3, title: 'Loosen lug nuts', description: 'Use lug wrench to loosen (not remove) nuts while tire is on ground.' },
            { stepNumber: 4, title: 'Jack up vehicle', description: 'Place jack at manufacturer\'s recommended point, raise until tire is off ground.' },
            { stepNumber: 5, title: 'Remove flat tire', description: 'Remove lug nuts completely, pull wheel straight toward you.' },
            { stepNumber: 6, title: 'Install spare', description: 'Align spare with bolts, push on, hand-tighten lug nuts.' },
            { stepNumber: 7, title: 'Lower and tighten', description: 'Lower vehicle, then tighten lug nuts in star pattern with wrench.' }
          ],
          videoLinks: [
            { title: 'How to Change a Tire', url: 'https://www.youtube.com/watch?v=example9', platform: 'youtube', duration: '7:30' }
          ],
          tips: ['Practice at home before you need to on the road', 'Check spare tire pressure monthly'],
          warnings: ['Never get under car supported only by jack', 'Spare tires have speed limits - check sidewall'],
          skillLevel: 'Intermediate',
          costEstimate: '$0 (if you have spare)'
        },
        {
          title: 'Paint a Room',
          description: 'Paint interior walls like a professional for a fresh look.',
          category: 'painting',
          difficulty: 'medium',
          estimatedTime: '4-8 hours (plus drying)',
          tools: ['Roller and tray', 'Angled brush (2-inch)', 'Extension pole', 'Drop cloths', 'Painter\'s tape', 'Sandpaper', 'Putty knife'],
          materials: ['Primer', 'Paint', 'Painter\'s caulk', 'Patching compound', 'Stir sticks'],
          steps: [
            { stepNumber: 1, title: 'Prep the room', description: 'Remove furniture or cover with drop cloths, remove outlet covers.' },
            { stepNumber: 2, title: 'Clean and repair walls', description: 'Wash walls, fill holes with compound, sand smooth when dry.' },
            { stepNumber: 3, title: 'Tape edges', description: 'Apply painter\'s tape along trim, ceiling, and windows.' },
            { stepNumber: 4, title: 'Cut in edges', description: 'Use brush to paint 2-3 inch border along edges and corners.' },
            { stepNumber: 5, title: 'Roll the walls', description: 'Load roller, apply paint in W or M pattern, fill in without lifting roller.' },
            { stepNumber: 6, title: 'Second coat', description: 'Let first coat dry 2-4 hours, apply second coat using same technique.' },
            { stepNumber: 7, title: 'Remove tape and cleanup', description: 'Remove tape at 45-degree angle while paint is slightly wet.' }
          ],
          videoLinks: [
            { title: 'How to Paint a Room', url: 'https://www.youtube.com/watch?v=example10', platform: 'youtube', duration: '18:00' }
          ],
          tips: ['Buy quality paint - covers better in fewer coats', 'Keep wet edge to avoid lap marks'],
          warnings: ['Ensure proper ventilation', 'Oil and latex paints can\'t be mixed'],
          skillLevel: 'Intermediate',
          costEstimate: '$50-200'
        },
        {
          title: 'Clean Gutters',
          description: 'Safely clean rain gutters to prevent water damage.',
          category: 'outdoor',
          difficulty: 'medium',
          estimatedTime: '2-4 hours',
          tools: ['Sturdy ladder', 'Work gloves', 'Garden trowel or gutter scoop', 'Bucket or tarp', 'Garden hose', 'Safety glasses'],
          materials: ['Gutter guards (optional)'],
          steps: [
            { stepNumber: 1, title: 'Safety first', description: 'Use stable ladder on level ground, wear gloves and glasses.' },
            { stepNumber: 2, title: 'Scoop out debris', description: 'Remove leaves and debris by hand or with scoop, working away from downspouts.' },
            { stepNumber: 3, title: 'Clear downspouts', description: 'Run hose down downspout to clear clogs.' },
            { stepNumber: 4, title: 'Flush gutters', description: 'Use hose to flush remaining dirt toward downspouts.' },
            { stepNumber: 5, title: 'Check for damage', description: 'Look for leaks, loose fasteners, or sagging sections.' },
            { stepNumber: 6, title: 'Consider gutter guards', description: 'Install guards to reduce future cleaning frequency.' }
          ],
          videoLinks: [
            { title: 'Gutter Cleaning Guide', url: 'https://www.youtube.com/watch?v=example11', platform: 'youtube', duration: '11:20' }
          ],
          tips: ['Clean in spring and fall', 'Check for water marks on siding - indicates overflow'],
          warnings: ['Ladder safety - maintain three points of contact', 'Watch for electrical lines near gutters'],
          skillLevel: 'Intermediate',
          costEstimate: '$0-50'
        }
      ];

      for (const guide of defaultGuides) {
        const record = this.guideToRecord(guide);
        await runWithResult(
          this.db,
          `INSERT INTO guides (title, description, category, difficulty, estimated_time, tools, materials, steps, video_links, tips, warnings, skill_level, cost_estimate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [record.title, record.description, record.category, record.difficulty, record.estimated_time,
           record.tools, record.materials, record.steps, record.video_links, record.tips, record.warnings,
           record.skill_level, record.cost_estimate]
        );
      }
    }
  }

  private guideToRecord(guide: DIYGuide): DIYGuideRecord {
    return {
      id: guide.id || 0,
      title: guide.title,
      description: guide.description,
      category: guide.category,
      difficulty: guide.difficulty,
      estimated_time: guide.estimatedTime,
      tools: JSON.stringify(guide.tools),
      materials: JSON.stringify(guide.materials),
      steps: JSON.stringify(guide.steps),
      video_links: guide.videoLinks ? JSON.stringify(guide.videoLinks) : null,
      tips: guide.tips ? JSON.stringify(guide.tips) : null,
      warnings: guide.warnings ? JSON.stringify(guide.warnings) : null,
      skill_level: guide.skillLevel || null,
      cost_estimate: guide.costEstimate || null
    };
  }

  private recordToGuide(record: DIYGuideRecord): DIYGuide {
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      category: record.category,
      difficulty: record.difficulty,
      estimatedTime: record.estimated_time,
      tools: JSON.parse(record.tools),
      materials: JSON.parse(record.materials),
      steps: JSON.parse(record.steps),
      videoLinks: record.video_links === null || record.video_links === undefined ? undefined : JSON.parse(record.video_links),
      tips: record.tips === null || record.tips === undefined ? undefined : JSON.parse(record.tips),
      warnings: record.warnings === null || record.warnings === undefined ? undefined : JSON.parse(record.warnings),
      skillLevel: record.skill_level === null || record.skill_level === undefined ? undefined : record.skill_level,
      costEstimate: record.cost_estimate === null || record.cost_estimate === undefined ? undefined : record.cost_estimate
    };
  }

  async addGuide(guide: DIYGuide): Promise<number> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const record = this.guideToRecord(guide);
    const result = await runWithResult(
      this.db,
      `INSERT INTO guides (title, description, category, difficulty, estimated_time, tools, materials, steps, video_links, tips, warnings, skill_level, cost_estimate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [record.title, record.description, record.category, record.difficulty, record.estimated_time,
       record.tools, record.materials, record.steps, record.video_links, record.tips, record.warnings,
       record.skill_level, record.cost_estimate]
    );
    return result.lastID;
  }

  async getGuide(id: number): Promise<DIYGuide | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const record = await new Promise<DIYGuideRecord | null>((resolve, reject) => {
      this.db!.get<DIYGuideRecord>('SELECT * FROM guides WHERE id = ?', [id], (err: Error | null, row: DIYGuideRecord) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });

    return record ? this.recordToGuide(record) : null;
  }

  async searchGuides(filters: SearchFilters = {}): Promise<DIYGuide[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM guides WHERE 1=1';
    const params: any[] = [];

    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.difficulty) {
      query += ' AND difficulty = ?';
      params.push(filters.difficulty);
    }

    if (filters.searchTerm) {
      query += ' AND (title LIKE ? OR description LIKE ?)';
      const term = `%${filters.searchTerm}%`;
      params.push(term, term);
    }

    query += ' ORDER BY title';

    const records = await new Promise<DIYGuideRecord[]>((resolve, reject) => {
      this.db!.all<DIYGuideRecord>(query, params, (err: Error | null, rows: DIYGuideRecord[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    return records.map(r => this.recordToGuide(r));
  }

  async listGuides(): Promise<DIYGuide[]> {
    return this.searchGuides();
  }

  async getGuidesByCategory(category: RepairCategory): Promise<DIYGuide[]> {
    return this.searchGuides({ category });
  }

  async getGuidesByDifficulty(difficulty: DifficultyLevel): Promise<DIYGuide[]> {
    return this.searchGuides({ difficulty });
  }

  async updateGuide(id: number, updates: Partial<DIYGuide>): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const existing = await this.getGuide(id);
    if (!existing) return false;

    const updated = { ...existing, ...updates };
    const record = this.guideToRecord(updated);

    const result = await runWithResult(
      this.db,
      `UPDATE guides SET 
        title = ?, description = ?, category = ?, difficulty = ?, estimated_time = ?,
        tools = ?, materials = ?, steps = ?, video_links = ?, tips = ?, warnings = ?,
        skill_level = ?, cost_estimate = ?
       WHERE id = ?`,
      [record.title, record.description, record.category, record.difficulty, record.estimated_time,
       record.tools, record.materials, record.steps, record.video_links, record.tips, record.warnings,
       record.skill_level, record.cost_estimate, id]
    );

    return result.changes > 0;
  }

  async deleteGuide(id: number): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, 'DELETE FROM guides WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async getCategories(): Promise<{ category: RepairCategory; count: number }[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all<{ category: RepairCategory; count: number }>(
        'SELECT category, COUNT(*) as count FROM guides GROUP BY category ORDER BY category',
        (err: Error | null, rows: { category: RepairCategory; count: number }[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getDifficultyStats(): Promise<{ difficulty: DifficultyLevel; count: number }[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all<{ difficulty: DifficultyLevel; count: number }>(
        'SELECT difficulty, COUNT(*) as count FROM guides GROUP BY difficulty ORDER BY difficulty',
        (err: Error | null, rows: { difficulty: DifficultyLevel; count: number }[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getStats(): Promise<{ total: number; byCategory: { category: RepairCategory; count: number }[]; byDifficulty: { difficulty: DifficultyLevel; count: number }[] }> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const total = await new Promise<number>((resolve, reject) => {
      this.db!.get('SELECT COUNT(*) as count FROM guides', (err: Error | null, row: { count: number }) => {
        if (err) reject(err);
        else resolve(row?.count || 0);
      });
    });

    const byCategory = await this.getCategories();
    const byDifficulty = await this.getDifficultyStats();

    return { total, byCategory, byDifficulty };
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.initialize();
      const stats = await this.getStats();
      return {
        healthy: true,
        message: `DIY Guides skill healthy. ${stats.total} guides available.`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `DIY Guides skill unhealthy: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async close(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise.catch(() => {});
    }
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.db = null;
      this.initPromise = null;
    }
  }
}

export default DIYGuidesSkill;
