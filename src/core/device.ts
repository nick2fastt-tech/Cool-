import type { QualityPreset } from '../game/config';

export interface DeviceProfile {
  isTouch: boolean;
  cores: number;
  memoryGb: number;
  dpr: number;
  gpu: string;
  recommended: QualityPreset;
}

/**
 * Cheap, one-shot device probe used to pick a starting graphics preset.
 * Deliberately conservative: it is far better to boot a strong phone on
 * "high" and let the player raise it than to boot a weak one on "ultra".
 */
export function probeDevice(): DeviceProfile {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const cores = nav?.hardwareConcurrency ?? 4;
  const memoryGb = (nav as unknown as { deviceMemory?: number })?.deviceMemory ?? 4;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const isTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || (nav?.maxTouchPoints ?? 0) > 0);

  let gpu = 'unknown';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = dbg
        ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER));
    }
  } catch {
    /* headless or blocked - fall through to the conservative default */
  }

  const weak = /mali-4|mali-t[0-7]|adreno \(tm\) [345]|powervr sgx|videocore|swiftshader|llvmpipe/i.test(gpu);
  const strong = /apple (a1[4-9]|m[1-9])|adreno \(tm\) (7[0-9][0-9]|6[5-9][0-9])|mali-g7[1-9]|immortalis/i.test(gpu);

  let recommended: QualityPreset = 'medium';
  if (weak || cores <= 2 || memoryGb <= 2) recommended = 'low';
  else if (strong && cores >= 8 && memoryGb >= 6) recommended = 'high';
  else if (cores >= 6 && memoryGb >= 4) recommended = 'medium';

  // "ultra" is never auto-selected; it is an opt-in for desktops and flagships.
  return { isTouch, cores, memoryGb, dpr, gpu, recommended };
}
