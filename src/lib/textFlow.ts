/**
 * Minimal linked ("threaded") text frames.
 *
 * A source text block can be linked to a continuation frame on any other page.
 * The source keeps the full copy; whatever does not fit in its frame is
 * measured at render time and published to the continuation frame, which
 * renders it read-only. Links and the overflow cache live in localStorage so
 * the continuation still shows copy when the source page is not mounted.
 */
import { useEffect, useState } from "react";

const LINKS_KEY = "textFlow:links:v1";
const CACHE_KEY = "textFlow:cache:v1";

type Store = {
  /** sourceBlockId -> continuation blockId */
  links: Record<string, string>;
  /** continuation blockId -> overflow copy */
  cache: Record<string, string>;
};

let store: Store = { links: {}, cache: {} };
let loaded = false;
let pendingSource: string | null = null;
const subs = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    store = {
      links: JSON.parse(window.localStorage.getItem(LINKS_KEY) ?? "{}"),
      cache: JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "{}"),
    };
  } catch {
    store = { links: {}, cache: {} };
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LINKS_KEY, JSON.stringify(store.links));
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(store.cache));
  } catch {
    /* quota — links still work for this session */
  }
}

function emit() {
  for (const fn of subs) fn();
}

export function getFlowTargetId(sourceId: string): string | undefined {
  load();
  return store.links[sourceId];
}

export function getFlowSourceId(targetId: string): string | undefined {
  load();
  return Object.keys(store.links).find((k) => store.links[k] === targetId);
}

export function getFlowText(targetId: string): string {
  load();
  return store.cache[targetId] ?? "";
}

/** Publish overflow copy for a continuation frame (no-op when unchanged). */
export function setFlowText(targetId: string, text: string) {
  load();
  if (store.cache[targetId] === text) return;
  store.cache[targetId] = text;
  persist();
  emit();
}

export function linkFlow(sourceId: string, targetId: string) {
  load();
  if (sourceId === targetId) return;
  store.links[sourceId] = targetId;
  persist();
  emit();
}

/** Remove any link where this block is the source or the continuation. */
export function unlinkFlow(blockId: string) {
  load();
  delete store.links[blockId];
  for (const k of Object.keys(store.links)) {
    if (store.links[k] === blockId) delete store.links[k];
  }
  delete store.cache[blockId];
  persist();
  emit();
}

export function setPendingFlowSource(id: string | null) {
  pendingSource = id;
  emit();
}

export function getPendingFlowSource(): string | null {
  return pendingSource;
}

/** Subscribe to link / overflow changes. */
export function useTextFlow(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const fn = () => setV((n) => n + 1);
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  }, []);
  return v;
}

const COPIED_PROPS = [
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing",
  "textTransform", "textAlign", "whiteSpace", "wordBreak", "padding", "boxSizing",
  "columnCount", "columnGap", "columnFill",
] as const;

/**
 * Split `text` into the part that fits inside `el` and the remainder.
 * Measurement happens in an offscreen clone that copies `el`'s typography.
 */
export function splitToFit(el: HTMLElement, text: string): [string, string] {
  if (typeof document === "undefined" || !text) return [text, ""];
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  if (width <= 0 || height <= 0) return [text, ""];

  const cs = window.getComputedStyle(el);
  const probe = document.createElement("div");
  for (const p of COPIED_PROPS) {
    probe.style.setProperty(
      p.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
      cs.getPropertyValue(p.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)),
    );
  }
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.left = "-99999px";
  probe.style.top = "0";
  probe.style.width = `${width}px`;
  probe.style.height = "auto";
  document.body.appendChild(probe);

  const fits = (s: string) => {
    probe.textContent = s;
    return probe.scrollHeight <= height + 1;
  };

  try {
    if (fits(text)) return [text, ""];
    const tokens = text.split(/(\s+)/);
    let lo = 0;
    let hi = tokens.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(tokens.slice(0, mid).join(""))) lo = mid;
      else hi = mid - 1;
    }
    const head = tokens.slice(0, lo).join("");
    const tail = tokens.slice(lo).join("").replace(/^\s+/, "");
    return [head, tail];
  } finally {
    probe.remove();
  }
}
