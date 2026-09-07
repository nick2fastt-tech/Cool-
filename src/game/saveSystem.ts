import { MAX_NIGHT, QUALITY_ORDER, type QualityPreset } from './config';

export interface Settings {
  quality: QualityPreset;
  /** Look sensitivity for drag-to-turn, 0.4 - 2.0. */
  sensitivity: number;
  /** Touch button scale, 0.7 - 1.5. */
  buttonScale: number;
  /** HUD opacity, 0.3 - 1.0. */
  uiOpacity: number;
  leftHanded: boolean;
  masterVolume: number;
  sfxVolume: number;
  /** Longer, classic-length hours instead of the mobile-friendly default. */
  classicPacing: boolean;
  haptics: boolean;
  subtitles: boolean;
}

export interface SaveData {
  version: number;
  /** Highest night the player has beaten. */
  nightsCompleted: number;
  /** Highest night that may be selected (always completed + 1, capped). */
  unlockedNight: number;
  multiplayerUnlocked: boolean;
  seenHusk: boolean;
  stats: {
    nightsAttempted: number;
    deaths: number;
    blackoutsSurvived: number;
    totalSeconds: number;
  };
  settings: Settings;
}

const KEY = 'hollow-shift.save.v1';
const VERSION = 1;

export function defaultSettings(quality: QualityPreset = 'medium'): Settings {
  return {
    quality,
    sensitivity: 1,
    buttonScale: 1,
    uiOpacity: 0.85,
    leftHanded: false,
    masterVolume: 0.9,
    sfxVolume: 1,
    classicPacing: false,
    haptics: true,
    subtitles: false,
  };
}

export function defaultSave(quality: QualityPreset = 'medium'): SaveData {
  return {
    version: VERSION,
    nightsCompleted: 0,
    unlockedNight: 1,
    multiplayerUnlocked: false,
    seenHusk: false,
    stats: { nightsAttempted: 0, deaths: 0, blackoutsSurvived: 0, totalSeconds: 0 },
    settings: defaultSettings(quality),
  };
}

/**
 * Progress and settings persistence.
 *
 * Always writes through on change - a horror game that loses your Night 5 clear
 * because the app was swiped away is worse than any animatronic. Falls back to
 * an in-memory store when storage is unavailable (private mode, headless test)
 * rather than throwing.
 */
export class SaveSystem {
  private data: SaveData;
  private memoryOnly = false;

  constructor(defaultQuality: QualityPreset = 'medium') {
    this.data = this.load(defaultQuality);
  }

  get value(): Readonly<SaveData> {
    return this.data;
  }

  get settings(): Readonly<Settings> {
    return this.data.settings;
  }

  private load(defaultQuality: QualityPreset): SaveData {
    try {
      const raw = globalThis.localStorage?.getItem(KEY);
      if (!raw) return defaultSave(defaultQuality);
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const base = defaultSave(defaultQuality);
      const merged: SaveData = {
        ...base,
        ...parsed,
        stats: { ...base.stats, ...(parsed.stats ?? {}) },
        settings: { ...base.settings, ...(parsed.settings ?? {}) },
        version: VERSION,
      };
      // Repair anything a corrupt or hand-edited file could have broken.
      if (!QUALITY_ORDER.includes(merged.settings.quality)) merged.settings.quality = defaultQuality;
      merged.nightsCompleted = clampInt(merged.nightsCompleted, 0, MAX_NIGHT);
      merged.unlockedNight = clampInt(merged.unlockedNight, 1, MAX_NIGHT);
      merged.unlockedNight = Math.max(merged.unlockedNight, Math.min(MAX_NIGHT, merged.nightsCompleted + 1));
      merged.multiplayerUnlocked = merged.multiplayerUnlocked || merged.nightsCompleted >= 1;
      return merged;
    } catch {
      this.memoryOnly = true;
      return defaultSave(defaultQuality);
    }
  }

  private flush(): void {
    if (this.memoryOnly) return;
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(this.data));
    } catch {
      this.memoryOnly = true;
    }
  }

  updateSettings(patch: Partial<Settings>): Readonly<Settings> {
    this.data.settings = { ...this.data.settings, ...patch };
    this.flush();
    return this.data.settings;
  }

  /** Record a completed night; unlocks the next one and, after Night 1, co-op. */
  completeNight(night: number): void {
    this.data.nightsCompleted = Math.max(this.data.nightsCompleted, Math.min(MAX_NIGHT, night));
    this.data.unlockedNight = Math.max(
      this.data.unlockedNight,
      Math.min(MAX_NIGHT, this.data.nightsCompleted + 1),
    );
    if (this.data.nightsCompleted >= 1) this.data.multiplayerUnlocked = true;
    this.flush();
  }

  recordAttempt(): void {
    this.data.stats.nightsAttempted++;
    this.flush();
  }

  recordDeath(): void {
    this.data.stats.deaths++;
    this.flush();
  }

  recordBlackoutSurvived(): void {
    this.data.stats.blackoutsSurvived++;
    this.flush();
  }

  addPlaytime(seconds: number): void {
    this.data.stats.totalSeconds += seconds;
    this.flush();
  }

  markHuskSeen(): void {
    if (this.data.seenHusk) return;
    this.data.seenHusk = true;
    this.flush();
  }

  isNightUnlocked(night: number): boolean {
    return night <= this.data.unlockedNight;
  }

  reset(): void {
    this.data = defaultSave(this.data.settings.quality);
    this.flush();
  }
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : min;
  return Math.max(min, Math.min(max, n));
}
