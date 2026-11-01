# Guía de Instalación y Desarrollo Local
## UNAM Immersive Experience – PC PUMA

Esta guía detalla los pasos para instalar las dependencias, ejecutar el entorno de desarrollo y probar la experiencia en una computadora de escritorio y en visores Meta Quest.

---

## 1. Requisitos Previos

- **Node.js**: Versión 18.0.0 o superior (recomendado `v20.x` o `v24.x`).
- **NPM**: Versión 9.0.0 o superior.
- **Navegador**:
  - Para pruebas de escritorio: Chrome, Edge, Safari o Firefox con soporte WebGL2.
  - Para pruebas VR: Meta Quest Browser (en Meta Quest 2, 3 o 3S).

---

## 2. Instalación de Dependencias

Clona o descarga el repositorio y ejecuta:

```bash
cd "video nvidia"
npm install
```

El proyecto instalará:
- `three`: Motor de renderizado 3D y WebXR (`^0.174.0`).
- `gsap`: Motor de cinemática y animaciones fluidas (`^3.12.5`).
- `vite`: Empaquetador y servidor de desarrollo ultrarrápido (`^6.2.0`).
- `typescript`: Tipado estático y chequeo de tipos (`^5.8.2`).

---

## 3. Ejecución en Modo Desarrollo

Para iniciar el servidor local con soporte de recarga en caliente (*Hot Module Replacement*):

```bash
npm run dev
```

El servidor estará disponible de forma predeterminada en:
- Experiencia Principal: `http://localhost:3000/`
- Panel de Operador Stand: `http://localhost:3000/operator.html`

### Conexión desde el visor Meta Quest en la misma red Wi-Fi:
Vite expone el servidor en `0.0.0.0`. En la terminal verás la IP local de tu computadora (por ejemplo `http://192.168.1.15:3000/`). Abre esa dirección dentro del **Meta Quest Browser**.

> [!NOTE]
> Para activar WebXR en Meta Quest sobre redes locales sin HTTPS, puedes habilitar en el navegador Quest la bandera `chrome://flags/#unsafely-treat-insecure-origin-as-secure` ingresando tu dirección IP local. En producción bajo GitHub Pages esto no es necesario ya que HTTPS viene activo por defecto.

---

## 4. Compilación para Producción

Para compilar y optimizar todos los assets para distribución estática:

```bash
npm run build
```

Los artefactos listos para producción se generan en la carpeta `dist/`.

---

## 5. Simulación de Escritorio

Si no cuentas con un visor Meta Quest físicamente conectado mientras programas:
- Al hacer clic en **INICIAR EXPERIENCIA**, el framework detecta la ausencia de hardware VR y activa suavemente el modo de simulación de escritorio.
- Puedes utilizar el ratón (clic y arrastre) para girar la cámara en 360 grados, examinar la Biblioteca Central y la Torre de Rectoría, y hacer clic con el puntero sobre los botones interactivos.
