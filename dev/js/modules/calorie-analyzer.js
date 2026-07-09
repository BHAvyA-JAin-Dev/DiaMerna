/* AI Calorie Analyzer Module */
(function () {
  const inp = document.getElementById('calInp')
  const qty = document.getElementById('calQty')
  const btn = document.getElementById('calAnalyzeBtn')
  const result = document.getElementById('calResult')
  const history = document.getElementById('calHistory')

  btn.addEventListener('click', analyze)
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') analyze() })

  /* Hardcoded common Indian foods fallback */
  const FOOD_DB = {
    'paneer': {name:'Paneer',calories:265,protein_g:18,carbs_g:1.2,fat_g:21,fiber_g:0,gi:27},
    'roti': {name:'Wheat Roti',calories:120,protein_g:3.5,carbs_g:24,fat_g:1.5,fiber_g:2.5,gi:62},
    'rice': {name:'Cooked White Rice',calories:206,protein_g:4.3,carbs_g:45,fat_g:0.4,fiber_g:0.6,gi:73},
    'dal': {name:'Cooked Dal',calories:113,protein_g:7.8,carbs_g:20,fat_g:0.3,fiber_g:5,gi:45},
    'egg': {name:'Egg (Whole)',calories:155,protein_g:13,carbs_g:1.1,fat_g:11,fiber_g:0,gi:0},
    'chicken': {name:'Chicken Breast',calories:165,protein_g:31,carbs_g:0,fat_g:3.6,fiber_g:0,gi:0},
    'milk': {name:'Cow Milk',calories:66,protein_g:3.2,carbs_g:4.8,fat_g:3.6,fiber_g:0,gi:30},
    'curd': {name:'Yogurt/Curd',calories:61,protein_g:3.5,carbs_g:4.7,fat_g:3.3,fiber_g:0,gi:35},
    'banana': {name:'Banana',calories:89,protein_g:1.1,carbs_g:23,fat_g:0.3,fiber_g:2.6,gi:52},
    'apple': {name:'Apple',calories:52,protein_g:0.3,carbs_g:14,fat_g:0.2,fiber_g:2.4,gi:39},
    'oat': {name:'Oats',calories:389,protein_g:16.9,carbs_g:66,fat_g:6.9,fiber_g:10.6,gi:55},
    'brown rice': {name:'Brown Rice',calories:111,protein_g:2.6,carbs_g:23,fat_g:0.9,fiber_g:1.8,gi:50},
    'chapati': {name:'Chapati',calories:120,protein_g:3.5,carbs_g:24,fat_g:1.5,fiber_g:2.5,gi:62},
    'idli': {name:'Idli',calories:78,protein_g:2.5,carbs_g:15,fat_g:0.5,fiber_g:0.5,gi:65},
    'dosa': {name:'Dosa',calories:133,protein_g:3.5,carbs_g:25,fat_g:2.5,fiber_g:0.6,gi:70},
    'paratha': {name:'Aloo Paratha',calories:310,protein_g:6,carbs_g:42,fat_g:13,fiber_g:3,gi:68},
    'khichdi': {name:'Dal Khichdi',calories:220,protein_g:10,carbs_g:38,fat_g:3,fiber_g:4,gi:55},
    'poha': {name:'Poha',calories:250,protein_g:5,carbs_g:45,fat_g:6,fiber_g:2,gi:70},
    'upma': {name:'Upma',calories:280,protein_g:6,carbs_g:48,fat_g:7,fiber_g:3,gi:65},
    'samosa': {name:'Samosa',calories:260,protein_g:4,carbs_g:30,fat_g:14,fiber_g:2,gi:65},
    'biryani': {name:'Veg Biryani',calories:350,protein_g:8,carbs_g:55,fat_g:10,fiber_g:3,gi:68}
  }

  function lookupFood(name) {
    const n = name.toLowerCase()
    for (const [key, val] of Object.entries(FOOD_DB)) {
      if (n.includes(key)) return { ...val }
    }
    return null
  }

  function stripQty(s) {
    const m = s.match(/^(\d+\s*(?:g|ml|cup|tbsp|tsp|oz|pieces?|slices?)\s+)?(.+)/i)
    return m && m[2] ? m[2].trim() : s.trim()
  }

  async function analyze() {
    const raw = inp.value.trim()
    if (!raw) { result.innerHTML = '<span class="c-warn">Please enter a food name.</span>'; return }
    const food = stripQty(raw)
    const grams = parseInt(qty.value) || 100

    /* Try local DB first */
    let parsed = lookupFood(food)
    if (parsed) { showResult(parsed, food, grams); return }

    result.innerHTML = '<span class="text-gray-500">🔍 Analyzing with AI...</span>'

    try {
      const prompt = `ONLY return a JSON object for "${food}" PER 100g. Fields: name, calories (kcal), protein_g, carbs_g, fat_g, fiber_g, gi (0-100). Example: {"name":"Paneer","calories":265,"protein_g":18,"carbs_g":1.2,"fat_g":21,"fiber_g":0,"gi":27}. No other text.`
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
        body: JSON.stringify({ model: API_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 200 })
      })
      const d = await res.json()
      const text = d.choices?.[0]?.message?.content?.trim() || ''
      try { parsed = JSON.parse(text) } catch {
        const m = text.match(/\{[\s\S]*?\}/)
        if (m) { try { parsed = JSON.parse(m[0]) } catch { parsed = null } }
      }
      if (!parsed || !parsed.calories) {
        /* Try regex extraction from text */
        const cal = text.match(/(\d+\.?\d*)\s*(?:cal|kcal|calories)/i)
        const pro = text.match(/(\d+\.?\d*)\s*g\s*(?:protein|prot)/i)
        const carb = text.match(/(\d+\.?\d*)\s*g\s*(?:carb|carbs|carbohydrate)/i)
        const fat = text.match(/(\d+\.?\d*)\s*g\s*(?:fat)/i)
        if (cal) parsed = { name: food, calories: parseFloat(cal[1]), protein_g: pro ? parseFloat(pro[1]) : 0, carbs_g: carb ? parseFloat(carb[1]) : 0, fat_g: fat ? parseFloat(fat[1]) : 0, fiber_g: 0, gi: null }
      }
      if (!parsed || !parsed.calories || parsed.calories < 1) {
        result.innerHTML = '<span class="c-warn">⚠️ Could not analyze. Try a different food name.</span>'
        return
      }
      showResult(parsed, food, grams)
    } catch {
      result.innerHTML = '<span class="c-warn">⚠️ Could not analyze. Try again.</span>'
    }
  }

  function showResult(parsed, food, grams) {
    result.innerHTML = `
      <div class="cal-item">
        <div class="cal-name">${parsed.name || food}</div>
        <div class="cal-grid">
          <div class="cal-nut"><div class="val">${Math.round(parsed.calories * grams / 100)}</div><div class="lbl">Calories</div></div>
          <div class="cal-nut"><div class="val c-pink">${(parsed.protein_g * grams / 100).toFixed(1)}g</div><div class="lbl">Protein</div></div>
          <div class="cal-nut"><div class="val c-lav">${(parsed.carbs_g * grams / 100).toFixed(1)}g</div><div class="lbl">Carbs</div></div>
          <div class="cal-nut"><div class="val">${(parsed.fat_g * grams / 100).toFixed(1)}g</div><div class="lbl">Fat</div></div>
        </div>
        <div class="flex gap-3 mt-2 text-[10px]">
          <span>🌾 Fiber: ${(parsed.fiber_g * grams / 100).toFixed(1)}g</span>
          <span class="${parsed.gi <= 55 ? 'c-mint' : parsed.gi <= 69 ? 'c-lav' : 'c-warn'}">📊 GI: ${parsed.gi || 'N/A'}</span>
          <span class="text-gray-500">⚖️ ${grams}g serving</span>
        </div>
      </div>`
    Store.push('calHistory', {
      food, grams, name: parsed.name || food,
      cal: Math.round(parsed.calories * grams / 100),
      protein: (parsed.protein_g * grams / 100).toFixed(1),
      carbs: (parsed.carbs_g * grams / 100).toFixed(1),
      fat: (parsed.fat_g * grams / 100).toFixed(1),
      date: today(), time: now()
    })
    inp.value = ''; qty.value = ''; renderHistory()
  }

  function renderHistory() {
    const entries = Store.get('calHistory', []).reverse().slice(0, 10)
    if (!entries.length) { history.innerHTML = ''; return }
    history.innerHTML = '<div class="text-[10px] text-gray-500 mb-1 font-semibold">📋 Recent Foods</div>' +
      entries.map(e =>
        `<div class="cal-item" style="padding:8px 12px">
          <div class="flex justify-between">
            <span class="font-semibold text-sm">${e.name || e.food}</span>
            <span class="font-bold c-pink">${e.cal} cal</span>
          </div>
          <div class="text-[10px] text-gray-500">${e.date} · ${e.protein}g protein · ${e.carbs}g carbs · ${e.fat}g fat · ${e.grams}g</div>
        </div>`
      ).join('')
  }

  renderHistory()
})()
