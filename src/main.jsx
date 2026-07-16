import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { notify } from './utils/notify'
import './index.css'
import './App.css'
import './styles/mobile-polish.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { GlobalProvider } from './contexts/GlobalContext.jsx'
import { NotificationProvider } from './contexts/NotificationContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ background: '#ffffff', padding: 40, borderRadius: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.05)', maxWidth: 450, textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <h2 style={{ color: '#0f172a', margin: '0 0 16px 0', fontSize: 22, fontWeight: 600 }}>
              Algo no salió como esperábamos
            </h2>
            <p style={{ color: '#64748b', margin: '0 0 32px 0', fontSize: 15, lineHeight: 1.6 }}>
              Ha ocurrido un inconveniente inesperado en la plataforma. Por favor, intenta cargar la página de nuevo o cierra la sesión para volver a entrar.
            </p>

            {/* En desarrollo, el error a la vista. Un boundary que solo dice "algo falló" y
                esconde la causa en la consola convierte cada bug en una adivinanza. En
                producción se sigue ocultando: al usuario no le sirve un stack trace. */}
            {import.meta.env.DEV && this.state.error && (
              <pre style={{
                textAlign: 'left', background: '#0f172a', color: '#fca5a5', padding: 14,
                borderRadius: 8, fontSize: 12, lineHeight: 1.5, overflow: 'auto',
                maxHeight: 260, margin: '0 0 24px 0', whiteSpace: 'pre-wrap',
              }}>
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button 
                onClick={() => window.location.reload()}
                style={{ background: '#006D5B', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 500, cursor: 'pointer', fontSize: 14 }}
              >
                Volver a intentar
              </button>
              <button 
                onClick={() => { window.location.href = '/'; }}
                style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 500, cursor: 'pointer', fontSize: 14 }}
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children; 
  }
}

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true })

  // sw.js ya se activa solo (skipWaiting + clientsClaim): el navegador pasa el control al SW
  // nuevo sin pedir permiso. Pero el JS que la pestaña ya tiene cargado en memoria sigue siendo
  // el viejo hasta que se recarga. 'controllerchange' es exactamente el momento del relevo —
  // ahí se avisa con un toast, en vez de recargar solo y cortarle a alguien una foto a medias.
  let avisado = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (avisado) return
    avisado = true
    notify.toast.update('Hay una versión nueva de la app.', {
      label: 'Actualizar',
      onClick: () => window.location.reload(),
    })
  })

  // Un PWA en el celular casi nunca navega ni se cierra del todo, así que el navegador no
  // revisa solo si hay una versión nueva (eso solo pasa en la navegación). Se fuerza el chequeo
  // cada 10 minutos y cada vez que la app vuelve a primer plano.
  navigator.serviceWorker.ready.then((registration) => {
    const revisar = () => registration.update().catch(() => {})
    setInterval(revisar, 10 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') revisar()
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <GlobalProvider>
            <NotificationProvider>
              <ErrorBoundary><App /></ErrorBoundary>
            </NotificationProvider>
          </GlobalProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
