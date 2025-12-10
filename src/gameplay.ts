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
  // optional pits (local coordinates relative to pattern start)
  pits?: { x: number; width: number }[];
  // optional obstacles described in local coordinates. MapHandler will
  // convert these to world coordinates and create invisible hitboxes.
  obstacles?: { x: number; width: number; height: number; y?: number; isGround?: boolean; isPlane?: boolean }[];
  // optional preferred player Y offset (local to container). If provided
  // MapHandler will use `container.y + playerYOffset` as the standing
  // surface for the player when on this pattern.
  playerYOffset?: number;
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
  private hitboxDebug = false;
  private groundThickness = 8;
  private obstaclePadding = 0;
  // allow toggling random obstacle spawning (useful for debugging/testing)
  public allowRandomObstacles = true;

  constructor(options: { world: Container; bg: Graphics; label: Text; WIDTH: number; HEIGHT: number; groundY?: number; initialSpeed?: number; patternYOffset?: number; patternHitboxDebug?: boolean; patternGroundThickness?: number; patternObstaclePadding?: number; }) {
    this.world = options.world;
    this.bg = options.bg;
    this.label = options.label;
    this.WIDTH = options.WIDTH;
    this.HEIGHT = options.HEIGHT;
    this.groundY = options.groundY ?? (this.HEIGHT - 120);
    this.patternYOffset = options.patternYOffset ?? 0;
    this.baseInitialSpeed = options.initialSpeed ?? this.baseInitialSpeed;
    this.speed = this.baseInitialSpeed;

    this.obstaclesContainer = new Container();
    this.world.addChild(this.obstaclesContainer);
    this.hitboxDebug = !!(options as any).patternHitboxDebug;
    this.groundThickness = (options as any).patternGroundThickness ?? this.groundThickness;
    this.obstaclePadding = (options as any).patternObstaclePadding ?? 100;
    // track spawned patterns (start, length, topY) for ground membership checks
    this.patterns = [] as { start: number; length: number; top?: number }[];
  }

  // simple list of active patterns (world coordinates)
  private patterns: { start: number; length: number; top?: number; playerYOffset?: number }[] = [];

  // addPattern allows registering a Pattern factory; for now we keep this
  // simple and spawn lightweight pattern containers when requested.
  addPattern(factory: PatternFactory, startX: number) {
    try {
      const p = factory(startX);
      p.container.x = startX;
      // place container vertically so pattern's ground (y=0) aligns with world ground
      p.container.y = this.groundY + this.patternYOffset;
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

      // record pattern span including its top Y (adjusted to the collider's
      // top so surface queries reflect the collider) and any playerYOffset
      // suggested by the pattern.
      const topForSurface = worldGroundTop - (this.groundThickness || 0);
      this.patterns.push({ start: visualStart, length: visualLength, top: topForSurface, playerYOffset: p.playerYOffset ?? 0 });

      // create a thin ground collider across the visual width of the pattern
      // so characters and physics can interact with the pattern surface.
      try {
        const groundThickness = this.groundThickness || 8;
        const gcol = new Graphics();
        gcol.clear();
        try {
          if (typeof (gcol as any).fill === 'function') {
            try { (gcol as any).fill(0x00ff00, this.hitboxDebug ? 0.25 : 0); } catch (e) { /* some builds accept object signature */ try { (gcol as any).fill({ color: 0x00ff00, alpha: this.hitboxDebug ? 0.25 : 0 }); } catch (e) {} }
          } else {
            (gcol as any).beginFill && (gcol as any).beginFill(0x00ff00, this.hitboxDebug ? 0.25 : 0);
          }
        } catch (e) {}
        try { (gcol as any).rect ? (gcol as any).rect(0, 0, visualLength, groundThickness) : (gcol as any).drawRect && (gcol as any).drawRect(0, 0, visualLength, groundThickness); } catch (e) {}
        // endFill not required in v8; if only old API exists, call endFill for safety
        try { (gcol as any).endFill && (gcol as any).endFill(); } catch (e) {}
        gcol.x = visualStart;
        // position collider so its bottom aligns with the visual top of ground
        gcol.y = worldGroundTop - groundThickness;
        gcol.visible = this.hitboxDebug;
        this.obstaclesContainer.addChild(gcol);
        this.obstacles.push({ x: visualStart, width: visualLength, height: groundThickness, sprite: gcol, isGround: true } as any);
      } catch (e) {
        // ignore collider creation errors
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
          const gh = (ob.height || 0) + (this.obstaclePadding || 0);
          const gw = ob.width;
          const g = new Graphics();
          // draw hitbox; visibility controlled by hitboxDebug for debugging
          g.clear();
          // Draw hitbox fill - different colors for different obstacle types
          try {
            const showHitbox = this.hitboxDebug || (ob as any).isPlane; // Always show plane hitbox
            if (showHitbox) {
              // Use blue for plane hitboxes, red for other obstacles
              const color = (ob as any).isPlane ? 0x0099ff : 0xff0000;
              const alpha = (ob as any).isPlane ? 0.4 : 0.25;
              
              if (typeof (g as any).fill === 'function') {
                try { (g as any).fill(color, alpha); } catch (e) { try { (g as any).fill({ color: color, alpha: alpha }); } catch (e) {} }
              } else {
                (g as any).beginFill && (g as any).beginFill(color, alpha);
              }
              
              // Add stroke for plane hitboxes to make them more visible
              if ((ob as any).isPlane) {
                try {
                  if (typeof (g as any).stroke === 'function') {
                    (g as any).stroke({ color: 0x0066cc, width: 2 });
                  }
                } catch (e) {}
              }
              
              try { (g as any).rect ? (g as any).rect(0, 0, gw, gh) : (g as any).drawRect && (g as any).drawRect(0, 0, gw, gh); } catch (e) {}
              try { (g as any).endFill && (g as any).endFill(); } catch (e) {}
            }
          } catch (e) {}
          // place hitbox - use specific Y if provided, otherwise use ground top
          g.x = gx;
          if ((ob as any).isPlane && ob.y !== undefined) {
            // For planes, use the Y position defined in pattern (from Danger5.ts)
            g.y = p.container.y + ob.y; // Pattern container Y + obstacle Y offset
          } else {
            // For other obstacles, use ground top
            g.y = worldGroundTop - gh;
          }
          // Always show plane hitboxes (blue), other obstacles only when debug enabled
          g.visible = (ob as any).isPlane ? true : this.hitboxDebug;
          
          // Debug for plane colliders
          if ((ob as any).isPlane) {
            console.log(`🎯 CREATING PLANE COLLIDER:
              Position: x=${gx.toFixed(1)}, y=${g.y.toFixed(1)} (was ground: ${(worldGroundTop - gh).toFixed(1)})
              Pattern container Y: ${p.container.y.toFixed(1)}, Obstacle Y: ${ob.y || 'undefined'}
              Size: ${gw}x${gh}
              Visible: ${g.visible}, Alpha: ${g.alpha}
              Container: ${this.obstaclesContainer ? 'exists' : 'missing'}
              World bounds: ${g.getBounds().x}, ${g.getBounds().y}, ${g.getBounds().width}, ${g.getBounds().height}
            `);
            
            // Make sure it's EXTREMELY visible for debugging
            g.alpha = 1.0;
            g.zIndex = 999999;
            g.tint = 0x00FF00; // Make it bright green
            
            // Debug container hierarchy
            console.log(`📦 CONTAINER DEBUG:
              obstaclesContainer exists: ${!!this.obstaclesContainer}
              obstaclesContainer parent: ${this.obstaclesContainer?.parent?.constructor?.name || 'none'}
              obstaclesContainer visible: ${this.obstaclesContainer?.visible}
              obstaclesContainer alpha: ${this.obstaclesContainer?.alpha}
            `);
          }
          
          // For planes, add directly to world instead of obstaclesContainer
          if ((ob as any).isPlane) {
            this.world.addChild(g);
            console.log(`🚀 ADDED PLANE TO WORLD at x=${gx}, y=${g.y}`);
          } else {
            this.obstaclesContainer.addChild(g);
          }
          
          this.obstacles.push({ x: gx, width: gw, height: gh, sprite: g, isGround: !!(ob as any).isGround, isPlane: !!(ob as any).isPlane } as any);
        }
      }

      // patterns may include pits/obstacles internally — for backward
      // compatibility we detect simple markers here in future.
      return p;
    } catch (e) {
      return null as any;
    }
  }

  // Toggle rendering of obstacle hitboxes for debugging alignment issues
  toggleHitboxes() {
    this.hitboxDebug = !this.hitboxDebug;
    try {
      for (const o of this.obstacles) {
        if (o && o.sprite) {
          o.sprite.visible = this.hitboxDebug;
          try {
            if (this.hitboxDebug) {
              (o.sprite as any).alpha = 0.25;
            } else {
              (o.sprite as any).alpha = 0;
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
    return this.hitboxDebug;
  }

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
        const top = pat.top ?? (this.groundY + this.patternYOffset);
        return top + (pat.playerYOffset ?? 0);
      }
    }
    return this.groundY;
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
    // removed full-screen colored rectangle so host/app background is preserved
    // keep the bg Graphics cleared so no large overlay (the red block) is drawn
    this.bg.clear();

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
export function createGameplay({ world, bg, label, WIDTH, HEIGHT, groundY = HEIGHT - 120, initialSpeed = 200, speedAccel = 8, patternYOffset = 0, patternHitboxDebug = false, patternGroundThickness = 8, patternObstaclePadding = 12 }:
  { world: Container; bg: Graphics; label: Text; WIDTH: number; HEIGHT: number; groundY?: number; initialSpeed?: number; speedAccel?: number; patternYOffset?: number; patternHitboxDebug?: boolean; patternGroundThickness?: number; patternObstaclePadding?: number; }) {
  const handler = new MapHandler({ world, bg, label, WIDTH, HEIGHT, groundY, initialSpeed, patternYOffset, patternHitboxDebug, patternGroundThickness, patternObstaclePadding });

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
        // For moving objects like planes, use actual sprite position
        // For static obstacles, use stored position
        let actualLeft, actualRight, actualTop;
        
        if ((o as any).isPlane) {
          // For planes, use stored position (đã được update chính xác trong main loop)
          actualLeft = o.x; // Đã là left edge
          actualRight = o.x + o.width;
          actualTop = o.sprite.y;
        } else {
          // For static obstacles, use stored coordinates
          actualLeft = o.x;
          actualRight = o.x + o.width;
          actualTop = o.sprite.y;
        }
        
        // Circle vs Rectangle collision
        const horizontalOverlap = (x + r >= actualLeft && x - r <= actualRight);
        
        // Thêm kiểm tra khoảng cách cho máy bay
        if ((o as any).isPlane) {
          const distanceX = Math.abs(x - (actualLeft + actualRight) / 2);
          const distanceY = Math.abs(y - actualTop);
          // Nếu quá xa, bỏ qua collision
          if (distanceX > o.width / 2 + r + 50 || distanceY > o.height + r + 50) {
            continue;
          }
        }
        
        if (horizontalOverlap) {
          const playerTop = y - r;
          const playerBottom = y + r;
          
          // One-way platform logic for planes
          let verticalOverlap;
          if ((o as any).isPlane) {
            // BƯỚC 1: Lọc logic cho máy bay (one-way platform)
            
            // 1. Nếu player đang bay lên (vy < 0), TUYỆT ĐỐI KHÔNG va chạm
            if (vy !== undefined && vy < 0) {
              return null; // Bỏ qua collision, để player xuyên qua
            }
            
            const planeTop = actualTop;
            const playerBottom = y + r;
            
            // 2. Kiểm tra vị trí chân - chỉ collision khi chân đang ở trên máy bay  
            if (y > planeTop + 20) { // Đã rơi xuống dưới máy bay
              continue; // Bỏ qua obstacle này hoàn toàn
            }
            
            // 3. Chỉ collision khi player rơi xuống và chạm từ trên xuống
            verticalOverlap = (playerBottom >= planeTop && playerBottom <= planeTop + 15); // Chỉ chạm mặt trên
          } else {
            // Normal obstacle collision (player lands on top)
            const playerBottom = y + r;
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
