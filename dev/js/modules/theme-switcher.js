/* Theme Switcher */
(function () {
  const btn = document.getElementById('themeBtn')
  const html = document.documentElement
  const saved = Store.get('theme', 'dark')
  html.setAttribute('data-theme', saved)
  btn.textContent = saved === 'dark' ? '☀️' : '🌙'

  btn.addEventListener('click', () => {
    const cur = html.getAttribute('data-theme')
    const next = cur === 'dark' ? 'light' : 'dark'
    html.setAttribute('data-theme', next)
    Store.set('theme', next)
    btn.textContent = next === 'dark' ? '☀️' : '🌙'
  })
})()
