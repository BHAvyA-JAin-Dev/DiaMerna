/* Section Navigation (swipe + sidebar switch) */
(function () {
  const sections = ['home', 'glucose', 'baby', 'health', 'more', 'chat']
  let xStart = 0, xEnd = 0

  const main = document.getElementById('app')

  main.addEventListener('touchstart', e => { xStart = e.changedTouches[0].screenX }, { passive: true })
  main.addEventListener('touchend', e => {
    xEnd = e.changedTouches[0].screenX
    const diff = xStart - xEnd
    if (Math.abs(diff) < 50) return
    const active = document.querySelector('.section.active')
    if (!active) return
    const idx = sections.indexOf(active.dataset.tab)
    if (idx === -1) return
    let nextIdx
    if (diff > 0 && idx < sections.length - 1) nextIdx = idx + 1
    else if (diff < 0 && idx > 0) nextIdx = idx - 1
    else return
    switchTab(sections[nextIdx])
  }, { passive: true })

  window.switchTab = function (tab, scrollId) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'))
    const tc = document.querySelector(`.section[data-tab="${tab}"]`)
    if (tc) tc.classList.add('active')
    if (scrollId) {
      const target = document.getElementById(scrollId)
      if (target) {
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      }
    }
  }

  /* Sidebar links use data-tab to switch sections */
  document.addEventListener('click', e => {
    const item = e.target.closest('.sidebar-item[data-tab]')
    if (item) {
      const tab = item.dataset.tab
      if (tab && sections.includes(tab)) {
        switchTab(tab, item.dataset.scroll)
      }
    }
  })
})()
