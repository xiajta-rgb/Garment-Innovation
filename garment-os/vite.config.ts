import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { styleImagePlugin } from './server/style-image-plugin'
import { materialPlugin } from './server/material-plugin'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), styleImagePlugin(process.env,
    loadEnv(mode, process.cwd(), 'GARMENTOS_AIS_').GARMENTOS_AIS_ENV_FILE), materialPlugin(process.env)],
  server: {
    port: 5341,
    strictPort: true,
    // Evidence exports must not reload an active editor or generation task.
    watch: { ignored: ['**/doc/evidence/**'] },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    manifest: true,
  },
}))
