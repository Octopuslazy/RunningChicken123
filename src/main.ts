// @ts-ignore
import './build-vars.js';
import { Application, Sprite, Assets, Graphics, Text, TextStyle, Container, Texture } from 'pixi.js';
// Prevent PIXI from creating workers / using createImageBitmap which can trigger runtime fetch/XHR
// (This shim runs before PIXI initialization to avoid WorkerManager spawning workers)
try {
  // Disable Worker creation in the environment for PIXI worker manager
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (typeof globalThis !== 'undefined') {
    // Preserve original values in case needed later (not stored here to avoid exposing them)
    (globalThis as any).Worker = undefined;
    (globalThis as any).createImageBitmap = undefined;
  }
} catch (e) { /* ignore */ }
// --- Global lifecycle hooks & FbPlayableAd fallback stubs (module-level) ---
try {
  const w = window as any;

  if (typeof w.FbPlayableAd === 'undefined' || !w.FbPlayableAd) {
    w.FbPlayableAd = {
      onCTAClick: function() { try { window.open((window as any).GOOGLE_PLAY_URL || (window as any).APP_STORE_URL || '/', '_blank'); } catch (e) {} },
      gameReady: function() {},
      gameStart: function() {},
      gameEnd: function() {},
      gameClose: function() {},
      saveFile: function(name: string, data: string) { try { console.log('saveFile stub', name); } catch (e) {} },
      loadFile: function(name: string) { try { console.log('loadFile stub', name); } catch (e) {} }
    };
  }

  if (typeof w.gameReady === 'undefined') {
    w.gameReady = function() { try { w.FbPlayableAd && w.FbPlayableAd.gameReady && w.FbPlayableAd.gameReady(); } catch (e) {} };
  }
  if (typeof w.gameStart === 'undefined') {
    w.gameStart = function() { try { w.FbPlayableAd && w.FbPlayableAd.gameStart && w.FbPlayableAd.gameStart(); } catch (e) {} };
  }
  if (typeof w.gameEnd === 'undefined') {
    w.gameEnd = function() { try { w.FbPlayableAd && w.FbPlayableAd.gameEnd && w.FbPlayableAd.gameEnd(); } catch (e) {} };
  }
  if (typeof w.gameClose === 'undefined') {
    w.gameClose = function() { try { w.FbPlayableAd && w.FbPlayableAd.gameClose && w.FbPlayableAd.gameClose(); } catch (e) {} };
  }
} catch (e) {}

// Minimal MRAID shim to satisfy host validators and provide a safe `open()`
try {
  const w = window as any;
  if (typeof w.mraid === 'undefined' || !w.mraid) {
    w.mraid = (function() {
      const listeners: Record<string, Function[]> = {};
      let _viewable = true;
      let _state: string = 'default';

      function emit(ev: string, data?: any) {
        const ls = listeners[ev] || [];
        for (const cb of ls) { try { cb(data); } catch (e) {} }
      }

      return {
        open: function(url?: string) {
          try {
            const fallback = ((window as any).GOOGLE_PLAY_URL || (window as any).APP_STORE_URL || '/');
            const target = url && typeof url === 'string' ? url : ((w.MRAID_STORE_URLS && (w.MRAID_STORE_URLS.android || w.MRAID_STORE_URLS.ios)) || fallback);
            try { window.open(target, '_blank'); } catch (e) {}
          } catch (e) {}
        },
        isViewable: function() { try { return !!_viewable; } catch (e) { return true; } },
        getState: function() { return _state; },
        addEventListener: function(evt: string, cb: Function) { listeners[evt] = listeners[evt] || []; listeners[evt].push(cb); },
        removeEventListener: function(evt: string, cb?: Function) { if (!listeners[evt]) return; if (!cb) { listeners[evt] = []; return; } listeners[evt] = listeners[evt].filter(f => f !== cb); },
        // Internals used by the creative if needed
        _emit: emit,
        _setViewable: function(v: boolean) { _viewable = !!v; emit('viewableChange', _viewable); },
        _setState: function(s: string) { _state = s; emit('stateChange', _state); }
      };
    })();
  }

  // Provide default store URLs so validators can find Play/App Store links
  if (typeof (w.MRAID_STORE_URLS) === 'undefined') {
    w.MRAID_STORE_URLS = {
      android: (window as any).GOOGLE_PLAY_URL || 'https://play.google.com/store/apps/details?id=com.ggds.ski.resort.empire.idle.tycoon.game&pcampaignid=web_share',
      ios: (window as any).APP_STORE_URL || 'https://apps.apple.com/vn/app/tam-qu%E1%BB%91c-kh%E1%BB%9Fi-%C4%91%E1%BB%99ng/id6742780202?l=vi'
    };
  }
} catch (e) {}

import { SpinePlayer } from './SpinePlayer';
// Playable SDK (static import restored)
import { sdk } from '@smoud/playable-sdk';
import { createCharacter } from './character';
import { ParticleManager } from './partical/ParticleManager';
import { createGameplay } from './gameplay';
import { loadTexture, loadGameAssets, RAW_SPINE_ASSETS } from './assetLoader';
import { makeGroundPattern } from './patterns/groundOnly';
import makeDanger1 from './patterns/Danger1';
import makeDanger2 from './patterns/Danger2';
import makeDanger3 from './patterns/Danger3';
import makeDanger4 from './patterns/Danger4';
import makeDanger5 from './patterns/Danger5';
import makeDanger6 from './patterns/Danger6';
import SoundController from './sound/SoundController';
import showGameOver from './ui/gameOver';
import PlayerShadow from './shadow';

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
  try { console.log("=== BUNDLE LOADED: src/main.ts module executing ==="); } catch (e) {}
  console.log("=== GAME INIT STARTING ===");
  await (app as any).init({
    width: WIDTH,
    height: HEIGHT,
    background: 0x1099bb,
    // Note: removed `resizeTo: window` to keep the internal render
    // resolution fixed at WIDTH x HEIGHT. CSS scaling is applied
    // separately via `applyCanvasCssSize()` so the game logic
    // coordinates remain consistent across devices.
  });

  console.log("=== PIXI APP INITIALIZED ===");

  // --- SỬA LỖI TẠI ĐÂY ---
  // BẮT BUỘC: Nạp toàn bộ tài nguyên (Spine, Ảnh, Nhạc) vào RAM trước tiên!
  // Nếu không có dòng này, mọi lệnh loadTexture hay SpinePlayer ở dưới đều sẽ gây lỗi CORS.
  
      await loadGameAssets();
      try { console.log('Assets loaded - calling window.gameReady if present'); } catch (e) {}
      try { (window as any).gameReady && (window as any).gameReady(); } catch (e) { console.warn('gameReady call failed', e); }
      // --- Playable SDK quick-start (safe runtime shim to avoid build-time dependency) ---
      try {
        const isSdkPresent = typeof (sdk as any) !== 'undefined' || !!(window as any).sdk;
        const playableSdk: any = (typeof (sdk as any) !== 'undefined' && (sdk as any)) || (window as any).sdk || {
          init: (_cb?: any) => {},
          on: (_ev?: any, _cb?: any) => {},
          start: () => {},
          install: () => {},
          finish: () => {}
        };

        try {
          playableSdk.init && playableSdk.init((width: number, height: number) => {
            // Game already initialized via PIXI; keep this no-op to satisfy hosts.
          });

          playableSdk.on && playableSdk.on('resize', (w: number, h: number) => {
            try { applyCanvasCssSize(); } catch (e) {}
          });
          playableSdk.on && playableSdk.on('pause', () => { try { if (app && app.ticker) app.ticker.stop(); try { (window as any).gamePause && (window as any).gamePause(); } catch(e){} } catch (e) {} });
          playableSdk.on && playableSdk.on('resume', () => { try { if (app && app.ticker) app.ticker.start(); try { (window as any).gameResume && (window as any).gameResume(); } catch(e){} } catch (e) {} });
          playableSdk.on && playableSdk.on('volume', (level: number) => { try { if (typeof level === 'number') { try { SoundController && SoundController.setVolume && (SoundController as any).setVolume(level); } catch(e){} } } catch (e) {} });
          playableSdk.on && playableSdk.on('finish', () => { try { (window as any).gameEnd && (window as any).gameEnd(); } catch (e) {} });

          // Recommended/optional events
          playableSdk.on && playableSdk.on('init', () => { try { /* loading screen may be shown by host */ } catch(e){} });
          playableSdk.on && playableSdk.on('ready', () => {
            try {
              // SDK signals container ready - we can start loading resources or call gameReady
              try { (window as any).gameReady && (window as any).gameReady(); } catch(e){}
            } catch(e){}
          });
          playableSdk.on && playableSdk.on('start', () => { try { if (typeof startGame === 'function') startGame(); } catch(e){} });
          playableSdk.on && playableSdk.on('interaction', (count: number) => {
            try {
              console.log('SDK interaction', count);
              // show install CTA after enough interactions
              try { if (count >= 3) { const ib = document.getElementById('installButton'); if (ib) ib.style.display = 'inline-block'; } } catch(e){}
            } catch(e){}
          });
          playableSdk.on && playableSdk.on('retry', () => { try { if (typeof restartGame === 'function') restartGame(); } catch(e){} });
          playableSdk.on && playableSdk.on('install', () => { try { console.log('SDK install event'); } catch(e){} });

          // Start the playable when resources are loaded
          try { playableSdk.start && playableSdk.start(); } catch (e) {}
        } catch (e) {}

        // Wire install button if present in DOM (show only when real SDK provides install)
        try {
          const btn = document.getElementById('installButton') as HTMLButtonElement | null;
          if (btn) {
            try {
              btn.style.display = 'none';
              if (typeof (sdk as any) !== 'undefined' && typeof (sdk as any).install === 'function') {
                btn.style.display = 'inline-block';
                btn.onclick = () => { try { (sdk as any).install(); } catch (e) {} };
              }
            } catch (e) { /* ignore */ }
          }
        } catch (e) {}
      } catch (e) {}
  
  // -----------------------

  const canvas = app.canvas as HTMLCanvasElement;
  canvas.style.display = 'block';
  
  // Enhanced mobile-first styling
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.width = '100%';
  document.body.style.height = '100%';
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.background = '#000';
  document.body.style.userSelect = 'none';
  (document.body.style as any).webkitUserSelect = 'none';
  (document.body.style as any).webkitTouchCallout = 'none';
  (document.body.style as any).webkitTapHighlightColor = 'transparent';
  
  // Canvas mobile optimizations
  canvas.style.touchAction = 'manipulation';
  (canvas.style as any).webkitTouchCallout = 'none';
  canvas.style.webkitUserSelect = 'none';
  canvas.style.userSelect = 'none';
  
  // Enforce internal render resolution fixed to WIDTH x HEIGHT.
  try {
    // Use a fixed renderer resolution (1) so game logic coordinates map to WIDTH/HEIGHT.
    app.renderer.resolution = 1;
    app.renderer.resize(WIDTH, HEIGHT);
    // Ensure canvas backing-store size matches internal resolution.
    canvas.width = Math.round(WIDTH * app.renderer.resolution);
    canvas.height = Math.round(HEIGHT * app.renderer.resolution);
  } catch (e) {}
  document.body.appendChild(canvas);

  const root = new Container();
  app.stage.addChild(root);

  // Create a dedicated game layer that will be scaled; background layers remain outside it.
  const GAME_SCALE = 0.85; // Scale the whole game to 85% (reduce size by 15%)
  const gameLayer = new Container();
  root.addChild(gameLayer);
  gameLayer.scale.set(GAME_SCALE, GAME_SCALE);

  // HUD layer: not a child of `root` so it does NOT inherit `root.scale`.
  // Place UI elements here so they remain pinned to screen corners.
  const hudLayer = new Container();
  app.stage.addChild(hudLayer);
  // HUD game layer: child of the scaled `gameLayer` so it WILL inherit game scaling.
  const hudGameLayer = new Container();
  gameLayer.addChild(hudGameLayer);

  // Keep HUD at constant on-screen size by inverse-scaling it against
  // the canvas CSS scale (canvas.clientWidth / internal WIDTH).
  function updateHudScale() {
    try {
      const cw = canvas.clientWidth || window.innerWidth || WIDTH;
      const ch = canvas.clientHeight || window.innerHeight || HEIGHT;
      const scaleX = cw && WIDTH ? (cw / WIDTH) : 1;
      const scale = scaleX || 1;
      
      // For mobile devices, adjust HUD scaling to be more readable
      const isMobile = (window as any).__isMobile || 
                       /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      let inv = scale > 0 ? (1 / scale) : 1;
      
      // On mobile, make HUD elements slightly larger for better touch interaction
      if (isMobile) {
        inv = Math.max(inv * 0.85, 0.6); // Minimum 60% size, but prefer 85% of calculated
      }
      
      hudLayer.scale.set(inv, inv);
      hudLayer.position.set(0, 0);
    } catch (e) {}
  }

  // HUD registry: keep a list of UI text/containers whose positions
  // should be recomputed when the screen scale or device size changes.
  const hudItems: Array<any> = [];

  function layoutHud() {
    try {
      for (const it of hudItems) {
        try {
          const o = it.obj;
          const an = it.anchor;
          if (!o) continue;
          // Support two types of HUD placement:
          // - layer === 'screen' (default): positions specified in CSS pixels and
          //   converted to internal coordinates so the HUD does NOT scale with the world.
          // - layer === 'game': positions specified in internal units and placed in
          //   the game container (scales with `root`).
          const layerKind = it.layer || 'screen';
          if (layerKind === 'screen') {
            const sw = canvas.clientWidth || window.innerWidth;
            const sh = canvas.clientHeight || window.innerHeight;
            const scale = (sw && WIDTH) ? (sw / WIDTH) : 1;
            const boundsW = (o.width !== undefined && typeof o.width === 'number') ? o.width : (o.getBounds ? o.getBounds().width : 0);
            const boundsH = (o.height !== undefined && typeof o.height === 'number') ? o.height : (o.getBounds ? o.getBounds().height : 0);
            if (an === 'topleft') {
              o.x = (it.x !== undefined ? it.x : 0) * scale;
              o.y = Math.max(0, (it.y !== undefined ? it.y : 0) * scale);
            } else if (an === 'topright') {
              const off = it.offsetX !== undefined ? it.offsetX : 0;
              o.x = Math.max(0, ((sw - off) * scale) - boundsW);
              o.y = Math.max(0, (it.y !== undefined ? it.y : 0) * scale);
            } else if (an === 'bottomleft') {
              const offY = it.offsetY !== undefined ? it.offsetY : 0;
              o.x = (it.x !== undefined ? it.x : 0) * scale;
              o.y = Math.max(0, ((sh - offY) * scale) - boundsH);
            } else if (an === 'bottomright') {
              const offX = it.offsetX !== undefined ? it.offsetX : 0;
              const offY = it.offsetY !== undefined ? it.offsetY : 0;
              o.x = Math.max(0, ((sw - offX) * scale) - boundsW);
              o.y = Math.max(0, ((sh - offY) * scale) - boundsH);
            } else if (an === 'center') {
              o.x = ((sw / 2) + (it.x || 0)) * scale;
              o.y = ((sh / 2) + (it.y || 0)) * scale;
            }
          } else {
            // 'game' layer: positions are internal (game) units, so use WIDTH/HEIGHT
            const swg = WIDTH;
            const shg = HEIGHT;
            const boundsWg = (o.width !== undefined && typeof o.width === 'number') ? o.width : (o.getBounds ? o.getBounds().width : 0);
            const boundsHg = (o.height !== undefined && typeof o.height === 'number') ? o.height : (o.getBounds ? o.getBounds().height : 0);
            if (an === 'topleft') {
              o.x = it.x !== undefined ? it.x : 0;
              o.y = Math.max(0, it.y !== undefined ? it.y : 0);
            } else if (an === 'topright') {
              const off = it.offsetX !== undefined ? it.offsetX : 0;
              o.x = Math.max(0, swg - off - boundsWg);
              o.y = Math.max(0, it.y !== undefined ? it.y : 0);
            } else if (an === 'bottomleft') {
              const offY = it.offsetY !== undefined ? it.offsetY : 0;
              o.x = it.x !== undefined ? it.x : 0;
              o.y = Math.max(0, shg - offY - boundsHg);
            } else if (an === 'bottomright') {
              const offX = it.offsetX !== undefined ? it.offsetX : 0;
              const offY = it.offsetY !== undefined ? it.offsetY : 0;
              o.x = Math.max(0, swg - offX - boundsWg);
              o.y = Math.max(0, shg - offY - boundsHg);
            } else if (an === 'center') {
              o.x = (swg / 2) + (it.x || 0);
              o.y = (shg / 2) + (it.y || 0);
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  try {
    app.renderer.resize(WIDTH, HEIGHT);
  } catch (e) {}

  function applyCanvasCssSize() {
    const winW = window.innerWidth || WIDTH;
    const winH = window.innerHeight || HEIGHT;
    const scaleX = winW / WIDTH;
    const scaleY = winH / HEIGHT;
    
    // Enhanced mobile detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     ('ontouchstart' in window) ||
                     (navigator.maxTouchPoints > 0) ||
                     (winW <= 768);
    
    const isLandscape = winW > winH;
    const aspectRatio = winW / winH;
    
    // FOCUS ON MOBILE LANDSCAPE - optimal experience
    let scale: number;
    
    if (isMobile) {
      if (isLandscape) {
        // Mobile landscape: OPTIMAL - fill screen maximally
        scale = Math.max(scaleX, scaleY * 0.9);
        scale = Math.min(scale, 1.5); // Allow up to 1.5x for better mobile experience
      } else {
        // Mobile portrait: minimal scale, encourage rotation
        scale = Math.min(scaleX, scaleY) * 0.6; // Smaller scale to encourage landscape
      }
    } else {
      // Desktop logic: standard letterbox
      const rawScale = Math.min(scaleX, scaleY);
      const allowUpscale = (winW >= 1280 && aspectRatio >= 1.5);
      const maxScale = allowUpscale ? 1.8 : 1.2;
      scale = Math.min(rawScale, maxScale);
    }
    
    // Ensure minimum scale for readability
    scale = Math.max(scale, 0.3);
    
    // Handle rotation overlay for mobile devices
    handleRotationOverlay(isMobile, isLandscape);

    // Set CSS display size (does not affect internal resolution)
    const cssW = Math.round(WIDTH * scale);
    const cssH = Math.round(HEIGHT * scale);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    // Center the canvas in the window (letterbox) and ensure it's positioned
    canvas.style.position = 'absolute';
    canvas.style.left = `${Math.round((winW - cssW) / 2)}px`;
    canvas.style.top = `${Math.round((winH - cssH) / 2)}px`;
    
    // Handle safe area insets for mobile devices
    if (isMobile && 'CSS' in window && CSS.supports('padding: env(safe-area-inset-top)')) {
      try {
        const safeTop = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)');
        const safeBottom = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)');
        const safeLeft = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-left)');
        const safeRight = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-right)');
        
        if (safeTop || safeBottom || safeLeft || safeRight) {
          canvas.style.marginTop = safeTop || '0px';
          canvas.style.marginBottom = safeBottom || '0px';
          canvas.style.marginLeft = safeLeft || '0px';
          canvas.style.marginRight = safeRight || '0px';
        }
      } catch (e) {}
    }
    
    // Store scale for other systems to use
    (window as any).__gameScale = scale;
    (window as any).__isMobile = isMobile;
    (window as any).__isLandscape = isLandscape;
    
  }
  
  // Rotation overlay system
  let rotationOverlay: HTMLDivElement | null = null;
  
  function createRotationOverlay() {
    if (rotationOverlay) return rotationOverlay;
    
    rotationOverlay = document.createElement('div');
    rotationOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      font-family: Arial, sans-serif;
      font-size: 24px;
      font-weight: bold;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      z-index: 99999;
      backdrop-filter: blur(5px);
    `;
    
    rotationOverlay.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 20px;">📱</div>
      <div style="margin-bottom: 10px;">Vui lòng xoay điện thoại</div>
      <div style="font-size: 18px; opacity: 0.8;">để có trải nghiệm tốt nhất</div>
      <div style="font-size: 32px; margin-top: 20px; animation: rotate 2s infinite linear;">⟳</div>
    `;
    
    // Add rotation animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes rotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(rotationOverlay);
    return rotationOverlay;
  }
  
  function handleRotationOverlay(isMobile: boolean, isLandscape: boolean) {
    // Rotation overlay intentionally disabled — do not force device rotation.
    return;
  }
  applyCanvasCssSize();
  try { updateHudScale(); } catch (e) {}

  window.addEventListener('resize', () => {
    try {
      applyCanvasCssSize();
      try { updateHudScale(); } catch (e) {}
      try { layoutHud(); } catch (e) {}
    } catch (e) {}
  });

  const world = new Container();
  gameLayer.addChild(world);

  // Create a much wider background that moves with the world/camera
  const bgWidth = WIDTH * 8; // Make background 8x wider for camera scrolling
  const bgHeight = HEIGHT * 2; // Make background taller
  const bg = new Graphics().rect(-bgWidth/2, -bgHeight/4, bgWidth, bgHeight).fill({ color: 0x66ccff });
  // Put background IN the world so it moves with camera
  bg.scale.set(1.1, 1.1); // Scale background by 10%
  try { world.addChildAt(bg, 0); } catch (e) { try { world.addChild(bg); } catch (e) {} }

  // Parallax city background
  let cityLayer: { container: import('pixi.js').Container; update: (scroll: number) => void; tileWidth: number; } | null = null;
  try {
    // Bây giờ Assets đã có dữ liệu, lệnh này sẽ chạy ngon lành
    const cityTex = await loadTexture('/Assets/_arts/bg_3_city.png');
    if (cityTex) {
      const container = new Container();
      root.addChildAt(container, 0);
      const tileW = cityTex.width || WIDTH;
      const bgScale = 4 * 1.1; // Scale city background by 10%
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
      c.scale.set(1.1, 1.1); // Scale big clouds by 10%
      try { root.addChildAt(c, 1); } catch (e) { root.addChild(c); }
      const tileW = bigTex.width || WIDTH;
      const gapFraction = 0.25;
      const extendedTileW = tileW * (2 + gapFraction);
      const needed = Math.ceil((WIDTH * 2) / extendedTileW) + 4;
      for (let i = 0; i < needed; i++) {
        const s = new Sprite(bigTex as any);
        // Adjust X position when anchor is center (0.5) - add half tile width offset
        s.x = i * extendedTileW + (tileW / 2);
        // Position slightly lower (move down by 20px)
        s.y = 80;
        // Set anchor to center-top (horizontal center, vertical top)
        s.anchor.set(0.5, 0);
        c.addChild(s);
      }
      function updateBig(scroll: number) {
        // Move clouds left-right in place using sine wave
        const time = performance.now() * 0.0002;
        for (let i = 0; i < c.children.length; i++) {
          const s = c.children[i] as import('pixi.js').Sprite;
          const baseX = i * extendedTileW + (tileW / 2);
          s.x = baseX + Math.sin(time + i) * 80; // 80px amplitude, adjust as needed
        }
        c.x = 0;
      }
      cloudBigLayer = { container: c, update: updateBig, tileWidth: tileW };
    }
  } catch (e) { cloudBigLayer = null; }

  try {
    const smallTex = await loadTexture('/Assets/_arts/bg_4_cloudsmall.png');
    if (smallTex) {
      const c = new Container();
      c.scale.set(1.1, 1.1); // Scale small clouds by 10%
      try { root.addChildAt(c, 2); } catch (e) { root.addChild(c); }
      const tileW = smallTex.width || WIDTH;
      const gapFractionS = 0.18;
      const extendedTileWS = tileW * (5 + gapFractionS);
      const needed = Math.ceil((WIDTH * 2) / extendedTileWS) + 4;
      for (let i = 0; i < needed; i++) {
        const s = new Sprite(smallTex as any);
        // Adjust X position when anchor is center (0.5) - add half tile width offset  
        s.x = i * extendedTileWS + (tileW / 2);
        // Position slightly lower (move down by 20px)
        s.y = 100;
        // Set anchor to center-top (horizontal center, vertical top)
        s.anchor.set(0.5, 0);
        c.addChild(s);
      }
      function updateSmall(scroll: number) {
        // Move clouds left-right in place using sine wave
        const time = performance.now() * 0.0003;
        for (let i = 0; i < c.children.length; i++) {
          const s = c.children[i] as import('pixi.js').Sprite;
          const baseX = i * extendedTileWS + (tileW / 2);
          s.x = baseX + Math.sin(time + i * 1.5) * 60; // 60px amplitude, adjust as needed
        }
        c.x = 0;
      }
      cloudSmallLayer = { container: c, update: updateSmall, tileWidth: tileW };
    }
  } catch (e) { cloudSmallLayer = null; }

  // FIXED: Use proper groundY position near bottom of screen
  const groundY = HEIGHT - 120; // Standard ground position

  const style = new TextStyle({
    fill: '#ffffff',
    fontSize: 36,
    fontFamily: 'Helvetica-Bold'
  });
  const label = new Text({ text: 'Running Chicken - Pixi v8', style: style });
  label.x = 140;
  label.y = 20;
  hudLayer.addChild(label);
  // hide runtime speed/distance debug label (gameplay updates it)
  label.visible = false;

  // try {
  //   let soundEnabled = true; // Mặc định sound ON
  //   const soundToggle = new Container();
  //   const btnW = 120; const btnH = 36;
  //   const btn = new Graphics();
  //   try { btn.clear(); btn.beginFill(0x000000, 0.45); btn.drawRoundedRect(0, 0, btnW, btnH, 6); btn.endFill(); } catch (e) {}
  //   const lblStyle = new TextStyle({ fill: '#ffffff', fontSize: 16, fontFamily: 'Helvetica-Bold' });
  //   const lbl = new Text({ text: 'Sound: On', style: lblStyle }); // Hiển thị Sound: On mặc định
  //   lbl.x = 10; lbl.y = 6;
  //   soundToggle.addChild(btn);
  //   soundToggle.addChild(lbl);
  //   soundToggle.x = 8; soundToggle.y = 8;
  //   soundToggle.interactive = true;
  //   (soundToggle as any).buttonMode = true;
  //   soundToggle.on && soundToggle.on('pointerdown', () => {
  //     try {
  //       if (soundEnabled) {
  //         try { SoundController.stopBackground(); } catch (e) {}
  //         soundEnabled = false; lbl.text = 'Sound: Off';
  //       } else {
  //         try { SoundController.playBackgroundForced(300); } catch (e) { try { SoundController.playBackground(); } catch (e) {} }
  //         soundEnabled = true; lbl.text = 'Sound: On';
  //         try { backgroundStarted = true; } catch (e) {}
  //       }
  //     } catch (e) {}
  //   });
  //   try { hudLayer.addChild(soundToggle); } catch (e) { app.stage.addChild(soundToggle); }
  //   // small sound toggle -> top-right, below other HUD items
  //   hudItems.push({ obj: soundToggle, anchor: 'topright', offsetX: 20, y: 20 });
  // } catch (e) {}

  const PLAYER_X = 150;
  const playerRadius = 40; // Giảm từ 20 xuống 15 để tránh va chạm sai
  const PLAYER_SPAWN_LIFT = 80;
  let player: any = null;
  
  // Tạo nhân vật với graphics fallback trước - sẽ được thay thế bằng spine
  player = createCharacter({ 
    PLAYER_X, 
    playerRadius, 
    groundY: groundY, 
    texture: undefined, // Dùng graphics trước
    jumpSpeed: 1300, 
    gravity: 5500, 
    screenScale: 0.8 * CHARACTER_SCALE_FACTOR 
  });

  player.worldX = PLAYER_X;
  player.y = groundY - playerRadius; // FIXED: Use standard ground position
  
  // Đảm bảo sprite visible và có alpha
  player.sprite.visible = true;
  player.sprite.alpha = 1;
  
  player.sprite.x = PLAYER_X;
  world.addChild(player.sprite);
  player.sprite.y = player.y;

  // Scale player sprite down by 50% so character is visually smaller
  try { if (player && player.sprite && (player.sprite as any).scale) { (player.sprite as any).scale.x *= 0.5; (player.sprite as any).scale.y *= 0.5; } } catch (e) {}
  
  world.addChild(player.sprite);
  // playerShadowInstance will be created when gameplay is initialized
  let playerShadowInstance: any = null;
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

      // If Assets-based creation didn't yield a view, try the manual loader using raw imported assets
      if (!sp.view) {
        console.warn('Spine.from() did not produce a view; attempting manual load from RAW_SPINE_ASSETS');
        try { await sp.load(undefined, RAW_SPINE_ASSETS); } catch (e) { console.warn('Manual sp.load failed', e); }
      }

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
      // Ensure the new Spine view uses a centered anchor/pivot and record it
      try {
        const sv: any = player.sprite;
        const b = sv.getLocalBounds ? sv.getLocalBounds() : null;
        const cx = b ? ((b.x || 0) + (b.width || 0) / 2) : 0;
        const cy = b ? ((b.y || 0) + (b.height || 0) / 2) : 0;
        if (sv.anchor && typeof sv.anchor.set === 'function' && b && b.width && b.height) {
          try { sv.anchor.set(0.5, 0.5); sv.__initialAnchor = { x: 0.5, y: 0.5 }; } catch (e) {}
        } else if (sv.pivot && typeof sv.pivot.set === 'function') {
          try { sv.pivot.set(cx, cy); sv.__initialPivot = { x: cx, y: cy }; } catch (e) {}
        } else {
          try { sv.pivot = { x: cx, y: cy }; sv.__initialPivot = { x: cx, y: cy }; } catch (e) {}
        }
      } catch (e) {}
      player.sprite.visible = true;
      player.sprite.alpha = 1;
      player.sprite.x = player.worldX;
      player.sprite.y = player.y;
      player.sprite.zIndex = 5000;
      
      world.addChild(player.sprite);
      // Ensure Spine character is visually smaller: scale down by 50%
      try { if (player && player.sprite && (player.sprite as any).scale) { (player.sprite as any).scale.x *= 0.5; (player.sprite as any).scale.y *= 0.5; } } catch (e) {}
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
  // expose pickups globally so pattern factories can register spawned pickups
  try { (window as any).pickups = pickups; } catch (e) {}
  const spawnedPatternContainers: any[] = [];
  let score = 0;
  let prevScore = 0;
  let lastDistanceThreshold = 0;
  const REWARD_URL = (window as any).GOOGLE_PLAY_URL || (window as any).APP_STORE_URL || '/';
  const REWARD_THRESHOLD = 1500;
  let rewardShown = false;
  let rewardActive = false;
  let rewardPermanentStop = false;
  let rewardClaimed = false;
  // Removed invincible and blinking code
  const scoreStyle = new TextStyle({ fill: '#000000ff', fontSize: 56, fontFamily: 'Helvetica-Bold', fontWeight: 'bold' });
  const scoreText = new Text({ text: 'Score: 0', style: scoreStyle });
  // score: place inside the game container so it scales with world
  hudGameLayer.addChild(scoreText);
  hudItems.push({ obj: scoreText, anchor: 'topright', offsetX: 20, y: -30, layer: 'game' });

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
    try { await loadTexture('/Assets/_arts/bg_1_platformmid.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/platform.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_1_platformleft.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/bg_1_platformright.png'); } catch (e) {}
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
    try { await loadTexture('/Assets/_arts/bg_1_standee1.png'); } catch (e) {}
    try { await loadTexture('/Assets/_arts/gameover.jpg'); } catch (e) {}

  } catch (e) {}

  let spaceHeld = false;
  let pointerHeld = false;
  // When true the next global pointerdown will be consumed (ignored)
  // This prevents UI spam from causing an immediate jump after respawn/restart.
  let consumeNextPointerDown = false;
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
    // If we're consuming the next pointerdown (e.g. just respawned), consume it
    if (consumeNextPointerDown) {
      consumeNextPointerDown = false;
      pointerHeld = true; // mark held so additional pointerdowns are ignored until pointerup
      return;
    }

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
        gameplay = createGameplay({ world, bg, label, WIDTH, HEIGHT, groundY, initialSpeed: 200, speedAccel: 8, patternYOffset: 0, patternGroundThickness: 160, patternObstaclePadding: 24 });
        try { (gameplay as any)._handler.allowRandomObstacles = false; } catch (e) {}
      } catch (e) {}

        // Create player shadow instance now that gameplay exists
        try {
          try { if (!playerShadowInstance) playerShadowInstance = new PlayerShadow({ world, gameplay, player, playerRadius, groundY }); } catch (e) { playerShadowInstance = null; }
        } catch (e) {}

      // Tạo patterns sau khi đã có gameplay
      try {
        const handler = (gameplay as any)._handler;

        const patterns: any[] = [];
        // Use pooling system for ALL patterns, including initial easy ones
        const PIT_WIDTH = 300;

        const PATTERN_LENGTH = 750;
        const PROB_USE_DANGER = 0.70;
        const PROB_USE_DANGER_AFTER = 0.85;
        const DANGER_WEIGHTS = { d1: 0.3, d2: 0.2, d3: 0.3, d4: 0.2, d5: 0.3, d6: 0.3 };
        const DANGER3_LENGTH = 300;
        const DANGER4_LENGTH = 1200;
        const DANGER6_LENGTH = 2800;
        const DISTANCE_NORMAL_START = 4500;

        // Store pattern factories for pooling system
        const patternFactories: any[] = [];
        
        // Add 5 easy ground pattern factories first (for initial patterns)
        for (let i = 0; i < 5; i++) {
          const easyFactory = makeGroundPattern({ leftEnd: true, rightEnd: true, length: PATTERN_LENGTH });
          patternFactories.push(easyFactory);
        }
        
        // Create factory functions for more complex patterns (pooling system)
        for (let i = 0; i < 15; i++) { // Create 15 more factory combinations
          const length = PATTERN_LENGTH;
          const probUseDangerNow = (i * length >= DISTANCE_NORMAL_START) ? PROB_USE_DANGER_AFTER : PROB_USE_DANGER;
          let factory: any = null;
          if (Math.random() < probUseDangerNow) {
            const includeD5 = i * length >= DISTANCE_NORMAL_START;
            const entries: { w: number; fn: () => any }[] = [
              { w: DANGER_WEIGHTS.d1, fn: () => makeDanger1({ leftEnd: true, rightEnd: true, length }) },
              { w: DANGER_WEIGHTS.d2, fn: () => makeDanger2({ leftEnd: true, rightEnd: true, length }) },
              { w: DANGER_WEIGHTS.d3, fn: () => makeDanger3({ leftEnd: true, rightEnd: true, length: DANGER3_LENGTH }) },
              { w: DANGER_WEIGHTS.d4, fn: () => makeDanger4({ leftEnd: true, rightEnd: true, length: DANGER4_LENGTH }) },
              { w: includeD5 ? DANGER_WEIGHTS.d5 : 0, fn: () => makeDanger5({ leftEnd: true, rightEnd: true, length }) },
              { w: DANGER_WEIGHTS.d6, fn: () => makeDanger6({ leftEnd: true, rightEnd: true, length: DANGER6_LENGTH }) },
            ];
            const total = entries.reduce((s, e) => s + (e.w || 0), 0) || 1;
            let r2 = Math.random() * total;
            let picked: any = null;
            for (const e of entries) {
              if (!e.w) continue;
              if (r2 < e.w) { picked = e.fn(); break; }
              r2 -= e.w;
            }
            factory = picked || entries.find(e => (e.w || 0) > 0)?.fn() || makeGroundPattern({ leftEnd: true, rightEnd: true, length });
          } else {
            factory = makeGroundPattern({ leftEnd: true, rightEnd: true, length });
          }

          const chosenFactory = factory;
          const factoryToUse = (startX2: number) => {
            try {
              const pd = chosenFactory(startX2);
              if (pd && pd.difficulty === 'MEDIUM' && i * length < DISTANCE_NORMAL_START) {
                return makeGroundPattern({ leftEnd: true, rightEnd: true, length })(startX2);
              }
              return pd;
            } catch (e) {
              return makeGroundPattern({ leftEnd: true, rightEnd: true, length })(startX2);
            }
          };

          // Store factory for dynamic generation without creating pattern
          patternFactories.push(factoryToUse);
        }
        
        // Store all factories in handler for pooling system
        for (const factory of patternFactories) {
          handler.storePatternFactory(factory);
        }


        
        // Setup handler debug keys
        try {
          if (handler) {
            try {
              if (player && (player as any).getGroundY === undefined) {
                (player as any).getGroundY = (wx: number) => {
                  try { return handler.getSurfaceYAt(wx); } catch (e) { return groundY; }
                };
              }
            } catch (e) {}
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
              player.y = surfaceY - playerRadius;
            } catch (e) {
              player.y = p1.container.y - playerRadius;
            }
            player.vy = 0;
            player.onGround = true;
            try { if ((player as any).maxJumps !== undefined) (player as any).jumpsLeft = (player as any).maxJumps; } catch (e) {}
            try { 
              player.sprite.x = player.worldX;
              player.sprite.y = player.y; 
            } catch (e) {}
            
            // FIX: Update camera position to match player's new position
            try {
              const TARGET_SCREEN_X = Math.round(WIDTH / 3);
              const desiredScroll = targetWorldX - TARGET_SCREEN_X;
              world.x = -desiredScroll;
              world.y = 250; // Maintain camera Y offset - higher camera
              if (handler) {
                try { handler.scroll = desiredScroll; } catch (e) {}
                // DISABLED: Don't set handler.world.x - it conflicts with main world.x
                // try { if (handler.world) handler.world.x = -desiredScroll; } catch (e) {}
              }
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
  hudLayer.addChild(debug);
  // debug text also on top-right for testing
  hudItems.push({ obj: debug, anchor: 'topright', offsetX: 20, y: 180 });
  try { layoutHud(); } catch (e) {}
  
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
        // Removed collision effect for pickup - only play pickup sound
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
  const PLAYER_SPEED_FACTOR = 1.0;
  let debugFrameCount = 0;

  let gameLoopLoggedOnce = false;

    app.ticker.add(() => {
    if (!gameLoopLoggedOnce) {
      console.log("=== GAME LOOP STARTED ===");
      gameLoopLoggedOnce = true;
    }
    
    const deltaSec = (app.ticker as any).deltaMS / 1000;

    if (!gameplay) return;
    
    // Debug camera position every 60 frames (approximately 1 second)
    debugFrameCount++;
    if (debugFrameCount >= 60) {
      debugFrameCount = 0;
      // Add particle system stats to debug output
      const particleStats = ParticleManager.getInstance().getStats();
      
    }
    
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
    }
    
    // Update particle system (replaces individual RAF calls for better performance)
    try {
      ParticleManager.getInstance().update(deltaSec);
    } catch (e) {
      // Silent fail
    }    
    
    // Stop gameplay and player movement when game over
    let scroll = 0, speed = 0, playerMoveSpeed = 0;
    if (!gameOver && controlsEnabled) {
      const result = gameplay.update(deltaSec);
      scroll = result.scroll;
      speed = result.speed;
      playerMoveSpeed = speed * PLAYER_SPEED_FACTOR;

      if (!playerDead) {
        player.worldX += playerMoveSpeed * deltaSec;
      }
    } else {
      // When game over, use last known scroll/speed values
      const handler = (gameplay as any)?._handler;
      if (handler) {
        scroll = handler.scroll || 0;
        speed = handler.speed || 0;
        playerMoveSpeed = speed * PLAYER_SPEED_FACTOR;
      }
    }

    // Left-boundary death removed: player will not die when pushed left.

    (app as any).__prevPlayerBottom = player.y + playerRadius;

    player.update(deltaSec, scroll, speed);

    // pickup collision: check player against pattern-spawned pickups
    try {
      for (let pi = pickups.length - 1; pi >= 0; pi--) {
        const pu: any = pickups[pi];
        if (!pu) { pickups.splice(pi, 1); continue; }
        try { if (pu.collected) { pickups.splice(pi, 1); continue; } } catch (e) {}
        try {
          const b = pu.getBounds();
          const cx = b.x + (b.width || 0) / 2;
          const cy = b.y + (b.height || 0) / 2;
          const playerGlobalX = (player.worldX || 0) + (world.x || 0);
          const playerGlobalY = player.y;
          const dx = cx - playerGlobalX;
          const dy = cy - playerGlobalY;
          const pickRadius = Math.max(16, Math.min(b.width || 32, b.height || 32) / 2);
          const r = playerRadius + pickRadius;
          if ((dx * dx + dy * dy) <= (r * r)) {
            try { pu.collect(); } catch (e) {}
            try { if (pu.parent) pu.parent.removeChild(pu); } catch (e) {}
            pickups.splice(pi, 1);
          }
        } catch (e) {}
      }
    } catch (e) {}
    // Ensure player sprite keeps the initial centered anchor/pivot (never anchored at feet)
    try {
      const sAny: any = player.sprite;
      if (sAny && sAny.__initialAnchor && sAny.anchor && typeof sAny.anchor.set === 'function') {
        try { sAny.anchor.set(sAny.__initialAnchor.x, sAny.__initialAnchor.y); } catch (e) {}
      } else if (sAny && sAny.__initialPivot && sAny.pivot && typeof sAny.pivot.set === 'function') {
        try { sAny.pivot.set(sAny.__initialPivot.x, sAny.__initialPivot.y); } catch (e) {}
      }
    } catch (e) {}
    
    
   
    
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
                  // Stop all pattern animations when game over
                  if (gameOver || !controlsEnabled) {
                    continue; // Skip animation when game is over
                  }
                  // Respect explicit zero velocities: only fall back to default
                  // when __vx is undefined/null. Using `||` treats 0 as falsy
                  // which caused stationary platforms to still move.
                  const vx = (ps.__vx !== undefined && ps.__vx !== null) ? ps.__vx : -220;
                  ps.x += vx * deltaSec;

                  const gw = ps.__platformWidth || ((ps.texture && (ps.texture as any).width) * (ps.scale.x || 1));
                  const gh = ps.__platformHeight || 28;
                  
                  // Sử dụng plane local position thay vì world position để tránh tọa độ quá lớn
                  const planeLocalCenterX = ps.x; // Local position trong pattern
                  const planeLocalTopY = ps.y;
                  
                  // Tính obstacle position relative to pattern, không dùng world coordinates
                  const obstacleLocalLeft = planeLocalCenterX - gw / 2;

                  // Update plane collision position for moving platform
                  const platforms = (gameplay as any).getPlatforms ? (gameplay as any).getPlatforms() : [];
                  const obstacles = [ ...(platforms || []), ...((gameplay as any).getObstacles ? (gameplay as any).getObstacles() : []) ];
                  for (const o of obstacles) {
                    try {
                      if (!o || !o.sprite) continue;
                      // match by planeId for both planes and platforms
                      if ((o as any).planeId !== undefined && (o as any).planeId === ps.__planeId) {
                        const worldLeft = (patContainer.x || 0) + obstacleLocalLeft;

                        // Update collision bounds (only update horizontal position).
                        // Do NOT override `o.sprite.y` here — MapHandler set the
                        // collider Y correctly when creating the platform. Overriding
                        // it caused vertical misalignment where platforms appeared
                        // decorative but had no blocking collider.
                        o.x = worldLeft;
                        o.sprite.x = worldLeft;
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
    // Update player shadow (delegated to PlayerShadow instance)
    try {
      if (playerShadowInstance && typeof playerShadowInstance.update === 'function') {
        try { playerShadowInstance.update(); } catch (e) {}
      }
    } catch (e) {}

    // Camera follow: keep player at 1/3 of screen X and raise camera Y by 200px
    try {
      const TARGET_SCREEN_X = Math.round(WIDTH / 3);
      const desiredScroll = (player && typeof player.worldX === 'number') ? (player.worldX - TARGET_SCREEN_X) : scroll;
      try { 
        world.x = -desiredScroll; 
        world.y = 250; // Raise camera Y position by 250px
      } catch (e) {}
      try {
        const handler = (gameplay as any)?._handler;
        if (handler) {
          try { handler.scroll = desiredScroll; } catch (e) {}
          // DISABLED: Don't set handler.world.x - it conflicts with main world.x
          // try { if (handler.world) handler.world.x = -desiredScroll; } catch (e) {}
        }
      } catch (e) {}
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

    // Handle invincibility blinking: toggle sprite alpha while playerInvincible
    try {
      if (playerInvincible) {
        if (!_prevPlayerInvincible) {
          _prevPlayerInvincible = true;
          _invincibleBlinkStart = (performance && performance.now) ? performance.now() : Date.now();
        }
        const now = (performance && performance.now) ? performance.now() : Date.now();
        const t = now - _invincibleBlinkStart;
        const phase = Math.floor(t / INVINCIBLE_BLINK_PERIOD) % 2;
        const show = !!phase; // toggle visible for clearer blink
        try {
          if (player && player.sprite) player.sprite.visible = show;
          if (spinePlayerInstance && spinePlayerInstance.view) spinePlayerInstance.view.visible = show;
        } catch (e) {}
      } else {
        if (_prevPlayerInvincible) {
          _prevPlayerInvincible = false;
          try {
            if (player && player.sprite) player.sprite.visible = true;
            if (spinePlayerInstance && spinePlayerInstance.view) spinePlayerInstance.view.visible = true;
          } catch (e) {}
        }
      }
    } catch (e) {}

    try {
      const platforms = (gameplay as any).getPlatforms ? (gameplay as any).getPlatforms() : [];
      // Sweep-test fallback: detect fast falls that cross a platform between
      // the previous frame and current frame and land the player.
      try {
        const prevBottom = (app as any).__prevPlayerBottom !== undefined ? (app as any).__prevPlayerBottom : (player.y + playerRadius);
        const currBottom = player.y + playerRadius;
        if (currBottom > prevBottom) { // only when moving downward
          for (const p of platforms) {
            try {
              const left = p.x; const right = p.x + p.width;
              if (player.worldX + playerRadius > left && player.worldX - playerRadius < right) {
                const platformTop = p.sprite.y;
                if (prevBottom <= platformTop && currBottom >= platformTop) {
                  // Land on platform
                  player.y = platformTop - playerRadius;
                  player.vy = 0;
                  player.onGround = true;
                  try { if ((player as any).maxJumps !== undefined) (player as any).jumpsLeft = (player as any).maxJumps; } catch (e) {}
                  player.sprite.y = player.y;
                }
              }
            } catch (e) {}
          }
        }
      } catch (e) {}

      const obstacles = [ ...(platforms || []), ...((gameplay as any).getObstacles ? (gameplay as any).getObstacles() : []) ];
      for (const o of obstacles) {
        const left = o.x;
        const right = o.x + o.width;
        // Debug: when encountering plane obstacles, log overlap details occasionally
        try {
          if ((o as any).isPlane) {
            // throttle logs to avoid spam
            if (Math.random() < 0.02) {
              
            }
          }
        } catch (e) {}
        if (player.worldX + playerRadius > left && player.worldX - playerRadius < right) {
          const obstacleTop = o.sprite.y;
          // debug log removed
          const prevBottom = (app as any).__prevPlayerBottom !== undefined ? (app as any).__prevPlayerBottom : (player.y + playerRadius);
          const currBottom = player.y + playerRadius;
          const LANDING_TOLERANCE = 24; // pixels to tolerate fast falls (prevents tunneling)
          if (prevBottom <= obstacleTop + LANDING_TOLERANCE && currBottom >= obstacleTop - 1 && player.vy >= 0) {
            player.y = obstacleTop - playerRadius;
            player.vy = 0;
            player.onGround = true;
            try { if ((player as any).maxJumps !== undefined) (player as any).jumpsLeft = (player as any).maxJumps; } catch (e) {}
            player.sprite.y = player.y;
            try {
              // Chỉ layer Danger mới gây chết, layer UI chỉ block
              // Exclude plane/platform decorations from causing death even if
              // their layer is 'Danger' — they should block but not kill when
              // the player is merely pushed into them.
              if (!(o as any).isGround && (o as any).layer === 'Danger' && !(o as any).isPlane && !(o as any).isPlatform && !playerInvincible) {
                if (!deathHandled) {
                  deathHandled = true;
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
            // Player is intersecting the obstacle vertically (side contact).
            // Resolve horizontal penetration by moving the player the minimal
            // distance out of the obstacle (symmetric) so the player cannot
            // pass through. This avoids large forced snaps while ensuring
            // blocking behavior.
            let _penetrationForDeath = 0;
            try {
              const playerLeft = player.worldX - playerRadius;
              const playerRight = player.worldX + playerRadius;
              const overlapFromLeft = playerRight - left; // positive if overlapping into obstacle from left
              const overlapFromRight = right - playerLeft; // positive if overlapping into obstacle from right

              if (overlapFromLeft > 0 && overlapFromRight > 0) {
                // Both computed overlaps > 0 means the player circle intersects horizontally.
                // Move by the smaller penetration amount plus a tiny epsilon.
                const EPS = 1;
                if (overlapFromLeft < overlapFromRight) {
                  player.worldX -= (overlapFromLeft + EPS);
                  _penetrationForDeath = overlapFromLeft;
                } else {
                  player.worldX += (overlapFromRight + EPS);
                  _penetrationForDeath = overlapFromRight;
                }
              }
            } catch (e) {}

            // Always keep sprite in sync with worldX after resolution
            try { player.sprite.x = player.worldX; } catch (e) {}

            try {
              // Only layer 'Danger' should trigger death; 'UI' planes only block
              // Exclude planes/platforms from lethal death on side-contact push.
              // Require a minimum horizontal penetration so short pushes don't kill.
              const LETHAL_PENETRATION = 20; // pixels
              if (!(o as any).isGround && (o as any).layer === 'Danger' && !(o as any).isPlane && !(o as any).isPlatform && _penetrationForDeath > LETHAL_PENETRATION && !playerInvincible) {
                if (!deathHandled) {
                  deathHandled = true;
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

    try {

      // Máy bay chỉ là decoration, không có collision
    } catch (e) {}

    try {
      if (spinePlayerInstance) {
        // DEBUG: Log spine state every few seconds (throttled)
        if (Math.floor(Date.now() / 5000) % 2 === 0 && Math.random() < 0.001) {
        }
        
        let shouldShowRun = false;
        
        if (player.onGround) {
          const platforms = (gameplay as any).getPlatforms ? (gameplay as any).getPlatforms() : [];
          const obstacles = [ ...(platforms || []), ...((gameplay as any).getObstacles ? (gameplay as any).getObstacles() : []) ];
          const playerBottom = player.y + playerRadius;

          for (const o of obstacles) {
            const left = o.x;
            const right = o.x + o.width;
            if (player.worldX + playerRadius > left && player.worldX - playerRadius < right) {
              const obstacleTop = o.sprite.y;
              // Treat ground, platform and plane colliders as valid 'running' surfaces
              if (Math.abs(playerBottom - obstacleTop) <= 8 && (o.isGround || (o as any).isPlane || (o as any).isPlatform)) {
                shouldShowRun = true;
                break;
              }
            }
          }
        }
        
        try {
          if (playerDead) {
            // Only trigger the death animation once — `deathHandled` is set
            // when the death sequence runs so the ticker should not replay
            // the 'die' animation every frame.
            if (!deathHandled) {
              try { if (spinePlayerInstance && spinePlayerInstance.pauseTrack) spinePlayerInstance.pauseTrack(0); } catch (e) {}
              try { if (spinePlayerInstance && spinePlayerInstance.play) spinePlayerInstance.play('die', false, 0); } catch (e) {}
            }
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

        // Scale the amount above 1 proportionally to the current camera scale
        // so animation speed increases/decreases with camera percentage
        const cam = (typeof currentScale === 'number' && currentScale > 0) ? currentScale : 1;
        ts = (1 + (ts - 1) * cam)*0.2;

        // Clamp to a sensible range; allow max to grow with camera a bit
        const MIN_TS = 0.7;
        const MAX_TS = 2.2 * Math.max(1, cam);
        ts = Math.min(Math.max(ts, MIN_TS), MAX_TS);

        spinePlayerInstance.setTimeScale(ts);
      }
    } catch (e) {}

    // Do not counter-scale the player here; let `root.scale` scale all actors
    // together so character, patterns and background keep the same ratio.

    // Stop background parallax animations when game over
    if (!gameOver && controlsEnabled) {
      try { if (cloudBigLayer && cloudBigLayer.update) cloudBigLayer.update(scroll); } catch (e) {}
      try { if (cloudSmallLayer && cloudSmallLayer.update) cloudSmallLayer.update(scroll); } catch (e) {}
      try {
        if (cityLayer && cityLayer.update) cityLayer.update(scroll);
      } catch (e) {}
    }

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

          const btnText = new Text({ text: 'Install', style: btnStyle });
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

          btnG.on && btnG.on('pointerdown', (e: any) => {
            try { if (e && e.data && e.data.originalEvent && typeof e.data.originalEvent.stopPropagation === 'function') e.data.originalEvent.stopPropagation(); else if (e && typeof e.stopPropagation === 'function') e.stopPropagation(); } catch (e) {}
            // First prefer SDK install() from the imported/playable SDK
            try {
              if (typeof (sdk as any) !== 'undefined' && typeof (sdk as any).install === 'function') {
                try { (sdk as any).install(); rewardClaimed = true; controlsEnabled = false; } catch (e) {}
                return;
              }
            } catch (e) {}

            // Gọi hàm CTA custom: nếu FbPlayableAd.onCTAClick tồn tại gọi nó,
            // nếu không (hoặc trong trường hợp lỗi) chuyển hướng tới GOOGLE/APP store URL nếu có
            try {
              const url = (window as any).GOOGLE_PLAY_URL || (window as any).APP_STORE_URL || '/';
              const mraid = (window as any).mraid;

              // If MRAID exists, prefer it but only call open when the creative is viewable
              if (mraid && typeof mraid.open === 'function') {
                try {
                  const isViewable = typeof mraid.isViewable === 'function' ? mraid.isViewable() : true;
                  const state = typeof mraid.getState === 'function' ? mraid.getState() : null;

                  const doOpen = () => {
                    try { mraid.open(url); } catch (e) { try { window.open(url, '_blank'); } catch (e) {} }
                  };

                  if (isViewable || state === 'default' || state === 'expanded') {
                    doOpen();
                    return;
                  }

                  // Not viewable yet (likely pre-roll). Wait for viewableChange or stateChange.
                  const listener = () => {
                    try {
                      const nowViewable = typeof mraid.isViewable === 'function' ? mraid.isViewable() : true;
                      if (nowViewable) {
                        doOpen();
                        try { mraid.removeEventListener && mraid.removeEventListener('viewableChange', listener); } catch (e) {}
                        try { mraid.removeEventListener && mraid.removeEventListener('stateChange', listener); } catch (e) {}
                      }
                    } catch (e) {}
                  };

                  try { mraid.addEventListener && mraid.addEventListener('viewableChange', listener); } catch (e) {}
                  try { mraid.addEventListener && mraid.addEventListener('stateChange', listener); } catch (e) {}

                  // Safety fallback: open after 30s if not viewable
                  setTimeout(() => { try { doOpen(); } catch (e) {} }, 30000);
                  return;
                } catch (e) {
                  // fall through to other handlers
                }
              }

              // Then try FbPlayableAd hook
              if (typeof (window as any).FbPlayableAd !== 'undefined' && (window as any).FbPlayableAd.onCTAClick) {
                try { (window as any).FbPlayableAd.onCTAClick(); return; } catch (e) { /* fallback below */ }
              }

              // Last resort: open in new tab/window
              try { window.open(url, '_blank'); } catch (e) { console.log('CTA click fallback failed', e); }
            } catch (e) {
              try { window.open((window as any).GOOGLE_PLAY_URL || (window as any).APP_STORE_URL || '/', '_blank'); } catch (e) {}
            }
            try { rewardClaimed = true; controlsEnabled = false; } catch (e) {}
          });

          closeG.on && closeG.on('pointerdown', (e: any) => {
            try { if (e && e.data && e.data.originalEvent && typeof e.data.originalEvent.stopPropagation === 'function') e.data.originalEvent.stopPropagation(); else if (e && typeof e.stopPropagation === 'function') e.stopPropagation(); } catch (e) {}
            try { if (overlay.parent) overlay.parent.removeChild(overlay); } catch (e) {}
            try {
              rewardActive = false;
              rewardPermanentStop = false;
              controlsEnabled = true;
              // Clear held input state and consume the next pointerdown so clicking "Later"
              // doesn't immediately trigger a jump due to spam/click-through.
              try { pointerHeld = false; spaceHeld = false; consumeNextPointerDown = true; } catch (e) {}
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
  let gameStartTime = 0; // Track when game started to prevent immediate game over
  
  // Flag to preserve scale during restart
  let isRestarting = false;

  async function restartGame() {
    isRestarting = true; // Prevent scale changes during restart
    
    try { SoundController.stopAll(); } catch (e) {}
    
    
    gameOver = false;
    playerDead = false;
    controlsEnabled = false; // Tạm tắt controls trong khi restart
    gameStartTime = Date.now(); // Set game start time for grace period
    try { console.log('GAME START: calling window.gameStart / window.mintGameStart'); } catch (e) {}
    try { (window as any).gameStart && (window as any).gameStart(); } catch (e) {}
    try { (window as any).mintGameStart && (window as any).mintGameStart(); } catch (e) {}
    
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

    // Destroy player shadow if present so it can be recreated cleanly
    try { if (playerShadowInstance && typeof playerShadowInstance.destroy === 'function') { try { playerShadowInstance.destroy(); } catch (e) {} } playerShadowInstance = null; } catch (e) {}

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
      // Reset player to initial position first
      player.worldX = PLAYER_X; 
      player.vy = 0; 
      player.y = groundY - playerRadius; // Đặt player ở vị trí an toàn trên mặt đất
      player.sprite.x = PLAYER_X;
      player.sprite.y = player.y; 
      prevScore = 0; 
      score = 0; 
      scoreText.text = `Score: ${score}`;
      
      // Set camera position to match initial player position
      const TARGET_SCREEN_X = Math.round(WIDTH / 3);
      const desiredScroll = PLAYER_X - TARGET_SCREEN_X;
      world.x = -desiredScroll;
      world.y = 250; // Maintain camera Y offset - consistent with runtime camera
    } catch (e) {}

    // Clear death handled/invincibility flags
    try { playerInvincible = false; deathHandled = false; } catch (e) {}

    try { await startGame(); } catch (e) {}
    
    // Bật lại controls sau khi startGame hoàn thành
    controlsEnabled = true;
    (window as any).__controlsEnabled = true;
    // Clear held input state and consume the next pointerdown so spam clicks
    // during the UI don't immediately trigger a jump.
    try { pointerHeld = false; spaceHeld = false; consumeNextPointerDown = true; } catch (e) {}
    
    // Delay before re-enabling scale changes to ensure restart is fully complete
    setTimeout(() => {
      isRestarting = false; // Re-enable scale changes after restart completes
    }, 100);
  }

  let controlsEnabled = false;
  let playerDead = false;
  let playerInvincible = false;
  let _prevPlayerInvincible = false;
  let _invincibleBlinkStart = 0;
  const INVINCIBLE_BLINK_PERIOD = 180; // ms
  const INVINCIBLE_BLINK_ALPHA = 0.25;
  let deathHandled = false;

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
    try { console.log('doGameOver called', finalReason, 'force=', force, 'playerInvincible=', playerInvincible, 'deathHandled=', deathHandled); } catch (e) {}
    try {
      if (!force) {
        const handler = (gameplay as any)._handler;
        const onPattern = handler && handler.isOnPattern ? handler.isOnPattern(player.worldX) : false;
        if (onPattern && player && player.onGround) {

          return;
        }
      }
    } catch (e) {}

    // IMMEDIATELY disable player controls and show death animation
    controlsEnabled = false;
    (window as any).__controlsEnabled = false; // Global flag for character input
    gameOver = true;
    playerDead = true;
    try { console.log('GAME END: calling window.gameEnd / window.mintGameClose'); } catch (e) {}
    try { (window as any).gameEnd && (window as any).gameEnd(); } catch (e) {}
    try { (window as any).mintGameClose && (window as any).mintGameClose(); } catch (e) {}
    
    // Clear particle system to prevent lingering effects
    try {
      ParticleManager.getInstance().clear();
    } catch (e) {}

    // Play death animation immediately
    try { 
      if (spinePlayerInstance && spinePlayerInstance.pauseTrack) spinePlayerInstance.pauseTrack(0);
      if (spinePlayerInstance && spinePlayerInstance.play) spinePlayerInstance.play('die', false, 0);
    } catch (e) {}

    try {
      try { console.log('calling showGameOver overlay'); } catch (e) {}
      showGameOver({ app, root, canvas, onPlayAgain: () => { try { restartGame(); } catch (e) { try { window.location.reload(); } catch (e) { try { location.reload(); } catch (e) {} } } }, onRespawn: () => {
        try {
          // Stop all sounds including game over audio
          try { SoundController.stopAll(); } catch (e) {}
          // Restart background music
          try { SoundController.playBackgroundForced(300); } catch (e) { try { SoundController.playBackground(); } catch (e) {} }
          
          // Attempt a lightweight respawn at the current visible pattern.
          try { gameOver = false; } catch (e) {}
          try { playerDead = false; controlsEnabled = true; (window as any).__controlsEnabled = true; } catch (e) {}
          try { playerInvincible = true; deathHandled = false; } catch (e) {}

          // Clear any held input state so the player can jump immediately after respawn
          try { pointerHeld = false; spaceHeld = false; } catch (e) {}

          // slow camera to 50% for 5s (user-requested)
          try {
            const handler = (gameplay as any)._handler;
            const origSpeed = handler && (handler as any).speed ? (handler as any).speed : (gameplay && typeof gameplay.getSpeed === 'function' ? gameplay.getSpeed() : null);
            if (handler && origSpeed !== null && origSpeed !== undefined) {
              try { (handler as any).speed = origSpeed * 0.75; } catch (e) {}
              setTimeout(() => { try { (handler as any).speed = origSpeed; } catch (e) {} }, 3000);
            }
          } catch (e) {}

          // reposition player to a safe spot on the currently visible pattern
          try {
            const handler = (gameplay as any)._handler;
            const scrollNow = (gameplay && typeof gameplay.getScroll === 'function') ? gameplay.getScroll() : (handler && (handler as any).scroll ? (handler as any).scroll : 0);
            let targetWorldX = scrollNow + PLAYER_X;

            // Try to pick a position inside the current or next visible pattern
            try {
              const patterns = handler && (handler as any).patterns ? (handler as any).patterns : null;
              if (patterns && Array.isArray(patterns) && patterns.length) {
                // find pattern that contains the screen X
                let found = patterns.find((p: any) => targetWorldX >= p.start && targetWorldX <= (p.start + p.length));
                if (!found) {
                  // otherwise pick the first pattern whose span is ahead of the camera
                  found = patterns.find((p: any) => (p.start + p.length) > scrollNow);
                }
                if (found) {
                  // choose a safe offset inside the pattern (not too close to edges)
                  const safeOffset = Math.min( Math.max(80, Math.floor(found.length / 6)), Math.max(80, Math.floor(found.length / 3)) );
                  targetWorldX = Math.min(found.start + Math.max(40, safeOffset), found.start + Math.max(40, Math.floor(found.length * 0.5)));
                }
              }
            } catch (e) {}

              try { player.worldX = targetWorldX; } catch (e) {}
            // Consume next pointerdown so any spam clicks that happened during UI
            // don't immediately trigger a jump when controls are re-enabled.
            try { pointerHeld = false; spaceHeld = false; consumeNextPointerDown = true; } catch (e) {}
            try { player.vy = 0; } catch (e) {}
            try {
              let surfaceY = groundY;
              try { if (handler && typeof handler.getSurfaceYAt === 'function') surfaceY = handler.getSurfaceYAt(player.worldX); } catch (e) {}
              player.y = surfaceY - playerRadius;
            } catch (e) {}
            try { if (player && player.sprite) { player.sprite.x = player.worldX; player.sprite.y = player.y; } } catch (e) {}
            try { player.onGround = true; if ((player as any).maxJumps !== undefined) (player as any).jumpsLeft = (player as any).maxJumps; } catch (e) {}
            
            // Update camera position to match new player position
            try {
              const TARGET_SCREEN_X = Math.round(WIDTH / 3);
              const desiredScroll = targetWorldX - TARGET_SCREEN_X;
              world.x = -desiredScroll;
              world.y = -100; // Maintain camera Y offset
              if (handler) {
                try { handler.scroll = desiredScroll; } catch (e) {}
                // DISABLED: Don't set handler.world.x - it conflicts with main world.x
                // try { if (handler.world) handler.world.x = -desiredScroll; } catch (e) {}
              }
            } catch (e) {}
          } catch (e) {}

          // temporary invincibility for 3s
          try { setTimeout(() => { try { playerInvincible = false; } catch (e) {} }, 3000); } catch (e) {}

          // Restart background music if needed
          try {
            SoundController.playBackgroundForced(300);
            backgroundStarted = true;
          } catch (e) {
            try { SoundController.playBackground(); } catch (e) {}
          }

          try { if (spinePlayerInstance && spinePlayerInstance.play) { try { spinePlayerInstance.play('run', true, 0); } catch (e) {} } } catch (e) {}
        } catch (e) {}
      } });
    } catch (e) { try { console.error('showGameOver threw', e); } catch (e2) {} }
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
    // Always perform an offscreen-Y check (even if controlsDisabled)
    try {
      // Add grace period check - don't trigger game over in first 2 seconds after game start
      const timeSinceStart = Date.now() - gameStartTime;
      const inGracePeriod = timeSinceStart < 2000; // 2 second grace period
      
      if (!gameOver && player && player.sprite && controlsEnabled && !inGracePeriod) {
        // Use internal game coordinates instead of screen coordinates
        const playerY = player.y || 0;
        const internalGameHeight = HEIGHT; // Use internal game resolution, not canvas CSS size
        
        // Check if player fell below internal game bounds (more generous threshold)
        if (playerY > (internalGameHeight + 200)) {
          try { doGameOver && doGameOver('fell_offscreen', true); } catch (e) { try { queueGameOver('fell_offscreen'); } catch (e2) {} }
        }
        
        // Check vertical gap relative to surface using internal coordinates
        try {
          const handlerNow = (gameplay as any)?._handler;
          let surfaceYNow = groundY;
          try { if (handlerNow && typeof handlerNow.getSurfaceYAt === 'function') surfaceYNow = handlerNow.getSurfaceYAt(player.worldX); } catch (e) {}
          const vGapNow = playerY - (surfaceYNow || 0);
         
          // More generous threshold for vertical gap (was 100, now 400)
          if (vGapNow > 400) {
            try { doGameOver && doGameOver('fell_too_far', true); } catch (e) { try { queueGameOver('fell_too_far'); } catch (e2) {} }
          }
        } catch (e) {}
      }
    } catch (e) {}
    if (gameOver || !controlsEnabled) return;
    
    // Additional grace period check for main game logic
    const timeSinceStart = Date.now() - gameStartTime;
    const inGracePeriod = timeSinceStart < 2000;
    if (inGracePeriod) return;
    try {
      try {
        const overPit = (gameplay as any).isOverPit ? (gameplay as any).isOverPit(player.worldX) : false;
        if (overPit && (player as any).vy > 60) {
          // const surfaceY = (player as any).getGroundY ? (player as any).getGroundY(player.worldX) : groundY;
          // const playerBottom = player.y + playerRadius;
          // if (playerBottom > surfaceY + 12) {
             
          //   doGameOver('fell-into-pit');
          //   return;
          // }
        }
      } catch (e) {}

      // Use internal game coordinates instead of screen coordinates for consistency
      const playerY = player.y || 0;
      const internalGameHeight = HEIGHT; // Use internal game resolution consistently

      // Also consider world-relative fall distance from the current surface using internal coords
      try {
        const handler = (gameplay as any)?._handler;
        let surfaceY = groundY;
        try {
          if (handler) {
            // Prefer the Y of the first spawned pattern when available
            try {
              if (Array.isArray((handler as any).patterns) && (handler as any).patterns.length > 0) {
                const p0 = (handler as any).patterns[0];
                if (p0 && p0.top !== undefined && p0.top !== null) {
                  surfaceY = p0.top;
                } else if (p0 && p0.playerYOffset !== undefined && (handler as any).groundY !== undefined) {
                  surfaceY = (handler as any).groundY + (p0.playerYOffset || 0);
                } else if (typeof handler.getSurfaceYAt === 'function') {
                  surfaceY = handler.getSurfaceYAt(player.worldX);
                }
              } else if (typeof handler.getSurfaceYAt === 'function') {
                surfaceY = handler.getSurfaceYAt(player.worldX);
              }
            } catch (e) {
              try { if (typeof handler.getSurfaceYAt === 'function') surfaceY = handler.getSurfaceYAt(player.worldX); } catch (e2) {}
            }
          }
        } catch (e) {}
        const verticalGap = playerY - (surfaceY || 0);
        
        // Use more generous thresholds that work consistently across all screen sizes
        if (verticalGap > 500) { // Increased from 300 to 500
          queueGameOver('fell_too_far');
        } else if (playerY > (internalGameHeight + 300)) { // Use internal coords + buffer instead of canvas size
          queueGameOver('fell_offscreen');
        }
      } catch (e) {
        // Fallback: use internal coordinates
        if (playerY > (internalGameHeight + 300)) {
          queueGameOver('fell_offscreen');
        }
      }
    } catch (e) {}
  });

  function updateScale() {
    // FIXED: Keep root scale at 1,1 - CSS handles all scaling
    // This prevents double-scaling issues
    try {
      root.scale.set(1, 1);
      root.position.set(0, 0);
    } catch (e) {}

    // Update HUD layout if needed
    try { layoutHud(); } catch (e) {}

    // Calculate scale for reference (used by HUD and other systems)
    const winW = window.innerWidth || WIDTH;
    const winH = window.innerHeight || HEIGHT;
    const scaleX = winW / WIDTH;
    const scaleY = winH / HEIGHT;
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     ('ontouchstart' in window) ||
                     (navigator.maxTouchPoints > 0) ||
                     (winW <= 768);
    
    const isLandscape = winW > winH;
    const aspectRatio = winW / winH;
    
    let s: number;
    
    // Match the logic from applyCanvasCssSize()
    if (isMobile) {
      if (isLandscape) {
        // Mobile landscape: OPTIMAL - fill screen maximally
        s = Math.max(scaleX, scaleY * 0.9);
        s = Math.min(s, 1.5); // Allow up to 1.5x for better mobile experience
      } else {
        // Mobile portrait: minimal scale, encourage rotation
        s = Math.min(scaleX, scaleY) * 0.6; // Smaller scale to encourage landscape
      }
    } else {
      // Desktop logic: standard letterbox
      const rawScale = Math.min(scaleX, scaleY);
      const allowUpscale = (winW >= 1280 && aspectRatio >= 1.5);
      const maxScale = allowUpscale ? 1.8 : 1.2;
      s = Math.min(rawScale, maxScale);
    }
    
    // Ensure minimum scale for readability
    s = Math.max(s, 0.3);
    
    currentScale = s;
    // Note: We don't dispatch screen-scale event here to avoid double scaling
  }

  updateScale();

  // Notify interested code that screen scale was updated so containers
  // currently on-screen can react (e.g. adjust internal scaling).
  try {
    try { window && (window as any).dispatchEvent && (window as any).dispatchEvent(new CustomEvent('screen-scale', { detail: { scale: currentScale } })); } catch (e) {}
  } catch (e) {}

  // Show a gray "click to play" overlay on initial load so the game
  // only starts after a user gesture (necessary for audio on some browsers).
  async function showClickToPlayOverlay() {
    return new Promise<void>((resolve) => {
      try {
        const overlay = new Container();
        overlay.zIndex = 100000;
        overlay.interactive = true;

        const overlayBg = new Graphics();
        try { overlayBg.clear(); overlayBg.beginFill(0x000000, 0.6); overlayBg.drawRect(0, 0, WIDTH, HEIGHT); overlayBg.endFill(); } catch (e) {}
        overlay.addChild(overlayBg);

        const style = new TextStyle({ fill: '#ffffff', fontSize: 28, fontFamily: 'Helvetica-Bold' });
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 768);
        const labelText = isMobile ? 'Tap to Play' : 'Click to Play';
        const label = new Text({ text: labelText, style });
        label.x = Math.round((WIDTH - label.width) / 2);
        label.y = Math.round((HEIGHT - label.height) / 2);
        overlay.addChild(label);

        const start = () => {
          try { if (overlay.parent) overlay.parent.removeChild(overlay); } catch (e) {}
          try { window.removeEventListener('keydown', onKey); } catch (e) {}
          resolve();
        };

        const onPointer = (e: any) => { try { if (e && e.data && e.data.originalEvent && typeof e.data.originalEvent.stopPropagation === 'function') e.data.originalEvent.stopPropagation(); } catch (e) {} ; start(); };
        const onKey = (ev: any) => { if (ev && (ev.code === 'Space' || ev.code === 'Enter')) { ev.preventDefault && ev.preventDefault(); start(); } };

        overlay.on && overlay.on('pointerdown', onPointer);
        try { window.addEventListener('keydown', onKey); } catch (e) {}

        try { app.stage.addChild(overlay); } catch (e) { try { root.addChild(overlay); } catch (e) {} }
      } catch (e) {
        // If overlay creation fails for any reason, resolve to avoid blocking startup
        resolve();
      }
    });
  }

  try { await showClickToPlayOverlay(); } catch (e) {}
  try { await startGame(); } catch (e) {}
  try { controlsEnabled = true; (window as any).__controlsEnabled = true; gameStartTime = Date.now(); } catch (e) {}

  function onResize() {
    // Skip resize during restart to preserve scale
    if (isRestarting) return;
    
    applyCanvasCssSize();
    updateScale();
  }

  // DISABLED: Listen for external `screen-scale` events - this was causing double scaling
  // CSS scaling handles everything, no need for root.scale manipulation
  /*
  try {
    window.addEventListener('screen-scale', (ev: any) => {
      try {
        const s = ev && ev.detail && typeof ev.detail.scale === 'number' ? ev.detail.scale : currentScale;
        currentScale = s;
        // REMOVED: root.scale.set(s, s) to prevent double scaling

        // Give known actors a chance to react: any child that exposes
        // `setScreenScale(scale)`. We intentionally do NOT call this on the
        // player so the player scales with `root.scale` and keeps the same
        // ratio to patterns/backgrounds.
        try {
          const arr = root && (root as any).children ? (root as any).children.slice() : [];
          for (const c of arr) {
            try {
              if (c && typeof (c as any).setScreenScale === 'function') {
                try { (c as any).setScreenScale(s); } catch (e) {}
              }
            } catch (e) {}
          }
        } catch (e) {}
        try { layoutHud(); } catch (e) {}
      } catch (e) {}
    });
  } catch (e) {}
  */

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
  
  // Enhanced orientation change handling for mobile devices
  let orientationTimer: number | null = null;
  
  function handleOrientationChange() {
    // Skip orientation change during restart
    if (isRestarting) return;
    
    // Clear existing timer
    if (orientationTimer) {
      clearTimeout(orientationTimer);
    }
    
    // Delay handling to allow mobile browsers to complete orientation change
    orientationTimer = window.setTimeout(() => {
      try {
        // Force a layout recalculation
        if (document.body) {
          document.body.style.height = '100%';
          document.body.style.width = '100%';
        }
        
        // Additional delay for mobile browsers that need more time
        window.setTimeout(() => {
          try {
            onResize();
            // Force a second layout update for stubborn mobile browsers
            window.setTimeout(onResize, 100);
          } catch (e) {}
        }, 100);
      } catch (e) {}
    }, 300);
  }
  
  window.addEventListener('orientationchange', handleOrientationChange);
  
  // Also listen to screen orientation API if available
  if (screen && screen.orientation) {
    screen.orientation.addEventListener('change', handleOrientationChange);
  }
  
  // Additional mobile-specific event listeners
  window.addEventListener('load', onResize);
  document.addEventListener('DOMContentLoaded', onResize);
}

// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM is already loaded
  init();
}