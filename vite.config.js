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
const ENDPOINTS = ['gemini', 'soporte-ticket', 'checar', 'reto', 'enrolar-rostro', 'aprobar-rostro', 'aprobar-permiso', 'aprobar-vacacion', 'enviar-mensaje', 'suscribir-push', 'limpiar-fotos', 'revisar-comision', 'solicitar-intercambio', 'resolver-intercambio']

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

      // Node cachea los módulos ESM en el proceso, así que un cambio en api/ NO se recarga
      // en caliente: el servidor sigue ejecutando la versión que cargó al arrancar. Eso ya
      // costó una tarde — se cambió el umbral del cotejo facial, el archivo decía 0.50 y el
      // servidor seguía aplicando 0.363, con lo que un impostor pasaba y no había forma de
      // entender por qué. Aquí se avisa a gritos.
      server.watcher.add(resolve(process.cwd(), 'api'))
      server.watcher.on('change', (archivo) => {
        if (archivo.includes('/api/')) {
          server.config.logger.warn(
            `\n  ⚠️  ${archivo.split('/api/')[1]} cambió — REINICIA el servidor (Ctrl+C y npm run dev).\n` +
            `     Las funciones de api/ no se recargan en caliente.\n`
          )
        }
      })

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
  // En producción quita console.* y debugger del bundle: no filtrar información al
  // cliente y no cargar 103 llamadas de log muertas. En dev se conservan.
  esbuild: { drop: mode === 'production' ? ['console', 'debugger'] : [] },
  build: {
    rollupOptions: {
      output: {
        // OpenCV.js (~13 MB) + jscanify solo los usa la cámara de comisiones. Se fuerzan a un
        // chunk propio ('opencv') que se carga SOLO al abrir esa pantalla (dynamic import), y
        // se excluye del precache del PWA (globIgnores abajo). Así no pesa en el arranque ni le
        // cuesta a quien nunca sube un recibo.
        manualChunks(id) {
          if (id.includes('@techstark/opencv-js') || id.includes('jscanify')) return 'opencv'
          return undefined
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    devApiProxy(mode),
    VitePWA({
      // injectManifest, no generateSW: se necesita un service worker propio (src/sw.js) para
      // recibir las notificaciones push. El worker automático no sabe escuchar el evento 'push'.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
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
      // Con injectManifest, aquí SOLO van las opciones de BUILD (qué precachear). El
      // comportamiento en tiempo de ejecución —navigateFallback, clientsClaim, skipWaiting— lo
      // decide ahora src/sw.js, porque el worker es nuestro. Poner esas claves aquí no daría
      // error pero no haría nada, que es peor: parecería configurado y no lo estaría.
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],
        // Fuera del precache lo que solo usa una minoría, y solo a veces:
        //   - MediaPipe (~740 KB): el detector de rostro del checador.
        //   - exceljs (~930 KB): solo lo toca un admin, y solo el día que importa horarios.
        // Meterlos aquí sería cobrarle a la psicóloga —que no va a checar ni a importar nada—
        // 1,7 MB al instalar la app. Se descargan bajo demanda y el navegador los cachea.
        globIgnores: ['**/mediapipe/**', '**/exceljs*', '**/opencv*'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
}))
