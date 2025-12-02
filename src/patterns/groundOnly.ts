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
