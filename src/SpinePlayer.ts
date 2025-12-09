import { Texture, Assets } from 'pixi.js';
// use the spine-pixi runtime for Pixi v8
import * as spinePixi from '@esotericsoftware/spine-pixi-v8';

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

    // Load skeleton JSON + atlas
    async load(basePath = '/Assets/Arts/anim/') {
        const spineModule: any = spinePixi as any;
        const SpineCtor = spineModule?.Spine || spineModule?.default?.Spine || spineModule?.spine?.Spine || null;
        const spineNS = spineModule?.spine || spineModule?.default?.spine || spineModule || null;

        if (!SpineCtor || !spineNS) {
            throw new Error('Spine runtime missing. Check imports.');
        }

        // --- BƯỚC 1: Tải JSON (Sửa lỗi CORS) ---
        // Thay vì fetch(), ta dùng Assets.load() để lấy từ cache Webpack
        const jsonPath = `${basePath}${this.name}.json`;
        let jsonRaw: any = null;
        
        try {
            // Thử load từ Assets (ưu tiên cái này vì assetLoader đã nạp rồi)
            jsonRaw = await Assets.load(jsonPath);
        } catch (e) {
            console.warn(`SpinePlayer: Assets.load failed for ${jsonPath}, trying fetch as fallback...`);
            // Chỉ fetch nếu Assets.load thất bại (thường sẽ fail ở chế độ 1 file, nhưng cứ để fallback)
            const jsonResp = await fetch(jsonPath);
            if (!jsonResp.ok) throw new Error('Failed to fetch skeleton JSON');
            jsonRaw = await jsonResp.json();
        }

        // --- BƯỚC 2: Tải Atlas (Sửa lỗi CORS) ---
        const atlasPath = `${basePath}${this.name}.atlas`;
        let atlasText: string | null = null;

        try {
            // Thử load text từ Assets
            // Vì Webpack đã inline file .atlas thành text/plain, Assets.load sẽ trả về string
            const loaded = await Assets.load(atlasPath);
            if (typeof loaded === 'string') {
                atlasText = loaded;
            }
        } catch (e) {
            // Fallback fetch
            try {
                const r = await fetch(atlasPath);
                if (r.ok) atlasText = await r.text();
            } catch (err) {}
        }
        
        // Fallback: Nếu không tìm thấy .atlas, thử .atlas.txt
        if (!atlasText) {
             try {
                const r = await fetch(`${basePath}${this.name}.atlas.txt`);
                if (r.ok) atlasText = await r.text();
            } catch (err) {}
        }

        if (!atlasText) throw new Error('Atlas file not found for ' + this.name);

        // --- BƯỚC 3: Khởi tạo Runtime ---
        const TextureAtlasCtor = (spineNS as any).TextureAtlas || (spineModule as any).TextureAtlas;
        const AtlasAttachmentLoaderCtor = (spineNS as any).AtlasAttachmentLoader || (spineModule as any).AtlasAttachmentLoader;
        const SkeletonJsonCtor = (spineNS as any).SkeletonJson || (spineModule as any).SkeletonJson;

        // --- BƯỚC 4: Tạo Atlas & Map Texture ---
        // Hàm callback này giúp Spine tìm thấy ảnh "kfc_chicken.png" trong cache của Pixi
        const atlas = new TextureAtlasCtor(atlasText, (line: string) => {
            // line chính là tên file ảnh trong atlas (VD: "kfc_chicken.png")
            
            // 1. Thử tìm theo đường dẫn đầy đủ
            const fullPath = `${basePath}${line}`;
            if (Assets.cache.has(fullPath)) {
                return Assets.get(fullPath);
            }

            // 2. Thử tìm theo tên file ngắn gọn (do assetLoader đã tạo alias)
            if (Assets.cache.has(line)) {
                return Assets.get(line);
            }

            // 3. Fallback: Texture.from (sẽ tìm trong cache global)
            try { return Texture.from(fullPath); } 
            catch (e) { return Texture.WHITE; }
        });

        const atlasLoader = new AtlasAttachmentLoaderCtor(atlas);
        const skeletonJson = new SkeletonJsonCtor(atlasLoader);
        const skeletonData = skeletonJson.readSkeletonData(jsonRaw);
        const spine = new SpineCtor(skeletonData);

        // Setup mặc định
        try { if (spine.skeleton && typeof spine.skeleton.setSkin === 'function') { try { spine.skeleton.setSkin && spine.skeleton.setSkin('default'); } catch (e) {} } } catch (e) {}
        try { spine.skeleton && spine.skeleton.setToSetupPose && spine.skeleton.setToSetupPose(); } catch (e) {}
        try { spine.update && spine.update(0); } catch (e) {}

        // Collect animations
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

        // Set Mixes (Jump/Run transition smoothing)
        try {
            const stateData = (this.spine as any).stateData;
            if (stateData) {
                try { stateData.setMix && stateData.setMix('jump', 'run', 0.12); } catch (e) {}
                try { stateData.setMix && stateData.setMix('run', 'jump', 0.08); } catch (e) {}
            }
        } catch (e) {}

        // Default loop logic
        try {
            const state = (this.spine as any).state;
            state.addListener({
                complete: (entry: any) => {
                    try {
                        const trackIndex = entry.trackIndex;
                        const name = entry.animation ? entry.animation.name : null;
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
        // if (this.available.size && !this.available.has(animName)) return false; 
        // (Comment lại dòng check này để tránh lỗi nếu set chưa update kịp)
        try {
            (this.spine as any).state.setAnimation(track, animName, !!loop);
            return true;
        } catch (e) { return false; }
    }

    playOnce(animName: string, track = 1) {
        if (!this.spine) return false;
        if (!animName) return false;
        try {
            const state = (this.spine as any).state;
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
            // Cập nhật timescale cho skeleton và tracks
            try { if ((this.spine as any).skeleton) (this.spine as any).skeleton.timeScale = s; } catch (e) {}
        } catch (e) {}
    }

    resumeDefaultLoop() {
        if (!this.spine) return;
        if (!this.defaultLoop) return;
        try {
            this.resumeTrack(0);
            const state = (this.spine as any).state;
            state.setAnimation(0, this.defaultLoop, true);
        } catch (e) {}
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