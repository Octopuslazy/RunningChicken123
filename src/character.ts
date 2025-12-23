import { Graphics, Sprite, Texture } from 'pixi.js';

// Lightweight particle "emitter" used for double-jump visual effect.
// Inlined emitter (2).json config
const DEFAULT_EMITTER_CONFIG = {
  alpha: { start: 1, end: 0.65 },
  scale: { start: 0.5, end: 0.1, minimumScaleMultiplier: 1 },
  color: { start: '#e4f9ff', end: '#3fcbff' },
  speed: { start: 10, end: 5, minimumSpeedMultiplier: 1 },
  acceleration: { x: 0, y: 0 },
  maxSpeed: 0,
  startRotation: { min: 0, max: 0 },
  noRotation: false,
  rotationSpeed: { min: 0, max: 0 },
  lifetime: { min: 0.2, max: 0.8 },
  blendMode: 'normal',
  frequency: 0.2,
  emitterLifetime: 1,
  maxParticles: 5,
  pos: { x: 0, y: 0 },
  addAtBack: false,
  spawnType: 'point'
};

// `pos` may be either `{x:number,y:number}` or a function returning that object.
function spawnDoubleJumpEmitter(parent: any, pos: any, yArg?: number, durationMs = 1000) {
  try {
    const FLAG = '__doubleJumpEmitterActive';
    if (parent && (parent as any)[FLAG]) return;
    if (parent) try { (parent as any)[FLAG] = true; } catch (e) {}

    const cfg = DEFAULT_EMITTER_CONFIG;
    const tex = Texture.from('/Assets/_arts/effect_double jump.png');
    const container = parent || null;

    // make effect run 2x faster: halve interval (double spawn rate)
    const freqMs = (typeof cfg.frequency === 'number' ? cfg.frequency * 1000 : 100) / 2;
    const maxParticles = typeof cfg.maxParticles === 'number' ? Math.max(1, Math.floor(cfg.maxParticles)) : 10;
    // halve particle lifetime to speed up animation
    const lifetimeMin = cfg.lifetime && typeof cfg.lifetime.min === 'number' ? (cfg.lifetime.min * 1000) / 2 : 200;
    const lifetimeMax = cfg.lifetime && typeof cfg.lifetime.max === 'number' ? (cfg.lifetime.max * 1000) / 2 : 800;
    const alphaStart = cfg.alpha && typeof cfg.alpha.start === 'number' ? cfg.alpha.start : 1;
    const alphaEnd = cfg.alpha && typeof cfg.alpha.end === 'number' ? cfg.alpha.end : 0.6;
    // scale effect up 2x
    const scaleStart = (cfg.scale && typeof cfg.scale.start === 'number' ? cfg.scale.start : 0.5) * 2;
    const scaleEnd = (cfg.scale && typeof cfg.scale.end === 'number' ? cfg.scale.end : 0.1) * 2;
    const rotMin = cfg.startRotation && typeof cfg.startRotation.min === 'number' ? cfg.startRotation.min : 0;
    const rotMax = cfg.startRotation && typeof cfg.startRotation.max === 'number' ? cfg.startRotation.max : 360;
    // double particle speed for faster motion
    const speedStart = (cfg.speed && typeof cfg.speed.start === 'number' ? cfg.speed.start : 50) * 2;

    let activeCount = 0;
    const endAt = (performance && performance.now) ? performance.now() + durationMs : Date.now() + durationMs;

    let iv: any = null;
    const cleanup = () => {
      try { if (iv) clearInterval(iv); } catch (e) {}
      try { if (parent) (parent as any)[FLAG] = false; } catch (e) {}
      try { if (parent) delete (parent as any)['__doubleJumpEmitterStop']; } catch (e) {}
    };

    // expose a stop hook on the parent so callers can cancel the emitter early
    try { if (parent) (parent as any)['__doubleJumpEmitterStop'] = cleanup; } catch (e) {}

    iv = setInterval(() => {
      const now = (performance && performance.now) ? performance.now() : Date.now();
      if (now >= endAt) { clearInterval(iv); return; }

      // spawn a few particles but don't exceed maxParticles
      const spawnCount = Math.min(3, Math.max(1, maxParticles - activeCount));
      // determine current emitter origin (supports function getter)
      let originX = 0;
      let originY = 0;
      if (typeof pos === 'function') {
        try { const o = pos(); if (o) { originX = o.x; originY = o.y; } } catch (e) {}
      } else if (pos && typeof pos === 'object') {
        originX = pos.x !== undefined ? pos.x : 0;
        originY = pos.y !== undefined ? pos.y : (yArg !== undefined ? yArg : 0);
      } else {
        originX = (typeof pos === 'number' ? pos : 0);
        originY = (typeof yArg === 'number' ? yArg : 0);
      }

      for (let i = 0; i < spawnCount; i++) {
        try {
          const p = new Sprite(tex as any);
          p.anchor && p.anchor.set ? p.anchor.set(0.5, 0.5) : null;

          // position around current origin with slight offset so it follows player
          const ox = (Math.random() - 0.5) * 10;
          const oy = (Math.random() - 0.5) * 10;
          p.x = originX + ox;
          p.y = originY + oy;

          const s = scaleStart + Math.random() * (Math.max(0, scaleEnd - scaleStart));
          try { p.scale.set(s, s); } catch (e) {}
          p.alpha = alphaStart;
          try { if (container && typeof container.addChild === 'function') container.addChild(p); }
          catch (e) { try { (parent as any).addChild(p); } catch (e) {} }

          activeCount++;
          const life = lifetimeMin + Math.random() * (lifetimeMax - lifetimeMin);
          const startTime = (performance && performance.now) ? performance.now() : Date.now();

          // compute velocity from random start rotation & speed
          const angDeg = rotMin + Math.random() * (rotMax - rotMin);
          const ang = angDeg * (Math.PI / 180);
          const spd = speedStart;
          const vx = Math.cos(ang) * spd;
          const vy = Math.sin(ang) * spd;

          let last = startTime;
          function step(nowTime: number) {
            try {
              const t = Math.min(1, (nowTime - startTime) / life);
              const dt = (nowTime - last) / 1000;
              last = nowTime;
              try { p.x += vx * dt; p.y += vy * dt; } catch (e) {}
              try { p.alpha = alphaStart + (alphaEnd - alphaStart) * t; } catch (e) {}
              try {
                const sc = scaleStart + (scaleEnd - scaleStart) * t;
                p.scale.set(sc, sc);
              } catch (e) {}
              if (t < 1) requestAnimationFrame(step);
              else { try { p.parent && p.parent.removeChild(p); } catch (e) {} ; activeCount--; }
            } catch (e) { try { p.parent && p.parent.removeChild(p); } catch (e) {} ; activeCount--; }
          }
          requestAnimationFrame(step);
        } catch (e) {}
      }
    }, Math.max(16, Math.floor(freqMs)));

      // ensure flag cleared after duration
    try {
      setTimeout(() => {
        try { cleanup(); } catch (e) {}
      }, durationMs + 50);
    } catch (e) {}
  } catch (e) {
    try { if (parent) (parent as any)["__doubleJumpEmitterActive"] = false; } catch (ee) {}
    try { if (parent) delete (parent as any)['__doubleJumpEmitterStop']; } catch (ee) {}
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
              const spinDuration = 520; // ms
              const spriteAny: any = this.sprite;
              
              // Store original transform values so we can restore later
              const originalRotation = spriteAny.rotation || 0;
              const originalX = spriteAny.x;
              const originalY = spriteAny.y;
              let hadAnchor = !!spriteAny.anchor;
              const originalAnchor = hadAnchor && spriteAny.anchor ? { x: spriteAny.anchor.x, y: spriteAny.anchor.y } : null;
              const originalPivot = spriteAny.pivot ? { x: (spriteAny.pivot.x || 0), y: (spriteAny.pivot.y || 0) } : null;

              // Compute local visual bounds and desired center pivot
              let bounds: any = { x: 0, y: 0, width: 0, height: 0 };
              try { bounds = spriteAny.getLocalBounds ? spriteAny.getLocalBounds() : bounds; } catch (e) {}
              const centerLocalX = (bounds.x || 0) + (bounds.width || 0) / 2;
              const centerLocalY = (bounds.y || 0) + (bounds.height || 0) / 2;

              // Determine current pivot in pixels (based on anchor or pivot)
              let oldPivotPixels = { x: 0, y: 0 };
              if (hadAnchor && bounds.width && bounds.height) {
                oldPivotPixels.x = (bounds.x || 0) + (bounds.width || 0) * (originalAnchor ? originalAnchor.x : 0.5);
                oldPivotPixels.y = (bounds.y || 0) + (bounds.height || 0) * (originalAnchor ? originalAnchor.y : 0.5);
              } else if (originalPivot) {
                oldPivotPixels.x = originalPivot.x;
                oldPivotPixels.y = originalPivot.y;
              }

              // Do not change anchor/pivot during spin. The sprite was centered at
              // creation so rotation will be around the visual center. Avoid any
              // runtime anchor/pivot changes to prevent position jumps.

              // cancel previous spin if running
              if (spriteAny.__spinCancel) {
                try { spriteAny.__spinCancel(); } catch (e) {}
                spriteAny.__spinCancel = null;
              }

              const startRot = originalRotation;
              const targetRot = startRot + Math.PI * 2;
              const startTime = (performance && performance.now) ? performance.now() : Date.now();
              let rafId: number | null = null;
              // Ensure pivot/anchor is centered before starting spin so rotation
              // happens around the visual center. This is idempotent and we do
              // NOT restore the original anchor (we want the centered anchor).
              try {
                const bTry = spriteAny.getLocalBounds ? spriteAny.getLocalBounds() : null;
                const cX = bTry ? ((bTry.x || 0) + (bTry.width || 0) / 2) : 0;
                const cY = bTry ? ((bTry.y || 0) + (bTry.height || 0) / 2) : 0;
                if (spriteAny.anchor && typeof spriteAny.anchor.set === 'function') {
                  try { spriteAny.anchor.set(0.5, 0.5); } catch (e) {}
                } else if (spriteAny.pivot && typeof spriteAny.pivot.set === 'function') {
                  try { spriteAny.pivot.set(cX, cY); } catch (e) {}
                } else {
                  try { spriteAny.pivot = { x: cX, y: cY }; } catch (e) {}
                }
              } catch (e) {}
              
              function step(now: number) {
                const t = Math.min(1, (now - startTime) / spinDuration);
                // ease-out cubic for nicer motion
                const eased = 1 - Math.pow(1 - t, 3);
                try { 
                spriteAny.rotation = startRot + (targetRot - startRot) * eased;
                } catch (e) {}
                
                if (t < 1) {
                rafId = requestAnimationFrame(step);
                } else {
                // restore original values (rotation) and restore original anchor/pivot
                // but preserve the sprite's world position by computing the global
                // position of the visual center before changing anchor/pivot.
                try {
                  spriteAny.rotation = originalRotation;
                  // compute world position of the sprite's visual center
                  let globalCenter: any = null;
                  try { if (typeof spriteAny.getGlobalPosition === 'function') globalCenter = spriteAny.getGlobalPosition(); } catch (e) {}
                  if (!globalCenter) globalCenter = { x: spriteAny.x, y: spriteAny.y };

                  // restore anchor/pivot to original values
                  try {
                    if (originalAnchor && spriteAny.anchor && typeof spriteAny.anchor.set === 'function') {
                      spriteAny.anchor.set(originalAnchor.x, originalAnchor.y);
                    } else if (originalPivot && spriteAny.pivot && typeof spriteAny.pivot.set === 'function') {
                      spriteAny.pivot.set(originalPivot.x, originalPivot.y);
                    }
                  } catch (e) {}

                  // convert the preserved globalCenter back to local coordinates and set position
                  try {
                    if (spriteAny.parent && typeof (spriteAny.parent.toLocal) === 'function') {
                      const local = (spriteAny.parent as any).toLocal(globalCenter);
                      spriteAny.x = local.x;
                      spriteAny.y = local.y;
                    } else {
                      spriteAny.x = globalCenter.x;
                      spriteAny.y = globalCenter.y;
                    }
                  } catch (e) {}
                } catch (e) {}
                rafId = null;
                }
              }
              
              rafId = requestAnimationFrame(step);
              
              // provide a cancel function in case another spin starts
              spriteAny.__spinCancel = () => {
                if (rafId) try { cancelAnimationFrame(rafId); } catch (e) {};
                try {
                  spriteAny.rotation = originalRotation;
                  // restore anchor/pivot safely while keeping world position
                  let globalCenter2: any = null;
                  try { if (typeof spriteAny.getGlobalPosition === 'function') globalCenter2 = spriteAny.getGlobalPosition(); } catch (e) {}
                  if (!globalCenter2) globalCenter2 = { x: spriteAny.x, y: spriteAny.y };
                  try {
                    if (originalAnchor && spriteAny.anchor && typeof spriteAny.anchor.set === 'function') {
                      spriteAny.anchor.set(originalAnchor.x, originalAnchor.y);
                    } else if (originalPivot && spriteAny.pivot && typeof spriteAny.pivot.set === 'function') {
                      spriteAny.pivot.set(originalPivot.x, originalPivot.y);
                    }
                  } catch (e) {}
                  try {
                    if (spriteAny.parent && typeof (spriteAny.parent.toLocal) === 'function') {
                      const local2 = (spriteAny.parent as any).toLocal(globalCenter2);
                      spriteAny.x = local2.x;
                      spriteAny.y = local2.y;
                    } else {
                      spriteAny.x = globalCenter2.x;
                      spriteAny.y = globalCenter2.y;
                    }
                  } catch (e) {}
                } catch (e) {}
                rafId = null;
              };
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
