import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

export default defineConfig({
  plugins: [
    // Development-only relaxation for Vite's React refresh preamble and local HMR.
    // This transform is NEVER applied to the production build or packaged HTML.
    {
      name: 'foro-development-csp',
      apply: 'serve',
      transformIndexHtml(html: string) {
        return html
          .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
          .replace("connect-src 'none'", "connect-src 'self' ws://localhost:* ws://127.0.0.1:*")
      },
    },
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'electron-store'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs',
              },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  },
})
