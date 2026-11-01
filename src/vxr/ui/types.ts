import type * as THREE from 'three';

/**
 * Slide or media item to display on an XRDisplayScreen or XRBillboard.
 */
export interface XRMediaItem {
  /** Unique identifier for the item */
  id: string;
  /** Type of media content */
  type?: 'image' | 'video' | 'html' | 'color';
  /** URL of the image, poster or video source */
  src?: string;
  /** Primary title text */
  title?: string;
  /** Secondary subtitle or phase tag */
  subtitle?: string;
  /** Detailed description or caption */
  caption?: string;
  /** Category badge text (e.g. 'PHOTO 1/4', 'LIVE FEED') */
  badge?: string;
  /** Custom accent color (Hex string or numeric Three.js color) */
  accentColor?: string | number;
  /** Lucide/Emoji icon representation */
  icon?: string;
  /** Custom metadata payload */
  metadata?: Record<string, unknown>;
}

/**
 * Interactive button definition embedded directly onto a 3D canvas billboard.
 */
export interface XRCanvasHotspot {
  id: string;
  /** Normalized UV bounds: [uMin, vMin, uMax, vMax] (from 0 to 1) */
  bounds: [number, number, number, number];
  /** Action name or label */
  label?: string;
  /** Callback triggered when raycaster clicks this UV region */
  onClick?: (hotspot: XRCanvasHotspot) => void;
}

/**
 * Options for configuring an XRDisplayScreen.
 */
export interface XRDisplayScreenOptions {
  /** Screen physical width in meters (Default: 4.0) */
  width?: number;
  /** Screen physical height in meters (Default: 2.25 for 16:9) */
  height?: number;
  /** Canvas internal texture resolution width in pixels (Default: 1920) */
  resolutionWidth?: number;
  /** Canvas internal texture resolution height in pixels (Default: 1080) */
  resolutionHeight?: number;
  /** Architectural frame color (Default: 0x08111d) */
  frameColor?: number | string;
  /** Frame bevel emissive accent color (Default: 0x00f0ff) */
  accentColor?: number | string;
  /** Whether to show a pedestal base underneath the screen (Default: true) */
  hasBase?: boolean;
  /** Background theme: 'cyber-dark' | 'neon-slate' | 'minimal-light' | 'transparent' */
  theme?: 'cyber-dark' | 'neon-slate' | 'minimal-light' | 'transparent';
  /** Array of media items to display as a carousel/playlist */
  items?: XRMediaItem[];
  /** Whether to automatically cycle through media items (Default: false) */
  autoCycle?: boolean;
  /** Interval in seconds between automatic cycle transitions (Default: 7.0) */
  cycleInterval?: number;
  /** Whether the screen is curved / cylindrical (Default: false) */
  curved?: boolean;
  /** Curve radius in meters if curved is true (Default: 5.0) */
  curveRadius?: number;
  /** Video loop setting when playing video media (Default: true) */
  videoLoop?: boolean;
  /** Video muted setting for autoplay compatibility (Default: true) */
  videoMuted?: boolean;
  /** Optional custom draw callback to render custom 2D graphics per frame */
  onDraw?: (ctx: CanvasRenderingContext2D, width: number, height: number, activeItem?: XRMediaItem) => void;
}
