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

async function trySendMessage(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: "showNotification", message: message });
    return true;
  } catch {
    return false;
  }
}

async function injectAndNotify(tabId, message) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, { action: "showNotification", message: message });
    return true;
  } catch {
    return false;
  }
}

function isValidTab(tab) {
  return tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:');
}

async function notifyTab(message) {
  try {
    const tabs = await chrome.tabs.query({ active: true });
    let notified = false;

    for (const tab of tabs) {
      if (!isValidTab(tab)) continue;
      // Try sending message first — content script may already be loaded
      notified = await trySendMessage(tab.id, message) || await injectAndNotify(tab.id, message);
      if (notified) break;
    }

    if (!notified) {
      const allTabs = await chrome.tabs.query({});
      for (const tab of allTabs) {
        if (!isValidTab(tab)) continue;
        await chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
        notified = await trySendMessage(tab.id, message) || await injectAndNotify(tab.id, message);
        if (notified) break;
      }
    }

    if (!notified) {
      chrome.tabs.create({ url: `fallback.html?msg=${encodeURIComponent(message)}` });
    }
  } catch (err) {
    console.error("Kinetics: Critical failure in notifyTab", err);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'postureTransition') {
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
        // Session complete
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

    console.log(`Kinetics: Transitioning to ${nextPosture} for ${nextDuration} mins. Message: ${message}`);

    await chrome.storage.local.set({
      currentPosture: nextPosture,
      postureStartTime: Date.now(),
      postureDurationMins: nextDuration,
      cycleCount: cycleCount,
      stats: stats
    });

    chrome.alarms.create('postureTransition', { delayInMinutes: nextDuration });
    console.log("Kinetics: Alarm created, calling notifyTab...");
    await notifyTab(message);
  }
});
