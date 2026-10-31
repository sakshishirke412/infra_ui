import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    watch: {
      // Exclude problematic Windows directories and system files
      ignored: [
        '**/AppData/**',
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/NTUSER.DAT*',
        '**/ntuser.*',
        '**/Desktop.ini',
        '**/OneDrive/**',
        '**/.849C9593-*',
      ],
    },
  },
})