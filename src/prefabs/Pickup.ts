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
    try { if (this.parent) this.parent.removeChild(this); } catch (e) {}
    try {
      if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
        const pos = this.getSpriteGlobalPosition();
        const ev = new CustomEvent('pickup', { detail: { type: this.type, x: pos.x, y: pos.y } });
        (window as any).dispatchEvent(ev);
      }
    } catch (e) {}
  }
}
