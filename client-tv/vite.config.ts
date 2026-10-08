import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // The workspace package ships TypeScript source, so it must not be pre-bundled.
  optimizeDeps: { exclude: ['@wordt/shared'] },
  // Built output is served from /tv by the Render web service; dev stays at the root.
  base: command === 'build' ? '/tv/' : '/',
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
}));
