import { Texture, Assets } from 'pixi.js';
import * as spinePixi from '@esotericsoftware/spine-pixi-v8';
// Import dữ liệu thô trực tiếp
import { RAW_SPINE_ASSETS } from './assetLoader';

// Helper giải mã tại chỗ cho SpinePlayer
function decodeBase64(dataUri: string): string {
    if (!dataUri || !dataUri.startsWith('data:')) return dataUri;
    try {
        const base64 = dataUri.split(',')[1];
        if (!base64) return '';
        const str = atob(base64);
        return decodeURIComponent(Array.prototype.map.call(str, (c: string) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
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

    async load(basePath = '/Assets/Arts/anim/') {
        // TEMPORARY: Disable spine loading if it keeps failing
        // Uncomment this block to use static image instead of Spine animation
        /*
        console.log('Using static image fallback instead of Spine');
        try {
            const staticTexture = Texture.from(RAW_SPINE_ASSETS.png);
            const staticSprite = new (await import('pixi.js')).Sprite(staticTexture);
            staticSprite.anchor.set(0.5, 0.5);
            this.spine = { state: { setAnimation: () => {}, timeScale: 1 } };
            this.view = staticSprite;
            this.available = new Set(['idle', 'run', 'jump']);
            return this;
        } catch (e) {
            console.error('Even static fallback failed:', e);
            return;
        }
        */

        const spineModule: any = spinePixi as any;
        const SpineCtor = spineModule?.Spine || spineModule?.default?.Spine || spineModule?.spine?.Spine;
        const spineNS = spineModule?.spine || spineModule?.default?.spine || spineModule;

        if (!SpineCtor || !spineNS) {
            console.error('Spine runtime missing. Available properties:', Object.keys(spineModule || {}));
            throw new Error('Spine runtime missing.');
        }

        // --- 1. LẤY DỮ LIỆU (HARD LINK) ---
        let jsonRaw: any = null;
        let atlasText: string | null = null;
        let chickenTexture: Texture | null = null;

        // Nếu là kfc_chicken, dùng ngay dữ liệu raw, KHÔNG CẦN TÌM CACHE
        if (this.name === 'kfc_chicken' || this.name.includes('chicken')) {
            console.log("SpinePlayer: Loading kfc_chicken from RAW DATA.");
            
            // Giải mã JSON
            try {
                const jsonStr = decodeBase64(RAW_SPINE_ASSETS.json);
                jsonRaw = JSON.parse(jsonStr);
            } catch (e) { console.error("JSON Decode fail", e); }

            // Giải mã Atlas
            atlasText = decodeBase64(RAW_SPINE_ASSETS.atlas);

            // Tạo texture một cách đồng bộ và đảm bảo không bị undefined
            try {
                // Tạo texture từ data URI
                chickenTexture = Texture.from(RAW_SPINE_ASSETS.png);
                
                // Đợi texture được xử lý hoàn toàn
                if (chickenTexture) {
                    // Đảm bảo texture không bị undefined bằng cách kiểm tra và log
                    console.log('Texture created successfully:', {
                        texture: chickenTexture,
                        width: chickenTexture.width,
                        height: chickenTexture.height,
                        source: chickenTexture.source
                    });
                } else {
                    console.error('Failed to create texture - texture is null/undefined');
                    chickenTexture = Texture.WHITE; // Fallback
                }
            } catch(e) { 
                console.error("Texture creation failed completely:", e);
                chickenTexture = Texture.WHITE; // Safe fallback
            }

        } else {
            // ... Logic fallback cho các spine khác (nếu có) ...
            console.warn("Unknown spine name, trying generic cache load:", this.name);
        }

        if (!jsonRaw || !atlasText || !chickenTexture) {
             console.error(`Spine data missing for ${this.name}:`, {
                 hasJson: !!jsonRaw,
                 hasAtlas: !!atlasText, 
                 hasTexture: !!chickenTexture
             });
             return; 
        }
        
        console.log('All spine assets ready:', {
            jsonSize: JSON.stringify(jsonRaw).length,
            atlasSize: atlasText.length,
            textureReady: !!chickenTexture
        });

        // --- 2. KHỞI TẠO RUNTIME ---
        const TextureAtlasCtor = (spineNS as any).TextureAtlas || (spineModule as any).TextureAtlas;
        const AtlasAttachmentLoaderCtor = (spineNS as any).AtlasAttachmentLoader || (spineModule as any).AtlasAttachmentLoader;
        const SkeletonJsonCtor = (spineNS as any).SkeletonJson || (spineModule as any).SkeletonJson;

        // --- 3. CREATE TEXTURE ATLAS WITH SAFE TEXTURE ACCESS ---
        console.log('Creating TextureAtlas with validated texture loader...');
        
        // Đảm bảo texture luôn có sẵn và valid
        const safeTexture = chickenTexture || Texture.WHITE;
        console.log('Using safe texture:', safeTexture, 'dimensions:', safeTexture.width, 'x', safeTexture.height);
        
        // Tạo một texture loader an toàn với full validation
        const safeTextureLoader = (line: string) => {
            console.log('Safe texture loader called for:', line);
            
            // Đảm bảo luôn trả về texture có đầy đủ properties
            const texture = safeTexture;
            
            // Validate texture có tất cả properties cần thiết
            if (!texture) {
                console.error('Texture is null/undefined, creating emergency fallback');
                return Texture.WHITE;
            }
            
            // Ensure texture có các properties spine-pixi cần
            if (!texture.source && !texture.baseTexture) {
                console.warn('Texture missing source/baseTexture, adding fallback properties');
                // Thêm properties fallback nếu thiếu
                (texture as any).baseTexture = texture.source || Texture.WHITE.source;
            }
            
            console.log('Returning validated texture:', texture);
            return texture;
        };
        
        let atlas: any = null;
        try {
            atlas = new TextureAtlasCtor(atlasText, safeTextureLoader);
            console.log('TextureAtlas created successfully');
        } catch (e) {
            console.error('Failed to create TextureAtlas:', e);
            console.log('Trying with absolute minimal loader...');
            
            // Final fallback - trả về Texture.WHITE cho mọi request
            try {
                atlas = new TextureAtlasCtor(atlasText, () => {
                    console.log('Emergency fallback loader - returning WHITE');
                    return Texture.WHITE;
                });
                console.log('Emergency atlas creation succeeded');
            } catch (e2) {
                console.error('Even emergency atlas creation failed:', e2);
                return;
            }
        }

        // Kiểm tra atlas được tạo thành công
        if (!atlas) {
            console.error('Failed to create TextureAtlas');
            return;
        }
        
        console.log('Atlas created successfully:', atlas);
        
        const atlasLoader = new AtlasAttachmentLoaderCtor(atlas);
        if (!atlasLoader) {
            console.error('Failed to create AtlasAttachmentLoader');
            return;
        }
        
        const skeletonJson = new SkeletonJsonCtor(atlasLoader);
        if (!skeletonJson) {
            console.error('Failed to create SkeletonJson');
            return;
        }
        
        const skeletonData = skeletonJson.readSkeletonData(jsonRaw);
        if (!skeletonData) {
            console.error('Failed to read skeleton data');
            return;
        }
        
        console.log('SkeletonData created:', skeletonData);
        
        const spine = new SpineCtor(skeletonData);
        if (!spine) {
            console.error('Failed to create Spine instance');
            return;
        }
        
        console.log('Spine instance created successfully:', spine);

        // --- 4. SAFE CONFIGURATION WITH VALIDATION ---
        console.log('Configuring spine instance...');
        
        // Validate spine object structure
        if (!spine) {
            console.error('Spine object is null/undefined');
            return;
        }
        
        // Check skeleton exists before accessing
        if (spine.skeleton) {
            console.log('Skeleton found, configuring...');
            try {
                if (typeof spine.skeleton.setSkin === 'function') {
                    spine.skeleton.setSkin('default');
                    console.log('Skin set to default');
                }
            } catch (e) {
                console.warn('Failed to set skin:', e);
            }
            
            try {
                if (typeof spine.skeleton.setToSetupPose === 'function') {
                    spine.skeleton.setToSetupPose();
                    console.log('Setup pose applied');
                }
            } catch (e) {
                console.warn('Failed to set setup pose:', e);
            }
        } else {
            console.error('Spine skeleton is missing');
        }
        
        // Safe update call
        try {
            if (typeof spine.update === 'function') {
                spine.update(0);
                console.log('Initial spine update completed');
            }
        } catch (e) {
            console.error('Failed to update spine:', e);
        }

        // --- 5. SAFE ANIMATION ENUMERATION ---
        console.log('Enumerating available animations...');
        try {
            if (skeletonData && skeletonData.animations) {
                console.log('SkeletonData animations:', skeletonData.animations);
                
                if (Array.isArray(skeletonData.animations)) {
                    console.log('Animations is array, length:', skeletonData.animations.length);
                    for (const a of skeletonData.animations) {
                        if (a && a.name && typeof a.name === 'string') {
                            this.available.add(a.name);
                            console.log('Added animation:', a.name);
                        }
                    }
                } else if (typeof skeletonData.animations === 'object') {
                    console.log('Animations is object, keys:', Object.keys(skeletonData.animations));
                    for (const k of Object.keys(skeletonData.animations)) {
                        if (k && typeof k === 'string') {
                            this.available.add(k);
                            console.log('Added animation key:', k);
                        }
                    }
                }
            } else {
                console.warn('No animations found in skeletonData');
            }
        } catch (e) {
            console.error('Failed to enumerate animations:', e);
        }
        
        console.log('Available animations:', Array.from(this.available));

        this.spine = spine;
        this.view = spine;

        // Mixes & Events
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

    // --- GIỮ NGUYÊN CÁC HÀM HỖ TRỢ ---
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