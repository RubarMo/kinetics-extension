if (!window.kineticsContentScriptLoaded) {
  window.kineticsContentScriptLoaded = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "showNotification") {
      showModal(request.message);
      sendResponse({ success: true });
    }
  });

  function showModal(message) {
    if (document.getElementById('kinetics-overlay')) {
      document.getElementById('kinetics-message').innerText = message;
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
