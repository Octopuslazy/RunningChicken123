import { Sprite, Texture, Container } from 'pixi.js';

interface ParticleData {
  sprite: Sprite;
  vx: number;
  vy: number;
  startTime: number;
  lifetime: number;
  alphaStart: number;
  alphaEnd: number;
  scaleStart: number;
  scaleEnd: number;
  active: boolean;
}

export class ParticleManager {
  private static instance: ParticleManager;
  private pool: Sprite[] = [];
  private activeParticles: ParticleData[] = [];
  private texture: Texture;
  private poolSize = 50; // Max particles in pool
  
  private constructor() {
    this.texture = Texture.from('/Assets/_arts/effect_double jump.png');
    this.initializePool();
  }
  
  static getInstance(): ParticleManager {
    if (!ParticleManager.instance) {
      ParticleManager.instance = new ParticleManager();
    }
    return ParticleManager.instance;
  }
  
  private initializePool() {
    // Pre-create sprites for reuse
    for (let i = 0; i < this.poolSize; i++) {
      const sprite = new Sprite(this.texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.visible = false;
      this.pool.push(sprite);
    }
  }
  
  private getPooledSprite(): Sprite | null {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return null; // Pool exhausted
  }
  
  private returnToPool(sprite: Sprite) {
    sprite.visible = false;
    sprite.alpha = 1;
    sprite.scale.set(1, 1);
    if (sprite.parent) {
      sprite.parent.removeChild(sprite);
    }
    
    if (this.pool.length < this.poolSize) {
      this.pool.push(sprite);
    }
  }
  
  spawnParticle(
    container: Container,
    x: number,
    y: number,
    config: {
      vx: number;
      vy: number;
      lifetime: number;
      alphaStart: number;
      alphaEnd: number;
      scaleStart: number;
      scaleEnd: number;
    }
  ) {
    const sprite = this.getPooledSprite();
    if (!sprite) return; // Pool exhausted
    
    sprite.x = x;
    sprite.y = y;
    sprite.alpha = config.alphaStart;
    sprite.scale.set(config.scaleStart, config.scaleStart);
    sprite.visible = true;
    
    container.addChild(sprite);
    
    const particle: ParticleData = {
      sprite,
      vx: config.vx,
      vy: config.vy,
      startTime: performance.now(),
      lifetime: config.lifetime,
      alphaStart: config.alphaStart,
      alphaEnd: config.alphaEnd,
      scaleStart: config.scaleStart,
      scaleEnd: config.scaleEnd,
      active: true
    };
    
    this.activeParticles.push(particle);
  }
  
  // Call this from main game loop instead of RAF
  update(deltaTime: number) {
    if (this.activeParticles.length === 0) return;
    
    const now = performance.now();
    const particlesToRemove: number[] = [];
    
    // Batch process all particles in one loop
    for (let i = 0; i < this.activeParticles.length; i++) {
      const particle = this.activeParticles[i];
      if (!particle.active) {
        particlesToRemove.push(i);
        continue;
      }
      
      const elapsed = now - particle.startTime;
      const t = Math.min(1, elapsed / particle.lifetime);
      
      // Batch update position, alpha, and scale
      particle.sprite.x += particle.vx * deltaTime;
      particle.sprite.y += particle.vy * deltaTime;
      particle.sprite.alpha = particle.alphaStart + (particle.alphaEnd - particle.alphaStart) * t;
      
      const scale = particle.scaleStart + (particle.scaleEnd - particle.scaleStart) * t;
      particle.sprite.scale.set(scale, scale);
      
      // Mark for removal if dead
      if (t >= 1) {
        particlesToRemove.push(i);
      }
    }
    
    // Batch remove dead particles (reverse order to maintain indices)
    for (let i = particlesToRemove.length - 1; i >= 0; i--) {
      const idx = particlesToRemove[i];
      const particle = this.activeParticles[idx];
      this.returnToPool(particle.sprite);
      this.activeParticles.splice(idx, 1);
    }
  }
  
  // For cleanup
  clear() {
    for (const particle of this.activeParticles) {
      this.returnToPool(particle.sprite);
    }
    this.activeParticles.length = 0;
  }
  
  // Get debug info
  getStats() {
    return {
      poolSize: this.pool.length,
      activeParticles: this.activeParticles.length,
      totalCapacity: this.poolSize
    };
  }
}