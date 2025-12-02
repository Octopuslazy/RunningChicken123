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
    maxJumps: 2,
    jumpsLeft: 2,
    desiredScreenScale: screenScale,
    // hold-to-extend jump state
    // how long (seconds) additional jump hold extends the ascent
    // default allow 0.25s of extended ascent
    maxJumpHoldTime: 0.25,
    jumpHoldTime: 0,
    holdingJump: false,
    jump() {
      // allow jump from ground or perform an extra mid-air jump if available
      const canJump = (this.onGround === true) || ((this as any).jumpsLeft && (this as any).jumpsLeft > 0);
      if (canJump) {
        this.vy = -jumpSpeed;
        this.onGround = false;
        if (!(this as any).onGround) {
          // if we used a mid-air jump, consume one
          if ((this as any).jumpsLeft !== undefined) {
            (this as any).jumpsLeft = Math.max(0, (this as any).jumpsLeft - 1);
          }
        }
        // if jumping from ground, ensure jumpsLeft accounts for remaining mid-air jumps
        if ((this as any).onGround === false && (this as any).jumpsLeft === undefined) {
          (this as any).jumpsLeft = (this as any).maxJumps ? (this as any).maxJumps - 1 : 1;
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
