import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on the LAN too, so other devices can open the dashboard
    // The browser calls /api on the dashboard's own origin and Vite forwards it to
    // the FastAPI backend, so only port 5173 has to be reachable from other devices.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
