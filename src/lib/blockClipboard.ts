/**
 * Cross-page block clipboard.
 *
 * Stores copied custom blocks (and, separately, just a block's size/position)
 * in localStorage so they can be pasted onto *any* page of the issue — either
 * offset slightly, or "in place" at the exact same coordinates, which is how
 * designers keep folios / rules / mastheads identical across pages.
 */

import { useEffect, useState } from "react";
import type { CustomBlock } from "@/lib/coverDefaults";

const BLOCKS_KEY = "pageluxe.blockClipboard.v1";
const GEOM_KEY = "pageluxe.blockGeometryClipboard.v1";
const EVENT = "pageluxe:block-clipboard-change";

export type BlockGeometry = { x: number; y: number; w: number; h: number; rotate?: number };

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Copy one or more blocks. Positions are stored verbatim (page-px). */
export function copyBlocks(blocks: CustomBlock[]): void {
  if (typeof window === "undefined" || blocks.length === 0) return;
  try {
    window.localStorage.setItem(BLOCKS_KEY, JSON.stringify(blocks));
  } catch {
    /* quota — ignore */
  }
  emit();
}

export function readBlocks(): CustomBlock[] {
  const data = readJson<CustomBlock | CustomBlock[]>(BLOCKS_KEY);
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

/** Copy only the size + position of a block, to apply onto other blocks. */
export function copyGeometry(block: CustomBlock): void {
  if (typeof window === "undefined") return;
  const g: BlockGeometry = {
    x: block.x,
    y: block.y,
    w: block.w,
    h: block.h,
    rotate: (block as { rotate?: number }).rotate ?? 0,
  };
  try {
    window.localStorage.setItem(GEOM_KEY, JSON.stringify(g));
  } catch {
    /* ignore */
  }
  emit();
}

export function readGeometry(): BlockGeometry | null {
  const g = readJson<BlockGeometry>(GEOM_KEY);
  if (!g || typeof g.x !== "number" || typeof g.w !== "number") return null;
  return g;
}

/** Reactive snapshot of what's currently on the clipboard. */
export function useBlockClipboard(): { count: number; geometry: BlockGeometry | null } {
  const [state, setState] = useState<{ count: number; geometry: BlockGeometry | null }>({
    count: 0,
    geometry: null,
  });
  useEffect(() => {
    const sync = () => setState({ count: readBlocks().length, geometry: readGeometry() });
    sync();
    window.addEventListener(EVENT, sync as EventListener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === BLOCKS_KEY || e.key === GEOM_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, sync as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return state;
}
