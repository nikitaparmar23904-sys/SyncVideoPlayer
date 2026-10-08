# 🎬 SyncPlay Studio

> **Real-Time Synchronized Screen Play for Video & Music** using **Node.js** and **Socket.io**.

SyncPlay Studio enables a host to broadcast and synchronize media in real time across collaborators' browser windows. Media plays locally on each user's device while playback controls (Play, Pause, Forward, Rewind, Seek, Rate) remain exclusively controlled by the Host.

---

## ✨ Features

- **👑 Exclusive Host Playback Control**:
  - The host who creates the room has full control over **Play**, **Pause**, **Forward (+10s)**, **Rewind (-10s)**, scrub bar slider, and playback speed.
  - Viewers watch in sync on their own devices. Viewer controls are locked by default to prevent accidental pauses or skips.
  - Optional toggle for the host: *"Collaborator Controls"* to allow friends to control playback when needed.
- **📺 Multi-Source Media Broadcast**:
  - **YouTube Integration**: Official YouTube IFrame Player API support. Accepts standard links, shortlinks (`youtu.be`), and YouTube Shorts.
  - **Local Video & Music File Uploads**: Upload MP4, WebM, MKV, MP3, WAV, AAC, and FLAC files directly to the server with real-time upload progress bars and HTTP 206 streaming.
  - **Direct URLs / Instagram**: Load direct `.mp4`, `.mp3` links, Instagram video links, or CDN media streams.
- **🎧 Audio Visualizer & Vinyl Record Mode**:
  - Automatically engages an animated glowing Canvas spectrum visualizer and spinning vinyl record stage when music files are played.
- **⚡ Sub-Second Real-Time Synchronization**:
  - Socket.io broadcasts `media-play`, `media-pause`, and `media-seek` instantly to all collaborators.
  - Automatic drift correction heartbeats every 2.5 seconds keep all viewers aligned within $\pm 0.05\text{s}$ without stuttering.
- **💬 Collaborative Watch Party Experience**:
  - In-room live chat with user tags and timestamps.
  - Real-time floating reaction bursts (❤️, 🔥, 👏, 😂, 🍿, 🚀, 🎵) floating up on all connected collaborator screens.
  - 1-click room invite link sharing (with instant Copy, WhatsApp, Telegram, Twitter share shortcuts).
- **🎨 Modern Cyber-Cinema UI**:
  - Dark glassmorphism theme with violet/cyan neon glowing highlights, responsive design, theater mode, and full-screen support.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js (v5), Socket.io, Multer, CORS
- **Frontend**: HTML5, Tailwind CSS, Modern Vanilla JavaScript (ES6+), Web Audio API, Canvas API, Lucide Icons
- **Media Engine**: YouTube IFrame API + HTML5 Audio/Video

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+ or v22+)
- **NPM**

### 2. Installation
```bash
npm install
```

### 3. Run the Server
```bash
npm start
```
The server will start on port `3000`:
```
===============================================
🚀 SyncPlay Server running at: http://localhost:3000
✨ Real-time synchronized video & music player ready!
===============================================
```

Open `http://localhost:3000` in your browser.

---

## 🎮 How It Works

### Step 1: Host Creates a Room
1. Enter your name and choose a **Room ID** (e.g. `CINEMA-1`).
2. The first user to join becomes the **Room Host 👑**.
3. Host receives a persistent token so that page refreshes maintain host privileges.

### Step 2: Share with Collaborators
1. Click **Invite Friends** or copy the room link (e.g., `http://localhost:3000/?room=CINEMA-1`).
2. Friends opening the link join automatically as **Viewers 👁️**.

### Step 3: Load Media & Play in Sync
1. Host clicks **Load Media** and selects:
   - **YouTube**: Paste any YouTube URL or click one of the quick presets.
   - **Upload File**: Drag-and-drop a video or music file (MP4, MKV, MP3, etc.).
   - **Direct URL**: Enter a web video/audio stream URL.
2. The media loads on all connected devices at the same second.
3. When the host clicks **Play**, **Pause**, or drags the **Scrub bar**, all viewers' devices update immediately.
4. Each viewer can independently adjust their own volume, mute, or enter full screen.

---

## 📡 Socket.io Real-Time Event Protocol

| Event | Direction | Payload | Description |
|---|---|---|---|
| `join-room` | Client ➔ Server | `{ roomId, username, hostToken, requestedRole }` | Joins room, assigns Host or Viewer |
| `joined-room-success` | Server ➔ Client | `{ roomId, isHost, hostToken, mediaState, users }` | Syncs current room state & role |
| `change-media` | Host ➔ Server | `{ roomId, type, src, title, mediaKind }` | Sets new media source |
| `media-changed` | Server ➔ Clients | `{ mediaState, changedBy }` | Loads media on all client devices |
| `play-media` | Host ➔ Server | `{ roomId, currentTime }` | Starts playback |
| `media-play` | Server ➔ Clients | `{ currentTime, serverTime }` | Triggers playback on viewers |
| `pause-media` | Host ➔ Server | `{ roomId, currentTime }` | Pauses playback |
| `media-pause` | Server ➔ Clients | `{ currentTime, serverTime }` | Pauses playback on viewers |
| `seek-media` | Host ➔ Server | `{ roomId, currentTime }` | Fast forward, rewind, or scrub |
| `media-seek` | Server ➔ Clients | `{ currentTime, serverTime }` | Jumps viewers to target timestamp |
| `sync-pulse` | Host ➔ Server | `{ roomId, currentTime, isPlaying }` | Heartbeat pulse from host |
| `sync-heartbeat` | Server ➔ Viewers | `{ currentTime, isPlaying, serverTime }` | Auto-corrects drift ($\pm 0.8\text{s}$) |
| `send-chat` | Client ➔ Server | `{ roomId, text }` | Broadcasts message to room chat |
| `send-reaction` | Client ➔ Server | `{ roomId, emoji }` | Broadcasts floating emoji burst |

---

## 📂 Project Structure

```
node_grp/
├── package.json               # Dependencies and scripts
├── server.js                  # Express & Socket.io synchronization server
├── uploads/                   # Storage for uploaded media files
├── public/
│   ├── index.html             # Main interface with theater layout & modals
│   ├── css/
│   │   └── style.css          # Glassmorphism, neon styling & animations
│   └── js/
│       ├── visualizer.js      # Canvas audio spectrum visualizer
│       ├── player.js          # Unified YouTube & HTML5 playback controller
│       ├── socket-client.js   # Real-time WebSocket synchronization engine
│       └── app.js             # UI interactions, chat, upload & reactions
└── README.md
```
