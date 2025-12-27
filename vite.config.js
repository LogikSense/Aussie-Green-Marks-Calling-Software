import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Check if HTTPS is enabled via environment variable
const useHttps = process.env.VITE_USE_HTTPS === 'true'
const backendUrl = useHttps ? 'https://localhost:8000' : 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
      }
    }
  }
})

