import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '../'),

  // Production build optimizations
  build: {
    // Enable source maps for debugging (can disable in prod)
    sourcemap: false,
    // Optimize chunk size warning threshold
    chunkSizeWarningLimit: 500,
    // Manual chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries - rarely change
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Authentication - loaded early but separate
          'vendor-keycloak': ['keycloak-js'],
          // Utility libraries - change infrequently
          'vendor-utils': ['file-saver', 'jszip', 'react-markdown', 'remark-gfm'],
          // Icon library - large but stable
          'vendor-icons': ['lucide-react'],
        }
      }
    },
    // Minification settings
    minify: 'esbuild',
    // Target modern browsers for smaller output
    target: 'esnext',
  },

  server: {
    proxy: {
      '/vault': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/generated': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
