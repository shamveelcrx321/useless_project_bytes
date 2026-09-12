# DIGAMBARAN

**You can download anything... if Digambaran allows you.**

Windows background app + Chrome extension that intercepts Google Chrome downloads and requires a random condition before allowing them.

## Components

1. **DIGAMBARAN.exe** (Electron) — tray app, localhost bridge, condition UI
2. **Chrome extension** — detects downloads via `chrome.downloads.onCreated`, cancels them, asks Digambaran, restarts on ALLOW

## Development

```bash
cd digambaran
npm install
node scripts/generate-icons.js
npm start
```

### Load the Chrome extension

1. Start Digambaran (`npm start`)
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select `digambaran/chrome-extension`
5. Keep Digambaran running

## Build installer

```bash
npm run dist
```

Output: `release/DIGAMBARAN Setup.exe`

The installer registers Digambaran to start with Windows (Electron login items). Use the tray menu to disable startup or protection.

## Behavior (MVP)

On each Chrome download, Digambaran randomly picks one mode:

| Mode | Behavior |
|------|----------|
| PERMISSION | Confirm to allow |
| MERCY | Confirm to allow |
| WAIT | 30s countdown, then allow |
| SACRIFICE | User picks one file; only after confirm, file is moved to the Windows Recycle Bin |

Timeout: **60 seconds** → DENY (download stays cancelled).

## Bridge

- `127.0.0.1:17843` only
- Auth token via `/handshake`, required on all other routes
- `POST /download-detected`
- `GET /decision/:id`

## Safety

- No silent Chrome extension install
- Sacrifice never auto-deletes; blocks system paths and the Digambaran executable
- `contextIsolation: true`, `nodeIntegration: false`
- Chrome only (adapter interface ready for future browsers)
