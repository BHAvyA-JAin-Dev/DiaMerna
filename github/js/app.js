/* DiaMerna App Bootstrap */
(function () {
  /* Add med progress bar after medPct */
  const medPct = document.getElementById('medPct')
  if (medPct) {
    let bar = document.querySelector('.med-pct-bar')
    if (!bar) {
      bar = document.createElement('div')
      bar.className = 'med-pct-bar mt-2'
      const fill = document.createElement('div')
      fill.className = 'med-pct-fill'
      bar.appendChild(fill)
      medPct.after(bar)
    }
  }

  /* Patch Store.push to trigger re-renders across all modules */
  const origPush = Store.push
  Store.push = function (k, item) {
    origPush.call(this, k, item)
    if (k === 'glucose') {
      if (typeof window.renderGlucose === 'function') setTimeout(window.renderGlucose, 50)
      document.dispatchEvent(new CustomEvent('glucoseLogged'))
    }
    if (k === 'sleepLogs') {
      document.dispatchEvent(new CustomEvent('sleepLogged'))
    }
    if (k === 'calHistory') {
      document.dispatchEvent(new CustomEvent('calLogged'))
    }
  }

  console.log('🌸 DiaMerna v2 loaded — all features real and AI-powered')
})()
