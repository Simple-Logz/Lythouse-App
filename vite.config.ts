import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const orchestratedWorkspace=fileURLToPath(new URL('./src/workspace/OrchestratedProjectWorkspace.tsx',import.meta.url))

export default defineConfig({
  plugins:[
    react(),
    {
      name:'lythouse-orchestrated-workspace',
      enforce:'pre' as const,
      resolveId(source:string,importer?:string){
        if(source==='./workspace/ProjectWorkspace'&&importer?.replaceAll('\\','/').endsWith('/src/App.tsx'))return orchestratedWorkspace
        return null
      },
    },
  ],
})
