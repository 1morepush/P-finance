import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

/**
 * Stamped into the bundle so the running build can be identified from inside
 * the app. "Did the update actually arrive?" is otherwise unanswerable from a
 * phone — the screen looks the same either way.
 */
const buildStamp = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC${
  process.env.GITHUB_SHA ? ` · ${process.env.GITHUB_SHA.slice(0, 7)}` : ''
}`

/**
 * The OCR engine's version names its cache, so an upgrade fetches the new
 * files rather than pairing a new worker with an old core.
 */
const ocrVersion: string = JSON.parse(
  readFileSync(new URL('./node_modules/tesseract.js/package.json', import.meta.url), 'utf8'),
).version

// https://vite.dev/config/
export default defineConfig({
  base: '/P-finance/',
  define: { __BUILD_STAMP__: JSON.stringify(buildStamp) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // The OCR engine is several megabytes and only needed when a
        // screenshot is read. Kept out of the install, so updating the app
        // stays quick, and cached the first time it is used, so reading works
        // offline after that.
        globIgnores: ['**/ocr/**'],
        runtimeCaching: [
          {
            urlPattern: /\/ocr\/[^/]+$/,
            handler: 'CacheFirst',
            options: { cacheName: `ocr-${ocrVersion}` },
          },
        ],
      },
      manifest: {
        name: 'P-Finance',
        short_name: 'P-Finance',
        description: 'Personal income, debt payoff, and savings tracker',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/P-finance/',
        scope: '/P-finance/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
