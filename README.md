# UNAM IMMERSIVE EXPERIENCE – PC PUMA
## Experiencia Institucional WebXR para Meta Quest impulsada por VXR Core

https://vickman123.github.io/evento-nvidia/

> **Universidad Nacional Autónoma de México (UNAM)**  
> **Programa PC PUMA — Dirección General de Cómputo y de Tecnologías de Información y Comunicación (DGTIC)**  
> **Motor de Realidad Virtual:** VXR Core (Three.js + WebXR)

---

## 1. Descripción del Proyecto

**UNAM Immersive Experience** es una aplicación WebXR desarrollada para visores **Meta Quest 3S / Meta Quest 3** y navegadores de escritorio, concebida para operar en stands de ferias tecnológicas, eventos universitarios y exposiciones institucionales.

La experiencia sitúa al visitante en el corazón de **Ciudad Universitaria (Las Islas)** con una panorámica interactiva en 360 grados de la **Biblioteca Central** (con sus 4 fachadas de murales de Juan O'Gorman) y la **Torre de Rectoría** (con el mural escultórico de David Alfaro Siqueiros), seguida de una transición cinematográfica que despliega una pantalla virtual 16:9 con video institucional sincronizado, culminando con el cierre institucional de **PC PUMA: Tecnología para transformar el aprendizaje** y un ciclo de reinicio automatizado.

---

## 2. Características Principales

- **Motor Propio VXR Core**: Reutiliza y fortalece el framework modular VXR Core (Three.js 0.174.0 + WebXR) sin introducir dependencias innecesarias ni motores ajenos.
- **Optimización para Meta Quest Browser**:
  - Tasa de refresco objetivo de **90 Hz / 72 Hz**.
  - Control de densidad de píxeles (`pixelRatioCap: 1.25`) para prevenir sobrecalentamiento.
  - Sombra direccional única PCFSoftShadowMap calibrada para chips móviles Snapdragon XR2.
- **Giro Natural de Cabeza 360°**: El visitante puede voltear físicamente en todas direcciones dentro del stand sin requerir sticks de rotación artificial.
- **Pantalla Virtual Cinematográfica 16:9**: Marco arquitectónico institucional con acabado en azul noche UNAM y ribetes dorados, con animación de apertura y reproducción de video MP4 local.
- **Audio Institucional y Ambiental**: Sintetizador procedural Web Audio de VXR Core (cero descargas externas) y audio estéreo del video sincronizado.
- **Máquina de Estados Finita Robusta**: Estados estrictamente definidos (`IDLE`, `ENTER_XR`, `EXPLORATION`, `TRANSITION_TO_CINEMA`, `VIDEO_PLAYBACK`, `PC_PUMA_OUTRO`, `RESET_READY`).
- **Zero Memory Leaks**: Permite repetir la experiencia durante horas continuas en eventos sin degradación de fotogramas ni recarga de página.
- **Consola de Operador del Stand (`operator.html`)**: Permite monitorear FPS, avance del video y cambiar etapas de forma remota vía `BroadcastChannel`.
- **Despliegue GitHub Pages**: Build optimizado con rutas relativas (`./`), HTTPS automático y GitHub Actions CI/CD.

---

## 3. Inicio Rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor local
npm run dev

# 3. Compilar para producción
npm run build
```

---

## 4. Estructura del Código

```
├── index.html                 # Experiencia WebXR principal (Meta Quest y Desktop)
├── operator.html              # Consola de administración del stand
├── package.json               # Dependencias (Three.js, GSAP, TypeScript, Vite)
├── vite.config.ts             # Configuración de compilación con base relativa './'
├── docs/                      # Documentación de ingeniería y manuales
│   ├── architecture.md        # Arquitectura modular y máquina de estados
│   ├── installation.md        # Guía de instalación y entorno local
│   ├── deployment.md          # Despliegue en GitHub Pages y HTTPS
│   ├── assets-guide.md        # Especificaciones para sustituir video y modelos
│   └── operator-manual.md     # Protocolo de atención en stands
├── public/
│   ├── manifest.webmanifest  # Manifiesto PWA para Meta Quest Browser
│   └── assets/
│       ├── branding/          # Identidad UNAM, PC PUMA y VXR
│       ├── models/            # Modelos GLB institucionales
│       ├── videos/            # Video institucional local (MP4)
│       └── audio/             # Recursos de audio
└── src/
    ├── main.ts                # Bootstrap de la experiencia
    ├── operator.ts            # Lógica del panel de operador
    ├── vxr/                   # Módulos VXR Core tipados y optimizados
    ├── experience/            # Máquina de estados y configuración
    ├── scene/                 # Escenario 3D de Ciudad Universitaria
    ├── media/                 # VideoScreen 16:9, VideoManager y AudioManager
    ├── transitions/           # Fundidos cinematográficos y cierre PC PUMA
    ├── interface/             # UI de bienvenida y HUD inmersivo
    └── utils/                 # SyncChannel y monitor de rendimiento
```

---

## 5. Licencia y Créditos

- **Desarrollo**: Universidad Nacional Autónoma de México — Programa PC PUMA.
- **Framework 3D**: VXR Core.
- **Licencia**: MIT.
