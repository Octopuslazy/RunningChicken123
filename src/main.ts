import { Application, Sprite, Assets, Graphics, Text, TextStyle, Container, Texture } from 'pixi.js';
import { SpinePlayer } from './SpinePlayer';
import { createCharacter } from './character';
import { createGameplay } from './gameplay';
import { loadTexture, loadSpriteStrip, splitSpriteStrip, splitSpriteStripFixed, loadIndexedFrames, loadSpriteStripAsSeparateTextures } from './assetLoader';
import { makeGroundPattern } from './patterns/groundOnly';
import makeDanger1 from './patterns/Danger1';
import makeDanger2 from './patterns/Danger2';
import makeDanger3 from './patterns/Danger3';
import makeDanger4 from './patterns/Danger4';
import makeDanger5 from './patterns/Danger5';
import Pickup from './prefabs/Pickup';
import SoundController from './sound/SoundController';
import showGameOver from './ui/gameOver';

const WIDTH = 1920;
const HEIGHT = 1080;

// Toggle verbose runtime logging (set to `true` while debugging)
const LOG_DEBUG = false;
const L = {
  log: (...args: any[]) => { if (LOG_DEBUG) console.log(...args); },
  debug: (...args: any[]) => { if (LOG_DEBUG) console.debug(...args); },
  info: (...args: any[]) => { if (LOG_DEBUG) console.info(...args); }
};

// Global character size factor (e.g. 0.6 = 60% of previous size)
const CHARACTER_SCALE_FACTOR = 0.6;

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
  // Background image `back.png` was removed to avoid a large arrow overlay
  // that covered the scene. If you want a subtle background image later,
  // load it and add it with proper scaling/positioning here.

  const style = new TextStyle({
    fill: '#ffffff',
    fontSize: 36,
    fontFamily: 'Helvetica-Bold'
  });
  const label = new Text({ text: 'Running Chicken - Pixi v8', style: style });
  label.x = 140;
  label.y = 20;
  root.addChild(label);

  // Sound toggle button (top-left)
  try {
    let soundEnabled = false;
    const soundToggle = new Container();
    const btnW = 120; const btnH = 36;
    const btn = new Graphics();
    try { btn.clear(); btn.beginFill(0x000000, 0.45); btn.drawRoundedRect(0, 0, btnW, btnH, 6); btn.endFill(); } catch (e) {}
    const lblStyle = new TextStyle({ fill: '#ffffff', fontSize: 16, fontFamily: 'Helvetica-Bold' });
    const lbl = new Text({ text: 'Sound: Off', style: lblStyle });
    lbl.x = 10; lbl.y = 6;
    soundToggle.addChild(btn);
    soundToggle.addChild(lbl);
    soundToggle.x = 8; soundToggle.y = 8;
    soundToggle.interactive = true;
    (soundToggle as any).buttonMode = true;
    soundToggle.on && soundToggle.on('pointerdown', () => {
      try {
        if (soundEnabled) {
          try { SoundController.stopBackground(); } catch (e) {}
          soundEnabled = false; lbl.text = 'Sound: Off';
        } else {
          try { SoundController.playBackgroundForced(300); } catch (e) { try { SoundController.playBackground(); } catch (e) {} }
          soundEnabled = true; lbl.text = 'Sound: On';
          try { backgroundStarted = true; } catch (e) {}
        }
      } catch (e) {}
    });
    try { root.addChild(soundToggle); } catch (e) { app.stage.addChild(soundToggle); }
  } catch (e) {}

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
    L.log('Using char.png for player texture');
    player = createCharacter({ PLAYER_X, playerRadius, groundY: groundY - PLAYER_SPAWN_LIFT, texture: charTex as any, jumpSpeed: 1400, gravity: 4000, screenScale: 0.8 * CHARACTER_SCALE_FACTOR });
  } else {
    L.log('char.png not found; falling back to graphics');
    player = createCharacter({ PLAYER_X, playerRadius, groundY: groundY - PLAYER_SPAWN_LIFT, texture: undefined, jumpSpeed: 1400, gravity: 4000, screenScale: 0.8 * CHARACTER_SCALE_FACTOR });
  }

  player.worldX = PLAYER_X;
  world.addChild(player.sprite);
  // Wrap player's jump method so we play sound effect when jumping
  try {
    if (player && typeof player.jump === 'function') {
      const _origJump = player.jump.bind(player);
      player.jump = function(...args: any[]) {
        try {
          const did = _origJump(...args);
          if (did) {
            try { SoundController.playJump(); } catch (e) {}
          }
          return did;
        } catch (e) { return _origJump(...args); }
      };
    }
  } catch (e) {}
  try {
    if (player && typeof (player as any).startJumpHold === 'function') {
      const _origStartHold = (player as any).startJumpHold.bind(player);
      (player as any).startJumpHold = function(...args: any[]) {
        try {
          const did = _origStartHold(...args);
          if (did) {
            try { SoundController.playJump(); } catch (e) {}
          }
          return did;
        } catch (e) { return _origStartHold(...args); }
      };
    }
  } catch (e) {}
  try {
    // Ensure the base sprite's pointerdown respects `controlsEnabled` (override any listener from createCharacter)
    try { (player.sprite as any).off && (player.sprite as any).off('pointerdown'); } catch (e) {}
    try { (player.sprite as any).on && (player.sprite as any).on('pointerdown', () => { if (!controlsEnabled) return; try { (player as any).jump(); } catch (e) {} }); } catch (e) {}
  } catch (e) {}
  try {
    // ensure visible and log initial state for debugging
    (player.sprite as any).visible = true;
    (player.sprite as any).alpha = 1;
    L.log('Player spawned:', { worldX: player.worldX, x: player.sprite.x, y: player.sprite.y });
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
      // Apply global character scale factor so Spine visuals match the desired size
      sp.setScale(1.5 * CHARACTER_SCALE_FACTOR);
      sp.setPosition(player.worldX, player.y);

      // attach the new view
      try { world.removeChild(player.sprite); } catch (e) {}
      player.sprite = sp.view;
      (player.sprite as any).interactive = true;
      (player.sprite as any).buttonMode = true;
      player.sprite.on && player.sprite.on('pointerdown', () => {
        try { if (!controlsEnabled) return; (player as any).jump(); } catch (e) {}
      });
      world.addChild(player.sprite);
      spinePlayerInstance = sp;
      L.log('SpinePlayer loaded — animations:', avail);
    } catch (e) {
      console.warn('SpinePlayer reload failed:', e);
    }
  }

  // NOTE: heavy loading (Spine, sounds, gameplay, pattern spawning) is
  // deferred until the player presses Play on the start screen. See
  // `startGame()` defined below.
  let gameplay: any = null;
  // track whether background audio has been started for this page session
  let backgroundStarted = false;

  // spawn a sequence of ground patterns (~20) so the scene is filled
  // Pickup state: declared here so ticker and spawn logic both see it
  const pickups: any[] = [];
  // track pattern containers we spawn so we can remove them when restarting
  const spawnedPatternContainers: any[] = [];
  let score = 0;
  let prevScore = 0;
  // Track distance-based scoring thresholds (every 100px -> +15 points)
  let lastDistanceThreshold = 0;
  // Reward popup / playable-ads settings
  const REWARD_URL = 'https://leapstud.io/'; // <-- change to the destination you want
  const REWARD_THRESHOLD = 1500; // score required to show reward popup
  let rewardShown = false;
  let rewardActive = false;
  // if true, the game is permanently stopped after reward popup
  let rewardPermanentStop = false;
  // whether the user already clicked Get Reward
  let rewardClaimed = false;
  // power-up / invulnerability state
  let playerInvincible = false;
  let powerTimeout: ReturnType<typeof setTimeout> | null = null;
  let powerBlinkInterval: ReturnType<typeof setInterval> | null = null;
  // scale animation removed - not needed
  const scoreStyle = new TextStyle({ fill: '#ffffff', fontSize: 56, fontFamily: 'Helvetica-Bold', fontWeight: 'bold' });
  const scoreText = new Text({ text: 'Score: 0', style: scoreStyle });
  // larger score display in top-right
  scoreText.x = WIDTH - 320;
  scoreText.y = 8;
  root.addChild(scoreText);

  // throttle hit sound so rapid multiple collision checks don't spam audio
  let _lastHitSoundAt = 0;
  function tryPlayHitSound() {
    try {
      const now = Date.now();
      const MIN_MS = 800; // match SoundController cooldown for safety
      if (now - _lastHitSoundAt < MIN_MS) return;
      _lastHitSoundAt = now;
      try { SoundController.playHit(); } catch (e) {}
    } catch (e) {}
  }

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
    try {
      // preload double-jump effect to avoid texture warning
      await loadTexture('/Assets/_arts/effect_double jump.png');
    } catch (e) {}
    try {
      await loadTexture('/Assets/_arts/bg_2_bush.png');
    } catch (e) {}
    try {
      // preload double-jump effect to avoid texture warning
      await loadTexture('/Assets/_arts/bg_2_tree.png');
    } catch (e) {}
    try {
      // preload double-jump effect to avoid texture warning
      await loadTexture('/Assets/_arts/bg_1_billboard.png');
    } catch (e) {}
    try {
      // preload double-jump effect to avoid texture warning
      await loadTexture('/Assets/_arts/effect_va cham.png');
    } catch (e) {}
    try {
      // preload double-jump effect to avoid texture warning
      await loadTexture('/Assets/_arts/bg_1_wheels.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/bg_1_store1.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/bg_1_store2.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/bg_1_standee2.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/bg_3_plane.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/icon_timer.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/obj_0.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/obj_1.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/obj_2.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/obj_3.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/obj_4.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/obj_5.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/obj_6.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/obs_1.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/obs_2.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/obs_3.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/score.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/bg_1_standee1.png');
    } catch (e) {}
    try {
      // preload decorative store so patterns can reference it without a cache warning
      await loadTexture('/Assets/_arts/gameover.jpg');
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
          L.log('Pattern hitbox debug:', newState);
        } catch (e) {}
      }
    });

    // Create and place multiple ground-only patterns sequentially
    try {
      const patterns: any[] = [];
      const NUM_PATTERNS = 200;
      const PIT_WIDTH = 300; // pit between every two patterns

      // --- Spawn configuration (tweak these to change randomness/weights) ---
      const PATTERN_LENGTH = 750; // default visual length for most patterns
      const PROB_USE_DANGER = 0.70; // base chance to use a Danger pattern instead of plain ground
      const PROB_USE_DANGER_AFTER = 0.85; // increased chance after DISTANCE_NORMAL_START (reduces easy)
      // Weights for each Danger variant (relative weights; they are normalized)
      // `d5` (Danger5) is included in selection only after `DISTANCE_NORMAL_START`.
      const DANGER_WEIGHTS = { d1: 0.3, d2: 0.2, d3: 0.3, d4: 0.2, d5: 0.3 };
      const DANGER3_LENGTH = 300;
      const DANGER4_LENGTH = 1200; // explicit length to use for Danger4
      const DISTANCE_NORMAL_START = 4500; // only allow NORMAL difficulty patterns after this world distance

      let cursorX = 0;
      for (let i = 0; i < NUM_PATTERNS; i++) {
        const length = PATTERN_LENGTH;

        // Dynamically adjust chance to spawn Danger (reduces plain/easy ground) once we pass a distance
        const probUseDangerNow = (cursorX >= DISTANCE_NORMAL_START) ? PROB_USE_DANGER_AFTER : PROB_USE_DANGER;

        // Select factory using configurable probabilities and weights
        let factory: any = null;
        if (Math.random() < probUseDangerNow) {
          // pick a danger variant using weighted random
          const r = Math.random();
          // include d5 weight only after DISTANCE_NORMAL_START
          const includeD5 = cursorX >= DISTANCE_NORMAL_START;
          const total = (DANGER_WEIGHTS.d1 + DANGER_WEIGHTS.d2 + DANGER_WEIGHTS.d3 + DANGER_WEIGHTS.d4 + (includeD5 ? DANGER_WEIGHTS.d5 : 0)) || 1;
          const t1 = DANGER_WEIGHTS.d1 / total;
          const t2 = (DANGER_WEIGHTS.d1 + DANGER_WEIGHTS.d2) / total;
          const t3 = (DANGER_WEIGHTS.d1 + DANGER_WEIGHTS.d2 + DANGER_WEIGHTS.d3) / total;
          const t4 = (DANGER_WEIGHTS.d1 + DANGER_WEIGHTS.d2 + DANGER_WEIGHTS.d3 + DANGER_WEIGHTS.d4) / total;
          if (r < t1) {
            factory = makeDanger1({ leftEnd: true, rightEnd: true, length });
          } else if (r < t2) {
            factory = makeDanger2({ leftEnd: true, rightEnd: true, length });
          } else if (r < t3) {
            factory = makeDanger4({ leftEnd: true, rightEnd: true, length: DANGER4_LENGTH });
          } else if (r < t4) {
            factory = makeDanger3({ leftEnd: true, rightEnd: true, length: DANGER3_LENGTH });
          } else {
            // only reachable when includeD5 === true
            factory = makeDanger5({ leftEnd: true, rightEnd: true, length });
          }
        } else {
          factory = makeGroundPattern({ leftEnd: true, rightEnd: true, length });
        }

        // Wrap factory to prevent spawning NORMAL difficulty patterns before the distance threshold.
        // If a factory would create a NORMAL pattern while we're still early, fall back to plain ground.
        const chosenFactory = factory;
        const factoryToUse = (startX2: number) => {
          try {
            const pd = chosenFactory(startX2);
            // Treat MEDIUM patterns as higher-difficulty: don't spawn them
            // before the distance threshold. Fall back to plain ground early.
            if (pd && pd.difficulty === 'MEDIUM' && cursorX < DISTANCE_NORMAL_START) {
              return makeGroundPattern({ leftEnd: true, rightEnd: true, length })(startX2);
            }
            return pd;
          } catch (e) {
            return makeGroundPattern({ leftEnd: true, rightEnd: true, length })(startX2);
          }
        };

        const p = handler.addPattern(factoryToUse, cursorX);
        patterns.push(p);

        // Spawn pickup clusters on this pattern occasionally. Items are
        // placed above the pattern by a random 300..600px and spawn in
        // clusters of 3..6 of the same type. Only spawn if pattern has
        // enough width to accommodate a small cluster.
        try {
          const SPAWN_CHANCE = 0.25;
          // do not spawn pickups on the very first pattern (i === 0)
          if (i > 0 && Math.random() < SPAWN_CHANCE) {
            const ITEM_COUNT = 3 + Math.floor(Math.random() * 4); // 3..6
            const itemType = Math.floor(Math.random() * 7); // 0..6 -> obj_0..obj_6
            const texPath = `/Assets/_arts/obj_${itemType}.png`;
            const tex = Texture.from(texPath);
            const visualLengthLocal = (() => { try { const b = p.container.getLocalBounds(); return b.width || p.length; } catch (e) { return p.length; } })();
            if (visualLengthLocal > 120) {
              const padding = 40;
              const baseXLocal = padding + Math.floor(Math.random() * Math.max(1, Math.floor(visualLengthLocal - padding * 2)));
              const spacing = Math.min(72, Math.max(40, Math.floor(visualLengthLocal / (ITEM_COUNT + 1))));
              const heightAbove = 300 + Math.floor(Math.random() * 301); // 300..600
              for (let ii = 0; ii < ITEM_COUNT; ii++) {
                try {
                  const prefab = new Pickup(itemType, tex as any);
                  prefab.x = baseXLocal + ii * spacing;
                  prefab.y = -heightAbove;
                  prefab.zIndex = 1200;
                  // attach to the pattern container so it moves with the pattern
                  p.container.addChild(prefab);
                  pickups.push(prefab);
                } catch (e) {}
              }
            }
          }
        } catch (e) {}

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
        L.log('Player repositioned on pattern:', { worldX: player.worldX, y: player.y, spriteY: player.sprite.y });
      } catch (e) {}

      // (Moving plane spawn removed) Planes should come from patterns (e.g. Danger5)
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
          if (!controlsEnabled) return;
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
        if (!controlsEnabled) return;
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

  // Start the actual game (loads Spine, sounds, creates gameplay, and
  // spawns initial patterns). This is called when the player presses
  // Play on the start screen so we don't load heavy assets until needed.
  async function startGame() {
    try {
      // load Spine visuals and attach to player
      try { await reloadSpineAnimations(); } catch (e) { console.warn('reloadSpineAnimations failed', e); }
      // initialize sound controller and allow resume on gesture
      try { SoundController.init('/Assets/Sounds/'); SoundController.resumeOnUserGesture(); } catch (e) {}
      // try to start background audio (may be blocked until user gesture)
      // Attempt a forced (muted) autoplay on first load to increase chance
      // browsers accept autoplay when muted. Keep the user-gesture resume
      // fallback in case this still fails.
      try {
        if (!backgroundStarted) {
          try { SoundController.playBackgroundForced(300); } catch (e) { /* fallback to normal play */ try { SoundController.playBackground(); } catch (e) {} }
          backgroundStarted = true;
        }
      } catch (e) {}

      // create gameplay and handler now that assets are ready
      try {
        gameplay = createGameplay({ world, bg, label, WIDTH, HEIGHT, groundY, initialSpeed: 200, speedAccel: 8, patternYOffset: -1000, patternGroundThickness: 160, patternObstaclePadding: 24 });
        try { (gameplay as any)._handler.allowRandomObstacles = false; } catch (e) {}
      } catch (e) { console.warn('createGameplay failed', e); }

      // spawn initial patterns (moved from inline init to here)
      try {
        const handler = (gameplay as any)._handler;
        // enable hitbox debug by default so colliders are visible for verification
        try { handler.toggleHitboxes(); } catch (e) {}

        // Create and place multiple ground-only patterns sequentially
        try {
          const patterns: any[] = [];
          const NUM_PATTERNS = 200;
          const PIT_WIDTH = 300; // pit between every two patterns

          // --- Spawn configuration (tweak these to change randomness/weights) ---
          const PATTERN_LENGTH = 750; // default visual length for most patterns
          const PROB_USE_DANGER = 0.70; // base chance to use a Danger pattern instead of plain ground
          const PROB_USE_DANGER_AFTER = 0.85; // increased chance after DISTANCE_NORMAL_START (reduces easy)
          const DANGER_WEIGHTS = { d1: 0.3, d2: 0.2, d3: 0.3, d4: 0.2, d5: 0.3 };
          const DANGER3_LENGTH = 300;
          const DANGER4_LENGTH = 1200; // explicit length to use for Danger4
          const DISTANCE_NORMAL_START = 4500; // only allow NORMAL difficulty patterns after this world distance

          let cursorX = 0;
          for (let i = 0; i < NUM_PATTERNS; i++) {
            const length = PATTERN_LENGTH;
            const probUseDangerNow = (cursorX >= DISTANCE_NORMAL_START) ? PROB_USE_DANGER_AFTER : PROB_USE_DANGER;
            let factory: any = null;
            if (Math.random() < probUseDangerNow) {
              const r = Math.random();
              const includeD5 = cursorX >= DISTANCE_NORMAL_START;
              const total = (DANGER_WEIGHTS.d1 + DANGER_WEIGHTS.d2 + DANGER_WEIGHTS.d3 + DANGER_WEIGHTS.d4 + (includeD5 ? DANGER_WEIGHTS.d5 : 0)) || 1;
              const t1 = DANGER_WEIGHTS.d1 / total;
              const t2 = (DANGER_WEIGHTS.d1 + DANGER_WEIGHTS.d2) / total;
              const t3 = (DANGER_WEIGHTS.d1 + DANGER_WEIGHTS.d2 + DANGER_WEIGHTS.d3) / total;
              const t4 = (DANGER_WEIGHTS.d1 + DANGER_WEIGHTS.d2 + DANGER_WEIGHTS.d3 + DANGER_WEIGHTS.d4) / total;
              if (r < t1) factory = makeDanger1({ leftEnd: true, rightEnd: true, length });
              else if (r < t2) factory = makeDanger2({ leftEnd: true, rightEnd: true, length });
              else if (r < t3) factory = makeDanger4({ leftEnd: true, rightEnd: true, length: DANGER4_LENGTH });
              else if (r < t4) factory = makeDanger3({ leftEnd: true, rightEnd: true, length: DANGER3_LENGTH });
              else factory = makeDanger5({ leftEnd: true, rightEnd: true, length });
            } else {
              factory = makeGroundPattern({ leftEnd: true, rightEnd: true, length });
            }

            const chosenFactory = factory;
            const factoryToUse = (startX2: number) => {
              try {
                const pd = chosenFactory(startX2);
                if (pd && pd.difficulty === 'MEDIUM' && cursorX < DISTANCE_NORMAL_START) {
                  return makeGroundPattern({ leftEnd: true, rightEnd: true, length })(startX2);
                }
                return pd;
              } catch (e) {
                return makeGroundPattern({ leftEnd: true, rightEnd: true, length })(startX2);
              }
            };

            const p = handler.addPattern(factoryToUse, cursorX);
            patterns.push(p);
            try { if (p && p.container) spawnedPatternContainers.push(p.container); } catch (e) {}

            // Spawn pickups (same logic as before)
            try {
              const SPAWN_CHANCE = 0.25;
              if (i > 0 && Math.random() < SPAWN_CHANCE) {
                const ITEM_COUNT = 3 + Math.floor(Math.random() * 4);
                const itemType = Math.floor(Math.random() * 7);
                const texPath = `/Assets/_arts/obj_${itemType}.png`;
                const tex = Texture.from(texPath);
                const visualLengthLocal = (() => { try { const b = p.container.getLocalBounds(); return b.width || p.length; } catch (e) { return p.length; } })();
                if (visualLengthLocal > 120) {
                  const padding = 40;
                  const baseXLocal = padding + Math.floor(Math.random() * Math.max(1, Math.floor(visualLengthLocal - padding * 2)));
                  const spacing = Math.min(72, Math.max(40, Math.floor(visualLengthLocal / (ITEM_COUNT + 1))));
                  const heightAbove = 300 + Math.floor(Math.random() * 301);
                  for (let ii = 0; ii < ITEM_COUNT; ii++) {
                    try {
                      const prefab = new Pickup(itemType, tex as any);
                      prefab.x = baseXLocal + ii * spacing;
                      prefab.y = -heightAbove;
                      prefab.zIndex = 1200;
                      p.container.addChild(prefab);
                      pickups.push(prefab);
                    } catch (e) {}
                  }
                }
              }
            } catch (e) {}

            let visualLength = p && p.container ? (() => { try { const b = p.container.getLocalBounds(); return b.width || p.length; } catch (e) { return p.length; } })() : (p ? p.length : length);
            if (i < NUM_PATTERNS - 1) {
              try { (gameplay as any).getPits().push({ x: cursorX + visualLength, width: PIT_WIDTH }); } catch (e) {}
            }
            cursorX += visualLength;
            if (i < NUM_PATTERNS - 1) cursorX += PIT_WIDTH;
          }

          // position player on first pattern
          try {
            const p1 = patterns.length > 0 ? patterns[0] : null;
            if (p1 && p1.container && player) {
              const startX1 = 0;
              const visualLength = p1 && p1.container ? (() => { try { const b = p1.container.getLocalBounds(); return b.width || p1.length; } catch (e) { return p1.length; } })() : (p1 ? p1.length : 700);
              const withinP1 = (typeof player.worldX === 'number') && (player.worldX >= startX1 && player.worldX <= startX1 + visualLength);
              const targetWorldX = withinP1 ? player.worldX : (startX1 + Math.min(100, Math.floor(visualLength / 4)));
              player.worldX = targetWorldX;
              try { const surfaceY = handler.getSurfaceYAt ? handler.getSurfaceYAt(targetWorldX) : p1.container.y; player.y = surfaceY - playerRadius - PLAYER_SPAWN_LIFT; } catch (e) { player.y = p1.container.y - playerRadius - PLAYER_SPAWN_LIFT; }
              player.vy = 0; player.onGround = true;
              try { if ((player as any).maxJumps !== undefined) (player as any).jumpsLeft = (player as any).maxJumps; } catch (e) {}
              try { player.sprite.y = player.y; } catch (e) {}
            }
          } catch (e) {}
          try { world.removeChild(player.sprite); } catch (e) {}
          try { world.addChild(player.sprite); } catch (e) {}
        } catch (e) { console.warn('Failed to spawn repeated patterns', e); }
      } catch (e) { console.warn('Pattern spawn failed', e); }

    } catch (e) { console.warn('startGame failed', e); }
  }

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

  // Pickup debug overlay (toggle with 'P') — draws pickup and player global positions
  let pickupDebug = false;
  const pickupDebugContainer = new Container();
  pickupDebugContainer.zIndex = 20000;
  try { app.stage.addChild(pickupDebugContainer); } catch (e) { try { root.addChild(pickupDebugContainer); } catch (e) {} }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP') {
      pickupDebug = !pickupDebug;
      pickupDebugContainer.visible = pickupDebug;
      L.log('Pickup debug:', pickupDebug);
    }
  });

  // Listen for pickup prefab events and handle score/effects centrally
  try {
    window.addEventListener('pickup', (ev: any) => {
      try {
        const d = ev && ev.detail ? ev.detail : {};
        const x = typeof d.x === 'number' ? d.x : (d && d.pos && d.pos.x) || 0;
        const y = typeof d.y === 'number' ? d.y : (d && d.pos && d.pos.y) || 0;
        try { playCollisionEffectAt(x, y); } catch (e) {}
        try { SoundController.playPickup(); } catch (e) {}
        try { 
          prevScore = score;
          score += 1; 
          scoreText.text = `Score: ${score}`; 
        } catch (e) {}
        // check threshold crossing: every 1000 points grant invulnerability
        try {
          const prevTier = Math.floor((prevScore || 0) / 1000);
          const newTier = Math.floor(score / 1000);
          if (newTier > prevTier) {
            try { activatePowerUp(); } catch (e) {}
          }
        } catch (e) {}
        L.info && L.info('pickup event handled (score updated)', d);
      } catch (e) {}
    });
  } catch (e) {}

  // current root scale (used to keep character 1:1 on screen)
  let currentScale = 1;
  // player moves slightly faster than camera to allow overtaking obstacles
  const PLAYER_SPEED_FACTOR = 1.015;

  app.ticker.add(() => {
    const deltaSec = (app.ticker as any).deltaMS / 1000;

    // If gameplay hasn't been initialized yet (waiting for Play), skip update
    if (!gameplay) return;

    // Update gameplay (camera scroll) first
    const { scroll, speed } = gameplay.update(deltaSec);

    // Make player's run speed slightly faster than camera so player can overtake obstacles
    const playerMoveSpeed = speed * PLAYER_SPEED_FACTOR;
    if (!playerDead) {
      player.worldX += playerMoveSpeed * deltaSec;
    }

    // capture previous bottom for obstacle landing detection
    (app as any).__prevPlayerBottom = player.y + playerRadius;

    // Update player physics and position
    player.update(deltaSec, scroll, speed);
    // Update pattern planes: animate any plane sprites placed inside pattern
    // containers (e.g. from Danger5). This moves the visual sprite from
    // right->left inside the pattern local coords and attempts to update the
    // matching obstacle collider created by MapHandler so players can land.
    try {
      const handler = (gameplay as any)._handler;
      const hw = handler && (handler as any).world ? (handler as any).world : null;
      if (hw) {
        for (const patContainer of (hw as any).children) {
          try {
            for (const child of (patContainer as any).children) {
              try {
                if (child && (child as any).__isPatternPlane) {
                  const ps: any = child;
                  ps.x += (ps.__vx || -220) * deltaSec;

                  // compute platform world-left and top for collider alignment
                  const gw = ps.__platformWidth || ((ps.texture && (ps.texture as any).width) * (ps.scale.x || 1));
                  const gh = ps.__platformHeight || 28;
                  const leftLocal = ps.x - gw * (ps.anchor ? ps.anchor.x : 0);
                  const worldLeft = (patContainer.x || 0) + leftLocal;
                  const worldTop = (patContainer.y || 0) + ps.y - gh;

                  // try to find matching obstacle entry by similar width and nearby x
                  const obstacles = (gameplay as any).getObstacles ? (gameplay as any).getObstacles() : [];
                  for (const o of obstacles) {
                    try {
                      if (!o || !o.sprite) continue;
                      if (Math.abs((o.width || 0) - gw) < 8 && Math.abs((o.x || 0) - worldLeft) < 48) {
                        o.x = worldLeft;
                        o.sprite.x = worldLeft;
                        o.sprite.y = worldTop;
                        break;
                      }
                    } catch (e) {}
                  }
                }
              } catch (e) {}
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    // Pickup collision: check items attached to pattern containers and let
    // the player pick them up when close. Items are stored in `pickups`.
    try {
      if (pickups && pickups.length) {
        // clear debug visuals each frame
        try { if (pickupDebugContainer && pickupDebug) pickupDebugContainer.removeChildren(); } catch (e) {}
        for (let i = pickups.length - 1; i >= 0; i--) {
          const it: any = pickups[i];
          try {
            if (!it || it.collected) { pickups.splice(i, 1); continue; }
            // compute item global position (container origin aligns with visual center)
            const gp = (typeof it.getGlobalPosition === 'function') ? (it.getGlobalPosition() as any) : (it.getSpriteGlobalPosition ? it.getSpriteGlobalPosition() : { x: it.x, y: it.y });
            const itemGlobalX = gp.x;
            const itemGlobalY = gp.y;

            // compute player's global position via sprite (handles Spine)
            let playerGPx = 0, playerGPy = 0;
            try {
              const pg = (player.sprite && (player.sprite as any).getGlobalPosition) ? (player.sprite as any).getGlobalPosition() : null;
              if (pg) { playerGPx = pg.x; playerGPy = pg.y; }
              else { playerGPx = (player.worldX || 0) + (world.x || 0); playerGPy = (player.y || 0) + (world.y || 0); }
            } catch (e) { playerGPx = (player.worldX || 0) + (world.x || 0); playerGPy = (player.y || 0) + (world.y || 0); }

            // Prefer bounding-box intersection (more reliable across containers/spine)
            let collected = false;
            try {
              const itemBounds = it.getBounds();
              let playerBounds: any = null;
              try {
                if (player.sprite && (player.sprite as any).getBounds) {
                  playerBounds = (player.sprite as any).getBounds();
                }
              } catch (e) { playerBounds = null; }

              if (!playerBounds) {
                // fallback to a small square around the player's global position
                playerBounds = { x: playerGPx - playerRadius, y: playerGPy - playerRadius, width: playerRadius * 2, height: playerRadius * 2 };
              }

              const intersects = (a: any, b: any) => {
                return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
              };

              // debug visuals: draw rectangles if enabled
              if (pickupDebug && pickupDebugContainer) {
                try {
                  const dbgItem = new Graphics();
                  dbgItem.lineStyle(2, 0x00ff00, 0.9);
                  dbgItem.drawRect(itemBounds.x, itemBounds.y, itemBounds.width, itemBounds.height);
                  pickupDebugContainer.addChild(dbgItem);

                  const dbgPlayer = new Graphics();
                  dbgPlayer.lineStyle(2, 0xff0000, 0.9);
                  dbgPlayer.drawRect(playerBounds.x, playerBounds.y, playerBounds.width, playerBounds.height);
                  pickupDebugContainer.addChild(dbgPlayer);
                } catch (e) {}
              }

              if (intersects(itemBounds, playerBounds)) {
                collected = true;
              } else {
                if (pickupDebug) L.debug && L.debug('PICKUP: miss bounds', { i, type: it.type, itemBounds, playerBounds });
              }
            } catch (e) {
              // final fallback: radial check
              const PICK_RADIUS = 48 + playerRadius;
              const dx = itemGlobalX - playerGPx;
              const dy = itemGlobalY - playerGPy;
              const dist2 = dx * dx + dy * dy;
              if (dist2 <= PICK_RADIUS * PICK_RADIUS) collected = true;
            }

              if (collected) {
                try {
                  L.debug && L.debug('PICKUP: hit (collected)', { i, type: it.type, itemGlobalX, itemGlobalY });
                  try { if (typeof it.collect === 'function') { it.collect(); } else { if (it.parent) it.parent.removeChild(it); } } catch (e) {}
                  pickups.splice(i, 1);
                } catch (e) {}
              }
          } catch (e) {
            // swallow per-item errors to avoid stopping the loop
          }
        }
      }
    } catch (e) {}

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
            // If this obstacle is not ground, still play collision effect and then Game Over
            try {
              if (!(o as any).isGround) {
                // if player is invincible, ignore obstacle collisions
                if (playerInvincible) {
                  // do nothing
                } else {
                  // play death animation, freeze controls/movement, then effect -> GameOver
                  try { controlsEnabled = false; playerDead = true; player.vy = 0; } catch (e) {}
                  try { if (spinePlayerInstance && spinePlayerInstance.pauseTrack) spinePlayerInstance.pauseTrack(0); } catch (e) {}
                  try { if (spinePlayerInstance && spinePlayerInstance.play) spinePlayerInstance.play('die', false, 0); } catch (e) {}
                  try { if (!(o as any)._hitPlayed) { tryPlayHitSound(); try { (o as any)._hitPlayed = true; } catch (e) {} } } catch (e) {}
                  playCollisionEffectAt(player.worldX, player.y, () => { try { doGameOver && doGameOver('hit-obstacle', true); } catch (e) { try { doGameOver && doGameOver('hit-obstacle'); } catch (e) {} } });
                  return;
                }
              }
            } catch (e) {}
          } else if (currBottom > obstacleTop) {
            // intersecting from side / too low: block forward movement
            player.worldX = Math.min(player.worldX, o.x - playerRadius - 2);
            player.sprite.x = player.worldX;
            try {
              if (!(o as any).isGround) {
                if (playerInvincible) {
                  // ignore
                } else {
                  try { controlsEnabled = false; playerDead = true; player.vy = 0; } catch (e) {}
                  try { if (spinePlayerInstance && spinePlayerInstance.pauseTrack) spinePlayerInstance.pauseTrack(0); } catch (e) {}
                  try { if (spinePlayerInstance && spinePlayerInstance.play) spinePlayerInstance.play('die', false, 0); } catch (e) {}
                  try { if (!(o as any)._hitPlayed) { tryPlayHitSound(); try { (o as any)._hitPlayed = true; } catch (e) {} } } catch (e) {}
                  playCollisionEffectAt(player.worldX, player.y, () => { try { doGameOver && doGameOver('hit-obstacle', true); } catch (e) { try { doGameOver && doGameOver('hit-obstacle'); } catch (e) {} } });
                  return;
                }
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}

    // Detect collisions with non-ground obstacles (play collision effect, then Game Over)
    try {
      const blocking = (gameplay as any).getBlockingObstacle ? (gameplay as any).getBlockingObstacle(player.worldX, player.y, playerRadius) : null;
      if (blocking && !(blocking as any).isGround) {
        try { L.debug && L.debug('Player collided with obstacle', blocking); } catch (e) {}
        try {
          // ignore collision if invincible
          if (!playerInvincible) {
            try { controlsEnabled = false; playerDead = true; player.vy = 0; } catch (e) {}
            try { if (spinePlayerInstance && spinePlayerInstance.pauseTrack) spinePlayerInstance.pauseTrack(0); } catch (e) {}
            try { if (spinePlayerInstance && spinePlayerInstance.play) spinePlayerInstance.play('die', false, 0); } catch (e) {}
            try { if (!(blocking as any)._hitPlayed) { tryPlayHitSound(); try { (blocking as any)._hitPlayed = true; } catch (e) {} } } catch (e) {}
            playCollisionEffectAt(player.worldX, player.y, () => { try { doGameOver && doGameOver('hit-obstacle', true); } catch (e) { try { doGameOver && doGameOver('hit-obstacle'); } catch (e) {} } });
          }
        } catch (e) {}
        return;
      }
    } catch (e) {}

    // Animation policy: RUN only when touching ground colliders, pause when jumping
    try {
      // power-up scale animation removed (no per-frame scale updates)
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
          if (playerDead) {
            // If player is dead, always show the die animation and do not
            // resume/pause other tracks.
            try { if (spinePlayerInstance && spinePlayerInstance.pauseTrack) spinePlayerInstance.pauseTrack(0); } catch (e) {}
            try { if (spinePlayerInstance && spinePlayerInstance.play) spinePlayerInstance.play('die', false, 0); } catch (e) {}
          } else {
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
                  try { L.debug && L.debug('LAND: resuming run animation'); } catch (e) {}
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
    // (kept for safety if player not yet initialized elsewhere)
    try { player.setScreenScale && player.setScreenScale(currentScale); } catch (e) {}

    // update parallax backgrounds and tiled road scrolling
    try { if (cloudBigLayer && cloudBigLayer.update) cloudBigLayer.update(scroll); } catch (e) {}
    try { if (cloudSmallLayer && cloudSmallLayer.update) cloudSmallLayer.update(scroll); } catch (e) {}
    try {
      if (cityLayer && cityLayer.update) cityLayer.update(scroll);
    } catch (e) {}
    // road visuals removed; patterns will handle ground art now.

    // Update label to show camera speed and distance
    label.text = `Speed(cam): ${Math.round(speed)} px/s  Distance: ${Math.floor(scroll)}`;

    // Distance-based scoring: award 15 points per 100px traveled.
    try {
      const newThreshold = Math.floor(scroll / 100);
      if (newThreshold > lastDistanceThreshold) {
        const gainedUnits = newThreshold - lastDistanceThreshold;
        try { prevScore = score; } catch (e) {}
        score += gainedUnits * 15;
        try { scoreText.text = `Score: ${score}`; } catch (e) {}
        lastDistanceThreshold = newThreshold;
        // trigger power-up if we crossed a 1000-point tier
        try {
          const prevTier = Math.floor((prevScore || 0) / 1000);
          const newTier = Math.floor(score / 1000);
          if (newTier > prevTier) {
            try { activatePowerUp(); } catch (e) {}
          }
        } catch (e) {}
      }
    } catch (e) {}

    // Show reward popup when threshold reached (single-shot)
    try {
      if (!rewardShown && typeof score === 'number' && score >= REWARD_THRESHOLD) {
        rewardShown = true;
        rewardActive = true;
        rewardPermanentStop = true;
        try { controlsEnabled = false; } catch (e) {}
        try { app.ticker && app.ticker.stop && app.ticker.stop(); } catch (e) {}
        try {
          // build overlay
          const overlay = new Container();
          overlay.zIndex = 100000;
          overlay.interactive = true;

          const overlayBg = new Graphics();
          try { overlayBg.clear(); overlayBg.beginFill(0x000000, 0.6); overlayBg.drawRect(0, 0, WIDTH, HEIGHT); overlayBg.endFill(); } catch (e) {}
          overlay.addChild(overlayBg);

          const boxW = Math.min(720, WIDTH - 160);
          const boxH = 240;
          const box = new Graphics();
          try { box.clear(); box.beginFill(0xffffff, 1); box.drawRoundedRect((WIDTH - boxW) / 2, (HEIGHT - boxH) / 2, boxW, boxH, 12); box.endFill(); } catch (e) {}
          overlay.addChild(box);

          const titleStyle = new TextStyle({ fill: '#000000', fontSize: 28, fontFamily: 'Helvetica-Bold' });
          const bodyStyle = new TextStyle({ fill: '#333333', fontSize: 18, fontFamily: 'Helvetica' });
          const btnStyle = new TextStyle({ fill: '#ffffff', fontSize: 18, fontFamily: 'Helvetica-Bold' });

          const title = new Text({ text: 'You received a special reward!', style: titleStyle });
          title.x = Math.round((WIDTH - title.width) / 2);
          title.y = Math.round((HEIGHT - boxH) / 2) + 18;
          overlay.addChild(title);

          const body = new Text({ text: 'Congrats — you unlocked a special prize. Claim it now.', style: bodyStyle });
          body.x = Math.round((WIDTH - body.width) / 2);
          body.y = title.y + 48;
          overlay.addChild(body);

          // Get Reward button
          const btnW2 = 220; const btnH2 = 48;
          const btnX = Math.round((WIDTH - btnW2) / 2);
          const btnY = Math.round((HEIGHT + boxH) / 2) - btnH2 - 18;
          const btnG = new Graphics();
          try { btnG.clear(); btnG.beginFill(0xd9534f, 1); btnG.drawRoundedRect(btnX, btnY, btnW2, btnH2, 8); btnG.endFill(); } catch (e) {}
          btnG.interactive = true;
          (btnG as any).buttonMode = true;
          overlay.addChild(btnG);

          const btnText = new Text({ text: 'Get Reward', style: btnStyle });
          btnText.x = btnX + Math.round((btnW2 - btnText.width) / 2);
          btnText.y = btnY + Math.round((btnH2 - btnText.height) / 2);
          overlay.addChild(btnText);

          // Close / Later small button
          const closeW = 120; const closeH = 34;
          const closeX = btnX + btnW2 + 12;
          const closeY = btnY + Math.round((btnH2 - closeH) / 2);
          const closeG = new Graphics();
          try { closeG.clear(); closeG.beginFill(0x888888, 1); closeG.drawRoundedRect(closeX, closeY, closeW, closeH, 8); closeG.endFill(); } catch (e) {}
          closeG.interactive = true;
          const closeText = new Text({ text: 'Later', style: btnStyle });
          closeText.x = closeX + Math.round((closeW - closeText.width) / 2);
          closeText.y = closeY + Math.round((closeH - closeText.height) / 2);
          overlay.addChild(closeG);
          overlay.addChild(closeText);
          

          // Add to root (overlay should be on top)
          // ensure overlay is added to the top-level stage so it truly covers screen
          try { app.stage.addChild(overlay); } catch (e) { try { root.addChild(overlay); } catch (e) {} }

          // handlers
          btnG.on && btnG.on('pointerdown', () => {
            try {
              // open reward link in a new tab (keep overlay visible so player can later resume)
              try { window.open(REWARD_URL, '_blank'); } catch (e) { try { window.location.href = REWARD_URL; } catch (e) {} }
            } catch (e) {}
            // do NOT remove the overlay here; leave it so the player can press 'Later' to resume
            // mark reward claimed; keep game stopped until the player explicitly resumes via 'Later'
            try { rewardClaimed = true; controlsEnabled = false; } catch (e) {}
          });

          closeG.on && closeG.on('pointerdown', () => {
            try { if (overlay.parent) overlay.parent.removeChild(overlay); } catch (e) {}
            // Always allow the player to resume when pressing Later, even if they previously claimed the reward.
            try {
              rewardActive = false;
              rewardPermanentStop = false;
              controlsEnabled = true;
              try { app.ticker && app.ticker.start && app.ticker.start(); } catch (e) {}
            } catch (e) {}
          });

        } catch (e) {}
      }
    } catch (e) {}

    if (debugEnabled) {
      const screenX = player.sprite.x + world.x;
      debug.text = `worldX:${Math.round(player.worldX)} scroll:${Math.round(scroll)} screenX:${Math.round(screenX)}`;
    }

    // ground visuals removed; no road mask needed — patterns will control ground art.
  });

  // Activate the power-up: scale player by 15% slowly, make invulnerable for 5s,
  // blink for the last 1s, then revert scale.
  function activatePowerUp() {
    try {
      if (!player || playerInvincible) return;
      playerInvincible = true;
      // record original scale
      let origScale = 1;
      try {
        if (spinePlayerInstance && typeof (spinePlayerInstance as any).setScale === 'function' && spinePlayerInstance.view && spinePlayerInstance.view.scale) {
          origScale = spinePlayerInstance.view.scale.x || 1;
        } else {
          origScale = (player.sprite && player.sprite.scale) ? (player.sprite.scale.x || 1) : 1;
        }
      } catch (e) { origScale = 1; }
      // persist original scale for later restore (do not assume `1`) - scale restore not needed
      // NOTE: scale-up animation intentionally disabled for now.
      // const targetScale = origScale * 1.8;
      // animate to target over 600ms (disabled)
      // powerScaleFrom = origScale;
      // powerScaleTo = targetScale;
      // powerScaleStart = performance.now();
      // powerScaleDuration = 600;
      // powerScaleTickerActive = true;

      // ensure existing timeouts/intervals cleared
      if (powerTimeout) { clearTimeout(powerTimeout); powerTimeout = null; }
      if (powerBlinkInterval) { clearInterval(powerBlinkInterval); powerBlinkInterval = null; }

      // after 4s start blinking for 1s, then revert
      const totalMs = 10000;
      const blinkStart = totalMs - 1000;

      // schedule blink start
      setTimeout(() => {
        try {
          let visible = true;
          powerBlinkInterval = setInterval(() => {
            try {
              visible = !visible;
              if (player && player.sprite) {
                try { player.sprite.alpha = visible ? 1 : 0.25; } catch (e) {}
              }
            } catch (e) {}
          }, 120);
        } catch (e) {}
      }, blinkStart);

      // schedule end of power-up
      powerTimeout = setTimeout(() => {
        try {
          // stop blinking and restore visibility
          if (powerBlinkInterval) { clearInterval(powerBlinkInterval); powerBlinkInterval = null; }
          if (player && player.sprite) try { player.sprite.alpha = 1; } catch (e) {}
          // scale revert/animation disabled; simply clear invulnerability
          try { playerInvincible = false; } catch (e) {}
        } catch (e) {}
      }, totalMs);
    } catch (e) {}
  }

  // Game over handling (with grace/config)
  const GAME_OVER_GRACE_MS = 400;
  let gameOver = false;
  let gameOverQueuedTimer: ReturnType<typeof setTimeout> | null = null;
  let gameOverQueuedReason: string | null = null;
  let collisionEffectPlaying = false;

  // Restart the gameplay in-place without reloading the page.
  // This clears pickups and spawned pattern containers, resets flags,
  // and re-initializes gameplay by calling `startGame()`.
  async function restartGame() {
    try { SoundController.stopAll(); } catch (e) {}
    try {
      // clear pickups visuals
      for (const it of pickups) {
        try { if (it && it.parent) it.parent.removeChild(it); } catch (e) {}
      }
      pickups.length = 0;
    } catch (e) {}

    try {
      // remove pattern containers we previously spawned
      for (const c of spawnedPatternContainers) {
        try { if (c && c.parent) c.parent.removeChild(c); } catch (e) {}
      }
      spawnedPatternContainers.length = 0;
    } catch (e) {}

    try {
      // reset gameplay if present
      try { if (gameplay && typeof (gameplay.reset) === 'function') gameplay.reset(); } catch (e) {}
      gameplay = null;
      // reset distance scoring tracker
      try { lastDistanceThreshold = 0; } catch (e) {}
    } catch (e) {}

    try {
      // reset world scroll/position
      try { (world as any).x = 0; } catch (e) {}
      // reset player state
      try { player.worldX = PLAYER_X; player.vy = 0; playerDead = false; gameOver = false; controlsEnabled = true; prevScore = 0; score = 0; scoreText.text = `Score: ${score}`; } catch (e) {}
      try { if (player && typeof (player.setScreenScale) === 'function') player.setScreenScale && player.setScreenScale(1); } catch (e) {}
    } catch (e) {}

    // start a fresh game instance
    try { await startGame(); } catch (e) { console.warn('restartGame: startGame failed', e); }
  }

  // Controls disabled until user starts the game from the start screen
  let controlsEnabled = false;
  let playerDead = false;

  function playCollisionEffectAt(wx: number, wy: number, onComplete?: () => void) {
    try {
      if (collisionEffectPlaying) return;
      collisionEffectPlaying = true;
      const tex = Texture.from('/Assets/_arts/effect_va cham.png');
      const eff = new Sprite(tex as any);
      eff.anchor && (eff as any).anchor?.set ? (eff as any).anchor.set(0.5, 0.5) : null;
      eff.x = wx;
      eff.y = wy;
      try { eff.zIndex = 2000; } catch (e) {}
      try { world.addChild(eff); } catch (e) { root.addChild(eff); }
      try { eff.scale.set(0.8, 0.8); eff.alpha = 1; } catch (e) {}
      const start = (performance && performance.now) ? performance.now() : Date.now();
      const dur = 520;
      let rafId: number | null = null;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        try { eff.scale.set(0.8 + 0.6 * eased, 0.8 + 0.6 * eased); } catch (e) {}
        try { eff.alpha = 1 - eased; } catch (e) {}
        if (t < 1) rafId = requestAnimationFrame(step);
        else {
          try { if (eff.parent) eff.parent.removeChild(eff); } catch (e) {}
          rafId = null;
          collisionEffectPlaying = false;
          try { if (typeof onComplete === 'function') onComplete(); } catch (e) {}
        }
      };
      rafId = requestAnimationFrame(step);
    } catch (e) {
      collisionEffectPlaying = false;
      try { if (typeof onComplete === 'function') onComplete(); } catch (e) {}
    }
  }

  // Spawn multiple image sprites at a world position and animate each to
  // scale outward (e.g. up to 2x) with a small stagger and fade-out.
  // - imagePaths: array of texture paths (e.g. ['/Assets/_arts/effect_va cham.png'])
  // - options: { count, duration, stagger, startScale, endScale }
 
  function doGameOver(finalReason?: string, force = false) {
    // If reward overlay is active or the reward stopped the game permanently, suppress Game Over
    try { if (rewardActive || rewardPermanentStop) return; } catch (e) {}
    if (gameOver) return;
    // Protect against false positives: if the player is currently on a
    // registered pattern and appears grounded, suppress the Game Over.
    try {
      if (!force) {
        const handler = (gameplay as any)._handler;
        const onPattern = handler && handler.isOnPattern ? handler.isOnPattern(player.worldX) : false;
        if (onPattern && player && player.onGround) {
          L.debug && L.debug('Suppressing GameOver: player still on pattern', { finalReason, worldX: player.worldX, onPattern });
          return;
        }
      }
    } catch (e) {}

    gameOver = true;
    L.log('GameOver triggered:', finalReason ?? gameOverQueuedReason ?? 'unknown');

    // Pause Spine animation if available
    try { if (spinePlayerInstance && spinePlayerInstance.pauseTrack) spinePlayerInstance.pauseTrack(0); } catch (e) {}

    try {
      showGameOver({ app, root, canvas, onPlayAgain: () => { try { restartGame(); } catch (e) { try { window.location.reload(); } catch (e) { try { location.reload(); } catch (e) {} } } } });
    } catch (e) {}
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
            L.log('GameOver canceled (player returned to pattern):', reason);
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
        } else if (screenY > HEIGHT + 500) {
          
          queueGameOver('fell_offscreen');
      } else {
        if (gameOverQueuedTimer && gameOverQueuedReason === 'behind-camera') {
          try { gameOverQueuedReason; } catch (e) {}
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
    // Scale so the game occupies ~90% of the available viewport
    // (keeps aspect, fits within both dimensions)
    let scale = Math.min((sw * 0.65) / WIDTH, (sh * 0.65) / HEIGHT);
    scale = Math.min(scale, 1);

    root.scale.set(scale, scale);
    // store current scale for other modules (character counter-scaling)
    currentScale = scale;
    root.x = (sw - WIDTH * scale) / 2;
    root.y = (sh - HEIGHT * scale) / 2;
    // Call player counter-scaling on resize so sprite stays 1:1 on screen
    try { if (player && (player as any).setScreenScale) (player as any).setScreenScale(currentScale); } catch (e) {}
  }

  updateScale();

  // Start the game immediately (no start screen). Enable controls and start background audio.
  try { await startGame(); } catch (e) { console.warn('startGame failed at init', e); }
  try { controlsEnabled = true; } catch (e) {}

  function onResize() {
    applyCanvasCssSize();
    updateScale();
  }

  // also react to fullscreen changes
  window.addEventListener('fullscreenchange', () => {
    try { onResize(); } catch (e) {}
  });

  // Watch for devicePixelRatio changes (some browsers don't fire resize on zoom)
  let _lastDPR = window.devicePixelRatio;
  const _dprWatcher = setInterval(() => {
    const dpr = window.devicePixelRatio;
    if (dpr !== _lastDPR) {
      _lastDPR = dpr;
      try { onResize(); } catch (e) {}
    }
  }, 500);

  // clear watcher when page unloads
  window.addEventListener('beforeunload', () => { try { clearInterval(_dprWatcher); } catch (e) {} });

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
