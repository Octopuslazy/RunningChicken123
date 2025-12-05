import { Application, Container, Graphics, Sprite, Texture, Text, TextStyle } from 'pixi.js';
import SoundController from '../sound/SoundController';

export type ShowGameOverParams = {
  app: Application;
  root: Container;
  canvas: HTMLCanvasElement;
  onPlayAgain?: () => void;
};

export function showGameOver(params: ShowGameOverParams) {
  const { app, root, canvas, onPlayAgain } = params;
  let overlayContainer: Container | null = null;
  let gt: Text | null = null;
  let btnBg: Graphics | null = null;
  let btnText: Text | null = null;
  let _btnPulseTicker: ((ticker?: any) => void) | null = null;

  try {
    // Use the renderer/screen size so the overlay matches the game's internal resolution
    const sw = (app.screen && (app.screen as any).width) ? (app.screen as any).width : (app.renderer && (app.renderer as any).width) || canvas.clientWidth || window.innerWidth;
    const sh = (app.screen && (app.screen as any).height) ? (app.screen as any).height : (app.renderer && (app.renderer as any).height) || canvas.clientHeight || window.innerHeight;

    // Try to use a gameover image, otherwise fall back to a dark overlay
    let usedContainer: Container | null = null;
    try {
      const goTex = Texture.from('/Assets/_arts/gameover.jpg');
      if (goTex && (goTex as any).width) {
        const container = new Container();

        const bg = new Graphics();
        try {
          if (typeof (bg as any).fill === 'function') {
            try { (bg as any).fill(0x333333, 0.6); } catch (e) { try { (bg as any).fill({ color: 0x333333, alpha: 0.6 }); } catch (e) {} }
          } else {
            (bg as any).beginFill && (bg as any).beginFill(0x333333, 0.6);
          }
        } catch (e) {}
        try { (bg as any).rect ? (bg as any).rect(0, 0, sw, sh) : (bg as any).drawRect && (bg as any).drawRect(0, 0, sw, sh); } catch (e) {}
        try { (bg as any).endFill && (bg as any).endFill(); } catch (e) {}
        try { bg.interactive = true; } catch (e) {}

        const spr = new Sprite(goTex as any);
        try { if (spr.anchor && spr.anchor.set) spr.anchor.set(0.5, 0.5); } catch (e) {}
        try { if (spr.scale) spr.scale.set(2, 2); } catch (e) {}
        spr.x = Math.round(sw / 2);
        spr.y = Math.round(sh / 2) + 200;

        container.addChild(bg);
        container.addChild(spr);
        container.zIndex = 100000;
        try { app.stage.sortableChildren = true; } catch (e) {}
        try { app.stage.addChild(container); } catch (e) { try { root.addChild(container); } catch (e) {} }
        usedContainer = container;
        try { SoundController.stopAllAndPlay('nan.mp3'); } catch (e) {}
      }
    } catch (e) {
      usedContainer = null;
    }

    if (!usedContainer) {
      const g = new Graphics();
      try {
        if (typeof (g as any).fill === 'function') {
          try { (g as any).fill(0x000000, 0.65); } catch (e) { try { (g as any).fill({ color: 0x000000, alpha: 0.65 }); } catch (e) {} }
        } else {
          (g as any).beginFill && (g as any).beginFill(0x000000, 0.65);
        }
      } catch (e) {}
      try { (g as any).rect ? (g as any).rect(0, 0, sw, sh) : (g as any).drawRect && (g as any).drawRect(0, 0, sw, sh); } catch (e) {}
      try { (g as any).endFill && (g as any).endFill(); } catch (e) {}
      g.zIndex = 100000;
      try { g.interactive = true; } catch (e) {}
      try { app.stage.addChild(g); } catch (e) { try { root.addChild(g); } catch (e) {} }
      usedContainer = new Container();
      usedContainer.addChild(g);
    }

    overlayContainer = usedContainer;

    // Use a simple valid color string for black. If the background is dark
    // add a light stroke so the text remains readable. Cast the options to
    // `any` to avoid TypeScript complaining about properties that differ
    // between Pixi type versions (e.g. `strokeThickness`). We still set
    // the strokeThickness explicitly on the created TextStyle instance.
    const gs = new TextStyle({ fill: '#000000', stroke: '#ffffff', fontSize: 96, fontFamily: 'Helvetica-Bold', fontWeight: 'bold' } as any);
    try { (gs as any).strokeThickness = 6; } catch (e) {}
    gt = new Text({ text: 'GAME OVER', style: gs });
    try { if (gt.anchor && (gt as any).anchor.set) (gt as any).anchor.set(0.5, 0.5); } catch (e) {}
    gt.x = sw / 2;
    gt.y = sh / 2 - 20;
    try { overlayContainer && overlayContainer.addChild(gt); } catch (e) { try { app.stage.addChild(gt); } catch (e) { try { root.addChild(gt); } catch (e) {} } }

    // Play Again button
    try {
      const btnW = 320; const btnH = 64;
      const btnX = Math.round(sw / 2 - btnW / 2);
      const btnY = Math.round(sh / 2 + 60);
      btnBg = new Graphics();
      try {
        if (typeof (btnBg as any).fill === 'function') {
          try { (btnBg as any).fill(0xffffff, 1); } catch (e) { try { (btnBg as any).fill({ color: 0xffffff, alpha: 0 }); } catch (e) {} }
        } else {
          (btnBg as any).beginFill && (btnBg as any).beginFill(0xffffff, 1);
        }
      } catch (e) {}
      try { (btnBg as any).drawRoundedRect ? (btnBg as any).drawRoundedRect(btnX, btnY, btnW, btnH, 8) : (btnBg as any).roundedRect && (btnBg as any).roundedRect(btnX, btnY, btnW, btnH, 8); } catch (e) {}
      try { (btnBg as any).endFill && (btnBg as any).endFill(); } catch (e) {}
      btnBg.zIndex = 100001;
      // Set pivot to the center of the drawn rectangle and position btnBg
      // at the center so scaling will occur around the visual center.
      try {
        const centerX = btnX + btnW / 2;
        const centerY = btnY + btnH / 2;
        try { (btnBg as any).pivot && (btnBg as any).pivot.set ? (btnBg as any).pivot.set(centerX, centerY) : ((btnBg as any).pivot = { x: centerX, y: centerY }); } catch (e) {}
        try { (btnBg as any).x = Math.round(sw / 2); (btnBg as any).y = Math.round(centerY); } catch (e) {}
      } catch (e) {}
      try { (btnBg as any).interactive = true; (btnBg as any).buttonMode = true; } catch (e) {}
      try { overlayContainer && overlayContainer.addChild(btnBg); } catch (e) { try { app.stage.addChild(btnBg); } catch (e) { try { root.addChild(btnBg); } catch (e) {} } }

      const bts = new TextStyle({ fill: '#222222', fontSize: 28, fontFamily: 'Helvetica-Bold' });
      btnText = new Text({ text: 'Play Again', style: bts });
      btnText.x = sw / 2;
      btnText.y = btnY + btnH / 2;
      try { if (btnText.anchor && (btnText as any).anchor.set) (btnText as any).anchor.set(0.5, 0.5); } catch (e) {}
      btnText.zIndex = 100002;
      try { overlayContainer && overlayContainer.addChild(btnText); } catch (e) { try { app.stage.addChild(btnText); } catch (e) { try { root.addChild(btnText); } catch (e) {} } }

      const cleanupAndReset = () => {
        try { if (_btnPulseTicker) { try { app.ticker.remove(_btnPulseTicker); } catch (e) {} _btnPulseTicker = null; } } catch (e) {}
        try { if (overlayContainer && overlayContainer.parent) overlayContainer.parent.removeChild(overlayContainer); } catch (e) { try { if (overlayContainer && root && overlayContainer.parent) root.removeChild(overlayContainer); } catch (e) {} }
        try { if (gt && gt.parent) gt.parent.removeChild(gt); } catch (e) { try { if (gt && root) root.removeChild(gt); } catch (e) {} }
        try { if (btnBg && btnBg.parent) btnBg.parent.removeChild(btnBg); } catch (e) { try { if (btnBg && root) root.removeChild(btnBg); } catch (e) {} }
        try { if (btnText && btnText.parent) btnText.parent.removeChild(btnText); } catch (e) { try { if (btnText && root) root.removeChild(btnText); } catch (e) {} }
      };

      const onDown = () => {
        try {
          // remove the overlay first so visuals are cleaned up immediately
          try { cleanupAndReset(); } catch (e) {}
          if (typeof onPlayAgain === 'function') {
            try { onPlayAgain(); } catch (e) {}
          } else {
            try { window.location.reload(); } catch (e) { try { location.reload(); } catch (e) {} }
          }
        } catch (e) {}
      };

      try { btnBg.on && btnBg.on('pointerdown', onDown); } catch (e) {}

      // Start pulsing animation for the Play Again button (scale loop 0.8 -> 1.2)
      try {
        const periodMs = 1000; // full cycle duration in ms
        const start = (performance && performance.now) ? performance.now() : Date.now();
        _btnPulseTicker = (ticker?: any) => {
          try {
            const now = (performance && performance.now) ? performance.now() : Date.now();
            const angle = ((now - start) % periodMs) / periodMs * (Math.PI * 2);
            const eased = (Math.sin(angle) + 1) / 2; // 0..1
            const scaleVal = 0.8 + eased * (1.2 - 0.8);
            try { if (btnBg && (btnBg as any).scale) (btnBg as any).scale.set(scaleVal, scaleVal); } catch (e) {}
            try { if (btnText && (btnText as any).scale) (btnText as any).scale.set(scaleVal, scaleVal); } catch (e) {}
          } catch (e) {}
        };
        try { app.ticker.add(_btnPulseTicker); } catch (e) {}
      } catch (e) {}
    } catch (e) {}
  } catch (e) {}

  return {
    cleanup: () => {
      try { if (overlayContainer && overlayContainer.parent) overlayContainer.parent.removeChild(overlayContainer); } catch (e) {}
      try { if (gt && gt.parent) gt.parent.removeChild(gt); } catch (e) {}
      try { if (btnBg && btnBg.parent) btnBg.parent.removeChild(btnBg); } catch (e) {}
      try { if (btnText && btnText.parent) btnText.parent.removeChild(btnText); } catch (e) {}
    }
  };
}

export default showGameOver;
