import { Container, Sprite, Texture } from 'pixi.js';
import { PatternData, PatternFactory } from '../gameplay';

export interface GroundPatternOptions {
  leftEnd?: boolean;
  rightEnd?: boolean;
  length?: number;
}

export function makeGroundPattern(opts: GroundPatternOptions = {}): PatternFactory {
  const length = opts.length ?? 700;
  return function create(startX: number): PatternData {
    const container = new Container();
    // allow per-child zIndex ordering so decorations can be forced above tiles
    try { container.sortableChildren = true; } catch (e) {}

    // Load textures and measure sizes
    const midTex = Texture.from('/Assets/_arts/bg_1_groundmid.png');
    const leftTex = opts.leftEnd ? Texture.from('/Assets/_arts/bg_1_groundleft.png') : null;
    const rightTex = opts.rightEnd ? Texture.from('/Assets/_arts/bg_1_groundright.png') : null;
    const midW = (midTex && (midTex as any).width) ? (midTex as any).width : 128;
    const midH = (midTex && (midTex as any).height) ? (midTex as any).height : 120;
    const lw = (leftTex && (leftTex as any).width) ? (leftTex as any).width : 0;
    const lh = (leftTex && (leftTex as any).height) ? (leftTex as any).height : midH;
    const rw = (rightTex && (rightTex as any).width) ? (rightTex as any).width : 0;
    const rh = (rightTex && (rightTex as any).height) ? (rightTex as any).height : midH;

    // Layout strategy:
    // - left end at x=0 (if present)
    // - mid tiles cover the declared `length` horizontally starting at x=lw
    // - right end at x = lw + length
    // This makes the pattern's visual width = lw + length + rw.

    // left end
    if (opts.leftEnd && leftTex) {
      const s = new Sprite(leftTex as any);
      s.x = 0;
      s.y = -lh;
      s.anchor.set(0, 0);
      container.addChild(s);
    }

    // mid tiles cover the internal length area
    const midStart = lw;
    const midTiles = Math.ceil(length / midW);
    for (let i = 0; i < midTiles; i++) {
      const s = new Sprite(midTex as any);
      s.x = midStart + i * midW;
      s.y = -midH;
      s.anchor.set(0, 0);
      container.addChild(s);
    }

    // decorative store sprite placed centered over the mid section
    try {
      const storeTex = Texture.from('/Assets/_arts/bg_1_store3.png');
      if (storeTex) {
        const ds = new Sprite(storeTex);
        // anchor bottom-center so the sprite sits on top of the ground surface
        ds.anchor.set(0.1, 1);
        ds.x = midStart + 300;
        // set bottom to container local y=0 so it sits on the road top
        ds.y = -300;
        // neutral scale; adjust if necessary
        ds.scale.set(0.7, 1);
        // ensure decoration renders above mid tiles
        ds.zIndex = 1000;
        container.addChild(ds);
      }
    } catch (e) {}
    try {
      const storeTex = Texture.from('/Assets/_arts/bg_1_light.png');
      if (storeTex) {
        const ds = new Sprite(storeTex);
        // anchor bottom-center so the sprite sits on top of the ground surface
        ds.anchor.set(0.1, 1);
        ds.x = midStart;
        // set bottom to container local y=0 so it sits on the road top
        ds.y = -300;
        // neutral scale; adjust if necessary
        ds.scale.set(0.7, 1);
        // ensure decoration renders above mid tiles
        ds.zIndex = 1000;
        container.addChild(ds);
      }
    } catch (e) {}

    // right end
    if (opts.rightEnd && rightTex) {
      const s = new Sprite(rightTex as any);
      // mirror the right cap horizontally so it faces outward
      s.anchor.set(0, 0);
      s.scale.x = 1;
      // place so the flipped sprite's right edge sits at lw + length + rw
      s.x = lw + length + rw;
      s.y = -rh;
      container.addChild(s);
    }

    const visualLength = lw + length + rw;
    // align player to the top of the pattern's thin collider (groundThickness = 8)
    // so the player's feet sit on the collider. This offset is relative to
    // the container.y (worldGroundTop) and points to the collider top.
    const playerYOffset = -8;
    return { length: visualLength, nextStartOffset: 0, difficulty: 'EASY', container, playerYOffset } as PatternData;
  };
}

export default makeGroundPattern;
