import { Assets } from 'pixi.js';

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

  constructor() {
    console.log('SoundController created');
  }

  init(basePath = '/Assets/Sounds/') {
    try {
      this.basePath = basePath || this.basePath;

      // Register sounds with PIXI Assets
      try {
        Assets.add({ alias: 'bg', src: bgSound });
        Assets.add({ alias: 'jump', src: flySound });
        Assets.add({ alias: 'pickup', src: plusSound });
        Assets.add({ alias: 'hit', src: rockSound });
      } catch (e) {
        // Some environments may not expose Assets.add; that's ok
      }

      // Create audio elements from imported data URLs (works with bundled builds)
      this.sounds.bg = new Audio(bgSound);
      this.sounds.bg.loop = true;
      this.sounds.bg.preload = 'auto';

      this.sounds.jump = new Audio(flySound);
      this.sounds.jump.preload = 'auto';

      this.sounds.pickup = new Audio(plusSound);
      this.sounds.pickup.preload = 'auto';

      this.sounds.hit = new Audio(rockSound);
      this.sounds.hit.preload = 'auto';

      // Auto-start background after successful init
      this.resumeOnUserGesture();
      
      // Try to start immediately (might be blocked)
      console.log('Attempting immediate background start...');
      this.playBackgroundForced(100);
    } catch (e) {
      console.error('SoundController init failed:', e);
    }
  }

  // Start background loop (call after user gesture if needed)
  playBackground() {
    try {
      if (!this.sounds.bg) {
        console.warn('Background sound not initialized');
        return;
      }
      this.sounds.bg.volume = this.baseBgVolume * this.volumeLevel;
      const p = this.sounds.bg.play();
      if (p && typeof (p as any).catch === 'function') {
        (p as any).catch((error: any) => { 
          console.warn('Background sound autoplay blocked:', error);
        });
      }
      this.bgPlaying = true;
      console.log('Background music started');
    } catch (e) {
      console.error('Background play failed:', e);
    }
  }

  // Try to autoplay by starting muted then unmuting
  playBackgroundForced(unmuteAfterMs = 300) {
    try {
      if (!this.sounds.bg) {
        console.warn('Background sound not initialized');
        return;
      }
      console.log('Attempting forced background music start...');
      this.sounds.bg.muted = true;
      this.sounds.bg.volume = 0.0;
      const p = this.sounds.bg.play();
      if (p && typeof (p as any).catch === 'function') {
        (p as any).catch((error: any) => { 
          console.warn('Forced background sound blocked:', error);
        });
      }
      this.bgPlaying = true;
      // attempt to unmute after a short delay
      setTimeout(() => {
        try {
          this.sounds.bg!.muted = false;
          this.sounds.bg!.volume = this.baseBgVolume * this.volumeLevel;
          console.log('Background music unmuted');
        } catch (e) {
          console.error('Unmute failed:', e);
        }
      }, unmuteAfterMs);
    } catch (e) {
      console.error('Forced background failed:', e);
    }
  }

  // Set global volume (0..1)
  setVolume(level: number) {
    try {
      const v = Math.max(0, Math.min(1, (typeof level === 'number' ? level : 1)));
      this.volumeLevel = v;
      try { 
        if (this.sounds.bg) this.sounds.bg.volume = this.baseBgVolume * this.volumeLevel; 
      } catch (e) {}
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

  // Stop all managed audio elements
  stopAll() {
    try {
      // stop background
      try { 
        if (this.sounds.bg) { 
          this.sounds.bg.pause(); 
          this.sounds.bg.currentTime = 0; 
        } 
      } catch (e) {}
      
      // stop base effect sources
      try { 
        if (this.sounds.jump) { 
          this.sounds.jump.pause(); 
          this.sounds.jump.currentTime = 0; 
        } 
      } catch (e) {}
      
      try { 
        if (this.sounds.pickup) { 
          this.sounds.pickup.pause(); 
          this.sounds.pickup.currentTime = 0; 
        } 
      } catch (e) {}
      
      try { 
        if (this.sounds.hit) { 
          this.sounds.hit.pause(); 
          this.sounds.hit.currentTime = 0; 
        } 
      } catch (e) {}
      
      // stop any one-off audio
      try { 
        if (this.lastOneOff) { 
          this.lastOneOff.pause(); 
          this.lastOneOff.currentTime = 0; 
          this.lastOneOff = null; 
        } 
      } catch (e) {}
      
      this.bgPlaying = false;
    } catch (e) {}
  }

  // Stop all sounds and play a one-off track
  stopAllAndPlay(filename: string) {
    try {
      this.stopAll();
      if (!filename) return;
      
      // clean up previous one-off
      try {
        if (this.lastOneOff) {
          try { 
            this.lastOneOff.pause(); 
            this.lastOneOff.currentTime = 0; 
          } catch (e) {}
          this.lastOneOff = null;
        }
      } catch (e) {}
      
      // Prefer the imported/bundled sound if available
      const mapped = SOUND_FILENAME_MAP[filename];
      const srcPath = mapped || (this.basePath + filename);
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

  // Debug method to test audio manually
  testAudio() {
    console.log('=== AUDIO TEST ===');
    console.log('sounds.bg exists:', !!this.sounds.bg);
    console.log('bgPlaying:', this.bgPlaying);
    console.log('volumeLevel:', this.volumeLevel);
    console.log('baseBgVolume:', this.baseBgVolume);
    if (this.sounds.bg) {
      console.log('bg.src:', this.sounds.bg.src.substring(0, 100) + '...');
      console.log('bg.readyState:', this.sounds.bg.readyState);
      console.log('bg.paused:', this.sounds.bg.paused);
      console.log('bg.volume:', this.sounds.bg.volume);
      console.log('bg.muted:', this.sounds.bg.muted);
    }
    try {
      this.playBackgroundForced(0);
    } catch (e) {
      console.error('Test audio failed:', e);
    }
  }

  // convenience to ensure initialization and attempt to resume audio on user gesture
  resumeOnUserGesture() {
    try {
      console.log('Setting up user gesture handlers for audio...');
      ['click', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) => {
        const handler = () => {
          try {
            console.log('User gesture detected:', ev);
            if (this.sounds.bg && !this.bgPlaying) {
              console.log('Starting background from user gesture');
              this.playBackground(); 
            } else if (this.bgPlaying) {
              console.log('Background already playing');
            }
          } catch (e) {
            console.error('User gesture handler error:', e);
          }
          window.removeEventListener(ev, handler);
        };
        window.addEventListener(ev, handler);
      });
    } catch (e) {
      console.error('resumeOnUserGesture failed:', e);
    }
  }
}

const SC = new SoundController();

// Expose to global for debugging
(window as any).SoundController = SC;

export default SC;
