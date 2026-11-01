import type { XRApp } from '../XRApp';
import type { LoadedModel } from '../types';

export interface LocalDropOptions {
  domElement?: HTMLElement;
  targetPosition?: [number, number, number];
  maxDimension?: number;
  autoGround?: boolean;
  showOverlay?: boolean;
  onModelLoaded?: (model: LoadedModel, file: File) => void;
  onError?: (error: Error) => void;
}

export function enableLocalFileDrop(
  app: XRApp,
  options: LocalDropOptions = {}
): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const targetEl = options.domElement || document.body;
  const showOverlay = options.showOverlay !== false;

  let overlay: HTMLElement | null = null;
  let dragCounter = 0;

  if (showOverlay) {
    overlay = document.createElement('div');
    overlay.className = 'vxr-drop-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '9999',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '4px dashed #38bdf8',
      boxSizing: 'border-box',
      pointerEvents: 'none',
      transition: 'opacity 0.2s ease',
      opacity: '0'
    });

    overlay.innerHTML = `
      <div style="text-align: center; color: #f8fafc; font-family: system-ui, sans-serif;">
        <div style="font-size: 64px; margin-bottom: 12px; animation: bounce 1s infinite alternate;">📦</div>
        <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #38bdf8;">Suelta tu modelo 3D (.glb / .gltf)</h2>
        <p style="margin: 0; font-size: 14px; color: #94a3b8;">Procesamiento 100% en tu navegador (sin subir a ningún servidor)</p>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragCounter++;
    if (overlay) {
      overlay.style.display = 'flex';
      requestAnimationFrame(() => {
        if (overlay) overlay.style.opacity = '1';
      });
    }
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0 && overlay) {
      dragCounter = 0;
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay && dragCounter === 0) overlay.style.display = 'none';
      }, 200);
    }
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    dragCounter = 0;
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.display = 'none';
    }

    if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) {
      return;
    }

    const file = e.dataTransfer.files[0];
    const name = file.name.toLowerCase();

    if (!name.endsWith('.glb') && !name.endsWith('.gltf')) {
      const err = new Error('Solo se admiten formatos 3D estándar (.glb o .gltf)');
      if (options.onError) options.onError(err);
      return;
    }

    try {
      const loaded = await app.assets.loadModel(file, {
        autoGround: options.autoGround !== false,
        autoCenter: true
      });

      if (options.maxDimension && options.maxDimension > 0) {
        const { width, height, depth } = loaded.metrics.dimensions;
        const maxCurrent = Math.max(width, height, depth);
        if (maxCurrent > 0) {
          const s = options.maxDimension / maxCurrent;
          loaded.group.scale.set(s, s, s);
        }
      }

      if (options.targetPosition) {
        loaded.group.position.set(
          options.targetPosition[0],
          options.targetPosition[1],
          options.targetPosition[2]
        );
      }

      app.scene.nativeScene.add(loaded.group);

      if (app.audio) {
        app.audio.playSuccess();
      }

      if (options.onModelLoaded) {
        options.onModelLoaded(loaded, file);
      }
    } catch (err: any) {
      if (app.audio) {
        app.audio.playAlert();
      }
      if (options.onError) {
        options.onError(err);
      } else {
        console.error('[VXR LocalDrop] Error cargando archivo:', err);
      }
    }
  };

  targetEl.addEventListener('dragenter', onDragEnter);
  targetEl.addEventListener('dragover', onDragOver);
  targetEl.addEventListener('dragleave', onDragLeave);
  targetEl.addEventListener('drop', onDrop);

  return () => {
    targetEl.removeEventListener('dragenter', onDragEnter);
    targetEl.removeEventListener('dragover', onDragOver);
    targetEl.removeEventListener('dragleave', onDragLeave);
    targetEl.removeEventListener('drop', onDrop);
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };
}
