window.DiaMerna = window.DiaMerna || {};
var C = window.DiaMerna;

C.APP = 'DiaMerna';
C.S_PREFIX = 'dm_';

// ----- GLUCOSE -----
C.GLUCOSE = {
  THRESHOLDS: {
    fasting:         { high: 95,  label: 'Fasting',           emoji: '🕒' },
    'post-breakfast':{ high: 140, label: '1-Hr Post-Breakfast', emoji: '🍳' },
    'post-lunch':    { high: 140, label: '2-Hr Post-Lunch',     emoji: '🥗' },
    'post-dinner':   { high: 140, label: 'Post-Dinner',         emoji: '🍽️' },
    bedtime:         { high: 120, label: 'Bedtime',           emoji: '🌙' }
  },
  MIN: 0, MAX: 500, HYPO: 70
};

// ----- BABY GROWTH (weeks 4-42) -----
C.BABY = {
  4:{fruit:'Poppy Seed',g:0.5,cm:0.1},5:{fruit:'Sesame Seed',g:1,cm:0.2},6:{fruit:'Sweet Pea',g:2,cm:0.3},
  7:{fruit:'Blueberry',g:3,cm:0.8},8:{fruit:'Raspberry',g:1.6,cm:1.6},9:{fruit:'Cherry',g:2,cm:2.3},
  10:{fruit:'Strawberry',g:4,cm:3.1},11:{fruit:'Fig',g:7,cm:4.1},12:{fruit:'Plum',g:14,cm:5.4},
  13:{fruit:'Pea Pod',g:23,cm:7.4},14:{fruit:'Lemon',g:43,cm:8.7},15:{fruit:'Apple',g:70,cm:10.1},
  16:{fruit:'Avocado',g:100,cm:11.6},17:{fruit:'Onion',g:140,cm:13},18:{fruit:'Bell Pepper',g:190,cm:14.2},
  19:{fruit:'Mango',g:240,cm:15.3},20:{fruit:'Banana',g:300,cm:16.4},21:{fruit:'Carrot',g:360,cm:26.7},
  22:{fruit:'Papaya',g:430,cm:27.8},23:{fruit:'Grapefruit',g:500,cm:28.9},24:{fruit:'Corn',g:600,cm:30},
  25:{fruit:'Rutabaga',g:660,cm:34.6},26:{fruit:'Zucchini',g:760,cm:35.6},27:{fruit:'Cauliflower',g:875,cm:36.6},
  28:{fruit:'Eggplant',g:1000,cm:37.6},29:{fruit:'Butternut Squash',g:1150,cm:38.6},30:{fruit:'Cabbage',g:1320,cm:39.9},
  31:{fruit:'Coconut',g:1500,cm:41.1},32:{fruit:'Pineapple',g:1700,cm:42.4},33:{fruit:'Honeydew',g:1900,cm:43.7},
  34:{fruit:'Cantaloupe',g:2100,cm:45},35:{fruit:'Watermelon',g:2380,cm:46.2},36:{fruit:'Romaine Lettuce',g:2620,cm:47.4},
  37:{fruit:'Swiss Chard',g:2850,cm:48.6},38:{fruit:'Rhubarb',g:3080,cm:49.8},39:{fruit:'Mini Watermelon',g:3290,cm:50.7},
  40:{fruit:'Small Pumpkin',g:3460,cm:51.2},41:{fruit:'Watermelon',g:3600,cm:52},42:{fruit:'Mini Watermelon',g:3700,cm:52.5}
};

// ----- KICK COUNTS -----
C.KICK_TARGETS = { morning: 10, afternoon: 10, evening: 10 };

// ----- MEDICATIONS -----
C.MEDS = [
  {name:'Metformin', dose:'500mg', time:'After breakfast', color:'#ff6b9d'},
  {name:'Insulin', dose:'As prescribed', time:'Before meals', color:'#b388ff'},
  {name:'Prenatal Vitamins', dose:'1 tablet', time:'With breakfast', color:'#69f0ae'},
  {name:'Calcium', dose:'500mg', time:'With dinner', color:'#ffab40'},
  {name:'Iron', dose:'65mg', time:'Empty stomach', color:'#ff5252'},
  {name:'Vitamin D', dose:'1000 IU', time:'With breakfast', color:'#ffd740'}
];

// ----- INDIAN FOODS -----
C.INDIAN_FOODS = [
  {name:'Rice (White, cooked)',cal:206,carbs:45,protein:4.3,fat:0.4,gi:73,alt:'Brown rice, quinoa'},
  {name:'Roti (Whole Wheat)',cal:120,carbs:24,protein:3.5,fat:1.5,gi:62,alt:'Multigrain roti, millet roti'},
  {name:'Poha',cal:250,carbs:45,protein:5,fat:6,gi:70,alt:'Oats upma, quinoa poha'},
  {name:'Idli',cal:78,carbs:15,protein:2.5,fat:0.5,gi:65,alt:'Ragi idli, oats idli'},
  {name:'Dosa',cal:133,carbs:25,protein:3.5,fat:2.5,gi:70,alt:'Ragi dosa, besan chilla'},
  {name:'Upma',cal:280,carbs:48,protein:6,fat:7,gi:65,alt:'Quinoa upma, dalia upma'},
  {name:'Biryani (Veg)',cal:350,carbs:55,protein:8,fat:10,gi:68,alt:'Cauliflower rice biryani'},
  {name:'Mango Shake',cal:320,carbs:55,protein:8,fat:8,gi:75,alt:'Berry smoothie (no sugar)'},
  {name:'Jalebi',cal:150,carbs:34,protein:0.5,fat:1.5,gi:80,alt:'Fruit chaat, roasted chana'},
  {name:'Chole Bhature',cal:450,carbs:60,protein:12,fat:18,gi:72,alt:'Chole with quinoa/roti'},
  {name:'Samosa',cal:260,carbs:30,protein:4,fat:14,gi:65,alt:'Baked samosa, vegetable wrap'},
  {name:'Paratha (Aloo)',cal:310,carbs:42,protein:6,fat:13,gi:68,alt:'Methi paratha, paneer paratha'},
  {name:'Dal Khichdi',cal:220,carbs:38,protein:10,fat:3,gi:55,alt:'Quinoa khichdi, millet khichdi'},
  {name:'Naan',cal:210,carbs:38,protein:6,fat:4,gi:72,alt:'Multigrain roti, missi roti'},
  {name:'Lassi (Sweet)',cal:210,carbs:30,protein:6,fat:7,gi:70,alt:'Buttermilk (chaas), Greek yogurt'}
];

// ----- SYMPTOMS -----
C.SYMPTOMS = [
  {id:'headache', label:'Headache', emoji:'🤕', urgent:false},
  {id:'blurred', label:'Blurred Vision', emoji:'👁️', urgent:true},
  {id:'nausea', label:'Nausea', emoji:'🤢', urgent:false},
  {id:'fatigue', label:'Fatigue', emoji:'😴', urgent:false},
  {id:'swelling', label:'Swelling', emoji:'🦶', urgent:true},
  {id:'dizziness', label:'Dizziness', emoji:'😵', urgent:true},
  {id:'thirst', label:'Increased Thirst', emoji:'💧', urgent:false},
  {id:'numbness', label:'Numbness/Tingling', emoji:'❄️', urgent:true}
];

// ----- EXERCISES -----
C.EXERCISES = [
  {name:'Deep Breathing',min:5,emoji:'🌬️',desc:'Inhale 4s, hold 4s, exhale 6s. Reduces stress and lowers cortisol.'},
  {name:'Seated Stretch',min:5,emoji:'🧘',desc:'Neck rolls, shoulder shrugs, ankle rotations. Safe for all trimesters.'},
  {name:'Walking',min:15,emoji:'🚶‍♀️',desc:'Gentle paced walk. Best 15 min after meals for glucose regulation.'},
  {name:'Meditation',min:5,emoji:'🧠',desc:'Body scan meditation. Lowers stress hormones that affect blood sugar.'}
];

// ----- AI -----
C.AI = {
  MODEL: C.MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
  URL: 'https://openrouter.ai/api/v1/chat/completions',
  MAX_TOKENS: 600,
  KEY: 'orKey',
  PROMPT: C.PROMPT || 'You are DiaMerna, a compassionate AI maternal endocrinology assistant...'
};
C.API_KEY = C.API_KEY || '';
C.MODEL = C.MODEL || C.AI.MODEL;
C.PROMPT = C.PROMPT || C.AI.PROMPT;
C.TABS = ['home','glucose','baby','health','more'];

/* Build BABY_GROWTH array from C.BABY object for babyGrowth() */
var BABY_GROWTH = [];
(function () {
  var EMOJIS = {
    'Poppy Seed':'🌱','Sesame Seed':'🌱','Sweet Pea':'🫛','Blueberry':'🫐','Raspberry':'🍓',
    'Cherry':'🍒','Strawberry':'🍓','Fig':'🫐','Plum':'🍑','Pea Pod':'🫛','Lemon':'🍋',
    'Apple':'🍎','Avocado':'🥑','Onion':'🧅','Bell Pepper':'🫑','Mango':'🥭','Banana':'🍌',
    'Carrot':'🥕','Papaya':'🍈','Grapefruit':'🍊','Corn':'🌽','Rutabaga':'🥔','Zucchini':'🥒',
    'Cauliflower':'🥦','Eggplant':'🍆','Butternut Squash':'🎃','Cabbage':'🥬','Coconut':'🥥',
    'Pineapple':'🍍','Honeydew':'🍈','Cantaloupe':'🍈','Watermelon':'🍉','Romaine Lettuce':'🥬',
    'Swiss Chard':'🥬','Rhubarb':'🥬','Mini Watermelon':'🍉','Small Pumpkin':'🎃'
  };
  for (var w = 4; w <= 42; w++) {
    if (C.BABY[w]) {
      BABY_GROWTH.push({
        w: w,
        fruit: C.BABY[w].fruit,
        emoji: EMOJIS[C.BABY[w].fruit] || '🌸',
        g: C.BABY[w].g,
        cm: C.BABY[w].cm
      });
    }
  }
})();

/* --- Global aliases (modules reference these directly) --- */
var GLUCOSE_LABELS = {};
Object.keys(C.GLUCOSE.THRESHOLDS).forEach(function(k) { GLUCOSE_LABELS[k] = C.GLUCOSE.THRESHOLDS[k].label; });
var MEDICATIONS = C.MEDS;
var INDIAN_FOODS = C.INDIAN_FOODS;
var SYMPTOMS = C.SYMPTOMS;
var EXERCISES = C.EXERCISES;
