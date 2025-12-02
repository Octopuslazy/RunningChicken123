import { Application, Sprite, Assets, Graphics, Text, TextStyle, Container, Texture } from 'pixi.js';
import { SpinePlayer } from './SpinePlayer';
import { createCharacter } from './character';
import { createGameplay } from './gameplay';
import { loadTexture, loadSpriteStrip, splitSpriteStrip, splitSpriteStripFixed, loadIndexedFrames, loadSpriteStripAsSeparateTextures } from './assetLoader';
import { makeGroundPattern } from './patterns/groundOnly';

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

  const bg = new Graphics().rect(0, 0, WIDTH, HEIGHT).fill({ color: 0x66ccff });
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

  const groundY = HEIGHT + 1200;
  // NOTE: system ground removed — patterns provide ground art and define where
  // the player can stand. We no longer create a global ground Graphics.

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
  const PLAYER_SPAWN_LIFT = 80; // pixels above the ground/pattern to spawn
  let player: any = null;
  // Use `char.png` as the static character texture (no animation)
  const charTex = await loadTexture('/Assets/_arts/char.png');
  if (charTex) {
    console.log('Using char.png for player texture');
    player = createCharacter({ PLAYER_X, playerRadius, groundY: groundY - PLAYER_SPAWN_LIFT, texture: charTex as any, jumpSpeed: 1400, gravity: 4000, screenScale: 0.8 });
  } else {
    console.log('char.png not found; falling back to graphics');
    player = createCharacter({ PLAYER_X, playerRadius, groundY: groundY - PLAYER_SPAWN_LIFT, texture: undefined, jumpSpeed: 1400, gravity: 4000, screenScale: 0.8 });
  }

  player.worldX = PLAYER_X;
  world.addChild(player.sprite);
  try {
    // ensure visible and log initial state for debugging
    (player.sprite as any).visible = true;
    (player.sprite as any).alpha = 1;
    console.log('Player spawned:', { worldX: player.worldX, x: player.sprite.x, y: player.sprite.y });
  } catch (e) {}

  // Load Spine visual for the player (optional). If successful, replace the
  // player's sprite with the Spine view so visuals come from Spine while
  // physics/controls remain on the `player` object.
  let spinePlayerInstance: any = null;
  let defaultAnim: string | null = null;
  // We'll provide a helper to (re)load Spine animations and attach them
  // to the player. This allows us to remove existing animations and
  // re-import from disk on demand.
  async function reloadSpineAnimations() {
    try {
      // If there's an existing Spine view attached, remove it first
      try {
        if (spinePlayerInstance && spinePlayerInstance.view) {
          try { world.removeChild(spinePlayerInstance.view); } catch (e) {}
        }
      } catch (e) {}

      const sp = new SpinePlayer('kfc_chicken');
      await sp.load('/Assets/Arts/anim/');
      const avail = sp.getAnimations();
      sp.setScale(1.5);
      sp.setPosition(player.worldX, player.y);

      // attach the new view
      try { world.removeChild(player.sprite); } catch (e) {}
      player.sprite = sp.view;
      (player.sprite as any).interactive = true;
      (player.sprite as any).buttonMode = true;
      player.sprite.on && player.sprite.on('pointerdown', () => {
        try { (player as any).jump(); } catch (e) {}
      });
      world.addChild(player.sprite);
      spinePlayerInstance = sp;
      console.log('SpinePlayer loaded — animations:', avail);
    } catch (e) {
      console.warn('SpinePlayer reload failed:', e);
    }
  }

  // initial load
  reloadSpineAnimations();
  

  // increase initial camera/player speed slightly so gameplay feels faster
  const gameplay = createGameplay({ world, bg, label, WIDTH, HEIGHT, groundY, initialSpeed: 200, speedAccel: 8, patternYOffset: -1000, patternGroundThickness: 160 });
  try { (gameplay as any)._handler.allowRandomObstacles = false; } catch (e) {}

  // spawn a sequence of ground patterns (~20) so the scene is filled
  try {
    // preload ground textures so Sprite/Texture are ready
    try {
      await loadTexture('/Assets/_arts/bg_1_groundmid.png');
    } catch (e) {}
    try {
      await loadTexture('/Assets/_arts/bg_1_groundleft.png');
    } catch (e) {}
    try {
      await loadTexture('/Assets/_arts/bg_1_groundright.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/bg_1_store3.png');
    } catch (e) {}
    try {
      await loadTexture('/Assets/_arts/bg_1_light.png');
    } catch (e) {}

    const handler = (gameplay as any)._handler;
    // enable hitbox debug by default so colliders are visible for verification
    try { handler.toggleHitboxes(); } catch (e) {}
    // let player query dynamic ground surface (pattern or base ground)
    try {
      if (player && handler && (player as any).getGroundY === undefined) {
        (player as any).getGroundY = (wx: number) => {
          try { return handler.getSurfaceYAt(wx); } catch (e) { return groundY; }
        };
      }
    } catch (e) {}
    // bind 'H' key to toggle obstacle hitbox debug visibility
    window.addEventListener('keydown', (ev) => {
      if (ev.code === 'KeyH') {
        try {
          const newState = handler.toggleHitboxes();
          console.log('Pattern hitbox debug:', newState);
        } catch (e) {}
      }
    });

    // Create and place multiple ground-only patterns (~20) sequentially
    try {
      const patterns: any[] = [];
      const NUM_PATTERNS = 20;
      const PIT_WIDTH = 300; // pit between every two patterns
      let cursorX = 0;
      for (let i = 0; i < NUM_PATTERNS; i++) {
        const length = 700;
        // always include left and right end caps for each pattern
        const factory = makeGroundPattern({ leftEnd: true, rightEnd: true, length });
        const p = handler.addPattern(factory, cursorX);
        patterns.push(p);

        // determine visual length (prefer container bounds when available)
        let visualLength = p && p.container ? (() => {
          try { const b = p.container.getLocalBounds(); return b.width || p.length; } catch (e) { return p.length; }
        })() : (p ? p.length : length);

        // add a pit between this pattern and the next (except after last)
        if (i < NUM_PATTERNS - 1) {
          try { (gameplay as any).getPits().push({ x: cursorX + visualLength, width: PIT_WIDTH }); } catch (e) {}
        }

        cursorX += visualLength;
        if (i < NUM_PATTERNS - 1) cursorX += PIT_WIDTH;
      }

      // place player on the first pattern's surface so they spawn on the pattern
      try {
        const p1 = patterns.length > 0 ? patterns[0] : null;
        if (p1 && p1.container && player) {
          const startX1 = 0;
          const visualLength = p1 && p1.container ? (() => { try { const b = p1.container.getLocalBounds(); return b.width || p1.length; } catch (e) { return p1.length; } })() : (p1 ? p1.length : 700);
          const withinP1 = (typeof player.worldX === 'number') && (player.worldX >= startX1 && player.worldX <= startX1 + visualLength);
          const targetWorldX = withinP1 ? player.worldX : (startX1 + Math.min(100, Math.floor(visualLength / 4)));
          player.worldX = targetWorldX;
          try {
            const surfaceY = handler.getSurfaceYAt ? handler.getSurfaceYAt(targetWorldX) : p1.container.y;
            player.y = surfaceY - playerRadius - PLAYER_SPAWN_LIFT;
          } catch (e) {
            player.y = p1.container.y - playerRadius - PLAYER_SPAWN_LIFT;
          }
          player.vy = 0;
          player.onGround = true;
          try { if ((player as any).maxJumps !== undefined) (player as any).jumpsLeft = (player as any).maxJumps; } catch (e) {}
          try { player.sprite.y = player.y; } catch (e) {}
        }
      } catch (e) {}
      try { 
        // make sure player is on top of world children so it's visible
        try { world.removeChild(player.sprite); } catch (e) {}
        world.addChild(player.sprite);
        console.log('Player repositioned on pattern:', { worldX: player.worldX, y: player.y, spriteY: player.sprite.y });
      } catch (e) {}
    } catch (e) { console.warn('Failed to spawn repeated patterns', e); }
  } catch (e) { console.warn('Pattern spawn failed', e); }

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
          // when jump input begins, pause the run animation immediately
          try {
            if (did && spinePlayerInstance && spinePlayerInstance.pauseTrack) {
              spinePlayerInstance.pauseTrack(0);
            }
          } catch (e) {}
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
        // when jump input begins, pause the run animation immediately
        try {
          if (did && spinePlayerInstance && spinePlayerInstance.pauseTrack) {
            spinePlayerInstance.pauseTrack(0);
          }
        } catch (e) {}
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

    // Animation control: show jump when touching colliders or when in air

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
          } else if (currBottom > obstacleTop) {
            // intersecting from side / too low: block forward movement
            player.worldX = Math.min(player.worldX, o.x - playerRadius - 2);
            player.sprite.x = player.worldX;
          }
        }
      }
    } catch (e) {}

    // Animation policy: RUN only when touching ground colliders, pause when jumping
    try {
      if (spinePlayerInstance) {
        let shouldShowRun = false;
        
        // Only show run animation when touching ground colliders
        if (player.onGround) {
          const obstacles = (gameplay as any).getObstacles ? (gameplay as any).getObstacles() : [];
          const playerBottom = player.y + playerRadius;
          
          for (const o of obstacles) {
            const left = o.x;
            const right = o.x + o.width;
            // check horizontal overlap
            if (player.worldX + playerRadius > left && player.worldX - playerRadius < right) {
              const obstacleTop = o.sprite.y;
              // if touching ground collider, show run
              if (Math.abs(playerBottom - obstacleTop) <= 8 && o.isGround) {
                shouldShowRun = true;
                break;
              }
            }
          }
        }
        
        // Apply animation based on shouldShowRun
        try {
          const state = (spinePlayerInstance as any).spine ? (spinePlayerInstance as any).spine.state : null;
          const track0 = state ? (typeof state.getCurrent === 'function' ? state.getCurrent(0) : (state.tracks ? state.tracks[0] : null)) : null;
          const currentAnim = track0 && track0.animation ? track0.animation.name : null;
          // If the run track exists and is paused its entry.timeScale will be 0.
          const trackPaused = track0 && (track0.timeScale === 0 || track0.timeScale === 0.0);

          if (shouldShowRun) {
            // If run isn't the current animation, set it. Then always attempt
            // to resume the track in case it was paused while airborne.
            try {
              if (currentAnim !== 'run') {
                spinePlayerInstance.play && spinePlayerInstance.play('run', true, 0);
              }
              // resume even if the animation name is already 'run' but the
              // track was paused (timeScale === 0)
              if (trackPaused) {
                try { console.debug && console.debug('LAND: resuming run animation'); } catch (e) {}
              }
              try { spinePlayerInstance.resumeTrack && spinePlayerInstance.resumeTrack(0); } catch (e) {}
            } catch (e) {}
          } else {
            // Not touching ground colliders: pause run if it's playing and
            // not already paused.
            try {
              if (currentAnim === 'run' && !(track0 && track0.timeScale === 0)) {
                try { spinePlayerInstance.pauseTrack && spinePlayerInstance.pauseTrack(0); } catch (e) {}
              }
            } catch (e) {}
          }
        } catch (e) {}
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

    // animation control handled above (run only when touching ground colliders, paused when jumping)

    // Counter-scale player sprite so it appears 1:1 on screen regardless of root scale
    player.setScreenScale(currentScale);

    // update parallax backgrounds and tiled road scrolling
    try { if (cloudBigLayer && cloudBigLayer.update) cloudBigLayer.update(scroll); } catch (e) {}
    try { if (cloudSmallLayer && cloudSmallLayer.update) cloudSmallLayer.update(scroll); } catch (e) {}
    try {
      if (cityLayer && cityLayer.update) cityLayer.update(scroll);
    } catch (e) {}
    // road visuals removed; patterns will handle ground art now.

    // Update label to show camera speed and distance
    label.text = `Speed(cam): ${Math.round(speed)} px/s  Distance: ${Math.floor(scroll)}`;

    if (debugEnabled) {
      const screenX = player.sprite.x + world.x;
      debug.text = `worldX:${Math.round(player.worldX)} scroll:${Math.round(scroll)} screenX:${Math.round(screenX)}`;
    }

    // ground visuals removed; no road mask needed — patterns will control ground art.
  });

  // Game over handling (with grace/config)
  const GAME_OVER_GRACE_MS = 400;
  let gameOver = false;
  let gameOverQueuedTimer: ReturnType<typeof setTimeout> | null = null;
  let gameOverQueuedReason: string | null = null;

  function doGameOver(finalReason?: string) {
    if (gameOver) return;
    // Protect against false positives: if the player is currently on a
    // registered pattern and appears grounded, suppress the Game Over.
    try {
      const handler = (gameplay as any)._handler;
      const onPattern = handler && handler.isOnPattern ? handler.isOnPattern(player.worldX) : false;
      if (onPattern && player && player.onGround) {
        console.debug && console.debug('Suppressing GameOver: player still on pattern', { finalReason, worldX: player.worldX, onPattern });
        return;
      }
    } catch (e) {}

    gameOver = true;
    console.log('GameOver triggered (overlay suppressed):', finalReason ?? gameOverQueuedReason ?? 'unknown');
  }

  function queueGameOver(reason: string) {
    gameOverQueuedReason = reason;
    if (gameOverQueuedTimer) {
      clearTimeout(gameOverQueuedTimer as any);
    }
    gameOverQueuedTimer = setTimeout(() => {
      gameOverQueuedTimer = null;
      try {
        if (reason === 'left-pattern') {
          const handler = (gameplay as any)._handler;
          const onPattern = handler && handler.isOnPattern ? handler.isOnPattern(player.worldX) : true;
          if (onPattern) {
            console.log('GameOver canceled (player returned to pattern):', reason);
            return;
          }
        }
      } catch (e) {}
      doGameOver(reason);
    }, GAME_OVER_GRACE_MS) as unknown as ReturnType<typeof setTimeout>;
  }

  // check pits / falling for game over each frame
  app.ticker.add(() => {
    if (gameOver) return;
    try {
      // Immediate pit fall detection
      try {
        const overPit = (gameplay as any).isOverPit ? (gameplay as any).isOverPit(player.worldX) : false;
        if (overPit && (player as any).vy > 60) {
          const surfaceY = (player as any).getGroundY ? (player as any).getGroundY(player.worldX) : groundY;
          const playerBottom = player.y + playerRadius;
          if (playerBottom > surfaceY + 12) {
            console.debug && console.debug('Player fell into pit — immediate Game Over', { worldX: player.worldX, playerBottom, surfaceY });
            doGameOver('fell-into-pit');
            return;
          }
        }
      } catch (e) {}

      const screenX = player.sprite.x + world.x;
      const behindThreshold = -playerRadius - 10;
      const screenY = (player.sprite.y || 0) + (world.y || 0);

      if (screenX < behindThreshold) {
        queueGameOver('behind-camera');
      } else if (screenY > HEIGHT + 100) {
        console.debug && console.debug('Player fell off bottom of screen — triggering Game Over', { screenY });
        doGameOver('fell-off-screen');
      } else {
        if (gameOverQueuedTimer && gameOverQueuedReason === 'behind-camera') {
          try { console.log('GameOver canceled (player returned on-screen):', gameOverQueuedReason); } catch (e) {}
          clearTimeout(gameOverQueuedTimer as any);
          gameOverQueuedTimer = null;
          gameOverQueuedReason = null;
        }
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
    // road visuals were removed — nothing to counter-scale here.
    return;
  }

  // apply initial ground counter-scale
  try { applyGroundCounterScale(currentScale); } catch (e) {}

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

init();
