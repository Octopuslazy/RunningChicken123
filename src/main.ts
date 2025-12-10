import { Application, Sprite, Assets, Graphics, Text, TextStyle, Container, Texture } from 'pixi.js';
import { SpinePlayer } from './SpinePlayer';
import { createCharacter } from './character';
import { createGameplay } from './gameplay';
import { loadTexture, loadGameAssets } from './assetLoader';
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

const LOG_DEBUG = false;
const L = {
  log: (...args: any[]) => { if (LOG_DEBUG) console.log(...args); },
  debug: (...args: any[]) => { if (LOG_DEBUG) console.debug(...args); },
  info: (...args: any[]) => { if (LOG_DEBUG) console.info(...args); }
};

const CHARACTER_SCALE_FACTOR = 0.6;

const app = new Application();

async function init() {
  await (app as any).init({
    width: WIDTH,
    height: HEIGHT,
    background: 0x1099bb,
    resizeTo: window
  });

  // --- SỬA LỖI TẠI ĐÂY ---
  // BẮT BUỘC: Nạp toàn bộ tài nguyên (Spine, Ảnh, Nhạc) vào RAM trước tiên!
  // Nếu không có dòng này, mọi lệnh loadTexture hay SpinePlayer ở dưới đều sẽ gây lỗi CORS.
  
      await loadGameAssets();
  
  // -----------------------

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

  // Parallax city background
  let cityLayer: { container: import('pixi.js').Container; update: (scroll: number) => void; tileWidth: number; } | null = null;
  try {
    // Bây giờ Assets đã có dữ liệu, lệnh này sẽ chạy ngon lành
    const cityTex = await loadTexture('/Assets/_arts/bg_3_city.png');
    if (cityTex) {
      const container = new Container();
      root.addChildAt(container, 0);
      const tileW = cityTex.width || WIDTH;
      const bgScale = 4;
      const desiredY = HEIGHT - (cityTex.height || 200) - 800;
      container.y = desiredY;
      container.scale.set(bgScale, bgScale);
      const needed = Math.ceil((WIDTH * 2) / (tileW * bgScale)) + 4;
      for (let i = 0; i < needed; i++) {
        const s = new Sprite(cityTex as any);
        s.x = i * tileW;
        s.y = 0;
        s.anchor.set(0, 0);
        container.addChild(s);
      }
      function updateCity(scroll: number) {
        const parallaxFactor = 0.45;
        const effectiveTileW = tileW * bgScale;
        const offset = -((scroll * parallaxFactor) % effectiveTileW);
        container.x = offset;
      }
      cityLayer = { container, update: updateCity, tileWidth: tileW };
    }
  } catch (e) { cityLayer = null; }
  

  // Parallax cloud layers
  let cloudBigLayer: { container: import('pixi.js').Container; update: (scroll: number) => void; tileWidth: number; } | null = null;
  let cloudSmallLayer: { container: import('pixi.js').Container; update: (scroll: number) => void; tileWidth: number; } | null = null;
  try {
    const bigTex = await loadTexture('/Assets/_arts/bg_4_cloudbig.png');
    if (bigTex) {
      const c = new Container();
      try { root.addChildAt(c, 1); } catch (e) { root.addChild(c); }
      const tileW = bigTex.width || WIDTH;
      const gapFraction = 0.25;
      const extendedTileW = tileW * (2 + gapFraction);
      const needed = Math.ceil((WIDTH * 2) / extendedTileW) + 4;
      for (let i = 0; i < needed; i++) {
        const s = new Sprite(bigTex as any);
        s.x = i * extendedTileW;
        s.y = 40;
        s.anchor.set(0, 0);
        c.addChild(s);
      }
      function updateBig(scroll: number) {
        const parallaxFactor = 0.25;
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
      try { root.addChildAt(c, 2); } catch (e) { root.addChild(c); }
      const tileW = smallTex.width || WIDTH;
      const gapFractionS = 0.18;
      const extendedTileWS = tileW * (5 + gapFractionS);
      const needed = Math.ceil((WIDTH * 2) / extendedTileWS) + 4;
      for (let i = 0; i < needed; i++) {
        const s = new Sprite(smallTex as any);
        s.x = i * extendedTileWS;
        s.y = 100;
        s.anchor.set(0, 0);
        c.addChild(s);
      }
      function updateSmall(scroll: number) {
        const parallaxFactor = 0.6;
        const offset = -((scroll * parallaxFactor) % extendedTileWS);
        c.x = offset;
      }
      cloudSmallLayer = { container: c, update: updateSmall, tileWidth: tileW };
    }
  } catch (e) { cloudSmallLayer = null; }

  const groundY = HEIGHT + 1200;

  const style = new TextStyle({
    fill: '#ffffff',
    fontSize: 36,
    fontFamily: 'Helvetica-Bold'
  });
  const label = new Text({ text: 'Running Chicken - Pixi v8', style: style });
  label.x = 140;
  label.y = 20;
  root.addChild(label);

  try {
    let soundEnabled = true; // Mặc định sound ON
    const soundToggle = new Container();
    const btnW = 120; const btnH = 36;
    const btn = new Graphics();
    try { btn.clear(); btn.beginFill(0x000000, 0.45); btn.drawRoundedRect(0, 0, btnW, btnH, 6); btn.endFill(); } catch (e) {}
    const lblStyle = new TextStyle({ fill: '#ffffff', fontSize: 16, fontFamily: 'Helvetica-Bold' });
    const lbl = new Text({ text: 'Sound: On', style: lblStyle }); // Hiển thị Sound: On mặc định
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

  const PLAYER_X = 150;
  const playerRadius = 40; // Giảm từ 20 xuống 15 để tránh va chạm sai
  const PLAYER_SPAWN_LIFT = 80;
  let player: any = null;
  
  // Debug hitbox - circle
  const debugHitbox = new Graphics();
  debugHitbox.circle(0, 0, playerRadius)
    .fill({ color: 0xff0000, alpha: 0.3 })
    .stroke({ color: 0xff0000, width: 3 });
  debugHitbox.alpha = 0.8;
  
  // Tạo nhân vật với graphics fallback trước - sẽ được thay thế bằng spine
  console.log('Creating initial character with red circle fallback');
  player = createCharacter({ 
    PLAYER_X, 
    playerRadius, 
    groundY: groundY - PLAYER_SPAWN_LIFT, 
    texture: undefined, // Dùng graphics trước
    jumpSpeed: 1400, 
    gravity: 4000, 
    screenScale: 0.8 * CHARACTER_SCALE_FACTOR 
  });

  player.worldX = PLAYER_X;
  player.y = groundY - PLAYER_SPAWN_LIFT - playerRadius;
  
  // Đảm bảo sprite visible và có alpha
  player.sprite.visible = true;
  player.sprite.alpha = 1;
  
  // Thêm debug hitbox
  try { root.addChild(debugHitbox); } catch (e) { app.stage.addChild(debugHitbox); }
  player.sprite.x = PLAYER_X;
  
  // Add initial sprite to world with debug
  console.log('Adding initial red circle to world');
  world.addChild(player.sprite);
  player.sprite.y = player.y;
  
  world.addChild(player.sprite);
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
    try { (player.sprite as any).off && (player.sprite as any).off('pointerdown'); } catch (e) {}
    try { (player.sprite as any).on && (player.sprite as any).on('pointerdown', () => { if (!controlsEnabled) return; try { (player as any).jump(); } catch (e) {} }); } catch (e) {}
  } catch (e) {}
  try {
    (player.sprite as any).visible = true;
    (player.sprite as any).alpha = 1;

  } catch (e) {}

  let spinePlayerInstance: any = null;
  let defaultAnim: string | null = null;

 
  async function reloadSpineAnimations() {
    try {
      
      if (spinePlayerInstance?.view) {
        try { world.removeChild(spinePlayerInstance.view); } catch(e){}
      }
      
      const sp = new SpinePlayer('kfc_chicken');
      
      // Use PIXI Assets-based loading method
      await sp.loadFromAssetLoader();
      
      if (!sp.view) {
        throw new Error('SpinePlayer.view is null after load!');
      }
      
      // Tăng scale để thấy rõ hơn  
      const finalScale = 3.0 * CHARACTER_SCALE_FACTOR; // Tăng lên 3.0
      sp.setScale(finalScale);
      sp.setPosition(player.worldX, player.y);
      
      // FORCE remove old sprite
      console.log('Removing old sprite, current sprite type:', player.sprite.constructor.name);
      try { 
        world.removeChild(player.sprite); 
        console.log('Old sprite removed successfully');
      } catch(e){
        console.error('Failed to remove old sprite:', e);
      }
      
      // Gán sprite mới và thêm vào world
      console.log('Replacing with spine view, type:', sp.view.constructor.name);
      player.sprite = sp.view;
      player.sprite.visible = true;
      player.sprite.alpha = 1;
      player.sprite.x = player.worldX;
      player.sprite.y = player.y;
      player.sprite.zIndex = 5000;
      
      world.addChild(player.sprite);
      console.log('New spine sprite added to world');
      world.sortableChildren = true;
      
      spinePlayerInstance = sp;
      
      // DEBUG: Kiểm tra chi tiết Spine view
      const slotsWithAttachments = sp.spine?.skeleton?.slots?.filter((slot: any) => slot.attachment).length || 0;
      
      // CRITICAL DEBUG: Check if any slots have attachments
      if (slotsWithAttachments === 0) {
      } else {
      }
      
      // FORCE render update
      try {
        if (sp.spine && sp.spine.update) {
          sp.spine.update(0.016); // Force 60fps update
        }
      } catch (e) {}
      
      // DEBUG: Check spine bounds
      try {
        const bounds = sp.view.getBounds ? sp.view.getBounds() : null;
        const hasSize = bounds && (bounds.width > 0 || bounds.height > 0);
        
        console.log('Spine Bounds Check:', {
          hasBounds: !!bounds,
          width: bounds?.width || 0,
          height: bounds?.height || 0,
          hasSize: hasSize
        });
        
        // Force use spine even if bounds are 0 (bounds might be calculated after first render)
        // Don't create emergency fallback
        
      } catch (e) {
        console.error('Spine bounds check error:', e);
      }      // Chạy animation mặc định
      try { 
        const playResult = sp.play('run', true, 0);
        
        // Kiểm tra animation state
        if (sp.spine && sp.spine.state) {
          const current = sp.spine.state.getCurrent(0);
        }
      } catch (e) { 
      }

      
      // FORCE nhân vật lên vị trí có thể nhìn thấy
      const visibleY = HEIGHT / 2; // Giữa màn hình
      
      player.y = visibleY;
      player.sprite.y = visibleY;
      player.sprite.x = player.worldX;
      
      // Đảm bảo Spine sprite có zIndex cao
      player.sprite.zIndex = 5000;
      world.sortableChildren = true;

      
      // FINAL DEBUG: Check skeleton render state
      if (sp.spine && sp.spine.skeleton) {
        const skeleton = sp.spine.skeleton;
        const attachedSlots = skeleton.slots?.filter((slot: any) => slot.attachment).length || 0;
        
        // EMERGENCY: If no attachments, try multiple approaches
        if (attachedSlots === 0) {
          
          // Method 1: Try default skin
          try {
            if (skeleton.data && skeleton.data.defaultSkin) {
              skeleton.setSkin(skeleton.data.defaultSkin);
              skeleton.setSlotsToSetupPose();
            }
          } catch (e) {
          }
          
          // Method 2: Manual attachment restoration
          try {
            if (skeleton.slots && skeleton.data && skeleton.data.defaultSkin) {
              const skin = skeleton.data.defaultSkin;
              skeleton.slots.forEach((slot: any, i: number) => {
                if (slot && !slot.attachment && slot.data) {
                  try {
                    const slotData = slot.data;
                    if (slotData.attachmentName) {
                      const attachment = skin.getAttachment ? skin.getAttachment(slotData.index, slotData.attachmentName) : null;
                      if (attachment) {
                        slot.attachment = attachment;
                      }
                    }
                  } catch (e) {}
                }
              });
            }
          } catch (e) {
          }
          
          // Method 3: Force first skin if available
          try {
            if (skeleton.data && skeleton.data.skins && skeleton.data.skins.length > 0) {
              const firstSkin = skeleton.data.skins[0];
              skeleton.setSkin(firstSkin);
              skeleton.setSlotsToSetupPose();
            }
          } catch (e) {
          }
          
          // Final check
          const newAttached = skeleton.slots?.filter((slot: any) => slot.attachment).length || 0;
        }
      }
    } catch (e) { 
      // Nếu Spine fail, tạo sprite đỏ to để debug
      try {
        const debugSprite = new Graphics();
        debugSprite.circle(0, 0, 40).fill({ color: 0x00ff00 }); // Vòng tròn xanh lá
        debugSprite.x = player.worldX;
        debugSprite.y = player.y;
        debugSprite.zIndex = 6000;
        
        try { world.removeChild(player.sprite); } catch(e){}
        player.sprite = debugSprite;
        world.addChild(player.sprite);
        world.sortableChildren = true;
      } catch (e2) {
      }
    }
  }

  let gameplay: any = null;
  let backgroundStarted = false;
  
  // Tự động bật nhạc nền khi khởi động game
  try {
    SoundController.playBackgroundForced(300);
    backgroundStarted = true;
  } catch (e) {
    try { SoundController.playBackground(); } catch (e) {}
  }

  const pickups: any[] = [];
  const spawnedPatternContainers: any[] = [];
  let score = 0;
  let prevScore = 0;
  let lastDistanceThreshold = 0;
  const REWARD_URL = 'https://leapstud.io/';
  const REWARD_THRESHOLD = 1500;
  let rewardShown = false;
  let rewardActive = false;
  let rewardPermanentStop = false;
  let rewardClaimed = false;
  // Removed invincible and blinking code
  const scoreStyle = new TextStyle({ fill: '#ffffff', fontSize: 56, fontFamily: 'Helvetica-Bold', fontWeight: 'bold' });
  const scoreText = new Text({ text: 'Score: 0', style: scoreStyle });
  scoreText.x = WIDTH - 320;
  scoreText.y = 8;
  root.addChild(scoreText);

  let _lastHitSoundAt = 0;
  function tryPlayHitSound() {
    try {
      const now = Date.now();
      const MIN_MS = 800;
      if (now - _lastHitSoundAt < MIN_MS) return;
      _lastHitSoundAt = now;
      try { SoundController.playHit(); } catch (e) {}
    } catch (e) {}
  }

  try {
    // Pre-load các texture cần thiết
    try { await loadTexture('/Assets/_arts/bg_1_groundmid.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_1_groundleft.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_1_groundright.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_1_store3.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_1_light.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/effect_double jump.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_2_bush.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_2_tree.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_1_billboard.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/effect_va cham.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_1_wheels.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_1_store1.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_1_store2.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_1_standee2.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_3_plane.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/icon_timer.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/obj_0.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/obj_1.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/obj_2.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/obj_3.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/obj_4.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/obj_5.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/obj_6.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/obs_1.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/obs_2.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/obs_3.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/score.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_1_standee1.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/gameover.jpg'); } catch (e) {}
    // try { await loadTexture('/Assets/Arts/anim/kfc_chicken.png'); } catch (e) {}
  } catch (e) {}

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
          try {
            if (did && spinePlayerInstance && spinePlayerInstance.pauseTrack) {
              spinePlayerInstance.pauseTrack(0);
            }
          } catch (e) {}
        } catch (err) {}
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      spaceHeld = false;
      try { if ((player as any).endJumpHold) (player as any).endJumpHold(); } catch (err) {}
    }
  });

  window.addEventListener('pointerdown', (e) => {
    if (!pointerHeld) {
      pointerHeld = true;
      try {
        if (!controlsEnabled) return;
        const did = (player as any).startJumpHold ? (player as any).startJumpHold() : (player as any).jump();
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

  async function startGame() {
    try {
      // Khởi tạo gameplay trước
      try {
        gameplay = createGameplay({ world, bg, label, WIDTH, HEIGHT, groundY, initialSpeed: 200, speedAccel: 8, patternYOffset: -1000, patternGroundThickness: 160, patternObstaclePadding: 24 });
        try { (gameplay as any)._handler.allowRandomObstacles = false; } catch (e) {}
      } catch (e) {}

      // Tạo patterns sau khi đã có gameplay
      try {
        const handler = (gameplay as any)._handler;

        const patterns: any[] = [];
        const NUM_PATTERNS = 200;
        const PIT_WIDTH = 300;

        const PATTERN_LENGTH = 750;
        const PROB_USE_DANGER = 0.70;
        const PROB_USE_DANGER_AFTER = 0.85;
        const DANGER_WEIGHTS = { d1: 0.3, d2: 0.2, d3: 0.3, d4: 0.2, d5: 0.3 };
        const DANGER3_LENGTH = 300;
        const DANGER4_LENGTH = 1200;
        const DISTANCE_NORMAL_START = 4500;

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
            if (r < t1) { factory = makeDanger1({ leftEnd: true, rightEnd: true, length }); }
            else if (r < t2) { factory = makeDanger2({ leftEnd: true, rightEnd: true, length }); }
            else if (r < t3) { factory = makeDanger4({ leftEnd: true, rightEnd: true, length: DANGER4_LENGTH }); }
            else if (r < t4) { factory = makeDanger3({ leftEnd: true, rightEnd: true, length: DANGER3_LENGTH }); }
            else { factory = makeDanger5({ leftEnd: true, rightEnd: true, length }); }
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

          let visualLength = p && p.container ? (() => {
            try { const b = p.container.getLocalBounds(); return b.width || p.length; } catch (e) { return p.length; }
          })() : (p ? p.length : length);

          if (i < NUM_PATTERNS - 1) {
            try { (gameplay as any).getPits().push({ x: cursorX + visualLength, width: PIT_WIDTH }); } catch (e) {}
          }

          cursorX += visualLength;
          if (i < NUM_PATTERNS - 1) cursorX += PIT_WIDTH;
        }


        
        // Setup handler debug keys
        try {
          if (handler) {
            try { handler.toggleHitboxes(); } catch (e) {}
            try {
              if (player && (player as any).getGroundY === undefined) {
                (player as any).getGroundY = (wx: number) => {
                  try { return handler.getSurfaceYAt(wx); } catch (e) { return groundY; }
                };
              }
            } catch (e) {}
            window.addEventListener('keydown', (ev) => {
              if (ev.code === 'KeyH') {
                try { 
                  const newState = handler.toggleHitboxes();

                } catch (e) {}
              }
            });
          }
        } catch (e) {}

        // Định vị lại player trên pattern đầu tiên
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
            try { 
              player.sprite.x = player.worldX;
              player.sprite.y = player.y; 
            } catch (e) {}

          } else {
          }
        } catch (e) {
        }
      } catch (e) {}
      
      // Load Spine animation - DEBUG ENHANCED
      try { 
        await reloadSpineAnimations(); 
      } catch (e) { 
      }
      
      try { SoundController.init('/Assets/Sounds/'); SoundController.resumeOnUserGesture(); } catch (e) {}
      
      try {
        if (!backgroundStarted) {
          try { SoundController.playBackgroundForced(300); } catch (e) { try { SoundController.playBackground(); } catch (e) {} }
          backgroundStarted = true;
        }
      } catch (e) {}
      
    } catch (e) {}
  }

  const debugStyle = new TextStyle({ fill: '#ffff00', fontSize: 18 });
  const debug = new Text({ text: 'DEBUG', style: debugStyle });
  debug.x = 10;
  debug.y = 60;
  debug.visible = false;
  root.addChild(debug);
  
  // Player marker removed - no more red circle debug marker
  let debugEnabled = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyD') {
      debugEnabled = !debugEnabled;
      debug.visible = debugEnabled;
    }
  });

  let pickupDebug = false;
  const pickupDebugContainer = new Container();
  pickupDebugContainer.zIndex = 20000;
  try { app.stage.addChild(pickupDebugContainer); } catch (e) { try { root.addChild(pickupDebugContainer); } catch (e) {} }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP') {
      pickupDebug = !pickupDebug;
      pickupDebugContainer.visible = pickupDebug;

    }
  });

  try {
    window.addEventListener('pickup', (ev: any) => {
      try {
        const d = ev && ev.detail ? ev.detail : {};
        const x = typeof d.x === 'number' ? d.x : (d && d.pos && d.pos.x) || 0;
        const y = typeof d.y === 'number' ? d.y : (d && d.pos && d.pos.y) || 0;
        try { playCollisionEffectAt(x, y); } catch (e) {}
        try { SoundController.playPickup(); } catch (e) {}
        try {
          // Chỉ cộng điểm khi game chưa over
          if (!playerDead && !gameOver) {
            prevScore = score;
            score += 1; 
            scoreText.text = `Score: ${score}`; 
          }
        } catch (e) {}
        // Power-up tier system removed

      } catch (e) {}
    });
  } catch (e) {}

  let currentScale = 1;
  const PLAYER_SPEED_FACTOR = 1.015;

    app.ticker.add(() => {
    const deltaSec = (app.ticker as any).deltaMS / 1000;

    if (!gameplay) return;
    
    // CRITICAL: Update Spine animation in render loop
    try {
      if (spinePlayerInstance && spinePlayerInstance.spine) {
        spinePlayerInstance.spine.update(deltaSec);
        // Also ensure view is visible and positioned correctly
        if (spinePlayerInstance.view && player.sprite === spinePlayerInstance.view) {
          spinePlayerInstance.view.x = player.worldX;
          spinePlayerInstance.view.y = player.y;
        }
      }
    } catch (e) {
      // Silent fail to avoid spam
    }    const { scroll, speed } = gameplay.update(deltaSec);

    const playerMoveSpeed = speed * PLAYER_SPEED_FACTOR;
    if (!playerDead) {
      player.worldX += playerMoveSpeed * deltaSec;
    }

    // Kiểm tra player có ra khỏi màn hình bên trái không
    try {
      if (!playerDead && !gameOver) {
        const playerScreenX = player.worldX + (world.x || 0);
        const leftBoundary = -playerRadius; // Cho phép player ra ngoài một chút trước khi game over
        
        if (playerScreenX < leftBoundary) {
          console.log('Player went off screen left, game over!');
          try { controlsEnabled = false; playerDead = true; player.vy = 0; } catch (e) {}
          try { if (spinePlayerInstance && spinePlayerInstance.pauseTrack) spinePlayerInstance.pauseTrack(0); } catch (e) {}
          try { if (spinePlayerInstance && spinePlayerInstance.play) spinePlayerInstance.play('die', false, 0); } catch (e) {}
          try { doGameOver && doGameOver('fell-behind', true); } catch (e) { 
            try { doGameOver && doGameOver('fell-behind'); } catch (e) {} 
          }
        }
      }
    } catch (e) {
      console.error('Error checking left boundary:', e);
    }

    (app as any).__prevPlayerBottom = player.y + playerRadius;

    player.update(deltaSec, scroll, speed);
    
    // Update debug hitbox position
    debugHitbox.x = player.worldX + (world.x || 0);
    debugHitbox.y = player.y;
    
    
   
    
    const playerScreenX = player.worldX + (world.x || 0);
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

                  const gw = ps.__platformWidth || ((ps.texture && (ps.texture as any).width) * (ps.scale.x || 1));
                  const gh = ps.__platformHeight || 28;
                  
                  // Sử dụng plane local position thay vì world position để tránh tọa độ quá lớn
                  const planeLocalCenterX = ps.x; // Local position trong pattern
                  const planeLocalTopY = ps.y;
                  
                  // Tính obstacle position relative to pattern, không dùng world coordinates
                  const obstacleLocalLeft = planeLocalCenterX - gw / 2;

                  const obstacles = (gameplay as any).getObstacles ? (gameplay as any).getObstacles() : [];
                  for (const o of obstacles) {
                    try {
                      if (!o || !o.sprite) continue;
                      if ((o as any).isPlane && Math.abs((o.width || 0) - gw) < 8) {
                        // Tính world position - chỉ update X, giữ nguyên Y từ Danger5.ts
                        const worldLeft = (patContainer.x || 0) + obstacleLocalLeft;
                        // Sử dụng Y position đã được set trong pattern creation (từ Danger5.ts)
                        const originalY = (patContainer.y || 0) + (ps.__platformY || ps.y);
                        
                        // Update obstacle stored position
                        o.x = worldLeft;
                        // Update visual debug hitbox position - chỉ X di chuyển, Y cố định từ Danger5
                        o.sprite.x = worldLeft;
                        o.sprite.y = originalY;
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

    try {
      if (pickups && pickups.length) {
        try { if (pickupDebugContainer && pickupDebug) pickupDebugContainer.removeChildren(); } catch (e) {}
        for (let i = pickups.length - 1; i >= 0; i--) {
          const it: any = pickups[i];
          try {
            if (!it || it.collected) { pickups.splice(i, 1); continue; }
            const gp = (typeof it.getGlobalPosition === 'function') ? (it.getGlobalPosition() as any) : (it.getSpriteGlobalPosition ? it.getSpriteGlobalPosition() : { x: it.x, y: it.y });
            const itemGlobalX = gp.x;
            const itemGlobalY = gp.y;

            let playerGPx = 0, playerGPy = 0;
            try {
              const pg = (player.sprite && (player.sprite as any).getGlobalPosition) ? (player.sprite as any).getGlobalPosition() : null;
              if (pg) { playerGPx = pg.x; playerGPy = pg.y; }
              else { playerGPx = (player.worldX || 0) + (world.x || 0); playerGPy = (player.y || 0) + (world.y || 0); }
            } catch (e) { playerGPx = (player.worldX || 0) + (world.x || 0); playerGPy = (player.y || 0) + (world.y || 0); }

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
                playerBounds = { x: playerGPx - playerRadius, y: playerGPy - playerRadius, width: playerRadius * 2, height: playerRadius * 2 };
              }

              const intersects = (a: any, b: any) => {
                return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
              };

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

              }
            } catch (e) {
              const PICK_RADIUS = 48 + playerRadius;
              const dx = itemGlobalX - playerGPx;
              const dy = itemGlobalY - playerGPy;
              const dist2 = dx * dx + dy * dy;
              if (dist2 <= PICK_RADIUS * PICK_RADIUS) collected = true;
            }

              if (collected) {
                try {

                  try { if (typeof it.collect === 'function') { it.collect(); } else { if (it.parent) it.parent.removeChild(it); } } catch (e) {}
                  pickups.splice(i, 1);
                } catch (e) {}
              }
          } catch (e) {
          }
        }
      }
    } catch (e) {}

    try {
      const obstacles = (gameplay as any).getObstacles ? (gameplay as any).getObstacles() : [];
      for (const o of obstacles) {
        const left = o.x;
        const right = o.x + o.width;
        if (player.worldX + playerRadius > left && player.worldX - playerRadius < right) {
          const obstacleTop = o.sprite.y;
          const prevBottom = (app as any).__prevPlayerBottom !== undefined ? (app as any).__prevPlayerBottom : (player.y + playerRadius);
          const currBottom = player.y + playerRadius;
          if (prevBottom <= obstacleTop && currBottom >= obstacleTop && player.vy >= 0) {
            player.y = obstacleTop - playerRadius;
            player.vy = 0;
            player.onGround = true;
            try { if ((player as any).maxJumps !== undefined) (player as any).jumpsLeft = (player as any).maxJumps; } catch (e) {}
            player.sprite.y = player.y;
            try {
              if (!(o as any).isGround) {
                try { controlsEnabled = false; playerDead = true; player.vy = 0; } catch (e) {}
                try { if (spinePlayerInstance && spinePlayerInstance.pauseTrack) spinePlayerInstance.pauseTrack(0); } catch (e) {}
                try { if (spinePlayerInstance && spinePlayerInstance.play) spinePlayerInstance.play('die', false, 0); } catch (e) {}
                try { if (!(o as any)._hitPlayed) { tryPlayHitSound(); try { (o as any)._hitPlayed = true; } catch (e) {} } } catch (e) {}
                playCollisionEffectAt(player.worldX, player.y, () => { try { doGameOver && doGameOver('hit-obstacle', true); } catch (e) { try { doGameOver && doGameOver('hit-obstacle'); } catch (e) {} } });
                return;
              }
            } catch (e) {}
          } else if (currBottom > obstacleTop) {
            player.worldX = Math.min(player.worldX, o.x - playerRadius - 2);
            player.sprite.x = player.worldX;
            try {
              if (!(o as any).isGround) {
                try { controlsEnabled = false; playerDead = true; player.vy = 0; } catch (e) {}
                try { if (spinePlayerInstance && spinePlayerInstance.pauseTrack) spinePlayerInstance.pauseTrack(0); } catch (e) {}
                try { if (spinePlayerInstance && spinePlayerInstance.play) spinePlayerInstance.play('die', false, 0); } catch (e) {}
                try { if (!(o as any)._hitPlayed) { tryPlayHitSound(); try { (o as any)._hitPlayed = true; } catch (e) {} } } catch (e) {}
                playCollisionEffectAt(player.worldX, player.y, () => { try { doGameOver && doGameOver('hit-obstacle', true); } catch (e) { try { doGameOver && doGameOver('hit-obstacle'); } catch (e) {} } });
                return;
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}

    try {

      // One-way platform collision check cho máy bay - truyền thêm velocity
      const blocking = (gameplay as any).getBlockingObstacle ? (gameplay as any).getBlockingObstacle(player.worldX, player.y, playerRadius, player.vy) : null;
      if (blocking && !(blocking as any).isGround) {
        
        if ((blocking as any).isPlane) {
          // --- LOGIC ĐƠN GIẢN CHO MÁY BAY DỰA TRÊN ĐỘ CAO ---
          
          const planeTop = blocking.sprite.y;
          const planeBottom = planeTop + blocking.height;
          const playerTop = player.y - playerRadius;
          const playerBottom = player.y + playerRadius;
          
          // 1. Nếu cạnh dưới của plane cao hơn hitbox của player
          // → player đi qua bình thường (không bị đẩy)
          if (planeBottom < playerTop) {
            return; // Không có collision, player đi qua
          }
          
          // 2. Nếu hitbox player cao hơn cạnh trên của plane
          // → player đứng trên máy bay
          if (playerBottom > planeTop && playerTop < planeTop) {
            try {
              player.y = planeTop - playerRadius;  // Đặt player lên trên máy bay
              player.vy = 0;                       // Dừng rơi
              player.onGround = true;              // Cho phép nhảy tiếp
            } catch (e) {}
            return;
          }
          
          // 3. Kiểm tra collision thực tế trước khi đẩy (sử dụng stored position)
          const planeLeft = blocking.x; // Left edge đã được update chính xác
          const planeRight = blocking.x + blocking.width;
          const playerLeft = player.worldX - playerRadius;
          const playerRight = player.worldX + playerRadius;
          
          // Chỉ đẩy nếu có overlap thực tế theo trục X và Y
          const hasHorizontalOverlap = (playerRight > planeLeft && playerLeft < planeRight);
          const hasVerticalOverlap = (playerBottom > planeTop && playerTop < planeBottom);
          
          if (hasHorizontalOverlap && hasVerticalOverlap) {
            
            // Có collision thực tế → đẩy player
            try {
              player.worldX = planeLeft - playerRadius - 2;
              player.sprite.x = player.worldX;
            } catch (e) {}
          }
          // Nếu không có overlap thực tế → không làm gì cả
          
          return;
        } else {
          // Obstacle thông thường vẫn gây chết
          try {} catch (e) {}
          try {
            try { controlsEnabled = false; playerDead = true; player.vy = 0; } catch (e) {}
            try { if (spinePlayerInstance && spinePlayerInstance.pauseTrack) spinePlayerInstance.pauseTrack(0); } catch (e) {}
            try { if (spinePlayerInstance && spinePlayerInstance.play) spinePlayerInstance.play('die', false, 0); } catch (e) {}
            try { if (!(blocking as any)._hitPlayed) { tryPlayHitSound(); try { (blocking as any)._hitPlayed = true; } catch (e) {} } } catch (e) {}
            playCollisionEffectAt(player.worldX, player.y, () => { try { doGameOver && doGameOver('hit-obstacle', true); } catch (e) { try { doGameOver && doGameOver('hit-obstacle'); } catch (e) {} } });
          } catch (e) {}
          return;
        }
      }
    } catch (e) {}

    try {
      if (spinePlayerInstance) {
        // DEBUG: Log spine state every few seconds (throttled)
        if (Math.floor(Date.now() / 5000) % 2 === 0 && Math.random() < 0.001) {
        }
        
        let shouldShowRun = false;
        
        if (player.onGround) {
          const obstacles = (gameplay as any).getObstacles ? (gameplay as any).getObstacles() : [];
          const playerBottom = player.y + playerRadius;
          
          for (const o of obstacles) {
            const left = o.x;
            const right = o.x + o.width;
            if (player.worldX + playerRadius > left && player.worldX - playerRadius < right) {
              const obstacleTop = o.sprite.y;
              if (Math.abs(playerBottom - obstacleTop) <= 8 && o.isGround) {
                shouldShowRun = true;
                break;
              }
            }
          }
        }
        
        try {
          if (playerDead) {
            try { if (spinePlayerInstance && spinePlayerInstance.pauseTrack) spinePlayerInstance.pauseTrack(0); } catch (e) {}
            try { if (spinePlayerInstance && spinePlayerInstance.play) spinePlayerInstance.play('die', false, 0); } catch (e) {}
          } else {
            const state = (spinePlayerInstance as any).spine ? (spinePlayerInstance as any).spine.state : null;
            const track0 = state ? (typeof state.getCurrent === 'function' ? state.getCurrent(0) : (state.tracks ? state.tracks[0] : null)) : null;
            const currentAnim = track0 && track0.animation ? track0.animation.name : null;
            const trackPaused = track0 && (track0.timeScale === 0 || track0.timeScale === 0.0);

            if (shouldShowRun) {
              try {
                if (currentAnim !== 'run') {
                  spinePlayerInstance.play && spinePlayerInstance.play('run', true, 0);
                }
                if (trackPaused) {
                  try {} catch (e) {}
                }
                try { spinePlayerInstance.resumeTrack && spinePlayerInstance.resumeTrack(0); } catch (e) {}
              } catch (e) {}
            } else {
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

    try {
      if (spinePlayerInstance) {
        const baseSpeed = 200;
        let ts = (playerMoveSpeed - 180) / baseSpeed;
        if (!isFinite(ts) || ts <= 0) ts = 0.5;
        ts = Math.min(Math.max(ts, 1), 2.2);
        spinePlayerInstance.setTimeScale(ts);
      }
    } catch (e) {}

    try { player.setScreenScale && player.setScreenScale(currentScale); } catch (e) {}

    try { if (cloudBigLayer && cloudBigLayer.update) cloudBigLayer.update(scroll); } catch (e) {}
    try { if (cloudSmallLayer && cloudSmallLayer.update) cloudSmallLayer.update(scroll); } catch (e) {}
    try {
      if (cityLayer && cityLayer.update) cityLayer.update(scroll);
    } catch (e) {}

    label.text = `Speed(cam): ${Math.round(speed)} px/s  Distance: ${Math.floor(scroll)}`;

    // Update player marker
    // Player marker update removed

    try {
      const newThreshold = Math.floor(scroll / 100);
      if (newThreshold > lastDistanceThreshold && !playerDead && !gameOver) {
        const gainedUnits = newThreshold - lastDistanceThreshold;
        try { prevScore = score; } catch (e) {}
        score += gainedUnits * 15;
        try { scoreText.text = `Score: ${score}`; } catch (e) {}
        lastDistanceThreshold = newThreshold;
        // Power-up tier system removed
      }
    } catch (e) {}

    try {
      if (!rewardShown && typeof score === 'number' && score >= REWARD_THRESHOLD) {
        rewardShown = true;
        rewardActive = true;
        rewardPermanentStop = true;
        try { controlsEnabled = false; } catch (e) {}
        try { app.ticker && app.ticker.stop && app.ticker.stop(); } catch (e) {}
        try {
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
           

          try { app.stage.addChild(overlay); } catch (e) { try { root.addChild(overlay); } catch (e) {} }

          btnG.on && btnG.on('pointerdown', () => {
            try {
              try { window.open(REWARD_URL, '_blank'); } catch (e) { try { window.location.href = REWARD_URL; } catch (e) {} }
            } catch (e) {}
            try { rewardClaimed = true; controlsEnabled = false; } catch (e) {}
          });

          closeG.on && closeG.on('pointerdown', () => {
            try { if (overlay.parent) overlay.parent.removeChild(overlay); } catch (e) {}
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
  });

  // Power-up system removed

  const GAME_OVER_GRACE_MS = 400;
  let gameOver = false;
  let gameOverQueuedTimer: ReturnType<typeof setTimeout> | null = null;
  let gameOverQueuedReason: string | null = null;
  let collisionEffectPlaying = false;

  async function restartGame() {
    try { SoundController.stopAll(); } catch (e) {}
    
    // RESET STATE NGAY LẬP TỨC để tránh trigger game over
    gameOver = false;
    playerDead = false;
    controlsEnabled = false; // Tạm tắt controls trong khi restart
    
    // Clear queued game over
    if (gameOverQueuedTimer) {
      clearTimeout(gameOverQueuedTimer as any);
      gameOverQueuedTimer = null;
      gameOverQueuedReason = null;
    }
    
    // Xóa tất cả pickups
    try {
      for (const it of pickups) {
        try { if (it && it.parent) it.parent.removeChild(it); } catch (e) {}
      }
      pickups.length = 0;
    } catch (e) {}

    // Xóa tất cả pattern containers
    try {
      for (const c of spawnedPatternContainers) {
        try { if (c && c.parent) c.parent.removeChild(c); } catch (e) {}
      }
      spawnedPatternContainers.length = 0;
    } catch (e) {}

    // XÓA TẤT CẢ CHILDREN TRONG WORLD (trừ background và player)
    try {
      console.log('Cleaning world children, before:', world.children.length);
      
      // Lưu lại các objects cần giữ
      const childrenToKeep = [];
      
      // Giữ lại background (bg)
      if (bg && bg.parent === world) {
        childrenToKeep.push(bg);
      }
      
      // Xóa tất cả children khác
      const childrenToRemove = [...world.children];
      for (const child of childrenToRemove) {
        if (!childrenToKeep.includes(child)) {
          try { 
            world.removeChild(child); 
          } catch (e) {}
        }
      }
      
      console.log('World children after cleanup:', world.children.length);
    } catch (e) {
      console.error('Error cleaning world:', e);
    }

    // Reset gameplay
    try {
      try { if (gameplay && typeof (gameplay.reset) === 'function') gameplay.reset(); } catch (e) {}
      gameplay = null;
      try { lastDistanceThreshold = 0; } catch (e) {}
    } catch (e) {}

    // Reset player state TRƯỚC KHI startGame
    try {
      try { (world as any).x = 0; } catch (e) {}
      try { 
        player.worldX = PLAYER_X; 
        player.vy = 0; 
        player.y = groundY - playerRadius; // Đặt player ở vị trí an toàn trên mặt đất
        player.sprite.y = player.y; 
        prevScore = 0; 
        score = 0; 
        scoreText.text = `Score: ${score}`;
      } catch (e) {}
      try { if (player && typeof (player.setScreenScale) === 'function') player.setScreenScale && player.setScreenScale(1); } catch (e) {}
    } catch (e) {}

    try { await startGame(); } catch (e) {}
    
    // Bật lại controls sau khi startGame hoàn thành
    controlsEnabled = true;
  }

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

  function doGameOver(finalReason?: string, force = false) {
    try { if (rewardActive || rewardPermanentStop) return; } catch (e) {}
    if (gameOver) return;
    try {
      if (!force) {
        const handler = (gameplay as any)._handler;
        const onPattern = handler && handler.isOnPattern ? handler.isOnPattern(player.worldX) : false;
        if (onPattern && player && player.onGround) {

          return;
        }
      }
    } catch (e) {}

    gameOver = true;


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

            return;
          }
        }
      } catch (e) {}
      doGameOver(reason);
    }, GAME_OVER_GRACE_MS) as unknown as ReturnType<typeof setTimeout>;
  }

  app.ticker.add(() => {
    if (gameOver || !controlsEnabled) return; // Thêm check controlsEnabled để tránh trigger khi restart
    try {
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
    let scale = Math.min((sw * 0.65) / WIDTH, (sh * 0.65) / HEIGHT);
    scale = Math.min(scale, 1);

    root.scale.set(scale, scale);
    currentScale = scale;
    root.x = (sw - WIDTH * scale) / 2;
    root.y = (sh - HEIGHT * scale) / 2;
    try { if (player && (player as any).setScreenScale) (player as any).setScreenScale(currentScale); } catch (e) {}
  }

  updateScale();

  try { await startGame(); } catch (e) {}
  try { controlsEnabled = true; } catch (e) {}

  function onResize() {
    applyCanvasCssSize();
    updateScale();
  }

  window.addEventListener('fullscreenchange', () => {
    try { onResize(); } catch (e) {}
  });

  let _lastDPR = window.devicePixelRatio;
  const _dprWatcher = setInterval(() => {
    const dpr = window.devicePixelRatio;
    if (dpr !== _lastDPR) {
      _lastDPR = dpr;
      try { onResize(); } catch (e) {}
    }
  }, 500);

  window.addEventListener('beforeunload', () => { try { clearInterval(_dprWatcher); } catch (e) {} });

  function applyGroundCounterScale(scale: number) {
    return;
  }

  try { applyGroundCounterScale(currentScale); } catch (e) {}

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

init();