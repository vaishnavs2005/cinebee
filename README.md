# 🐱🍿 Meowvie — Synchronized Local Watch Party

> **Watch identical local movie files in perfect sync with friends and loved ones.**  
> Zero video upload. Zero lag. 100% private. Built-in real-time WebRTC walkie-talkie & open mic audio chat.

---

## 🌟 Key Principle: Zero Video Upload

Streaming or uploading full movie files to a cloud server consumes gigabytes of bandwidth and introduces heavy latency.

**Meowvie solves this fundamentally:**
1. Both partners load their local movie file directly into their browser via the HTML5 File API (`URL.createObjectURL`).
2. Only tiny control signals (**play**, **pause**, **seek**, **heartbeats**, **chat**, and **reactions**) travel over the lightweight WebSocket relay.
3. High-quality peer-to-peer audio communicates in real-time via WebRTC (Push-to-Talk or Open Mic).
4. Video stays **100% on your device**. Bandwidth cost is practically **$0/month**.

---

## ✨ Features

- **⚡ Instant Playback Synchronization**: Play, pause, and seek actions are instantly mirrored on both screens with loop-prevention safeguards.
- **🎙️ WebRTC Walkie-Talkie & Open Mic**: Real-time voice chat with Push-to-Talk (Space/T key) and Open Mic modes, including live waveform & speaking indicators.
- **🕒 Drift Detection & Auto-Correction**: Continuous heartbeat checks playback timing every 3 seconds. If players drift by >1.5s, playback automatically re-aligns.
- **🔄 One-Click Resync**: Manual resync button forces instant synchronization with your partner at any time.
- **⚠️ File Mismatch Warning**: Automatically compares video durations between peers and alerts you if one of you has a different cut or rip of the film.
- **💬 Real-Time Live Chat**: Text chat next to the video with clickable timecodes (e.g. `@14:20`) to jump straight to iconic scenes.
- **✨ Comic Floating Reactions**: Tap animated comic sticker reactions that float across both video screens.
- **🛡️ Co-op vs Host Control Modes**: Let anyone control playback or lock controls to the room host.
- **🎞️ Built-in Sample Reel Generator**: Procedurally generates an animated cinema test video with running timecode so you can test playback synchronization across two browser tabs right away!
- **📝 Subtitle Support**: Drop `.srt` or `.vtt` subtitle files directly onto the player to watch with subtitles.
- **🎨 Retro Comic Diner Design**: Warm cream tones, bold comic outlines, playful pop shadows, and interactive floating cat head physics on the landing page.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm

### 1. Install Dependencies
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 2. ⚡ Fast Local Hosting (One-Click)
To host the full app locally in seconds and automatically open it in your browser:
- **Windows (One-Click)**: Double-click [host.bat](file:///d:/2.%20Projects/Cine%20Nightly/host.bat)
- **PowerShell**: `./host.ps1`
- **npm / Node**: `npm run host` or `node host.js`

This checks your dependencies, builds if necessary, serves frontend & backend on `http://localhost:3001`, displays your local Wi-Fi Network URL for multi-device watching, and opens your browser.

### 3. Run in Development Mode
Runs both the backend Socket.IO server (`http://localhost:3001`) and Vite frontend (`http://localhost:5173`) concurrently:
```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### 4. Production Build & Run Manually
```bash
npm run build
npm start
```
Open `http://localhost:3001`.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / Pause |
| `←` / `→` | Rewind / Fast Forward 5 seconds |
| `M` | Mute / Unmute |
| `F` | Toggle Fullscreen |

---

## 🛠️ Deployment (Free-Tier Friendly)

Because video files are never uploaded, the server only relays tiny JSON packets. A free-tier instance on **Render**, **Railway**, or **Fly.io** can easily run this application.

1. Build client: `npm run build`
2. Start server: `node server/index.js` (listens on `process.env.PORT`)
3. Static files are served directly from the built `dist/` directory.
