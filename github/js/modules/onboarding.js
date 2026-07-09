/* Onboarding Module — first-run setup */
(function () {
  const overlay = document.getElementById('onboardingOverlay')
  const btn = document.getElementById('onStartBtn')

  /* If already onboarded, hide overlay immediately */
  if (Store.get('onboarded', false)) {
    overlay.classList.add('done')
    overlay.style.display = 'none'
    return
  }

  btn.addEventListener('click', () => {
    const name = document.getElementById('onName').value.trim() || 'Mama'
    const dob = document.getElementById('onDob').value
    const lmp = document.getElementById('onLmp').value
    const isPregnant = document.getElementById('onPreg').checked
    const cycle = parseInt(document.getElementById('onCycle').value) || 28
    const goal = document.getElementById('onGoal').value

    Store.set('userName', name)
    Store.set('goal', goal)
    Store.set('dob', dob)
    const prof = Store.get('profile', {})
    prof.name = name; prof.dob = dob; prof.lmp = lmp; prof.isPregnant = isPregnant
    Store.set('profile', prof)

    if (lmp) {
      Store.set('lmp', lmp)
      Store.set('cycleLen', cycle)
      if (isPregnant) {
        const pw = pregnancyWeek(lmp)
        Store.set('pregnant', true)
        Store.set('pregWeek', pw.w)
        /* Auto-set baby week to current pregnancy week */
        Store.set('babyWeek', Math.max(4, Math.min(42, pw.w)))
      }
    }

    Store.set('onboarded', true)

    /* Set today's hydration date so it resets properly */
    Store.set('hydDate', today())

    /* Close onboarding */
    overlay.classList.add('done')
    setTimeout(() => { overlay.style.display = 'none' }, 500)

    /* Update UI across modules */
    const dashName = document.getElementById('dashName')
    if (dashName) dashName.textContent = '🌸 ' + name

    const sidebarName = document.getElementById('sidebarName')
    if (sidebarName) sidebarName.textContent = name

    if (lmp && isPregnant) {
      const pw = pregnancyWeek(lmp)
      const pregEl = document.getElementById('dashPregWeek')
      if (pregEl) pregEl.textContent = `Week ${pw.w} · Day ${pw.d} · Pregnancy`
      const sidePreg = document.getElementById('sidebarPreg')
      if (sidePreg) sidePreg.textContent = `Week ${pw.w} · Day ${pw.d} · Pregnancy`
    }

    /* Re-render modules that depend on this data */
    if (typeof window.renderBaby === 'function') setTimeout(window.renderBaby, 100)
    if (typeof window.renderGlucose === 'function') setTimeout(window.renderGlucose, 100)
    if (typeof window.renderHealth === 'function') setTimeout(window.renderHealth, 100)
  })
})()
