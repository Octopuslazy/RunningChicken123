import { Container, Graphics } from 'pixi.js';

export interface ShadowOptions {
  world: Container;
  gameplay: any;
  player: any;
  playerRadius: number;
  groundY: number;
}

export class PlayerShadow {
  world: Container;
  gameplay: any;
  player: any;
  playerRadius: number;
  groundY: number;
  shadow: Graphics | null = null;

  constructor(opts: ShadowOptions) {
    this.world = opts.world;
    this.gameplay = opts.gameplay;
    this.player = opts.player;
    this.playerRadius = opts.playerRadius;
    this.groundY = opts.groundY+10;

    try {
      this.shadow = new Graphics();
      this.shadow.clear();
      try { this.shadow.beginFill(0x000000, 0.6); } catch (e) {}
      try { this.shadow.drawEllipse(0, 0, this.playerRadius * 1.2, this.playerRadius * 0.8); } catch (e) {}
      try { this.shadow.endFill && this.shadow.endFill(); } catch (e) {}
      this.shadow.alpha = 0.6;
      try { this.world.addChild(this.shadow); } catch (e) {}
      try {
        // Keep shadow below the player by using player's zIndex - 1 when possible
        const pz = (this.player && this.player.sprite && (this.player.sprite as any).zIndex) ? (this.player.sprite as any).zIndex : 5000;
        try { (this.shadow as any).zIndex = Math.max(0, pz - 1); } catch (e) {}
      } catch (e) {}
      try { (this.world as any).sortableChildren = true; (this.world as any).sortChildren && (this.world as any).sortChildren(); } catch (e) {}
    } catch (e) {
      this.shadow = null;
    }
  }

  update() {
    try {
      if (!this.shadow) return;

      // Check if player is over a pit - if so, hide the shadow
      const overPit = (this.gameplay && (this.gameplay as any).isOverPit) ? (this.gameplay as any).isOverPit(this.player.worldX) : false;
      if (overPit) {
        this.shadow.visible = false;
        return;
      }

      const handler = (this.gameplay as any)._handler;
      const obstacles = (this.gameplay as any).getObstacles ? (this.gameplay as any).getObstacles() : [];

      let surfaceY = handler && typeof handler.getSurfaceYAt === 'function' ? handler.getSurfaceYAt(this.player.worldX) : this.groundY;

      let shadowTarget: any = null;
      for (const o of obstacles) {
        try {
          if (!o) continue;
          const left = o.x;
          const right = o.x + o.width;
          if (this.player.worldX >= left && this.player.worldX <= right) {
            if ((o as any).isPlane) { shadowTarget = o; break; }
            if (!(o as any).isGround && !shadowTarget) { shadowTarget = o; }
          }
        } catch (e) {}
      }

      // If the obstacle has a visual sprite, prefer its Y. Also try to
      // attach the shadow to the pattern container that owns this obstacle
      // (so the shadow 'floats' on the pattern). We detect ownership by
      // matching `__planeId` on pattern plane visuals when available.
      let attachParent: Container | null = this.world;
      if (shadowTarget && shadowTarget.sprite) {
        surfaceY = shadowTarget.sprite.y;

        try {
          const handler = (this.gameplay as any)._handler;
          const hw = handler && (handler as any).world ? (handler as any).world : null;
          if (hw && (shadowTarget as any).planeId !== undefined && (shadowTarget as any).planeId !== null) {
            const pid = (shadowTarget as any).planeId;
            for (const patContainer of (hw as any).children) {
              try {
                for (const child of (patContainer as any).children) {
                  try {
                    if (child && (child as any).__planeId === pid) {
                      attachParent = patContainer as Container;
                      break;
                    }
                  } catch (e) {}
                }
                if (attachParent !== this.world) break;
              } catch (e) {}
            }
          }
        } catch (e) {}
      }

      const playerBottom = this.player.y + this.playerRadius;
      const altitude = Math.max(0, surfaceY - playerBottom);

      const scaleFactor = Math.max(0.7, Math.min(1.3, 1 - altitude / 600));
      const alphaFactor = Math.max(0.7, Math.min(1, 1 - altitude / 400));

      // If attachParent is a pattern container, set shadow local coords
      try {
        if (attachParent && attachParent !== this.shadow.parent) {
          // reparent: remove from old parent and add to new parent
          try { if (this.shadow.parent) this.shadow.parent.removeChild(this.shadow); } catch (e) {}
          try {
            attachParent.addChild(this.shadow);
            // ensure the container respects zIndex ordering and keep the
            // shadow above other pattern visuals by giving it a high zIndex
            try { (attachParent as any).sortableChildren = true; } catch (e) {}
            try {
              const pz = (this.player && this.player.sprite && (this.player.sprite as any).zIndex) ? (this.player.sprite as any).zIndex : 5000;
              try { (this.shadow as any).zIndex = Math.max(0, pz - 1); } catch (e) {}
            } catch (e) {}
            try { (attachParent as any).sortChildren && (attachParent as any).sortChildren(); } catch (e) {}
          } catch (e) {
            try { this.world.addChild(this.shadow); attachParent = this.world; } catch (e) {}
          }
          // Also ensure world uses sortableChildren so the shadow ordering
          // relative to player/world children is stable when parent is world.
          try { (this.world as any).sortableChildren = true; (this.world as any).sortChildren && (this.world as any).sortChildren(); } catch (e) {}
        }
      } catch (e) {}

      if (this.shadow.parent === this.world) {
        this.shadow.x = this.player.worldX;
        // lower shadow further (previously +2); now moved down additional 20px
        this.shadow.y = surfaceY + 62;
      } else {
        // parent is a pattern container whose x/y are world coordinates
        try {
          const px = (this.shadow.parent as any).x || 0;
          const py = (this.shadow.parent as any).y || 0;
          this.shadow.x = this.player.worldX - px;
          this.shadow.y = (surfaceY + 62) - py;
        } catch (e) {
          this.shadow.x = this.player.worldX;
          this.shadow.y = surfaceY + 62;
        }
      }
      try { this.shadow.scale.set(scaleFactor, Math.max(0.2, scaleFactor * 0.6)); } catch (e) {}
      this.shadow.alpha = alphaFactor;
      this.shadow.visible = true;
    } catch (e) {}
  }

  destroy() {
    try { if (this.shadow && this.shadow.parent) this.shadow.parent.removeChild(this.shadow); } catch (e) {}
    this.shadow = null;
  }
}

export default PlayerShadow;
