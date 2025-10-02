import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // ✅ Use root path - FastAPI handles the /langgraphplayground/ prefix via ROOT_PATH
  base: '/',
  
  // Development server configuration
  server: {
    port: 3000,
    // Proxy API calls to FastAPI backend during development
    proxy: {
      '/threads': {
        target: 'http://localhost:2024',
        changeOrigin: true,
      },
      '/runs': {
        target: 'http://localhost:2024',
        changeOrigin: true,
      },
      '/graph': {
        target: 'http://localhost:2024',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:2024',
        changeOrigin: true,
      },
    }
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Optimize chunk size
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        }
      }
    }
  }
})
