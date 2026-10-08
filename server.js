const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e8 // 100MB socket buffer
});

const PORT = process.env.PORT || 3000;

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// Configure Multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const sanitizedBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${sanitizedBase}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500 MB max limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMime = [
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska',
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/x-m4a'
    ];
    const allowedExts = ['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.mp3', '.wav', '.aac', '.flac', '.m4a'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMime.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only video and audio files (MP4, WebM, MKV, MP3, WAV, etc.) are allowed!'));
    }
  }
});

// File upload endpoint
app.post('/api/upload', (req, fileRes) => {
  upload.single('mediaFile')(req, fileRes, (err) => {
    if (err) {
      console.error('File upload error:', err);
      return fileRes.status(400).json({ success: false, message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return fileRes.status(400).json({ success: false, message: 'No file received' });
    }

    const isAudio = req.file.mimetype.startsWith('audio/') || 
      ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'].includes(path.extname(req.file.originalname).toLowerCase());

    const fileUrl = `/uploads/${req.file.filename}`;
    return fileRes.json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: fileUrl,
      size: req.file.size,
      mediaKind: isAudio ? 'audio' : 'video'
    });
  });
});

// In-memory Room State Store
/**
 * Room structure:
 * {
 *   roomId: string,
 *   hostToken: string,
 *   hostSocketId: string,
 *   allowViewerControl: boolean,
 *   users: { [socketId]: { id, username, isHost, joinedAt } },
 *   mediaState: {
 *     type: 'none' | 'youtube' | 'upload' | 'direct',
 *     mediaKind: 'video' | 'audio',
 *     src: string,
 *     title: string,
 *     currentTime: number,
 *     duration: number,
 *     isPlaying: boolean,
 *     playbackRate: number,
 *     updatedAt: number
 *   }
 * }
 */
const rooms = new Map();

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function calculateCurrentTime(mediaState) {
  if (!mediaState.isPlaying) {
    return mediaState.currentTime;
  }
  const now = Date.now();
  const elapsedSeconds = ((now - mediaState.updatedAt) / 1000) * (mediaState.playbackRate || 1);
  return mediaState.currentTime + elapsedSeconds;
}

// Socket.io real-time connection logic
io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('join-room', ({ roomId, username, hostToken, requestedRole }) => {
    roomId = (roomId || 'default-room').trim().toUpperCase();
    username = (username || 'Anonymous').trim().slice(0, 24);

    let room = rooms.get(roomId);
    let isHost = false;

    if (!room) {
      // Room does not exist: Creator is Host
      const newHostToken = generateToken();
      room = {
        roomId,
        hostToken: newHostToken,
        hostSocketId: socket.id,
        allowViewerControl: false,
        users: {},
        mediaState: {
          type: 'none',
          mediaKind: 'video',
          src: '',
          title: 'No media selected',
          currentTime: 0,
          duration: 0,
          isPlaying: false,
          playbackRate: 1,
          updatedAt: Date.now()
        }
      };
      rooms.set(roomId, room);
      isHost = true;
    } else {
      // Room exists: Check if client possesses valid hostToken or if host slot is empty
      if (hostToken && hostToken === room.hostToken) {
        room.hostSocketId = socket.id;
        isHost = true;
      } else if (!room.hostSocketId && requestedRole === 'host') {
        // Host had disconnected and user claims host with matching token
        room.hostSocketId = socket.id;
        isHost = true;
      } else {
        isHost = false;
      }
    }

    currentRoomId = roomId;
    socket.join(roomId);

    room.users[socket.id] = {
      id: socket.id,
      username,
      isHost,
      joinedAt: Date.now()
    };

    // Calculate current running playback time for smooth catch-up
    const effectiveCurrentTime = calculateCurrentTime(room.mediaState);

    // Send confirmation to the joining client
    socket.emit('joined-room-success', {
      roomId,
      username,
      isHost,
      hostToken: isHost ? room.hostToken : null,
      allowViewerControl: room.allowViewerControl,
      mediaState: {
        ...room.mediaState,
        currentTime: effectiveCurrentTime
      },
      users: Object.values(room.users)
    });

    // Notify other peers in room
    socket.to(roomId).emit('user-joined', {
      user: room.users[socket.id],
      users: Object.values(room.users),
      message: `${username} joined the party`
    });

    console.log(`[Socket] ${username} (${socket.id}) joined ${roomId} as ${isHost ? 'HOST' : 'VIEWER'}`);
  });

  // Verify authorization to control media
  function canControl(room) {
    if (!room) return false;
    if (room.allowViewerControl) return true;
    return room.hostSocketId === socket.id;
  }

  // Host changes media
  socket.on('change-media', ({ roomId, type, src, title, mediaKind }) => {
    const room = rooms.get(roomId);
    if (!canControl(room)) {
      return socket.emit('error-msg', 'Only the host has permission to change media.');
    }

    room.mediaState = {
      type: type || 'direct',
      mediaKind: mediaKind || 'video',
      src: src || '',
      title: title || 'Untitled Media',
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      playbackRate: 1,
      updatedAt: Date.now()
    };

    io.to(roomId).emit('media-changed', {
      mediaState: room.mediaState,
      changedBy: room.users[socket.id]?.username || 'Host'
    });
    console.log(`[Media] Room ${roomId} changed media to: ${title} (${type})`);
  });

  // Host plays media
  socket.on('play-media', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (!canControl(room)) return;

    room.mediaState.isPlaying = true;
    room.mediaState.currentTime = typeof currentTime === 'number' ? currentTime : room.mediaState.currentTime;
    room.mediaState.updatedAt = Date.now();

    // Broadcast to viewers with server timestamp for precision drift calculation
    io.to(roomId).emit('media-play', {
      currentTime: room.mediaState.currentTime,
      serverTime: Date.now(),
      initiatedBy: room.users[socket.id]?.username || 'Host'
    });
  });

  // Host pauses media
  socket.on('pause-media', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (!canControl(room)) return;

    room.mediaState.isPlaying = false;
    room.mediaState.currentTime = typeof currentTime === 'number' ? currentTime : room.mediaState.currentTime;
    room.mediaState.updatedAt = Date.now();

    io.to(roomId).emit('media-pause', {
      currentTime: room.mediaState.currentTime,
      serverTime: Date.now(),
      initiatedBy: room.users[socket.id]?.username || 'Host'
    });
  });

  // Host seeks media (forward / rewind / scrub)
  socket.on('seek-media', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (!canControl(room)) return;

    room.mediaState.currentTime = currentTime;
    room.mediaState.updatedAt = Date.now();

    io.to(roomId).emit('media-seek', {
      currentTime,
      serverTime: Date.now(),
      initiatedBy: room.users[socket.id]?.username || 'Host'
    });
  });

  // Host changes playback rate (speed: 0.5x, 1x, 1.5x, etc.)
  socket.on('rate-change-media', ({ roomId, playbackRate }) => {
    const room = rooms.get(roomId);
    if (!canControl(room)) return;

    room.mediaState.playbackRate = playbackRate;
    room.mediaState.updatedAt = Date.now();

    io.to(roomId).emit('media-rate-change', {
      playbackRate,
      serverTime: Date.now()
    });
  });

  // Host periodic heartbeat pulse for drift correction (every 2-3s)
  socket.on('sync-pulse', ({ roomId, currentTime, isPlaying }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostSocketId !== socket.id) return;

    room.mediaState.currentTime = currentTime;
    room.mediaState.isPlaying = isPlaying;
    room.mediaState.updatedAt = Date.now();

    // Broadcast heartbeat to all non-host viewers
    socket.to(roomId).emit('sync-heartbeat', {
      currentTime,
      isPlaying,
      serverTime: Date.now()
    });
  });

  // Host toggles viewer control permission
  socket.on('toggle-viewer-control', ({ roomId, allowViewerControl }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostSocketId !== socket.id) return;

    room.allowViewerControl = !!allowViewerControl;
    io.to(roomId).emit('viewer-control-updated', {
      allowViewerControl: room.allowViewerControl
    });
  });

  // Host toggles fullscreen for all collaborators
  socket.on('toggle-fullscreen', ({ roomId, isFullscreen }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostSocketId !== socket.id) return;

    io.to(roomId).emit('sync-fullscreen', {
      isFullscreen: !!isFullscreen,
      initiatedBy: room.users[socket.id]?.username || 'Host'
    });
  });

  // Request sync (e.g. viewer manually clicking "Re-sync with Host")
  socket.on('request-sync', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const effectiveCurrentTime = calculateCurrentTime(room.mediaState);
    socket.emit('sync-heartbeat', {
      currentTime: effectiveCurrentTime,
      isPlaying: room.mediaState.isPlaying,
      playbackRate: room.mediaState.playbackRate,
      serverTime: Date.now(),
      forceSeek: true
    });
  });

  // Live Chat
  socket.on('send-chat', ({ roomId, text }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const user = room.users[socket.id];
    if (!user || !text || !text.trim()) return;

    const chatMsg = {
      id: Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      senderId: socket.id,
      senderName: user.username,
      isHost: user.isHost,
      text: text.trim().slice(0, 300),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    io.to(roomId).emit('new-chat-message', chatMsg);
  });

  // Live Floating Emoji Reactions
  socket.on('send-reaction', ({ roomId, emoji }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const user = room.users[socket.id];
    io.to(roomId).emit('new-reaction', {
      emoji,
      senderName: user ? user.username : 'Guest'
    });
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const departedUser = room.users[socket.id];
    delete room.users[socket.id];

    if (departedUser && departedUser.isHost) {
      room.hostSocketId = null; // Host slot available for reconnection
      io.to(currentRoomId).emit('host-status-changed', {
        isHostConnected: false,
        message: 'Host has temporarily disconnected.'
      });
    }

    io.to(currentRoomId).emit('user-left', {
      userId: socket.id,
      username: departedUser ? departedUser.username : 'User',
      users: Object.values(room.users)
    });

    // Cleanup empty room after 10 minutes of inactivity
    if (Object.keys(room.users).length === 0) {
      setTimeout(() => {
        const checkRoom = rooms.get(currentRoomId);
        if (checkRoom && Object.keys(checkRoom.users).length === 0) {
          rooms.delete(currentRoomId);
          console.log(`[Cleanup] Room ${currentRoomId} destroyed due to inactivity.`);
        }
      }, 10 * 60 * 1000);
    }
  });
});

// Fallback index.html route for SPA routing and direct room links (e.g., /?room=XYZ)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function startServer(portToTry) {
  server.listen(portToTry, () => {
    console.log(`===============================================`);
    console.log(`🚀 SyncPlay Server running at: http://localhost:${portToTry}`);
    console.log(`✨ Real-time synchronized video & music player ready!`);
    console.log(`===============================================`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = Number(PORT) + 1;
    console.warn(`⚠️ Port ${PORT} is currently occupied. Attempting alternative port ${nextPort}...`);
    startServer(nextPort);
  } else {
    console.error('Server error:', err);
  }
});

startServer(PORT);
