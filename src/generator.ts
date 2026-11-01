import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AIModelGenerator, type GenerationTask } from './ai/AIModelGenerator.js';
import { computeMetrics, exportSceneToGLBBuffer } from './ai/MeshOptimizer.js';

// Pre-configured architectural prompts for UNAM Ciudad Universitaria
const UNAM_PRESETS: Record<string, string> = {
  biblioteca:
    'Monumental modernist Mexican university library building inspired by UNAM Biblioteca Central, 10-story block tower, vibrant four-sided stone mosaic murals covering all facades, volcanic basalt stone plinth base with pre-hispanic carved reliefs, glass lobby with entrance columns, functionalist architecture, PBR textures',
  rectoria:
    'Iconic university administration tower inspired by UNAM Torre de Rectoria, vertical modernist skyscraper prism, red clay brick and exposed concrete facade, prominent 3D sculpted mural by David Alfaro Siqueiros projecting from south facade, glass executive top floor, modernist architecture',
  banca:
    'Modernist outdoor university bench made of dark volcanic basalt stone and Mexican quarry cantera stone with wooden seat slats, minimalist architectural campus furniture for university gardens',
  jacaranda:
    'Blooming Mexican Jacaranda tree with dense vibrant violet purple blossom canopy, realistic gnarled wooden branches, natural dark bark trunk, architectural botanical tree for university park',
};

class StudioApp {
  private generator: AIModelGenerator;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private gridHelper: THREE.GridHelper;

  private currentModelGroup: THREE.Group | null = null;
  private currentRawGLTF: any = null;
  private isWireframe: boolean = false;
  private activePollingInterval: any = null;

  // DOM elements
  private authStatusBadge: HTMLElement;
  private authStatusText: HTMLElement;
  private promptInput: HTMLTextAreaElement;
  private tierSelect: HTMLSelectElement;
  private meshModeSelect: HTMLSelectElement;
  private imageInput: HTMLInputElement;
  private btnGenerate: HTMLButtonElement;
  private progressBox: HTMLElement;
  private progressStage: HTMLElement;
  private progressPercent: HTMLElement;
  private progressBarFill: HTMLElement;
  private progressDetails: HTMLElement;
  private emptyState: HTMLElement;
  private questPanel: HTMLElement;
  private reductionSlider: HTMLInputElement;
  private reductionRatioVal: HTMLElement;
  private checkMergeDrawCalls: HTMLInputElement;
  private checkDoubleSided: HTMLInputElement;
  private btnOptimize: HTMLButtonElement;
  private btnDownloadGLB: HTMLButtonElement;
  private slotSelect: HTMLSelectElement;
  private metricTris: HTMLElement;
  private metricVerts: HTMLElement;
  private metricMeshes: HTMLElement;
  private metricSize: HTMLElement;
  private btnToggleWireframe: HTMLButtonElement;
  private btnResetCamera: HTMLButtonElement;
  private btnToggleGrid: HTMLButtonElement;

  constructor() {
    this.generator = new AIModelGenerator('/api/ai3d');

    // Query DOM
    this.authStatusBadge = document.getElementById('authStatusBadge')!;
    this.authStatusText = document.getElementById('authStatusText')!;
    this.promptInput = document.getElementById('promptInput') as HTMLTextAreaElement;
    this.tierSelect = document.getElementById('tierSelect') as HTMLSelectElement;
    this.meshModeSelect = document.getElementById('meshModeSelect') as HTMLSelectElement;
    this.imageInput = document.getElementById('imageInput') as HTMLInputElement;
    this.btnGenerate = document.getElementById('btnGenerate') as HTMLButtonElement;
    this.progressBox = document.getElementById('progressBox')!;
    this.progressStage = document.getElementById('progressStage')!;
    this.progressPercent = document.getElementById('progressPercent')!;
    this.progressBarFill = document.getElementById('progressBarFill')!;
    this.progressDetails = document.getElementById('progressDetails')!;
    this.emptyState = document.getElementById('emptyState')!;
    this.questPanel = document.getElementById('questPanel')!;
    this.reductionSlider = document.getElementById('reductionSlider') as HTMLInputElement;
    this.reductionRatioVal = document.getElementById('reductionRatioVal')!;
    this.checkMergeDrawCalls = document.getElementById('checkMergeDrawCalls') as HTMLInputElement;
    this.checkDoubleSided = document.getElementById('checkDoubleSided') as HTMLInputElement;
    this.btnOptimize = document.getElementById('btnOptimize') as HTMLButtonElement;
    this.btnDownloadGLB = document.getElementById('btnDownloadGLB') as HTMLButtonElement;
    this.slotSelect = document.getElementById('slotSelect') as HTMLSelectElement;
    this.metricTris = document.getElementById('metricTris')!;
    this.metricVerts = document.getElementById('metricVerts')!;
    this.metricMeshes = document.getElementById('metricMeshes')!;
    this.metricSize = document.getElementById('metricSize')!;
    this.btnToggleWireframe = document.getElementById('btnToggleWireframe') as HTMLButtonElement;
    this.btnResetCamera = document.getElementById('btnResetCamera') as HTMLButtonElement;
    this.btnToggleGrid = document.getElementById('btnToggleGrid') as HTMLButtonElement;

    // 1. Inicializar Viewport Three.js
    const container = document.getElementById('webgl-canvas')!;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a101d);

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 500);
    this.camera.position.set(12, 10, 16);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05;

    // 2. Iluminación PBR de estudio
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff6e6, 2.2);
    sun.position.set(20, 35, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.bias = -0.0001;
    this.scene.add(sun);

    const fillLight = new THREE.DirectionalLight(0x8ecae6, 0.9);
    fillLight.position.set(-20, 15, -15);
    this.scene.add(fillLight);

    // 3. Cuadrícula de referencia
    this.gridHelper = new THREE.GridHelper(40, 40, 0xe5a712, 0x1d3557);
    this.gridHelper.position.y = -0.01;
    this.scene.add(this.gridHelper);

    // 4. Listeners y animación
    this.initEvents();
    this.checkApiStatus();
    this.animate();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  private initEvents(): void {
    // Presets
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const presetKey = target.dataset.preset;
        if (presetKey && UNAM_PRESETS[presetKey]) {
          this.promptInput.value = UNAM_PRESETS[presetKey];
          // Pre-seleccionar slot coherente
          if (presetKey === 'biblioteca') this.slotSelect.value = 'biblioteca';
          if (presetKey === 'rectoria') this.slotSelect.value = 'rectoria';
          if (presetKey === 'banca') this.slotSelect.value = 'furniture';
          if (presetKey === 'jacaranda') this.slotSelect.value = 'vegetation';
        }
      });
    });

    // Slider
    this.reductionSlider.addEventListener('input', () => {
      this.reductionRatioVal.textContent = `${this.reductionSlider.value}%`;
    });

    // Generar
    this.btnGenerate.addEventListener('click', () => this.handleGenerate());

    // Optimizar
    this.btnOptimize.addEventListener('click', () => this.handleOptimize());

    // Descargar GLB
    this.btnDownloadGLB.addEventListener('click', () => this.handleDownloadGLB());

    // Controles de visor
    this.btnToggleWireframe.addEventListener('click', () => {
      this.isWireframe = !this.isWireframe;
      this.btnToggleWireframe.classList.toggle('active', this.isWireframe);
      if (this.currentModelGroup) {
        this.currentModelGroup.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            const mesh = c as THREE.Mesh;
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => {
                if ('wireframe' in m) (m as any).wireframe = this.isWireframe;
              });
            } else if (mesh.material && 'wireframe' in mesh.material) {
              (mesh.material as any).wireframe = this.isWireframe;
            }
          }
        });
      }
    });

    this.btnResetCamera.addEventListener('click', () => {
      this.centerModelInView();
    });

    this.btnToggleGrid.addEventListener('click', () => {
      this.gridHelper.visible = !this.gridHelper.visible;
      this.btnToggleGrid.classList.toggle('active', this.gridHelper.visible);
    });
  }

  private async checkApiStatus(): Promise<void> {
    const res = await this.generator.checkAuth();
    if (res.authenticated) {
      this.authStatusBadge.className = 'auth-badge';
      this.authStatusText.textContent = 'Hyper3D Conectado';
      this.authStatusBadge.title = res.message;
    } else {
      this.authStatusBadge.className = 'auth-badge unauth';
      this.authStatusText.textContent = 'API Key requerida';
      this.authStatusBadge.title = res.message;
    }
  }

  private async handleGenerate(): Promise<void> {
    const prompt = this.promptInput.value.trim();
    const hasImage = this.imageInput.files && this.imageInput.files.length > 0;

    if (!prompt && !hasImage) {
      alert('Por favor introduce una descripción en el prompt o selecciona una imagen de referencia.');
      return;
    }

    this.btnGenerate.disabled = true;
    this.progressBox.style.display = 'flex';
    this.progressStage.textContent = 'Enviando solicitud a Hyper3D Rodin...';
    this.progressPercent.textContent = '5%';
    this.progressBarFill.style.width = '5%';
    this.progressDetails.textContent = 'Creando tarea de generación 3D...';

    try {
      let task: GenerationTask;
      const tier = this.tierSelect.value as any;
      const mesh_mode = this.meshModeSelect.value as any;

      if (hasImage) {
        task = await this.generator.generateFromImage({
          image: this.imageInput.files![0],
          prompt,
          tier,
          mesh_mode,
        });
      } else {
        task = await this.generator.generateFromText({
          prompt,
          tier,
          mesh_mode,
        });
      }

      this.progressStage.textContent = 'Procesando en servidor Rodin...';
      this.progressDetails.textContent = `UUID: ${task.taskUuid} | Consumo: ${task.consumed ?? 0.5} créditos`;
      this.progressBarFill.style.width = '20%';

      // Iniciar sondeo
      this.pollGenerationStatus(task);
    } catch (err: any) {
      console.error('[Studio] Error de generación:', err);
      alert(`Error al iniciar generación: ${err.message}`);
      this.btnGenerate.disabled = false;
      this.progressBox.style.display = 'none';
    }
  }

  private pollGenerationStatus(task: GenerationTask): void {
    if (this.activePollingInterval) {
      clearInterval(this.activePollingInterval);
    }

    let pollCount = 0;
    this.activePollingInterval = setInterval(async () => {
      pollCount++;
      try {
        const statusRes = await this.generator.getGenerationStatus(task.subscriptionKey);

        if (statusRes.status === 'RUNNING' || statusRes.status === 'PENDING') {
          const estimatedPercent = Math.min(92, 20 + pollCount * 5);
          const percent = statusRes.progress ?? estimatedPercent;
          this.progressPercent.textContent = `${percent}%`;
          this.progressBarFill.style.width = `${percent}%`;
          this.progressStage.textContent = `Generando geometría 3D (${statusRes.status})...`;
        } else if (statusRes.status === 'SUCCEEDED') {
          clearInterval(this.activePollingInterval);
          this.progressPercent.textContent = '100%';
          this.progressBarFill.style.width = '100%';
          this.progressStage.textContent = 'Descargando modelo GLB...';

          await this.finishAndLoadModel(task.taskUuid);
        } else if (statusRes.status === 'FAILED') {
          clearInterval(this.activePollingInterval);
          throw new Error('La tarea fue marcada como FALLIDA por Hyper3D Rodin.');
        }
      } catch (err: any) {
        clearInterval(this.activePollingInterval);
        console.error('[Studio] Error consultando tarea:', err);
        alert(`Error durante la generación: ${err.message}`);
        this.btnGenerate.disabled = false;
        this.progressBox.style.display = 'none';
      }
    }, 3000);
  }

  private async finishAndLoadModel(taskUuid: string): Promise<void> {
    try {
      const slot = this.slotSelect.value;
      const downloadRes = await this.generator.downloadModel(taskUuid, `unam_${slot}`);

      this.progressDetails.textContent = `GLB descargado con éxito. Cargando en Three.js...`;

      // Cargar en el visor
      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          downloadRes.downloadUrl,
          (loaded) => resolve(loaded),
          undefined,
          (err) => reject(err)
        );
      });

      this.setModelInScene(gltf);
      this.progressBox.style.display = 'none';
      this.btnGenerate.disabled = false;
    } catch (err: any) {
      console.error('[Studio] Error cargando GLB final:', err);
      alert(`Error al descargar o cargar el modelo GLB: ${err.message}`);
      this.btnGenerate.disabled = false;
      this.progressBox.style.display = 'none';
    }
  }

  private setModelInScene(gltf: any): void {
    if (this.currentModelGroup) {
      this.scene.remove(this.currentModelGroup);
      this.disposeObject(this.currentModelGroup);
    }

    this.currentRawGLTF = gltf;
    const model = gltf.scene as THREE.Group;

    // Normalizar escala y grounding
    const bbox = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    model.position.sub(center); // Centrar en origen
    const minY = new THREE.Box3().setFromObject(model).min.y;
    model.position.y -= minY; // Apoyar en el suelo

    // Sombras y materiales
    model.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        const mesh = c as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    this.currentModelGroup = model;
    this.scene.add(model);

    // Ocultar placeholder
    this.emptyState.style.display = 'none';
    this.questPanel.style.display = 'flex';

    // Actualizar métricas
    this.updateMetricsDisplay(model);
    this.centerModelInView();
  }

  private updateMetricsDisplay(object: THREE.Object3D): void {
    const metrics = computeMetrics(object);
    let meshCount = 0;
    object.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) meshCount++;
    });

    this.metricTris.textContent = metrics.triangleCount.toLocaleString();
    this.metricVerts.textContent = metrics.vertexCount.toLocaleString();
    this.metricMeshes.textContent = meshCount.toString();
    this.metricSize.textContent = `${metrics.dimensions.width} × ${metrics.dimensions.height} × ${metrics.dimensions.depth} m`;

    // Alerta de rendimiento para Quest 3
    if (metrics.triangleCount > 150000) {
      this.metricTris.style.color = 'var(--danger)';
    } else if (metrics.triangleCount > 90000) {
      this.metricTris.style.color = 'var(--warning)';
    } else {
      this.metricTris.style.color = 'var(--puma-accent)';
    }
  }

  private centerModelInView(): void {
    if (!this.currentModelGroup) return;
    const bbox = new THREE.Box3().setFromObject(this.currentModelGroup);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 5);

    this.camera.position.set(maxDim * 1.4, maxDim * 0.9, maxDim * 1.5);
    this.controls.target.set(0, size.y * 0.4, 0);
    this.controls.update();
  }

  private async handleOptimize(): Promise<void> {
    if (!this.currentModelGroup) return;

    this.btnOptimize.disabled = true;
    this.btnOptimize.textContent = '⏳ Optimizando geometría...';

    try {
      const ratio = Number(this.reductionSlider.value) / 100;
      const mergeDrawCalls = this.checkMergeDrawCalls.checked;
      const makeDoubleSided = this.checkDoubleSided.checked;

      const optResult = await this.generator.optimizeModel(this.currentModelGroup, {
        targetRatio: ratio,
        mergeDrawCalls,
        makeDoubleSided,
        recomputeNormals: true,
      });

      this.scene.remove(this.currentModelGroup);
      this.disposeObject(this.currentModelGroup);

      this.currentModelGroup = optResult.optimizedScene;
      this.scene.add(this.currentModelGroup);

      this.updateMetricsDisplay(this.currentModelGroup);

      alert(
        `Optimización Meta Quest completada:\n• Reducción de triángulos: ${optResult.reductionPercentage}%\n• Antes: ${optResult.originalTriangles.toLocaleString()} | Después: ${optResult.optimizedTriangles.toLocaleString()}\n• Draw calls: ${optResult.drawCallReduction.before} ➔ ${optResult.drawCallReduction.after}`
      );
    } catch (err: any) {
      console.error('[Studio] Error de optimización:', err);
      alert(`Error al optimizar modelo: ${err.message}`);
    } finally {
      this.btnOptimize.disabled = false;
      this.btnOptimize.textContent = '⚡ Ejecutar Optimización WebXR';
    }
  }

  private async handleDownloadGLB(): Promise<void> {
    if (!this.currentModelGroup) return;
    try {
      const buffer = await exportSceneToGLBBuffer(this.currentModelGroup);
      const slot = this.slotSelect.value;
      const blob = new Blob([buffer], { type: 'model/gltf-binary' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `unam_${slot}_optimizado_quest.glb`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      alert(`Error exportando GLB: ${err.message}`);
    }
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    });
  }

  private onWindowResize(): void {
    const container = document.getElementById('webgl-canvas')!;
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Inicializar al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  new StudioApp();
});
