# Guía de Gestión y Sustitución de Recursos Multimedia (Assets)
## UNAM Immersive Experience – PC PUMA

Este documento detalla la estructura de carpetas de recursos multimedia y las especificaciones técnicas recomendadas para sustituir videos, modelos 3D y elementos de branding por versiones oficiales de alta resolución.

---

## 1. Estructura de Directorios

```
public/
└── assets/
    ├── branding/       # Identidad institucional (logos UNAM, PC PUMA, VXR)
    ├── models/         # Modelos tridimensionales (.glb / .gltf)
    ├── textures/       # Texturas PBR y mapas de normales/rugosidad
    ├── videos/         # Archivos de video institucional (.mp4 / .webm)
    └── audio/          # Paisajes sonoros y pistas ambientales (.mp3 / .ogg)
```

---

## 2. Reemplazo del Video Institucional

El video inicial incluido es:
`public/assets/videos/video-institucional.mp4`

### Especificaciones recomendadas para Meta Quest 3S / 3:
- **Formato de Contenedor**: MP4 (H.264 / AVC).
- **Resolución Óptima**: 1920x1080 (1080p a 30 o 60 FPS) o 2560x1440.
- **Tasa de Bits (Bitrate)**: Entre 6 Mbps y 12 Mbps. Bitrates superiores a 25 Mbps pueden saturar el decodificador de hardware en el visor.
- **Códec de Audio**: AAC estéreo a 44.1 kHz o 48 kHz (192 kbps).
- **Duración sugerida para stands**: 1 a 3 minutos para mantener un flujo ágil de visitantes en eventos.

### Cómo cambiar el video:
1. Coloca tu nuevo archivo en `public/assets/videos/mi-video.mp4`.
2. En `src/experience/ExperienceConfig.ts`, actualiza la propiedad `videoPath`:
   ```typescript
   export const DEFAULT_CONFIG: ExperienceConfigData = {
     // ...
     videoPath: 'assets/videos/mi-video.mp4',
   };
   ```
3. O bien cámbialo en tiempo de ejecución desde el **Panel de Operador del Stand** (`operator.html`).

---

## 3. Sustitución de Modelos 3D Arquitectónicos (GLB)

La arquitectura de VXR Core permite sustituir los edificios procedurales de Ciudad Universitaria por modelos oficiales exportados desde Blender, Revit, SketchUp o 3ds Max:

### Especificaciones técnicas para Meta Quest:
- **Formato**: GLB binario unificado (`.glb`).
- **Límite de Polígonos**: Menor a 250,000 triángulos para todo el escenario.
- **Compresión**: Usar compresión **DRACO** o **Meshopt** para reducir el tamaño de descarga por debajo de 30 MB.
- **Texturas**: Formato JPEG o WebP de máximo 2048x2048 px.
- **Pivote**: Colocar el origen de coordenadas `(0, 0, 0)` en la base del edificio para alineación automática con el terreno.

---

## 4. Recursos Gráficos Oficiales (Branding)

- `public/assets/branding/pcpuma-logo.png`: Logo oficial de alta resolución del programa PC PUMA.
- `public/assets/branding/powered_by_vxr.png`: Insignia de tecnología VXR Core.
- `public/assets/branding/vxr-logo.png`: Logotipo vectorial del framework.

Los logotipos deben ser provistos preferentemente en PNG con canal alfa transparente y dimensiones cuadradas o rectangulares proporcionales.
