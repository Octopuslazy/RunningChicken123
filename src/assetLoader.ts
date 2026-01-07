import { Assets, Texture, Rectangle } from 'pixi.js';
import * as spinePixi from '@esotericsoftware/spine-pixi-v8';

declare const require: any;
export interface AssetLoaderConfig {
    spine?: {
        enabled: boolean;
        baseName: string; // e.g., 'kfc_chicken', 'hero', 'monster'
        basePath: string; // e.g., '../Assets/Arts/anim'
        textureAlias?: string;
    };
    folders: {
        arts: string; // e.g., '../Assets/_arts'
        sounds: string; // e.g., '../Assets/Sounds'
    };
    fileExtensions: {
        images: string[]; // e.g., ['.png', '.jpg', '.jpeg', '.svg']
        sounds: string[]; // e.g., ['.mp3', '.wav', '.ogg']
    };
}

// DEFAULT CONFIG - Customize this for your project
const DEFAULT_CONFIG: AssetLoaderConfig = {
    spine: {
        enabled: true,
        baseName: 'kfc_chicken',
        basePath: '../Assets/Arts/anim',
        textureAlias: 'fixed_chicken_tex'
    },
    folders: {
        arts: '../Assets/_arts',
        sounds: '../Assets/Sounds'
    },
    fileExtensions: {
        images: ['.png', '.jpg', '.jpeg', '.svg'],
        sounds: ['.mp3', '.wav', '.ogg', '.MP3']
    }
};

let currentConfig: AssetLoaderConfig = DEFAULT_CONFIG;

// Function to set custom configuration
export function configureAssetLoader(config: Partial<AssetLoaderConfig>) {
    currentConfig = { ...DEFAULT_CONFIG, ...config };
    if (config.spine) {
        currentConfig.spine = { ...DEFAULT_CONFIG.spine!, ...config.spine };
    }
    if (config.folders) {
        currentConfig.folders = { ...DEFAULT_CONFIG.folders, ...config.folders };
    }
    if (config.fileExtensions) {
        currentConfig.fileExtensions = { ...DEFAULT_CONFIG.fileExtensions, ...config.fileExtensions };
    }
}

// Dynamic imports based on configuration
let _spineAssets: any = null;

async function loadSpineAssetsDynamically() {
    if (!currentConfig.spine?.enabled || _spineAssets) return _spineAssets;
    
    try {
        const { baseName, basePath } = currentConfig.spine;
        const pngPath = `${basePath}/${baseName}.png`;
        const atlasPath = `${basePath}/${baseName}.atlas`;
        const jsonPath = `${basePath}/${baseName}.json`;

        // Dynamic imports
        const [pngModule, atlasModule, jsonModule] = await Promise.all([
            import(/* webpackMode: "eager" */ `${pngPath}`),
            import(/* webpackMode: "eager" */ `${atlasPath}`),
            import(/* webpackMode: "eager" */ `${jsonPath}`)
        ]);

        _spineAssets = {
            png: pngModule.default || pngModule,
            atlas: atlasModule.default || atlasModule,
            json: jsonModule.default || jsonModule
        };
    } catch (error) {
        console.warn('Failed to load spine assets dynamically:', error);
        // Fallback to default if available
        try {
            const _chickenPng = await import('../Assets/Arts/anim/kfc_chicken.png');
            const _chickenAtlas = await import('../Assets/Arts/anim/kfc_chicken.atlas'); 
            const _chickenJson = await import('../Assets/Arts/anim/kfc_chicken.json');
            
            _spineAssets = {
                png: _chickenPng.default || _chickenPng,
                atlas: _chickenAtlas.default || _chickenAtlas,
                json: _chickenJson.default || _chickenJson
            };
        } catch (fallbackError) {
            console.error('Failed to load fallback spine assets:', fallbackError);
            _spineAssets = { png: null, atlas: '', json: null };
        }
    }
    
    return _spineAssets;
}

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

// Get spine assets with current configuration
export async function getRawSpineAssets() {
    const assets = await loadSpineAssetsDynamically();
    return {
        png: assets?.png,
        atlas: decodeWebpackAsset(assets?.atlas),
        json: assets?.json
    };
}

export function getSpineTextureAlias(): string {
    return currentConfig.spine?.textureAlias || 'default_spine_tex';
}

// --- Spine Texture Management ---
let spineTextureReady: Texture | null = null;
let spineAssetsCache: { texture: Texture | null; jsonData: any; atlasText: string } | null = null;

export function getSpineTexture(): Texture | null {
    return spineTextureReady;
}

export async function prepareSpineTexture(): Promise<Texture | null> {
    if (!currentConfig.spine?.enabled) return null;
    
    try {
        // Load spine texture using webpack imports
        if (!spineTextureReady) {
            const spineAssets = await getRawSpineAssets();
            const alias = getSpineTextureAlias();
            
            if (spineAssets.png) {
                Assets.add({ alias, src: spineAssets.png });
                const tex = await Assets.load(alias);
                
                if (tex && tex.width > 0 && tex.height > 0) {
                    spineTextureReady = tex;
                }
            }
        }
        return spineTextureReady;
    } catch (e) {
        console.error('Failed to prepare spine texture:', e);
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
    
    if (!currentConfig.spine?.enabled) {
        spineAssetsCache = { texture: null, jsonData: null, atlasText: '' };
        return spineAssetsCache;
    }
    
    try {
        const texture = await prepareSpineTexture();
        const spineAssets = await getRawSpineAssets();
        
        spineAssetsCache = {
            texture,
            jsonData: spineAssets.json,
            atlasText: spineAssets.atlas
        };

        return spineAssetsCache;
    } catch (error) {
        console.error('Failed to load spine assets:', error);
        const texture = await prepareSpineTexture();
        const spineAssets = await getRawSpineAssets();
        
        spineAssetsCache = {
            texture,
            jsonData: spineAssets.json,
            atlasText: spineAssets.atlas
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
        const spineAssets = await getRawSpineAssets();
        const atlasText = spineAssets.atlas || '';
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
        (Assets.cache as any).set(skeletonAlias, spineAssets.json);

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

// Dynamic asset loading based on configuration
function loadAssetsFromFolder(folderPath: string, extensions: string[]) {
    try {
        const extensionPattern = extensions.map(ext => ext.replace('.', '\\.')).join('|');
        const regex = new RegExp(`\\.(${extensionPattern})$`);
        return importAll((require as any).context(folderPath, false, regex));
    } catch (e) {
        console.warn(`Failed to load assets from ${folderPath}:`, e);
        return {};
    }
}

// Get arts and sounds with current configuration
function getArts() {
    return loadAssetsFromFolder(
        currentConfig.folders.arts, 
        currentConfig.fileExtensions.images
    );
}

function getSounds() {
    return loadAssetsFromFolder(
        currentConfig.folders.sounds, 
        currentConfig.fileExtensions.sounds
    );
}

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
    if (currentConfig.spine?.enabled) {
        await prepareSpineTexture();
    }

    // --- 2. LOAD ARTS & SOUNDS ---
    const arts = getArts();
    const sounds = getSounds();
    
    registerSmartAliases(arts, currentConfig.folders.arts, assetsToLoad);
    registerSmartAliases(sounds, currentConfig.folders.sounds, assetsToLoad);

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

// Export dynamic getters for backward compatibility
export const getArtsAssets = () => getArts();
export const getSoundsAssets = () => getSounds();

// For backward compatibility - these will use current config
export const arts = new Proxy({} as Record<string, any>, {
    get(_, prop) { return getArts()[prop as string]; },
    ownKeys() { return Object.keys(getArts()); },
    has(_, prop) { return prop in getArts(); }
});

export const sounds = new Proxy({} as Record<string, any>, {
    get(_, prop) { return getSounds()[prop as string]; },
    ownKeys() { return Object.keys(getSounds()); },
    has(_, prop) { return prop in getSounds(); }
});

export default { 
    loadTexture, 
    loadTextures, 
    loadGameAssets, 
    configureAssetLoader,
    getRawSpineAssets,
    getSpineTextureAlias
};