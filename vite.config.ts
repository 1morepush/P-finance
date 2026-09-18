import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Stamped into the bundle so the running build can be identified from inside
 * the app. "Did the update actually arrive?" is otherwise unanswerable from a
 * phone — the screen looks the same either way.
 */
const buildStamp = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC${
  process.env.GITHUB_SHA ? ` · ${process.env.GITHUB_SHA.slice(0, 7)}` : ''
}`

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
