/* Sidebar Navigation Module */
(function () {
  const menuBtn = document.getElementById('menuBtn')
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('sidebarOverlay')
  const closeBtn = document.getElementById('sidebarClose')

  function openSidebar() {
    sidebar.classList.add('open')
    overlay.classList.add('open')
    document.body.style.overflow = 'hidden'
  }

  function closeSidebar() {
    sidebar.classList.remove('open')
    overlay.classList.remove('open')
    document.body.style.overflow = ''
  }

  menuBtn.addEventListener('click', openSidebar)
  closeBtn.addEventListener('click', closeSidebar)
  overlay.addEventListener('click', closeSidebar)

  /* Update sidebar user info */
  function updateSidebarUser() {
    const name = Store.get('userName', '') || 'Priya'
    document.getElementById('sidebarName').textContent = name
    const lmp = Store.get('lmp', '')
    if (lmp) {
      const pw = pregnancyWeek(lmp)
      if (pw.w >= 0 && pw.w <= 42) {
        document.getElementById('sidebarPreg').textContent = `Week ${pw.w} · Day ${pw.d} · Pregnancy`
      }
    }
  }
  updateSidebarUser()

  /* Sidebar item navigation — close after any click, switchTab handled by swipe-nav */
  document.getElementById('sidebarNav').addEventListener('click', e => {
    const item = e.target.closest('.sidebar-item')
    if (item) closeSidebar()
  })

  /* Special sidebar actions */
  document.getElementById('sidebarTheme').addEventListener('click', () => {
    document.getElementById('themeBtn')?.click()
  })

  document.getElementById('sidebarCloudBtn').addEventListener('click', () => {
    closeSidebar()
    const overlay = document.getElementById('authOverlay')
    if (overlay) { overlay.style.display = 'flex'; document.getElementById('authMsg').textContent = '' }
  })

  document.getElementById('sidebarEditName').addEventListener('click', () => {
    closeSidebar()
    setTimeout(() => {
      const n = prompt('Your name:', Store.get('userName', '') || 'Priya')
      if (n && n.trim()) {
        Store.set('userName', n.trim())
        document.querySelectorAll('[id^="dashName"], #sidebarName').forEach(el => {
          if (el.id === 'sidebarName') el.textContent = n.trim()
          else el.textContent = '🌸 ' + n.trim()
        })
      }
    }, 350)
  })

  document.getElementById('sidebarClearData').addEventListener('click', () => {
    if (confirm('Clear ALL stored data? This cannot be undone.')) {
      localStorage.clear()
      closeSidebar()
      setTimeout(() => location.reload(), 300)
    }
  })
})()
