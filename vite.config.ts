import { defineConfig } from 'vite';
import * as singleFileMod from 'vite-plugin-singlefile';
const singleFile = (singleFileMod as any).default ?? singleFileMod;

// Vite config tuned for building a single-file playable HTML
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    // use esbuild minifier to avoid optional terser dependency on some environments
    minify: 'esbuild',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  plugins: ((): any[] => {
    const p = [] as any[];
    try {
      if (typeof singleFile === 'function') p.push(singleFile());
    } catch (e) {}
    return p;
  })(),
});
