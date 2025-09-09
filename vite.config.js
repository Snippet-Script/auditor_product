import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Allow Render domain and bind to 0.0.0.0 with PORT for preview
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // Keep local dev flexible; allowedHosts only affects external access
  allowedHosts: ['auditor-product-1.onrender.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 4173,
    strictPort: true,
  allowedHosts: ['auditor-product.onrender.com', 'auditor-product-1.onrender.com'],
  },
})
