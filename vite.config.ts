import { defineConfig } from 'vite';
import { resolve } from 'path';
import { ai3dProxyPlugin } from './vite-plugin-ai3d.js';

export default defineConfig({
  base: './',
  plugins: [ai3dProxyPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: false,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        operator: resolve(__dirname, 'operator.html'),
        generator: resolve(__dirname, 'generator.html'),
      },
    },
  },
});
