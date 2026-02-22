/**
 * Game Audio Engine — hybrid approach:
 *   • SFX  → Web Audio API  (pre-decoded buffers, ~3-5 ms latency)
 *   • BGM  → HTMLAudioElement (handles every MP3/OGG/WAV natively, loops)
 *
 * Loading is eager (on mount). AudioContext is resumed on first user gesture.
 * startBGM / play gracefully queue until assets are ready.
 */

const AudioCtx = window.AudioContext || window.webkitAudioContext;

class GameAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.buffers = {};
    this.bgmEl = null;
    this.enabled = true;
    this._ready = false;
    this._loaded = false;         // true once loadAll() finishes
    this._loadPromise = null;     // resolves when all assets are loaded
    this._bgmVolume = 0.25;
    this._pendingBGM = false;     // true if startBGM was called before load
    this._pendingBGMVol = 0.25;
  }

  /* ── Initialize AudioContext (safe to call multiple times) ───────── */
  async init() {
    if (this._ready) return;
    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this._ready = true;
    } catch (e) {
      console.warn('[AudioEngine] Failed to initialize:', e);
    }
  }

  /* ── Resume AudioContext (must be called from user gesture) ──────── */
  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (_) {}
    }
    // If BGM was pending, fire it now
    if (this._pendingBGM && this._loaded) {
      this._pendingBGM = false;
      this.startBGM(this._pendingBGMVol);
    }
  }

  /* ── Pre-decode a single SFX file ────────────────────────────────── */
  async _load(name, url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      this.buffers[name] = await this.ctx.decodeAudioData(arrayBuf);
      console.log(`[AudioEngine] Loaded SFX "${name}"`);
    } catch (e) {
      console.warn(`[AudioEngine] Failed to load SFX "${name}" from ${url}:`, e);
    }
  }

  /* ── Load ALL game sounds (call once, early — no gesture needed) ── */
  async loadAll() {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = this._doLoadAll();
    return this._loadPromise;
  }

  async _doLoadAll() {
    await this.init();

    // BGM via HTMLAudioElement — can buffer without gesture
    try {
      this.bgmEl = new Audio('/audio/game-start.mp3');
      this.bgmEl.loop = true;
      this.bgmEl.volume = 0;
      this.bgmEl.preload = 'auto';
      this.bgmEl.load();
      // Wait until browser has enough data to play through
      await new Promise((resolve) => {
        if (this.bgmEl.readyState >= 4) { resolve(); return; }
        this.bgmEl.addEventListener('canplaythrough', resolve, { once: true });
        // Timeout fallback so we don't block forever on slow networks
        setTimeout(resolve, 5000);
      });
      console.log('[AudioEngine] BGM ready');
    } catch (e) {
      console.warn('[AudioEngine] Failed to create BGM element:', e);
    }

    // SFX via Web Audio API
    if (this.ctx) {
      await Promise.all([
        this._load('capture',    '/audio/tile_acquired.mp3'),
        this._load('eliminated', '/audio/mixkit-player-losing-or-failing-2042.wav'),
      ]);
    }

    this._loaded = true;
    console.log('[AudioEngine] All sounds loaded');

    // If BGM was requested before load finished, start it now
    if (this._pendingBGM) {
      this._pendingBGM = false;
      this.startBGM(this._pendingBGMVol);
    }
  }

  /* ── Play a one-shot SFX (~3-5 ms latency) ──────────────────────── */
  play(name, volume = 1) {
    if (!this.enabled || !this.ctx || !this.buffers[name]) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers[name];

    const gain = this.ctx.createGain();
    gain.gain.value = volume;

    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(0);

    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }

  /* ── Start looping BGM with fade-in ──────────────────────────────── */
  startBGM(volume = 0.25) {
    if (!this.enabled) return;
    this._bgmVolume = volume;

    // If assets aren't loaded yet, queue the request
    if (!this._loaded || !this.bgmEl) {
      this._pendingBGM = true;
      this._pendingBGMVol = volume;
      return;
    }

    // If context is suspended (no gesture yet), queue
    if (this.ctx && this.ctx.state === 'suspended') {
      this._pendingBGM = true;
      this._pendingBGMVol = volume;
      return;
    }

    // Already playing — just adjust volume
    if (!this.bgmEl.paused) {
      this.bgmEl.volume = volume;
      return;
    }

    this.bgmEl.volume = 0;
    this.bgmEl.currentTime = 0;
    const playPromise = this.bgmEl.play();
    if (playPromise) {
      playPromise.catch(e => {
        console.warn('[AudioEngine] BGM play blocked:', e);
        // Will retry on next resume()
        this._pendingBGM = true;
        this._pendingBGMVol = volume;
      });
    }

    // Fade in
    let v = 0;
    const step = volume / 30;
    const fadeIn = setInterval(() => {
      v = Math.min(v + step, volume);
      if (this.bgmEl) this.bgmEl.volume = v;
      if (v >= volume) clearInterval(fadeIn);
    }, 33);
  }

  /* ── Stop BGM with fade-out ──────────────────────────────────────── */
  stopBGM() {
    this._pendingBGM = false;
    if (!this.bgmEl || this.bgmEl.paused) return;

    const el = this.bgmEl;
    let v = el.volume;
    const step = Math.max(v / 15, 0.002);
    const fadeOut = setInterval(() => {
      v = Math.max(v - step, 0);
      el.volume = v;
      if (v <= 0) {
        clearInterval(fadeOut);
        el.pause();
      }
    }, 33);
  }

  /* ── Toggle sound on/off ─────────────────────────────────────────── */
  setEnabled(on) {
    this.enabled = on;
    if (this.masterGain) {
      this.masterGain.gain.value = on ? 1 : 0;
    }
    if (!on) this.stopBGM();
  }

  /* ── Set master volume (0-1) ─────────────────────────────────────── */
  setVolume(v) {
    const vol = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = vol;
    if (this.bgmEl && !this.bgmEl.paused) {
      this.bgmEl.volume = this._bgmVolume * vol;
    }
  }

  /* ── Clean up ────────────────────────────────────────────────────── */
  dispose() {
    this.stopBGM();
    if (this.bgmEl) {
      this.bgmEl.pause();
      this.bgmEl.src = '';
      this.bgmEl = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.buffers = {};
    this._ready = false;
    this._loaded = false;
    this._loadPromise = null;
  }
}

export const audioEngine = new GameAudioEngine();
