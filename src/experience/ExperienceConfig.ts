/**
 * Configuración central y parámetros ajustables para la experiencia UNAM - PC PUMA.
 */

export interface ExperienceConfigData {
  /** Duración de la fase de exploración libre (en segundos) */
  explorationDuration: number;
  /** Duración de la pantalla de cierre PC PUMA antes del reinicio (en segundos) */
  outroDuration: number;
  /** Duración del temporizador de reinicio automático (en segundos) */
  autoResetDuration: number;
  /** Ruta o URL del archivo de video institucional */
  videoPath: string;
  /** Modo de video: 'standard' (plano 16:9), 'curved' (pantalla curva de cine) o '360' */
  videoScreenMode: 'standard' | 'curved' | '360';
  /** Ancho de la pantalla virtual en metros */
  videoScreenWidth: number;
  /** Alto de la pantalla virtual en metros */
  videoScreenHeight: number;
  /** Distancia de la pantalla virtual frente al usuario en metros */
  videoScreenDistance: number;
  /** Altura del centro de la pantalla virtual sobre el suelo en metros */
  videoScreenHeightAboveGround: number;
  /** Audio ambiental activado por defecto */
  ambientAudioEnabled: boolean;
  /** Volumen del audio ambiental (0.0 a 1.0) */
  ambientVolume: number;
  /** Volumen del video institucional (0.0 a 1.0) */
  videoVolume: number;
  /** Tasa de fotogramas objetivo para Meta Quest (Hz) */
  targetFrameRate: number;
  /** Colores institucionales UNAM y PC PUMA */
  colors: {
    unamBlue: number;
    unamGold: number;
    pcpumaDark: number;
    pcpumaCyan: number;
    pureWhite: number;
    slateDark: number;
  };
}

export const DEFAULT_CONFIG: ExperienceConfigData = {
  explorationDuration: 35, // 35 segundos para contemplar Ciudad Universitaria
  outroDuration: 10,       // 10 segundos para contemplar PC PUMA
  autoResetDuration: 10,   // 10 segundos de cuenta regresiva para el siguiente asistente
  videoPath: 'assets/videos/video-institucional.mp4',
  videoScreenMode: 'curved',
  videoScreenWidth: 4.8,
  videoScreenHeight: 2.7,
  videoScreenDistance: 4.2,
  videoScreenHeightAboveGround: 2.0,
  ambientAudioEnabled: true,
  ambientVolume: 0.35,
  videoVolume: 1.0,
  targetFrameRate: 90,
  colors: {
    unamBlue: 0x00172D,    // Azul noche institucional UNAM
    unamGold: 0xD4AF37,    // Dorado universitario
    pcpumaDark: 0x070E1A,  // Fondo oscuro de alto contraste
    pcpumaCyan: 0x00F0FF,  // Acento tecnológico PC PUMA
    pureWhite: 0xFFFFFF,
    slateDark: 0x1E293B,
  },
};
