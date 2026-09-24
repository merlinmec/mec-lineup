import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Os dados ficam no IndexedDB, que é por origem (host + porta). Mudar a porta
  // faria o app abrir vazio, então ela é fixa e falha em vez de trocar sozinha.
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
