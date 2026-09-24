import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { backupPlugin } from './backupServer.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), backupPlugin()],
  // Os dados ficam no IndexedDB, que é por origem (host + porta). As portas são
  // fixas e falham em vez de trocar sozinhas, senão o app abriria vazio.
  // 5180 = o app de uso (build, sobe com o Windows); 5181 = desenvolvimento,
  // com dados e backups separados pra testes não tocarem nos dados reais.
  server: { port: 5181, strictPort: true },
  preview: { port: 5180, strictPort: true },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
