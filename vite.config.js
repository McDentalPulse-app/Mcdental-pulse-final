import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Plugin dev-only: sirve /api/gemini en `npm run dev` reusando api/gemini.js
// (en producción lo sirve Vercel). Carga GEMINI_API_KEY de .env.local.
function devApiProxy(mode) {
  return {
    name: 'dev-api-gemini',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '')
      process.env.GEMINI_API_KEY = env.GEMINI_API_KEY
      server.middlewares.use('/api/gemini', async (req, res) => {
        let body = ''
        for await (const chunk of req) body += chunk
        req.body = body ? JSON.parse(body) : {}
        res.status = (c) => { res.statusCode = c; return res }
        res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)) }
        const { default: handler } = await import('./api/gemini.js')
        await handler(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    devApiProxy(mode),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-512x512-maskable.png',
      ],
      manifest: {
        name: 'McDental Pulse',
        short_name: 'McDental',
        description: 'Plataforma de bienestar organizacional para clínicas dentales',
        theme_color: '#071613',
        background_color: '#071613',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'es',
        orientation: 'portrait-primary',
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
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /firestore\.googleapis\.com/,
          /firebase/,
          /googleapis\.com/,
        ],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
}))
