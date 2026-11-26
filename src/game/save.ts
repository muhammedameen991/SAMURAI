import { SaveData } from './types';

const SAVE_KEY = 'samurai_shogun_save_v1';

export function hasSaveData(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveData;
    return Boolean(parsed && parsed.version === 1 && parsed.player);
  } catch {
    return false;
  }
}

export function loadSaveData(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveData;
    if (!parsed || parsed.version !== 1 || !parsed.player) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSaveData(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearSaveData(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore
  }
}
