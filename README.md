# Kinetics: Cornell Protocol Productivity Timer ⏱️

> A strict 90-minute productivity timer Chrome Extension that enforces the Cornell 20-8-2 ergonomic posture protocol using in-browser notifications. Built with Manifest V3.

![Kinetics Banner](icon.png)

## 🚀 Features

- **The Cornell Protocol**: Enforces the scientifically-backed 20-8-2 method (20 mins sitting, 8 mins standing, 2 mins moving) to reduce physical fatigue and improve focus.
- **Strict In-Browser Notifications**: Uses active-tab modal injections. No easily ignored system notifications—it stops what you're doing and requires acknowledgment so you actually move.
- **Sleek Interface**: Built with modern CSS, featuring a beautiful dark-mode interface, gradients, and a clean, responsive layout.
- **Privacy First**: All data (session times, statistics) is stored locally using `chrome.storage.local`. No external tracking, no cloud databases.
- **Manifest V3 Compliant**: Built fully on Chrome's latest extension architecture, utilizing background Service Workers and `chrome.alarms` for efficient background processing.

## 📦 Installation (Developer Mode)

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top right corner.
4. Click **Load unpacked** in the top left.
5. Select the `Kinetics` folder containing this extension's code.
6. Pin the extension to your toolbar and click "Start Day" to begin!

## 💻 Technical Architecture

- `manifest.json`: V3 architecture requesting minimal necessary permissions (`alarms`, `storage`, `scripting`, `activeTab`).
- `background.js`: A robust background service worker that manages the state machine, timers, and dynamically injects notifications without relying on persistent intervals.
- `content.js` / `content.css`: Handles the sleek, prominent in-page modal overlays.
- `popup.html` / `popup.js`: The minimalist user interface and visual timer logic.

## 🛠️ Built With

- Vanilla JavaScript
- HTML5
- Modern CSS3 (Inter font, Flexbox, CSS Variables)
- Chrome Extensions API

## 👨‍💻 Author

**RubarMo**
- [GitHub: @RubarMo](https://github.com/RubarMo)

If you find this extension helpful for your productivity and posture, feel free to give the repository a ⭐!

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
