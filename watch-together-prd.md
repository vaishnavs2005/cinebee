# Product Requirements Document (PRD)
## "WatchTogether" — Synchronized Local-Video Watch Party for Long-Distance Couples

**Version:** 1.0
**Date:** September 2026
**Author:** Product spec drafted with Claude

---

## 1. Overview

WatchTogether is a lightweight web application that lets two people in different locations watch the **same movie file** (already saved locally on each of their own devices) in perfect sync. One person's play/pause/seek actions are mirrored on the other's screen in near real time, and a live chat sits alongside the video so both people can talk while watching.

**Key design principle:** The video file is never uploaded to a server. Each person loads their own local copy into the browser using the HTML5 File API. Only tiny control signals ("play at time X", "pause", "seek to Y", chat messages) travel over the network. This keeps the app free to run (no video storage/bandwidth costs) and works because both files are assumed to be identical copies.

---

## 2. Problem Statement

Long-distance couples/friends want to watch a movie "together," but:
- Streaming services aren't always shared, licensed the same in both regions, or available at all (e.g., a ripped/downloaded file).
- Existing tools (Teleparty, Rave, etc.) mostly work only with streaming platforms in a browser tab, not arbitrary local video files.
- Screen-sharing video calls degrade quality and drain bandwidth/battery.

**Goal:** Build a minimal, free, self-hosted-or-free-tier web app that synchronizes playback of a local video file across two browsers and includes chat.

---

## 3. Goals & Non-Goals

### Goals
- Both users load their own local video file (same movie, same file ideally).
- Play, pause, seek, rewind/fast-forward stay in sync between both sides (within ~1 second).
- Real-time text chat alongside the video.
- Simple "room" system — one person creates a room and shares a code/link, the other joins.
- Runs entirely on free-tier infrastructure.
- Works in modern desktop browsers (Chrome, Edge, Firefox, Safari).

### Non-Goals (v1)
- No video file storage or transcoding on a server.
- No support for differing file versions/cuts (assumes identical files — app can warn if durations differ).
- No mobile app (responsive web only, mobile browser support is a stretch goal).
- No user accounts/auth system (anonymous rooms with a shareable code).
- No screen sharing or webcam video chat (text chat only in v1).

---

## 4. User Stories

1. As a user, I want to create a "watch room" and get a shareable link/code so my partner can join.
2. As a user, I want to load my local movie file into the app and have it appear in a video player.
3. As a user, when my partner presses play/pause/seeks, I want my player to do the same automatically.
4. As a user, I want to send and receive chat messages next to the video without leaving the page.
5. As a user, I want a visible indicator of connection status (connected/disconnected/syncing).
6. As a user, I want the app to warn me if my file's duration doesn't match my partner's (likely a different file/cut).
7. As a user, I want a "resync" button in case playback drifts out of sync.

---

## 5. Core Feature Set (MVP)

| Feature | Description |
|---|---|
| Room creation/join | Generate a short unique room code (e.g., `xk4p9`); shareable URL like `watchtogether.app/room/xk4p9` |
| Local file loading | `<input type="file">` + `URL.createObjectURL()` to load local video into an HTML5 `<video>` element — no upload |
| Playback sync engine | WebSocket (or WebRTC data channel) broadcasts play/pause/seek events with timestamps; peer applies them |
| Drift correction | Periodic "heartbeat" (every 3–5s) sends current timestamp; if peers drift >1.5s, auto-correct |
| Text chat | Real-time chat panel using the same WebSocket/data channel connection |
| Connection status UI | Shows "Connected", "Partner disconnected", "Syncing…" states |
| File mismatch warning | Compares video `duration` metadata between peers; shows a warning banner if they differ significantly |
| Manual resync button | Forces current host's play state onto both clients |

### Stretch Features (v2+)
- Emoji reactions overlay
- Voice chat via WebRTC audio
- Persistent rooms with history
- Mobile-responsive polish / PWA install
- "Host mode" toggle (only one person can control playback vs. either can)

---

## 6. How Sync Works (Technical Approach)

Since the video itself never leaves the device, sync is just **event mirroring**:

1. **User A** presses pause at video time `00:34:12`.
2. Browser captures the native `<video>` `pause` event.
3. App sends a small JSON message: `{ type: "pause", time: 2052.4 }` over the WebSocket/data channel.
4. **User B**'s app receives the message, sets their `<video>` element's `currentTime = 2052.4` and calls `.pause()`.
5. Same pattern for `play`, `seeked`, and periodic `timeupdate` heartbeats to catch drift (e.g., inconsistent buffering/frame rates).

This requires **no video processing on the server at all** — the server (or peer connection) only relays small text messages, which is why this fits comfortably into free tiers.

### Two possible architectures

**Option A — WebRTC peer-to-peer (recommended for cost & privacy)**
- Video stays 100% local; only a lightweight signaling server (to help two browsers find each other) touches any backend.
- Once connected, play/pause/seek/chat messages travel directly between the two browsers via a WebRTC **DataChannel** — zero ongoing server bandwidth cost.
- Signaling server can be a tiny Node.js WebSocket server (just for the initial handshake) or a free service like **PeerJS's public broker server** (free, no signup needed) or a self-hosted signaling server on Render/Fly.io free tier.

**Option B — WebSocket relay via a backend**
- Simpler to build and debug, but every play/pause/chat message routes through a server.
- Message volume is tiny (a few messages per minute), so this stays well within free tiers even on Option B.
- Easier to reason about "room" logic (server tracks who's in which room).

**Recommendation:** Start with **Option B (WebSocket relay)** for v1 — it's simpler, still free, and message volume is negligible. Migrate to WebRTC data channels later only if scaling becomes a concern (it won't, for two people).

---

## 7. Suggested Tech Stack (All Free-Tier)

| Layer | Technology | Why |
|---|---|---|
| Frontend | React (Vite) or plain HTML/JS | Simple, fast to build; HTML5 `<video>` element for playback |
| Realtime sync + chat | **Socket.IO** or native WebSocket, OR a free real-time backend like **Supabase Realtime** or **Firebase Realtime Database / Firestore** | Avoids running your own WebSocket server if you want zero backend maintenance |
| Backend (if self-hosting sockets) | Node.js + `ws`/Socket.IO | Lightweight; only relays small JSON messages |
| Hosting — frontend | **Vercel**, **Netlify**, or **GitHub Pages** (free tier) | Static hosting, generous free limits |
| Hosting — backend (if needed) | **Render.com free web service**, **Railway free tier**, or **Fly.io free allowance** | Free tier is enough since traffic is minimal |
| Realtime-as-a-service alternative | **Firebase Realtime DB** (free Spark plan) or **Supabase** (free tier, includes Postgres + Realtime channels) | No need to manage your own WebSocket server at all — both handle chat + sync events on their free plan |
| Room codes | Generated client-side or via backend (e.g., `nanoid`) | Simple short unique IDs |
| Video playback | Native HTML5 `<video>` + File API (`URL.createObjectURL`) | No server video handling needed |

**Simplest free stack to actually ship fast:** React + Vite frontend on **Vercel**, using **Firebase Realtime Database** (free tier) for both the sync events and chat messages (no custom backend to deploy at all). This minimizes moving parts and hosting to babysit.

---

## 8. System Architecture Diagram (Text Form)

```
User A's Browser                         User B's Browser
 ┌───────────────┐                       ┌───────────────┐
 │ Local video    │                      │ Local video    │
 │ file (File API)│                      │ file (File API)│
 │ <video> player │                      │ <video> player │
 └──────┬────────┘                       └──────┬────────┘
        │ play/pause/seek events                │
        ▼                                        ▼
 ┌─────────────────────────────────────────────────────┐
 │      Realtime channel (Firebase RTDB / WebSocket)     │
 │            Room: "xk4p9" — events + chat              │
 └─────────────────────────────────────────────────────┘
```

---

## 9. Non-Functional Requirements

- **Latency:** Sync events should propagate in under ~300ms on typical broadband.
- **Cost:** $0/month at two-user scale on free tiers listed above.
- **Privacy:** Video files never leave the user's device; only playback timestamps and chat text are transmitted.
- **Reliability:** Reconnect automatically if WebSocket/Firebase connection drops; show clear UI state.
- **Browser support:** Latest Chrome, Firefox, Edge, Safari (desktop first).

---

## 10. MVP Build Milestones

1. **Week 1:** Local file playback works standalone (load file, play/pause/seek locally).
2. **Week 1–2:** Room creation/join + realtime connection (Firebase or WebSocket) established between two tabs.
3. **Week 2:** Playback event sync working (play/pause/seek mirrored between two browsers).
4. **Week 3:** Chat panel added on the same realtime channel.
5. **Week 3:** Drift correction heartbeat + manual resync button.
6. **Week 4:** Polish — connection status UI, file-mismatch warning, responsive layout, deploy to Vercel.

---

## 11. Open Questions

- Should either partner be able to control playback, or only a designated "host"? (Recommend: either can control in v1, since it's just two trusted people.)
- What happens if file durations differ (different rip/cut of the movie)? (v1: warn only, don't block.)
- Do we want message history persistence (Firebase) or ephemeral chat only (plain WebSocket, cleared on refresh)?

---

## 12. Success Metrics (informal, personal-project scale)

- Both partners can start a session and watch a full movie with no more than a couple of manual resyncs.
- Chat and video sync both feel "instant" (no perceptible lag) on typical home broadband.
