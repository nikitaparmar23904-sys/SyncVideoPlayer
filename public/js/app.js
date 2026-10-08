/**
 * SyncPlay Studio - Application Main Controller
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Instantiate Player and Socket Client
  const player = new window.UnifiedPlayer();
  const socketClient = new window.SyncSocketClient(player);

  // DOM References
  const joinModal = document.getElementById('join-modal');
  const joinForm = document.getElementById('join-room-form');
  const inputUsername = document.getElementById('input-username');
  const inputRoomId = document.getElementById('input-room-id');
  const generateRoomIdBtn = document.getElementById('generate-room-id-btn');

  // Header Elements
  const roomBadge = document.getElementById('room-badge');
  const currentRoomIdEl = document.getElementById('current-room-id');
  const quickCopyRoomBtn = document.getElementById('quick-copy-room-btn');
  const userRoleBadge = document.getElementById('user-role-badge');
  const userRoleText = document.getElementById('user-role-text');
  const collaboratorsCount = document.getElementById('collaborators-count');
  const openShareModalBtn = document.getElementById('open-share-modal-btn');
  const openMediaModalBtn = document.getElementById('open-media-modal-btn');
  const resyncBtn = document.getElementById('resync-btn');
  const hostPermissionContainer = document.getElementById('host-permission-toggle-container');
  const allowViewerControlCheckbox = document.getElementById('allow-viewer-control-checkbox');

  // Video Overlay Elements
  const videoHostBadge = document.getElementById('video-host-badge');
  const videoHostText = document.getElementById('video-host-text');
  const reactionContainer = document.getElementById('reaction-container');
  const viewerLockedBanner = document.getElementById('viewer-locked-banner');
  const playerContainer = document.getElementById('player-container');
  const theaterBtn = document.getElementById('theater-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');

  // Media Modal
  const mediaModal = document.getElementById('media-modal');
  const closeMediaModalBtn = document.getElementById('close-media-modal-btn');
  const idleLoadBtn = document.getElementById('idle-load-btn');
  const idleSampleBtn = document.getElementById('idle-sample-btn');

  const mediaTabYt = document.getElementById('media-tab-yt');
  const mediaTabUpload = document.getElementById('media-tab-upload');
  const mediaTabUrl = document.getElementById('media-tab-url');
  const contentTabYt = document.getElementById('content-tab-yt');
  const contentTabUpload = document.getElementById('content-tab-upload');
  const contentTabUrl = document.getElementById('content-tab-url');

  const ytUrlInput = document.getElementById('yt-url-input');
  const ytLoadBtn = document.getElementById('yt-load-btn');

  const fileDropzone = document.getElementById('file-dropzone');
  const mediaFileInput = document.getElementById('media-file-input');
  const uploadProgressContainer = document.getElementById('upload-progress-container');
  const uploadFilename = document.getElementById('upload-filename');
  const uploadPercent = document.getElementById('upload-percent');
  const uploadProgressBar = document.getElementById('upload-progress-bar');
  const uploadStatusHint = document.getElementById('upload-status-hint');

  const directUrlInput = document.getElementById('direct-url-input');
  const directLoadBtn = document.getElementById('direct-load-btn');

  // Share Modal
  const shareModal = document.getElementById('share-modal');
  const closeShareModalBtn = document.getElementById('close-share-modal-btn');
  const shareLinkInput = document.getElementById('share-link-input');
  const copyShareLinkBtn = document.getElementById('copy-share-link-btn');
  const shareWhatsappBtn = document.getElementById('share-whatsapp-btn');
  const shareTelegramBtn = document.getElementById('share-telegram-btn');
  const shareTwitterBtn = document.getElementById('share-twitter-btn');

  // Chat & Tabs
  const tabChatBtn = document.getElementById('tab-chat-btn');
  const tabUsersBtn = document.getElementById('tab-users-btn');
  const chatTabContent = document.getElementById('chat-tab-content');
  const usersTabContent = document.getElementById('users-tab-content');
  const chatMessages = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const usersList = document.getElementById('users-list');
  const tabUsersCount = document.getElementById('tab-users-count');

  // Reaction Buttons
  const reactionButtons = document.querySelectorAll('.reaction-btn');

  // =========================================================================
  // Helper: Toast Notifications
  // =========================================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    let iconHtml = '<i data-lucide="info" class="w-4 h-4 text-cyan-400"></i>';
    if (type === 'success') {
      iconHtml = '<i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>';
    } else if (type === 'warning') {
      iconHtml = '<i data-lucide="alert-triangle" class="w-4 h-4 text-amber-400"></i>';
    } else if (type === 'error') {
      iconHtml = '<i data-lucide="alert-octagon" class="w-4 h-4 text-rose-400"></i>';
    }

    toast.innerHTML = `
      <div class="shrink-0">${iconHtml}</div>
      <div class="text-xs font-medium text-gray-200">${message}</div>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
  socketClient.onToast = showToast;

  // =========================================================================
  // Room Creation / URL Parsing
  // =========================================================================
  function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = 'ROOM-';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  }

  // Pre-fill room from URL if given
  const urlRoom = getQueryParam('room');
  if (urlRoom) {
    inputRoomId.value = urlRoom.toUpperCase();
  } else {
    inputRoomId.value = generateRoomId();
  }

  // Auto-restore username from localStorage
  const savedUsername = localStorage.getItem('syncplay_username');
  if (savedUsername) {
    inputUsername.value = savedUsername;
  }

  generateRoomIdBtn.addEventListener('click', () => {
    inputRoomId.value = generateRoomId();
  });

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = inputUsername.value.trim();
    const roomId = inputRoomId.value.trim().toUpperCase();

    if (!username || !roomId) return;

    localStorage.setItem('syncplay_username', username);
    joinModal.classList.add('hidden');

    socketClient.joinRoom(roomId, username);

    // Update URL query string without reloading page
    const newUrl = `${window.location.pathname}?room=${roomId}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
  });

  // Quick Copy Room ID
  quickCopyRoomBtn.addEventListener('click', () => {
    if (socketClient.roomId) {
      navigator.clipboard.writeText(socketClient.roomId).then(() => {
        showToast(`Copied room ID: ${socketClient.roomId}`, 'success');
      });
    }
  });

  // Re-sync button
  resyncBtn.addEventListener('click', () => {
    socketClient.requestSync();
  });

  // Host allow viewer control toggle
  allowViewerControlCheckbox.addEventListener('change', (e) => {
    socketClient.setViewerControlPermission(e.target.checked);
  });

  // =========================================================================
  // Role & UI State Management
  // =========================================================================
  socketClient.onRoleChange = ({ isHost, allowViewerControl, username, roomId }) => {
    roomBadge.classList.remove('hidden');
    currentRoomIdEl.textContent = roomId;

    if (isHost) {
      userRoleBadge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30';
      userRoleBadge.innerHTML = `<i data-lucide="crown" class="w-3.5 h-3.5 text-yellow-400"></i><span>HOST (You)</span>`;
      
      videoHostBadge.className = 'px-2.5 py-1 rounded-md bg-yellow-500/20 backdrop-blur-md border border-yellow-500/40 text-[11px] font-semibold text-yellow-300 flex items-center gap-1.5 shadow-lg';
      videoHostText.textContent = 'You are Host 👑';

      openMediaModalBtn.classList.remove('hidden');
      hostPermissionContainer.classList.remove('hidden');
      allowViewerControlCheckbox.checked = allowViewerControl;

      player.setViewerMode(false); // Host has full access
    } else {
      userRoleBadge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30';
      userRoleBadge.innerHTML = `<i data-lucide="eye" class="w-3.5 h-3.5 text-cyan-400"></i><span>VIEWER</span>`;

      videoHostBadge.className = 'px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-gray-300 flex items-center gap-1.5 shadow-lg';
      videoHostText.textContent = allowViewerControl ? 'Viewer (Control Allowed)' : 'Viewer (Host Controlled)';

      if (!allowViewerControl) {
        openMediaModalBtn.classList.add('hidden');
        player.setViewerMode(true); // Lock viewer controls
      } else {
        openMediaModalBtn.classList.remove('hidden');
        player.setViewerMode(false);
      }
      hostPermissionContainer.classList.add('hidden');
    }

    if (window.lucide) window.lucide.createIcons();
  };

  // User list update
  socketClient.onUserListUpdate = (users) => {
    collaboratorsCount.textContent = users.length;
    tabUsersCount.textContent = users.length;

    usersList.innerHTML = '';
    users.forEach(u => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5';

      const isCurrent = u.id === socketClient.socket.id;
      const roleTag = u.isHost 
        ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">HOST 👑</span>`
        : `<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">VIEWER</span>`;

      item.innerHTML = `
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg ${u.isHost ? 'bg-yellow-500/20 text-yellow-400' : 'bg-purple-500/20 text-purple-400'} flex items-center justify-center font-bold text-xs uppercase">
            ${u.username.charAt(0)}
          </div>
          <span class="text-xs font-semibold text-white ${isCurrent ? 'text-purple-300' : ''}">${u.username} ${isCurrent ? '(You)' : ''}</span>
        </div>
        ${roleTag}
      `;
      usersList.appendChild(item);
    });
  };

  // Click on video when locked gives visual guidance
  playerContainer.addEventListener('click', (e) => {
    if (!socketClient.canControl() && !e.target.closest('#reaction-container') && !e.target.closest('#viewer-locked-banner')) {
      viewerLockedBanner.classList.remove('hidden');
      setTimeout(() => {
        viewerLockedBanner.classList.add('hidden');
      }, 2500);
    }
  });

  // =========================================================================
  // Media Modal Management
  // =========================================================================
  function openMediaModal() {
    mediaModal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  function closeMediaModal() {
    mediaModal.classList.add('hidden');
  }

  openMediaModalBtn.addEventListener('click', openMediaModal);
  idleLoadBtn.addEventListener('click', openMediaModal);
  closeMediaModalBtn.addEventListener('click', closeMediaModal);

  // Switch Media Tabs
  function setMediaTab(tab) {
    const tabs = [mediaTabYt, mediaTabUpload, mediaTabUrl];
    const contents = [contentTabYt, contentTabUpload, contentTabUrl];

    tabs.forEach(t => {
      t.className = 'flex-1 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition';
    });
    contents.forEach(c => c.classList.add('hidden'));

    if (tab === 'yt') {
      mediaTabYt.className = 'flex-1 py-2 rounded-lg text-xs font-semibold bg-purple-600 text-white shadow transition';
      contentTabYt.classList.remove('hidden');
    } else if (tab === 'upload') {
      mediaTabUpload.className = 'flex-1 py-2 rounded-lg text-xs font-semibold bg-purple-600 text-white shadow transition';
      contentTabUpload.classList.remove('hidden');
    } else if (tab === 'url') {
      mediaTabUrl.className = 'flex-1 py-2 rounded-lg text-xs font-semibold bg-purple-600 text-white shadow transition';
      contentTabUrl.classList.remove('hidden');
    }
  }

  mediaTabYt.addEventListener('click', () => setMediaTab('yt'));
  mediaTabUpload.addEventListener('click', () => setMediaTab('upload'));
  mediaTabUrl.addEventListener('click', () => setMediaTab('url'));

  window.SyncPlayAppToast = showToast;

  // 1. YouTube Loader
  function extractYouTubeId(urlOrId) {
    if (!urlOrId) return null;
    urlOrId = urlOrId.trim();

    // Direct 11-character Video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
      return urlOrId;
    }

    // Handles:
    // https://www.youtube.com/watch?v=VIDEO_ID
    // https://www.youtube.com/watch?feature=shared&v=VIDEO_ID
    // https://youtu.be/VIDEO_ID
    // https://www.youtube.com/shorts/VIDEO_ID
    // https://www.youtube.com/embed/VIDEO_ID
    // https://www.youtube.com/live/VIDEO_ID
    // https://m.youtube.com/watch?v=VIDEO_ID
    const patterns = [
      /[?&]v=([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = urlOrId.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  function loadYouTubeUrl(url, title = 'YouTube Broadcast') {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      showToast('Please enter a valid YouTube URL or 11-digit Video ID', 'error');
      return;
    }

    socketClient.changeMedia({
      type: 'youtube',
      src: videoId,
      title: title || `YouTube: ${videoId}`,
      mediaKind: 'video'
    });

    closeMediaModal();
    ytUrlInput.value = '';
  }

  ytLoadBtn.addEventListener('click', () => {
    loadYouTubeUrl(ytUrlInput.value);
  });

  // YouTube Sample Presets
  document.querySelectorAll('.sample-yt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const vid = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title');
      loadYouTubeUrl(vid, title);
    });
  });

  // Idle Screen Sample Demo
  idleSampleBtn.addEventListener('click', () => {
    loadYouTubeUrl('aqz-KE-bpKQ', 'Big Buck Bunny (4K Animation)');
  });

  // 2. File Upload (Video & Music)
  fileDropzone.addEventListener('click', () => {
    mediaFileInput.click();
  });

  fileDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropzone.classList.add('active');
  });

  fileDropzone.addEventListener('dragleave', () => {
    fileDropzone.classList.remove('active');
  });

  fileDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropzone.classList.remove('active');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  mediaFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  function handleFileUpload(file) {
    if (!file) return;

    uploadProgressContainer.classList.remove('hidden');
    uploadFilename.textContent = file.name;
    uploadPercent.textContent = '0%';
    uploadProgressBar.style.width = '0%';
    uploadStatusHint.textContent = 'Broadcasting file to server storage...';

    const formData = new FormData();
    formData.append('mediaFile', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        uploadPercent.textContent = `${percent}%`;
        uploadProgressBar.style.width = `${percent}%`;
        if (percent >= 100) {
          uploadStatusHint.textContent = 'Processing media file on server...';
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success) {
            showToast(`Uploaded ${res.originalName} successfully!`, 'success');
            
            socketClient.changeMedia({
              type: 'upload',
              src: res.url,
              title: res.originalName,
              mediaKind: res.mediaKind
            });

            closeMediaModal();
            uploadProgressContainer.classList.add('hidden');
            mediaFileInput.value = '';
          } else {
            showToast(res.message || 'Upload failed', 'error');
          }
        } catch (e) {
          showToast('Error processing server response', 'error');
        }
      } else {
        showToast('Server error during upload: ' + xhr.statusText, 'error');
      }
    };

    xhr.onerror = () => {
      showToast('Network error during file upload', 'error');
    };

    xhr.send(formData);
  }

  // 3. Direct URL / Instagram Loader
  function loadDirectUrl(url, kind = 'video', title = 'Web Media Stream') {
    if (!url || !url.trim()) {
      showToast('Please enter a valid URL', 'error');
      return;
    }
    url = url.trim();

    // Auto-detect YouTube links pasted in Direct URL tab!
    const ytId = extractYouTubeId(url);
    if (ytId) {
      loadYouTubeUrl(url, title || 'YouTube Video');
      return;
    }

    // Check if it's audio
    const isAudio = kind === 'audio' || /\.(mp3|wav|ogg|aac|flac|m4a)(\?.*)?$/i.test(url);

    socketClient.changeMedia({
      type: 'direct',
      src: url,
      title: title || (isAudio ? 'Audio Stream' : 'Video Stream'),
      mediaKind: isAudio ? 'audio' : 'video'
    });

    closeMediaModal();
    directUrlInput.value = '';
  }

  directLoadBtn.addEventListener('click', () => {
    loadDirectUrl(directUrlInput.value);
  });

  // Direct Samples
  document.querySelectorAll('.sample-direct-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      const kind = btn.getAttribute('data-kind');
      const title = btn.getAttribute('data-title');
      loadDirectUrl(url, kind, title);
    });
  });

  // =========================================================================
  // Share Invite Modal
  // =========================================================================
  function getInviteUrl() {
    const origin = window.location.origin;
    const path = window.location.pathname;
    return `${origin}${path}?room=${socketClient.roomId || 'DEFAULT'}`;
  }

  openShareModalBtn.addEventListener('click', () => {
    shareLinkInput.value = getInviteUrl();
    shareModal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  });

  closeShareModalBtn.addEventListener('click', () => {
    shareModal.classList.add('hidden');
  });

  copyShareLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(shareLinkInput.value).then(() => {
      showToast('Invite link copied to clipboard! 📋', 'success');
    });
  });

  shareWhatsappBtn.addEventListener('click', () => {
    const text = encodeURIComponent(`Join my SyncPlay Watch Party! Watch video & listen to music together in real-time:\n${getInviteUrl()}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  });

  shareTelegramBtn.addEventListener('click', () => {
    const url = encodeURIComponent(getInviteUrl());
    const text = encodeURIComponent('Join my SyncPlay Watch Party!');
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  });

  shareTwitterBtn.addEventListener('click', () => {
    const url = encodeURIComponent(getInviteUrl());
    const text = encodeURIComponent('Join my SyncPlay Watch Party! Watching in real-time sync with friends:');
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  });

  // =========================================================================
  // Live Chat System
  // =========================================================================
  tabChatBtn.addEventListener('click', () => {
    tabChatBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/30 text-purple-300 border border-purple-500/40 transition';
    tabUsersBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 border border-transparent transition';
    chatTabContent.classList.remove('hidden');
    usersTabContent.classList.add('hidden');
  });

  tabUsersBtn.addEventListener('click', () => {
    tabUsersBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/30 text-purple-300 border border-purple-500/40 transition';
    tabChatBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 border border-transparent transition';
    usersTabContent.classList.remove('hidden');
    chatTabContent.classList.add('hidden');
  });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    socketClient.sendChatMessage(text);
    chatInput.value = '';
  });

  clearChatBtn.addEventListener('click', () => {
    chatMessages.innerHTML = `
      <div class="text-[11px] text-gray-500 text-center py-2">Chat history cleared</div>
    `;
  });

  socketClient.onChatMessage = (msg) => {
    const isMe = msg.senderId === socketClient.socket.id;
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`;

    const roleBadge = msg.isHost 
      ? `<span class="text-[10px] font-bold text-yellow-400">👑 HOST</span>`
      : '';

    msgDiv.innerHTML = `
      <div class="flex items-center gap-1.5 text-[10px] text-gray-400 px-1">
        <span class="font-semibold text-gray-300">${msg.senderName}</span>
        ${roleBadge}
        <span>${msg.timestamp}</span>
      </div>
      <div class="p-2.5 rounded-xl max-w-[85%] text-xs leading-relaxed break-words ${
        isMe 
          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-sm' 
          : 'bg-white/10 text-gray-200 rounded-tl-sm border border-white/5'
      }">
        ${escapeHtml(msg.text)}
      </div>
    `;

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // =========================================================================
  // Floating Reaction Bursts
  // =========================================================================
  reactionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      socketClient.sendReaction(emoji);
    });
  });

  socketClient.onReaction = ({ emoji, senderName }) => {
    spawnFloatingEmoji(emoji);
  };

  function spawnFloatingEmoji(emoji) {
    if (!reactionContainer) return;
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.textContent = emoji;

    // Random horizontal position (15% to 85% of stage width)
    const randomLeft = Math.floor(Math.random() * 70) + 15;
    el.style.left = `${randomLeft}%`;

    reactionContainer.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // =========================================================================
  // Synchronized Fullscreen & Theater Mode
  // =========================================================================
  const fullscreenPromptBanner = document.getElementById('fullscreen-prompt-banner');

  theaterBtn.addEventListener('click', () => {
    document.body.classList.toggle('theater-mode');
  });

  fullscreenBtn.addEventListener('click', () => {
    const isCurrentlyFullscreen = !!document.fullscreenElement || document.body.classList.contains('cinema-max-fullscreen');
    const targetState = !isCurrentlyFullscreen;

    // If host, synchronize fullscreen across all connected devices!
    if (socketClient.canControl()) {
      socketClient.setFullscreen(targetState);
    }

    applyFullscreenState(targetState);
  });

  // When Host toggles fullscreen, apply to all viewers
  socketClient.onFullscreenSync = (isFullscreen, initiatedBy) => {
    applyFullscreenState(isFullscreen);
    if (isFullscreen) {
      showToast(`👑 ${initiatedBy} enabled Fullscreen for everyone!`, 'info');
    } else {
      showToast(`👑 ${initiatedBy} exited Fullscreen`, 'info');
    }
  };

  function applyFullscreenState(enable) {
    const fullscreenIcon = document.getElementById('fullscreen-icon');

    if (enable) {
      // 1. Expand CSS Full-Window Cinema Mode (100% reliable across all browsers & devices)
      document.body.classList.add('cinema-max-fullscreen');

      // 2. Try OS native fullscreen
      if (!document.fullscreenElement) {
        const req = playerContainer.requestFullscreen ? playerContainer.requestFullscreen() 
          : playerContainer.webkitRequestFullscreen ? playerContainer.webkitRequestFullscreen() 
          : null;

        if (req && req.catch) {
          req.catch(() => {
            // Browser restricted automatic OS fullscreen without direct click; show quick 1-click banner
            if (fullscreenPromptBanner) fullscreenPromptBanner.classList.remove('hidden');
          });
        }
      }

      if (fullscreenIcon) fullscreenIcon.setAttribute('data-lucide', 'minimize');
    } else {
      // Exit Cinema Mode
      document.body.classList.remove('cinema-max-fullscreen');
      if (fullscreenPromptBanner) fullscreenPromptBanner.classList.add('hidden');

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      if (fullscreenIcon) fullscreenIcon.setAttribute('data-lucide', 'maximize');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // 1-Click Banner trigger for OS native fullscreen
  if (fullscreenPromptBanner) {
    fullscreenPromptBanner.addEventListener('click', () => {
      fullscreenPromptBanner.classList.add('hidden');
      if (playerContainer.requestFullscreen) {
        playerContainer.requestFullscreen().catch(() => {});
      }
    });
  }

  // Auto-hide controls in cinema mode after inactivity
  let controlsTimeout = null;
  document.addEventListener('mousemove', () => {
    if (document.body.classList.contains('cinema-max-fullscreen')) {
      document.body.classList.add('show-controls');
      clearTimeout(controlsTimeout);
      controlsTimeout = setTimeout(() => {
        document.body.classList.remove('show-controls');
      }, 3000);
    }
  });

  document.addEventListener('fullscreenchange', () => {
    const fullscreenIcon = document.getElementById('fullscreen-icon');
    if (!document.fullscreenElement && !document.body.classList.contains('cinema-max-fullscreen')) {
      if (fullscreenIcon) fullscreenIcon.setAttribute('data-lucide', 'maximize');
    } else {
      if (fullscreenIcon) fullscreenIcon.setAttribute('data-lucide', 'minimize');
    }
    if (window.lucide) window.lucide.createIcons();
  });

});
