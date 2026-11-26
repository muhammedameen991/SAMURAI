import { GameSettings, QualityPreset } from './types';
import { detectHardwareProfile } from './utils';

const SETTINGS_KEY = 'samurai_shogun_settings_v1';

export const QUALITY_PRESETS: Record<
  QualityPreset,
  Pick<
    GameSettings,
    'resolutionScale' | 'shadows' | 'ambientEffects' | 'drawDistance' | 'particleEffects'
  >
> = {
  low: {
    resolutionScale: 0.72,
    shadows: false,
    ambientEffects: false,
    drawDistance: 155,
    particleEffects: false,
  },
  medium: {
    resolutionScale: 0.88,
    shadows: true,
    ambientEffects: true,
    drawDistance: 230,
    particleEffects: true,
  },
  high: {
    resolutionScale: 1.0,
    shadows: true,
    ambientEffects: true,
    drawDistance: 320,
    particleEffects: true,
  },
};

export function getDefaultSettings(): GameSettings {
  const { isLowEnd } = detectHardwareProfile();
  const preset: QualityPreset = isLowEnd ? 'low' : 'medium';
  return {
    quality: preset,
    ...QUALITY_PRESETS[preset],
    showFps: false,
    atmosphere: 'dynamic',
    masterVolume: 0.75,
    musicVolume: 0.5,
    sfxVolume: 0.85,
    muted: false,
    mouseSensitivity: 1.0,
  };
}

export function loadSettings(): GameSettings {
  const defaults = getDefaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}
