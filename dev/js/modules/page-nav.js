/* Page Navigation Module — replaces swipe-nav.js */
(function () {
  /* Hash scroll: On page load, scroll to hash element if present */
  if (location.hash) {
    const id = location.hash.replace('#', '')
    const target = document.getElementById(id)
    if (target) {
      setTimeout(function () {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
    }
  }
})()
