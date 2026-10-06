import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // The workspace package ships TypeScript source, so it must not be pre-bundled.
  optimizeDeps: { exclude: ['@wordt/shared'] },
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
});
