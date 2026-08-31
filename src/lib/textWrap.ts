import type { CustomBlock } from "@/lib/coverDefaults";

/** How a non-text block pushes copy in overlapping text frames. */
export type WrapMode = "none" | "left" | "right" | "auto" | "jump";

export type WrapShim = {
  key: string;
  /** CSS float side; "jump" shims are full width so text starts below. */
  float: "left" | "right";
  width: number;
  height: number;
  /** Inset from the top of the shim where the obstacle actually begins. */
  shapeTop: number;
};

type Rect = { x: number; y: number; w: number; h: number };

export function getWrapMode(block: CustomBlock): WrapMode {
  const m = (block as { wrapText?: WrapMode }).wrapText;
  return m ?? "none";
}

export function getWrapMargin(block: CustomBlock): number {
  return (block as { wrapMargin?: number }).wrapMargin ?? 16;
}

/**
 * Build float shims that carve the obstacles' footprints out of a text frame.
 *
 * CSS has no native "wrap around an absolutely positioned element", so we
 * inject zero-content floats at the top of the copy and use `shape-outside:
 * inset(...)` to reserve only the vertical band the obstacle actually covers.
 */
export function computeWrapShims(
  textRect: Rect,
  padding: number,
  obstacles: CustomBlock[],
): WrapShim[] {
  const innerW = Math.max(0, textRect.w - padding * 2);
  const innerH = Math.max(0, textRect.h - padding * 2);
  if (innerW <= 0 || innerH <= 0) return [];

  const shims: WrapShim[] = [];
  for (const o of obstacles) {
    if (o.hidden) continue;
    const mode = getWrapMode(o);
    if (mode === "none") continue;
    const m = getWrapMargin(o);

    const left = o.x - m - (textRect.x + padding);
    const right = o.x + o.w + m - (textRect.x + padding);
    const top = o.y - m - (textRect.y + padding);
    const bottom = o.y + o.h + m - (textRect.y + padding);

    // Skip obstacles that miss this frame entirely.
    if (right <= 0 || left >= innerW || bottom <= 0 || top >= innerH) continue;

    const shapeTop = Math.max(0, top);
    const shimHeight = Math.max(1, Math.min(innerH, bottom) - shapeTop);

    if (mode === "jump") {
      shims.push({
        key: `${o.id}-jump`,
        float: "left",
        width: innerW,
        height: shapeTop + shimHeight,
        shapeTop,
      });
      continue;
    }

    let side: "left" | "right" = mode === "left" ? "left" : "right";
    if (mode === "auto") {
      const obsCenter = left + (right - left) / 2;
      // Obstacle sitting on the left half -> it floats left, copy runs right.
      side = obsCenter < innerW / 2 ? "left" : "right";
    }

    const width =
      side === "left"
        ? Math.max(0, Math.min(innerW, right))
        : Math.max(0, Math.min(innerW, innerW - left));
    if (width <= 0) continue;

    shims.push({
      key: `${o.id}-${side}`,
      float: side,
      width,
      height: shapeTop + shimHeight,
      shapeTop,
    });
  }
  // Topmost obstacles first so floats stack in visual order.
  return shims.sort((a, b) => a.shapeTop - b.shapeTop);
}
