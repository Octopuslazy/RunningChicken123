import { Texture, Assets, Rectangle } from 'pixi.js';
import * as spinePixi from '@esotericsoftware/spine-pixi-v8';
import { FIXED_CHICKEN_ALIAS, getSpineTexture, prepareSpineTexture, loadSpineAssets } from './assetLoader';

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

    async loadFromAssetLoader() {
        try {
            // Load assets using PIXI Assets system
            await loadSpineAssets();
            
            // Use spine.Spine.from() method with aliases like in the commit example
            const spineModule: any = spinePixi as any;
            const SpineCtor = spineModule?.Spine || spineModule?.default?.Spine || spineModule?.spine?.Spine;
            
            if (!SpineCtor || !SpineCtor.from) {
                console.error('Spine.from() method not available');
                return null;
            }
            
            // Create spine using PIXI Assets aliases (similar to inline-loading.html example)
            this.spine = SpineCtor.from({
                skeleton: 'spineSkeleton',
                atlas: 'spineAtlas'
            });
            
            this.view = this.spine;
            
            console.log('Spine created using Spine.from():', {
                spineValid: !!this.spine,
                viewValid: !!this.view,
                hasState: !!this.spine?.state,
                hasSkeleton: !!this.spine?.skeleton
            });
            
            // Setup spine instance
            if (this.spine) {
                this.spine.autoUpdate = true;
                
                // Configure animations from skeleton data
                if (this.spine.skeleton?.data?.animations) {
                    for (const animation of this.spine.skeleton.data.animations) {
                        if (animation?.name) {
                            this.available.add(animation.name);
                        }
                    }
                }
                
                // Setup default configuration
                this._setupDefaultConfig(this.spine.skeleton?.data);
            }
            
            return this;
        } catch (e) {
            console.error('loadFromAssetLoader failed:', e);
            return null;
        }
    }

    async loadWithAssets(jsonData: any, atlasText: string, texture: Texture) {
        const spineModule: any = spinePixi as any;
        const SpineCtor = spineModule?.Spine || spineModule?.default?.Spine || spineModule?.spine?.Spine;
        const spineNS = spineModule?.spine || spineModule?.default?.spine || spineModule;

        if (!SpineCtor || !spineNS) {
            return null;
        }

        const TextureAtlasCtor = (spineNS as any).TextureAtlas || (spineModule as any).TextureAtlas;
        const AtlasAttachmentLoaderCtor = (spineNS as any).AtlasAttachmentLoader || (spineModule as any).AtlasAttachmentLoader;
        const SkeletonJsonCtor = (spineNS as any).SkeletonJson || (spineModule as any).SkeletonJson;

        try {
            // Parse JSON data - spine-webpack-plugin provides clean data
            let parsedJson = jsonData;
            if (typeof jsonData === 'string') {
                parsedJson = JSON.parse(jsonData);
            }
            
            const decodedAtlas = atlasText;

            // Create atlas với texture callback
            const atlas = new TextureAtlasCtor(decodedAtlas, (path: string) => {
                return texture; 
            });
            
            // CRITICAL: Setup atlas page properly
            if (atlas && atlas.pages.length > 0) {
                const page = atlas.pages[0];
                // Use the provided PIXI Texture's baseTexture for pages and regions
                const base = (texture as any).baseTexture || (texture as any)._baseTexture || texture;
                page.texture = base;
                page.rendererObject = base;
                page.width = base.width || texture.width;
                page.height = base.height || texture.height;

                // Setup texture regions with manual slicing
                if (page.regions) {
                    for (const region of page.regions) {
                        const regionRect = new Rectangle(region.x, region.y, region.width, region.height);
                        const regionTex = new Texture(base, regionRect);

                        // Update UVs to ensure correct UV mapping
                        try { regionTex.updateUvs(); } catch (e) {}

                        region.texture = regionTex;
                        (region as any).renderObject = regionTex;
                    }
                }
            }

            // Create spine skeleton
            const atlasLoader = new AtlasAttachmentLoaderCtor(atlas);
            const skeletonJson = new SkeletonJsonCtor(atlasLoader);
            const skeletonData = skeletonJson.readSkeletonData(parsedJson);
            const spine = new SpineCtor(skeletonData);

            console.log('Spine Creation Debug:', {
                atlasPages: atlas?.pages?.length || 0,
                skeletonValid: !!skeletonData,
                spineValid: !!spine,
                animations: skeletonData?.animations?.length || 0
            });

            // Setup spine instance
            this.spine = spine;
            this.view = this.spine;
            
            if (this.spine) {
                this.spine.autoUpdate = true;
                
                // Force spine hiển thị
                if (this.spine.skeleton) {
                    if (this.spine.skeleton.color) {
                        this.spine.skeleton.color.a = 1.0;
                        this.spine.skeleton.color.r = 1.0;
                        this.spine.skeleton.color.g = 1.0;
                        this.spine.skeleton.color.b = 1.0;
                    }
                    this.spine.alpha = 1;
                }
            }

            // Configure animations
            if (skeletonData?.animations) {
                for (const animation of (Array.isArray(skeletonData.animations) ? skeletonData.animations : Object.values(skeletonData.animations))) {
                    if (animation?.name) {
                        this.available.add(animation.name);
                    }
                }
            }

            // Setup default configuration
            this._setupDefaultConfig(skeletonData);

            return this;
        } catch (err) {
            return null;
        }
    }

    async load(basePath = '/Assets/Arts/anim/', rawAssets: any = null) {
        const spineModule: any = spinePixi as any;
        const SpineCtor = spineModule?.Spine || spineModule?.default?.Spine || spineModule?.spine?.Spine;
        const spineNS = spineModule?.spine || spineModule?.default?.spine || spineModule;
        
        if (!SpineCtor || !spineNS) {

            return;
        }

        const TextureAtlasCtor = (spineNS as any).TextureAtlas || (spineModule as any).TextureAtlas;
        const AtlasAttachmentLoaderCtor = (spineNS as any).AtlasAttachmentLoader || (spineModule as any).AtlasAttachmentLoader;
        const SkeletonJsonCtor = (spineNS as any).SkeletonJson || (spineModule as any).SkeletonJson;

        // 1. CHUẨN BỊ DỮ LIỆU
        let jsonRaw: any = null;
        let atlasText: string | null = null;
        let readyTexture: Texture | null = null;

        if (rawAssets) {
            try {
                if (typeof rawAssets.json === 'string') {
                    jsonRaw = JSON.parse(rawAssets.json);
                } else { 
                    jsonRaw = rawAssets.json; 
                }
            } catch (e) {}

            try { 
                atlasText = rawAssets.atlas; 
            } catch (e) {}

            // Get texture from assetLoader
            readyTexture = getSpineTexture();
            if (!readyTexture) {
                readyTexture = await prepareSpineTexture();
            }
        }

        if (!jsonRaw || !atlasText || !readyTexture) {

             return; 
        }

        // 2. TẠO ATLAS & MANUAL SLICING (Quan trọng cho Single File)
        const atlas = new TextureAtlasCtor(atlasText, (path: string) => {
            return readyTexture; 
        });

        if (atlas && atlas.pages.length > 0) {
            const page = atlas.pages[0];
            const base = (readyTexture as any).baseTexture || (readyTexture as any)._baseTexture || readyTexture;
            page.texture = base;
            page.rendererObject = base;
            page.width = base.width || readyTexture.width;
            page.height = base.height || readyTexture.height;

            if (page.regions) {
                for (const region of page.regions) {
                    const regionRect = new Rectangle(region.x, region.y, region.width, region.height);
                    const regionTex = new Texture(base, regionRect);
                    try { regionTex.updateUvs(); } catch (e) {}
                    region.texture = regionTex;
                    (region as any).renderObject = regionTex;
                }
            }
        }

        // 3. KHỞI TẠO SPINE
        let skeletonData: any = null;
        try {
            const atlasLoader = new AtlasAttachmentLoaderCtor(atlas);
            const skeletonJson = new SkeletonJsonCtor(atlasLoader);
            skeletonData = skeletonJson.readSkeletonData(jsonRaw);
            
            this.spine = new SpineCtor(skeletonData);
            this.view = this.spine;
            
            // --- FIX HIỂN THỊ: ÉP MÀU VÀ AUTO UPDATE ---
            if (this.spine) {
                this.spine.autoUpdate = true; // Tự động update theo ticker của Pixi
                
                // Ép Skeleton phải hiện (Alpha = 1)
                if (this.spine.skeleton) {
                    // Cấu trúc color thường là {r, g, b, a}
                    if (this.spine.skeleton.color) {
                         this.spine.skeleton.color.a = 1.0;
                         this.spine.skeleton.color.r = 1.0;
                         this.spine.skeleton.color.g = 1.0;
                         this.spine.skeleton.color.b = 1.0;
                    }
                    // Đặt lại opacity của container
                    this.spine.alpha = 1;
                }
            }


        } catch (err) {

            return;
        }

        // 4. CẤU HÌNH BAN ĐẦU
        if (skeletonData) {
            this._setupDefaultConfig(skeletonData);
        }

        return this;
    }

    private _setupDefaultConfig(skeletonData: any) {
        if (!this.spine) return;

        try { 
            if (this.spine.skeleton?.data?.defaultSkin) {
                this.spine.skeleton.setSkin(this.spine.skeleton.data.defaultSkin);
            }
            this.spine.skeleton.setToSetupPose();
            
            // Force update lần đầu để tính toán mesh
            this.spine.update(0.016);
        } catch (e) {}

        try {
            if (skeletonData && Array.isArray(skeletonData.animations)) {
                for (const a of skeletonData.animations) { if (a && a.name) this.available.add(a.name); }
            }
        } catch (e) {}

        try {
            const stateData = this.spine.stateData;
            if (stateData) {
                stateData.setMix('jump', 'run', 0.1);
                stateData.setMix('run', 'jump', 0.1);
                stateData.setMix('run', 'die', 0.1);
            }
        } catch (e) {}

        try {
            this.spine.state.addListener({
                complete: (entry: any) => {
                    if (entry.trackIndex === 0 && this.defaultLoop && entry.animation.name !== this.defaultLoop) {
                        this.play(this.defaultLoop, true, 0);
                    }
                }
            });
        } catch (e) {}
    }

    play(animName: string, loop = false, track = 0) {
        if (!this.spine || !this.available.has(animName)) return false;
        try { 
            this.spine.state.setAnimation(track, animName, !!loop); 
            return true; 
        } catch (e) { return false; }
    }

    playOnce(animName: string, track = 1) {
        return this.play(animName, false, track);
    }

    setDefaultLoop(animName: string) {
        this.defaultLoop = animName;
        if (this.spine && animName) this.play(animName, true, 0);
    }

    getAnimations() { return Array.from(this.available); }

    setPosition(x: number, y: number) { 
        if (this.view) { this.view.x = x; this.view.y = y; } 
    }

    setScale(s: number) { 
        if (this.view) this.view.scale.set(s); 
    }

    setTimeScale(scale: number) {
        if (!this.spine) return;
        this.desiredTimeScale = Math.max(0, scale || 0);
        try { this.spine.state.timeScale = this.desiredTimeScale; } catch (e) {}
    }

    pauseTrack(track = 0) {
        if (!this.spine) return;
        try {
            const entry = this.spine.state.getCurrent(track);
            if (!entry) return;
            this._pausedTrackScales[track] = entry.timeScale;
            entry.timeScale = 0;
        } catch (e) {}
    }

    resumeTrack(track = 0) {
        if (!this.spine) return;
        try {
            const entry = this.spine.state.getCurrent(track);
            const prev = this._pausedTrackScales[track];
            delete this._pausedTrackScales[track];
            if (!entry) return;
            entry.timeScale = (prev !== undefined) ? prev : this.desiredTimeScale;
        } catch (e) {}
    }
}