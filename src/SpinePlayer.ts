import { Texture, Assets } from 'pixi.js';
import * as spinePixi from '@esotericsoftware/spine-pixi-v8';
import { FIXED_CHICKEN_ALIAS, RAW_SPINE_ASSETS } from './assetLoader';

// Simple decode
function safeDecodeBase64(dataUri: string): string {
    if (!dataUri || !dataUri.startsWith('data:')) return dataUri;
    try {
        return atob(dataUri.split(',')[1]).replace(/\r/g, '');
    } catch (e) { return ''; }
}

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

    async load(basePath = '/Assets/Arts/anim/', rawAssets: any = null) {
        const spineModule: any = spinePixi as any;
        const SpineCtor = spineModule?.Spine || spineModule?.default?.Spine || spineModule?.spine?.Spine;
        const spineNS = spineModule?.spine || spineModule?.default?.spine || spineModule;

        if (!SpineCtor || !spineNS) throw new Error('Spine runtime missing.');

        let jsonRaw: any = null;
        let atlasText: string | null = null;
        let readyTexture: Texture | null = null;

        // 1. PREPARE DATA
        if (rawAssets && (this.name === 'kfc_chicken' || this.name.includes('chicken'))) {
            // JSON
            try {
                const jsonStr = safeDecodeBase64(rawAssets.json);
                if (jsonStr) jsonRaw = JSON.parse(jsonStr);
            } catch (e) {}

            // ATLAS
            atlasText = safeDecodeBase64(rawAssets.atlas);

            // TEXTURE
            if (Assets.cache.has(FIXED_CHICKEN_ALIAS)) {
                readyTexture = Assets.get(FIXED_CHICKEN_ALIAS);
            } else {
                try { readyTexture = Texture.from(rawAssets.png); } catch(e) {}
            }
        }

        if (!jsonRaw || !atlasText || !readyTexture) {
             console.error(`Spine Data Missing! JSON:${!!jsonRaw} Atlas:${!!atlasText} Tex:${!!readyTexture}`);
             return; 
        }

        // 2. INIT
        const TextureAtlasCtor = (spineNS as any).TextureAtlas || (spineModule as any).TextureAtlas;
        const AtlasAttachmentLoaderCtor = (spineNS as any).AtlasAttachmentLoader || (spineModule as any).AtlasAttachmentLoader;
        const SkeletonJsonCtor = (spineNS as any).SkeletonJson || (spineModule as any).SkeletonJson;

        // 3. CREATE ATLAS
        const atlas = new TextureAtlasCtor(atlasText, (line: string) => {
            return readyTexture; // Always return our texture
        });

        // --- FORCE FIX: Inject texture into page if missing ---
        if (atlas && atlas.pages.length > 0) {
            const page = atlas.pages[0];
            if (!page.texture) {
                console.warn("⚠️ Force-injecting texture into Atlas Page...");
                
                // Manually create a mock Spine Texture object
                // This satisfies the interface { getImage(), setFilters(), setWraps() }
                page.texture = {
                    getImage: () => readyTexture,
                    setFilters: () => {},
                    setWraps: () => {},
                    dispose: () => {},
                    width: readyTexture.width,
                    height: readyTexture.height
                };
                // Also set the renderer object for Pixi
                page.rendererObject = readyTexture;
                page.width = readyTexture.width;
                page.height = readyTexture.height;
            }
        }
        // ----------------------------------------------------

        const atlasLoader = new AtlasAttachmentLoaderCtor(atlas);
        const skeletonJson = new SkeletonJsonCtor(atlasLoader);
        const skeletonData = skeletonJson.readSkeletonData(jsonRaw);
        const spine = new SpineCtor(skeletonData);

        // 4. CONFIG
        try { if (spine.skeleton && typeof spine.skeleton.setSkin === 'function') { try { spine.skeleton.setSkin && spine.skeleton.setSkin('default'); } catch (e) {} } } catch (e) {}
        try { spine.skeleton && spine.skeleton.setToSetupPose && spine.skeleton.setToSetupPose(); } catch (e) {}
        try { spine.update && spine.update(0); } catch (e) {}

        try {
            if (skeletonData && Array.isArray(skeletonData.animations)) {
                for (const a of skeletonData.animations) { if (a && a.name) this.available.add(a.name); }
            } else if (skeletonData && skeletonData.animations) {
                for (const k of Object.keys(skeletonData.animations)) this.available.add(k);
            }
        } catch (e) {}

        this.spine = spine;
        this.view = spine;

        try {
            const stateData = (this.spine as any).stateData;
            if (stateData) {
                try { stateData.setMix && stateData.setMix('jump', 'run', 0.12); } catch (e) {}
                try { stateData.setMix && stateData.setMix('run', 'jump', 0.08); } catch (e) {}
            }
        } catch (e) {}

        try {
            const state = (this.spine as any).state;
            state.addListener({
                complete: (entry: any) => {
                    try {
                        const trackIndex = entry.trackIndex;
                        if (trackIndex === 0) {
                            if (this.defaultLoop && entry.animation.name !== this.defaultLoop) {
                                try { state.setAnimation(0, this.defaultLoop, true); } catch (e) {}
                            }
                        }
                    } catch (e) {}
                }
            });
        } catch (e) {}

        return this;
    }

    // --- HELPER METHODS ---
    play(animName: string, loop = false, track = 0) {
        if (!this.spine) return false;
        try { (this.spine as any).state.setAnimation(track, animName, !!loop); return true; } catch (e) { return false; }
    }
    playOnce(animName: string, track = 1) {
        if (!this.spine) return false;
        try { (this.spine as any).state.setAnimation(track, animName, false); return true; } catch (e) { return false; }
    }
    setDefaultLoop(animName: string) {
        this.defaultLoop = animName;
        if (this.spine && animName) try { (this.spine as any).state.setAnimation(0, animName, true); } catch (e) {}
    }
    getAnimations() { return Array.from(this.available); }
    setMix(from: string, to: string, duration = 0.2) { try { (this.spine as any).stateData.setMix(from, to, duration); } catch (e) {} }
    setPosition(x: number, y: number) { if (this.view) { this.view.x = x; this.view.y = y; } }
    setScale(s: number) { if (this.view) this.view.scale.set(s); }
    setTimeScale(scale: number) {
        if (!this.spine) return;
        try {
            const s = Math.max(0, scale || 0);
            this.desiredTimeScale = s;
            try { if ((this.spine as any).state) (this.spine as any).state.timeScale = s; } catch (e) {}
            try { if ((this.spine as any).skeleton) (this.spine as any).skeleton.timeScale = s; } catch (e) {}
        } catch (e) {}
    }
    resumeDefaultLoop() {
        if (!this.spine) return;
        if (!this.defaultLoop) return;
        try { this.resumeTrack(0); (this.spine as any).state.setAnimation(0, this.defaultLoop, true); } catch (e) {}
    }
    pauseTrack(track = 0) {
        if (!this.spine) return;
        try {
            const state = (this.spine as any).state;
            const entry = state.getCurrent(track);
            if (!entry) return;
            this._pausedTrackScales[track] = entry.timeScale;
            entry.timeScale = 0;
        } catch (e) {}
    }
    resumeTrack(track = 0) {
        if (!this.spine) return;
        try {
            const state = (this.spine as any).state;
            const entry = state.getCurrent(track);
            let prev = this._pausedTrackScales[track];
            delete this._pausedTrackScales[track];
            if (!entry) return;
            entry.timeScale = (prev !== undefined) ? prev : (this.desiredTimeScale || 1);
        } catch (e) {}
    }
}