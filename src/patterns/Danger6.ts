import { Container, Sprite, Texture } from 'pixi.js';
import Pickup from '../prefabs/Pickup';
import { PatternData, PatternFactory } from '../gameplay';

export interface Danger6Options {
  length?: number;
  leftEnd?: boolean;
  rightEnd?: boolean;
  pitGap?: number;
}

// Danger6: three floating platforms (standable, non-lethal)
export function makeDanger6(opts: Danger6Options = {}): PatternFactory {
  const length = opts.length ?? 1800;
  return function create(startX: number): PatternData {
    const container = new Container();
    try { container.sortableChildren = true; } catch (e) {}

    const tex = Texture.from('/Assets/_arts/platform.png');
    const gw = (tex && (tex as any).width) ? (tex as any).width : 160;
    const gh = 28;
    const scale = 2;

    const patternObstacles: { x: number; width: number; height: number; y?: number; isPlane?: boolean; isPlatform?: boolean; layer?: string; planeId?: number }[] = [];

    // create three platforms across the visual length at different heights
    const visualLength = length;

    // compute horizontal placement so there are explicit pits between platforms
    const gwScaled = gw * scale;
    // collider width should match visual platform width so player can stand
    // across the entire platform surface.
    const colliderWidthScaled = gwScaled;
    const desiredPit = typeof (opts as any).pitGap === 'number' ? (opts as any).pitGap : 1000;
    // required width to place 3 platforms separated by two pits
    let pitGap = desiredPit;
    let required = 3 * gwScaled + 2 * pitGap;
    let margin = Math.max(0, Math.round((visualLength - required) / 2));
    if (required > visualLength) {
      // Not enough room: reduce pitGap to fit (minimum 40px)
      pitGap = Math.max(40, Math.floor((visualLength - 3 * gwScaled) / 2));
      required = 3 * gwScaled + 2 * pitGap;
      margin = Math.max(0, Math.round((visualLength - required) / 2));
    }
    const leftCenter = margin + Math.round(gwScaled / 2);
    const middleCenter = leftCenter + Math.round(gwScaled + pitGap);
    const rightCenter = middleCenter + Math.round(gwScaled + pitGap);
    const positions = [leftCenter / visualLength, middleCenter / visualLength, rightCenter / visualLength];

    // Spread platforms vertically (top, middle, low) with slight random jitter
    const baseHeights = [-500, -760, -120];

    for (let i = 0; i < positions.length; i++) {
      const localCenterX = Math.round(positions[i] * visualLength);
      let localY = baseHeights[i] + Math.floor((Math.random() - 0.5) * 40); // +/-20px jitter
      const s = new Sprite(tex as any);
      s.anchor && (s.anchor.set(0.5, 0.5));
      s.x = localCenterX;
      s.y = localY;
      // scale platform visual
      try { s.scale.set(scale, scale); } catch (e) {}
      // mark as a pattern plane so gameplay update will move visuals and link colliders
      const pid = Math.floor(Math.random() * 1e9);
      try { (s as any).__isPatternPlane = true; } catch (e) {}
      try { (s as any).__planeId = pid; } catch (e) {}
      try { (s as any).__isPlatform = true; } catch (e) {}
      try { (s as any).__platformWidth = gw * scale; (s as any).__platformHeight = gh * scale; } catch (e) {}
      // Ensure platform is static (no horizontal velocity)
      try { (s as any).__vx = 0; } catch (e) {}

      container.addChild(s);

      // obstacle.x is local left coordinate relative to container
      const leftLocal = localCenterX - Math.round(colliderWidthScaled / 2);
      patternObstacles.push({ x: leftLocal, width: colliderWidthScaled, height: gh * scale, y: localY, isPlane: true, isPlatform: true, layer: 'Danger', planeId: pid });
    }
    try {
          if (Math.random() < 0.5) {
            const itemType = Math.floor(Math.random() * 7);
            const tex = Texture.from(`/Assets/_arts/obj_${itemType}.png`);
            const pu = new Pickup(itemType, tex as any);
            // position relative to pattern container (center-ish)
            pu.x = 290;
            pu.y = -640; // place above ground; tweak if needed
            pu.zIndex = 1200;
            // allow manual collection on click during testing
            try { pu.on && pu.on('pointerdown', (e: any) => { try { if (e && e.data && e.data.originalEvent && typeof e.data.originalEvent.stopPropagation === 'function') e.data.originalEvent.stopPropagation(); else if (e && typeof e.stopPropagation === 'function') e.stopPropagation(); } catch (e) {} try { pu.collect(); } catch (e) {} }); } catch (e) {}
            container.addChild(pu);
            try { const g = (window as any).pickups; if (g && Array.isArray(g)) g.push(pu); } catch (e) {}
          }
        } catch (e) {}

    const playerYOffset = -8;
    return { length: visualLength, nextStartOffset: 0, difficulty: 'MEDIUM', container, playerYOffset, obstacles: patternObstacles, noGround: true } as PatternData;
  };
}

export default makeDanger6;
