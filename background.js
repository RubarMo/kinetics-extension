chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.clearAll();
  chrome.storage.local.set({
    dayActive: false,
    sessionActive: false,
    currentPosture: null,
    cycleCount: 0,
    postureStartTime: null,
    postureDurationMins: null,
    stats: { totalSessions: 0, totalSitMins: 0, totalStandMins: 0, totalMoveMins: 0 }
  });
});

function isValidTab(tab) {
  return tab && tab.url &&
    !tab.url.startsWith('chrome://') &&
    !tab.url.startsWith('edge://') &&
    !tab.url.startsWith('about:');
}

async function injectInto(tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return true;
  } catch (e) {
    console.error("Kinetics: injectInto failed", e);
    return false;
  }
}

async function notifyTab(message) {
  try {
    // Try active tabs in current window first
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    for (const tab of activeTabs) {
      if (!isValidTab(tab)) continue;
      // Inject scripts fresh every time (proven working approach)
      if (await injectInto(tab.id)) {
        chrome.tabs.sendMessage(tab.id, { action: "showNotification", message: message }).catch(() => {});
        return;
      }
    }

    // Try all windows
    const allTabs = await chrome.tabs.query({ active: true });
    for (const tab of allTabs) {
      if (!isValidTab(tab)) continue;
      if (await injectInto(tab.id)) {
        chrome.tabs.sendMessage(tab.id, { action: "showNotification", message: message }).catch(() => {});
        return;
      }
    }

    // Last resort
    chrome.tabs.create({ url: `fallback.html?msg=${encodeURIComponent(message)}` });
  } catch (err) {
    console.error("Kinetics: notifyTab error", err);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'postureTransition') return;

  const data = await chrome.storage.local.get(['sessionActive', 'currentPosture', 'cycleCount', 'stats', 'settings']);
  if (!data.sessionActive) {
    await chrome.alarms.clear('postureTransition');
    return;
  }

  const settings = data.settings || { sitMins: 20, standMins: 8, moveMins: 2, sessionCycles: 3 };
  let nextPosture = '';
  let nextDuration = 0;
  let cycleCount = data.cycleCount || 0;
  const stats = data.stats || { totalSessions: 0, totalSitMins: 0, totalStandMins: 0, totalMoveMins: 0 };
  let message = '';

  if (data.currentPosture === 'sitting') {
    stats.totalSitMins += settings.sitMins;
    nextPosture = 'standing';
    nextDuration = settings.standMins;
    message = "Time to Stand!";
  } else if (data.currentPosture === 'standing') {
    stats.totalStandMins += settings.standMins;
    nextPosture = 'moving';
    nextDuration = settings.moveMins;
    message = "Time to Move!";
  } else if (data.currentPosture === 'moving') {
    stats.totalMoveMins += settings.moveMins;
    cycleCount++;
    if (cycleCount < settings.sessionCycles) {
      nextPosture = 'sitting';
      nextDuration = settings.sitMins;
      message = "Time to Sit!";
    } else {
      stats.totalSessions++;
      await chrome.storage.local.set({
        sessionActive: false,
        currentPosture: null,
        stats: stats
      });
      await notifyTab("Session Complete!");
      return;
    }
  }

  await chrome.storage.local.set({
    currentPosture: nextPosture,
    postureStartTime: Date.now(),
    postureDurationMins: nextDuration,
    cycleCount: cycleCount,
    stats: stats
  });

  chrome.alarms.create('postureTransition', { delayInMinutes: nextDuration });
  await notifyTab(message);
});
