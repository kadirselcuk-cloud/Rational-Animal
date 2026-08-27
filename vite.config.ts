import { defineConfig } from 'vite';

export default defineConfig({
  // Dedicated port for this game — 5173 is taken by another app on the
  // owner's machine. strictPort makes Vite fail loudly instead of silently
  // hopping to a different port, so the URL stays stable.
  server: {
    port: 5180,
    strictPort: true,
  },
});
