/* Baby Tracker Module */
(function () {
  let week = Store.get('babyWeek', 28)
  const display = document.getElementById('babyWeekDisplay')
  const fruitEmoji = document.getElementById('babyFruit')
  const fruitName = document.getElementById('babyFruitName')
  const weightEl = document.getElementById('babyWeight')
  const lengthEl = document.getElementById('babyLength')
  const progressEl = document.getElementById('babyProgress')

  function renderBaby() {
    const g = babyGrowth(week)
    fruitEmoji.textContent = g.emoji
    fruitName.textContent = g.fruit
    weightEl.textContent = g.g + ' g'
    lengthEl.textContent = g.cm + ' cm'
    display.textContent = week
    const pct = Math.min(100, Math.max(0, ((week - 4) / 38) * 100))
    progressEl.style.width = pct + '%'
    Store.set('babyWeek', week)
  }

  document.getElementById('babyWeekPrev').addEventListener('click', () => {
    if (week > 4) { week--; renderBaby() }
  })
  document.getElementById('babyWeekNext').addEventListener('click', () => {
    if (week < 42) { week++; renderBaby() }
  })

  /* ----- Kick Counter ----- */
  let kickCount = Store.get('kickCount', 0)
  let kickStart = Store.get('kickStart', '')
  const kickEl = document.getElementById('kickCount')
  const kickBar = document.getElementById('kickBar')
  const kickTime = document.getElementById('kickTime')

  function renderKicks() {
    kickEl.textContent = kickCount
    kickBar.style.width = Math.min(100, (kickCount / 10) * 100) + '%'
    kickTime.textContent = kickStart ? 'Started: ' + kickStart : 'Started: --'
    if (kickCount >= 10) { kickTime.textContent += ' ✅ 10 kicks done!' }
  }

  document.getElementById('kickBtn').addEventListener('click', () => {
    if (kickCount === 0) { kickStart = now(); Store.set('kickStart', kickStart) }
    kickCount++
    Store.set('kickCount', kickCount)
    renderKicks()
    const btn = document.getElementById('kickBtn')
    btn.classList.add('kick-pulse')
    setTimeout(() => btn.classList.remove('kick-pulse'), 300)
  })

  document.getElementById('kickReset').addEventListener('click', () => {
    kickCount = 0; kickStart = ''; Store.set('kickCount', 0); Store.set('kickStart', ''); renderKicks()
  })

  /* ----- Pregnancy / Cycle Calculator ----- */
  document.getElementById('cycleBtn').addEventListener('click', () => {
    const lmp = document.getElementById('lmpInput').value
    const cycle = parseInt(document.getElementById('cycleLen').value) || 28
    const isPregnant = document.getElementById('pregMode').checked
    const out = document.getElementById('cycleOut'); out.innerHTML = ''

    if (!lmp) { out.innerHTML = '<div class="empty-state">Please select LMP date</div>'; return }

    Store.set('lmp', lmp); Store.set('cycleLen', cycle)

    if (isPregnant) {
      const pw = pregnancyWeek(lmp)
      out.innerHTML = `
        <div class="stat-row grid-cols-3"><div class="stat-box"><div class="stat-val c-pink">${pw.w}</div><div class="stat-lbl">Weeks</div></div>
        <div class="stat-box"><div class="stat-val c-lav">${pw.d}</div><div class="stat-lbl">Days</div></div>
        <div class="stat-box"><div class="stat-val c-mint">${dueDate(lmp)}</div><div class="stat-lbl">Due</div></div></div>`
      week = Math.max(4, Math.min(42, pw.w)); renderBaby()
    } else {
      const fw = fertileWindow(lmp, cycle)
      out.innerHTML = `
        <div class="stat-row grid-cols-3"><div class="stat-box"><div class="stat-val c-pink">${fw.start}</div><div class="stat-lbl">Fertile Start</div></div>
        <div class="stat-box"><div class="stat-val c-lav">${fw.end}</div><div class="stat-lbl">Fertile End</div></div>
        <div class="stat-box"><div class="stat-val c-mint">${fw.ov}</div><div class="stat-lbl">Ovulation</div></div></div>`
    }
  })

  /* Load saved LMP */
  const savedLmp = Store.get('lmp', '')
  if (savedLmp) { document.getElementById('lmpInput').value = savedLmp }
  const savedCycle = Store.get('cycleLen', 28)
  if (savedCycle) { document.getElementById('cycleLen').value = savedCycle }

  /* ----- Appointments (with date & time) ----- */
  function renderApts() {
    const list = document.getElementById('aptList')
    const apts = Store.get('appointments', [])
    if (!apts.length) { list.innerHTML = '<div class="empty-state">No appointments yet</div>'; return }
    list.innerHTML = apts.map((a, i) => {
      const d = a.date ? new Date(a.date + 'T' + (a.time || '00:00')) : null
      const displayDate = d ? d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : ''
      return `<div class="flex items-center justify-between p-3 rounded-xl" style="background:var(--surface);border:1px solid var(--border);font-size:.85rem">
        <div><strong>${a.text}</strong><br><span class="text-[10px] text-gray-500">${displayDate} ${a.time || ''}</span></div>
        <button class="apt-del-btn text-xs c-warn" data-idx="${i}" style="background:none;border:none;cursor:pointer;font-family:inherit">✕</button>
      </div>`
    }).join('')
  }

  document.getElementById('aptList').addEventListener('click', e => {
    const btn = e.target.closest('.apt-del-btn')
    if (!btn) return
    const idx = parseInt(btn.dataset.idx)
    const apts = Store.get('appointments', [])
    apts.splice(idx, 1)
    Store.set('appointments', apts)
    renderApts()
  })

  document.getElementById('aptAddBtn').addEventListener('click', () => {
    const inp = document.getElementById('aptInput')
    const dp = document.getElementById('aptDate')
    const tp = document.getElementById('aptTime')
    const text = inp.value.trim()
    if (!text) return
    const a = { text, date: dp.value || today(), time: tp.value || '09:00' }
    Store.push('appointments', a)
    inp.value = ''; dp.value = ''; tp.value = ''
    renderApts()
  })
  document.getElementById('aptInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('aptAddBtn').click()
  })

  renderBaby()
  renderKicks()
  renderApts()
  window.renderBaby = renderBaby
})()
