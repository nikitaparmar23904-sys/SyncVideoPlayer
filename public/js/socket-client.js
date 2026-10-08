/**
 * SyncPlay Socket.io Real-Time Client Service
 * Handles network events, room sync, heartbeat broadcast, and permissions
 */
class SyncSocketClient {
  constructor(player) {
    this.socket = null;
    this.player = player;
    this.roomId = null;
    this.username = null;
    this.isHost = false;
    this.allowViewerControl = false;
    this.hostToken = null;
    this.heartbeatTimer = null;

    // Callbacks for UI updates
    this.onUserListUpdate = null;
    this.onChatMessage = null;
    this.onReaction = null;
    this.onRoleChange = null;
    this.onToast = null;

    this.initSocket();
    this.bindPlayerEvents();
  }

  initSocket() {
    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to server with ID:', this.socket.id);
      if (this.onToast) this.onToast('Connected to SyncPlay Network', 'success');
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
      if (this.onToast) this.onToast('Disconnected from server. Reconnecting...', 'warning');
      this.stopHeartbeat();
    });

    // Room joined confirmation
    this.socket.on('joined-room-success', (data) => {
      this.roomId = data.roomId;
      this.username = data.username;
      this.isHost = data.isHost;
      this.allowViewerControl = data.allowViewerControl;

      if (data.hostToken) {
        this.hostToken = data.hostToken;
        localStorage.setItem(`syncplay_host_token_${this.roomId}`, this.hostToken);
      }

      console.log(`[Socket] Successfully joined ${this.roomId} as ${this.isHost ? 'HOST' : 'VIEWER'}`);

      if (this.onRoleChange) {
        this.onRoleChange({
          isHost: this.isHost,
          allowViewerControl: this.allowViewerControl,
          username: this.username,
          roomId: this.roomId
        });
      }

      if (this.onUserListUpdate) {
        this.onUserListUpdate(data.users);
      }

      // Load initial media state if media is already loaded in room
      if (data.mediaState && data.mediaState.type !== 'none') {
        this.player.loadMedia(data.mediaState);
      }

      // If host, begin periodic sync heartbeats
      if (this.isHost) {
        this.startHeartbeat();
      }

      if (this.onToast) {
        this.onToast(`Joined room: ${this.roomId} (${this.isHost ? 'Host 👑' : 'Viewer 👁️'})`, 'info');
      }
    });

    // Notification of another user joining
    this.socket.on('user-joined', (data) => {
      if (this.onUserListUpdate) this.onUserListUpdate(data.users);
      if (this.onToast) this.onToast(`${data.user.username} joined the party!`, 'info');
    });

    // Notification of user departure
    this.socket.on('user-left', (data) => {
      if (this.onUserListUpdate) this.onUserListUpdate(data.users);
      if (this.onToast) this.onToast(`${data.username} left the party`, 'info');
    });

    // Host status change (e.g. temporary disconnect)
    this.socket.on('host-status-changed', (data) => {
      if (this.onToast) this.onToast(data.message, 'warning');
    });

    // Viewer permissions changed by host
    this.socket.on('viewer-control-updated', (data) => {
      this.allowViewerControl = data.allowViewerControl;
      if (this.onRoleChange) {
        this.onRoleChange({
          isHost: this.isHost,
          allowViewerControl: this.allowViewerControl,
          username: this.username,
          roomId: this.roomId
        });
      }
      if (this.onToast) {
        this.onToast(data.allowViewerControl ? 'Host allowed collaborator controls' : 'Host locked collaborator controls', 'info');
      }
    });

    // Media changed
    this.socket.on('media-changed', (data) => {
      console.log('[Media] Changed by', data.changedBy, data.mediaState);
      this.player.loadMedia(data.mediaState);
      if (this.onToast) {
        this.onToast(`${data.changedBy} loaded: ${data.mediaState.title}`, 'info');
      }
    });

    // Play event received
    this.socket.on('media-play', (data) => {
      this.player.remotePlay(data.currentTime, data.serverTime);
    });

    // Pause event received
    this.socket.on('media-pause', (data) => {
      this.player.remotePause(data.currentTime, data.serverTime);
    });

    // Seek event received
    this.socket.on('media-seek', (data) => {
      this.player.remoteSeek(data.currentTime, data.serverTime);
    });

    // Synchronized Fullscreen event
    this.socket.on('sync-fullscreen', (data) => {
      if (this.onFullscreenSync) {
        this.onFullscreenSync(data.isFullscreen, data.initiatedBy);
      }
    });

    // Playback rate changed
    this.socket.on('media-rate-change', (data) => {
      this.player.remoteRateChange(data.playbackRate);
    });

    // Drift correction pulse / Heartbeat from host
    this.socket.on('sync-heartbeat', (data) => {
      if (this.isHost) return; // Host does not align to itself
      this.player.alignDrift(data.currentTime, data.isPlaying);
    });

    // Chat Message
    this.socket.on('new-chat-message', (data) => {
      if (this.onChatMessage) this.onChatMessage(data);
    });

    // Reaction
    this.socket.on('new-reaction', (data) => {
      if (this.onReaction) this.onReaction(data);
    });

    // General Error Message
    this.socket.on('error-msg', (msg) => {
      if (this.onToast) this.onToast(msg, 'error');
    });
  }

  // Hook up player callbacks to emit socket events
  bindPlayerEvents() {
    this.player.onPlay = (time) => {
      if (this.canControl()) {
        this.socket.emit('play-media', { roomId: this.roomId, currentTime: time });
      }
    };

    this.player.onPause = (time) => {
      if (this.canControl()) {
        this.socket.emit('pause-media', { roomId: this.roomId, currentTime: time });
      }
    };

    this.player.onSeek = (time) => {
      if (this.canControl()) {
        this.socket.emit('seek-media', { roomId: this.roomId, currentTime: time });
      }
    };

    this.player.onRateChange = (rate) => {
      if (this.canControl()) {
        this.socket.emit('rate-change-media', { roomId: this.roomId, playbackRate: rate });
      }
    };
  }

  canControl() {
    return this.isHost || this.allowViewerControl;
  }

  joinRoom(roomId, username) {
    this.roomId = (roomId || 'DEFAULT').toUpperCase();
    this.username = username || 'Guest';

    // Retrieve saved token if previously host of this room
    const savedToken = localStorage.getItem(`syncplay_host_token_${this.roomId}`);

    this.socket.emit('join-room', {
      roomId: this.roomId,
      username: this.username,
      hostToken: savedToken,
      requestedRole: savedToken ? 'host' : 'viewer'
    });
  }

  changeMedia({ type, src, title, mediaKind }) {
    if (!this.canControl()) {
      if (this.onToast) this.onToast('Only the host can change media.', 'error');
      return;
    }

    this.socket.emit('change-media', {
      roomId: this.roomId,
      type,
      src,
      title,
      mediaKind
    });
  }

  sendChatMessage(text) {
    if (!text || !text.trim()) return;
    this.socket.emit('send-chat', {
      roomId: this.roomId,
      text
    });
  }

  sendReaction(emoji) {
    this.socket.emit('send-reaction', {
      roomId: this.roomId,
      emoji
    });
  }

  setViewerControlPermission(allowed) {
    if (!this.isHost) return;
    this.socket.emit('toggle-viewer-control', {
      roomId: this.roomId,
      allowViewerControl: allowed
    });
  }

  setFullscreen(isFullscreen) {
    if (!this.canControl()) return;
    this.socket.emit('toggle-fullscreen', {
      roomId: this.roomId,
      isFullscreen: !!isFullscreen
    });
  }

  requestSync() {
    this.socket.emit('request-sync', { roomId: this.roomId });
    if (this.onToast) this.onToast('Sync pulse requested', 'info');
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isHost && this.roomId && this.player.currentType !== 'none') {
        this.socket.emit('sync-pulse', {
          roomId: this.roomId,
          currentTime: this.player.getCurrentTime(),
          isPlaying: this.player.isPlaying
        });
      }
    }, 2500);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

window.SyncSocketClient = SyncSocketClient;
