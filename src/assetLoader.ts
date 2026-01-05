import { Assets, Texture, Rectangle } from 'pixi.js';
import * as spinePixi from '@esotericsoftware/spine-pixi-v8';

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
    
    // CSP-safe approach: do NOT create data: or blob: URLs at runtime.
    // Only ensure the spine PNG texture is prepared and return raw atlas/json
    // so the caller can assemble the atlas/skeleton in-memory or register
    // them into `Assets.cache` using `registerSpineForSpineFrom()`.
    try {
        const texture = await prepareSpineTexture();
        const atlasText = RAW_SPINE_ASSETS.atlas;
        const jsonData = RAW_SPINE_ASSETS.json;

        spineAssetsCache = {
            texture,
            jsonData,
            atlasText
        };

        return spineAssetsCache;
    } catch (error) {
        console.error('Failed to prepare spine texture:', error);
        const texture = await prepareSpineTexture();
        spineAssetsCache = {
            texture,
            jsonData: RAW_SPINE_ASSETS.json,
            atlasText: RAW_SPINE_ASSETS.atlas
        };
        return spineAssetsCache;
    }
}

/**
 * Register atlas and skeleton into PIXI.Assets.cache so `spine.Spine.from()`
 * can load them via aliases. This mirrors the inline example that sets a
 * TextureAtlas into the cache and maps pages to the loaded texture source.
 */
export async function registerSpineForSpineFrom(atlasAlias = 'spineAtlas', skeletonAlias = 'spineSkeleton') {
    try {
        const texture = await prepareSpineTexture();
        if (!texture) throw new Error('No spine texture available');

        const spineModule: any = spinePixi as any;
        const TextureAtlasCtor = spineModule?.TextureAtlas || spineModule?.spine?.TextureAtlas || spineModule?.default?.spine?.TextureAtlas;
        const SpineTextureCtor = spineModule?.SpineTexture || spineModule?.spine?.SpineTexture || spineModule?.default?.spine?.SpineTexture;

        if (!TextureAtlasCtor || !SpineTextureCtor) {
            console.warn('Spine TextureAtlas or SpineTexture not found in runtime');
            return false;
        }

        // Create texture atlas from raw atlas text
        const atlasText = RAW_SPINE_ASSETS.atlas || '';
        const atlas = new TextureAtlasCtor(atlasText);

        // Map each page to the loaded texture's underlying source
        const src = (texture as any).source || (texture as any).baseTexture?.resource?.source || texture;
        for (const page of atlas.pages) {
            try {
                const spineTex = SpineTextureCtor.from ? SpineTextureCtor.from(src) : new SpineTextureCtor(src);
                if (page.setTexture) page.setTexture(spineTex); else page.texture = spineTex;
            } catch (e) {
                // ignore per-page failures
            }
        }

        // Put atlas and skeleton directly into PIXI Assets cache
        (Assets.cache as any).set(atlasAlias, atlas);
        (Assets.cache as any).set(skeletonAlias, RAW_SPINE_ASSETS.json);

        return true;
    } catch (err) {
        console.error('registerSpineForSpineFrom failed:', err);
        return false;
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