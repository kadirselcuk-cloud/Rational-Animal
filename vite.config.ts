import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the game from /Rational-Animal/, so CI builds use
  // that base; everywhere else (local dev and local builds) stays at root.
  base: process.env.GITHUB_ACTIONS ? '/Rational-Animal/' : '/',
  // Dedicated port for this game — 5173 is taken by another app on the
  // owner's machine. strictPort makes Vite fail loudly instead of silently
  // hopping to a different port, so the URL stays stable.
  server: {
    port: 5180,
    strictPort: true,
  },
});
