import { Assets } from 'pixi.js';
import { sound as PixiSound } from '@pixi/sound';

// Import sounds so the bundler inlines or bundles them for single-file builds
import bgSound from '../../Assets/Sounds/13. option2. Game running.mp3';
import flySound from '../../Assets/Sounds/15. option2. Fly.MP3';
import plusSound from '../../Assets/Sounds/16. option1. Plus.mp3';
import rockSound from '../../Assets/Sounds/18. option1. rock.MP3';
import nanSound from '../../Assets/Sounds/nan.mp3';

export type SoundKeys = 'bg' | 'jump' | 'pickup' | 'hit';

const SOUND_FILENAME_MAP: Record<string, string> = {
  '13. option2. Game running.mp3': bgSound,
  '15. option2. Fly.MP3': flySound,
  '16. option1. Plus.mp3': plusSound,
  '18. option1. rock.MP3': rockSound,
  'nan.mp3': nanSound,
};

class SoundController {
  private sounds: Record<SoundKeys, HTMLAudioElement | null> = {
    bg: null,
    jump: null,
    pickup: null,
    hit: null
  };
  private basePath = '/Assets/Sounds/';
  private lastOneOff: HTMLAudioElement | null = null;
  private bgPlaying = false;
  private volumeLevel = 1.0;
  private baseBgVolume = 0.45;
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
  private usePixiSound = false;

  constructor() {}

  init(basePath = '/Assets/Sounds/') {
    try {
      this.basePath = basePath || this.basePath;
      // Register sounds with PIXI Assets (makes bundlers include them)
      try {
        Assets.add({ alias: 'bg', src: bgSound });
        Assets.add({ alias: 'jump', src: flySound });
        Assets.add({ alias: 'pickup', src: plusSound });
        Assets.add({ alias: 'hit', src: rockSound });
      } catch (e) {}

      // Prefer @pixi/sound when available
      try {
        if (PixiSound && typeof PixiSound.add === 'function') {
          try {
            PixiSound.add('bg', bgSound);
            PixiSound.add('jump', flySound);
            PixiSound.add('pickup', plusSound);
            PixiSound.add('hit', rockSound);
            this.usePixiSound = true;
          } catch (e) {
            this.usePixiSound = false;
          }
        }
      } catch (e) { this.usePixiSound = false; }

      // Fallback: create HTMLAudio elements so effects still work without pixi-sound
      try {
        this.sounds.bg = new Audio(bgSound);
        this.sounds.bg.loop = true;
        this.sounds.bg.preload = 'auto';

        this.sounds.jump = new Audio(flySound);
        this.sounds.jump.preload = 'auto';

        this.sounds.pickup = new Audio(plusSound);
        this.sounds.pickup.preload = 'auto';

        this.sounds.hit = new Audio(rockSound);
        this.sounds.hit.preload = 'auto';
      } catch (e) {}
    } catch (e) {
      // swallow errors - building targets may vary
    }
  }

  // Start background loop (call after user gesture if needed)
  playBackground() {
    try {
      if (this.usePixiSound) {
        try {
          // ensure AudioContext resumed — caller should do this on user gesture
          PixiSound.play('bg', { loop: true, volume: this.baseBgVolume * this.volumeLevel });
          this.bgPlaying = true;
          return;
        } catch (e) {}
      }

      if (!this.sounds.bg) return;
      this.sounds.bg.volume = this.baseBgVolume * this.volumeLevel;
      const p = this.sounds.bg.play();
      if (p && typeof (p as any).catch === 'function') {
        (p as any).catch(() => {});
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
      if (this.usePixiSound) {
        try {
          // Play with zero volume then raise volume after a short delay
          PixiSound.play('bg', { loop: true, volume: 0 });
          this.bgPlaying = true;
          setTimeout(() => {
            try { PixiSound.volume('bg', this.baseBgVolume * this.volumeLevel); } catch (e) {}
          }, unmuteAfterMs);
          return;
        } catch (e) {}
      }

      if (!this.sounds.bg) return;
      this.sounds.bg.muted = true;
      this.sounds.bg.volume = 0.0;
      const p = this.sounds.bg.play();
      if (p && typeof (p as any).catch === 'function') {
        (p as any).catch(() => {});
      }
      this.bgPlaying = true;
      setTimeout(() => {
        try {
          this.sounds.bg!.muted = false;
          this.sounds.bg!.volume = this.baseBgVolume * this.volumeLevel;
        } catch (e) {}
      }, unmuteAfterMs);
    } catch (e) {}
  }

  // Set global volume (0..1). Applies to background and future sounds.
  setVolume(level: number) {
    try {
      const v = Math.max(0, Math.min(1, (typeof level === 'number' ? level : 1)));
      this.volumeLevel = v;
      // Apply to background if present
      try { if (this.sounds.bg) this.sounds.bg.volume = this.baseBgVolume * this.volumeLevel; } catch (e) {}
    } catch (e) {}
  }

  stopBackground() {
    try {
      if (this.usePixiSound) {
        try { PixiSound.stop('bg'); } catch (e) {}
        this.bgPlaying = false;
        return;
      }
      if (!this.sounds.bg) return;
      this.sounds.bg.pause();
      this.sounds.bg.currentTime = 0;
      this.bgPlaying = false;
    } catch (e) {}
  }

  // Stop/pause all managed audio elements (background + effect sources)
  stopAll() {
    try {
      // stop background and pixi-managed sounds
      if (this.usePixiSound) {
        try { PixiSound.stopAll && PixiSound.stopAll(); } catch (e) {}
      } else {
        try { if (this.sounds.bg) { this.sounds.bg.pause(); this.sounds.bg.currentTime = 0; } } catch (e) {}
        try { if (this.sounds.jump) { this.sounds.jump.pause(); this.sounds.jump.currentTime = 0; } } catch (e) {}
        try { if (this.sounds.pickup) { this.sounds.pickup.pause(); this.sounds.pickup.currentTime = 0; } } catch (e) {}
        try { if (this.sounds.hit) { this.sounds.hit.pause(); this.sounds.hit.currentTime = 0; } } catch (e) {}
      }
      try { if (this.lastOneOff) { this.lastOneOff.pause(); this.lastOneOff.currentTime = 0; this.lastOneOff = null; } } catch (e) {}
      this.bgPlaying = false;
    } catch (e) {}
  }

  // Stop all managed sounds and play a one-off track from the basePath.
  // filename should be just the file name, e.g. 'nan.mp3'
  stopAllAndPlay(filename: string) {
    try {
      this.stopAll();
      if (!filename) return;
      // create and remember the one-off audio so it can be stopped later
      try {
        if (this.lastOneOff) {
          try { this.lastOneOff.pause(); this.lastOneOff.currentTime = 0; } catch (e) {}
          this.lastOneOff = null;
        }
      } catch (e) {}
      // Prefer the imported/bundled sound if available, otherwise fall back to basePath
      const mapped = SOUND_FILENAME_MAP[filename];
      const srcPath = mapped || (this.basePath + filename);
      if (this.usePixiSound) {
        try { PixiSound.play(srcPath); return; } catch (e) {}
      }
      const src = new Audio(srcPath);
      src.preload = 'auto';
      src.volume = 0.9;
      this.lastOneOff = src;
      const p = src.play();
      if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
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
      if (this.usePixiSound) {
        try { PixiSound.play(key === 'bg' ? 'bg' : key, { volume: key === 'pickup' ? 0.45 : (key === 'jump' ? 0.7 : 0.9) }); return; } catch (e) {}
      }
      if (!src) return;
      // clone element so multiple plays can overlap
      const node = src.cloneNode(true) as HTMLAudioElement;
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
          try {
            // Resume Pixi AudioContext if available
            try {
              if (this.usePixiSound && PixiSound && (PixiSound as any).context && (PixiSound as any).context.state === 'suspended') {
                (PixiSound as any).context.resume && (PixiSound as any).context.resume();
              }
            } catch (er) {}
            if (this.sounds.bg && !this.bgPlaying) this.playBackground();
          } catch (e) {}
        }, { once: true });
      });
    } catch (e) {}
  }
}

const SC = new SoundController();
export default SC;
