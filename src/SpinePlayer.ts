import { Texture, Assets } from 'pixi.js';
// use the spine-pixi runtime for Pixi v8
import * as spinePixi from '@esotericsoftware/spine-pixi-v8';


// Lightweight Spine player wrapper. Responsibilities:
// - load skeleton JSON + atlas from a base path
// - expose a `view` (the Spine display object) that can be added to the scene
// - provide convenience methods: play, playOnce, setDefaultLoop, resumeDefaultLoop,
//   setPosition, setScale, setTimeScale, pauseTrack, resumeTrack
export class SpinePlayer {
	name: string;
	view: any;
	spine: any;
	available: Set<string>;
	defaultLoop: string | null;
	desiredTimeScale: number;
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

	// Load skeleton JSON + atlas from `basePath` (must end with slash)
	async load(basePath = '/Assets/Arts/anim/') {
		const spineModule: any = spinePixi as any;
		const SpineCtor = spineModule?.Spine || spineModule?.default?.Spine || spineModule?.spine?.Spine || null;
		const spineNS = spineModule?.spine || spineModule?.default?.spine || spineModule || null;

		if (!SpineCtor || !spineNS) {
			const modKeys = Object.keys(spineModule || {}).join(', ');
			const nsKeys = spineNS ? Object.keys(spineNS).join(', ') : '<none>';
			throw new Error('@esotericsoftware/spine-pixi-v8 has unexpected exports. module keys: ' + modKeys + ' ; spineNS keys: ' + nsKeys);
		}

		// fetch skeleton json
		const jsonResp = await fetch(`${basePath}${this.name}.json`);
		if (!jsonResp.ok) throw new Error('Failed to fetch skeleton JSON');
		const jsonRaw = await jsonResp.json();

		// try atlas candidates
		const atlasCandidates = [`${basePath}${this.name}.atlas`, `${basePath}${this.name}.atlas.txt`];
		let atlasText: string | null = null;
		for (const a of atlasCandidates) {
			try {
				const r = await fetch(a);
				if (r.ok) { atlasText = await r.text(); break; }
			} catch (e) { /* ignore */ }
		}
		if (!atlasText) throw new Error('Atlas file not found for ' + this.name);

		// runtime constructors
		const TextureAtlasCtor = (spineNS as any).TextureAtlas || (spineModule as any).TextureAtlas || (spineModule?.default as any)?.TextureAtlas;
		const AtlasAttachmentLoaderCtor = (spineNS as any).AtlasAttachmentLoader || (spineModule as any).AtlasAttachmentLoader || (spineModule?.default as any)?.AtlasAttachmentLoader;
		const SkeletonJsonCtor = (spineNS as any).SkeletonJson || (spineModule as any).SkeletonJson || (spineModule?.default as any)?.SkeletonJson;

		if (typeof TextureAtlasCtor !== 'function' || typeof AtlasAttachmentLoaderCtor !== 'function' || typeof SkeletonJsonCtor !== 'function') {
			const found = {
				TextureAtlas: !!TextureAtlasCtor,
				AtlasAttachmentLoader: !!AtlasAttachmentLoaderCtor,
				SkeletonJson: !!SkeletonJsonCtor,
			};
			throw new Error('Spine runtime missing parser classes; ensure @pixi-spine/runtime is available. Found: ' + JSON.stringify(found));
		}

		// attempt to let Pixi Assets load the atlas so pages are textures
		let atlas: any = null;
		try {
			try {
				const loaded = await (Assets as any).load(`${basePath}${this.name}.atlas`);
				if (loaded && (loaded.pages || loaded.regions || loaded.getRegions)) {
					atlas = loaded;
				}
			} catch (e) { atlas = null; }
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

		// set default skin/pose if available
		try { if (spine.skeleton && typeof spine.skeleton.setSkin === 'function') { try { spine.skeleton.setSkin && spine.skeleton.setSkin('default'); } catch (e) {} } } catch (e) {}
		try { spine.skeleton && spine.skeleton.setToSetupPose && spine.skeleton.setToSetupPose(); } catch (e) {}
		try { spine.update && spine.update(0); } catch (e) {}

		// collect animations
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

		// set small default mixes if available
		try {
			const stateData = (this.spine as any).stateData;
			if (stateData) {
				try { stateData.setMix && stateData.setMix('jump', 'run', 0.12); } catch (e) {}
				try { stateData.setMix && stateData.setMix('run', 'jump', 0.08); } catch (e) {}
			}
		} catch (e) {}

		// when a non-looping animation finishes on track 0, return to default
		try {
			const state = (this.spine as any).state;
			state.addListener({
				complete: (entry: any) => {
					try {
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

	play(animName: string, loop = false, track = 0) {
		if (!this.spine) return false;
		if (!animName) return false;
		if (this.available.size && !this.available.has(animName)) return false;
		try {
			(this.spine as any).state.setAnimation(track, animName, !!loop);
			return true;
		} catch (e) { return false; }
	}

	playOnce(animName: string, track = 1) {
		if (!this.spine) return false;
		if (!animName) return false;
		if (this.available.size && !this.available.has(animName)) return false;
		try {
			const state = (this.spine as any).state;
			try {
				const current = (typeof state.getCurrent === 'function') ? state.getCurrent(track) : (state.tracks ? state.tracks[track] : null);
				if (current && current.animation && current.animation.name === animName) return false;
			} catch (e) {}
			state.setAnimation(track, animName, false);
			return true;
		} catch (e) { return false; }
	}

	setDefaultLoop(animName: string) {
		this.defaultLoop = animName;
		if (this.spine && animName) {
			try { (this.spine as any).state.setAnimation(0, animName, true); } catch (e) {}
		}
	}

	getAnimations() { return Array.from(this.available); }

	setMix(from: string, to: string, duration = 0.2) {
		try { (this.spine as any).stateData.setMix(from, to, duration); } catch (e) {}
	}

	setPosition(x: number, y: number) { if (this.view) { this.view.x = x; this.view.y = y; } }
	setScale(s: number) { if (this.view) this.view.scale.set(s); }

	setTimeScale(scale: number) {
		if (!this.spine) return;
		try {
			const s = Math.max(0, scale || 0);
			this.desiredTimeScale = s;
			try { if ((this.spine as any).state) (this.spine as any).state.timeScale = s; } catch (e) {}
			try { if ((this.spine as any).state) (this.spine as any).state.setTimeScale && (this.spine as any).state.setTimeScale(s); } catch (e) {}
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
			try { if ((this.spine as any).timeScale !== undefined) (this.spine as any).timeScale = s; } catch (e) {}
			try { if ((this.spine as any).skeleton) (this.spine as any).skeleton.timeScale = s; } catch (e) {}
		} catch (e) {}
	}

	resumeDefaultLoop() {
		if (!this.spine) return;
		if (!this.defaultLoop) return;
		try {
			try { this.resumeTrack(0); } catch (e) {}
			const state = (this.spine as any).state;
			try {
				if (typeof state.setEmptyAnimation === 'function') {
					const tracks = state.tracks || [];
					for (let i = 1; i < Math.max(2, tracks.length); i++) {
						try { state.setEmptyAnimation(i, 0.05); } catch (e) {}
					}
				} else if (typeof state.clearTrack === 'function') {
					try { state.clearTrack(1); } catch (e) {}
				}
			} catch (e) {}
			try { state.setAnimation(0, this.defaultLoop, true); } catch (e) {}
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

	pauseTrack(track = 0) {
		if (!this.spine) return;
		try {
			const state = (this.spine as any).state;
			const entry = (typeof state.getCurrent === 'function') ? state.getCurrent(track) : (state.tracks ? state.tracks[track] : null);
			if (!entry) return;
			const prev = (entry && entry.timeScale !== undefined) ? entry.timeScale : (this.desiredTimeScale || 1);
			this._pausedTrackScales[track] = prev;
			try {
				console.debug && console.debug('SpinePlayer.pauseTrack', { track, animation: entry && entry.animation && entry.animation.name, prevTimeScale: prev, trackTime: entry && entry.trackTime });
			} catch (e) {}
			try { entry.timeScale = 0; } catch (e) {}
		} catch (e) {}
	}

	resumeTrack(track = 0) {
		if (!this.spine) return;
		try {
			const state = (this.spine as any).state;
			const entry = (typeof state.getCurrent === 'function') ? state.getCurrent(track) : (state.tracks ? state.tracks[track] : null);
			let prev = this._pausedTrackScales[track] !== undefined ? this._pausedTrackScales[track] : (this.desiredTimeScale || 1);
			// clear stored paused scale
			delete this._pausedTrackScales[track];
			if (!entry) return;
			// if prev is falsy or zero for some reason, fall back to desiredTimeScale
			if (!prev || !isFinite(prev) || prev <= 0) prev = (this.desiredTimeScale || 1);
			try {
				console.debug && console.debug('SpinePlayer.resumeTrack', { track, animation: entry && entry.animation && entry.animation.name, restoringTimeScale: prev, trackTime: entry && entry.trackTime });
			} catch (e) {}
			try { entry.timeScale = prev; } catch (e) {}
		} catch (e) {}
	}
}

