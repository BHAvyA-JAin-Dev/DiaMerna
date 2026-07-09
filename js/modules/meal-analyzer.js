/* ===== DiaMerna — Meal & Ingredient Analyzer Module ===== */

const DiaMerna = window.DiaMerna || {};

DiaMerna.MealAnalyzer = (() => {

  const C = DiaMerna.CONSTANTS;
  const Helpers = DiaMerna.Helpers;
  const Storage = DiaMerna.Storage;
  const STORAGE_KEY = 'mealLogs';

  function parseIngredients(input) {
    if (typeof input !== 'string') return [];
    return input.split(',')
      .map(i => i.trim().toLowerCase())
      .filter(i => i.length > 0);
  }

  function analyzeIngredients(ingredients) {
    const highGlycemic = [];
    const safe = [];
    const unknown = [];

    ingredients.forEach(ing => {
      const isHigh = Helpers.fuzzyMatch(ing, C.HIGH_GLYCEMIC_FOODS);
      const isSafe = Helpers.fuzzyMatch(ing, C.GLYCEMIC_SAFE_FOODS);
      if (isHigh) highGlycemic.push(ing);
      else if (isSafe) safe.push(ing);
      else unknown.push(ing);
    });

    return { highGlycemic, safe, unknown };
  }

  function estimateNutrition(ingredientCount) {
    const variance = () => Math.floor(Math.random() * C.MEAL_ANALYSIS.CALORIE_VARIANCE * 2 - C.MEAL_ANALYSIS.CALORIE_VARIANCE);
    return {
      calories: ingredientCount * C.MEAL_ANALYSIS.CALORIES_PER_INGREDIENT + variance(),
      carbs: ingredientCount * C.MEAL_ANALYSIS.CARBS_PER_INGREDIENT,
      protein: ingredientCount * C.MEAL_ANALYSIS.PROTEIN_PER_INGREDIENT,
      fat: ingredientCount * C.MEAL_ANALYSIS.FAT_PER_INGREDIENT
    };
  }

  function assessGlycemicRisk(highCount, totalCount) {
    if (totalCount === 0) return { level: 'Unknown', color: 'text-gray-400', score: 0 };
    const ratio = highCount / totalCount;
    if (ratio > 0.4) return { level: 'High', color: 'text-cyber-warn', score: 3 };
    if (ratio > 0.15) return { level: 'Moderate', color: 'text-orange-400', score: 2 };
    if (highCount > 0) return { level: 'Low', color: 'text-yellow-400', score: 1 };
    return { level: 'Very Low', color: 'text-cyber-mint', score: 0 };
  }

  function generateSuggestions(highGlycemic) {
    const swaps = {
      'sugar': 'stevia or monk fruit',
      'honey': 'cinnamon or berry extract',
      'mango': 'berries or green apple',
      'watermelon': 'cucumber or berries',
      'white rice': 'cauliflower rice or quinoa',
      'white bread': 'whole grain or lettuce wrap',
      'potato': 'sweet potato (limited) or cauliflower',
      'pasta': 'zucchini noodles or chickpea pasta',
      'noodles': 'shirataki noodles or zucchini noodles',
      'banana': 'berries or half a green banana',
      'juice': 'infused water or whole fruit',
      'cereal': 'oatmeal or Greek yogurt with nuts',
      'cake': 'almond flour mug cake',
      'cookie': 'oat-based no-sugar cookie',
      'chocolate': 'dark chocolate (85%+)',
      'corn': 'green beans or broccoli',
      'white flour': 'almond flour or coconut flour'
    };

    const suggestions = highGlycemic.map(ing => {
      const found = Object.entries(swaps).find(([key]) => ing.includes(key));
      return found ? { ingredient: ing, swap: found[1] } : null;
    }).filter(Boolean);

    return suggestions;
  }

  function logMeal(name, ingredients, analysis, nutrition) {
    const meals = Storage.getOrDefault(STORAGE_KEY, []);
    meals.push({
      id: Helpers.generateId(),
      name: name.trim(),
      ingredients,
      analysis,
      nutrition,
      timestamp: Date.now(),
      date: new Date().toISOString()
    });
    Storage.set(STORAGE_KEY, meals.slice(-50));
    return meals;
  }

  function getMealHistory() {
    return Storage.getOrDefault(STORAGE_KEY, []).reverse();
  }

  function renderAnalysis(mealName, ingredientsStr, container) {
    const name = Helpers.sanitizeString(mealName);
    const ingredients = parseIngredients(ingredientsStr);

    if (!name || !ingredients.length) {
      container.classList.remove('hidden');
      container.innerHTML = '<p class="text-xs text-gray-400">Please enter a meal name and at least one ingredient.</p>';
      return;
    }

    const { highGlycemic, safe, unknown } = analyzeIngredients(ingredients);
    const nutrition = estimateNutrition(ingredients.length);
    const risk = assessGlycemicRisk(highGlycemic.length, ingredients.length);
    const suggestions = generateSuggestions(highGlycemic);

    const carbPercent = Math.round((nutrition.carbs * 4) / ((nutrition.carbs * 4) + (nutrition.protein * 4) + (nutrition.fat * 9)) * 100);
    const proteinPercent = Math.round((nutrition.protein * 4) / ((nutrition.carbs * 4) + (nutrition.protein * 4) + (nutrition.fat * 9)) * 100);
    const fatPercent = Math.round((nutrition.fat * 9) / ((nutrition.carbs * 4) + (nutrition.protein * 4) + (nutrition.fat * 9)) * 100);

    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div>
          <h3 class="font-semibold text-sm">${name}</h3>
          <p class="text-xs text-gray-400">${ingredients.length} ingredient${ingredients.length !== 1 ? 's' : ''} analyzed</p>
        </div>
        <span class="text-xs font-semibold ${risk.color}">${risk.level} Risk</span>
      </div>

      <div class="grid grid-cols-3 gap-2 mb-2">
        <div class="text-center p-2 rounded-lg bg-cyber-bg/50">
          <div class="text-lg font-bold text-cyber-pink">~${nutrition.calories}</div>
          <div class="text-[10px] text-gray-400">Calories</div>
        </div>
        <div class="text-center p-2 rounded-lg bg-cyber-bg/50">
          <div class="text-lg font-bold text-cyber-mint">${nutrition.carbs}g</div>
          <div class="text-[10px] text-gray-400">Carbs</div>
        </div>
        <div class="text-center p-2 rounded-lg bg-cyber-bg/50">
          <div class="text-lg font-bold text-cyber-lavender">${nutrition.protein}g</div>
          <div class="text-[10px] text-gray-400">Protein</div>
        </div>
      </div>

      <div class="mb-3">
        <div class="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>Carbs ${carbPercent}%</span>
          <span>Protein ${proteinPercent}%</span>
          <span>Fat ${fatPercent}%</span>
        </div>
        <div class="macro-bar">
          <div class="macro-bar-fill" style="width:${carbPercent}%;background:#ff6b9d"></div>
        </div>
        <div class="macro-bar mt-0.5">
          <div class="macro-bar-fill" style="width:${proteinPercent}%;background:#b388ff"></div>
        </div>
        <div class="macro-bar mt-0.5">
          <div class="macro-bar-fill" style="width:${fatPercent}%;background:#69f0ae"></div>
        </div>
      </div>

      ${highGlycemic.length ? `
        <div class="mb-2">
          <p class="text-xs font-semibold text-cyber-warn mb-1">⚠️ High-Glycemic ${highGlycemic.length > 1 ? 'Ingredients' : 'Ingredient'}</p>
          <div class="flex flex-wrap gap-1">${highGlycemic.map(w => `<span class="glycemic-warn">${w}</span>`).join('')}</div>
        </div>
      ` : ''}

      ${safe.length ? `
        <div class="mb-2">
          <p class="text-xs font-semibold text-cyber-mint mb-1">✅ Blood-Sugar Friendly</p>
          <div class="flex flex-wrap gap-1">${safe.map(s => `<span class="glycemic-safe">${s}</span>`).join('')}</div>
        </div>
      ` : ''}

      ${unknown.length ? `
        <div class="mb-2">
          <p class="text-xs text-gray-500 mb-1">Not in our database:</p>
          <div class="flex flex-wrap gap-1">${unknown.map(u => `<span class="text-xs text-gray-500 bg-cyber-bg/30 px-2 py-0.5 rounded-md">${u}</span>`).join('')}</div>
        </div>
      ` : ''}

      ${suggestions.length ? `
        <div class="p-3 rounded-xl bg-cyber-bg/50">
          <p class="text-xs text-gray-300 mb-1">💡 <strong class="text-cyber-pink">Smart Swaps:</strong></p>
          <ul class="text-xs text-gray-400 space-y-1">
            ${suggestions.map(s => `<li>• Replace <span class="text-cyber-warn">${s.ingredient}</span> → <span class="text-cyber-mint">${s.swap}</span></li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${!highGlycemic.length ? `
        <div class="p-3 rounded-xl bg-cyber-bg/50">
          <p class="text-xs text-cyber-mint">✅ This meal looks blood-sugar friendly! Pair with protein and fiber to minimize glucose spikes.</p>
        </div>
      ` : ''}
    `;

    logMeal(name, ingredients, { highGlycemic, safe, unknown, risk }, nutrition);
  }

  function init() {
    const nameInput = document.getElementById('mealName');
    const ingredientsInput = document.getElementById('mealIngredients');
    const analyzeBtn = document.getElementById('analyzeMealBtn');
    const resultsDiv = document.getElementById('mealResults');

    analyzeBtn.addEventListener('click', () => {
      renderAnalysis(nameInput.value, ingredientsInput.value, resultsDiv);
    });

    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') ingredientsInput.focus(); });
    ingredientsInput.addEventListener('keydown', e => { if (e.key === 'Enter') analyzeBtn.click(); });
  }

  return { init, analyzeIngredients, estimateNutrition, assessGlycemicRisk, getMealHistory, renderAnalysis };
})();

window.DiaMerna = DiaMerna;
