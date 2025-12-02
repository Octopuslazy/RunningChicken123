# Running Chicken — Pixi v8 Scaffold

This scaffold sets up a minimal Vite + Pixi v8 project in the current folder. It uses the existing `Assets/` folder (if image files exist) and falls back to a simple Graphics demo when assets are missing.

Setup & run (PowerShell):

```powershell
cd "d:/testvd/RunningChicken"
npm install
npm run dev
```

Open the URL shown by Vite (usually `http://localhost:5173`) in your browser.

Notes:
- Assets already present in `Assets/` will be referenced by the demo (path `/Assets/back.png`).
- To use other images, update `src/main.js` or add paths to a loader.
