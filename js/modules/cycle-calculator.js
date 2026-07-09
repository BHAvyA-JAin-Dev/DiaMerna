/* ===== DiaMerna — Cycle & Pregnancy Calculator Module ===== */

const DiaMerna = window.DiaMerna || {};

DiaMerna.CycleCalculator = (() => {

  const C = DiaMerna.CONSTANTS.CYCLE;
  const Helpers = DiaMerna.Helpers;

  function validateLMP(dateStr) {
    if (!dateStr) return { valid: false, error: 'Please select a date.' };
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return { valid: false, error: 'Invalid date format.' };
    if (date > new Date()) return { valid: false, error: 'LMP cannot be in the future.' };
    return { valid: true, date };
  }

  function calculateCycle(lmp, cycleLength) {
    const length = cycleLength || C.DEFAULT_LENGTH;
    const ovulationDay = C.OVULATION_DAY;
    const fertileStartDay = C.FERTILE_WINDOW_START;
    const fertileEndDay = C.FERTILE_WINDOW_END;

    const nextPeriod = Helpers.addDays(lmp, length);
    const ovulationDate = Helpers.addDays(lmp, ovulationDay);
    const fertileStart = Helpers.addDays(lmp, fertileStartDay);
    const fertileEnd = Helpers.addDays(lmp, fertileEndDay);
    const safeStart = Helpers.addDays(lmp, fertileEndDay + 1);
    const safeEnd = Helpers.addDays(lmp, length - 1);

    const cycleDay = Helpers.daysBetween(lmp, new Date()) % length + 1;
    const daysUntilNextPeriod = Math.max(0, Helpers.daysBetween(new Date(), nextPeriod));

    let phase = '';
    if (cycleDay <= 5) phase = 'Menstrual Phase';
    else if (cycleDay < fertileStartDay) phase = 'Follicular Phase';
    else if (cycleDay <= fertileEndDay) phase = 'Fertile Window ⬆️';
    else if (cycleDay <= ovulationDay) phase = 'Ovulation Day 🟣';
    else phase = 'Luteal Phase';

    return {
      nextPeriod,
      ovulationDate,
      fertileStart,
      fertileEnd,
      safeStart,
      safeEnd,
      cycleDay,
      daysUntilNextPeriod,
      phase,
      cycleLength: length
    };
  }

  function calculatePregnancy(lmp) {
    const now = new Date();
    const daysSinceLmp = Helpers.daysBetween(lmp, now);

    if (daysSinceLmp < 0) return null;

    const pregnancyWeeks = Math.floor(daysSinceLmp / 7);
    const pregnancyDays = daysSinceLmp % 7;
    const dueDate = Helpers.getDueDate(lmp);
    const daysUntilDue = Math.max(0, Helpers.daysBetween(now, dueDate));
    const weeksUntilDue = Math.floor(daysUntilDue / 7);
    const daysUntilDueRemainder = daysUntilDue % 7;
    const trimester = Helpers.getTrimester(pregnancyWeeks + 1);
    const progressPercent = Math.min(100, Math.round((daysSinceLmp / 280) * 100));

    return {
      pregnancyWeeks,
      pregnancyDays,
      dueDate,
      daysUntilDue,
      weeksUntilDue,
      daysUntilDueRemainder,
      trimester,
      daysSinceLmp,
      progressPercent,
      isPostTerm: pregnancyWeeks >= 42
    };
  }

  function getMetabolicTargets(week) {
    const targets = [
      { icon: '🩸', label: 'Fasting glucose', target: '< 95 mg/dL' },
      { icon: '🍽️', label: '1-Hr post-meal', target: '< 140 mg/dL' },
      { icon: '🥗', label: '2-Hr post-meal', target: '< 120 mg/dL' },
      { icon: '💧', label: 'Hydration', target: '8-10 glasses/day' },
      { icon: '🏃‍♀️', label: 'Exercise', target: '20-30 min walk daily' },
      { icon: '💊', label: 'Prenatal vitamins', target: 'Daily' }
    ];

    if (week >= 24 && week <= 28) {
      targets.push({ icon: '🔬', label: 'Glucose tolerance test', target: 'Scheduled' });
    }
    if (week >= 36) {
      targets.push({ icon: '🔄', label: 'Fetal movement count', target: '10 kicks/2 hrs' });
    }

    return targets;
  }

  function renderPregnancyResults(lmp, container) {
    const preg = calculatePregnancy(lmp);
    if (!preg) {
      container.innerHTML = '<p class="text-gray-400">Unable to calculate. Please check your LMP date.</p>';
      return;
    }

    let trimesterColor = 'text-white';
    if (preg.trimester) {
      if (preg.trimester.label.includes('First')) trimesterColor = 'text-cyber-pink';
      else if (preg.trimester.label.includes('Second')) trimesterColor = 'text-cyber-lavender';
      else if (preg.trimester.label.includes('Third')) trimesterColor = 'text-cyber-mint';
    }

    const weekLabel = preg.isPostTerm
      ? `<span class="text-cyber-warn font-bold">${preg.pregnancyWeeks} weeks (Post-Term — consult your doctor)</span>`
      : `<span class="text-lg font-bold" style="color:${preg.trimester ? preg.trimester.color : '#fff'}">Week ${preg.pregnancyWeeks} · Day ${preg.pregnancyDays}</span>`;

    const targets = getMetabolicTargets(preg.pregnancyWeeks);
    const targetsHtml = targets.map(t =>
      `<li class="flex items-center gap-2 text-xs text-gray-300"><span>${t.icon}</span><span>${t.label}: <strong class="text-white">${t.target}</strong></span></li>`
    ).join('');

    container.innerHTML = `
      <div class="flex items-center gap-2 mb-3">
        <span class="result-badge pregnant">🤰 Pregnant</span>
        ${weekLabel}
      </div>
      <p class="text-xs ${trimesterColor} font-semibold mb-1">${preg.trimester ? preg.trimester.label : ''}</p>

      <div class="w-full h-2 rounded-full bg-cyber-bg/50 mb-3 overflow-hidden">
        <div class="h-full rounded-full transition-all" style="width:${preg.progressPercent}%;background:linear-gradient(90deg,#ff6b9d,#b388ff,#69f0ae)"></div>
      </div>
      <p class="text-[10px] text-gray-500 mb-3">${preg.progressPercent}% of pregnancy complete</p>

      <div class="grid grid-cols-2 gap-2 mb-3">
        <div class="p-2 rounded-lg bg-cyber-bg/40">
          <div class="text-xs text-gray-400">Due Date</div>
          <div class="text-sm font-semibold text-white">${Helpers.formatDate(preg.dueDate)}</div>
        </div>
        <div class="p-2 rounded-lg bg-cyber-bg/40">
          <div class="text-xs text-gray-400">Time Left</div>
          <div class="text-sm font-semibold text-cyber-mint">${preg.weeksUntilDue}w ${preg.daysUntilDueRemainder}d</div>
        </div>
      </div>

      <div class="p-3 rounded-xl bg-cyber-bg/50">
        <p class="text-xs font-semibold text-cyber-pink mb-2">🎯 Metabolic Targets for Week ${preg.pregnancyWeeks}</p>
        <ul class="space-y-1">${targetsHtml}</ul>
      </div>

      <p class="text-[10px] text-gray-500 mt-3">⚠️ These are general guidelines. Always consult your healthcare provider for personalized advice.</p>
    `;
  }

  function renderCycleResults(lmp, cycleLength, container) {
    const result = calculateCycle(lmp, cycleLength);

    const now = new Date();
    const daysUntilOvulation = Math.max(0, Helpers.daysBetween(now, result.ovulationDate));
    const isInFertileWindow = now >= result.fertileStart && now <= result.fertileEnd;

    container.innerHTML = `
      <div class="grid grid-cols-2 gap-2 mb-3">
        <div class="p-2 rounded-lg bg-cyber-bg/40">
          <div class="text-xs text-gray-400">Cycle Day</div>
          <div class="text-lg font-bold text-white">${result.cycleDay}</div>
        </div>
        <div class="p-2 rounded-lg bg-cyber-bg/40">
          <div class="text-xs text-gray-400">Phase</div>
          <div class="text-sm font-semibold ${result.phase.includes('Fertile') || result.phase.includes('Ovulation') ? 'text-cyber-pink' : 'text-cyber-lavender'}">${result.phase}</div>
        </div>
      </div>

      <div class="space-y-2">
        <p><span class="result-badge period">📍 Next Period</span> <span class="text-sm">${Helpers.formatDate(result.nextPeriod)}</span>
          ${result.daysUntilNextPeriod > 0 ? `<span class="text-xs text-gray-500 ml-2">(${result.daysUntilNextPeriod} days)</span>` : ''}
        </p>
        <p><span class="result-badge ovulation">🟣 Ovulation</span> <span class="text-sm">${Helpers.formatDate(result.ovulationDate)}</span>
          ${daysUntilOvulation > 0 ? `<span class="text-xs text-gray-500 ml-2">(${daysUntilOvulation} days away)</span>` : ''}
        </p>
        <p><span class="result-badge fertile">🌸 Fertile Window</span> <span class="text-sm">${Helpers.formatDate(result.fertileStart)} – ${Helpers.formatDate(result.fertileEnd)}</span>
          ${isInFertileWindow ? '<span class="text-xs text-cyber-pink ml-2 font-semibold">⬆️ You are in your fertile window!</span>' : ''}
        </p>
        <p><span class="result-badge" style="background:rgba(105,240,174,0.15);color:#69f0ae">✅ Safe Window</span> <span class="text-sm">${Helpers.formatDate(result.safeStart)} – ${Helpers.formatDate(result.safeEnd)}</span></p>
      </div>

      <div class="mt-3 p-3 rounded-xl bg-cyber-bg/50">
        <p class="text-xs text-gray-400">
          Based on a <strong class="text-white">${result.cycleLength}-day cycle</strong> starting ${Helpers.formatDate(lmp)}.
          Cycle length and ovulation day can vary. Track consistently for personalized predictions.
        </p>
      </div>
    `;
  }

  function init() {
    const lmpInput = document.getElementById('lmpInput');
    const pregnancyCheck = document.getElementById('pregnancyMode');
    const cycleLengthInput = document.getElementById('cycleLength');
    const calculateBtn = document.getElementById('calculateCycleBtn');
    const resultsDiv = document.getElementById('cycleResults');
    const outputDiv = document.getElementById('cycleOutput');

    calculateBtn.addEventListener('click', () => {
      const validation = validateLMP(lmpInput.value);
      if (!validation.valid) {
        resultsDiv.classList.remove('hidden');
        outputDiv.innerHTML = `<p class="text-cyber-warn text-sm">${validation.error}</p>`;
        return;
      }

      const isPregnant = pregnancyCheck.checked;
      resultsDiv.classList.remove('hidden');

      if (isPregnant) {
        renderPregnancyResults(validation.date, outputDiv);
      } else {
        const cycleLen = parseInt(cycleLengthInput.value) || C.DEFAULT_LENGTH;
        renderCycleResults(validation.date, cycleLen, outputDiv);
      }
    });

    pregnancyCheck.addEventListener('change', () => {
      if (pregnancyCheck.checked) {
        cycleLengthInput.disabled = true;
        cycleLengthInput.classList.add('opacity-40');
      } else {
        cycleLengthInput.disabled = false;
        cycleLengthInput.classList.remove('opacity-40');
      }
    });

    const defaultLmp = new Date();
    defaultLmp.setDate(defaultLmp.getDate() - 28);
    lmpInput.value = defaultLmp.toISOString().split('T')[0];
  }

  return { init, calculateCycle, calculatePregnancy, validateLMP, getMetabolicTargets };
})();

window.DiaMerna = DiaMerna;
