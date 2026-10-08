/**
 * SyncPlay Unified Media Player Engine
 * Manages YouTube IFrame API and HTML5 Video/Audio players under a single interface
 */
class UnifiedPlayer {
  constructor() {
    this.currentType = 'none'; // 'none' | 'youtube' | 'html5_video' | 'html5_audio'
    this.mediaKind = 'video';
    this.isPlaying = false;
    this.duration = 0;
    this.currentTime = 0;
    this.playbackRate = 1;
    this.isMuted = false;
    this.volume = 0.9;
    this.isRemoteAction = false;
    this.isDraggingSeekBar = false;
    this.visualizer = null;

    // DOM Elements
    this.ytContainer = document.getElementById('yt-player-container');
    this.videoContainer = document.getElementById('html5-video-container');
    this.audioContainer = document.getElementById('html5-audio-container');
    this.idleScreen = document.getElementById('idle-screen');
    
    this.videoEl = document.getElementById('html5-video');
    this.audioEl = document.getElementById('html5-audio');
    this.vinylDisc = document.getElementById('vinyl-disc');
    this.audioTitle = document.getElementById('audio-track-title');

    this.seekBar = document.getElementById('seek-bar');
    this.currentTimeEl = document.getElementById('time-current');
    this.durationEl = document.getElementById('time-duration');
    this.playBtn = document.getElementById('play-pause-btn');
    this.playIcon = document.getElementById('play-icon');
    this.playText = document.getElementById('play-text');
    this.rewindBtn = document.getElementById('rewind-btn');
    this.forwardBtn = document.getElementById('forward-btn');
    this.volumeBar = document.getElementById('volume-bar');
    this.muteBtn = document.getElementById('mute-btn');
    this.volumeIcon = document.getElementById('volume-icon');
    this.speedSelect = document.getElementById('playback-speed-select');
    this.mediaTypeBadge = document.getElementById('media-type-badge');
    this.mediaTitleEl = document.getElementById('media-current-title');
    this.syncDriftText = document.getElementById('sync-drift-text');

    // Callbacks for Host triggers
    this.onPlay = null;
    this.onPause = null;
    this.onSeek = null;
    this.onRateChange = null;

    // YouTube State
    this.ytPlayer = null;
    this.isYtReady = false;
    this.pendingYtVideoId = null;

    this.init();
  }

  init() {
    this.setupHtml5Listeners();
    this.setupUIControls();
    this.initYouTube();
    
    if (window.AudioVisualizer) {
      this.visualizer = new window.AudioVisualizer('visualizer-canvas');
    }

    // Progress update loop (every 250ms)
    setInterval(() => this.updateTimeAndProgress(), 250);
  }

  initYouTube() {
    const checkYT = () => {
      if (window.YT && window.YT.Player) {
        this.createYouTubePlayer();
      } else {
        setTimeout(checkYT, 100);
      }
    };
    checkYT();
  }

  createYouTubePlayer() {
    this.ytPlayer = new window.YT.Player('yt-player', {
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: 0,
        controls: 1, // Enable native video controls & quality selector
        enablejsapi: 1,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        playsinline: 1
      },
      events: {
        onReady: () => {
          this.isYtReady = true;
          this.ytPlayer.setVolume(this.volume * 100);
          if (this.pendingYtVideoId) {
            this.loadYouTube(
              this.pendingYtVideoId.id, 
              this.pendingYtVideoId.startSeconds,
              this.pendingYtVideoId.isPlaying
            );
            this.pendingYtVideoId = null;
          }
        },
        onStateChange: (event) => {
          this.handleYouTubeStateChange(event);
        },
        onError: (event) => {
          console.error('[YouTube Error]', event.data);
          let errText = 'Unable to play this YouTube video.';
          if (event.data === 150 || event.data === 101) {
            errText = 'This YouTube video restricts playback outside youtube.com. Please try another video!';
          } else if (event.data === 2) {
            errText = 'Invalid YouTube video ID or link.';
          } else if (event.data === 100) {
            errText = 'The YouTube video was not found or was removed.';
          }
          if (window.SyncPlayAppToast) {
            window.SyncPlayAppToast(errText, 'error');
          }
        }
      }
    });
  }

  handleYouTubeStateChange(event) {
    if (this.isRemoteAction) return;

    if (event.data === window.YT.PlayerState.PLAYING) {
      this.isPlaying = true;
      this.updatePlayBtnUI(true);
      if (this.onPlay) this.onPlay(this.getCurrentTime());
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      this.isPlaying = false;
      this.updatePlayBtnUI(false);
      if (this.onPause) this.onPause(this.getCurrentTime());
    } else if (event.data === window.YT.PlayerState.ENDED) {
      this.isPlaying = false;
      this.updatePlayBtnUI(false);
      if (this.onPause) this.onPause(this.getCurrentTime());
    }
  }

  setupHtml5Listeners() {
    const attach = (el) => {
      el.addEventListener('play', () => {
        if (this.isRemoteAction) return;
        this.isPlaying = true;
        this.updatePlayBtnUI(true);
        if (this.onPlay) this.onPlay(this.getCurrentTime());
      });

      el.addEventListener('pause', () => {
        if (this.isRemoteAction) return;
        this.isPlaying = false;
        this.updatePlayBtnUI(false);
        if (this.onPause) this.onPause(this.getCurrentTime());
      });

      el.addEventListener('durationchange', () => {
        this.duration = el.duration || 0;
        this.updateTimeDisplay();
      });

      el.addEventListener('ended', () => {
        this.isPlaying = false;
        this.updatePlayBtnUI(false);
        if (this.onPause) this.onPause(this.getCurrentTime());
      });
    };

    attach(this.videoEl);
    attach(this.audioEl);
  }

  setupUIControls() {
    // Play/Pause button
    this.playBtn.addEventListener('click', () => {
      if (this.isPlaying) {
        this.userPause();
      } else {
        this.userPlay();
      }
    });

    // Rewind 10s
    this.rewindBtn.addEventListener('click', () => {
      const targetTime = Math.max(0, this.getCurrentTime() - 10);
      this.userSeek(targetTime);
    });

    // Forward 10s
    this.forwardBtn.addEventListener('click', () => {
      const targetTime = Math.min(this.duration || 99999, this.getCurrentTime() + 10);
      this.userSeek(targetTime);
    });

    // Seek bar interaction
    this.seekBar.addEventListener('input', () => {
      this.isDraggingSeekBar = true;
      const targetTime = (parseFloat(this.seekBar.value) / 100) * (this.duration || 1);
      this.currentTimeEl.textContent = this.formatTime(targetTime);
    });

    this.seekBar.addEventListener('change', () => {
      const targetTime = (parseFloat(this.seekBar.value) / 100) * (this.duration || 1);
      this.isDraggingSeekBar = false;
      this.userSeek(targetTime);
    });

    // Volume Slider
    this.volumeBar.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      this.setVolume(vol);
    });

    // Mute Button
    this.muteBtn.addEventListener('click', () => {
      this.toggleMute();
    });

    // Playback Speed
    this.speedSelect.addEventListener('change', (e) => {
      const rate = parseFloat(e.target.value);
      this.userSetPlaybackRate(rate);
    });
  }

  // User actions triggered locally
  userPlay() {
    this.play();
    if (this.onPlay) this.onPlay(this.getCurrentTime());
  }

  userPause() {
    this.pause();
    if (this.onPause) this.onPause(this.getCurrentTime());
  }

  userSeek(targetTime) {
    this.seek(targetTime);
    if (this.onSeek) this.onSeek(targetTime);
  }

  userSetPlaybackRate(rate) {
    this.setPlaybackRate(rate);
    if (this.onRateChange) this.onRateChange(rate);
  }

  // Load Media Methods
  loadMedia({ type, src, title, mediaKind, currentTime = 0, isPlaying = false, playbackRate = 1 }) {
    this.pause();
    this.currentTime = currentTime;
    this.playbackRate = playbackRate;
    this.mediaKind = mediaKind || 'video';

    // Reset and hide all viewports
    this.ytContainer.classList.remove('active');
    this.videoContainer.classList.remove('active');
    this.audioContainer.classList.remove('active');
    this.idleScreen.classList.add('hidden');
    this.idleScreen.style.display = 'none';

    if (this.visualizer) {
      this.visualizer.stop();
    }

    this.mediaTitleEl.textContent = title || 'Untitled Media';
    this.speedSelect.value = playbackRate.toString();

    if (type === 'youtube') {
      this.currentType = 'youtube';
      this.mediaTypeBadge.textContent = 'YOUTUBE';
      this.mediaTypeBadge.className = 'px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30 shrink-0';
      this.ytContainer.classList.add('active');

      if (this.isYtReady && this.ytPlayer && (this.ytPlayer.cueVideoById || this.ytPlayer.loadVideoById)) {
        this.loadYouTube(src, currentTime, isPlaying);
      } else {
        this.pendingYtVideoId = { id: src, startSeconds: currentTime, isPlaying };
      }

    } else if (type === 'upload' || type === 'direct') {
      if (this.mediaKind === 'audio') {
        this.currentType = 'html5_audio';
        this.mediaTypeBadge.textContent = 'AUDIO STREAM';
        this.mediaTypeBadge.className = 'px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-pink-500/20 text-pink-300 border border-pink-500/30 shrink-0';
        this.audioContainer.classList.add('active');
        this.audioTitle.textContent = title || 'Audio Track';

        this.audioEl.src = src;
        this.audioEl.playbackRate = this.playbackRate;
        this.audioEl.currentTime = currentTime;

        if (this.visualizer) {
          this.visualizer.attachMediaElement(this.audioEl);
        }

      } else {
        this.currentType = 'html5_video';
        this.mediaTypeBadge.textContent = type === 'upload' ? 'LOCAL VIDEO' : 'WEB VIDEO';
        this.mediaTypeBadge.className = 'px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0';
        this.videoContainer.classList.add('active');

        this.videoEl.src = src;
        this.videoEl.playbackRate = this.playbackRate;
        this.videoEl.currentTime = currentTime;
      }
    } else {
      this.currentType = 'none';
      this.mediaTypeBadge.textContent = 'STANDBY';
      this.mediaTypeBadge.className = 'px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0';
      this.idleScreen.classList.remove('hidden');
      this.idleScreen.style.display = 'flex';
    }

    if (isPlaying) {
      setTimeout(() => this.play(), 250);
    }
  }

  loadYouTube(videoId, startSeconds = 0, isPlaying = false) {
    if (!this.ytPlayer) return;
    this.isRemoteAction = true;

    if (isPlaying && this.ytPlayer.loadVideoById) {
      this.ytPlayer.loadVideoById({
        videoId: videoId,
        startSeconds: startSeconds || 0
      });
    } else if (this.ytPlayer.cueVideoById) {
      this.ytPlayer.cueVideoById({
        videoId: videoId,
        startSeconds: startSeconds || 0
      });
    } else if (this.ytPlayer.loadVideoById) {
      this.ytPlayer.loadVideoById({
        videoId: videoId,
        startSeconds: startSeconds || 0
      });
      this.ytPlayer.pauseVideo();
    }

    setTimeout(() => {
      this.isRemoteAction = false;
    }, 400);
  }

  // Playback Control Execution
  play() {
    this.isPlaying = true;
    this.updatePlayBtnUI(true);

    if (this.currentType === 'youtube' && this.ytPlayer && this.ytPlayer.playVideo) {
      this.ytPlayer.playVideo();
    } else if (this.currentType === 'html5_video' && this.videoEl) {
      this.videoEl.play().catch(err => console.log('Autoplay policy caught:', err));
    } else if (this.currentType === 'html5_audio' && this.audioEl) {
      this.audioEl.play().catch(err => console.log('Autoplay policy caught:', err));
      if (this.vinylDisc) this.vinylDisc.classList.add('playing');
      if (this.visualizer) this.visualizer.start();
    }
  }

  pause() {
    this.isPlaying = false;
    this.updatePlayBtnUI(false);

    if (this.currentType === 'youtube' && this.ytPlayer && this.ytPlayer.pauseVideo) {
      this.ytPlayer.pauseVideo();
    } else if (this.currentType === 'html5_video' && this.videoEl) {
      this.videoEl.pause();
    } else if (this.currentType === 'html5_audio' && this.audioEl) {
      this.audioEl.pause();
      if (this.vinylDisc) this.vinylDisc.classList.remove('playing');
      if (this.visualizer) this.visualizer.stop();
    }
  }

  seek(seconds) {
    seconds = Math.max(0, seconds);
    if (this.currentType === 'youtube' && this.ytPlayer && this.ytPlayer.seekTo) {
      this.ytPlayer.seekTo(seconds, true);
    } else if (this.currentType === 'html5_video' && this.videoEl) {
      this.videoEl.currentTime = seconds;
    } else if (this.currentType === 'html5_audio' && this.audioEl) {
      this.audioEl.currentTime = seconds;
    }
  }

  setPlaybackRate(rate) {
    this.playbackRate = rate;
    this.speedSelect.value = rate.toString();

    if (this.currentType === 'youtube' && this.ytPlayer && this.ytPlayer.setPlaybackRate) {
      this.ytPlayer.setPlaybackRate(rate);
    } else if (this.currentType === 'html5_video' && this.videoEl) {
      this.videoEl.playbackRate = rate;
    } else if (this.currentType === 'html5_audio' && this.audioEl) {
      this.audioEl.playbackRate = rate;
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.volumeBar.value = this.volume;

    if (this.currentType === 'youtube' && this.ytPlayer && this.ytPlayer.setVolume) {
      this.ytPlayer.setVolume(this.volume * 100);
    } else if (this.currentType === 'html5_video' && this.videoEl) {
      this.videoEl.volume = this.volume;
    } else if (this.currentType === 'html5_audio' && this.audioEl) {
      this.audioEl.volume = this.volume;
    }

    this.updateVolumeIcon();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.currentType === 'youtube' && this.ytPlayer) {
      if (this.isMuted) this.ytPlayer.mute();
      else this.ytPlayer.unMute();
    } else if (this.currentType === 'html5_video' && this.videoEl) {
      this.videoEl.muted = this.isMuted;
    } else if (this.currentType === 'html5_audio' && this.audioEl) {
      this.audioEl.muted = this.isMuted;
    }
    this.updateVolumeIcon();
  }

  updateVolumeIcon() {
    if (this.isMuted || this.volume === 0) {
      this.volumeIcon.setAttribute('data-lucide', 'volume-x');
    } else if (this.volume < 0.5) {
      this.volumeIcon.setAttribute('data-lucide', 'volume-1');
    } else {
      this.volumeIcon.setAttribute('data-lucide', 'volume-2');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // Remote Synchronization Handlers (invoked by Socket.io without loopback)
  remotePlay(targetTime, serverTime) {
    this.isRemoteAction = true;
    let exactTime = targetTime;
    if (serverTime) {
      const latency = Math.max(0, (Date.now() - serverTime) / 1000);
      exactTime = targetTime + (latency * (this.playbackRate || 1));
    }

    if (typeof exactTime === 'number') {
      this.seek(exactTime);
    }
    this.play();

    setTimeout(() => {
      this.isRemoteAction = false;
    }, 250);
  }

  remotePause(targetTime, serverTime) {
    this.isRemoteAction = true;
    if (typeof targetTime === 'number') {
      this.seek(targetTime);
    }
    this.pause();

    setTimeout(() => {
      this.isRemoteAction = false;
    }, 250);
  }

  remoteSeek(targetTime, serverTime) {
    this.isRemoteAction = true;
    this.seek(targetTime);

    setTimeout(() => {
      this.isRemoteAction = false;
    }, 250);
  }

  remoteRateChange(rate) {
    this.isRemoteAction = true;
    this.setPlaybackRate(rate);

    setTimeout(() => {
      this.isRemoteAction = false;
    }, 250);
  }

  // Precision Drift Alignment
  alignDrift(targetTime, hostIsPlaying) {
    const localTime = this.getCurrentTime();
    const drift = Math.abs(localTime - targetTime);

    // Update drift status display
    if (this.syncDriftText) {
      if (drift < 0.15) {
        this.syncDriftText.textContent = `Sync: Perfect (±${(drift * 1000).toFixed(0)}ms)`;
      } else {
        this.syncDriftText.textContent = `Sync: ±${drift.toFixed(2)}s`;
      }
    }

    // Tight drift correction: If drift is larger than 0.3s, seek immediately to eliminate delay
    if (drift > 0.3) {
      this.isRemoteAction = true;
      this.seek(targetTime);
      this.isRemoteAction = false;
    }

    // Ensure matching play state
    if (hostIsPlaying && !this.isPlaying) {
      this.remotePlay(targetTime);
    } else if (!hostIsPlaying && this.isPlaying) {
      this.remotePause(targetTime);
    }
  }

  // Getters & Time Formatting
  getCurrentTime() {
    if (this.currentType === 'youtube' && this.ytPlayer && this.ytPlayer.getCurrentTime) {
      return this.ytPlayer.getCurrentTime() || 0;
    } else if (this.currentType === 'html5_video' && this.videoEl) {
      return this.videoEl.currentTime || 0;
    } else if (this.currentType === 'html5_audio' && this.audioEl) {
      return this.audioEl.currentTime || 0;
    }
    return 0;
  }

  getDuration() {
    if (this.currentType === 'youtube' && this.ytPlayer && this.ytPlayer.getDuration) {
      return this.ytPlayer.getDuration() || 0;
    } else if (this.currentType === 'html5_video' && this.videoEl) {
      return this.videoEl.duration || 0;
    } else if (this.currentType === 'html5_audio' && this.audioEl) {
      return this.audioEl.duration || 0;
    }
    return 0;
  }

  updateTimeAndProgress() {
    if (this.currentType === 'none') return;
    
    this.duration = this.getDuration();
    this.currentTime = this.getCurrentTime();

    this.updateTimeDisplay();

    if (!this.isDraggingSeekBar && this.duration > 0) {
      const percentage = (this.currentTime / this.duration) * 100;
      this.seekBar.value = percentage;
    }
  }

  updateTimeDisplay() {
    this.currentTimeEl.textContent = this.formatTime(this.currentTime);
    this.durationEl.textContent = this.formatTime(this.duration);
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  updatePlayBtnUI(isPlaying) {
    if (isPlaying) {
      this.playIcon.setAttribute('data-lucide', 'pause');
      this.playText.textContent = 'Pause';
      this.playBtn.classList.remove('from-purple-600', 'to-indigo-600');
      this.playBtn.classList.add('from-pink-600', 'to-rose-600');
    } else {
      this.playIcon.setAttribute('data-lucide', 'play');
      this.playText.textContent = 'Play';
      this.playBtn.classList.remove('from-pink-600', 'to-rose-600');
      this.playBtn.classList.add('from-purple-600', 'to-indigo-600');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  setViewerMode(isViewerLocked) {
    // If controls locked for viewer, disable seek and forward/rewind
    this.seekBar.disabled = isViewerLocked;
    this.rewindBtn.disabled = isViewerLocked;
    this.forwardBtn.disabled = isViewerLocked;
    this.playBtn.disabled = isViewerLocked;

    if (isViewerLocked) {
      this.seekBar.classList.add('opacity-70', 'cursor-not-allowed');
      this.playBtn.classList.add('opacity-80', 'cursor-not-allowed');
      this.rewindBtn.classList.add('opacity-50', 'cursor-not-allowed');
      this.forwardBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      this.seekBar.classList.remove('opacity-70', 'cursor-not-allowed');
      this.playBtn.classList.remove('opacity-80', 'cursor-not-allowed');
      this.rewindBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      this.forwardBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

window.UnifiedPlayer = UnifiedPlayer;
