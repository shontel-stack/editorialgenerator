/**
 * Named paragraph / character styles ("Body", "Deck", "Caption", …).
 *
 * Styles are stored per-browser in localStorage — the same pattern used by
 * `snapSettings` — and applied onto text blocks. A block remembers the style
 * it was created from via `styleId`, so editing a style can be pushed back
 * out to every block that uses it.
 */

import { useEffect, useState } from "react";
import type { CustomBlock } from "./coverDefaults";

export type TextAlign = "left" | "center" | "right" | "justify";

export type TextStyle = {
  id: string;
  name: string;
  fontFamily: "display" | "serif" | "sans" | string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  align: TextAlign;
  color: string;
  /** Unitless multiple of the font size. */
  lineHeight: number;
  /** Page-px @ 300 DPI. */
  letterSpacing: number;
  uppercase: boolean;
};

export const DEFAULT_TEXT_STYLES: TextStyle[] = [
  { id: "headline", name: "Headline", fontFamily: "display", fontSize: 150, fontWeight: 700, italic: false, align: "left", color: "#0a0a0a", lineHeight: 1.02, letterSpacing: -2, uppercase: false },
  { id: "deck", name: "Deck", fontFamily: "serif", fontSize: 64, fontWeight: 400, italic: true, align: "left", color: "#333333", lineHeight: 1.25, letterSpacing: 0, uppercase: false },
  { id: "body", name: "Body", fontFamily: "serif", fontSize: 42, fontWeight: 400, italic: false, align: "justify", color: "#0a0a0a", lineHeight: 1.42, letterSpacing: 0, uppercase: false },
  { id: "pull-quote", name: "Pull quote", fontFamily: "display", fontSize: 90, fontWeight: 500, italic: true, align: "center", color: "#0a0a0a", lineHeight: 1.15, letterSpacing: -1, uppercase: false },
  { id: "caption", name: "Caption", fontFamily: "sans", fontSize: 28, fontWeight: 500, italic: false, align: "left", color: "#555555", lineHeight: 1.3, letterSpacing: 1, uppercase: false },
  { id: "kicker", name: "Kicker", fontFamily: "sans", fontSize: 26, fontWeight: 700, italic: false, align: "left", color: "#b91c1c", lineHeight: 1.2, letterSpacing: 6, uppercase: true },
  { id: "credit", name: "Photo credit", fontFamily: "sans", fontSize: 20, fontWeight: 400, italic: false, align: "right", color: "#777777", lineHeight: 1.2, letterSpacing: 2, uppercase: true },
];

const STORAGE_KEY = "lovable.textStyles.v1";
const EVENT = "lovable:text-styles-change";

function coerce(v: unknown): TextStyle | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Partial<TextStyle>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  const num = (n: unknown, fb: number) => (Number.isFinite(Number(n)) ? Number(n) : fb);
  return {
    id: o.id,
    name: o.name,
    fontFamily: typeof o.fontFamily === "string" ? o.fontFamily : "serif",
    fontSize: num(o.fontSize, 42),
    fontWeight: num(o.fontWeight, 400),
    italic: o.italic === true,
    align: (["left", "center", "right", "justify"] as const).includes(o.align as TextAlign)
      ? (o.align as TextAlign)
      : "left",
    color: typeof o.color === "string" ? o.color : "#0a0a0a",
    lineHeight: num(o.lineHeight, 1.25),
    letterSpacing: num(o.letterSpacing, 0),
    uppercase: o.uppercase === true,
  };
}

export function getTextStyles(): TextStyle[] {
  if (typeof window === "undefined") return DEFAULT_TEXT_STYLES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TEXT_STYLES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TEXT_STYLES;
    const list = parsed.map(coerce).filter((s): s is TextStyle => s != null);
    return list.length > 0 ? list : DEFAULT_TEXT_STYLES;
  } catch {
    return DEFAULT_TEXT_STYLES;
  }
}

export function setTextStyles(next: TextStyle[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — styles are a convenience, never block the editor */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

export function useTextStyles(): [TextStyle[], (next: TextStyle[]) => void] {
  const [styles, setStyles] = useState<TextStyle[]>(() => getTextStyles());
  useEffect(() => {
    const sync = () => setStyles(getTextStyles());
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
  return [styles, setTextStyles];
}

/** The block patch that applies a style's formatting. */
export function styleToBlockPatch(style: TextStyle): Partial<CustomBlock> {
  return {
    styleId: style.id,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    italic: style.italic,
    align: style.align,
    color: style.color,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textTransform: style.uppercase ? "uppercase" : "none",
  } as Partial<CustomBlock>;
}

/** Capture the current formatting of a text block as a (new) style. */
export function blockToStyle(
  block: Extract<CustomBlock, { kind: "text" }>,
  name: string,
  id?: string,
): TextStyle {
  return {
    id: id ?? `style-${Date.now().toString(36)}`,
    name,
    fontFamily: block.fontFamily ?? "serif",
    fontSize: block.fontSize ?? 48,
    fontWeight: block.fontWeight ?? 400,
    italic: block.italic === true,
    align: block.align ?? "left",
    color: block.color ?? "#0a0a0a",
    lineHeight: block.lineHeight ?? 1.25,
    letterSpacing: block.letterSpacing ?? 0,
    uppercase: block.textTransform === "uppercase",
  };
}
