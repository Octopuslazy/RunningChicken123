import { Container, Sprite, Texture } from 'pixi.js';
import { loadTexture } from './assetLoader';

export type CreateGroundOptions = {
  tilePath?: string;
  tileWidth?: number;
  worldWidth?: number; // how far to prepare tiles (defaults to WIDTH*3 equivalent)
};

// createRoad: builds a tiled ground layer using the provided image.
// Returns an object with `container` and `update(scroll)` to be called each frame.
export async function createRoad(parent: Container, groundY: number, WIDTH: number, HEIGHT: number, opts: CreateGroundOptions = {}) {
  const tilePath = opts.tilePath ?? '/Assets/_arts/bg_1_groundmid.png';
  const tileTex = await loadTexture(tilePath);

  const container = new Container();
  container.y = groundY;
  parent.addChild(container);

  if (!tileTex) {
    // no texture, return no-op update
    return {
      container,
      update(_scroll: number) { /* no-op */ },
      tileWidth: 0
    };
  }

  const tileW = opts.tileWidth ?? (tileTex.width || 64);
  const worldWidth = opts.worldWidth ?? WIDTH * 3;
  const needed = Math.ceil(worldWidth / tileW) + 4;

  const tiles: Sprite[] = [];
  for (let i = 0; i < needed; i++) {
    const s = new Sprite(tileTex as any);
    s.x = i * tileW;
    s.y = 0; // container.y is ground top
    s.anchor.set(0, 0);
    tiles.push(s);
    container.addChild(s);
  }

  // Keep tiles tiled; update adjusts container.x so tiles appear to scroll.
  function update(scroll: number) {
    // scroll is world scroll in pixels; keep tiles repeating by offsetting container
    const offset = -(scroll % tileW);
    container.x = offset;
  }

  return { container, update, tileWidth: tileW, tiles };
}

export default createRoad;
