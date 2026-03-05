/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { chatPlaybackPlugin } from './src/server/plugin'

export default defineConfig({
  plugins: [react(), chatPlaybackPlugin()],
  build: {
    outDir: 'dist/client',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
