/**
 * Gestor de Almacenamiento Local y Modo Offline para UNAM Immersive Experience.
 * Guarda en memoria persistente (IndexedDB) el video institucional (41MB) y el escenario 3D (13MB),
 * permitiendo la ejecución fluida en Meta Quest 3S y Desktop sin depender de la conexión a internet del evento.
 */

export interface CacheProgress {
  assetKey: string;
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  overallPercent: number;
  status: 'idle' | 'checking' | 'downloading' | 'saving' | 'ready' | 'error';
  errorMessage?: string;
}

export interface CacheStatus {
  isFullyCached: boolean;
  videoCached: boolean;
  modelCached: boolean;
  totalBytesCached: number;
  storageUsageMB: number;
  storageQuotaMB: number;
}

export type CacheProgressListener = (progress: CacheProgress) => void;
export type CacheStatusListener = (status: CacheStatus) => void;

const DB_NAME = 'UNAM_XR_OFFLINE_DB';
const DB_VERSION = 1;
const STORE_NAME = 'media_cache';

export const OFFLINE_ASSET_KEYS = {
  VIDEO: 'video-institucional',
  DIORAMA_MODEL: 'unam_biblioteca_diorama',
} as const;

export class OfflineStorageManager {
  private static instance: OfflineStorageManager | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private blobUrlCache: Map<string, string> = new Map();
  private progressListeners: Set<CacheProgressListener> = new Set();
  private statusListeners: Set<CacheStatusListener> = new Set();
  private currentProgress: CacheProgress = {
    assetKey: '',
    loadedBytes: 0,
    totalBytes: 0,
    percent: 0,
    overallPercent: 0,
    status: 'idle',
  };
  private isDownloading: boolean = false;

  private constructor() {
    this.requestPersistence();
  }

  public static getInstance(): OfflineStorageManager {
    if (!OfflineStorageManager.instance) {
      OfflineStorageManager.instance = new OfflineStorageManager();
    }
    return OfflineStorageManager.instance;
  }

  /**
   * Solicita al navegador (Chromium/Meta Quest Browser) almacenamiento persistente
   * para prevenir que el visor borre los archivos descargados por presión de disco.
   */
  private async requestPersistence(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.info(`[OfflineStorage] Almacenamiento persistente concedido: ${isPersisted}`);
        return isPersisted;
      }
    } catch (e) {
      console.warn('[OfflineStorage] Error al solicitar almacenamiento persistente:', e);
    }
    return false;
  }

  /**
   * Conecta con la base de datos IndexedDB local.
   */
  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB no está soportado en este navegador.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onerror = (event) => {
        console.error('[OfflineStorage] Error al abrir IndexedDB:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Verifica si un recurso está almacenado localmente en IndexedDB.
   */
  public async hasAsset(key: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(!!req.result && !!req.result.blob);
        req.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  /**
   * Obtiene el Blob de un recurso almacenado.
   */
  public async getAssetBlob(key: string): Promise<Blob | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.blob) {
            resolve(req.result.blob as Blob);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn(`[OfflineStorage] Error al leer recurso ${key}:`, e);
      return null;
    }
  }

  /**
   * Guarda un Blob en IndexedDB.
   */
  public async saveAssetBlob(key: string, blob: Blob, mimeType: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const data = {
        key,
        blob,
        mimeType,
        size: blob.size,
        timestamp: Date.now(),
      };
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Obtiene o genera una URL local en memoria (blob:) para un recurso.
   */
  public async getAssetBlobUrl(key: string): Promise<string | null> {
    if (this.blobUrlCache.has(key)) {
      return this.blobUrlCache.get(key)!;
    }

    const blob = await this.getAssetBlob(key);
    if (!blob) return null;

    const url = URL.createObjectURL(blob);
    this.blobUrlCache.set(key, url);
    return url;
  }

  /**
   * Obtiene la URL local del video institucional si existe, o devuelve la ruta relativa estándar.
   */
  public async getVideoUrl(fallbackUrl: string = 'assets/videos/video-institucional.mp4'): Promise<string> {
    const localUrl = await this.getAssetBlobUrl(OFFLINE_ASSET_KEYS.VIDEO);
    if (localUrl) {
      console.info('[OfflineStorage] Usando video institucional desde memoria local (Offline Blob URL).');
      return localUrl;
    }
    return fallbackUrl;
  }

  /**
   * Devuelve el estado general del almacenamiento offline.
   */
  public async checkCacheStatus(): Promise<CacheStatus> {
    const [videoCached, modelCached] = await Promise.all([
      this.hasAsset(OFFLINE_ASSET_KEYS.VIDEO),
      this.hasAsset(OFFLINE_ASSET_KEYS.DIORAMA_MODEL),
    ]);

    let totalBytesCached = 0;
    if (videoCached) {
      const b = await this.getAssetBlob(OFFLINE_ASSET_KEYS.VIDEO);
      if (b) totalBytesCached += b.size;
    }
    if (modelCached) {
      const b = await this.getAssetBlob(OFFLINE_ASSET_KEYS.DIORAMA_MODEL);
      if (b) totalBytesCached += b.size;
    }

    let storageUsageMB = 0;
    let storageQuotaMB = 0;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        storageUsageMB = Math.round(((estimate.usage || 0) / (1024 * 1024)) * 10) / 10;
        storageQuotaMB = Math.round(((estimate.quota || 0) / (1024 * 1024)) * 10) / 10;
      }
    } catch (e) {}

    const isFullyCached = videoCached && modelCached;

    const status: CacheStatus = {
      isFullyCached,
      videoCached,
      modelCached,
      totalBytesCached,
      storageUsageMB,
      storageQuotaMB,
    };

    this.notifyStatus(status);
    return status;
  }

  /**
   * Descarga un archivo con seguimiento preciso de bytes y porcentaje.
   */
  private async fetchWithProgress(
    url: string,
    mimeType: string,
    assetKey: string,
    assetLabel: string,
    onProgress: (loaded: number, total: number, percent: number) => void
  ): Promise<Blob> {
    console.info(`[OfflineStorage] Iniciando descarga de ${assetLabel}: ${url}`);

    const base = import.meta.env.BASE_URL || '/';
    const cleanBase = base.endsWith('/') ? base : `${base}/`;
    const resolvedUrl = url.startsWith('http') ? url : (url.startsWith('/') ? url : `${cleanBase}${url}`);

    const response = await fetch(resolvedUrl);
    if (!response.ok) {
      throw new Error(`Error HTTP al descargar ${assetLabel}: ${response.status} ${response.statusText}`);
    }

    const contentLengthHeader = response.headers.get('content-length');
    let totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
    if (!totalBytes || isNaN(totalBytes)) {
      // Estimación si no viene content-length
      totalBytes = assetKey === OFFLINE_ASSET_KEYS.VIDEO ? 42624804 : 13735000;
    }

    if (!response.body) {
      // Fallback a blob directo si ReadableStream no estuviera disponible
      const blob = await response.blob();
      onProgress(blob.size, blob.size, 100);
      return new Blob([blob], { type: mimeType });
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loadedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        chunks.push(value);
        loadedBytes += value.length;
        const percent = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
        onProgress(loadedBytes, totalBytes, percent);
      }
    }

    console.info(`[OfflineStorage] Descarga completada para ${assetLabel}: ${(loadedBytes / (1024 * 1024)).toFixed(1)} MB.`);
    return new Blob(chunks as unknown as BlobPart[], { type: mimeType });
  }

  /**
   * Descarga y guarda localmente todos los recursos principales (Video 41MB y Diorama 13MB)
   * permitiendo que el visor opere al 100% sin internet.
   */
  public async downloadAllForOffline(): Promise<void> {
    if (this.isDownloading) {
      console.warn('[OfflineStorage] Descarga offline ya se encuentra en progreso.');
      return;
    }

    this.isDownloading = true;

    try {
      this.updateProgress({
        assetKey: 'init',
        loadedBytes: 0,
        totalBytes: 56359804,
        percent: 0,
        overallPercent: 0,
        status: 'checking',
      });

      // 1. Descargar Video Institucional (41MB)
      const videoCached = await this.hasAsset(OFFLINE_ASSET_KEYS.VIDEO);
      if (!videoCached) {
        this.updateProgress({
          assetKey: OFFLINE_ASSET_KEYS.VIDEO,
          loadedBytes: 0,
          totalBytes: 42624804,
          percent: 0,
          overallPercent: 5,
          status: 'downloading',
        });

        const videoBlob = await this.fetchWithProgress(
          'assets/videos/video-institucional.mp4',
          'video/mp4',
          OFFLINE_ASSET_KEYS.VIDEO,
          'Video Institucional',
          (loaded, total, percent) => {
            // El video representa ~75% del peso total
            const overall = Math.round(percent * 0.75);
            this.updateProgress({
              assetKey: OFFLINE_ASSET_KEYS.VIDEO,
              loadedBytes: loaded,
              totalBytes: total,
              percent,
              overallPercent: overall,
              status: 'downloading',
            });
          }
        );

        this.updateProgress({
          assetKey: OFFLINE_ASSET_KEYS.VIDEO,
          loadedBytes: videoBlob.size,
          totalBytes: videoBlob.size,
          percent: 100,
          overallPercent: 75,
          status: 'saving',
        });

        await this.saveAssetBlob(OFFLINE_ASSET_KEYS.VIDEO, videoBlob, 'video/mp4');
        console.info('[OfflineStorage] Video institucional guardado en IndexedDB con éxito.');
      }

      // 2. Descargar Escenario 3D Diorama de Biblioteca Central (13MB)
      const modelCached = await this.hasAsset(OFFLINE_ASSET_KEYS.DIORAMA_MODEL);
      if (!modelCached) {
        this.updateProgress({
          assetKey: OFFLINE_ASSET_KEYS.DIORAMA_MODEL,
          loadedBytes: 0,
          totalBytes: 13735000,
          percent: 0,
          overallPercent: 75,
          status: 'downloading',
        });

        const modelBlob = await this.fetchWithProgress(
          'assets/models/unam_biblioteca_diorama.glb',
          'model/gltf-binary',
          OFFLINE_ASSET_KEYS.DIORAMA_MODEL,
          'Escenario Diorama 3D',
          (loaded, total, percent) => {
            // El modelo 3D representa el 25% restante (del 75% al 100%)
            const overall = Math.min(100, Math.round(75 + percent * 0.25));
            this.updateProgress({
              assetKey: OFFLINE_ASSET_KEYS.DIORAMA_MODEL,
              loadedBytes: loaded,
              totalBytes: total,
              percent,
              overallPercent: overall,
              status: 'downloading',
            });
          }
        );

        this.updateProgress({
          assetKey: OFFLINE_ASSET_KEYS.DIORAMA_MODEL,
          loadedBytes: modelBlob.size,
          totalBytes: modelBlob.size,
          percent: 100,
          overallPercent: 98,
          status: 'saving',
        });

        await this.saveAssetBlob(OFFLINE_ASSET_KEYS.DIORAMA_MODEL, modelBlob, 'model/gltf-binary');
        console.info('[OfflineStorage] Escenario 3D guardado en IndexedDB con éxito.');
      }

      // Completado exitosamente
      this.updateProgress({
        assetKey: 'complete',
        loadedBytes: 56359804,
        totalBytes: 56359804,
        percent: 100,
        overallPercent: 100,
        status: 'ready',
      });

      await this.checkCacheStatus();
      console.info('[OfflineStorage] Experiencia 100% guardada localmente para modo sin conexión.');
    } catch (error: any) {
      console.error('[OfflineStorage] Error durante la descarga offline:', error);
      this.updateProgress({
        assetKey: 'error',
        loadedBytes: 0,
        totalBytes: 0,
        percent: 0,
        overallPercent: 0,
        status: 'error',
        errorMessage: error?.message || 'Error desconocido al descargar archivos.',
      });
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * Borra el caché local si el operador necesita liberar espacio o recargar una versión nueva.
   */
  public async clearCache(): Promise<void> {
    try {
      // Liberar URLs de blob
      for (const url of this.blobUrlCache.values()) {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {}
      }
      this.blobUrlCache.clear();

      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      console.info('[OfflineStorage] Caché local de IndexedDB limpiado con éxito.');
      await this.checkCacheStatus();
    } catch (e) {
      console.warn('[OfflineStorage] Error al limpiar caché local:', e);
    }
  }

  public onProgress(listener: CacheProgressListener): () => void {
    this.progressListeners.add(listener);
    listener(this.currentProgress);
    return () => this.progressListeners.delete(listener);
  }

  public onStatus(listener: CacheStatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private updateProgress(progress: CacheProgress): void {
    this.currentProgress = progress;
    for (const listener of this.progressListeners) {
      try {
        listener(progress);
      } catch (e) {}
    }
  }

  private notifyStatus(status: CacheStatus): void {
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (e) {}
    }
  }
}

export const offlineStorage = OfflineStorageManager.getInstance();
