/* ===== DiaMerna — App Logic ===== */

document.addEventListener('DOMContentLoaded', () => {

  // ======= TAB NAVIGATION =======
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // ======= 1. GLUCOSE LOGGER =======
  const glucoseInput = document.getElementById('glucoseInput');
  const logGlucoseBtn = document.getElementById('logGlucoseBtn');
  const clearGlucoseBtn = document.getElementById('clearGlucoseBtn');
  const glucoseChart = document.getElementById('glucoseChart');
  let selectedTiming = 'fasting';

  document.querySelectorAll('.timing-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timing-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTiming = btn.dataset.timing;
    });
  });

  function getGlucoseLogs() {
    return JSON.parse(localStorage.getItem('diaMernaGlucose') || '[]');
  }

  function saveGlucoseLogs(logs) {
    localStorage.setItem('diaMernaGlucose', JSON.stringify(logs));
  }

  function renderGlucoseChart() {
    const logs = getGlucoseLogs();
    if (!logs.length) {
      glucoseChart.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">No readings logged yet.</p>';
      return;
    }
    glucoseChart.innerHTML = [...logs].reverse().map(entry => {
      const isHigh = (entry.timing === 'fasting' && entry.value >= 95)
        || (entry.timing !== 'fasting' && entry.value >= 140);
      return `<div class="glucose-entry">
        <div>
          <span class="value ${isHigh ? 'high' : 'normal'}">${entry.value}</span>
          <span class="text-xs text-gray-500 ml-1">mg/dL</span>
        </div>
        <div class="text-right">
          <div class="timing">${entry.timingLabel}</div>
          <div class="time">${entry.time}</div>
        </div>
      </div>`;
    }).join('');
  }

  logGlucoseBtn.addEventListener('click', () => {
    const value = parseInt(glucoseInput.value);
    if (isNaN(value) || value < 0 || value > 500) {
      glucoseInput.focus();
      return;
    }
    const timingLabels = {
      'fasting': '🕒 Fasting',
      'post-breakfast': '🍳 1-Hr Post-Breakfast',
      'post-lunch': '🥗 2-Hr Post-Lunch',
      'post-dinner': '🍽️ Post-Dinner',
      'bedtime': '🌙 Bedtime'
    };
    const logs = getGlucoseLogs();
    logs.push({
      value,
      timing: selectedTiming,
      timingLabel: timingLabels[selectedTiming] || selectedTiming,
      time: new Date().toLocaleString(),
      timestamp: Date.now()
    });
    saveGlucoseLogs(logs);
    glucoseInput.value = '';
    renderGlucoseChart();
  });

  glucoseInput.addEventListener('keydown', e => { if (e.key === 'Enter') logGlucoseBtn.click(); });

  clearGlucoseBtn.addEventListener('click', () => {
    if (confirm('Clear all glucose readings?')) {
      saveGlucoseLogs([]);
      renderGlucoseChart();
    }
  });

  renderGlucoseChart();

  // ======= 2. CYCLE CALCULATOR =======
  const lmpInput = document.getElementById('lmpInput');
  const pregnancyMode = document.getElementById('pregnancyMode');
  const cycleLengthInput = document.getElementById('cycleLength');
  const calculateCycleBtn = document.getElementById('calculateCycleBtn');
  const cycleResults = document.getElementById('cycleResults');
  const cycleOutput = document.getElementById('cycleOutput');

  calculateCycleBtn.addEventListener('click', () => {
    const lmpStr = lmpInput.value;
    if (!lmpStr) return;
    const lmp = new Date(lmpStr);
    const cycleLen = parseInt(cycleLengthInput.value) || 28;
    const isPregnant = pregnancyMode.checked;

    cycleResults.classList.remove('hidden');

    if (isPregnant) {
      const now = new Date();
      const msSinceLmp = now - lmp;
      const daysSinceLmp = Math.floor(msSinceLmp / (1000 * 60 * 60 * 24));
      const weeksSinceLmp = daysSinceLmp / 7;
      const pregnancyWeeks = Math.floor(weeksSinceLmp);
      const pregnancyDays = Math.floor((weeksSinceLmp - pregnancyWeeks) * 7);

      if (daysSinceLmp < 0) {
        cycleOutput.innerHTML = '<p class="text-gray-400">LMP cannot be in the future.</p>';
        return;
      }

      const trimesters = [
        { label: 'First Trimester', weeks: '1-12', color: 'text-cyber-pink' },
        { label: 'Second Trimester', weeks: '13-26', color: 'text-cyber-lavender' },
        { label: 'Third Trimester', weeks: '27-40', color: 'text-cyber-mint' }
      ];
      let trimesterInfo = '';
      if (pregnancyWeeks <= 12) trimesterInfo = trimesters[0].label;
      else if (pregnancyWeeks <= 26) trimesterInfo = trimesters[1].label;
      else trimesterInfo = trimesters[2].label;

      const dueDate = new Date(lmp);
      dueDate.setDate(dueDate.getDate() + 280);
      const dueStr = dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const dueDaysLeft = Math.max(0, Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)));

      cycleOutput.innerHTML = `
        <div class="flex items-center gap-2 mb-2"><span class="result-badge pregnant">Pregnant</span> <span class="text-lg font-bold text-cyber-mint">Week ${pregnancyWeeks} · Day ${pregnancyDays}</span></div>
        <p class="text-xs text-gray-300">${trimesterInfo}</p>
        <p class="text-xs text-gray-400 mt-2">Estimated Due Date: <strong class="text-white">${dueStr}</strong> (${dueDaysLeft > 0 ? dueDaysLeft + ' days remaining' : 'past due'})</p>
        <div class="mt-3 p-3 rounded-xl bg-cyber-bg/50">
          <p class="text-xs font-semibold text-cyber-pink mb-1">Metabolic Targets for Week ${pregnancyWeeks}</p>
          <ul class="text-xs text-gray-400 space-y-0.5 list-disc list-inside">
            <li>Fasting glucose: < 95 mg/dL</li>
            <li>1-Hr post-meal: < 140 mg/dL</li>
            <li>2-Hr post-meal: < 120 mg/dL</li>
            <li>Hydration: 8-10 glasses/day</li>
          </ul>
        </div>
      `;
    } else {
      const ovulationDay = 14;
      const fertileStart = ovulationDay - 5;
      const fertileEnd = ovulationDay + 1;
      const nextPeriod = new Date(lmp);
      nextPeriod.setDate(nextPeriod.getDate() + cycleLen);

      const ovulationDate = new Date(lmp);
      ovulationDate.setDate(ovulationDate.getDate() + ovulationDay);

      const fertileStartDate = new Date(lmp);
      fertileStartDate.setDate(fertileStartDate.getDate() + fertileStart);
      const fertileEndDate = new Date(lmp);
      fertileEndDate.setDate(fertileEndDate.getDate() + fertileEnd);

      const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      cycleOutput.innerHTML = `
        <p><span class="result-badge period">📍 Next Period</span> <span class="text-sm">${fmt(nextPeriod)}</span></p>
        <p class="mt-2"><span class="result-badge ovulation">🟣 Ovulation</span> <span class="text-sm">${fmt(ovulationDate)}</span></p>
        <p class="mt-2"><span class="result-badge fertile">🌸 Fertile Window</span> <span class="text-sm">${fmt(fertileStartDate)} – ${fmt(fertileEndDate)}</span></p>
        <p class="text-xs text-gray-500 mt-3">Based on a ${cycleLen}-day cycle starting ${fmt(lmp)}.</p>
      `;
    }
  });

  // Set default LMP to 4 weeks ago
  const defaultLmp = new Date();
  defaultLmp.setDate(defaultLmp.getDate() - 28);
  lmpInput.value = defaultLmp.toISOString().split('T')[0];

  // ======= 3. MEAL ANALYZER =======
  const mealNameInput = document.getElementById('mealName');
  const mealIngredientsInput = document.getElementById('mealIngredients');
  const analyzeMealBtn = document.getElementById('analyzeMealBtn');
  const mealResults = document.getElementById('mealResults');

  const HIGH_GLYCEMIC = [
    'sugar', 'honey', 'mango', 'watermelon', 'white rice', 'white bread',
    'potato', 'corn flakes', 'rice cakes', 'pasta', 'noodles', 'syrup',
    'jelly', 'jam', 'soda', 'juice', 'candy', 'chocolate', 'cake',
    'cookie', 'doughnut', 'banana', 'dates', 'raisins', 'cereal'
  ];

  const GLYCEMIC_SAFE = [
    'spinach', 'broccoli', 'kale', 'cauliflower', 'brussels sprouts',
    'asparagus', 'green beans', 'zucchini', 'cucumber', 'celery',
    'lettuce', 'arugula', 'cabbage', 'bell pepper', 'mushroom',
    'almond', 'walnut', 'peanut', 'chia', 'flax', 'oat', 'quinoa',
    'barley', 'lentil', 'chickpea', 'tofu', 'tempeh', 'egg',
    'chicken', 'fish', 'salmon', 'avocado', 'olive oil', 'greek yogurt',
    'cottage cheese', 'cheese', 'butter', 'cream'
  ];

  analyzeMealBtn.addEventListener('click', () => {
    const name = mealNameInput.value.trim();
    const ingredientsStr = mealIngredientsInput.value.trim();
    if (!name || !ingredientsStr) return;

    const ingredients = ingredientsStr.split(',').map(i => i.trim().toLowerCase()).filter(Boolean);
    const totalItems = ingredients.length;

    let warnings = [];
    let safeItems = [];
    let unknownItems = [];

    ingredients.forEach(ing => {
      const matchedHigh = HIGH_GLYCEMIC.some(h => ing.includes(h));
      const matchedSafe = GLYCEMIC_SAFE.some(s => ing.includes(s));
      if (matchedHigh) warnings.push(ing);
      else if (matchedSafe) safeItems.push(ing);
      else unknownItems.push(ing);
    });

    const estimatedCalories = totalItems * 75 + Math.floor(Math.random() * 50);
    const estimatedCarbs = Math.floor(totalItems * 12);
    const estimatedProtein = Math.floor(totalItems * 5);
    const estimatedFat = Math.floor(totalItems * 4);

    const riskLevel = warnings.length > 2 ? 'High' : warnings.length > 0 ? 'Moderate' : 'Low';
    const riskColor = warnings.length > 2 ? 'text-cyber-warn' : warnings.length > 0 ? 'text-orange-400' : 'text-cyber-mint';

    mealResults.classList.remove('hidden');
    mealResults.innerHTML = `
      <div class="flex items-center justify-between">
        <h3 class="font-semibold">${name}</h3>
        <span class="text-xs ${riskColor} font-semibold">${riskLevel} Glycemic Risk</span>
      </div>
      <div class="text-xs text-gray-400">${totalItems} ingredients analyzed</div>

      <div class="grid grid-cols-3 gap-2 mt-2">
        <div class="text-center p-2 rounded-lg bg-cyber-bg/50">
          <div class="text-lg font-bold text-cyber-pink">~${estimatedCalories}</div>
          <div class="text-xs text-gray-400">Calories</div>
        </div>
        <div class="text-center p-2 rounded-lg bg-cyber-bg/50">
          <div class="text-lg font-bold text-cyber-mint">${estimatedCarbs}g</div>
          <div class="text-xs text-gray-400">Carbs</div>
        </div>
        <div class="text-center p-2 rounded-lg bg-cyber-bg/50">
          <div class="text-lg font-bold text-cyber-lavender">${estimatedProtein}g</div>
          <div class="text-xs text-gray-400">Protein</div>
        </div>
      </div>
      <div class="macro-bar mt-1"><div class="macro-bar-fill" style="width:${Math.min(100, estimatedCarbs)}%;background:linear-gradient(90deg,#ff6b9d,#b388ff)"></div></div>

      ${warnings.length ? `<div class="mt-3"><p class="text-xs font-semibold text-cyber-warn mb-1">⚠️ High-Glycemic Warnings</p><div class="flex flex-wrap gap-1">${warnings.map(w => `<span class="glycemic-warn">${w}</span>`).join('')}</div></div>` : ''}
      ${safeItems.length ? `<div class="mt-2"><p class="text-xs font-semibold text-cyber-mint mb-1">✅ Safe Choices</p><div class="flex flex-wrap gap-1">${safeItems.map(s => `<span class="glycemic-safe">${s}</span>`).join('')}</div></div>` : ''}
      ${unknownItems.length ? `<div class="mt-2"><p class="text-xs text-gray-400">${unknownItems.map(u => `<span class="text-gray-500">${u}</span>`).join(', ')}</p></div>` : ''}
      ${warnings.length ? `<div class="mt-3 p-3 rounded-xl bg-cyber-bg/50"><p class="text-xs text-gray-300">💡 <strong class="text-cyber-pink">Tip:</strong> Consider swapping ${warnings.slice(0, 2).join(' or ')} with lower-glycemic alternatives.</p></div>` : ''}
    `;
  });

  mealNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') analyzeMealBtn.click(); });
  mealIngredientsInput.addEventListener('keydown', e => { if (e.key === 'Enter') analyzeMealBtn.click(); });

  // ======= 4. ROUTINE BUILDER =======
  // Timer
  let timerInterval = null;
  let timerSeconds = 15 * 60;
  const timerDisplay = document.getElementById('timerDisplay');
  const startTimerBtn = document.getElementById('startTimerBtn');
  const resetTimerBtn = document.getElementById('resetTimerBtn');

  function updateTimerDisplay() {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  startTimerBtn.addEventListener('click', () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      startTimerBtn.textContent = 'Start';
      return;
    }
    if (timerSeconds <= 0) {
      timerSeconds = 15 * 60;
      updateTimerDisplay();
    }
    startTimerBtn.textContent = 'Pause';
    timerInterval = setInterval(() => {
      timerSeconds--;
      updateTimerDisplay();
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        startTimerBtn.textContent = 'Done! 🎉';
        setTimeout(() => { startTimerBtn.textContent = 'Start'; }, 2000);
      }
    }, 1000);
  });

  resetTimerBtn.addEventListener('click', () => {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerSeconds = 15 * 60;
    updateTimerDisplay();
    startTimerBtn.textContent = 'Start';
  });

  // Hydration Tracker
  const hydrationCount = document.getElementById('hydrationCount');
  const hydrationCups = document.getElementById('hydrationCups');

  function renderHydration() {
    let count = parseInt(localStorage.getItem('diaMernaHydration') || '0');
    hydrationCount.textContent = count;
    hydrationCups.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const cup = document.createElement('div');
      cup.className = `hydration-cup ${i < count ? 'filled' : ''}`;
      cup.addEventListener('click', () => {
        const newCount = i < count ? i : i + 1;
        localStorage.setItem('diaMernaHydration', newCount.toString());
        renderHydration();
      });
      hydrationCups.appendChild(cup);
    }
  }
  renderHydration();

  // Daily checklist persistence
  document.querySelectorAll('#dailyChecklist input[type="checkbox"]').forEach(cb => {
    const key = `diaMerna_${cb.nextElementSibling.textContent.trim().replace(/\s+/g, '_')}`;
    cb.checked = localStorage.getItem(key) === 'true';
    cb.addEventListener('change', () => {
      localStorage.setItem(key, cb.checked);
    });
  });

  // Reset hydration daily (on first visit)
  const lastHydrationDate = localStorage.getItem('diaMernaHydrationDate');
  const today = new Date().toDateString();
  if (lastHydrationDate !== today) {
    localStorage.setItem('diaMernaHydration', '0');
    localStorage.setItem('diaMernaHydrationDate', today);
    renderHydration();
  }

  // ======= 5. AI CHAT =======
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  const chatInput = document.getElementById('chatInput');
  const sendChatBtn = document.getElementById('sendChatBtn');
  const chatMessages = document.getElementById('chatMessages');

  if (localStorage.getItem('diaMernaOpenRouterKey')) {
    apiKeyInput.value = localStorage.getItem('diaMernaOpenRouterKey');
  }

  saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem('diaMernaOpenRouterKey', key);
      saveApiKeyBtn.textContent = 'Saved!';
      setTimeout(() => { saveApiKeyBtn.textContent = 'Save Key'; }, 2000);
    }
  });

  function addChatMessage(text, role) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  async function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    const apiKey = localStorage.getItem('diaMernaOpenRouterKey');
    if (!apiKey) {
      addChatMessage('Please enter and save your OpenRouter API key first.', 'ai');
      return;
    }

    chatInput.value = '';
    addChatMessage(message, 'user');
    const loadingMsg = addChatMessage('Thinking...', 'ai loading');

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'DiaMerna'
        },
        body: JSON.stringify({
          model: 'nvidia/nemotron-3-super-120b-a12b:free',
          messages: [
            {
              role: 'system',
              content: 'You are DiaMerna, an expert maternal endocrinology assistant specializing in gestational diabetes management and pregnancy wellness. Provide compassionate, evidence-based advice. Always remind users to consult their doctor for personalized medical care. Keep responses concise, practical, and supportive. You can suggest recipe modifications, exercise tips, and blood sugar management strategies.'
            },
            { role: 'user', content: message }
          ],
          max_tokens: 500
        })
      });

      const data = await response.json();
      loadingMsg.remove();

      if (data.error) {
        addChatMessage(`Error: ${data.error.message || 'Something went wrong. Check your API key.'}`, 'ai');
        return;
      }

      const reply = data.choices?.[0]?.message?.content || 'No response received.';
      addChatMessage(reply, 'ai');

    } catch (err) {
      loadingMsg.remove();
      addChatMessage('Network error. Please check your connection and try again.', 'ai');
    }
  }

  sendChatBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

});
