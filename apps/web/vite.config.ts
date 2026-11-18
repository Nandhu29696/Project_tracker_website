import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The API is reached through the dev-server proxy, so the browser only ever
// talks to one origin (cookies + Google OAuth callback work without CORS).
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false, xfwd: true },
      // live updates (Socket.IO websocket)
      '/socket.io': { target: apiTarget, ws: true, xfwd: true },
    },
  },
  preview: { port: 4173 },
});
