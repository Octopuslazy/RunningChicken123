import { Container, Graphics } from 'pixi.js';
import { PatternData } from '../gameplay';

// Plain road: simple stretch of ground that may include a small decor
export function createPlainRoadPattern(startX: number): PatternData {
  const length = 700;
  const nextStartOffset = 40;
  const difficulty: PatternData['difficulty'] = 'EASY';

  const container = new Container();
  const groundH = 120;
  const ground = new Graphics();
  ground.rect(0, 0, length, groundH).fill({ color: 0x5b8a3c });
  container.addChild(ground);

  // small decoration: a bench or rock
  const deco = new Graphics();
  deco.rect(220, -40, 80, 40).fill({ color: 0x7b5a3c });
  container.addChild(deco);

  return { length, nextStartOffset, difficulty, container } as PatternData;
}

export default createPlainRoadPattern;
