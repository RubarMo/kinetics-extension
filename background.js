const SESSION_CYCLES = 3;
const SIT_MINS = 20;
const STAND_MINS = 8;
const MOVE_MINS = 2;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    dayActive: false,
    sessionActive: false,
    stats: { totalSessions: 0, totalSitMins: 0, totalStandMins: 0, totalMoveMins: 0 }
  });
});

async function notifyTab(message) {
  try {
    const tabs = await chrome.tabs.query({ active: true });
    let injected = false;

    // Try to notify all active valid tabs
    for (const tab of tabs) {
      if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:')) {
        try {
          await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
          await chrome.tabs.sendMessage(tab.id, { action: "showNotification", message: message });
          injected = true;
        } catch (e) {
          console.error("Injection failed for active tab", tab.id, e);
        }
      }
    }

    // If no active tab could be injected, find ANY valid tab, switch to it, and inject
    if (!injected) {
      const allTabs = await chrome.tabs.query({});
      for (const tab of allTabs) {
        if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:')) {
          try {
            await chrome.tabs.update(tab.id, { active: true });
            if (tab.windowId) {
              await chrome.windows.update(tab.windowId, { focused: true });
            }
            await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
            await chrome.tabs.sendMessage(tab.id, { action: "showNotification", message: message });
            injected = true;
            break; // Stop after successfully injecting into one fallback tab
          } catch (e) {
            console.error("Fallback injection failed for tab", tab.id, e);
          }
        }
      }
    }

    if (!injected) {
      console.warn("Kinetics: No valid tab found to display notification!");
    }
  } catch (err) {
    console.error("Failed to notify tab", err);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'postureTransition') {
    const data = await chrome.storage.local.get(['sessionActive', 'currentPosture', 'cycleCount', 'stats']);
    if (!data.sessionActive) return;

    let nextPosture = '';
    let nextDuration = 0;
    let cycleCount = data.cycleCount || 0;
    const stats = data.stats || { totalSessions: 0, totalSitMins: 0, totalStandMins: 0, totalMoveMins: 0 };
    let message = '';

    if (data.currentPosture === 'sitting') {
      stats.totalSitMins += SIT_MINS;
      nextPosture = 'standing';
      nextDuration = STAND_MINS;
      message = "Time to Stand!";
    } else if (data.currentPosture === 'standing') {
      stats.totalStandMins += STAND_MINS;
      nextPosture = 'moving';
      nextDuration = MOVE_MINS;
      message = "Time to Move!";
    } else if (data.currentPosture === 'moving') {
      stats.totalMoveMins += MOVE_MINS;
      cycleCount++;
      if (cycleCount < SESSION_CYCLES) {
        nextPosture = 'sitting';
        nextDuration = SIT_MINS;
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

    await chrome.storage.local.set({
      currentPosture: nextPosture,
      postureStartTime: Date.now(),
      postureDurationMins: nextDuration,
      cycleCount: cycleCount,
      stats: stats
    });

    chrome.alarms.create('postureTransition', { delayInMinutes: nextDuration });
    await notifyTab(message);
  }
});
