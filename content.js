if (!window.kineticsContentScriptLoaded) {
  window.kineticsContentScriptLoaded = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "showNotification") {
      showModal(request.message);
      sendResponse({ success: true });
    }
  });

  function playChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      function playTone(freq, startTime, duration) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      }
      
      // Play a pleasant double-chime (D5 -> A5)
      playTone(587.33, ctx.currentTime, 0.4);
      playTone(880.00, ctx.currentTime + 0.15, 0.6);
    } catch (e) {
      console.log("Kinetics audio blocked by browser autoplay policy", e);
    }
  }

  function showModal(message) {
    console.log("Kinetics content script: showModal called with message:", message);
    playChime();

    const existingOverlay = document.getElementById('kinetics-overlay');
    if (existingOverlay) {
      console.log("Kinetics content script: updating existing overlay");
      const msgElement = document.getElementById('kinetics-message');
      if (msgElement) msgElement.innerText = message;
      existingOverlay.classList.add('visible');
      return;
    }

    if (!document.body) {
      // If the body is not ready yet, wait for it
      window.addEventListener('DOMContentLoaded', () => showModal(message));
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'kinetics-overlay';

    const modal = document.createElement('div');
    modal.id = 'kinetics-modal';

    const title = document.createElement('h2');
    title.id = 'kinetics-title';
    title.innerText = 'Kinetics Alert';

    const msg = document.createElement('h1');
    msg.id = 'kinetics-message';
    msg.innerText = message;

    const btn = document.createElement('button');
    btn.id = 'kinetics-ok-btn';
    btn.innerText = 'OK';
    btn.onclick = () => {
      overlay.classList.remove('visible');
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
    };

    modal.appendChild(title);
    modal.appendChild(msg);
    modal.appendChild(btn);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);

    // Trigger reflow for animation
    void overlay.offsetWidth;
    overlay.classList.add('visible');
  }
}
