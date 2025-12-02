import { Texture, Assets } from 'pixi.js';
// use the official spine-pixi package for Pixi v8
import * as spinePixi from '@esotericsoftware/spine-pixi-v8';


// Lightweight Spine player wrapper that manually parses JSON + atlas and
// constructs a Spine instance using @pixi-spine runtime. Keeps API small:
// - load(basePath)
// - jump()
// - setPosition(x,y), setScale(s)
export class SpinePlayer {
  name: string;
  view: any;
  spine: any;
  available: Set<string>;
  defaultLoop: string | null;
  // desired global timeScale (for speeding up animations)
  desiredTimeScale: number;
  // track -> saved timeScale when paused
  private _pausedTrackScales: Record<number, number>;

  constructor(name = 'kfc_chicken') {
    this.name = name;
    this.view = null;
    this.spine = null;
    this.available = new Set();
    this.defaultLoop = null;
    this.desiredTimeScale = 1;
    this._pausedTrackScales = {};
  }

  async load(basePath = '/Assets/Arts/anim/') {
    // Use the installed `@esotericsoftware/spine-pixi-v8` package. Export shapes
    // may vary, so try common locations.
    const spineModule: any = spinePixi as any;
    const SpineCtor = spineModule?.Spine || spineModule?.default?.Spine || spineModule?.spine?.Spine || null;
    const spineNS = spineModule?.spine || spineModule?.default?.spine || spineModule || null;

    if (!SpineCtor || !spineNS) {
      const modKeys = Object.keys(spineModule || {}).join(', ');
      const nsKeys = spineNS ? Object.keys(spineNS).join(', ') : '<none>';
      throw new Error('@esotericsoftware/spine-pixi-v8 has unexpected exports. module keys: ' + modKeys + ' ; spineNS keys: ' + nsKeys);
    }

    const jsonResp = await fetch(`${basePath}${this.name}.json`);
    if (!jsonResp.ok) throw new Error('Failed to fetch skeleton JSON');
    const jsonRaw = await jsonResp.json();

    const atlasCandidates = [`${basePath}${this.name}.atlas`, `${basePath}${this.name}.atlas.txt`];
    let atlasText: string | null = null;
    for (const a of atlasCandidates) {
      try {
        const r = await fetch(a);
        if (r.ok) { atlasText = await r.text(); break; }
      } catch (e) { /* ignore */ }
    }
    if (!atlasText) throw new Error('Atlas file not found for ' + this.name);

    // TextureAtlas constructor may be located directly on spineNS or on the top-level module.
    const TextureAtlasCtor = (spineNS as any).TextureAtlas || (spineModule as any).TextureAtlas || (spineModule?.default as any)?.TextureAtlas;
    const AtlasAttachmentLoaderCtor = (spineNS as any).AtlasAttachmentLoader || (spineModule as any).AtlasAttachmentLoader || (spineModule?.default as any)?.AtlasAttachmentLoader;
    const SkeletonJsonCtor = (spineNS as any).SkeletonJson || (spineModule as any).SkeletonJson || (spineModule?.default as any)?.SkeletonJson;

    if (typeof TextureAtlasCtor !== 'function' || typeof AtlasAttachmentLoaderCtor !== 'function' || typeof SkeletonJsonCtor !== 'function') {
      // diagnostic: show what we found
      const found = {
        TextureAtlas: !!TextureAtlasCtor,
        AtlasAttachmentLoader: !!AtlasAttachmentLoaderCtor,
        SkeletonJson: !!SkeletonJsonCtor,
      };
      throw new Error('Spine runtime missing parser classes; ensure @pixi-spine/runtime is installed and available. Found: ' + JSON.stringify(found));
    }

    // First try to let Pixi's Assets loader (registered by the spine-pixi runtime)
    // parse the atlas so its pages are populated with PIXI textures. If that
    // doesn't work (dev server not running, loader not registered), fall back
    // to constructing a TextureAtlas directly using the runtime ctor.
    let atlas: any = null;
    try {
      try {
        const loaded = await (Assets as any).load(`${basePath}${this.name}.atlas`);
        // If the loader returned an object that looks like a TextureAtlas, use it.
        if (loaded && (loaded.pages || loaded.regions || loaded.getRegions)) {
          atlas = loaded;
        }
      } catch (e) {
        atlas = null;
      }
    } catch (e) { atlas = null; }

    if (!atlas) {
      atlas = new TextureAtlasCtor(atlasText, (line: string) => {
        const full = basePath + line;
        try { return Texture.from(full); } catch (e) { console.warn('Texture.from failed for', full, e); return Texture.WHITE; }
      });
    }

    const atlasLoader = new AtlasAttachmentLoaderCtor(atlas);
    const skeletonJson = new SkeletonJsonCtor(atlasLoader);
    const skeletonData = skeletonJson.readSkeletonData(jsonRaw);
    const spine = new SpineCtor(skeletonData);

    // try to set the default skin and pose like the tutorial does
    try {
      if (spine.skeleton && typeof spine.skeleton.setSkin === 'function') {
        try { spine.skeleton.setSkin && spine.skeleton.setSkin('default'); } catch (e) {}
      } else if (spine.skeleton && typeof spine.skeleton.setSkinByName === 'function') {
        try { spine.skeleton.setSkinByName && spine.skeleton.setSkinByName('default'); } catch (e) {}
      }
      try { spine.skeleton && spine.skeleton.setToSetupPose && spine.skeleton.setToSetupPose(); } catch (e) {}
      try { spine.update && spine.update(0); } catch (e) {}
    } catch (e) {}

    // collect available animation names
    try {
      if (skeletonData && Array.isArray(skeletonData.animations)) {
        for (const a of skeletonData.animations) {
          if (a && a.name) this.available.add(a.name);
        }
      } else if (skeletonData && skeletonData.animations) {
        for (const k of Object.keys(skeletonData.animations)) this.available.add(k);
      }
    } catch (e) {}

    this.spine = spine;
    this.view = spine;

    // Set sensible mixes (tutorial suggests mixing between run/jump)
    try {
      const stateData = (this.spine as any).stateData;
      if (stateData) {
        // small default mix values; safe if animations don't exist
        try { stateData.setMix && stateData.setMix('jump', 'run', 0.12); } catch (e) {}
        try { stateData.setMix && stateData.setMix('run', 'jump', 0.08); } catch (e) {}
      }
    } catch (e) {}

    // when a non-looping animation completes, return to default loop if set
    try {
      const state = (this.spine as any).state;
      state.addListener({
        complete: (entry: any) => {
          try {
            // Only react to completes on track 0 (the base loop). If a top-layer
            // track (e.g. 1) finishes, we leave track 0 as-is (run).
            const trackIndex = entry.trackIndex;
            const name = entry.animation ? entry.animation.name : (entry.animation && entry.animation.toString && entry.animation.toString());
            if (trackIndex === 0) {
              if (this.defaultLoop && name && name !== this.defaultLoop) {
                try { state.setAnimation(0, this.defaultLoop, true); } catch (e) {}
              }
            }
          } catch (e) {}
        }
      });
    } catch (e) {}

    return this;
  }

  // play an animation (if present). If not loop and animation exists, the
  // wrapper will attempt to revert to `defaultLoop` when it finishes.
  play(animName: string, loop = false, track = 0) {
    if (!this.spine) return false;
    if (!animName) return false;
    // disable the 'jump' animation entirely
    if (animName === 'jump') return false;
    if (this.available.size && !this.available.has(animName)) return false;
    try {
      (this.spine as any).state.setAnimation(track, animName, !!loop);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Play a non-looping animation on an upper track so the base (track 0)
  // can continue looping (e.g. run). Defaults to track 1.
  playOnce(animName: string, track = 1) {
    if (!this.spine) return false;
    if (!animName) return false;
    // disable the 'jump' animation entirely
    if (animName === 'jump') return false;
    if (this.available.size && !this.available.has(animName)) return false;
    try {
      const state = (this.spine as any).state;
      // avoid retriggering the same animation on the same track
      try {
        const current = (typeof state.getCurrent === 'function') ? state.getCurrent(track) : (state.tracks ? state.tracks[track] : null);
        if (current && current.animation && current.animation.name === animName) {
          return false;
        }
      } catch (e) {}
      // debug log for tracing play events (skipping 'jump')
      try { console.debug('[SpinePlayer] playOnce', animName, 'track', track); } catch (e) {}
      state.setAnimation(track, animName, false);
      return true;
    } catch (e) {
      return false;
    }
  }

  // set the animation that should loop normally (e.g. 'run' or 'idle')
  setDefaultLoop(animName: string) {
    this.defaultLoop = animName;
    if (this.spine && animName) {
      try { (this.spine as any).state.setAnimation(0, animName, true); } catch (e) {}
    }
  }

  getAnimations() {
    return Array.from(this.available);
  }

  setMix(from: string, to: string, duration = 0.2) {
    try { (this.spine as any).stateData.setMix(from, to, duration); } catch (e) {}
  }

  setPosition(x: number, y: number) {
    if (this.view) { this.view.x = x; this.view.y = y; }
  }

  setScale(s: number) {
    if (this.view) this.view.scale.set(s);
  }

  // Set the playback time scale for the Spine instance/state so animations
  // speed up or slow down. Accepts a positive multiplier (1 = normal speed).
  setTimeScale(scale: number) {
    if (!this.spine) return;
    try {
      const s = Math.max(0, scale || 0);
      this.desiredTimeScale = s;
      // set global state timeScale if available
      try { if ((this.spine as any).state) (this.spine as any).state.timeScale = s; } catch (e) {}
      try { if ((this.spine as any).state) (this.spine as any).state.setTimeScale && (this.spine as any).state.setTimeScale(s); } catch (e) {}
      // set per-track entry timeScale for entries that are not paused
      try {
        const state = (this.spine as any).state;
        const tracks = state && state.tracks ? state.tracks : null;
        if (tracks && Array.isArray(tracks)) {
          for (let i = 0; i < tracks.length; i++) {
            const e = tracks[i];
            if (!e) continue;
            if (this._pausedTrackScales[i] !== undefined) continue;
            try { e.timeScale = s; } catch (err) {}
          }
        }
      } catch (e) {}
      // some runtimes put timeScale on the spine object/skeleton
      try { if ((this.spine as any).timeScale !== undefined) (this.spine as any).timeScale = s; } catch (e) {}
      try { if ((this.spine as any).skeleton) (this.spine as any).skeleton.timeScale = s; } catch (e) {}
    } catch (e) {}
  }

  // Resume the configured default looping animation on track 0 (if set).
  resumeDefaultLoop() {
    if (!this.spine) return;
    if (!this.defaultLoop) return;
    try {
      // restore track 0 timeScale if it was paused
      try { this.resumeTrack(0); } catch (e) {}
      const state = (this.spine as any).state;
      // clear any non-looping upper-track animations so run is visible
      try {
        // prefer setEmptyAnimation (clears with mix) if available
        if (typeof state.setEmptyAnimation === 'function') {
          // clear tracks 1..n
          const tracks = state.tracks || [];
          for (let i = 1; i < Math.max(2, tracks.length); i++) {
            try { state.setEmptyAnimation(i, 0.05); } catch (e) {}
          }
        } else if (typeof state.clearTrack === 'function') {
          try { state.clearTrack(1); } catch (e) {}
        }
      } catch (e) {}

      // ensure track 0 is set to the default looping animation
      try { state.setAnimation(0, this.defaultLoop, true); } catch (e) {}

      // restore per-track timeScale for visible tracks
      try {
        const tracks = state.tracks || [];
        for (let i = 0; i < tracks.length; i++) {
          const entry = tracks[i];
          if (!entry) continue;
          if (this._pausedTrackScales[i] !== undefined) {
            try { entry.timeScale = this._pausedTrackScales[i]; } catch (e) {}
          } else {
            try { entry.timeScale = this.desiredTimeScale; } catch (e) {}
          }
        }
      } catch (e) {}
    } catch (e) {}
  }

  // Pause a specific track (stop its time progression) without clearing
  // the animation. Stores previous timeScale so resumeTrack can restore it.
  pauseTrack(track = 0) {
    if (!this.spine) return;
    try {
      const state = (this.spine as any).state;
      const entry = (typeof state.getCurrent === 'function') ? state.getCurrent(track) : (state.tracks ? state.tracks[track] : null);
      if (!entry) return;
      const prev = (entry && entry.timeScale !== undefined) ? entry.timeScale : (this.desiredTimeScale || 1);
      this._pausedTrackScales[track] = prev;
      try { entry.timeScale = 0; } catch (e) {}
    } catch (e) {}
  }

  // Resume a previously paused track, restoring its timeScale.
  resumeTrack(track = 0) {
    if (!this.spine) return;
    try {
      const state = (this.spine as any).state;
      const entry = (typeof state.getCurrent === 'function') ? state.getCurrent(track) : (state.tracks ? state.tracks[track] : null);
      const prev = this._pausedTrackScales[track] !== undefined ? this._pausedTrackScales[track] : (this.desiredTimeScale || 1);
      delete this._pausedTrackScales[track];
      if (!entry) return;
      try { entry.timeScale = prev; } catch (e) {}
    } catch (e) {}
  }
}
