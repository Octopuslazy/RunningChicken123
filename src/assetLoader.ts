import { Assets, Texture, Rectangle } from 'pixi.js';

// Simple wrapper around PIXI Assets to centralize loading and error handling.
// Returns `Texture` or `null` if load fails.
export async function loadTexture(path: string): Promise<Texture | null> {
  try {
    const tex = await Assets.load(path);
    return tex as Texture;
  } catch (err) {
    console.warn(`AssetLoader: failed to load ${path}:`, err);
    return null;
  }
}

// Load multiple textures and return a map of path => Texture | null
export async function loadTextures(paths: string[]): Promise<Record<string, Texture | null>> {
  const out: Record<string, Texture | null> = {};
  await Promise.all(paths.map(async (p) => { out[p] = await loadTexture(p); }));
  return out;
}

export default { loadTexture, loadTextures };

// Load a horizontal sprite strip and split into `frames` subtextures.
export async function loadSpriteStrip(path: string, frames: number): Promise<Texture[] | null> {
  try {
    const tex = await Assets.load(path) as Texture;
    const w = tex.width;
    const h = tex.height;
    if (!w || !h || frames <= 0) return null;
    const frameW = Math.floor(w / frames);
    // Resolve a base texture-like object to use when creating subtextures. Prefer
    // an existing `baseTexture`, otherwise build one from the `source` via
    // `Texture.from(...).baseTexture`. Use `any` to avoid bundler/typedef issues.
    let base: any = null;
    if ((tex as any).baseTexture) base = (tex as any).baseTexture;
    else if ((tex as any).source) base = (Texture as any).from((tex as any).source).baseTexture;
    const out: Texture[] = [];
    for (let i = 0; i < frames; i++) {
      const rect = new Rectangle(i * frameW, 0, frameW, h);
      if (!base) continue;
      out.push(new (Texture as any)(base, rect));
    }
    return out;
  } catch (err) {
    console.warn(`AssetLoader: failed to load sprite strip ${path}:`, err);
    return null;
  }
}

// Split an already-loaded texture (horizontal strip) into frames
export function splitSpriteStrip(tex: Texture, frames: number): Texture[] | null {
  try {
    const w = tex.width;
    const h = tex.height;
    if (!w || !h || frames <= 0) return null;
    const frameW = Math.floor(w / frames);
    let base: any = null;
    if ((tex as any).baseTexture) base = (tex as any).baseTexture;
    else if ((tex as any).source) base = (Texture as any).from((tex as any).source).baseTexture;
    const out: Texture[] = [];
    for (let i = 0; i < frames; i++) {
      const rect = new Rectangle(i * frameW, 0, frameW, h);
      if (!base) continue;
      out.push(new (Texture as any)(base, rect));
    }
    return out;
  } catch (err) {
    console.warn(`AssetLoader: failed to split sprite strip:`, err);
    return null;
  }
}

// Try loading a sequence of indexed frame image files for an animation.
// Example usages:
//  - loadIndexedFrames('/Assets/_arts/run', 5) will try
//    '/Assets/_arts/run_0.png', '/Assets/_arts/run_1.png', ...
// It will also try a few common index separators: '_', '-', '' (no sep).
export async function loadIndexedFrames(basePathNoExt: string, count: number): Promise<Texture[] | null> {
  if (!basePathNoExt || count <= 0) return null;
  const seps = ['_', '-', ''];
  // ensure we don't have an extension on base (support if user passed with .png)
  let base = basePathNoExt;
  if (base.match(/\.(png|jpg|jpeg|webp|gif)$/i)) {
    base = base.replace(/\.(png|jpg|jpeg|webp|gif)$/i, '');
  }

  for (const sep of seps) {
    const candidates: string[] = [];
    for (let i = 0; i < count; i++) {
      candidates.push(`${base}${sep}${i}.png`);
    }

    // try loading all files in parallel; if any fail we treat this pattern as invalid
    try {
      const loaded = await Promise.all(candidates.map(async (p) => {
        try {
          const t = await Assets.load(p) as Texture;
          return t;
        } catch (err) {
          return null;
        }
      }));

      // if all loaded successfully (no nulls), return the textures
      if (loaded.every((t) => t)) {
        return loaded as Texture[];
      }
    } catch (err) {
      // ignore, try next separator
    }
  }

  return null;
}

// Load an image by URL into an HTMLImageElement
async function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = path;
  });
}

// Load a sprite strip image from `path` and produce an array of separate
// Textures, one per frame, by drawing each frame into its own offscreen
// canvas. This guarantees each Texture has correct width/height (e.g. 32x32)
// and avoids BaseTexture slicing issues.
export async function loadSpriteStripAsSeparateTextures(path: string, frames: number, tileW?: number, tileH?: number): Promise<Texture[] | null> {
  try {
    const img = await loadImage(path);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h || frames <= 0) return null;
    const fw = tileW ?? Math.floor(w / frames);
    const fh = tileH ?? h;
    const out: Texture[] = [];
    for (let i = 0; i < frames; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = fw;
      canvas.height = fh;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(img, i * fw, 0, fw, fh, 0, 0, fw, fh);
      const t = Texture.from(canvas as any);
      out.push(t);
    }
    return out;
  } catch (err) {
    console.warn(`AssetLoader: failed to load sprite strip as separate textures ${path}:`, err);
    return null;
  }
}

// Split an already-loaded texture into fixed-size tiles (tileW x tileH).
// This is useful when frames are 32x32 tiles in a horizontal strip.
export function splitSpriteStripFixed(tex: Texture, tileW = 32, tileH = 32): Texture[] | null {
  try {
    const w = tex.width;
    const h = tex.height;
    if (!w || !h) return null;
    const cols = Math.floor(w / tileW);
    if (cols <= 0) return null;

    let base: any = null;
    if ((tex as any).baseTexture) base = (tex as any).baseTexture;
    else if ((tex as any).source) base = (Texture as any).from((tex as any).source).baseTexture;

    if (!base) return null;
    const out: Texture[] = [];
    for (let i = 0; i < cols; i++) {
      const rect = new Rectangle(i * tileW, 0, tileW, tileH);
      out.push(new (Texture as any)(base, rect));
    }
    return out;
  } catch (err) {
    console.warn('AssetLoader: failed to split sprite strip fixed:', err);
    return null;
  }
}
