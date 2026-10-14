import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { shortRedirectDevPlugin } from './vite-plugin-short-redirect.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [shortRedirectDevPlugin(mode), react()],
}))
