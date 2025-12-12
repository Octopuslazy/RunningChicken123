import { Container, Sprite, Texture, Point } from 'pixi.js';

export default class Pickup extends Container {
  public type: number;
  private img: Sprite;
  public collected: boolean;

  constructor(type: number, tex: Texture) {
    super();
    this.type = type;
    this.collected = false;
    this.img = new Sprite(tex as any);
    this.img.anchor.set(0.5, 0.5);
    this.img.x = 0;
    this.img.y = 0;
    this.addChild(this.img);
    this.zIndex = 1200;
    // ensure interactive if needed later
    (this as any).interactive = true;
  }

  // Return bounds of the visual (delegates to the sprite)
  public getBounds() {
    // ensure sprite at 0,0 so container bounds represent the visual location
    return super.getBounds();
  }

  // Return the global position of the visual center
  public getSpriteGlobalPosition() {
    const p = this.toGlobal(new Point(this.img.x, this.img.y));
    return p;
  }

  // Remove from parent and emit a DOM event describing the pickup
  public collect() {
    if (this.collected) return;
    this.collected = true;
    // Dispatch pickup event immediately so sounds or logic trigger at touch
    try {
      if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
        const posNow = this.getSpriteGlobalPosition();
        const evNow = new CustomEvent('pickup', { detail: { type: this.type, x: posNow.x, y: posNow.y } });
        (window as any).dispatchEvent(evNow);
      }
    } catch (e) {}

    // Play pickup animation: move up and fade out over 1 second, then remove
    try {
      const duration = 1000; // ms
      const moveUp = 60; // pixels to move up during animation
      const start = (performance && performance.now) ? performance.now() : Date.now();
      const startY = this.y;
      const imgAny: any = this.img;

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        try {
          this.y = startY - moveUp * eased;
          imgAny.alpha = 1 - eased;
        } catch (e) {}

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          // end: remove (event already dispatched above)
          try { if (this.parent) this.parent.removeChild(this); } catch (e) {}
        }
      };

      requestAnimationFrame(step);
    } catch (e) {
      // fallback: immediate remove (event already dispatched)
      try { if (this.parent) this.parent.removeChild(this); } catch (e) {}
    }
  }
}
