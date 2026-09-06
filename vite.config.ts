import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Route the existing ProjectWorkspace import through the orchestration-aware
// adapter without rewriting the large legacy workspace in one risky change.
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