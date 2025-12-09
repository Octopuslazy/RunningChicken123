import { Assets, Texture, Rectangle } from 'pixi.js';

declare const require: any;

// Import spine assets directly - webpack will handle them
import _chickenPng from '../Assets/Arts/anim/kfc_chicken.png';
import _chickenAtlas from '../Assets/Arts/anim/kfc_chicken.atlas'; 
import _chickenJson from '../Assets/Arts/anim/kfc_chicken.json';

// Helper function to decode webpack assets
function decodeWebpackAsset(asset: any): string {
    if (typeof asset === 'string') {
        // If it's a data URL, decode base64
        if (asset.startsWith('data:')) {
            try {
                const commaIdx = asset.indexOf(',');
                if (commaIdx > -1) {
                    const base64 = asset.substring(commaIdx + 1);
                    return atob(base64);
                }
            } catch (e) {
                console.error('Failed to decode base64 asset:', e);
            }
        }
        return asset;
    }
    if (asset && asset.default) return decodeWebpackAsset(asset.default);
    return '';
}

// Export spine assets with decoding
export const RAW_SPINE_ASSETS = {
    png: _chickenPng,
    atlas: decodeWebpackAsset(_chickenAtlas),
    json: _chickenJson // JSON should be imported as object by webpack
};

export const FIXED_CHICKEN_ALIAS = 'fixed_chicken_tex';

// --- Spine Texture Management ---
let spineTextureReady: Texture | null = null;
let spineAssetsCache: { texture: Texture | null; jsonData: any; atlasText: string } | null = null;

export function getSpineTexture(): Texture | null {
    return spineTextureReady;
}

export async function prepareSpineTexture(): Promise<Texture | null> {
    try {
        // Load spine texture using webpack imports
        if (!spineTextureReady) {
            Assets.add({ alias: FIXED_CHICKEN_ALIAS, src: RAW_SPINE_ASSETS.png });
            const tex = await Assets.load(FIXED_CHICKEN_ALIAS);
            
            if (tex && tex.width > 0 && tex.height > 0) {
                spineTextureReady = tex;
            }
        }
        return spineTextureReady;
    } catch (e) {
        return null;
    }
}

export async function loadSpineAssets(): Promise<{
    texture: Texture | null;
    jsonData: any;
    atlasText: string;
}> {
    // Return cached assets if available
    if (spineAssetsCache && spineAssetsCache.texture) {
        return spineAssetsCache;
    }
    
    // Load spine assets using PIXI Assets system like in spine-runtimes commit
    try {
        // Create blob URLs for the assets (safer than data URLs)
        const atlasBlob = new Blob([RAW_SPINE_ASSETS.atlas], { type: 'text/plain' });
        const atlasUrl = URL.createObjectURL(atlasBlob);
        
        const jsonString = typeof RAW_SPINE_ASSETS.json === 'object' 
            ? JSON.stringify(RAW_SPINE_ASSETS.json) 
            : RAW_SPINE_ASSETS.json;
        const jsonBlob = new Blob([jsonString], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        
        // First load the texture
        const baseTexture = await Assets.load({
            alias: 'spineTexture',
            src: RAW_SPINE_ASSETS.png
        });
        
        console.log('Base texture loaded:', {
            width: baseTexture.width,
            height: baseTexture.height,
            valid: baseTexture.valid
        });
        
        // Add atlas with explicit loadParser and texture mapping
        Assets.add({
            alias: 'spineAtlas',
            loadParser: 'spineTextureAtlasLoader',
            src: atlasUrl,
            data: {
                images: {
                    'kfc_chicken.png': baseTexture.source // Use texture source for v8
                }
            }
        });
        
        // Add skeleton data
        Assets.add({
            alias: 'spineSkeleton', 
            loadParser: 'loadJson',
            src: jsonUrl
        });
        
        // Load both atlas and skeleton
        await Assets.load(['spineAtlas', 'spineSkeleton']);
        
        console.log('Spine assets loaded via PIXI Assets system');
        
        // Cache the results
        spineAssetsCache = {
            texture: baseTexture,
            jsonData: RAW_SPINE_ASSETS.json,
            atlasText: RAW_SPINE_ASSETS.atlas
        };
        
        return spineAssetsCache;
        
    } catch (error) {
        console.error('Failed to load spine assets via PIXI Assets:', error);
        
        // Fallback to old method
        const texture = await prepareSpineTexture();
        const atlasText = RAW_SPINE_ASSETS.atlas;
        const jsonData = RAW_SPINE_ASSETS.json;
        
        spineAssetsCache = {
            texture,
            jsonData,
            atlasText
        };
        
        return spineAssetsCache;
    }
}

// --- Webpack Context ---
function importAll(r: any) {
    const images: Record<string, any> = {};
    r.keys().forEach((item: string) => {
        let val = r(item);
        if (val && val.default) val = val.default;
        const key = item.replace(/^\.\//, ''); 
        images[key] = val;
    });
    return images;
}

const arts = (function(){ try { return importAll((require as any).context('../Assets/_arts', false, /\.(png|jpe?g|svg)$/)); } catch (e) { return {}; } })();
const sounds = (function(){ try { return importAll((require as any).context('../Assets/Sounds', false, /\.(mp3|wav|ogg|MP3)$/)); } catch (e) { return {}; } })();

function registerSmartAliases(sourceMap: any, baseFolder: string, loadList: string[]) {
    const cleanFolder = baseFolder.replace('../', ''); 
    for (const fileNameWithExt of Object.keys(sourceMap)) {
        const src = sourceMap[fileNameWithExt]; 
        const paths = [fileNameWithExt, `${baseFolder}/${fileNameWithExt}`, `${cleanFolder}/${fileNameWithExt}`, `/${cleanFolder}/${fileNameWithExt}`];
        const isAudio = fileNameWithExt.match(/\.(mp3|wav|ogg)$/i);
        const options = isAudio ? { format: isAudio[1].toLowerCase() } : {};
        for (const path of paths) {
             if (!Assets.cache.has(path)) Assets.add({ alias: path, src: src, ...options });
        }
        loadList.push(fileNameWithExt);
    }
}

export async function loadGameAssets() {

    const assetsToLoad: string[] = [];

    // --- 1. SETUP SPINE TEXTURE ---
    await prepareSpineTexture();

    // --- 2. LOAD ARTS & SOUNDS ---
    registerSmartAliases(arts, '../Assets/_arts', assetsToLoad);
    registerSmartAliases(sounds, '../Assets/Sounds', assetsToLoad);

    if (assetsToLoad.length > 0) {
        await Assets.load(assetsToLoad); 
    }

    return { images: arts, sounds };
}

// --- Utilities ---
export async function loadTexture(path: string): Promise<Texture | null> {
    try { return (await Assets.load(path)) as Texture; } catch (err) { return null; }
}
export async function loadTextures(paths: string[]): Promise<Record<string, Texture | null>> {
    const out: Record<string, Texture | null> = {};
    await Promise.all(paths.map(async (p) => { out[p] = await loadTexture(p); }));
    return out;
}
export async function loadSpriteStrip(path: string, frames: number): Promise<Texture[] | null> { return null; }
export function splitSpriteStrip(tex: Texture, frames: number): Texture[] | null { return null; }
export async function loadIndexedFrames(basePathNoExt: string, count: number): Promise<Texture[] | null> { return null; }

export { arts, sounds };
export default { loadTexture, loadTextures, loadGameAssets, RAW_SPINE_ASSETS };