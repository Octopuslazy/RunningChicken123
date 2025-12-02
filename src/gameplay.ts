import { Container, Graphics, Text, Rectangle } from 'pixi.js';

export function createGameplay({ world, bg, ground, label, WIDTH, HEIGHT, initialSpeed = 200, speedAccel = 8 }:
  { world: Container; bg: Graphics; ground: Graphics; label: Text; WIDTH: number; HEIGHT: number; initialSpeed?: number; speedAccel?: number; }) {
  let scroll = 0;
  let speed = initialSpeed;
  const baseInitialSpeed = initialSpeed;
  // pits array (world coordinates). Each pit has x (worldX) and width.
  const pits: { x: number; width: number }[] = [];
  const PIT_INTERVAL = 1600; // spawn every 1600 px traveled
  let nextPitTrigger = PIT_INTERVAL;
  const PIT_WIDTH = 160;
  const PIT_SPAWN_AHEAD = WIDTH * 0.8; // spawn the pit ahead of current view

  // Obstacles: square blocks that appear on the road. We'll render them into
  // their own container attached to the `world` so they move with the camera.
  const obstaclesContainer = new Container();
  world.addChild(obstaclesContainer);
  type Obstacle = { x: number; width: number; height: number; sprite: Graphics };
  const obstacles: Obstacle[] = [];
  // spawn settings
  const OB_MIN_INTERVAL = 600;
  const OB_MAX_INTERVAL = 1400;
  let nextObstacleTrigger = OB_MIN_INTERVAL * 1.5;
  const OB_SPAWN_AHEAD = WIDTH * 0.9;

  function hslToHex(h: number, s: number, l: number) {
    s /= 100; l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const to255 = (v: number) => Math.round(f(v) * 255);
    return (to255(0) << 16) + (to255(8) << 8) + to255(4);
  }

  function update(deltaSec: number) {
    speed += speedAccel * deltaSec;

    scroll += speed * deltaSec;
    world.x = -scroll;

    const hue = (scroll * 0.02) % 360;
    const col = hslToHex(hue, 70, 55);
    bg.clear().rect(0, 0, WIDTH, HEIGHT).fill(col);

    // ground drawing is handled by the renderer (main) via a mask over the
    // tiled road, so gameplay only manages pit positions and logic.

    label.text = `Speed: ${Math.round(speed)} px/s  Distance: ${Math.floor(scroll)} px`;

    // spawn pits when passing the trigger threshold
    if (scroll >= nextPitTrigger) {
      const px = scroll + PIT_SPAWN_AHEAD;
      pits.push({ x: px, width: PIT_WIDTH });
      nextPitTrigger += PIT_INTERVAL;
    }

    // spawn obstacles at random intervals
    if (scroll >= nextObstacleTrigger) {
      const px = scroll + OB_SPAWN_AHEAD + Math.random() * 120; // small random offset
      // make obstacles larger by default
      const size = 80 + Math.floor(Math.random() * 80); // square size 80-159
      const g = new Graphics();
      g.rect(0, 0, size, size).fill(0x996633);
      // position in world coords (x = worldX where obstacle sits). We place
      // the sprite's origin at top-left and y at ground top - size.
      g.x = px;
      const groundTop = HEIGHT - 120;
      // place so obstacle rests on ground line
      g.y = groundTop - size;
      // make obstacle interactive so the player can tap/click it
      g.interactive = true;
      // set a hit area to ensure clicks anywhere on the square register
      g.hitArea = new Rectangle(0, 0, size, size) as any;
      // when tapped, remove the obstacle (player can interact with blocks)
      // capture the obstacle object by reference so we can remove it safely
      // create the obstacle object
      const ob = { x: px, width: size, height: size, sprite: g } as any;
      g.on('pointerdown', () => {
        try {
          // remove visual and from array so it no longer blocks
          obstaclesContainer.removeChild(g);
          const idx = obstacles.indexOf(ob);
          if (idx >= 0) obstacles.splice(idx, 1);
        } catch (e) {}
      });
      obstaclesContainer.addChild(g);
      obstacles.push(ob);
      // set next trigger to current + random interval
      const interval = OB_MIN_INTERVAL + Math.floor(Math.random() * (OB_MAX_INTERVAL - OB_MIN_INTERVAL));
      nextObstacleTrigger = scroll + interval;
    }

    // cleanup obstacles that have passed off-screen (behind camera)
    while (obstacles.length && (obstacles[0].x + obstacles[0].width) < (scroll - 200)) {
      try { obstaclesContainer.removeChild(obstacles[0].sprite); } catch (e) {}
      obstacles.shift();
    }

    return { scroll, speed };
  }

  function getObstacles() { return obstacles; }

  function isColliding(playerWorldX: number, playerY: number, playerRadius: number) {
    // very simple AABB-ish test: check obstacles overlapping player's x and
    // player's foot y touching the obstacle
    for (const o of obstacles) {
      const left = o.x;
      const right = o.x + o.width;
      if (playerWorldX + playerRadius > left && playerWorldX - playerRadius < right) {
        // check vertical overlap: if player's y (center) is below top of obstacle
        const obstacleTop = o.sprite.y;
        if (playerY + playerRadius > obstacleTop) return true;
      }
    }
    return false;
  }

  // Return an obstacle that should block the player (not allowing forward
  // movement) — this is used to stop the player's worldX if they're running
  // into the obstacle and not high enough to pass over it.
  function getBlockingObstacle(playerWorldX: number, playerY: number, playerRadius: number) {
    for (const o of obstacles) {
      const left = o.x;
      const right = o.x + o.width;
      if (playerWorldX + playerRadius > left && playerWorldX - playerRadius < right) {
        // player's bottom y coordinate
        const playerBottom = playerY + playerRadius;
        const obstacleTop = o.sprite.y;
        // if player's bottom is below obstacle top (i.e., not clearing it), it's blocking
        if (playerBottom > obstacleTop) return o;
      }
    }
    return null;
  }

  function isOverPit(worldX: number) {
    for (const p of pits) {
      if (worldX >= p.x && worldX <= p.x + p.width) return true;
    }
    return false;
  }

  function reset() {
    scroll = 0;
    speed = baseInitialSpeed;
    pits.length = 0;
    nextPitTrigger = PIT_INTERVAL;
    world.x = 0;
    // clear obstacles
    try {
      for (const o of obstacles) {
        try { obstaclesContainer.removeChild(o.sprite); } catch (e) {}
      }
    } catch (e) {}
    obstacles.length = 0;
    nextObstacleTrigger = OB_MIN_INTERVAL * 1.5;
  }

  return { update, getScroll: () => scroll, getSpeed: () => speed, isOverPit, getPits: () => pits, getObstacles, isColliding, getBlockingObstacle, reset };
}
