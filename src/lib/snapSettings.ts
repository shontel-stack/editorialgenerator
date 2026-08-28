/**
 * User-configurable snapping behavior for the editor canvas.
 *
 * - `edgeTolerancePx` — how close (in page-px @ 300 DPI) a block edge / center
 *   must be to a guide line for it to snap. Default 30 ≈ 0.1 inch.
 * - `rotationTolerance` — how close (degrees) a rotation must be to a value in
 *   `rotationAngles` for it to snap.
 * - `rotationAngles` — the canonical angles rotations snap to.
 *
 * Stored per-browser in localStorage; broadcast via a `storage`-style custom
 * event so all editor surfaces react instantly.
 */

import { useEffect, useState } from "react";

export type SnapSettings = {
  edgeTolerancePx: number;
  rotationTolerance: number;
  rotationAngles: number[];
  /** Snap-to-grid pixel size (page-px @ 300 DPI). 0 disables the grid. */
  gridSizePx: number;
  /** Snap to edges/centers of OTHER blocks on the same page. */
  alignToObjects: boolean;
  /** Baseline grid pitch in page-px @ 300 DPI. 0 disables the baseline grid. */
  baselineGridPx: number;
  /** Distance from the top of the page to the first baseline (page-px). */
  baselineOffsetPx: number;
  /** Draw the baseline grid on the canvas while editing. */
  showBaseline: boolean;
  /** Snap block edges to baselines while dragging / resizing. */
  snapToBaseline: boolean;
};

export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  edgeTolerancePx: 30, // ≈ 0.1 in @ 300 DPI
  rotationTolerance: 4, // degrees
  rotationAngles: [-180, -135, -90, -45, 0, 15, 30, 45, 60, 90, 120, 135, 180],
  gridSizePx: 0,
  alignToObjects: true,
  baselineGridPx: 0,
  baselineOffsetPx: 225, // 0.75 in top margin @ 300 DPI
  showBaseline: true,
  snapToBaseline: true,
};


const STORAGE_KEY = "lovable.snapSettings.v1";
const EVENT = "lovable:snap-settings-change";

function safeRead(): SnapSettings {
  if (typeof window === "undefined") return DEFAULT_SNAP_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SNAP_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SnapSettings>;
    return {
      edgeTolerancePx: clampNum(parsed.edgeTolerancePx, 0, 500, DEFAULT_SNAP_SETTINGS.edgeTolerancePx),
      rotationTolerance: clampNum(parsed.rotationTolerance, 0, 45, DEFAULT_SNAP_SETTINGS.rotationTolerance),
      rotationAngles: Array.isArray(parsed.rotationAngles) && parsed.rotationAngles.length > 0
        ? Array.from(new Set(parsed.rotationAngles.filter((n) => Number.isFinite(n)).map((n) => clampNum(n, -360, 360, 0)))).sort((a, b) => a - b)
        : DEFAULT_SNAP_SETTINGS.rotationAngles,
      gridSizePx: clampNum(parsed.gridSizePx, 0, 600, DEFAULT_SNAP_SETTINGS.gridSizePx),
      alignToObjects: typeof parsed.alignToObjects === "boolean" ? parsed.alignToObjects : DEFAULT_SNAP_SETTINGS.alignToObjects,
      baselineGridPx: clampNum(parsed.baselineGridPx, 0, 600, DEFAULT_SNAP_SETTINGS.baselineGridPx),
      baselineOffsetPx: clampNum(parsed.baselineOffsetPx, 0, 2000, DEFAULT_SNAP_SETTINGS.baselineOffsetPx),
      showBaseline: typeof parsed.showBaseline === "boolean" ? parsed.showBaseline : DEFAULT_SNAP_SETTINGS.showBaseline,
      snapToBaseline: typeof parsed.snapToBaseline === "boolean" ? parsed.snapToBaseline : DEFAULT_SNAP_SETTINGS.snapToBaseline,
    };

  } catch {
    return DEFAULT_SNAP_SETTINGS;
  }
}

function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

export function getSnapSettings(): SnapSettings {
  return safeRead();
}

export function setSnapSettings(next: SnapSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

/** Merge a partial per-page override on top of base global settings. */
export function mergeSnapSettings(
  base: SnapSettings,
  override?: Partial<SnapSettings> | null,
): SnapSettings {
  if (!override) return base;
  return {
    edgeTolerancePx:
      typeof override.edgeTolerancePx === "number" ? override.edgeTolerancePx : base.edgeTolerancePx,
    rotationTolerance:
      typeof override.rotationTolerance === "number" ? override.rotationTolerance : base.rotationTolerance,
    rotationAngles:
      Array.isArray(override.rotationAngles) && override.rotationAngles.length > 0
        ? override.rotationAngles
        : base.rotationAngles,
    gridSizePx:
      typeof override.gridSizePx === "number" ? override.gridSizePx : base.gridSizePx,
    alignToObjects:
      typeof override.alignToObjects === "boolean" ? override.alignToObjects : base.alignToObjects,
    baselineGridPx:
      typeof override.baselineGridPx === "number" ? override.baselineGridPx : base.baselineGridPx,
    baselineOffsetPx:
      typeof override.baselineOffsetPx === "number" ? override.baselineOffsetPx : base.baselineOffsetPx,
    showBaseline:
      typeof override.showBaseline === "boolean" ? override.showBaseline : base.showBaseline,
    snapToBaseline:
      typeof override.snapToBaseline === "boolean" ? override.snapToBaseline : base.snapToBaseline,
  };

}

/** Snap a rotation (degrees) to the nearest configured angle within tolerance. */
export function snapRotationWith(deg: number, s: SnapSettings): number {
  if (!Number.isFinite(deg)) return 0;
  let best = deg;
  let bestDist = s.rotationTolerance;
  for (const a of s.rotationAngles) {
    const d = Math.abs(deg - a);
    if (d <= bestDist) {
      bestDist = d;
      best = a;
    }
  }
  return best;
}

/** React hook — re-renders when snap settings change in this tab or another. */
export function useSnapSettings(): SnapSettings {
  const [s, setS] = useState<SnapSettings>(() => safeRead());
  useEffect(() => {
    const sync = () => setS(safeRead());
    window.addEventListener(EVENT, sync as EventListener);
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) sync();
    });
    return () => {
      window.removeEventListener(EVENT, sync as EventListener);
    };
  }, []);
  return s;
}

/** Baseline Y positions (page-px) for a page of height `pageH`. */
export function baselinesFor(s: SnapSettings, pageH: number): number[] {
  if (!(s.baselineGridPx > 0) || !(pageH > 0)) return [];
  const out: number[] = [];
  for (let y = s.baselineOffsetPx; y <= pageH; y += s.baselineGridPx) out.push(y);
  return out;
}
