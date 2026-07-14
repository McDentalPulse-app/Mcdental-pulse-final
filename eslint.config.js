import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // public/mediapipe es el runtime de MediaPipe copiado tal cual desde node_modules
  // (el detector de rostro del checador lo carga desde nuestro origen, no desde un CDN).
  // Es código minificado de terceros: analizarlo solo produce 353 errores que nadie va a
  // arreglar y que enterrarían los nuestros.
  globalIgnores(['dist', 'public/mediapipe']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // api/ y los scripts de build NO corren en el navegador: corren en Node. Sin esto,
    // ESLint no conoce `process` ni `Buffer` y los marca como variables inexistentes —
    // eran 10 de los errores que este repo arrastraba, y no eran errores reales.
    files: ['api/**/*.js', 'scripts/**/*.mjs', 'vite.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
