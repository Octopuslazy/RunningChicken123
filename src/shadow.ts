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
  private wasHidden = false; // Track shadow state to prevent spam logging

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
      if (!this.shadow) {
        return;
      }

      // Ensure shadow is attached to world
      if (!this.shadow.parent) {
        try { this.world.addChild(this.shadow); } catch (e) {}
      }
      if (this.shadow.parent !== this.world) {
        try { this.shadow.parent.removeChild(this.shadow); } catch (e) {}
        try { this.world.addChild(this.shadow); } catch (e) {}
      }

      // Check if player is over a pit - if so, hide the shadow
      let overPit = false;
      try {
        overPit = (this.gameplay && (this.gameplay as any).isOverPit) ? (this.gameplay as any).isOverPit(this.player.worldX) : false;
      } catch (e) {
        overPit = false;
      }

      if (overPit) {
        this.wasHidden = true;
        this.shadow.visible = false;
        return;
      } else {
        if (this.wasHidden) this.wasHidden = false;
      }

      const handler = (this.gameplay as any)._handler;
      const obstacles = (this.gameplay as any).getObstacles ? (this.gameplay as any).getObstacles() : [];

      let surfaceY = handler && typeof handler.getSurfaceYAt === 'function' ? handler.getSurfaceYAt(this.player.worldX) : this.groundY;

      // Find ground obstacle under player for surface calculation
      for (const o of obstacles) {
        try {
          if (!o) continue;
          const left = o.x;
          const right = o.x + o.width;
          if (this.player.worldX >= left && this.player.worldX <= right) {
            if ((o as any).isGround && o.sprite && typeof o.sprite.y === 'number') {
              surfaceY = o.sprite.y;
              break;
            }
          }
        } catch (e) {}
      }

      const playerBottom = this.player.y + this.playerRadius;
      const altitude = Math.max(0, surfaceY - playerBottom);

      const scaleFactor = Math.max(0.7, Math.min(1.3, 1 - altitude / 600));
      const alphaFactor = Math.max(0.7, Math.min(1, 1 - altitude / 400));

      // Always use world coordinates since shadow is always in world
      this.shadow.x = this.player.worldX;
      this.shadow.y = surfaceY + 62;
      
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
