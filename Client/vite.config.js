// FOLLO PERF
// FOLLO PERF-2
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Upload source maps to Sentry on production builds
    // Requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT in .env
    sentryVitePlugin({
      org:       process.env.SENTRY_ORG,
      project:   process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Only upload when auth token is present (skips in dev)
      disable:   !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  build: {
    sourcemap: 'hidden', // generate source maps but don't serve them publicly
    // Code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - rarely change, cached longer
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
          'vendor-clerk': ['@clerk/clerk-react'],
          // recharts intentionally NOT pinned here — it's only used by the lazy
          // Reports route, so Rollup code-splits it into that async chunk instead
          // of loading ~all charts on every page.
          'vendor-ui': ['lucide-react', 'date-fns'],
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
