/**
 * Per-user defaults applied to newly-created +Text custom blocks.
 * Persisted in localStorage so the user's magazine style stays consistent
 * across pages and sessions. Existing blocks are not retroactively changed.
 *
 * Coordinates are in intrinsic page space (3200 x 4267 px @ 300 DPI).
 * `marginX` / `marginY` set the initial spawn position from the page edge.
 */
import { useCallback, useEffect, useState } from "react";

export type TextBlockDefaults = {
  fontFamily: "display" | "serif" | "sans";
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  align: "left" | "center" | "right";
  color: string;
  w: number;
  h: number;
  marginX: number;
  marginY: number;
};

export const TEXT_BLOCK_DEFAULTS: TextBlockDefaults = {
  fontFamily: "serif",
  fontSize: 60,
  fontWeight: 400,
  italic: false,
  align: "left",
  color: "#0a0a0a",
  w: 1200,
  h: 240,
  marginX: 600,
  marginY: 600,
};

const KEY = "textBlockDefaults:v1";

function read(): TextBlockDefaults {
  if (typeof window === "undefined") return TEXT_BLOCK_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return TEXT_BLOCK_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<TextBlockDefaults>;
    return { ...TEXT_BLOCK_DEFAULTS, ...parsed };
  } catch {
    return TEXT_BLOCK_DEFAULTS;
  }
}

function write(d: TextBlockDefaults) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(d));
    window.dispatchEvent(new CustomEvent("textBlockDefaults:changed"));
  } catch {
    /* ignore */
  }
}

export function getTextBlockDefaults(): TextBlockDefaults {
  return read();
}

export function useTextBlockDefaults() {
  const [defaults, setDefaults] = useState<TextBlockDefaults>(() => read());
  useEffect(() => {
    const onChange = () => setDefaults(read());
    window.addEventListener("textBlockDefaults:changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("textBlockDefaults:changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const update = useCallback((patch: Partial<TextBlockDefaults>) => {
    const next = { ...read(), ...patch };
    write(next);
    setDefaults(next);
  }, []);
  const reset = useCallback(() => {
    write(TEXT_BLOCK_DEFAULTS);
    setDefaults(TEXT_BLOCK_DEFAULTS);
  }, []);
  return { defaults, update, reset };
}
