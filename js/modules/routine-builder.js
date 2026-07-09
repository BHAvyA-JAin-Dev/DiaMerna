/* ===== DiaMerna — Daily Health Routine Module ===== */

const DiaMerna = window.DiaMerna || {};

DiaMerna.RoutineBuilder = (() => {

  const C = DiaMerna.CONSTANTS;
  const Storage = DiaMerna.Storage;
  const Helpers = DiaMerna.Helpers;

  // ===== POST-MEAL TIMER =====
  function createTimer() {
    let interval = null;
    let seconds = C.TIMER.DURATION_SECONDS;
    let isRunning = false;

    const display = document.getElementById('timerDisplay');
    const startBtn = document.getElementById('startTimerBtn');
    const resetBtn = document.getElementById('resetTimerBtn');

    function updateDisplay() {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      isRunning = false;
      startBtn.textContent = 'Start';
    }

    function start() {
      if (isRunning) { stop(); return; }
      if (seconds <= 0) {
        seconds = C.TIMER.DURATION_SECONDS;
        updateDisplay();
      }
      isRunning = true;
      startBtn.textContent = 'Pause';
      interval = setInterval(() => {
        seconds--;
        updateDisplay();
        if (seconds <= 0) {
          stop();
          startBtn.textContent = 'Done! 🎉';
          display.classList.add('text-cyber-warn');
          setTimeout(() => {
            display.classList.remove('text-cyber-warn');
            startBtn.textContent = 'Start';
          }, 3000);
        }
      }, C.TIMER.INTERVAL_MS);
    }

    function reset() {
      stop();
      seconds = C.TIMER.DURATION_SECONDS;
      updateDisplay();
      startBtn.textContent = 'Start';
    }

    startBtn.addEventListener('click', start);
    resetBtn.addEventListener('click', reset);

    updateDisplay();
    return { start, stop, reset, getSeconds: () => seconds };
  }

  // ===== HYDRATION TRACKER =====
  function createHydrationTracker() {
    const countDisplay = document.getElementById('hydrationCount');
    const cupsContainer = document.getElementById('hydrationCups');
    const goal = C.HYDRATION.DAILY_GOAL;

    function getCount() {
      return parseInt(Storage.get(C.HYDRATION.STORAGE_KEY) || '0');
    }

    function setCount(count) {
      Storage.set(C.HYDRATION.STORAGE_KEY, Math.min(Math.max(0, count), goal));
    }

    function resetDaily() {
      const today = new Date().toDateString();
      const lastDate = Storage.get('hydrationDate');
      if (lastDate !== today) {
        setCount(0);
        Storage.set('hydrationDate', today);
      }
    }

    function render() {
      resetDaily();
      const count = getCount();
      countDisplay.textContent = count;

      cupsContainer.innerHTML = '';
      for (let i = 0; i < goal; i++) {
        const cup = document.createElement('div');
        cup.className = `hydration-cup ${i < count ? 'filled' : ''} ${i === count && count < goal ? 'cursor-pointer' : ''}`;
        cup.title = i < count ? 'Filled — tap to remove' : 'Tap to fill';

        cup.addEventListener('click', () => {
          const current = getCount();
          if (i < current) {
            setCount(current - 1);
          } else if (i === current) {
            setCount(current + 1);
          }
          render();
        });

        cupsContainer.appendChild(cup);
      }
    }

    render();
    return { render, getCount, setCount };
  }

  // ===== DAILY CHECKLIST =====
  function createChecklist() {
    const container = document.getElementById('dailyChecklist');
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');

    const defaultItems = [
      { label: 'Low-carb breakfast (before 10am)', key: 'task_breakfast' },
      { label: '8 glasses of water', key: 'task_water' },
      { label: 'Prenatal vitamins taken', key: 'task_vitamins' },
      { label: '30-min walk completed', key: 'task_walk' },
      { label: 'Blood sugar logged 3x today', key: 'task_glucose_log' },
      { label: 'Meal plan reviewed', key: 'task_meal_plan' },
      { label: 'Restful break (15+ min)', key: 'task_rest' }
    ];

    function getTodayKey() {
      return new Date().toDateString();
    }

    function loadState() {
      const today = getTodayKey();
      const saved = Storage.get('checklist_' + today) || {};
      return saved;
    }

    function saveState(state) {
      const today = getTodayKey();
      Storage.set('checklist_' + today, state);
    }

    function updateProgress() {
      const state = loadState();
      const items = container.querySelectorAll('.check-item');
      const checked = items.length ? Object.values(state).filter(Boolean).length : 0;
      const total = items.length;

      const existing = container.querySelector('.checklist-progress');
      if (existing) existing.remove();

      const progress = document.createElement('div');
      progress.className = 'checklist-progress text-xs text-gray-400 mt-2 text-center';
      progress.textContent = `${checked}/${total} completed`;
      container.appendChild(progress);
    }

    checkboxes.forEach((cb, index) => {
      const label = defaultItems[index]?.label || `Task ${index + 1}`;
      const key = defaultItems[index]?.key || `task_${index}`;
      const state = loadState();
      cb.checked = !!state[key];
      const span = cb.nextElementSibling;
      if (span) span.textContent = label;

      cb.addEventListener('change', () => {
        const state = loadState();
        state[key] = cb.checked;
        saveState(state);
        updateProgress();
      });
    });

    updateProgress();
  }

  // ===== STATS SUMMARY =====
  function renderDailyStats() {
    const glucoseLogs = DiaMerna.GlucoseLogger?.getLogs() || [];
    const meals = DiaMerna.MealAnalyzer?.getMealHistory() || [];
    const hydrationCount = Storage.get('hydration') || 0;

    const today = new Date().toDateString();
    const todayGlucose = glucoseLogs.filter(l => {
      const d = new Date(l.timestamp || l.date);
      return d.toDateString() === today;
    });
    const todayMeals = meals.filter(m => {
      const d = new Date(m.timestamp || m.date);
      return d.toDateString() === today;
    });

    const statsContainer = document.getElementById('dailyStats');
    if (!statsContainer) return;

    statsContainer.innerHTML = `
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="p-2 rounded-lg bg-cyber-bg/40">
          <div class="text-lg font-bold text-cyber-pink">${todayGlucose.length}</div>
          <div class="text-[10px] text-gray-400">Readings</div>
        </div>
        <div class="p-2 rounded-lg bg-cyber-bg/40">
          <div class="text-lg font-bold text-cyber-mint">${todayMeals.length}</div>
          <div class="text-[10px] text-gray-400">Meals</div>
        </div>
        <div class="p-2 rounded-lg bg-cyber-bg/40">
          <div class="text-lg font-bold text-cyber-lavender">${hydrationCount}/8</div>
          <div class="text-[10px] text-gray-400">Water</div>
        </div>
      </div>
    `;
  }

  function init() {
    createTimer();
    createHydrationTracker();
    createChecklist();

    const statsDiv = document.createElement('div');
    statsDiv.id = 'dailyStats';
    statsDiv.className = 'glass-panel p-4 mb-4';
    const routineSection = document.getElementById('tab-routine');
    if (routineSection) {
      routineSection.insertBefore(statsDiv, routineSection.firstChild);
    }
    renderDailyStats();

    document.addEventListener('glucoseLogged', renderDailyStats);
    document.addEventListener('mealLogged', renderDailyStats);
  }

  return { init, createTimer, createHydrationTracker, createChecklist, renderDailyStats };
})();

window.DiaMerna = DiaMerna;
