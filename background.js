

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    dayActive: false,
    sessionActive: false,
    stats: { totalSessions: 0, totalSitMins: 0, totalStandMins: 0, totalMoveMins: 0 }
  });
});

async function notifyTab(message) {
  console.log("Kinetics: Attempting to notify tab with message:", message);
  try {
    const tabs = await chrome.tabs.query({ active: true });
    let injected = false;

    // Try to notify all active valid tabs
    for (const tab of tabs) {
      if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:')) {
        try {
          console.log("Kinetics: Injecting into active tab:", tab.id);
          await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
          await chrome.tabs.sendMessage(tab.id, { action: "showNotification", message: message });
          injected = true;
        } catch (e) {
          console.error("Kinetics: Injection failed for active tab", tab.id, e);
        }
      }
    }

    // If no active tab could be injected, find ANY valid tab, switch to it, and inject
    if (!injected) {
      const allTabs = await chrome.tabs.query({});
      for (const tab of allTabs) {
        if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:')) {
          try {
            console.log("Kinetics: Fallback to tab:", tab.id);
            await chrome.tabs.update(tab.id, { active: true });
            if (tab.windowId) {
              await chrome.windows.update(tab.windowId, { focused: true });
            }
            await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
            await chrome.tabs.sendMessage(tab.id, { action: "showNotification", message: message });
            injected = true;
            break; 
          } catch (e) {
            console.error("Kinetics: Fallback injection failed for tab", tab.id, e);
          }
        }
      }
    }

    if (!injected) {
      console.warn("Kinetics: No valid tab found to display notification! Opening fallback page.");
      chrome.tabs.create({ url: `fallback.html?msg=${encodeURIComponent(message)}` });
    }
  } catch (err) {
    console.error("Kinetics: Critical failure in notifyTab", err);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'postureTransition') {
    const data = await chrome.storage.local.get(['sessionActive', 'currentPosture', 'cycleCount', 'stats', 'settings']);
    if (!data.sessionActive) return;

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
