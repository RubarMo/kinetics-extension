let updateInterval;

document.addEventListener('DOMContentLoaded', async () => {
  const elements = {
    startDayBtn: document.getElementById('start-day-btn'),
    endDayBtn: document.getElementById('end-day-btn'),
    sessionControls: document.getElementById('session-controls'),
    startSessionBtn: document.getElementById('start-session-btn'),
    stopSessionBtn: document.getElementById('stop-session-btn'),
    activeView: document.getElementById('active-view'),
    statsView: document.getElementById('stats-view'),
    macroTime: document.getElementById('macro-time'),
    postureState: document.getElementById('posture-state'),
    microTime: document.getElementById('micro-time'),
    statSessions: document.getElementById('stat-sessions'),
    statSit: document.getElementById('stat-sit'),
    statStand: document.getElementById('stat-stand'),
    statMove: document.getElementById('stat-move'),
    resetDayBtn: document.getElementById('reset-day-btn')
  };

  async function updateUI() {
    const data = await chrome.storage.local.get(null);
    
    // Day controls
    if (data.dayActive) {
      elements.startDayBtn.classList.add('hidden');
      elements.endDayBtn.classList.remove('hidden');
      elements.sessionControls.classList.remove('hidden');
      elements.statsView.classList.add('hidden');
    } else {
      elements.startDayBtn.classList.remove('hidden');
      elements.endDayBtn.classList.add('hidden');
      elements.sessionControls.classList.add('hidden');
      if (data.stats && (data.stats.totalSessions > 0 || data.stats.totalSitMins > 0 || data.stats.totalStandMins > 0 || data.stats.totalMoveMins > 0)) {
        elements.statsView.classList.remove('hidden');
        elements.statSessions.innerText = data.stats.totalSessions;
        elements.statSit.innerText = data.stats.totalSitMins;
        elements.statStand.innerText = data.stats.totalStandMins;
        elements.statMove.innerText = data.stats.totalMoveMins;
      } else {
        elements.statsView.classList.add('hidden');
      }
    }

    // Session controls
    if (data.sessionActive) {
      elements.startSessionBtn.classList.add('hidden');
      elements.stopSessionBtn.classList.remove('hidden');
      elements.activeView.classList.remove('hidden');
      updateTimers(data);
      if (!updateInterval) {
        updateInterval = setInterval(async () => {
          const freshData = await chrome.storage.local.get(null);
          if (freshData.sessionActive) {
            updateTimers(freshData);
          } else {
            clearInterval(updateInterval);
            updateInterval = null;
            updateUI();
          }
        }, 1000);
      }
    } else {
      elements.startSessionBtn.classList.remove('hidden');
      elements.stopSessionBtn.classList.add('hidden');
      elements.activeView.classList.add('hidden');
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
    }
  }

  function updateTimers(data) {
    if (!data.sessionActive) return;

    const now = Date.now();
    const sessionElapsed = Math.floor((now - data.sessionStartTime) / 1000);
    let sessionRemaining = (90 * 60) - sessionElapsed;
    if (sessionRemaining < 0) sessionRemaining = 0;

    const postureElapsed = Math.floor((now - data.postureStartTime) / 1000);
    let postureRemaining = (data.postureDurationMins * 60) - postureElapsed;
    if (postureRemaining < 0) postureRemaining = 0;

    elements.macroTime.innerText = formatTime(sessionRemaining);
    elements.microTime.innerText = formatTime(postureRemaining);
    
    const states = {
      'sitting': 'Sitting',
      'standing': 'Standing',
      'moving': 'Moving'
    };
    elements.postureState.innerText = states[data.currentPosture] || 'Unknown';
    
    // Set colors
    const colors = {
      'sitting': '#38bdf8',
      'standing': '#10b981',
      'moving': '#f59e0b'
    };
    elements.microTime.style.color = colors[data.currentPosture] || '#38bdf8';
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  elements.startDayBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({
      dayActive: true,
      stats: { totalSessions: 0, totalSitMins: 0, totalStandMins: 0, totalMoveMins: 0 }
    });
    updateUI();
  });

  elements.endDayBtn.addEventListener('click', async () => {
    if (updateInterval) clearInterval(updateInterval);
    await chrome.alarms.clearAll();
    await chrome.storage.local.set({
      dayActive: false,
      sessionActive: false
    });
    updateUI();
  });

  elements.startSessionBtn.addEventListener('click', async () => {
    const now = Date.now();
    await chrome.storage.local.set({
      sessionActive: true,
      sessionStartTime: now,
      currentPosture: 'sitting',
      postureStartTime: now,
      postureDurationMins: 20,
      cycleCount: 0
    });
    chrome.alarms.create('postureTransition', { delayInMinutes: 20 });
    updateUI();
  });

  elements.stopSessionBtn.addEventListener('click', async () => {
    await chrome.alarms.clear('postureTransition');
    await chrome.storage.local.set({
      sessionActive: false
    });
    updateUI();
  });

  elements.resetDayBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({
      stats: { totalSessions: 0, totalSitMins: 0, totalStandMins: 0, totalMoveMins: 0 }
    });
    updateUI();
  });

  // Initial load
  updateUI();
});
