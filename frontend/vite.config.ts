import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Provide lightweight polyfills for Node globals used by swagger-parser (Buffer, path)
const polyfillPlugin = {
  name: 'node-polyfills-lite',
  resolveId(id: string) {
    if (id === 'path') return { id: 'path-browserify' } as any;
    return null;
  }
};

export default defineConfig({
  plugins: [react(), polyfillPlugin],
  build: {
    target: 'es2022'
  },
  optimizeDeps: {
    include: ['buffer', 'path-browserify']
  },
  define: {
    'process.env': {},
    'global': 'globalThis'
  },
  resolve: {
    alias: {
      path: 'path-browserify'
    }
  }
});
