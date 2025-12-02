import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { PatternData } from '../gameplay';

// Decoration pattern: safe segment with decorative sprites and a cluster of coins
export function createDecorationPattern(startX: number): PatternData {
  const length = 900;
  const nextStartOffset = 80; // small gap to next pattern
  const difficulty: PatternData['difficulty'] = 'EASY';

  const container = new Container();

  // ground visual: draw a simple ground rectangle whose top is at y=0
  const groundH = 120;
  const ground = new Graphics();
  ground.rect(0, 0, length, groundH).fill({ color: 0x4a7a1a });
  container.addChild(ground);

  // decorative elements: simple rounded rectangles / sprites above ground
  for (let i = 0; i < 5; i++) {
    const deco = new Graphics();
    const w = 60 + Math.floor(Math.random() * 40);
    const h = 40 + Math.floor(Math.random() * 60);
    deco.rect(50 + i * 160, -h, w, h).fill({ color: 0x2e8b57 });
    container.addChild(deco);
  }

  // coin cluster (collectibles) — draw small yellow circles above ground
  for (let i = 0; i < 8; i++) {
    const cx = 220 + i * 40;
    const cy = -60 - (i % 3) * 6;
    const coin = new Graphics();
    coin.circle(cx, cy, 8).fill({ color: 0xffd700 });
    (coin as any).label = `coin_${i}`;
    container.addChild(coin);
  }

  return { length, nextStartOffset, difficulty, container } as PatternData;
}

export default createDecorationPattern;
