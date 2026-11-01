# Integración de API de Generación 3D – UNAM Immersive Experience
## Hyper3D Rodin v2 &bull; VXR Core &bull; Meta Quest 3 / 3S

Este documento describe la arquitectura, especificación de API, seguridad de credenciales, pipeline de optimización poligonal y flujo de integración para generar e incorporar modelos 3D con inteligencia artificial dentro de la experiencia WebXR de Ciudad Universitaria de la UNAM.

---

## 1. Auditoría de la API del Proveedor

| Parámetro | Especificación Oficial |
| :--- | :--- |
| **Proveedor** | **Hyper3D (Deemos Technologies)** &ndash; Rodin Gen-2 / Gen-2.5 |
| **Base URL** | `https://api.hyper3d.com/api/v2` |
| **Método de Autenticación** | HTTP Header `Authorization: Bearer <RODIN_API_KEY>` |
| **Endpoint de Envío** | `POST https://api.hyper3d.com/api/v2/rodin` |
| **Endpoint de Estado** | `POST https://api.hyper3d.com/api/v2/status` |
| **Endpoint de Descarga** | `POST https://api.hyper3d.com/api/v2/download` |
| **Tiers / Modelos** | `Gen-2.5-Medium` (por defecto para arquitectura), `Gen-2.5`, `Gen-2` |
| **Topología de Malla** | `Raw` (triangulación optimizada PBR), `Quad` (malla cuadrilátera) |
| **Formatos de Exportación** | **GLB (predeterminado y compatible con Three.js / VXR Core)**, FBX, OBJ, USDZ, STL |
| **Modos de Entrada** | **Text-to-3D** (lenguaje natural) y **Image-to-3D** (`multipart/form-data`) |
| **Flujo de Ejecución** | Asíncrono mediante `uuid` de tarea y `subscription_key` de seguimiento |
| **Vigencia de Enlaces** | Las URLs temporales de descarga expiran a los 10 minutos; el proxy descarga y almacena el archivo localmente en `public/assets/models/ai/` |

---

## 2. Configuración Segura de Credenciales

Para cumplir con los más altos estándares de ciberseguridad y evitar cualquier filtración de claves:

1. **Aislamiento en `.env`**:
   - La credencial se almacena exclusivamente en `.env` bajo la clave `RODIN_API_KEY`.
   - `.gitignore` contiene reglas estrictas:
     ```gitignore
     .env
     .env.*
     !.env.example
     ```
2. **Cero exposición en cliente**:
   - Ni el navegador Meta Quest ni los bundles de JavaScript (`dist/`) contienen o reciben la API Key.
   - Las peticiones del cliente se dirigen a `/api/ai3d/*` en el servidor local.
   - El proxy en Node.js (`vite-plugin-ai3d.ts`) inyecta el encabezado `Authorization: Bearer ${apiKey}` en el servidor.
3. **No utilización de variables públicas**:
   - No se utiliza el prefijo `VITE_` para evitar que Vite embeba el secreto en el código del cliente.

---

## 3. Módulo de Generación: `AIModelGenerator`

El módulo se encuentra en `src/ai/AIModelGenerator.ts` e implementa la siguiente interfaz:

```typescript
export class AIModelGenerator {
  // Valida autenticación contra Hyper3D
  checkAuth(): Promise<{ authenticated: boolean; message: string }>;

  // Envía solicitud Text-to-3D
  generateFromText(options: TextTo3DOptions): Promise<GenerationTask>;

  // Envía solicitud Image-to-3D
  generateFromImage(options: ImageTo3DOptions): Promise<GenerationTask>;

  // Consulta el avance y estado de la tarea (PENDING, RUNNING, SUCCEEDED, FAILED)
  getGenerationStatus(subscriptionKey: string): Promise<GenerationStatusResponse>;

  // Descarga el archivo GLB y lo guarda localmente
  downloadModel(taskUuid: string, saveName?: string): Promise<{ blob: Blob; localUrl: string; downloadUrl: string }>;

  // Valida presupuesto de triángulos, draw calls y escala para Meta Quest
  validateModel(loadedModel: LoadedModel): ValidationResult;

  // Ejecuta simplificación de malla y consolidación de materiales
  optimizeModel(sceneGroup: THREE.Group, options?: OptimizationOptions): Promise<OptimizationResult>;

  // Inyecta el modelo en el slot correspondiente de UNAMScene
  importIntoScene(app: XRApp, unamScene: UNAMScene, model: THREE.Group, slot: SceneSlot): void;
}
```

---

## 4. Pipeline de Optimización para Meta Quest 3/3S

Meta Quest 3 y 3S operan a 72 Hz / 90 Hz / 120 Hz en WebXR. Para evitar caídas de fotogramas (*dropped frames*), los modelos crudos de IA pasan por `src/ai/MeshOptimizer.ts`:

1. **Consolidación de Sub-meshes (`mergeSceneSubMeshes`)**:
   - Agrupa geometrías que comparten el mismo material en una sola malla unificada.
   - Reduce las llamadas de dibujo (*draw calls*) de más de 100 a menos de 10.
2. **Diezmado Poligonal (`SimplifyModifier`)**:
   - Reduce el conteo de triángulos hasta en un 80% preservando la silueta arquitectónica.
   - Recalcula normales de vértice (`computeVertexNormals`) para garantizar sombreado PBR suave.
3. **Propiedades de Materiales**:
   - Configura `side = THREE.DoubleSide` en superficies arquitectónicas para evitar caras invisibles.

---

## 5. Integración con VXR Core y UNAMScene

La clase `UNAMScene` cuenta con el método:

```typescript
unamScene.replaceSlot(slot: 'biblioteca' | 'rectoria' | 'furniture' | 'vegetation' | 'custom', newObject: THREE.Object3D);
```

- **Slot `biblioteca`**: Oculta el prisma procedural de la Biblioteca Central y ubica el modelo en `(0, 0, -55)` a escala monumental de 36 m de altura.
- **Slot `rectoria`**: Oculta la torre procedural y posiciona el modelo en `(-65, 0, -20)` a escala de 58 m.
- **Slot `furniture`**: Posiciona mobiliario (bancas, luminarias) sobre el andador en `(4, 0, -6)`.
- **Slot `vegetation`**: Ubica árboles Jacarandas en los jardines de Las Islas en `(-15, 0, -18)`.

---

## 6. Panel de Estudio y Administración (`generator.html`)

Para diseñar y probar modelos de forma interactiva antes de desplegarlos en el stand:

1. Abrir en el navegador: `http://localhost:3001/generator.html`
2. **Presets incluidos**:
   - **Biblioteca Central**: Murales de Juan O'Gorman y zócalo de piedra volcánica.
   - **Torre de Rectoría**: Prisma vertical con mural escultórico de David Alfaro Siqueiros.
   - **Banca de Cantera**: Mobiliario universitario de piedra y madera.
   - **Árbol Jacaranda**: Especie emblemática con floración violeta de Ciudad Universitaria.
3. **Visor 3D**: Permite rotación orbital, alternar wireframe, centrado automático e inspección de métricas en tiempo real.
4. **Optimización con 1 clic**: Slider de diezmado y exportación instantánea a GLB optimizado.
