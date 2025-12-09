import { Graphics, Sprite, Texture } from 'pixi.js';

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

export function createCharacter({ PLAYER_X, playerRadius, groundY, texture, frames, jumpSpeed = 2000, gravity = 3000, screenScale = 1 }:
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
      console.log('Character: static frame chosen, frame0 size:', f0.width, f0.height);
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
  // position sprite (world coordinates)
  sprite.x = PLAYER_X;
  sprite.y = groundY - playerRadius;
  // make interactive
  (sprite as any).interactive = true;
  (sprite as any).buttonMode = true;

  const player: Player = {
    sprite,
    worldX: 0,
    y: sprite.y,
    vy: 0,
    onGround: true,
    maxJumps: 2, // Tăng từ 2 lên 3 để có thể nhảy nhiều hơn
    jumpsLeft: 2, // Tăng từ 2 lên 3
    desiredScreenScale: screenScale,
    // hold-to-extend jump state
    // how long (seconds) additional jump hold extends the ascent
    // Tăng thời gian giữ jump để nhảy cao hơn và lâu hơn
    maxJumpHoldTime: 0.45, // Tăng từ 0.25 lên 0.45 giây
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
            const tex = Texture.from('/Assets/_arts/effect_double jump.png');

            // main effect (original size) - tăng kích thước để nổi bật hơn
            const eff = new Sprite(tex);
            eff.anchor.set(0.5, 0.5);
            eff.x = this.worldX - 45; // Di chuyển xa hơn để thấy rõ
            eff.y = this.y - 10; // Nâng cao hơn để phù hợp với character cao hơn
            eff.alpha = 1;
            eff.scale.set(1.2, 1.2); // Tăng kích thước lên 20%

            // second effect (scaled 0.8) placed slightly further back
            const eff2 = new Sprite(tex);
            eff2.anchor.set(0.5, 0.5);
            eff2.x = this.worldX - 70; // Xa hơn
            eff2.y = this.y - 5; // Cao hơn
            eff2.alpha = 0.95;
            eff2.scale.set(0.8, 0.8); // Tăng từ 0.6 lên 0.8

            // third effect (scaled 0.5) placed further back for depth
            const eff3 = new Sprite(tex);
            eff3.anchor.set(0.5, 0.5);
            eff3.x = this.worldX - 95; // Xa hơn nữa
            eff3.y = this.y; // Giữ ở mức character
            eff3.alpha = 0.9;
            eff3.scale.set(0.5, 0.5); // Tăng từ 0.3 lên 0.5

            // try to insert effects behind the player sprite if possible
            if (parent && typeof parent.addChild === 'function') {
              try {
                const idx = typeof parent.getChildIndex === 'function' ? parent.getChildIndex(this.sprite) : -1;
                if (idx >= 0) {
                  // insert eff3, eff2, eff so eff3 is furthest back
                  parent.addChildAt(eff3, Math.max(0, idx));
                  parent.addChildAt(eff2, Math.max(0, idx + 1));
                  parent.addChildAt(eff, Math.max(0, idx + 2));
                } else {
                  parent.addChild(eff3);
                  parent.addChild(eff2);
                  parent.addChild(eff);
                }
              } catch (e) { parent.addChild(eff3); parent.addChild(eff2); parent.addChild(eff); }
            }

            // remove effects after a longer time để tạo cảm giác nổi bật hơn
            setTimeout(() => { try { eff.parent && eff.parent.removeChild(eff); } catch (e) {} }, 650); // Tăng từ 420 lên 650ms
            setTimeout(() => { try { eff2.parent && eff2.parent.removeChild(eff2); } catch (e) {} }, 750); // Tăng từ 520 lên 750ms
            setTimeout(() => { try { eff3.parent && eff3.parent.removeChild(eff3); } catch (e) {} }, 850); // Tăng từ 620 lên 850ms

            // Only perform the 360° spin when this is the 'double-jump' (i.e. last available mid-air jump)
            if (prevJumpsLeft === 1) {
              try {
                const spinDuration = 650; // Tăng từ 520 lên 650ms để phù hợp với effects lâu hơn
                const spriteAny: any = this.sprite;
                // ensure rotation pivot is the visual center of the sprite/container
                let prevPivot: any = { x: 0, y: 0 };
                let prevPos: any = { x: spriteAny.x, y: spriteAny.y };
                try {
                  if (spriteAny.pivot) {
                    prevPivot.x = spriteAny.pivot.x || 0;
                    prevPivot.y = spriteAny.pivot.y || 0;
                  }
                  prevPos.x = spriteAny.x; prevPos.y = spriteAny.y;
                  const b = spriteAny.getLocalBounds ? spriteAny.getLocalBounds() : null;
                  if (b) {
                    const cx = b.x + b.width / 2;
                    const cy = b.y + b.height / 2;
                    try { spriteAny.pivot && typeof spriteAny.pivot.set === 'function' ? spriteAny.pivot.set(cx, cy) : (spriteAny.pivot = { x: cx, y: cy }); } catch (e) {}
                    // keep world position consistent
                    spriteAny.x = prevPos.x; spriteAny.y = prevPos.y;
                  }
                } catch (e) {}

                // cancel previous spin if running
                if (spriteAny.__spinCancel) {
                  try { spriteAny.__spinCancel(); } catch (e) {}
                  spriteAny.__spinCancel = null;
                }

                const startRot = (spriteAny.rotation || 0) as number;
                const targetRot = startRot + Math.PI * 2;
                const startTime = (performance && performance.now) ? performance.now() : Date.now();
                let rafId: number | null = null;
                function step(now: number) {
                  const t = Math.min(1, (now - startTime) / spinDuration);
                  // ease-out cubic for nicer motion
                  const eased = 1 - Math.pow(1 - t, 3);
                  try { spriteAny.rotation = startRot + (targetRot - startRot) * eased; } catch (e) {}
                  if (t < 1) {
                    rafId = requestAnimationFrame(step);
                  } else {
                    // restore rotation and pivot to avoid numeric accumulation
                    try { spriteAny.rotation = startRot; } catch (e) {}
                    try { if (spriteAny.pivot && typeof spriteAny.pivot.set === 'function') spriteAny.pivot.set(prevPivot.x, prevPivot.y); else spriteAny.pivot = prevPivot; } catch (e) {}
                    try { spriteAny.x = prevPos.x; spriteAny.y = prevPos.y; } catch (e) {}
                    rafId = null;
                  }
                }
                rafId = requestAnimationFrame(step);
                // provide a cancel function in case another spin starts
                spriteAny.__spinCancel = () => {
                  if (rafId) try { cancelAnimationFrame(rafId); } catch (e) {};
                  try { spriteAny.rotation = startRot; } catch (e) {};
                  try { if (spriteAny.pivot && typeof spriteAny.pivot.set === 'function') spriteAny.pivot.set(prevPivot.x, prevPivot.y); else spriteAny.pivot = prevPivot; } catch (e) {}
                  try { spriteAny.x = prevPos.x; spriteAny.y = prevPos.y; } catch (e) {};
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
        // reduce gravity effect during hold so ascent is extended - giảm gravity nhiều hơn để nổi lâu hơn
        this.vy += (gravity * 0.25) * deltaSec; // Giảm từ 0.45 xuống 0.25 để character nổi lâu hơn
        (this as any).jumpHoldTime += deltaSec;
      } else {
        this.vy += gravity * deltaSec;
      }
      const prevY = this.y;
      this.y += this.vy * deltaSec;
      const surfaceY = (this as any).getGroundY ? (this as any).getGroundY(this.worldX) : groundY;
      const groundTop = surfaceY - playerRadius;
      // Only snap to surface if the player crossed the surface from above
      // (i.e., was above it and now is at/below it). If the player is already
      // below the surface (fell into a pit), do not teleport them back up.
      if (prevY < groundTop && this.y >= groundTop && this.vy >= 0) {
        this.y = groundTop;
        this.vy = 0;
        this.onGround = true;
        // reset available jumps when landing
        if ((this as any).maxJumps !== undefined) (this as any).jumpsLeft = (this as any).maxJumps;
      } else {
        this.onGround = false;
      }

      // sprite.x is in world coordinates; world.x = -scroll will offset it on-screen
      this.sprite.x = this.worldX;
      this.sprite.y = this.y;
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

  (sprite as any).on('pointerdown', () => player.jump());

  return player;
}
