export type SoundKeys = 'bg' | 'jump' | 'pickup' | 'hit';

class SoundController {
  private sounds: Record<SoundKeys, HTMLAudioElement | null> = {
    bg: null,
    jump: null,
    pickup: null,
    hit: null
  };
  private bgPlaying = false;
  private lastPlayed: Record<SoundKeys, number> = {
    bg: 0,
    jump: 0,
    pickup: 0,
    hit: 0
  };
  // minimum spacing (ms) between plays for each key
  private cooldownMs: Record<SoundKeys, number> = {
    bg: 0,
    jump: 150,
    pickup: 100,
    hit: 800
  };

  constructor() {}

  init(basePath = '/Assets/Sounds/') {
    try {
      // create audio elements (do not autoplay without user interaction in some browsers)
      this.sounds.bg = new Audio(basePath + '13. option2. Game running.mp3');
      this.sounds.bg.loop = true;
      this.sounds.bg.preload = 'auto';

      this.sounds.jump = new Audio(basePath + '15. option2. Fly.MP3');
      this.sounds.jump.preload = 'auto';

      this.sounds.pickup = new Audio(basePath + '16. option1. Plus.mp3');
      this.sounds.pickup.preload = 'auto';

      this.sounds.hit = new Audio(basePath + '18. option1. rock.MP3');
      this.sounds.hit.preload = 'auto';
    } catch (e) {
      // swallow errors - file paths may vary on some deployments
      console.warn('SoundController.init failed to create audio elements', e);
    }
  }

  // Start background loop (call after user gesture if needed)
  playBackground() {
    try {
      if (!this.sounds.bg) return;
      // Some browsers require a user gesture to play audio. We attempt to play,
      // but failures should be handled silently.
      this.sounds.bg.volume = 0.45;
      const p = this.sounds.bg.play();
      if (p && typeof (p as any).catch === 'function') {
        (p as any).catch(() => { /* ignore autoplay block */ });
      }
      this.bgPlaying = true;
    } catch (e) {
      // ignore
    }
  }

  // Try to autoplay by starting muted then unmuting. Some browsers still
  // prevent unmute without user gesture, but this increases success rate.
  playBackgroundForced(unmuteAfterMs = 300) {
    try {
      if (!this.sounds.bg) return;
      this.sounds.bg.muted = true;
      this.sounds.bg.volume = 0.0;
      const p = this.sounds.bg.play();
      if (p && typeof (p as any).catch === 'function') {
        (p as any).catch(() => { /* ignore autoplay block */ });
      }
      this.bgPlaying = true;
      // attempt to unmute after a short delay
      setTimeout(() => {
        try {
          this.sounds.bg!.muted = false;
          this.sounds.bg!.volume = 0.45;
        } catch (e) {}
      }, unmuteAfterMs);
    } catch (e) {}
  }

  stopBackground() {
    try {
      if (!this.sounds.bg) return;
      this.sounds.bg.pause();
      this.sounds.bg.currentTime = 0;
      this.bgPlaying = false;
    } catch (e) {}
  }

  // Effects: play short sounds; use cloneNode to allow overlapping plays
  private playEffect(key: SoundKeys) {
    try {
      const src = this.sounds[key];
      const now = Date.now();
      const last = this.lastPlayed[key] || 0;
      const cd = this.cooldownMs[key] || 0;
      if (now - last < cd) return; // skip if within cooldown
      this.lastPlayed[key] = now;
      if (!src) return;
      // clone element so multiple plays can overlap
      const node = src.cloneNode(true) as HTMLAudioElement;
      // reduce pickup volume so it's less loud compared to other effects
      node.volume = (key === 'pickup') ? 0.45 : (key === 'jump' ? 0.7 : 0.9);
      const p = node.play();
      if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
    } catch (e) {}
  }

  playJump() { this.playEffect('jump'); }
  playPickup() { this.playEffect('pickup'); }
  playHit() { this.playEffect('hit'); }

  // convenience to ensure initialization and attempt to resume audio on user gesture
  resumeOnUserGesture() {
    try {
      ['click', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) => {
        window.addEventListener(ev, () => {
          try { if (this.sounds.bg && !this.bgPlaying) this.playBackground(); } catch (e) {}
        }, { once: true });
      });
    } catch (e) {}
  }
}

const SC = new SoundController();
export default SC;
