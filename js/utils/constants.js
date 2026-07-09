/* ===== DiaMerna — Constants & Configuration ===== */

const DiaMerna = window.DiaMerna || {};

DiaMerna.CONSTANTS = {

  APP_NAME: 'DiaMerna',
  STORAGE_PREFIX: 'diaMerna_',

  GLUCOSE: {
    THRESHOLDS: {
      fasting:   { high: 95,  label: 'Fasting',           emoji: '🕒' },
      'post-breakfast': { high: 140, label: '1-Hr Post-Breakfast', emoji: '🍳' },
      'post-lunch':     { high: 140, label: '2-Hr Post-Lunch',     emoji: '🥗' },
      'post-dinner':    { high: 140, label: 'Post-Dinner',         emoji: '🍽️' },
      bedtime:    { high: 120, label: 'Bedtime',           emoji: '🌙' }
    },
    MIN_VALUE: 0,
    MAX_VALUE: 500,
    TARGET_FASTING: 95,
    TARGET_POST_MEAL: 140
  },

  CYCLE: {
    DEFAULT_LENGTH: 28,
    OVULATION_DAY: 14,
    FERTILE_WINDOW_START: 9,
    FERTILE_WINDOW_END: 15,
    PREGNANCY_DURATION_DAYS: 280,
    TRIMESTERS: [
      { label: 'First Trimester',  weeksStart: 1,  weeksEnd: 12,  color: '#ff6b9d' },
      { label: 'Second Trimester', weeksStart: 13, weeksEnd: 26,  color: '#b388ff' },
      { label: 'Third Trimester',  weeksStart: 27, weeksEnd: 40,  color: '#69f0ae' }
    ]
  },

  HIGH_GLYCEMIC_FOODS: [
    'sugar', 'honey', 'mango', 'watermelon', 'white rice', 'white bread',
    'potato', 'corn flakes', 'rice cakes', 'pasta', 'noodles', 'syrup',
    'jelly', 'jam', 'soda', 'juice', 'candy', 'chocolate', 'cake',
    'cookie', 'doughnut', 'banana', 'dates', 'raisins', 'cereal',
    'sweet potato', 'corn', 'peas', 'pumpkin', 'parsnip', 'turnip',
    'bagel', 'croissant', 'biscuit', 'muffin', 'pancake', 'waffle',
    'ice cream', 'milkshake', 'smoothie', 'sports drink', 'energy drink',
    'maple syrup', 'agave', 'molasses', 'coconut sugar', 'brown sugar',
    'white flour', 'all-purpose flour', 'white pasta', 'instant rice',
    'crackers', 'pretzels', 'popcorn', 'chips', 'fries'
  ],

  GLYCEMIC_SAFE_FOODS: [
    'spinach', 'broccoli', 'kale', 'cauliflower', 'brussels sprouts',
    'asparagus', 'green beans', 'zucchini', 'cucumber', 'celery',
    'lettuce', 'arugula', 'cabbage', 'bell pepper', 'mushroom',
    'almond', 'walnut', 'peanut', 'chia', 'flax', 'oat', 'quinoa',
    'barley', 'lentil', 'chickpea', 'tofu', 'tempeh', 'egg',
    'chicken', 'fish', 'salmon', 'tuna', 'sardine', 'avocado',
    'olive oil', 'coconut oil', 'greek yogurt', 'cottage cheese',
    'cheese', 'butter', 'cream', 'sour cream', 'hemp seed',
    'pumpkin seed', 'sunflower seed', 'sesame seed', 'turmeric',
    'ginger', 'garlic', 'onion', 'tomato', 'eggplant', 'okra',
    'cabbage', 'celery root', 'rhubarb', 'seaweed', 'spirulina'
  ],

  MEAL_ANALYSIS: {
    CALORIES_PER_INGREDIENT: 75,
    CARBS_PER_INGREDIENT: 12,
    PROTEIN_PER_INGREDIENT: 5,
    FAT_PER_INGREDIENT: 4,
    CALORIE_VARIANCE: 50
  },

  HYDRATION: {
    DAILY_GOAL: 8,
    STORAGE_KEY: 'hydration'
  },

  TIMER: {
    DURATION_SECONDS: 15 * 60,
    INTERVAL_MS: 1000
  },

  AI: {
    MODEL: 'nvidia/nemotron-3-super-120b-a12b:free',
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    MAX_TOKENS: 500,
    STORAGE_KEY: 'openRouterKey',
    SYSTEM_PROMPT: `You are DiaMerna, an expert maternal endocrinology assistant specializing in gestational diabetes management and pregnancy wellness. Provide compassionate, evidence-based advice. Always remind users to consult their doctor for personalized medical care. Keep responses concise, practical, and supportive. You can suggest recipe modifications, exercise tips, and blood sugar management strategies.`
  }

};

Object.freeze(DiaMerna.CONSTANTS);
window.DiaMerna = DiaMerna;
