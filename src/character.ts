import { Graphics, Sprite, Texture } from 'pixi.js';
import { ParticleManager } from './partical/ParticleManager';

// Optimized particle config for double-jump effect
const DEFAULT_EMITTER_CONFIG = {
  alpha: { start: 1, end: 0.65 },
  scale: { start: 1.0, end: 0.2 }, // Increased for visibility
  lifetime: { min: 400, max: 800 }, // ms
  speed: { start: 100, end: 50 },
  maxParticles: 8,
  frequency: 100 // ms between spawns
};

// Optimized particle emitter using ParticleManager for better performance
function spawnDoubleJumpEmitter(parent: any, pos: any, yArg?: number, durationMs = 1000) {
  try {
    const FLAG = '__doubleJumpEmitterActive';
    if (parent && (parent as any)[FLAG]) return;
    if (parent) (parent as any)[FLAG] = true;

    const cfg = DEFAULT_EMITTER_CONFIG;
    const particleManager = ParticleManager.getInstance();
    
    let spawnCount = 0;
    const maxParticles = cfg.maxParticles;
    const endAt = performance.now() + durationMs;
    
    const cleanup = () => {
      if (parent) {
        (parent as any)[FLAG] = false;
        delete (parent as any)['__doubleJumpEmitterStop'];
      }
    };
    
    // Expose stop hook
    if (parent) (parent as any)['__doubleJumpEmitterStop'] = cleanup;
    
    const spawnParticles = () => {
      const now = performance.now();
      if (now >= endAt || spawnCount >= maxParticles) {
        cleanup();
        return;
      }
      
      // Get position (supports function getter)
      let originX = 0, originY = 0;
      if (typeof pos === 'function') {
        try {
          const o = pos();
          if (o) { originX = o.x; originY = o.y; }
        } catch (e) {}
      } else if (pos && typeof pos === 'object') {
        originX = pos.x ?? 0;
        originY = pos.y ?? (yArg ?? 0);
      } else {
        originX = typeof pos === 'number' ? pos : 0;
        originY = typeof yArg === 'number' ? yArg : 0;
      }
      
      // Spawn 2-3 particles per call
      const batchSize = Math.min(3, maxParticles - spawnCount);
      for (let i = 0; i < batchSize; i++) {
        // Random offset around origin
        const ox = (Math.random() - 0.5) * 20;
        const oy = (Math.random() - 0.5) * 20;
        
        // Random velocity (360 degree spread)
        const angle = Math.random() * Math.PI * 2;
        const speed = cfg.speed.start + Math.random() * (cfg.speed.end - cfg.speed.start);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        
        // Random lifetime
        const lifetime = cfg.lifetime.min + Math.random() * (cfg.lifetime.max - cfg.lifetime.min);
        
        particleManager.spawnParticle(parent, originX + ox, originY + oy, {
          vx,
          vy,
          lifetime,
          alphaStart: cfg.alpha.start,
          alphaEnd: cfg.alpha.end,
          scaleStart: cfg.scale.start,
          scaleEnd: cfg.scale.end
        });
        
        spawnCount++;
      }
      
      // Schedule next spawn if not done
      if (spawnCount < maxParticles && now < endAt) {
        setTimeout(spawnParticles, cfg.frequency);
      } else {
        cleanup();
      }
    };
    
    // Start spawning
    spawnParticles();
    
  } catch (e) {
    if (parent) {
      (parent as any)["__doubleJumpEmitterActive"] = false;
      delete (parent as any)['__doubleJumpEmitterStop'];
    }
  }
}

export interface Player {
  sprite: Sprite | Graphics;
  worldX: number;
  y: number;
  vy: number;
  onGround: boolean;
  // optional callback to query current ground surface Y at a given worldX
  getGroundY?: (worldX: number) => number;
  jump(): void;
  // start a jump and begin holding (for longer jump when held)
  startJumpHold?(): boolean;
  // end hold so jump stops extending
  endJumpHold?(): void;
  update(deltaSec: number, scroll: number, speed: number): void;
  // set the on-screen scale (1 = native pixels); passing root scale will
  // allow the character to counter-scale and appear 1:1 on screen
  setScreenScale(scale: number): void;
  desiredScreenScale?: number;
  // hold-to-extend jump state (how long the player is holding the jump)
  maxJumpHoldTime?: number;
  jumpHoldTime?: number;
  holdingJump?: boolean;
  // double-jump support
  jumpsLeft?: number;
  maxJumps?: number;
  // Spinning animation state
  isSpinning?: boolean;
  spinTimer?: number;
  spinDuration?: number;
  originalRotation?: number;
}

export function createCharacter({ PLAYER_X, playerRadius, groundY, texture, frames, jumpSpeed = 1400, gravity = 10000, screenScale = 1 }:
  { PLAYER_X: number; playerRadius: number; groundY: number; texture?: Texture; frames?: Texture[]; jumpSpeed?: number; gravity?: number; screenScale?: number; }): Player {
  let sprite: Sprite | Graphics;
  if (frames && frames.length) {
    // Use the first frame as a static sprite (no animation)
    const s = new Sprite(frames[0] as Texture);
    s.anchor.set(0.5, 0.5);
    s.scale.set(1, 1);
    // Debug: log chosen frame info to help diagnose slicing issues
    try {
      const f0: any = (frames as any)[0];
    } catch (e) {}
    sprite = s;
  } else if (texture) {
    const s = new Sprite(texture);
    // center the sprite and size to match player radius
    s.anchor.set(0.5, 0.5);
    s.scale.set(1, 1);
    sprite = s;
  } else {
    const g = new Graphics();
    g.circle(0, 0, playerRadius).fill({ color: 0xffdd00 });
    sprite = g as Graphics;
  }
  // Ensure sprite pivot/anchor is centered so rotations and scaling happen
  // around the visual center. Do this before positioning the sprite in world coords.
  try {
    // Always compute local bounds and center the visual pivot/anchor.
    const b = (sprite as any).getLocalBounds ? (sprite as any).getLocalBounds() : { x: 0, y: 0, width: 0, height: 0 };
    const centerX = (b.x || 0) + (b.width || 0) / 2;
    const centerY = (b.y || 0) + (b.height || 0) / 2;

    // For PIXI.Sprite prefer anchor (fractional), falling back to pivot if anchor not present.
    if ((sprite as any).anchor && typeof (sprite as any).anchor.set === 'function' && b.width && b.height) {
      try {
        (sprite as any).anchor.set(0.5, 0.5);
      } catch (e) {}
    } else if ((sprite as any).pivot && typeof (sprite as any).pivot.set === 'function') {
      try {
        (sprite as any).pivot.set(centerX, centerY);
      } catch (e) {}
    } else {
      try { (sprite as any).pivot = { x: centerX, y: centerY }; } catch (e) {}
    }
  } catch (e) {}

  // Persist the initial centered anchor/pivot so the sprite remains centered
  // after any temporary runtime changes (e.g. during spin). This records the
  // intended anchor/pivot at spawn time.
  try {
    if ((sprite as any).anchor && typeof (sprite as any).anchor.set === 'function') {
      try { (sprite as any).__initialAnchor = { x: (sprite as any).anchor.x, y: (sprite as any).anchor.y }; } catch (e) {}
    } else if ((sprite as any).pivot) {
      try { (sprite as any).__initialPivot = { x: ((sprite as any).pivot.x || 0), y: ((sprite as any).pivot.y || 0) }; } catch (e) {}
    }
  } catch (e) {}

  // position sprite (world coordinates)
  sprite.x = PLAYER_X;
  // Place sprite so its visual center sits at the intended player Y (ground top minus radius)
  sprite.y = groundY - playerRadius;
  // make interactive
  (sprite as any).interactive = true;
  (sprite as any).buttonMode = true;

  const player: Player = {
    sprite,
    worldX: PLAYER_X, // FIXED: Initialize worldX to match sprite position
    y: sprite.y,
    vy: 0,
    onGround: true,
    maxJumps: 2,
    jumpsLeft: 2,
    desiredScreenScale: screenScale,
    // hold-to-extend jump state
    // how long (seconds) additional jump hold extends the ascent
    // default allow 0.25s of extended ascent
    maxJumpHoldTime: 0.45,
    jumpHoldTime: 0,
    holdingJump: false,
    // Spinning animation state
    isSpinning: false,
    spinTimer: 0,
    spinDuration: 0.52, // 520ms đổi sang giây
    originalRotation: 0,
    jump() {
      // allow jump from ground or perform an extra mid-air jump if available
      const canJump = (this.onGround === true) || ((this as any).jumpsLeft && (this as any).jumpsLeft > 0);
      // record previous remaining mid-air jumps to detect a double-jump
      const prevJumpsLeft = (this as any).jumpsLeft !== undefined ? (this as any).jumpsLeft : ((this as any).maxJumps !== undefined ? (this as any).maxJumps : 1);
      const wasOnGround = this.onGround;
      if (canJump) {
        this.vy = -jumpSpeed;
        this.onGround = false;

        if (wasOnGround) {
          // leaving ground: consume the initial jump and set remaining mid-air jumps
          if ((this as any).maxJumps !== undefined) {
            // after using ground jump, remaining mid-air jumps = maxJumps - 1
            (this as any).jumpsLeft = Math.max(0, (this as any).maxJumps - 1);
          } else {
            (this as any).jumpsLeft = 1;
          }
        } else {
          // mid-air jump: consume one
          if ((this as any).jumpsLeft !== undefined) {
            (this as any).jumpsLeft = Math.max(0, (this as any).jumpsLeft - 1);
          }
        }

        // If this was a mid-air jump (i.e. not on ground before), spawn a visual effect behind the player
        if (!wasOnGround) {
          try {
            const parent: any = (this.sprite as any).parent;
            // Only perform the 360° spin when this is the 'double-jump' (i.e. last available mid-air jump)
              if (prevJumpsLeft === 1) {
              try {
              try { spawnDoubleJumpEmitter(parent, () => ({ x: this.worldX - 20, y: this.y + 100 }), undefined, 1000); } catch (e) {}
              
              // Thay thế requestAnimationFrame spin bằng:
              this.isSpinning = true;
              this.spinTimer = 0;
              this.originalRotation = this.sprite.rotation;
              } catch (e) {}
            }
          } catch (e) {}
        }

        return true;
      }
      return false;
    },
    startJumpHold() {
      // attempt to jump, then begin holding to extend ascent
      const did = (this as any).jump();
      (this as any).holdingJump = true;
      (this as any).jumpHoldTime = 0;
      return !!did;
    },
    endJumpHold() {
      (this as any).holdingJump = false;
      (this as any).jumpHoldTime = 0;
    },
    update(deltaSec: number, scroll: number, speed: number) {
      // 1. LOGIC XOAY ĐỒNG BỘ
      if (this.isSpinning) {
        (this.spinTimer as number) += deltaSec;
        const t = Math.min(1, (this.spinTimer as number) / (this.spinDuration as number));
        const eased = 1 - Math.pow(1 - t, 3); // Ease out cubic
        
        this.sprite.rotation = (this.originalRotation || 0) + (Math.PI * 2 * eased);

        if (t >= 1) {
          this.isSpinning = false;
          this.sprite.rotation = this.originalRotation || 0;
        }
      }
      
      // 2. LOGIC VẬT LÝ CŨ
      // variable jump logic: while holding and within max hold time, apply reduced gravity
      if ((this as any).holdingJump && (this as any).jumpHoldTime < (this as any).maxJumpHoldTime && this.vy < 0) {
        // reduce gravity effect during hold so ascent is extended
        this.vy += (gravity * 0.45) * deltaSec;
        (this as any).jumpHoldTime += deltaSec;
      } else {
        this.vy += gravity * deltaSec;
      }
      const prevY = this.y;
      this.y += this.vy * deltaSec;
      const surfaceY = (this as any).getGroundY ? (this as any).getGroundY(this.worldX) : groundY;
      const groundTop = surfaceY - playerRadius;
      // DISABLED: Ground snapping logic to prevent freeze when falling into pits
      // Only snap to surface if the player crossed the surface from above
      // (i.e., was above it and now is at/below it). If the player is already
      // below the surface (fell into a pit), do not teleport them back up.
      // if (prevY < groundTop && this.y >= groundTop && this.vy >= 0) {
      //   this.y = groundTop;
      //   this.vy = 0;
      //   this.onGround = true;
      //   // reset available jumps when landing
      //   if ((this as any).maxJumps !== undefined) (this as any).jumpsLeft = (this as any).maxJumps;
      // } else {
      //   this.onGround = false;
      // }
      
      // Simple onGround detection without teleporting
      this.onGround = (this.y >= groundTop && this.vy >= 0);

      // If player is falling, cancel any active double-jump emitter so it doesn't trail
      try {
        if (this.vy > 0) {
          try {
            const parentAny: any = (this.sprite as any).parent;
            if (parentAny) {
              try { if (typeof parentAny.__doubleJumpEmitterStop === 'function') parentAny.__doubleJumpEmitterStop(); } catch (e) {}
              try { parentAny.__doubleJumpEmitterActive = false; } catch (e) {}
              try { delete parentAny.__doubleJumpEmitterStop; } catch (e) {}
            }
          } catch (e) {}
        }
      } catch (e) {}

      // sprite.x is in world coordinates; world.x = -scroll will offset it on-screen
      this.sprite.x = this.worldX;
      this.sprite.y = this.y;

      // Enforce initial centered anchor/pivot every frame so the character
      // remains centered (never anchored at the feet).
      try {
        const sAny: any = this.sprite;
        if (sAny.__initialAnchor && sAny.anchor && typeof sAny.anchor.set === 'function') {
          try { sAny.anchor.set(sAny.__initialAnchor.x, sAny.__initialAnchor.y); } catch (e) {}
        } else if (sAny.__initialPivot && sAny.pivot && typeof sAny.pivot.set === 'function') {
          try { sAny.pivot.set(sAny.__initialPivot.x, sAny.__initialPivot.y); } catch (e) {}
        }
      } catch (e) {}
    }
  ,
    setScreenScale(scale: number) {
      if (!scale || scale <= 0) return;
      const inv = 1 / scale;
      const ds = (this as any).desiredScreenScale || 1;
      // apply inverse scaling multiplied by desiredScreenScale so the sprite's
      // on-screen pixel size becomes desiredScreenScale times native.
      (this.sprite as any).scale.set(inv * ds, inv * ds);
    }
  };

  (sprite as any).on('pointerdown', () => {
    // Check if controls are enabled globally (to be set by main game)
    if ((window as any).__controlsEnabled !== false) {
      player.jump();
    }
  });

  return player;
}
