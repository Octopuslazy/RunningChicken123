import { Application, Sprite, Assets, Graphics, Text, TextStyle, Container, Texture } from 'pixi.js';
import { SpinePlayer } from './SpinePlayer';
import { createCharacter } from './character';
import { createGameplay } from './gameplay';
import { createRoad } from './ground';
import { loadTexture, loadSpriteStrip, splitSpriteStrip, splitSpriteStripFixed, loadIndexedFrames, loadSpriteStripAsSeparateTextures } from './assetLoader';

const WIDTH = 1920;
const HEIGHT = 1080;

const app = new Application();

async function init() {
  await (app as any).init({
    width: WIDTH,
    height: HEIGHT,
    background: 0x1099bb,
    resizeTo: window
  });

  const canvas = app.canvas as HTMLCanvasElement;
  canvas.style.display = 'block';
  document.body.style.margin = '0';
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  document.body.appendChild(canvas);

  const root = new Container();
  app.stage.addChild(root);

  try {
    app.renderer.resize(WIDTH, HEIGHT);
  } catch (e) {}

  function applyCanvasCssSize() {
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  applyCanvasCssSize();

  const world = new Container();
  root.addChild(world);

  const bg = new Graphics().rect(0, 0, WIDTH, HEIGHT).fill(0x66ccff);
  world.addChild(bg);

  // Parallax city background (tiles `bg_3_city.png`) placed behind everything
  let cityLayer: { container: import('pixi.js').Container; update: (scroll: number) => void; tileWidth: number; } | null = null;
  try {
    const cityTex = await loadTexture('/Assets/_arts/bg_3_city.png');
    if (cityTex) {
      const container = new Container();
      // place behind bg/fill and other world content
      root.addChildAt(container, 0);
      const tileW = cityTex.width || WIDTH;
      const bgScale = 4; // scale background 2x
      // place container vertically so child sprites can be at y=0
      const desiredY = HEIGHT - (cityTex.height || 200) - 800;
      container.y = desiredY;
      container.scale.set(bgScale, bgScale);
      // compute how many tiles needed to cover screen when scaled
      const needed = Math.ceil((WIDTH * 2) / (tileW * bgScale)) + 4;
      for (let i = 0; i < needed; i++) {
        const s = new Sprite(cityTex as any);
        s.x = i * tileW;
        // children placed at y=0 since container.y handles vertical positioning
        s.y = 0;
        s.anchor.set(0, 0);
        container.addChild(s);
      }
      function updateCity(scroll: number) {
        const parallaxFactor = 0.45; // slower than foreground
        const effectiveTileW = tileW * bgScale;
        const offset = -((scroll * parallaxFactor) % effectiveTileW);
        container.x = offset;
      }
      cityLayer = { container, update: updateCity, tileWidth: tileW };
    }
  } catch (e) { cityLayer = null; }

  // Parallax cloud layers (big = far, small = near)
  let cloudBigLayer: { container: import('pixi.js').Container; update: (scroll: number) => void; tileWidth: number; } | null = null;
  let cloudSmallLayer: { container: import('pixi.js').Container; update: (scroll: number) => void; tileWidth: number; } | null = null;
  try {
    const bigTex = await loadTexture('/Assets/_arts/bg_4_cloudbig.png');
    if (bigTex) {
      const c = new Container();
      // place above city (index 1)
      try { root.addChildAt(c, 1); } catch (e) { root.addChild(c); }
      const tileW = bigTex.width || WIDTH;
      const gapFraction = 0.25; // extra spacing between cloud tiles (25% of tile width)
      const extendedTileW = tileW * (2 + gapFraction);
      const needed = Math.ceil((WIDTH * 2) / extendedTileW) + 4;
      for (let i = 0; i < needed; i++) {
        const s = new Sprite(bigTex as any);
        s.x = i * extendedTileW;
        s.y = 40; // high in the sky
        s.anchor.set(0, 0);
        c.addChild(s);
      }
      function updateBig(scroll: number) {
        const parallaxFactor = 0.25; // far, moves slowly
        const offset = -((scroll * parallaxFactor) % extendedTileW);
        c.x = offset;
      }
      cloudBigLayer = { container: c, update: updateBig, tileWidth: tileW };
    }
  } catch (e) { cloudBigLayer = null; }

  try {
    const smallTex = await loadTexture('/Assets/_arts/bg_4_cloudsmall.png');
    if (smallTex) {
      const c = new Container();
      // place above city and big clouds (index 2)
      try { root.addChildAt(c, 2); } catch (e) { root.addChild(c); }
      const tileW = smallTex.width || WIDTH;
      const gapFractionS = 0.18; // small clouds slightly less spaced
      const extendedTileWS = tileW * (5 + gapFractionS);
      const needed = Math.ceil((WIDTH * 2) / extendedTileWS) + 4;
      for (let i = 0; i < needed; i++) {
        const s = new Sprite(smallTex as any);
        s.x = i * extendedTileWS;
        s.y = 100; // a bit lower than big clouds
        s.anchor.set(0, 0);
        c.addChild(s);
      }
      function updateSmall(scroll: number) {
        const parallaxFactor = 0.6; // nearer, moves faster than big clouds
        const offset = -((scroll * parallaxFactor) % extendedTileWS);
        c.x = offset;
      }
      cloudSmallLayer = { container: c, update: updateSmall, tileWidth: tileW };
    }
  } catch (e) { cloudSmallLayer = null; }

  const groundY = HEIGHT - 120;
  // keep a ground Graphics for reference/collision but visuals come from tiled road
  const ground = new Graphics();
  world.addChild(ground);

  // create tiled road using art (attach to `root` so it scrolls in screen-space)
  const road = await createRoad(root, groundY, WIDTH, HEIGHT, { tilePath: '/Assets/_arts/bg_1_groundmid.png', tileWidth: 128 });
  // mask that will be updated to hide tiles where pits exist (attach to root)
  const roadMask = new Graphics();
  root.addChild(roadMask);
  if (road && (road as any).container) {
    (road as any).container.mask = roadMask;
  }

  // attempt to load a background image (optional)
  // Assets are located in `Assets/_arts/` in this project
  const bgTex = await loadTexture('/Assets/_arts/back.png');
  if (bgTex) {
    const sprite = new Sprite(bgTex as any);
    sprite.width = WIDTH;
    sprite.height = HEIGHT;
    sprite.x = 0;
    sprite.y = 0;
    world.addChildAt(sprite, 0);
  }

  const style = new TextStyle({
    fill: '#ffffff',
    fontSize: 36,
    fontFamily: 'Helvetica, Arial'
  });
  const label = new Text({ text: 'Running Chicken - Pixi v8', style: style });
  label.x = 20;
  label.y = 20;
  root.addChild(label);

  // Spine loading/attachment is handled by `SpinePlayer` (uses
  // `@esotericsoftware/spine-pixi-v8`). The old dynamic runtime-detection
  // block was removed — `SpinePlayer.load()` performs the atlas/json parsing
  // and returns the Spine view to attach to the player.

  const PLAYER_X = 150;
  const playerRadius = 28;
  let player: any = null;
  // Use `char.png` as the static character texture (no animation)
  const charTex = await loadTexture('/Assets/_arts/char.png');
  if (charTex) {
    console.log('Using char.png for player texture');
    player = createCharacter({ PLAYER_X, playerRadius, groundY, texture: charTex as any, jumpSpeed: 1400, gravity: 4000, screenScale: 0.8 });
  } else {
    console.log('char.png not found; falling back to graphics');
    player = createCharacter({ PLAYER_X, playerRadius, groundY, texture: undefined, jumpSpeed: 1400, gravity: 4000, screenScale: 0.8 });
  }

  player.worldX = PLAYER_X;
  world.addChild(player.sprite);

  // Load Spine visual for the player (optional). If successful, replace the
  // player's sprite with the Spine view so visuals come from Spine while
  // physics/controls remain on the `player` object.
  let spinePlayerInstance: any = null;
  let defaultAnim: string | null = null;
  (async () => {
    try {
      const sp = new SpinePlayer('kfc_chicken');
      await sp.load('/Assets/Arts/anim/');
      // figure out a sensible default loop (prefer 'run' then 'idle')
      const avail = sp.getAnimations();
      defaultAnim = avail.includes('run') ? 'run' : (avail.includes('idle') ? 'idle' : (avail.length ? avail[0] : null));
      if (defaultAnim) sp.setDefaultLoop(defaultAnim);
      // position/scale to match player
      sp.setScale(1.5);
      sp.setPosition(player.worldX, player.y);
      // replace visual
      try { world.removeChild(player.sprite); } catch (e) {}
      player.sprite = sp.view;
      (player.sprite as any).interactive = true;
      (player.sprite as any).buttonMode = true;
      // when sprite itself is tapped/clicked, try to jump and, if a jump
      // actually occurred, interrupt the base loop and play the jump anim on
      // track 0 so the run animation stops during the jump.
      player.sprite.on && player.sprite.on('pointerdown', () => {
        try {
          (player as any).jump();
        } catch (e) {}
      });
      world.addChild(player.sprite);
      spinePlayerInstance = sp;
      console.log('SpinePlayer loaded and attached to player — animations:', avail);
    } catch (e) {
      console.warn('SpinePlayer load failed:', e);
    }
  })();
  

  // increase initial camera/player speed slightly so gameplay feels faster
  const gameplay = createGameplay({ world, bg, ground, label, WIDTH, HEIGHT, initialSpeed: 200, speedAccel: 8 });

  // prevent repeating keydown from causing multiple jump calls
  let spaceHeld = false;
  let pointerHeld = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (!spaceHeld) {
        spaceHeld = true;
        try {
          const did = (player as any).startJumpHold ? (player as any).startJumpHold() : (player as any).jump();
          // if this is a mid-air (double) jump, trigger jump animation now
              // no immediate animation on input; the ticker will pause run when airborne
        } catch (err) {}
      }
    }
  });

  // handle keyup to end hold
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      spaceHeld = false;
      try { if ((player as any).endJumpHold) (player as any).endJumpHold(); } catch (err) {}
    }
  });

  // pointer hold for mouse/touch: pointerdown starts hold, pointerup ends
  window.addEventListener('pointerdown', (e) => {
    if (!pointerHeld) {
      pointerHeld = true;
      try {
        const did = (player as any).startJumpHold ? (player as any).startJumpHold() : (player as any).jump();
        // no immediate animation on input; double-jump will not trigger visual jump
      } catch (err) {}
    }
  });
  window.addEventListener('pointerup', (e) => {
    pointerHeld = false;
    try { if ((player as any).endJumpHold) (player as any).endJumpHold(); } catch (err) {}
  });

  // Debug overlay (toggle with 'D') to inspect world/player positions
  const debugStyle = new TextStyle({ fill: '#ffff00', fontSize: 18 });
  const debug = new Text({ text: 'DEBUG', style: debugStyle });
  debug.x = 10;
  debug.y = 60;
  debug.visible = false;
  root.addChild(debug);
  let debugEnabled = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyD') {
      debugEnabled = !debugEnabled;
      debug.visible = debugEnabled;
    }
  });

  // current root scale (used to keep character 1:1 on screen)
  let currentScale = 1;
  // player moves slightly faster than camera to allow overtaking obstacles
  const PLAYER_SPEED_FACTOR = 1.05;

  app.ticker.add(() => {
    const deltaSec = (app.ticker as any).deltaMS / 1000;

    // Update gameplay (camera scroll) first
    const { scroll, speed } = gameplay.update(deltaSec);

    // Make player's run speed slightly faster than camera so player can overtake obstacles
    const playerMoveSpeed = speed * PLAYER_SPEED_FACTOR;
    player.worldX += playerMoveSpeed * deltaSec;

    // capture previous bottom for obstacle landing detection
    (app as any).__prevPlayerBottom = player.y + playerRadius;

    // Update player physics and position
    player.update(deltaSec, scroll, speed);

    // detect landing/jump transitions so we can control the Spine base loop.
    // If the player just landed, resume the default loop. If the player just
    // left the ground (jump started) and input handlers didn't already trigger
    // the animation, play the jump anim on track 0 to stop the run loop.
    try {
      (app as any).__prevOnGround = (app as any).__prevOnGround === undefined ? player.onGround : (app as any).__prevOnGround;
      const prevOnGround = (app as any).__prevOnGround;
      if (prevOnGround && !player.onGround) {
        // jumped — pause the base run track until landing
        try {
          if (!(app as any).__jumpTriggered) {
            if (spinePlayerInstance) try { spinePlayerInstance.pauseTrack(0); } catch (e) {}
            (app as any).__jumpTriggered = true;
          }
        } catch (e) {}
      } else if (!prevOnGround && player.onGround) {
        // landed
        try { (app as any).__jumpTriggered = false; } catch (e) {}
        if (spinePlayerInstance) try { spinePlayerInstance.resumeDefaultLoop(); } catch (e) {}
      }
      (app as any).__prevOnGround = player.onGround;
    } catch (e) {}

    // Obstacle interactions: allow landing on top when descending, otherwise block
    try {
      const obstacles = (gameplay as any).getObstacles ? (gameplay as any).getObstacles() : [];
      for (const o of obstacles) {
        const left = o.x;
        const right = o.x + o.width;
        // check horizontal overlap
        if (player.worldX + playerRadius > left && player.worldX - playerRadius < right) {
          const obstacleTop = o.sprite.y;
          // if player was above the obstacle and is now descending onto it, snap to top
          // we captured prevY before update earlier in the ticker (see below)
          const prevBottom = (app as any).__prevPlayerBottom !== undefined ? (app as any).__prevPlayerBottom : (player.y + playerRadius);
          const currBottom = player.y + playerRadius;
          if (prevBottom <= obstacleTop && currBottom >= obstacleTop && player.vy >= 0) {
            // landed on obstacle
            player.y = obstacleTop - playerRadius;
            player.vy = 0;
            player.onGround = true;
            try { if ((player as any).maxJumps !== undefined) (player as any).jumpsLeft = (player as any).maxJumps; } catch (e) {}
            player.sprite.y = player.y;
            // allow horizontal movement while standing on top
            // resume run animation when landing on a box top
            try {
              (app as any).__jumpTriggered = false;
              if (spinePlayerInstance) try { spinePlayerInstance.resumeDefaultLoop(); } catch (e) {}
            } catch (e) {}
          } else if (currBottom > obstacleTop) {
            // intersecting from side / too low: block forward movement
            player.worldX = Math.min(player.worldX, o.x - playerRadius - 2);
            player.sprite.x = player.worldX;
          }
        }
      }
    } catch (e) {}

    // Adjust Spine animation playback speed to follow camera speed.
    try {
      if (spinePlayerInstance) {
        // base camera speed used when animations play at normal rate
        const baseSpeed = 200; // matches gameplay initialSpeed
        // scale animations based on player movement speed (not camera speed)
        let ts = (playerMoveSpeed - 180) / baseSpeed;
        if (!isFinite(ts) || ts <= 0) ts = 0.5;
        // clamp to a reasonable range
        ts = Math.min(Math.max(ts, 1), 2.2);
        spinePlayerInstance.setTimeScale(ts);
      }
    } catch (e) {}

    // Counter-scale player sprite so it appears 1:1 on screen regardless of root scale
    player.setScreenScale(currentScale);

    // update parallax backgrounds and tiled road scrolling
    try { if (cloudBigLayer && cloudBigLayer.update) cloudBigLayer.update(scroll); } catch (e) {}
    try { if (cloudSmallLayer && cloudSmallLayer.update) cloudSmallLayer.update(scroll); } catch (e) {}
    try {
      if (cityLayer && cityLayer.update) cityLayer.update(scroll);
    } catch (e) {}
    try { if (road && (road as any).update) (road as any).update(scroll); } catch (e) {}

    // Update label to show camera speed and distance
    label.text = `Speed(cam): ${Math.round(speed)} px/s  Distance: ${Math.floor(scroll)}`;

    if (debugEnabled) {
      const screenX = player.sprite.x + world.x;
      debug.text = `worldX:${Math.round(player.worldX)} scroll:${Math.round(scroll)} screenX:${Math.round(screenX)}`;
    }

    // update road mask to hide tiles where pits are
    try {
      const mask = roadMask;
      mask.clear();
      const pits = (gameplay as any).getPits ? (gameplay as any).getPits() : [];
      const worldLength = Math.max(WIDTH * 10, Math.ceil(scroll + WIDTH * 2));
      let drawX = 0;
      const sorted = pits.slice().sort((a: any, b: any) => a.x - b.x);
      for (const p of sorted) {
        const segWidth = Math.max(0, p.x - drawX);
        if (segWidth > 0) {
          mask.rect(drawX, groundY, segWidth, HEIGHT - groundY).fill(0xffffff);
        }
        drawX = p.x + p.width;
      }
      if (drawX < worldLength) {
        mask.rect(drawX, groundY, worldLength - drawX, HEIGHT - groundY).fill(0xffffff);
      }
    } catch (e) {}
  });

  // Game over handling
  let gameOver = false;
  function doGameOver() {
    if (gameOver) return;
    gameOver = true;

    // show a semi-opaque gray overlay and a Play Again button
    const overlay = new Graphics();
    overlay.rect(0, 0, WIDTH, HEIGHT).fill(0x000000, 0.6);
    overlay.x = 0; overlay.y = 0;
    overlay.name = 'gameoverOverlay';
    root.addChild(overlay);

    const goStyle = new TextStyle({ fill: '#ffffff', fontSize: 72, fontFamily: 'Helvetica, Arial' });
    const go = new Text({ text: 'GAME OVER', style: goStyle });
    go.anchor = { x: 0.5, y: 0.5 } as any;
    go.x = WIDTH / 2;
    go.y = HEIGHT / 2 - 80;
    go.name = 'gameoverText';
    root.addChild(go);

    const btnStyle = new TextStyle({ fill: '#000000', fontSize: 36, fontFamily: 'Helvetica, Arial' });
    const btnBg = new Graphics();
    const btnW = 260, btnH = 60;
    const btnX = WIDTH / 2 - btnW / 2;
    const btnY = HEIGHT / 2 + 10;
    btnBg.rect(btnX, btnY, btnW, btnH).fill(0xffffff);
    btnBg.name = 'playAgainBg';
    root.addChild(btnBg);

    const playText = new Text({ text: 'Play Again', style: btnStyle });
    playText.x = WIDTH / 2 - (playText.width / 2);
    playText.y = btnY + (btnH - playText.height) / 2;
    playText.interactive = true;
    (playText as any).buttonMode = true;
    playText.name = 'playAgainText';
    root.addChild(playText);

    const cleanupAndRestart = () => {
      try { root.removeChild(overlay); } catch (e) {}
      try { root.removeChild(go); } catch (e) {}
      try { root.removeChild(btnBg); } catch (e) {}
      try { root.removeChild(playText); } catch (e) {}
      // reset gameplay and player state
      try { (gameplay as any).reset(); } catch (e) {}
      player.worldX = PLAYER_X;
      player.vy = 0;
      player.y = groundY - playerRadius;
      if ((player as any).maxJumps !== undefined) (player as any).jumpsLeft = (player as any).maxJumps;
      gameOver = false;
      try { app.ticker.start(); } catch (e) {}
    };

    playText.on('pointerdown', cleanupAndRestart);
    btnBg.interactive = true; (btnBg as any).buttonMode = true; btnBg.on('pointerdown', cleanupAndRestart);
  }

  // check pits / falling for game over each frame
  app.ticker.add(() => {
    if (gameOver) return;
    const groundTop = groundY - playerRadius; // same as in character
    try {
      const overPit = (gameplay as any).isOverPit && (gameplay as any).isOverPit(player.worldX);
      if (overPit && player.y > groundTop + 200) {
        doGameOver();
      }
      // if player falls behind the camera (e.g. drops into pit or is blocked and slips back), game over
      const screenX = player.sprite.x + world.x;
      if (screenX < -playerRadius - 10) {
        doGameOver();
      }
    } catch (e) {}
  });

  function updateScale() {
    const sw = canvas.clientWidth || window.innerWidth;
    const sh = canvas.clientHeight || window.innerHeight;
    let scale = Math.min(sw / WIDTH, sh / HEIGHT);
    scale = Math.min(scale, 1);

    root.scale.set(scale, scale);
    // store current scale for other modules (character counter-scaling)
    currentScale = scale;
    root.x = (sw - WIDTH * scale) / 2;
    root.y = (sh - HEIGHT * scale) / 2;
  }

  updateScale();

  function onResize() {
    applyCanvasCssSize();
    updateScale();
  }

  // ensure ground tiles keep native pixel size regardless of root scale
  function applyGroundCounterScale(scale: number) {
    try {
      if (road && (road as any).container) {
        const c = (road as any).container;
        // counter-scale so visible size remains 1:1
        c.scale.set(1 / scale, 1 / scale);
        // because we changed the container scale, ensure its y remains at the ground top
        c.y = groundY;
      }
    } catch (e) {}
  }

  // apply initial ground counter-scale
  try { applyGroundCounterScale(currentScale); } catch (e) {}

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

init();
