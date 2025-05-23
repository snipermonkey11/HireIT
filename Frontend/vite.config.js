import { defineConfig } from 'vite'

export default defineConfig({
   build: {
    outDir: 'dist',
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  },
});
