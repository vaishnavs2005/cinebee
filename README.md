# 🎬 Cine Nightly — Synchronized Local Watch Party

> **Watch identical local movie files in perfect sync with long-distance loved ones.**  
> Zero video upload. Zero lag. 100% private. Built for two.

---

## 🌟 Key Principle: Zero Video Upload

Streaming or uploading full movie files to a cloud server consumes gigabytes of bandwidth and introduces heavy latency.

**Cine Nightly solves this fundamentally:**
1. Both partners already have the **same movie file** on their devices (or generate the built-in demo reel).
2. Each partner loads their local file directly into their browser via the HTML5 File API (`URL.createObjectURL`).
3. Only tiny control signals (**play**, **pause**, **seek**, **heartbeats**, **chat**, and **reactions**) travel over the lightweight WebSocket relay.
4. Video stays **100% on your device**. Bandwidth cost is practically **$0/month**.

---

## ✨ Features

- **⚡ Instant Playback Synchronization**: Play, pause, and seek actions are instantly mirrored on both screens with loop-prevention safeguards.
- **🕒 Drift Detection & Auto-Correction**: Continuous heartbeat checks playback timing every 3 seconds. If players drift by >1.5s, playback automatically re-aligns.
- **🔄 One-Click Resync**: Manual resync button forces instant synchronization with your partner at any time.
- **⚠️ File Mismatch Warning**: Automatically compares video durations between peers and alerts you if one of you has a different cut or rip of the film.
- **💬 Real-Time Live Chat**: Text chat next to the video with clickable timecodes (e.g. `@14:20`) to jump straight to iconic scenes.
- **✨ Floating Reaction Bursts**: Tap emoji reactions (❤️, 😂, 🍿, 😱, 🔥, 👏) that burst and float across both video screens.
- **🛡️ Co-op vs Host Control Modes**: Let anyone control playback or lock controls to the room host.
- **🎞️ Built-in Sample Reel Generator**: Procedurally generates an animated 1080p cinema test video with running timecode and audio tone so you can test playback synchronization across two browser tabs right away!
- **📝 Subtitle Support**: Drop `.srt` or `.vtt` subtitle files directly onto the player to watch with subtitles.
- **🌌 Cinema Dark Mode**: Glassmorphism, ambient backlight glow reflecting theater aesthetics, and keyboard shortcuts (Space, Arrows, Mute, Fullscreen).

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

### 2. Run in Development Mode
Runs both the backend Socket.IO server (`http://localhost:3001`) and Vite frontend (`http://localhost:5173`) concurrently:
```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### 3. Production Build & Run
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
