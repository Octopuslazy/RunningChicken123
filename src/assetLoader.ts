import { Assets, Texture, Rectangle } from 'pixi.js';

declare const require: any;

// --- 1. IMPORT & EXPORT RAW DATA (Quan trọng) ---
// Chúng ta export các biến này để SpinePlayer dùng trực tiếp
import _chickenPng from '../Assets/Arts/anim/kfc_chicken.png';
import _chickenAtlas from '../Assets/Arts/anim/kfc_chicken.atlas'; 
import _chickenJson from '../Assets/Arts/anim/kfc_chicken.json';

export const RAW_SPINE_ASSETS = {
    png: _chickenPng,
    atlas: _chickenAtlas,
    json: _chickenJson
};

// --- Helper giải mã Base64 ---
function decodeBase64ToText(dataUri: string): string {
    if (!dataUri || !dataUri.startsWith('data:')) return dataUri;
    try {
        // Tách header data:text/plain;base64,
        const base64 = dataUri.split(',')[1]; 
        if (!base64) return '';
        const str = atob(base64);
        return decodeURIComponent(Array.prototype.map.call(str, (c: string) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    } catch (e) {
        console.warn('Base64 decode warning', e);
        return '';
    }
}

// --- Logic Load Assets ---
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
        const paths = [
            fileNameWithExt, 
            `${baseFolder}/${fileNameWithExt}`, 
            `${cleanFolder}/${fileNameWithExt}`, 
            `/${cleanFolder}/${fileNameWithExt}`
        ];
        
        // Audio hint để tránh warning
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

    // --- 1. SETUP SPINE (Chỉ cần đăng ký Texture để dùng chung nếu cần) ---
    try {
        // Chúng ta load texture này vào Cache để các thành phần khác (nếu có) dùng được
        // Còn SpinePlayer sẽ dùng RAW_SPINE_ASSETS trực tiếp
        Assets.add({ alias: 'kfc_chicken_image', src: _chickenPng });
        await Assets.load('kfc_chicken_image');
        
        // Giải mã Atlas Text để debug nếu cần
        const atlasText = decodeBase64ToText(_chickenAtlas);
        // Lưu text vào cache để fallback
        Assets.cache.set('kfc_chicken_atlas', atlasText);
        
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