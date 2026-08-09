import { defineConfig } from 'vite'

export default defineConfig({
  // relative asset paths so the build works at any URL
  // (GitHub Pages subpath, workers.dev, local file preview)
  base: './',
  build: {
    rollupOptions: {
      output: {
        // split the three.js runtime out of the app chunk (first-paint weight)
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
})
