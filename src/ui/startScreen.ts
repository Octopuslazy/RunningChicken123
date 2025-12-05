import { Application, Container, Graphics, Sprite, Texture, Text, TextStyle } from 'pixi.js';

export type ShowStartParams = {
  app: Application;
  root: Container;
  canvas: HTMLCanvasElement;
  onStart?: () => void;
};

export function showStartScreen(params: ShowStartParams) {
  const { app, root, canvas, onStart } = params;
  let container: Container | null = null;
  let title: Text | null = null;
  let btnBg: Graphics | null = null;
  let btnText: Text | null = null;
  let pulseTicker: ((ticker?: any) => void) | null = null;

  try {
    const sw = canvas.clientWidth || window.innerWidth;
    const sh = canvas.clientHeight || window.innerHeight;

    container = new Container();
    container.zIndex = 90000;

    // blocking background (dark gray, interactive to absorb clicks)
    const bg = new Graphics();
    try {
      if (typeof (bg as any).fill === 'function') {
        try { (bg as any).fill(0x222222, 0.7); } catch (e) { try { (bg as any).fill({ color: 0x222222, alpha: 0.7 }); } catch (e) {} }
      } else {
        (bg as any).beginFill && (bg as any).beginFill(0x222222, 0.7);
      }
    } catch (e) {}
    try { (bg as any).rect ? (bg as any).rect(0, 0, sw, sh) : (bg as any).drawRect && (bg as any).drawRect(0, 0, sw, sh); } catch (e) {}
    try { (bg as any).endFill && (bg as any).endFill(); } catch (e) {}
    try { bg.interactive = true; } catch (e) {}
    container.addChild(bg);

    // optional hero image (fallback to text title)
    try {
      const tex = Texture.from('/Assets/_arts/start.jpg');
      if (tex && (tex as any).width) {
        const spr = new Sprite(tex as any);
        try { if (spr.anchor && spr.anchor.set) spr.anchor.set(0.5, 0.5); } catch (e) {}
        spr.x = Math.round(sw / 2);
        spr.y = Math.round(sh / 2) - 80;
        container.addChild(spr);
      }
    } catch (e) {}

    const titleStyle = new TextStyle({ fill: '#ffffff', fontSize: 72, fontFamily: 'Helvetica-Bold' });
    title = new Text({ text: 'RUNNING CHICKEN', style: titleStyle });
    try { if ((title as any).anchor && (title as any).anchor.set) (title as any).anchor.set(0.5, 0.5); } catch (e) {}
    title.x = Math.round(sw / 2);
    title.y = Math.round(sh / 2) - 180;
    container.addChild(title);

    // Play button
    const btnW = 300, btnH = 64;
    const btnX = Math.round((sw - btnW) / 2);
    const btnY = Math.round(sh / 2 + 60);
    btnBg = new Graphics();
    try {
      if (typeof (btnBg as any).fill === 'function') {
        try { (btnBg as any).fill(0xffffff, 1); } catch (e) { try { (btnBg as any).fill({ color: 0xffffff, alpha: 1 }); } catch (e) {} }
      } else {
        (btnBg as any).beginFill && (btnBg as any).beginFill(0xffffff, 1);
      }
    } catch (e) {}
    try { (btnBg as any).drawRoundedRect ? (btnBg as any).drawRoundedRect(btnX, btnY, btnW, btnH, 10) : (btnBg as any).roundedRect && (btnBg as any).roundedRect(btnX, btnY, btnW, btnH, 10); } catch (e) {}
    try { (btnBg as any).endFill && (btnBg as any).endFill(); } catch (e) {}
    // center pivot so scale won't move it
    try { const cx = btnX + btnW / 2; const cy = btnY + btnH / 2; (btnBg as any).pivot = { x: cx, y: cy }; (btnBg as any).x = Math.round(sw / 2); (btnBg as any).y = Math.round(cy); } catch (e) {}
    try { (btnBg as any).interactive = true; (btnBg as any).buttonMode = true; } catch (e) {}
    container.addChild(btnBg);

    const btStyle = new TextStyle({ fill: '#222222', fontSize: 28, fontFamily: 'Helvetica-Bold' });
    btnText = new Text({ text: 'PLAY', style: btStyle });
    try { if ((btnText as any).anchor && (btnText as any).anchor.set) (btnText as any).anchor.set(0.5, 0.5); } catch (e) {}
    btnText.x = Math.round(sw / 2);
    btnText.y = btnY + btnH / 2;
    container.addChild(btnText);

    try { app.stage.addChild(container); } catch (e) { try { root.addChild(container); } catch (e) {} }

    const doCleanup = () => {
      try { if (pulseTicker) { try { app.ticker.remove(pulseTicker); } catch (e) {} pulseTicker = null; } } catch (e) {}
      try { if (container && container.parent) container.parent.removeChild(container); } catch (e) { try { if (container && root) root.removeChild(container); } catch (e) {} }
      try { if (title && title.parent) title.parent.removeChild(title); } catch (e) { try { if (title && root) root.removeChild(title); } catch (e) {} }
      try { if (btnBg && btnBg.parent) btnBg.parent.removeChild(btnBg); } catch (e) { try { if (btnBg && root) root.removeChild(btnBg); } catch (e) {} }
      try { if (btnText && btnText.parent) btnText.parent.removeChild(btnText); } catch (e) { try { if (btnText && root) root.removeChild(btnText); } catch (e) {} }
    };

    const onPress = () => {
      try {
        doCleanup();
        if (typeof onStart === 'function') {
          try { onStart(); } catch (e) {}
        }
      } catch (e) {}
    };

    try { btnBg.on && btnBg.on('pointerdown', onPress); } catch (e) {}

    // small pulse for the Play button
    try {
      const periodMs = 900;
      const start = (performance && performance.now) ? performance.now() : Date.now();
      pulseTicker = (ticker?: any) => {
        try {
          const now = (performance && performance.now) ? performance.now() : Date.now();
          const angle = ((now - start) % periodMs) / periodMs * (Math.PI * 2);
          const eased = (Math.sin(angle) + 1) / 2;
          const s = 0.9 + eased * (1.1 - 0.9);
          try { if (btnBg && (btnBg as any).scale) (btnBg as any).scale.set(s, s); } catch (e) {}
          try { if (btnText && (btnText as any).scale) (btnText as any).scale.set(s, s); } catch (e) {}
        } catch (e) {}
      };
      try { app.ticker.add(pulseTicker); } catch (e) {}
    } catch (e) {}

  } catch (e) {}

  return {
    cleanup: () => {
      try { if (pulseTicker) { try { app.ticker.remove(pulseTicker); } catch (e) {} pulseTicker = null; } } catch (e) {}
      try { if (container && container.parent) container.parent.removeChild(container); } catch (e) {}
      try { if (title && title.parent) title.parent.removeChild(title); } catch (e) {}
      try { if (btnBg && btnBg.parent) btnBg.parent.removeChild(btnBg); } catch (e) {}
      try { if (btnText && btnText.parent) btnText.parent.removeChild(btnText); } catch (e) {}
    }
  };
}

export default showStartScreen;
