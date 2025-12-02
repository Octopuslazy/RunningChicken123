import { Container, Graphics, Text, Rectangle } from 'pixi.js';

// PatternData describes a single pattern (segment) in the world. Each pattern
// provides its length (in world pixels), the offset to the next pattern's
// start, a difficulty tag, and the `container` which holds the PIXI display
// objects for that pattern.
export interface PatternData {
  length: number;
  nextStartOffset: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  container: Container;
}

export type PatternFactory = (startX: number) => PatternData;

// MapHandler manages a sequence of Patterns and provides compatibility helpers
// (pits/obstacles) so existing code can keep working while we migrate to
// Pattern-based world composition.
export class MapHandler {
  private world: Container;
  private WIDTH: number;
  private HEIGHT: number;
  private bg: Graphics;
  private label: Text;

  // internal state (kept for compatibility with existing gameplay logic)
  private scroll = 0;
  private speed = 0;
  private baseInitialSpeed = 200;

  // legacy-style pits and obstacles (will be replaced by Patterns later)
  private pits: { x: number; width: number }[] = [];
  private obstacles: { x: number; width: number; height: number; sprite: Graphics }[] = [];
  private obstaclesContainer: Container;

  constructor(options: { world: Container; bg: Graphics; label: Text; WIDTH: number; HEIGHT: number; initialSpeed?: number; }) {
    this.world = options.world;
    this.bg = options.bg;
    this.label = options.label;
    this.WIDTH = options.WIDTH;
    this.HEIGHT = options.HEIGHT;
    this.baseInitialSpeed = options.initialSpeed ?? this.baseInitialSpeed;
    this.speed = this.baseInitialSpeed;

    this.obstaclesContainer = new Container();
    this.world.addChild(this.obstaclesContainer);
  }

  // addPattern allows registering a Pattern factory; for now we keep this
  // simple and spawn lightweight pattern containers when requested.
  addPattern(factory: PatternFactory, startX: number) {
    try {
      const p = factory(startX);
      p.container.x = startX;
      this.world.addChild(p.container);
      // patterns may include pits/obstacles internally — for backward
      // compatibility we detect simple markers here in future.
      return p;
    } catch (e) {
      return null as any;
    }
  }

  // update advances the scroll, updates background color, and performs
  // simple pit/obstacle spawning to preserve existing gameplay behaviour.
  update(deltaSec: number, speedAccel = 8) {
    this.speed += speedAccel * deltaSec;
    this.scroll += this.speed * deltaSec;
    this.world.x = -this.scroll;

    // subtle background hue change to keep previous visual behaviour
    const hue = (this.scroll * 0.02) % 360;
    const col = MapHandler.hslToHex(hue, 70, 55);
    this.bg.clear().rect(0, 0, this.WIDTH, this.HEIGHT).fill(col);

    this.label.text = `Speed: ${Math.round(this.speed)} px/s  Distance: ${Math.floor(this.scroll)} px`;

    // spawn simple pits and obstacles for now. These will be migrated to
    // proper Pattern factories in the next step.
    const PIT_INTERVAL = 1600;
    const PIT_WIDTH = 160;
    const PIT_SPAWN_AHEAD = this.WIDTH * 0.8;
    if (this.scroll >= (this.pits.length ? this.pits[this.pits.length - 1].x - PIT_INTERVAL : PIT_INTERVAL)) {
      const px = this.scroll + PIT_SPAWN_AHEAD;
      this.pits.push({ x: px, width: PIT_WIDTH });
    }

    // obstacles (legacy)
    const OB_MIN_INTERVAL = 600;
    const OB_MAX_INTERVAL = 1400;
    const OB_SPAWN_AHEAD = this.WIDTH * 0.9;
    if (Math.random() < 0.01) {
      const px = this.scroll + OB_SPAWN_AHEAD + Math.random() * 120;
      const size = 80 + Math.floor(Math.random() * 80);
      const g = new Graphics();
      g.rect(0, 0, size, size).fill(0x996633);
      g.x = px;
      const groundTop = this.HEIGHT - 120;
      g.y = groundTop - size;
      g.interactive = true;
      g.hitArea = new Rectangle(0, 0, size, size) as any;
      const ob = { x: px, width: size, height: size, sprite: g } as any;
      g.on('pointerdown', () => {
        try { this.obstaclesContainer.removeChild(g); const idx = this.obstacles.indexOf(ob); if (idx >= 0) this.obstacles.splice(idx, 1); } catch (e) {}
      });
      this.obstaclesContainer.addChild(g);
      this.obstacles.push(ob);
    }

    // cleanup obstacles behind camera
    while (this.obstacles.length && (this.obstacles[0].x + this.obstacles[0].width) < (this.scroll - 200)) {
      try { this.obstaclesContainer.removeChild(this.obstacles[0].sprite); } catch (e) {}
      this.obstacles.shift();
    }

    return { scroll: this.scroll, speed: this.speed };
  }

  getObstacles() { return this.obstacles; }

  static hslToHex(h: number, s: number, l: number) {
    s /= 100; l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const to255 = (v: number) => Math.round(f(v) * 255);
    return (to255(0) << 16) + (to255(8) << 8) + to255(4);
  }

  isOverPit(worldX: number) {
    for (const p of this.pits) {
      if (worldX >= p.x && worldX <= p.x + p.width) return true;
    }
    return false;
  }

  reset() {
    this.scroll = 0;
    this.speed = this.baseInitialSpeed;
    this.pits.length = 0;
    try {
      for (const o of this.obstacles) { try { this.obstaclesContainer.removeChild(o.sprite); } catch (e) {} }
    } catch (e) {}
    this.obstacles.length = 0;
  }
}

// Keep the old createGameplay function but back it with MapHandler so callers
// in `main.ts` remain compatible. This gives us a clean migration path to
// building Patterns in the next step.
export function createGameplay({ world, bg, ground, label, WIDTH, HEIGHT, initialSpeed = 200, speedAccel = 8 }:
  { world: Container; bg: Graphics; ground: Graphics; label: Text; WIDTH: number; HEIGHT: number; initialSpeed?: number; speedAccel?: number; }) {
  const handler = new MapHandler({ world, bg, label, WIDTH, HEIGHT, initialSpeed });

  return {
    update: (deltaSec: number) => handler.update(deltaSec, speedAccel),
    getScroll: () => (handler as any).scroll,
    getSpeed: () => (handler as any).speed,
    isOverPit: (x: number) => handler.isOverPit(x),
    getPits: () => (handler as any).pits,
    getObstacles: () => handler.getObstacles(),
    isColliding: (x: number, y: number, r: number) => {
      // reuse existing simple collision check against obstacles
      for (const o of handler.getObstacles()) {
        const left = o.x; const right = o.x + o.width;
        if (x + r > left && x - r < right) {
          const obstacleTop = o.sprite.y;
          if (y + r > obstacleTop) return true;
        }
      }
      return false;
    },
    getBlockingObstacle: (x: number, y: number, r: number) => {
      for (const o of handler.getObstacles()) {
        const left = o.x; const right = o.x + o.width;
        if (x + r > left && x - r < right) {
          const playerBottom = y + r;
          const obstacleTop = o.sprite.y;
          if (playerBottom > obstacleTop) return o;
        }
      }
      return null;
    },
    reset: () => handler.reset(),
    // expose handler for future pattern operations
    _handler: handler
  };
}
