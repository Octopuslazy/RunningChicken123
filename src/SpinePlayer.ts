import { Texture, Assets } from 'pixi.js';
import * as spinePixi from '@esotericsoftware/spine-pixi-v8';

// Helper giải mã tại chỗ
function safeDecodeBase64(dataUri: string): string {
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

    // --- SỬA LỖI TẠI ĐÂY: Thêm tham số rawAssets ---
    async load(basePath = '/Assets/Arts/anim/', rawAssets: any = null) {
        const spineModule: any = spinePixi as any;
        const SpineCtor = spineModule?.Spine || spineModule?.default?.Spine || spineModule?.spine?.Spine;
        const spineNS = spineModule?.spine || spineModule?.default?.spine || spineModule;

        if (!SpineCtor || !spineNS) throw new Error('Spine runtime missing.');

        let jsonRaw: any = null;
        let atlasText: string | null = null;
        let readyTexture: Texture | null = null;

        // 1. ƯU TIÊN DÙNG RAW ASSETS TRUYỀN VÀO TỪ MAIN.TS
        if (rawAssets && (this.name === 'kfc_chicken' || this.name.includes('chicken'))) {
            console.log("SpinePlayer: Using provided RAW ASSETS.");
            // A. JSON
            try {
                const jsonStr = safeDecodeBase64(rawAssets.json);
                if (jsonStr) jsonRaw = JSON.parse(jsonStr);
            } catch (e) {}

            // B. Atlas
            atlasText = safeDecodeBase64(rawAssets.atlas);

            // C. ENHANCED TEXTURE LOADING FOR SPINE
            console.log('🖼️ Loading texture for spine...');
            console.log('🔍 RAW_SPINE_ASSETS.png type:', typeof rawAssets.png);
            console.log('🔍 RAW_SPINE_ASSETS.png length:', rawAssets.png?.length || 'undefined');
            
            // Method 1: Try from cache first (most reliable)
            if (Assets.cache.has('fixed_chicken_tex')) {
                readyTexture = Assets.get('fixed_chicken_tex');
                console.log('✅ Method 1: Got from cache:', readyTexture.width + 'x' + readyTexture.height);
            } 
            // Method 2: Create fresh from base64
            else {
                console.log('🆕 Method 2: Creating fresh texture from base64...');
                try {
                    // Create image element first for better compatibility
                    const img = new Image();
                    img.src = rawAssets.png;
                    
                    // Wait for image to load
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        // Timeout fallback
                        setTimeout(() => reject(new Error('Image load timeout')), 5000);
                    });
                    
                    console.log('✅ Image element loaded:', img.width + 'x' + img.height);
                    
                    // Create PIXI texture from loaded image
                    readyTexture = Texture.from(img);
                    
                    // Ensure texture is ready (PIXI v8 compatible)
                    try {
                        if (readyTexture.source && readyTexture.source.width === 0) {
                            console.log('⏳ Waiting for texture to be ready...');
                            await new Promise(resolve => setTimeout(resolve, 100)); // Simple timeout
                        }
                    } catch (e) {
                        console.log('⚠️ Texture ready check skipped:', e);
                    }
                    
                    console.log('✅ PIXI Texture created:', readyTexture.width + 'x' + readyTexture.height);
                    
                } catch(e) {
                    console.error('❌ Method 2 failed:', e);
                    // Method 3: Direct Texture.from as last resort
                    try {
                        console.log('🆗 Method 3: Direct Texture.from...');
                        readyTexture = Texture.from(rawAssets.png);
                        console.log('✅ Direct texture created:', readyTexture.width + 'x' + readyTexture.height);
                    } catch (e3) {
                        console.error('❌ All methods failed:', e3);
                    }
                }
            }
            
            // Validation and emergency fallback
            if (!readyTexture || readyTexture.width === 0 || readyTexture.height === 0) {
                console.error('❌ No valid texture! Using WHITE as emergency fallback');
                readyTexture = Texture.WHITE;
            } else {
                console.log('✅ Final texture ready:', readyTexture.width + 'x' + readyTexture.height);
            }
        }

        if (!jsonRaw || !atlasText) {
             console.error(`Spine data missing for ${this.name}.`);
             return; 
        }

        // 2. SETUP RUNTIME
        const TextureAtlasCtor = (spineNS as any).TextureAtlas || (spineModule as any).TextureAtlas;
        const AtlasAttachmentLoaderCtor = (spineNS as any).AtlasAttachmentLoader || (spineModule as any).AtlasAttachmentLoader;
        const SkeletonJsonCtor = (spineNS as any).SkeletonJson || (spineModule as any).SkeletonJson;

        // 3. FIX ATLAS REGION TEXTURE ACCESS - SPINE-PIXI V8 SPECIFIC
        console.log('Creating TextureAtlas with spine-pixi v8 fix...');
        console.log('Ready texture:', readyTexture);
        
        const safeTexture = readyTexture || Texture.WHITE;
        
        // PROPER SPINE TEXTURE ATLAS CREATION
        console.log('🌐 Creating TextureAtlas with proper page loader...');
        
        const atlas = new TextureAtlasCtor(atlasText, (imagePath: string) => {
            console.log('🖼️ Atlas requesting image:', imagePath);
            console.log('🖼️ Returning texture:', safeTexture.width + 'x' + safeTexture.height);
            
            // DEBUG: Check what spine-pixi v8 actually expects
            console.log('🔍 Texture type:', safeTexture.constructor.name);
            console.log('🔍 Texture source:', safeTexture.source?.constructor.name);
            
            // Try different return formats for spine-pixi v8 compatibility
            const returnOptions = [
                safeTexture,                              // Option 1: Direct texture
                { texture: safeTexture },                 // Option 2: Wrapped
                safeTexture.source,                       // Option 3: Source only
            ];
            
            console.log('🎯 Using return option 1: Direct texture');
            return returnOptions[0];
        });
        
        console.log('🗺️ TextureAtlas created, validating regions...');
        console.log('🔍 Atlas object:', atlas);
        console.log('🔍 Atlas pages:', atlas?.pages?.length || 0);
        
        if (atlas && atlas.regions) {
            console.log('📊 Atlas regions count:', atlas.regions.length);
            
            // Just validate regions, don't manually modify them
            atlas.regions.forEach((region: any, index: number) => {
                if (region) {
                    const hasTexture = !!(region.texture || (region.page && region.page.texture));
                    console.log(`🔍 Region ${index}: "${region.name}" (${region.width}x${region.height}) hasTexture:${hasTexture}`);
                    
                    if (!hasTexture) {
                        console.warn(`⚠️ Region ${index} has no texture - this will cause rendering issues`);
                    }
                } else {
                    console.warn('❌ Region', index, 'is null/undefined');
                }
            });
        } else {
            console.error('❌ Atlas or atlas.regions is missing!');
        }

        // Validate atlas was created successfully
        if (!atlas) {
            console.error('Failed to create TextureAtlas');
            return;
        }
        console.log('TextureAtlas created successfully:', atlas);

        const atlasLoader = new AtlasAttachmentLoaderCtor(atlas);
        if (!atlasLoader) {
            console.error('Failed to create AtlasAttachmentLoader');
            return;
        }

        const skeletonJson = new SkeletonJsonCtor(atlasLoader);
        console.log('📖 Reading skeleton data...');
        const skeletonData = skeletonJson.readSkeletonData(jsonRaw);
        
        // Add extra validation for skeleton data
        if (!skeletonData) {
            console.error('❌ Failed to create skeleton data');
            return;
        }
        console.log('✅ Skeleton data created:');
        console.log('  🦴 Bones:', skeletonData.bones?.length || 0);
        console.log('  🎰 Slots:', skeletonData.slots?.length || 0);
        console.log('  🎬 Animations:', skeletonData.animations?.length || 0);
        if (skeletonData.animations) {
            const animNames = skeletonData.animations.map((a: any) => a.name || 'unnamed').join(', ');
            console.log('  📝 Animation names:', animNames);
        }
        console.log('  🎨 Skins:', skeletonData.skins?.length || 0);

        console.log('🎭 Creating Spine instance...');
        const spine = new SpineCtor(skeletonData);
        
        // Validate spine instance
        if (!spine) {
            console.error('Failed to create Spine instance');
            return;
        }
        console.log('🎭 Spine instance created successfully');
        
        // Check skeleton properties
        if (spine.skeleton) {
            console.log('💀 Skeleton info: bones=' + (spine.skeleton.bones?.length || 0) + ' slots=' + (spine.skeleton.slots?.length || 0));
            console.log('💀 Skeleton bounds: x=' + spine.skeleton.x + ' y=' + spine.skeleton.y);
        }

        // 4. CONFIG & SAFE SETUP (skip problematic calls)
        console.log('🔧 Configuring skeleton safely...');
        
        // Skip setSkin - causes compatibility issues
        console.log('⚠️ Skipping setSkin (compatibility issue)'); 
        
        // Safe setup pose
        try { 
            if (spine.skeleton && spine.skeleton.setToSetupPose) {
                spine.skeleton.setToSetupPose(); 
                console.log('🦴 Setup pose applied');
            }
        } catch (e) { console.warn('Setup pose failed:', e); }
        
        // Safe initial update 
        try { 
            if (spine.update) {
                spine.update(0.016); // Use 60fps delta instead of 0
                console.log('⚙️ Initial update applied');
            }
        } catch (e) { console.warn('Initial update failed:', e); }
        
        // Skip world transform - causes physics errors
        console.log('⚠️ Skipping updateWorldTransform (compatibility issue)'); 
        
        // FORCE: Make sure skeleton has valid state
        try {
            if (spine.skeleton) {
                // Manually set skeleton to visible state
                spine.skeleton.a = 1; // Alpha
                spine.skeleton.color = { r: 1, g: 1, b: 1, a: 1 }; // Color
                console.log('🎆 Forced skeleton visibility state');
            }
        } catch (e) { console.warn('Force visibility failed:', e); }

        try {
            if (skeletonData && Array.isArray(skeletonData.animations)) {
                for (const a of skeletonData.animations) { if (a && a.name) this.available.add(a.name); }
            } else if (skeletonData && skeletonData.animations) {
                for (const k of Object.keys(skeletonData.animations)) this.available.add(k);
            }
        } catch (e) {}

        this.spine = spine;
        this.view = spine;
        
        // CRITICAL: Force render state
        try {
            // Ensure view has proper visibility
            spine.visible = true;
            spine.alpha = 1;
            spine.renderable = true;
            
            // Force initial skeleton state
            if (spine.skeleton) {
                spine.skeleton.a = 1;
                if (spine.skeleton.slots) {
                    spine.skeleton.slots.forEach((slot: any) => {
                        if (slot) slot.a = 1; // Make all slots visible
                    });
                }
            }
            
            console.log('📍 Forced spine visibility: visible=' + spine.visible + ' alpha=' + spine.alpha);
        } catch (e) { 
            console.warn('Force render state failed:', e); 
        }

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

    // --- CÁC HÀM HỖ TRỢ (GIỮ NGUYÊN) ---
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