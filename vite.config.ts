import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { briefDev } from './scripts/brief-dev.ts'
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'ANALYSIS_LLM_'), ...process.env }
  return { plugins: [react(), briefDev({ ANALYSIS_LLM_API_KEY: env.ANALYSIS_LLM_API_KEY, ANALYSIS_LLM_MODEL: env.ANALYSIS_LLM_MODEL, ANALYSIS_LLM_BASE_URL: env.ANALYSIS_LLM_BASE_URL })] }
})
