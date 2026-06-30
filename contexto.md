# 🌌 Contexto del Proyecto: McDental Pulse

Este archivo conserva el estado actual de la interacción y del proyecto para reanudar el trabajo en futuras sesiones.

---

## 📅 Estado de la Sesión
*   **Fecha de registro**: 2026-06-26
*   **Ubicación del Proyecto**: `/home/helminth/Proyects/Mcdental-pulse-final-main`
*   **Tipo de Proyecto**: Plataforma Web de Bienestar Organizacional (React 19 + Vite 8 + Firestore + Firebase Storage).

---

## 🛠️ Acciones Realizadas

### 1. Instalación de Skills de Antigravity
*   Se descargó el repositorio completo de skills `sickn33/antigravity-awesome-skills` (v13.3.0).
*   Se instalaron **globalmente** en:
    *   `/home/helminth/.gemini/config/skills/`
*   Las skills ya se encuentran listas para usarse mediante el comando `@` (ej. `@brainstorming`).

### 2. Análisis del Proyecto
*   Se realizó un análisis técnico y estructural detallado del código del proyecto (layouts, enrutamiento, controladores, contextos, reglas de seguridad y motor local de IA).
*   El reporte de análisis se guardó en:
    *   [analisis_proyecto.md](file:///home/helminth/Documents/Obsidian%20Vault/analisis_proyecto.md) (dentro de tu bóveda de Obsidian).

---

## ⚙️ Pasos para ejecutar el proyecto en VS Code

1.  **Abrir la carpeta** `/home/helminth/Proyects/Mcdental-pulse-final-main` en VS Code.
2.  **Configurar Variables de Entorno**:
    *   Crear un archivo `.env` en la raíz copiando de [.env.example](file:///home/helminth/Proyects/Mcdental-pulse-final-main/.env.example).
    *   Completar las variables correspondientes a Firebase (`VITE_FIREBASE_API_KEY`, etc.) e IA (`VITE_AI_API_KEY`).
3.  **Instalar dependencias**:
    ```bash
    npm install
    ```
4.  **Iniciar Servidor de Desarrollo**:
    ```bash
    npm run dev
    ```

---

## 📌 Próximos Pasos Recomendados
1.  **Configurar `.env`** con las credenciales de desarrollo/producción de Firebase.
2.  **Ejecutar e interactuar localmente** con la aplicación para probar los flujos de inicio de sesión de los diferentes roles (admin, rh, psicologa, empleado).
3.  **Validar las reglas de Firestore** locales para asegurar el comportamiento correcto en el backend serverless.
