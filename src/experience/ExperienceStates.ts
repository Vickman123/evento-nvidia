/**
 * Enumeración y tipos de datos para los estados de la experiencia UNAM - PC PUMA.
 */

export enum ExperienceState {
  /** Estado 1: Pantalla inicial de bienvenida en espera de visitante */
  IDLE = 'IDLE',
  /** Estado 2: Petición y calibración de la sesión WebXR (immersive-vr) */
  ENTER_XR = 'ENTER_XR',
  /** Estado 3: Exploración libre 360° de Ciudad Universitaria */
  EXPLORATION = 'EXPLORATION',
  /** Estado 4: Transición cinematográfica y aparición de pantalla */
  TRANSITION_TO_CINEMA = 'TRANSITION_TO_CINEMA',
  /** Estado 5: Reproducción de video institucional en pantalla virtual */
  VIDEO_PLAYBACK = 'VIDEO_PLAYBACK',
  /** Estado 6: Cierre institucional y animación de PC PUMA */
  PC_PUMA_OUTRO = 'PC_PUMA_OUTRO',
  /** Estado 7: Pantalla de reinicio con temporizador automático */
  RESET_READY = 'RESET_READY',
}

export interface StateChangePayload {
  previous: ExperienceState;
  current: ExperienceState;
  timestamp: number;
}

export type StateListener = (state: ExperienceState, payload: StateChangePayload) => void;
