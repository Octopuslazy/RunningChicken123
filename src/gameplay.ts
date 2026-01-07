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
  // optional runtime hints used by MapHandler
  noGround?: boolean;
  playerYOffset?: number;
  pits?: { x: number; width: number }[];
  obstacles?: Array<{ x: number; width: number; height?: number; y?: number; isPlane?: boolean; isGround?: boolean; debugColor?: number; debugAlpha?: number; layer?: string; planeId?: string | number; isPlatform?: boolean }>;
}

export type PatternFactory = (startX: number) => PatternData;

export class MapHandler {
  private world: Container;
  private WIDTH: number;
  private HEIGHT: number;
  private bg: Graphics;
  private label: Text;
  private groundY: number;
  private patternYOffset: number;

  // internal state (kept for compatibility with existing gameplay logic)
  private scroll = 0;
  private speed = 0;
  private baseInitialSpeed = 200;

  // legacy-style pits and obstacles (will be replaced by Patterns later)
  private pits: { x: number; width: number }[] = [];
  private obstacles: { x: number; width: number; height: number; sprite: Graphics }[] = [];
  private obstaclesContainer: Container;
  private groundThickness = 8;
  private obstaclePadding = 0;
  // allow toggling random obstacle spawning (useful for debugging/testing)
  public allowRandomObstacles = true;

  constructor(options: { world: Container; bg: Graphics; label: Text; WIDTH: number; HEIGHT: number; groundY?: number; initialSpeed?: number; patternYOffset?: number; patternGroundThickness?: number; patternObstaclePadding?: number; }) {
    this.world = options.world;
    this.bg = options.bg;
    this.label = options.label;
    this.WIDTH = options.WIDTH;
    this.HEIGHT = options.HEIGHT;
    this.groundY = options.groundY ?? (this.HEIGHT + 100);
    this.patternYOffset = options.patternYOffset ?? 0;
    this.baseInitialSpeed = options.initialSpeed ?? this.baseInitialSpeed;
    this.speed = this.baseInitialSpeed;

    this.obstaclesContainer = new Container();
    this.world.addChild(this.obstaclesContainer);
    // Increase ground collider thickness by 2.5x as requested so ground hitboxes
    // are taller. If a patternGroundThickness option is provided use it,
    // otherwise fall back to the default and then multiply.
    this.groundThickness = (((options as any).patternGroundThickness ?? this.groundThickness) * 1.5);
    this.obstaclePadding = (options as any).patternObstaclePadding ?? 100;
    // track spawned patterns (start, length, topY) for ground membership checks
    this.patterns = [] as { start: number; length: number; top?: number }[];
  }

  // simple list of active patterns (world coordinates)
  private patterns: { start: number; length: number; top?: number; playerYOffset?: number; container?: Container }[] = [];
  
  // Pattern pooling system
  private patternPool: Container[] = [];
  private lastPatternEndX = 0; // Track where the last pattern ends
  private patternFactories: any[] = []; // Store factories for dynamic generation

  // addPattern allows registering a Pattern factory; for now we keep this
  // simple and spawn lightweight pattern containers when requested.
  addPattern(factory: PatternFactory, startX: number) {
    try {
      const p = factory(startX);
      p.container.x = startX;
      // place container vertically so pattern's ground (y=0) aligns with world ground
      // raise patterns slightly (20px) so visuals sit a bit higher on screen
      p.container.y = this.groundY + this.patternYOffset - 50;
      this.world.addChild(p.container);
      // compute visual bounds of the pattern container and record the
      // active world span using the container's local bounds. This ensures
      // `isOnPattern` reflects the visible area (fixes cases where visuals
      // extend past the declared logical length, e.g. end caps at negative x).
      let visualStart = startX;
      let visualLength = p.length;
      try {
        const b = p.container.getLocalBounds();
        visualStart = startX + b.x;
        visualLength = b.width || p.length;
      } catch (e) {
        visualStart = startX;
        visualLength = p.length;
      }

      // world coordinate for this pattern's ground top (container.y aligns
      // so that local y=0 is the surface/top of the ground in many patterns)
      const worldGroundTop = p.container.y;

      // record pattern span. If the pattern requests `noGround` we do not
      // create the continuous ground collider and we leave `top` undefined
      // so callers can fallback to per-obstacle platform lookups.
      const topForSurface = p.noGround ? undefined : (worldGroundTop - (this.groundThickness || 0));
      this.patterns.push({ start: visualStart, length: visualLength, top: topForSurface, playerYOffset: p.playerYOffset ?? 0, container: p.container });
      
      // Update last pattern end position for dynamic generation
      this.lastPatternEndX = Math.max(this.lastPatternEndX-300, visualStart + visualLength);

      // create a thin ground collider across the visual width of the pattern
      // so characters and physics can interact with the pattern surface. Skip
      // this for patterns that explicitly request no ground (floating
      // platforms).
      if (!p.noGround) {
        try {
          const groundThickness = this.groundThickness || 8;
          // Create a visible Graphics collider only when debugging hitboxes.
          // Otherwise store a lightweight collider object to avoid draw calls
          // and allocations that cause GC/render cost on mobile.
          let gcol: any = null;
          const colliderY = worldGroundTop - groundThickness;
          // lightweight collider object used for collision math only
          gcol = { y: colliderY };
          const groundObstacle = { x: visualStart, width: visualLength, height: groundThickness, sprite: gcol, isGround: true } as any;
          this.obstacles.push(groundObstacle);
        } catch (e) {
          // ignore collider creation errors
        }
      }

      // register pits declared by the pattern (translate to world coords)
      if (p.pits && p.pits.length) {
        for (const pit of p.pits) {
          this.pits.push({ x: startX + pit.x, width: pit.width });
        }
      }

      // register obstacles declared by the pattern: create invisible hitboxes
      if (p.obstacles && p.obstacles.length) {
        for (const ob of p.obstacles) {
          const gx = startX + ob.x;
          // apply configured padding to obstacle collider height so obstacles
          // (like obs_1) can have thicker, more forgiving hitboxes for gameplay
          const baseGh = (ob.height || 0) + (this.obstaclePadding || 0);
          // If this obstacle is a plane, scale its collider height by 1.5
          const gh = (ob as any).isPlane ? Math.round(baseGh * 1.5) : baseGh;
          const gw = ob.width;
          // lightweight collider object for runtime checks (no display object)
          const g = { x: gx, y: 0, visible: false, _lightweight: true } as any;
          if ((ob as any).isPlane && ob.y !== undefined) {
            const originalGh = baseGh;
            const extra = gh - originalGh;
            g.y = p.container.y + ob.y - 30 - Math.round(extra / 2);
          } else {
            g.y = worldGroundTop - gh;
          }
          this.obstacles.push({ x: gx, width: gw, height: gh, sprite: g, isGround: !!(ob as any).isGround, isPlane: !!(ob as any).isPlane, planeId: (ob as any).planeId, layer: (ob as any).layer } as any);
        }
      }

      // patterns may include pits/obstacles internally — for backward
      // compatibility we detect simple markers here in future.
      return p;
    } catch (e) {
      return null as any;
    }
  }

  // (Hitbox debug removed)

  // Returns true if the provided worldX is within any active pattern span
  isOnPattern(worldX: number) {
    for (const pat of this.patterns) {
      if (worldX >= pat.start && worldX <= pat.start + pat.length) return true;
    }
    return false;
  }

  // Returns the Y coordinate of the pattern surface (world space) at the
  // provided worldX. If the position is not on any pattern, returns the
  // default groundY (so callers always get a usable surface Y).
  getSurfaceYAt(worldX: number) {
    // prefer pattern-specific top Y if available
    for (const pat of this.patterns) {
      if (worldX >= pat.start && worldX <= pat.start + pat.length) {
        // If pattern provides a top (continuous ground), use it.
        if (pat.top !== undefined) {
          return pat.top + (pat.playerYOffset ?? 0);
        }
        // Otherwise, check for platform obstacles inside this pattern
        for (const o of this.obstacles) {
          try {
            const left = o.x; const right = o.x + o.width;
            if (worldX >= left && worldX <= right) {
              if ((o as any).isPlatform || (o as any).isPlane) {
                return o.sprite.y;
              }
            }
          } catch (e) {}
        }
        // no platform at this X; fall back to default ground
        return this.groundY;
      }
    }
    return this.groundY + 100;
  }

  // update advances the scroll, updates background color, and performs
  // simple pit/obstacle spawning to preserve existing gameplay behaviour.
  update(deltaSec: number, speedAccel = 8) {
    this.speed += speedAccel * deltaSec;
    this.scroll += this.speed * deltaSec;
    this.bg.clear();
    this.label.text = `Speed: ${Math.round(this.speed)} px/s  Distance: ${Math.floor(this.scroll)} px`;

    // obstacles (legacy)
    const OB_SPAWN_AHEAD = this.WIDTH * 0.9;
    if (this.allowRandomObstacles && Math.random() < 0.01) {
      const px = this.scroll + OB_SPAWN_AHEAD + Math.random() * 120;
      const size = 80 + Math.floor(Math.random() * 80);
      const g = new Graphics();
      g.rect(0, 0, size, size).fill({ color: 0x996633 });
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

    // cleanup obstacles behind camera (keep them further back to avoid
    // premature deletion when the camera/player is pushed back)
    while (this.obstacles.length && (this.obstacles[0].x + this.obstacles[0].width) < (this.scroll - 5000)) {
      try { this.obstaclesContainer.removeChild(this.obstacles[0].sprite); } catch (e) {}
      this.obstacles.shift();
    }
    
    // cleanup old pits behind camera to prevent array from growing indefinitely
    const cleanupX = this.scroll - 5000;
    this.pits = this.pits.filter(p => (p.x + p.width) >= cleanupX);
    
    // Pattern pooling: cleanup old patterns and reuse containers
    this.cleanupOldPatterns();
    
    // Dynamic generation: create new patterns when needed
    this.generatePatternsIfNeeded();

    return { scroll: this.scroll, speed: this.speed };
  }

  getObstacles() { return this.obstacles; }

  isOverPit(worldX: number) {
    if (!this.pits || !Array.isArray(this.pits)) {
      return false;
    }
    
    if (this.pits.length === 0) {
      return false;
    }
    
    for (const p of this.pits) {
      if (worldX >= p.x && worldX <= p.x + p.width) {
        return true;
      }
    }
    return false;
  }

  // Pattern pooling: cleanup patterns behind camera
  private cleanupOldPatterns() {
    const cleanupDistance = this.scroll - 1000; // Keep patterns 3000px behind camera
    
    while (this.patterns.length && (this.patterns[0].start + this.patterns[0].length) < cleanupDistance) {
      const oldPattern = this.patterns.shift();
      if (oldPattern && oldPattern.container) {
        try {
          // Remove obstacles associated with this pattern
          const patternStart = oldPattern.start;
          const patternEnd = oldPattern.start + oldPattern.length;
          this.obstacles = this.obstacles.filter(obs => 
            !(obs.x >= patternStart && obs.x < patternEnd)
          );
          
          // Remove from world but keep container for reuse
          this.world.removeChild(oldPattern.container);
          // Clear container contents for reuse
          oldPattern.container.removeChildren();
          // Add to pool for reuse
          this.patternPool.push(oldPattern.container);
        } catch (e) {}
      }
    }
    
    // Limit pool size to prevent memory leak
    if (this.patternPool.length > 20) {
      this.patternPool.splice(0, this.patternPool.length - 20);
    }
  }
  
  // Dynamic generation: create new patterns when player approaches end
  private generatePatternsIfNeeded() {
    const playerPosition = this.scroll;
    const distanceToEnd = this.lastPatternEndX - playerPosition;
    
    // Generate patterns when player is within 5000px of the end OR when no patterns exist (initial)
    if ((distanceToEnd < 2000 || this.patterns.length === 0) && this.patternFactories.length > 0) {
      // Generate 5 new patterns (or 5 initial patterns if none exist)
      for (let i = 0; i < 5; i++) {
        try {
          let factory;
          // For initial patterns, use the first 5 easy factories in order
          if (this.patterns.length < 5 && i < this.patternFactories.length) {
            factory = this.patternFactories[i]; // Use easy patterns first
          } else {
            // Pick a random factory from stored factories for later patterns
            const factoryIndex = Math.floor(Math.random() * this.patternFactories.length);
            factory = this.patternFactories[factoryIndex];
          }
          
          if (factory) {
            // For first pattern, start at x=0, others have 300px gap
            const startX = this.patterns.length === 0 ? 0 : this.lastPatternEndX + 300;
            this.addPattern(factory, startX);
          }
        } catch (e) {}
      }
    }
  }
  
  // Store pattern factories for dynamic generation
  storePatternFactory(factory: PatternFactory) {
    this.patternFactories.push(factory);
  }
  
  // Get or create reusable container from pool
  private getPooledContainer(): Container {
    if (this.patternPool.length > 0) {
      return this.patternPool.pop()!;
    }
    return new Container();
  }

  reset() {
    this.scroll = 0;
    this.speed = this.baseInitialSpeed;
    this.pits.length = 0;
    try {
      for (const o of this.obstacles) { try { this.obstaclesContainer.removeChild(o.sprite); } catch (e) {} }
    } catch (e) {}
    this.obstacles.length = 0;
    
    // Reset pattern pooling system
    this.patterns.length = 0;
    this.patternPool.length = 0;
    this.lastPatternEndX = 0;
    this.patternFactories.length = 0;
  }
}

// Keep the old createGameplay function but back it with MapHandler so callers
// in `main.ts` remain compatible. This gives us a clean migration path to
// building Patterns in the next step.
export function createGameplay({ world, bg, label, WIDTH, HEIGHT, groundY = HEIGHT - 120, initialSpeed = 200, speedAccel = 8, patternYOffset = 0, patternGroundThickness = 8, patternObstaclePadding = 12 }:
  { world: Container; bg: Graphics; label: Text; WIDTH: number; HEIGHT: number; groundY?: number; initialSpeed?: number; speedAccel?: number; patternYOffset?: number; patternGroundThickness?: number; patternObstaclePadding?: number; }) {
  const handler = new MapHandler({ world, bg, label, WIDTH, HEIGHT, groundY, initialSpeed, patternYOffset, patternGroundThickness, patternObstaclePadding });

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
    getBlockingObstacle: (x: number, y: number, r: number, vy?: number) => {
      for (const o of handler.getObstacles()) {
        let actualLeft, actualRight, actualTop;
        
        if ((o as any).isPlane) {
          // For planes, use current position
          actualLeft = o.x;
          actualRight = o.x + o.width;
          actualTop = o.sprite.y;
        } else {
          // For static obstacles
          actualLeft = o.x;
          actualRight = o.x + o.width;
          actualTop = o.sprite.y;
        }
        
        const horizontalOverlap = (x + r >= actualLeft && x - r <= actualRight);
        
        if (horizontalOverlap) {
          const playerBottom = y + r;
          let verticalOverlap = false;
          
          if ((o as any).isPlane) {
            // Moving platform logic - only land on top when falling down
            if (vy !== undefined && vy < 0) {
              continue; // Skip collision when jumping up
            }
            
            const planeTop = actualTop;
            // Only collide when landing on top
            verticalOverlap = (playerBottom >= planeTop && playerBottom <= planeTop + 15);
          } else {
            // Normal obstacle collision
            verticalOverlap = playerBottom > actualTop;
          }
          
          if (verticalOverlap) return o;
        }
      }
      return null;
    },
    reset: () => handler.reset(),
    // expose handler for future pattern operations
    _handler: handler
  };
}
