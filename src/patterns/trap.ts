import { Container, Graphics } from 'pixi.js';
import { PatternData } from '../gameplay';

// Trap pattern: ground with spike traps and a small gap possibility encoded
export function createTrapPattern(startX: number): PatternData {
  const length = 1000;
  // leave a moderate gap to next pattern so traps feel challenging
  const nextStartOffset = 120;
  const difficulty: PatternData['difficulty'] = 'MEDIUM';

  const container = new Container();

  // ground base (top at y=0)
  const groundH = 120;
  const ground = new Graphics();
  ground.rect(0, 0, length, groundH).fill({ color: 0x6b4f2b });
  container.addChild(ground);

  // Add spike traps as triangles sitting on top of ground.
  const spikeCount = 6;
  const spikeWidth = 28;
  const spikeHeight = 34;
  const baseX = 300;
  for (let i = 0; i < spikeCount; i++) {
    const x = baseX + i * (spikeWidth + 8);
    const g = new Graphics();
    // draw triangle (pointing upward). We draw its top at y = -spikeHeight
    try {
      if (typeof (g as any).fill === 'function') {
        try { (g as any).fill(0x333333); } catch (e) { try { (g as any).fill({ color: 0x333333 }); } catch (e) {} }
        try { (g as any).moveTo(x, -spikeHeight).lineTo(x + spikeWidth / 2, 0).lineTo(x + spikeWidth, -spikeHeight).closePath(); } catch (e) {}
        try { (g as any).endFill && (g as any).endFill(); } catch (e) {}
      } else {
        (g as any).beginFill && (g as any).beginFill(0x333333);
        try { (g as any).moveTo(x, -spikeHeight).lineTo(x + spikeWidth / 2, 0).lineTo(x + spikeWidth, -spikeHeight).closePath(); } catch (e) {}
        (g as any).endFill && (g as any).endFill();
      }
    } catch (e) {}
    // tag for potential collision detection by MapHandler
    (g as any).isTrap = true;
    container.addChild(g);
  }

  // optionally add a raised platform after spikes
  const platform = new Graphics();
  platform.rect(640, -60, 120, 60).fill({ color: 0x8b5a2b });
  container.addChild(platform);

  // Provide obstacle descriptors in local coordinates so MapHandler can
  // register proper hitboxes. Spikes are dangerous (height spikesHeight)
  // and the platform is a landable box.
  const obstacles = [] as { x: number; width: number; height: number }[];
  for (let i = 0; i < spikeCount; i++) {
    const x = baseX + i * (spikeWidth + 8);
    obstacles.push({ x, width: spikeWidth, height: spikeHeight });
  }
  // platform as a landable obstacle
  obstacles.push({ x: 640, width: 120, height: 60 });

  return { length, nextStartOffset, difficulty, container, obstacles } as PatternData;
}

export default createTrapPattern;
