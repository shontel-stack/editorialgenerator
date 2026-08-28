/**
 * Measurement helpers for the editor canvas.
 *
 * All block geometry is stored in page pixels at 300 DPI. Editorial designers
 * think in inches, millimetres or points, so these helpers convert between the
 * stored unit and the display unit, and expose the user's preferred unit as a
 * tiny localStorage-backed store (same pattern as snapSettings).
 */

import { useEffect, useState } from "react";

export const DPI = 300;

export type MeasureUnit = "in" | "mm" | "pt" | "px";

export const UNIT_LABELS: Record<MeasureUnit, string> = {
  in: "in",
  mm: "mm",
  pt: "pt",
  px: "px",
};

/** Convert page-px (300 DPI) to the given display unit. */
export function fromPx(px: number, unit: MeasureUnit): number {
  switch (unit) {
    case "in":
      return px / DPI;
    case "mm":
      return (px / DPI) * 25.4;
    case "pt":
      return (px / DPI) * 72;
    default:
      return px;
  }
}

/** Convert a display-unit value back to page-px (300 DPI). */
export function toPx(value: number, unit: MeasureUnit): number {
  switch (unit) {
    case "in":
      return value * DPI;
    case "mm":
      return (value / 25.4) * DPI;
    case "pt":
      return (value / 72) * DPI;
    default:
      return value;
  }
}

/** Number of decimals that read naturally for each unit. */
export function unitPrecision(unit: MeasureUnit): number {
  if (unit === "in") return 3;
  if (unit === "mm") return 1;
  if (unit === "pt") return 1;
  return 0;
}

/** Format a page-px measurement for display, without the unit suffix. */
export function formatMeasure(px: number, unit: MeasureUnit): string {
  return fromPx(px, unit).toFixed(unitPrecision(unit));
}

/** Format with the unit suffix, e.g. `2.500 in`. */
export function formatMeasureWithUnit(px: number, unit: MeasureUnit): string {
  return `${formatMeasure(px, unit)} ${UNIT_LABELS[unit]}`;
}

/** Step size for numeric inputs in a given unit (roughly 1/16in-ish). */
export function unitStep(unit: MeasureUnit): number {
  if (unit === "in") return 0.0625;
  if (unit === "mm") return 1;
  if (unit === "pt") return 1;
  return 1;
}

const STORAGE_KEY = "pageluxe.measureUnit.v1";
const EVENT = "pageluxe:measure-unit-change";

export function getMeasureUnit(): MeasureUnit {
  if (typeof window === "undefined") return "in";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "in" || raw === "mm" || raw === "pt" || raw === "px") return raw;
  return "in";
}

export function setMeasureUnit(unit: MeasureUnit): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, unit);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: unit }));
}

/** React hook — re-renders when the preferred unit changes anywhere. */
export function useMeasureUnit(): [MeasureUnit, (u: MeasureUnit) => void] {
  const [unit, setUnit] = useState<MeasureUnit>(() => getMeasureUnit());
  useEffect(() => {
    const sync = () => setUnit(getMeasureUnit());
    window.addEventListener(EVENT, sync as EventListener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, sync as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return [unit, setMeasureUnit];
}
