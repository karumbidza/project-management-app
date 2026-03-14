// FOLLO PERF
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - rarely change, cached longer
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
          'vendor-clerk': ['@clerk/clerk-react'],
          'vendor-ui': ['lucide-react', 'recharts', 'date-fns'],
        },
      },
    },
    // Minification
    minify: 'esbuild',
    target: 'esnext',
    // Chunk size warnings
    chunkSizeWarningLimit: 500,
  },
})
