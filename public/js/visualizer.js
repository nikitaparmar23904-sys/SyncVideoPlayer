/**
 * SyncPlay Visualizer Engine
 * Provides futuristic canvas audio frequency spectrum & waveform animations
 */
class AudioVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.bufferLength = 0;
    this.animationId = null;
    this.isPlaying = false;
    this.isCrossoriginSimulated = false;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = this.canvas.parentElement.clientWidth || 800;
    this.canvas.height = this.canvas.parentElement.clientHeight || 450;
  }

  attachMediaElement(mediaElement) {
    if (!this.canvas) return;
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioCtx();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 128;
        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      if (!this.source && mediaElement) {
        this.source = this.audioContext.createMediaElementSource(mediaElement);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      }
      this.isCrossoriginSimulated = false;
    } catch (err) {
      // If CORS or restriction occurs, fallback to animated rhythmic simulation
      console.warn('Web Audio API restricted by CORS or already bound; using simulation mode.', err);
      this.isCrossoriginSimulated = true;
      this.bufferLength = 64;
      this.dataArray = new Uint8Array(this.bufferLength);
    }
  }

  start() {
    this.isPlaying = true;
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    this.render();
  }

  stop() {
    this.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.clearCanvas();
  }

  clearCanvas() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render() {
    if (!this.isPlaying) return;
    this.animationId = requestAnimationFrame(() => this.render());

    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    if (this.isCrossoriginSimulated || !this.analyser) {
      // Procedural rhythmic synthwave visualizer simulation
      const time = Date.now() * 0.003;
      for (let i = 0; i < this.bufferLength; i++) {
        const val = Math.sin(time + i * 0.2) * 50 + Math.cos(time * 0.5 + i * 0.1) * 30 + 120;
        this.dataArray[i] = Math.max(20, Math.min(255, val));
      }
    } else {
      this.analyser.getByteFrequencyData(this.dataArray);
    }

    const barCount = 48;
    const barWidth = (width / barCount) * 0.7;
    const barGap = (width / barCount) * 0.3;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * (this.bufferLength * 0.75));
      const value = this.dataArray[dataIndex] || 20;
      const percent = value / 255;
      const barHeight = Math.max(6, percent * (height * 0.5));

      const x = i * (barWidth + barGap) + barGap / 2;
      const yBottom = height;
      const yTop = yBottom - barHeight;

      // Dynamic Gradient
      const gradient = ctx.createLinearGradient(0, height, 0, yTop);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.2)');
      gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.7)');
      gradient.addColorStop(1, 'rgba(236, 72, 153, 0.9)');

      ctx.fillStyle = gradient;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(6, 182, 212, 0.6)';

      // Draw rounded top bar
      ctx.beginPath();
      ctx.roundRect(x, yTop, barWidth, barHeight, [4, 4, 0, 0]);
      ctx.fill();

      // Top neon cap
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ffffff';
      ctx.fillRect(x, yTop - 3, barWidth, 2);
    }
  }
}

window.AudioVisualizer = AudioVisualizer;
