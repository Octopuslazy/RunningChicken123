import { Assets, Texture, Rectangle } from 'pixi.js';

declare const require: any;

// --- 1. IMPORT RAW DATA ---
import _chickenPng from '../Assets/Arts/anim/kfc_chicken.png';
import _chickenAtlas from '../Assets/Arts/anim/kfc_chicken.atlas'; 
import _chickenJson from '../Assets/Arts/anim/kfc_chicken.json';

// Export dữ liệu thô
export const RAW_SPINE_ASSETS = {
    png: _chickenPng,
    atlas: _chickenAtlas,
    json: _chickenJson
};

export const FIXED_CHICKEN_ALIAS = 'fixed_chicken_tex';

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
    console.log('Start loading assets...');
    const assetsToLoad: string[] = [];

    // --- 1. SETUP SPINE TEXTURE ---
    try {
        // Nạp texture con gà vào Cache với tên cố định
        // Dùng Assets.load để đảm bảo nó được upload lên GPU và có width/height > 0
        Assets.add({ alias: FIXED_CHICKEN_ALIAS, src: _chickenPng });
        const tex = await Assets.load(FIXED_CHICKEN_ALIAS);
        
        if (tex) {
            console.log(`Spine Texture Ready: ${tex.width}x${tex.height}`);
        } else {
            console.error("Spine Texture failed to load!");
        }
    } catch (e) { console.warn('Spine setup error', e); }

    // --- 2. LOAD ARTS & SOUNDS ---
    registerSmartAliases(arts, '../Assets/_arts', assetsToLoad);
    registerSmartAliases(sounds, '../Assets/Sounds', assetsToLoad);

    if (assetsToLoad.length > 0) {
        await Assets.load(assetsToLoad); 
    }
    console.log('All assets loaded.');
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