import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Plugin dev-only: sirve las funciones de api/ en `npm run dev` (en producción las sirve
// Vercel). Sin esto, cualquier fetch a /api/* devuelve 404 y la pantalla que lo llama
// falla con un error que no dice nada — el checador se pasó una tarde así.
//
// Cada endpoint nuevo en api/ hay que añadirlo a esta lista.
const ENDPOINTS = ['gemini', 'soporte-ticket', 'enrolar-rostro', 'verificar-rostro', 'aprobar-rostro']

function devApiProxy(mode) {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      // Las funciones leen su configuración de process.env (no de import.meta.env, que no
      // existe en Node). En Vercel las pone la plataforma; aquí hay que trasvasarlas.
      const env = loadEnv(mode, process.cwd(), '')
      for (const clave of [
        'GEMINI_API_KEY',
        'MCTIC_API_URL',
        'MCTIC_INTEGRATION_KEY',
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
      ]) {
        if (env[clave]) process.env[clave] = env[clave]
      }

      for (const nombre of ENDPOINTS) {
        server.middlewares.use(`/api/${nombre}`, async (req, res) => {
          let body = ''
          for await (const chunk of req) body += chunk
          req.body = body ? JSON.parse(body) : {}
          res.status = (c) => { res.statusCode = c; return res }
          res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)) }
          try {
            // Ruta ABSOLUTA, no './api/...': Vite transpila este config a
            // node_modules/.vite-temp/, y un import relativo se resolvería desde ahí —
            // buscaría node_modules/.vite-temp/api/... y no lo encontraría.
            const ruta = pathToFileURL(resolve(process.cwd(), 'api', `${nombre}.js`)).href
            const { default: handler } = await import(ruta)
            await handler(req, res)
          } catch (error) {
            console.error(`[dev-api] ${nombre}:`, error)
            res.status(500).json({ error: 'Error en la función de desarrollo.' })
          }
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
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
        // El runtime de MediaPipe (detector de rostro del checador) NO va al precache:
        // son ~740 KB que pagaría todo el mundo al instalar la app, incluida la psicóloga
        // que no va a abrir el checador en su vida. Se descarga bajo demanda la primera
        // vez que alguien entra a checar, y de ahí lo cachea el navegador.
        globIgnores: ['**/mediapipe/**'],
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
