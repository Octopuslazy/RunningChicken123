import { Container, Sprite, Texture } from 'pixi.js';
import { PatternData, PatternFactory } from '../gameplay';

export interface GroundPatternOptions {
  leftEnd?: boolean;
  rightEnd?: boolean;
  length?: number;
}

export function makeGroundPattern(opts: GroundPatternOptions = {}): PatternFactory {
  const length = opts.length ?? 600;
  return function create(startX: number): PatternData {
    const container = new Container();
    try { container.sortableChildren = true; } catch (e) {}

    // Load ground textures (optional caps + repeating mid)
    const midTex = Texture.from('/Assets/_arts/bg_1_groundmid.png');
    const leftTex = opts.leftEnd ? Texture.from('/Assets/_arts/bg_1_groundleft.png') : null;
    const rightTex = opts.rightEnd ? Texture.from('/Assets/_arts/bg_1_groundright.png') : null;
    const midW = (midTex && (midTex as any).width) ? (midTex as any).width : 128;
    const midH = (midTex && (midTex as any).height) ? (midTex as any).height : 120;
    const lw = (leftTex && (leftTex as any).width) ? (leftTex as any).width : 0;
    const lh = (leftTex && (leftTex as any).height) ? (leftTex as any).height : midH;
    const rw = (rightTex && (rightTex as any).width) ? (rightTex as any).width : 0;
    const rh = (rightTex && (rightTex as any).height) ? (rightTex as any).height : midH;

    // left cap
    if (opts.leftEnd && leftTex) {
      const s = new Sprite(leftTex as any);
      s.x = 0;
      s.y = -lh;
      s.anchor.set(0, 0);
      container.addChild(s);
    }

    // mid tiles
    const midStart = lw;
    const midTiles = Math.ceil(length / midW);
    for (let i = 0; i < midTiles; i++) {
      const s = new Sprite(midTex as any);
      s.x = midStart + i * midW;
      s.y = -midH;
      s.anchor.set(0, 0);
      container.addChild(s);
    }

    // right cap
    if (opts.rightEnd && rightTex) {
      const s = new Sprite(rightTex as any);
      s.anchor.set(0, 0);
      s.scale.x = 1;
      s.x = lw + length + rw;
      s.y = -rh;
      container.addChild(s);
    }

    // collect obstacles for MapHandler (plane platform + any others)
    const patternObstacles: { x: number; width: number; height: number; isGround?: boolean; isPlane?: boolean }[] = [];

    // decorative plane centered above the mid section
    try {
      const planeTex = Texture.from('/Assets/_arts/bg_3_plane.png');
      if (planeTex) {
        const ps = new Sprite(planeTex as any);
        ps.anchor.set(0.5, 1);
        // scale the plane up x2 as requested
        ps.scale.set(2.5, 2.5);
        ps.x = midStart + Math.floor(length / 2);
        ps.y = -430;
        ps.zIndex = 900;
        // mark sprite so main ticker can find and animate it
        (ps as any).__isPatternPlane = true;
        // horizontal velocity (px/s) relative to pattern local coords
        // increase speed by 1.3x as requested (-220 -> -286)
        (ps as any).__vx = -600;
        container.addChild(ps);

        const texW = (planeTex as any).width || 240;
        const gw = texW * (ps.scale.x || 1);
        const gh = 28; // thin platform collider height
        const leftX = ps.x - gw * ps.anchor.x;
        // store metadata so main can match collider entries later
        (ps as any).__platformLocalLeft = leftX;
        (ps as any).__platformWidth = gw;
        (ps as any).__platformHeight = gh;
        patternObstacles.push({ x: leftX, width: gw, height: gh, isGround: true, isPlane: true });
      }
    } catch (e) {}
    try {
      const storeTex = Texture.from('/Assets/_arts/bg_1_standee1.png');
      if (storeTex) {
        const ds = new Sprite(storeTex);
        // anchor bottom-center so the sprite sits on top of the ground surface
        ds.anchor.set(0.1, 1);
        ds.x = midStart + 400;
        // set bottom to container local y=0 so it sits on the road top
        ds.y = -300;
        // neutral scale; adjust if necessary
        ds.scale.set(2, 2);
        // ensure decoration renders above mid tiles
        ds.zIndex = 1000;
        container.addChild(ds);
      }
    } catch (e) {}
    const visualLength = lw + length + rw;
    const playerYOffset = -8;
    return { length: visualLength, nextStartOffset: 0, difficulty: 'MEDIUM', container, playerYOffset, obstacles: patternObstacles } as PatternData;
  };
}

export default makeGroundPattern;
