import { Container, Sprite, Texture, Graphics } from 'pixi.js';
import Pickup from '../prefabs/Pickup';
import { PatternData, PatternFactory } from '../gameplay';

export interface GroundPatternOptions {
  leftEnd?: boolean;
  rightEnd?: boolean;
  length?: number;
}

export function makeGroundPattern(opts: GroundPatternOptions = {}): PatternFactory {
  const length = opts.length ?? 1200;
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
    // We'll collect pattern-local obstacles here so MapHandler can create
    // colliders for them when the pattern is added to the world.
    const patternObstacles: { x: number; width: number; height: number }[] = [];
    try {
      const storeTex = Texture.from('/Assets/_arts/bg_1_wheels.png');
      if (storeTex) {
        const ds = new Sprite(storeTex);
        // anchor bottom-center so the sprite sits on top of the ground surface
        ds.anchor.set(0.1, 1);
        ds.x = midStart + 100;
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
      const storeTex = Texture.from('/Assets/_arts/obs_1.png');
      if (storeTex) {
        const ds = new Sprite(storeTex);
        // anchor bottom-center so the sprite sits on top of the ground surface
        ds.anchor.set(0.1, 1);
        ds.x = midStart + 50;
        // set bottom to container local y=0 so it sits on the road top
        ds.y = -150;
        // neutral scale; adjust if necessary
        ds.scale.set(0.7, 1);
        // ensure decoration renders above mid tiles
        ds.zIndex = 1000;
        container.addChild(ds);

        // compute obstacle bounds (convert sprite anchor to left/top coordinates)
        const texW = (storeTex as any).width || 64;
        const texH = (storeTex as any).height || 64;
        const gw = texW * ds.scale.x;
        const gh = texH * ds.scale.y;
        const leftX = ds.x - gw * ds.anchor.x;
        // Increase obs_1 collider thickness by 1.5x so collisions are more forgiving
        const colliderMultiplier = 1.5;
        const obsColliderH = Math.round(gh * colliderMultiplier);
        // place collider so its top aligns with sprite bottom (container-local coords)
        const colliderY = ds.y - obsColliderH;

        patternObstacles.push({ x: leftX, width: gw, height: obsColliderH, y: colliderY, layer: 'Danger', debugColor: 0xff8800, debugAlpha: 0.5 } as any);
      }
    } catch (e) {}
    try {
      const storeTex = Texture.from('/Assets/_arts/obs_1.png');
      if (storeTex) {
        const ds = new Sprite(storeTex);
        // anchor bottom-center so the sprite sits on top of the ground surface
        ds.anchor.set(0.1, 1);
        ds.x = midStart + 950;
        // set bottom to container local y=0 so it sits on the road top
        ds.y = -150;
        // neutral scale; adjust if necessary
        ds.scale.set(0.7, 1);
        // ensure decoration renders above mid tiles
        ds.zIndex = 1000;
        container.addChild(ds);

        const texW = (storeTex as any).width || 64;
        const texH = (storeTex as any).height || 64;
        const gw = texW * ds.scale.x;
        const gh = texH * ds.scale.y;
        const leftX = ds.x - gw * ds.anchor.x;
        // Increase obs_1 collider thickness by 1.5x so collisions are more forgiving
        const colliderMultiplier = 1.5;
        const obsColliderH2 = Math.round(gh * colliderMultiplier);
        const colliderY2 = ds.y - obsColliderH2;
        patternObstacles.push({ x: leftX, width: gw, height: obsColliderH2, y: colliderY2, layer: 'Danger', debugColor: 0xff8800, debugAlpha: 0.5 } as any);
      }
    } catch (e) {}
     try {
      const storeTex = Texture.from('/Assets/_arts/bg_2_bush.png');
      if (storeTex) {
        const ds = new Sprite(storeTex);
        // anchor bottom-center so the sprite sits on top of the ground surface
        ds.anchor.set(0.1, 1);
        ds.x = midStart + 600;
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
      const storeTex = Texture.from('/Assets/_arts/bg_2_bush.png');
      if (storeTex) {
        const ds = new Sprite(storeTex);
        // anchor bottom-center so the sprite sits on top of the ground surface
        ds.anchor.set(0.1, 1);
        ds.x = midStart + 500;
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
      const storeTex = Texture.from('/Assets/_arts/bg_2_bush.png');
      if (storeTex) {
        const ds = new Sprite(storeTex);
        // anchor bottom-center so the sprite sits on top of the ground surface
        ds.anchor.set(0.1, 1);
        ds.x = midStart + 700;
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

    // spawn one random pickup on this pattern (50% chance)
    try {
      if (Math.random() < 0.5) {
        const itemType = Math.floor(Math.random() * 7);
        const tex = Texture.from(`/Assets/_arts/obj_${itemType}.png`);
        const pu = new Pickup(itemType, tex as any);
        // position relative to pattern container (center-ish)
        pu.x = midStart + Math.floor(Math.random() * Math.max(1, Math.floor(length - 80)))+40;
        pu.y = -500; // place above ground; tweak if needed
        pu.zIndex = 1200;
        // allow manual collection on click during testing
        try { pu.on && pu.on('pointerdown', (e: any) => { try { if (e && e.data && e.data.originalEvent && typeof e.data.originalEvent.stopPropagation === 'function') e.data.originalEvent.stopPropagation(); else if (e && typeof e.stopPropagation === 'function') e.stopPropagation(); } catch (e) {} try { pu.collect(); } catch (e) {} }); } catch (e) {}
        container.addChild(pu);
        try { const g = (window as any).pickups; if (g && Array.isArray(g)) g.push(pu); } catch (e) {}
      }
    } catch (e) {}

    const visualLength = lw + length + rw;
    // align player to the top of the pattern's thin collider (groundThickness = 8)
    // so the player's feet sit on the collider. This offset is relative to
    // the container.y (worldGroundTop) and points to the collider top.
    const playerYOffset = -8;
    return { length: visualLength, nextStartOffset: 0, difficulty: 'MEDIUM', container, playerYOffset, obstacles: patternObstacles } as PatternData;
  };
}

export default makeGroundPattern;
