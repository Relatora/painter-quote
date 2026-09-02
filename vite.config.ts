import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Runs the Hono Worker inside the Vite dev server, so `npm run dev` serves the
    // client and the API from one origin with the real Workers runtime (workerd) -
    // no separate `wrangler dev` process, and bindings behave as they do in production.
    cloudflare(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Painter Quote',
        short_name: 'Quote',
        description: 'Photo and description to a professional painting quote in under a minute.',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Never cache the API. A stale quote total is worse than an offline error.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  // No build.outDir override here. The Cloudflare plugin owns the output layout and
  // emits client assets to dist/client and the worker to dist/<worker-name>, which is
  // exactly what wrangler.jsonc's assets.directory points at. Setting outDir ourselves
  // nests both one level deeper and silently breaks asset serving in production.
})
