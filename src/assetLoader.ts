import { Assets, Texture, Rectangle } from 'pixi.js';

declare const require: any;

// --- 1. Import Spine Thủ Công (Bắt buộc cho Single File) ---
import chickenPng from '../Assets/Arts/anim/kfc_chicken.png';
// Import atlas dưới dạng raw text (cần config webpack module rule cho .atlas là asset/source hoặc asset/inline)
import chickenAtlas from '../Assets/Arts/anim/kfc_chicken.atlas'; 
import chickenJson from '../Assets/Arts/anim/kfc_chicken.json';

// =========================================================
// CÁC HÀM HỖ TRỢ GAME (UTILITIES)
// =========================================================

export async function loadTexture(path: string): Promise<Texture | null> {
    try {
        const tex = await Assets.load(path);
        return tex as Texture;
    } catch (err) {
        console.warn(`AssetLoader: failed to load ${path}:`, err);
        return null;
    }
}

export async function loadTextures(paths: string[]): Promise<Record<string, Texture | null>> {
    const out: Record<string, Texture | null> = {};
    await Promise.all(paths.map(async (p) => { out[p] = await loadTexture(p); }));
    return out;
}

export async function loadSpriteStrip(path: string, frames: number): Promise<Texture[] | null> {
    try {
        const tex = await Assets.load(path) as Texture;
        const w = tex.width;
        const h = tex.height;
        if (!w || !h || frames <= 0) return null;
        const frameW = Math.floor(w / frames);
        const source = tex.source; 
        const out: Texture[] = [];
        for (let i = 0; i < frames; i++) {
            const rect = new Rectangle(i * frameW, 0, frameW, h);
            out.push(new Texture({ source: source, frame: rect }));
        }
        return out;
    } catch (err) { return null; }
}

export function splitSpriteStrip(tex: Texture, frames: number): Texture[] | null {
    try {
        const w = tex.width;
        const h = tex.height;
        if (!w || !h || frames <= 0) return null;
        const frameW = Math.floor(w / frames);
        const source = tex.source;
        const out: Texture[] = [];
        for (let i = 0; i < frames; i++) {
            const rect = new Rectangle(i * frameW, 0, frameW, h);
            out.push(new Texture({ source: source, frame: rect }));
        }
        return out;
    } catch (err) { return null; }
}

export async function loadIndexedFrames(basePathNoExt: string, count: number): Promise<Texture[] | null> {
    if (!basePathNoExt || count <= 0) return null;
    const seps = ['_', '-', ''];
    let base = basePathNoExt.replace(/\.(png|jpg|jpeg|webp|gif)$/i, '');
    for (const sep of seps) {
        const candidates: string[] = [];
        for (let i = 0; i < count; i++) { candidates.push(`${base}${sep}${i}.png`); }
        try {
            const loaded = await Promise.all(candidates.map(async (p) => {
                try { return await Assets.load(p) as Texture; } catch (err) { return null; }
            }));
            if (loaded.every((t) => t)) return loaded as Texture[];
        } catch (err) {}
    }
    return null;
}

// =========================================================
// LOGIC LOAD ASSETS FIX LỖI CORS
// =========================================================

function importAll(r: any) {
    const images: Record<string, any> = {};
    r.keys().forEach((item: string) => {
        let val = r(item);
        if (val && val.default) val = val.default;
        
        // SỬA LỖI: Giữ nguyên tên file có đuôi để phân biệt .jpg và .png
        // item ví dụ: "./gameover.jpg" -> key: "gameover.jpg"
        const key = item.replace(/^\.\//, ''); 
        images[key] = val;
    });
    return images;
}
const arts = (function(){ try { return importAll((require as any).context('../Assets/_arts', false, /\.(png|jpe?g|svg)$/)); } catch (e) { return {}; } })();
const sounds = (function(){ try { return importAll((require as any).context('../Assets/Sounds', false, /\.(mp3|wav|ogg|MP3)$/)); } catch (e) { return {}; } })();

function registerSmartAliases(sourceMap: any, baseFolder: string, extension: string, loadList: string[]) {
    // baseFolder ví dụ: "../Assets/_arts"
    const cleanFolder = baseFolder.replace('../', ''); // "Assets/_arts"

    for (const alias of Object.keys(sourceMap)) {
        const src = sourceMap[alias]; 
        const nameWithExt = `${alias}.${extension}`;

        const pathsToRegister = [
            alias,                                  // "bg_city"
            nameWithExt,                            // "bg_city.png"
            `${baseFolder}/${nameWithExt}`,         // "../Assets/_arts/bg_city.png"
            `${baseFolder}/${alias}`,               // "../Assets/_arts/bg_city"
            // FIX QUAN TRỌNG: Thêm trường hợp có dấu / ở đầu mà main.ts đang dùng
            `/${cleanFolder}/${nameWithExt}`,       // "/Assets/_arts/bg_city.png"
            `/${cleanFolder}/${alias}`,             // "/Assets/_arts/bg_city"
            `${cleanFolder}/${nameWithExt}`         // "Assets/_arts/bg_city.png"
        ];

        for (const path of pathsToRegister) {
             if (!Assets.cache.has(path)) {
                 Assets.add({ alias: path, src: src });
             }
        }
        loadList.push(alias);
    }
}

export async function loadGameAssets() {
    console.log('Start loading assets...');
    const assetsToLoad: string[] = [];

    // 1. SPINE
    try {
        Assets.add({ alias: 'kfc_chicken_atlas', src: chickenAtlas });
        Assets.add({ alias: 'kfc_chicken_image', src: chickenPng });
        Assets.add({ alias: 'kfc_chicken_json', src: chickenJson });
        // Alias cho các đường dẫn cũ
        const spinePath = 'Assets/Arts/anim/kfc_chicken.json';
        Assets.add({ alias: spinePath, src: chickenJson });
        Assets.add({ alias: `/${spinePath}`, src: chickenJson });
        
        await Assets.load(['kfc_chicken_atlas', 'kfc_chicken_image']);
        assetsToLoad.push('kfc_chicken_json');
    } catch (e) {}

    // 2. ARTS & SOUNDS
    registerSmartAliases(arts, '../Assets/_arts', 'png', assetsToLoad);
    registerSmartAliases(sounds, '../Assets/Sounds', 'mp3', assetsToLoad);
    registerSmartAliases(sounds, '../Assets/Sounds', 'MP3', assetsToLoad); 

    if (assetsToLoad.length > 0) {
        await Assets.load(assetsToLoad); 
        console.log('All assets loaded successfully!'); 
    }
    return { images: arts, sounds };
}

export { arts, sounds };
export default { loadTexture, loadTextures, loadGameAssets, loadSpriteStrip, splitSpriteStrip, loadIndexedFrames };