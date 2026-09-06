import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: './workspace/ProjectWorkspace',
        replacement: fileURLToPath(new URL('./src/workspace/OrchestratedProjectWorkspace.tsx', import.meta.url)),
      },
    ],
  },
})
