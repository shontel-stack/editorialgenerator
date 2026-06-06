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
};

export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  edgeTolerancePx: 30, // ≈ 0.1 in @ 300 DPI
  rotationTolerance: 4, // degrees
  rotationAngles: [-180, -135, -90, -45, 0, 15, 30, 45, 60, 90, 120, 135, 180],
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
