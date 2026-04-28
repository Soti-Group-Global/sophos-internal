import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // Strip console.log / debugger statements from production builds
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':    ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor':       ['lucide-react', 'react-icons', 'framer-motion'],
          'editor-vendor':   ['@tiptap/core', '@tiptap/react', '@tiptap/starter-kit'],
          'calendar-vendor': [
            '@fullcalendar/react',
            '@fullcalendar/daygrid',
            '@fullcalendar/timegrid',
            '@fullcalendar/interaction',
          ],
          'pdf-vendor':  ['jspdf', 'html2canvas'],
          'i18n-vendor': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
        },
      },
    },
  },
}))
