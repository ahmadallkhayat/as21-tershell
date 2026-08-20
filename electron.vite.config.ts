import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()],
    build: {
      // The default 500kb warning is calibrated for web deploys where a
      // large bundle costs users download time — that concern doesn't
      // apply here (this ships inside an installer, loaded from local
      // disk), and xterm.js alone accounts for most of the size. Splitting
      // it into its own chunk still pays off during development, though:
      // app-code edits no longer invalidate the vendor chunk, so Vite/HMR
      // doesn't need to re-bundle React and xterm on every save.
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            xterm: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-search'],
            react: ['react', 'react-dom']
          }
        }
      }
    }
  }
})
