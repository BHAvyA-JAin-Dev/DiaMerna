/* Dashboard Module */
(function () {
  const name = Store.get('userName', '') || 'Mama'
  document.getElementById('dashName').textContent = '🌸 ' + name
  document.getElementById('dashGreeting').addEventListener('dblclick', () => {
    const n = prompt('Your name:', name)
    if (n && n.trim()) { Store.set('userName', n.trim()); document.getElementById('dashName').textContent = '🌸 ' + n.trim() }
  })

  /* Pregnancy week */
  const lmp = Store.get('lmp', '')
  if (lmp) {
    const pw = pregnancyWeek(lmp)
    if (pw.w >= 0 && pw.w <= 42) {
      document.getElementById('dashPregWeek').textContent = `Week ${pw.w} · Day ${pw.d}`
    }
  }

  /* Quick stats grid */
  function renderStats() {
    const grid = document.getElementById('dashStatsGrid')
    const glucose = Store.get('glucose', [])
    const readings = glucose.length
    const lastVal = glucose.length ? glucose[glucose.length - 1].val : '--'

    const g = goalProgress()

    grid.innerHTML = `
      <div class="stat-box"><div class="stat-val c-pink">${lastVal}</div><div class="stat-lbl">🩸 Last</div></div>
      <div class="stat-box"><div class="stat-val c-mint">${readings}</div><div class="stat-lbl">📊 Logs</div></div>
      <div class="stat-box"><div class="stat-val c-lav">${g.pct}%</div><div class="stat-lbl">🎯 Goals</div></div>
    `
  }

  /* Goals */
  function renderGoals() {
    const g = Store.get('goals', {})
    document.querySelectorAll('#dashGoals .chk-item input').forEach(inp => {
      inp.checked = g[inp.value] === today()
      inp.addEventListener('change', () => {
        const gs = Store.get('goals', {})
        gs[inp.value] = inp.checked ? today() : ''
        Store.set('goals', gs)
        updateGoalProgress()
      })
    })
  }

  function updateGoalProgress() {
    const g = goalProgress()
    document.getElementById('dashPct').textContent = g.pct + '%'
    document.getElementById('dashBar').style.width = g.pct + '%'
  }

  /* Weekly Score — real calculation from data */
  function calcWeeklyScore() {
    const glucose = Store.get('glucose', [])
    const stats = timeInRange(glucose)
    const g = goalProgress()
    const glucoseScore = stats.normal || 0
    const goalScore = g.pct
    return Math.min(100, Math.round(glucoseScore * 0.5 + goalScore * 0.3 + (stats.total > 0 ? 20 : 0)))
  }

  /* AI-powered weekly insight (async, real API) */
  async function renderWeeklyScore() {
    const glucose = Store.get('glucose', [])
    const stats = timeInRange(glucose)
    const g = goalProgress()
    const score = calcWeeklyScore()
    document.getElementById('dashScore').innerHTML = `<div class="text-2xl font-black c-pink">${score}</div><div class="text-[9px] text-gray-500">WEEKLY</div>`

    const aiEl = document.getElementById('dashAIInsight')
    if (stats.total < 3) { aiEl.innerHTML = '📈 <span class="text-gray-500">Log more data to get AI-powered personalized insights.</span>'; return }

    aiEl.innerHTML = '🤖 <span class="text-gray-500">Analyzing your data...</span>'
    try {
      const sleepLogs = Store.get('sleepLogs', []).slice(-7)
      const avgSleep = sleepLogs.length ? (sleepLogs.reduce((s, l) => s + l.sleep, 0) / sleepLogs.length).toFixed(1) : '--'
      const medState = Store.get('medState', {})
      const todayKey = today()
      let takenCount = 0
      Object.entries(medState).forEach(([k, v]) => { if (k.startsWith(todayKey) && v === 'taken') takenCount++ })
      const hydrated = Store.get('hydrated', 0)

      const prompt = `You are a gestational diabetes AI coach. Given this user's daily data, give ONE short paragraph (2-3 sentences) of actionable, encouraging advice. Be specific and personalized. Data: Glucose readings: ${stats.total} total, avg ${stats.avg} mg/dL, ${stats.normal}% in range (70-140), ${stats.high}% high, ${stats.low}% low. Goals completed: ${g.pct}%. Sleep avg: ${avgSleep}/5. Meds taken: ${takenCount}/${MEDICATIONS.length}. Water: ${hydrated}L/2.5L. Address as "you". Keep warm and concise.`
      const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
        body: JSON.stringify({ model: API_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 150 })
      })
      const data = await res.json()
      aiEl.innerHTML = '📊 ' + (data.choices?.[0]?.message?.content?.trim() || 'Keep tracking your daily goals and glucose — consistency is key!')
    } catch {
      aiEl.innerHTML = '📊 Keep tracking your daily goals and glucose — consistency is key!'
    }
  }

  renderStats()
  renderGoals()
  updateGoalProgress()
  renderWeeklyScore()

  /* Rerender on glucose/goal changes */
  document.addEventListener('glucoseLogged', renderStats)
  document.addEventListener('goalChanged', updateGoalProgress)
})()
