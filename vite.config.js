import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const useHttps = process.env.VITE_USE_HTTPS === 'true'
const backendUrl = useHttps ? 'https://localhost:8000' : 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  server: {
    port: 8080,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

