<<<<<<< HEAD
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
=======
<img width="1280" height="640" alt="git (1)" src="https://github.com/user-attachments/assets/8920b256-2ba8-4988-b824-5351134eb4bd" />



# [Project Name] 🎯


## Basic Details
### Team Name: [Name]


### Team Members
- Team Lead: [Name] - [College]
- Member 2: [Name] - [College]
- Member 3: [Name] - [College]

### Project Description
[2-3 lines about what your project does]

### The Problem (that doesn't exist)
[What ridiculous problem are you solving?]

### The Solution (that nobody asked for)
[How are you solving it? Keep it fun!]

## Technical Details
### Technologies/Components Used
For Software:
- [Languages used]
- [Frameworks used]
- [Libraries used]
- [Tools used]

For Hardware:
- [List main components]
- [List specifications]
- [List tools required]

### Implementation
For Software:
# Installation
[commands]

# Run
[commands]

### Project Documentation
For Software:

# Screenshots (Add at least 3)
![Screenshot1](Add screenshot 1 here with proper name)
*Add caption explaining what this shows*

![Screenshot2](Add screenshot 2 here with proper name)
*Add caption explaining what this shows*

![Screenshot3](Add screenshot 3 here with proper name)
*Add caption explaining what this shows*

# Diagrams
![Workflow](Add your workflow/architecture diagram here)
*Add caption explaining your workflow*

For Hardware:

# Schematic & Circuit
![Circuit](Add your circuit diagram here)
*Add caption explaining connections*

![Schematic](Add your schematic diagram here)
*Add caption explaining the schematic*

# Build Photos
![Components](Add photo of your components here)
*List out all components shown*

![Build](Add photos of build process here)
*Explain the build steps*

![Final](Add photo of final product here)
*Explain the final build*

### Project Demo
# Video
[Add your demo video link here]
*Explain what the video demonstrates*

# Additional Demos
[Add any extra demo materials/links]

## Team Contributions
- [Name 1]: [Specific contributions]
- [Name 2]: [Specific contributions]
- [Name 3]: [Specific contributions]

---
Made with ❤️ at TinkerHub Useless Projects 

![Static Badge](https://img.shields.io/badge/TinkerHub-24?color=%23000000&link=https%3A%2F%2Fwww.tinkerhub.org%2F)
![Static Badge](https://img.shields.io/badge/UselessProjects--26-26?link=https%3A%2F%2Ftinkerhub.org%2Fevents%2F1M8ORET9A1%2Fuseless-projects-3.0)



>>>>>>> 69311fd79051eb09e3b7ab1c8ad147682aabe197
