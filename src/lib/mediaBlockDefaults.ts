/**
 * Per-user defaults applied to newly-created +Image and +Video custom blocks.
 * Persisted in localStorage so blocks align to the user's magazine grid.
 * Coordinates are in intrinsic page space (3200 x 4267 px @ 300 DPI).
 */
import { useCallback, useEffect, useState } from "react";

export type ImageBlockDefaults = {
  w: number;
  h: number;
  marginX: number;
  marginY: number;
  imageFit: "cover" | "contain";
  borderWidth: number;
  borderColor: string;
  bg: string;
};

export type VideoBlockDefaults = {
  w: number;
  h: number;
  marginX: number;
  marginY: number;
  muted: boolean;
  loop: boolean;
  autoplay: boolean;
  /** Default poster (thumbnail) URL shown before playback. */
  poster: string;
  /** Default volume 0..1 (ignored while muted). */
  volume: number;
  /** Whether to show the native player controls bar. */
  controls: boolean;
  /** Inline playback on iOS rather than fullscreen takeover. */
  playsInline: boolean;
  /** Preload behavior — how aggressively the browser fetches the source. */
  preload: "none" | "metadata" | "auto";
};

export const IMAGE_BLOCK_DEFAULTS: ImageBlockDefaults = {
  w: 1200,
  h: 1200,
  marginX: 600,
  marginY: 600,
  imageFit: "cover",
  borderWidth: 0,
  borderColor: "#0a0a0a",
  bg: "#ffffff",
};

export const VIDEO_BLOCK_DEFAULTS: VideoBlockDefaults = {
  w: 1600,
  h: 900,
  marginX: 600,
  marginY: 600,
  muted: true,
  loop: false,
  autoplay: false,
  poster: "",
  volume: 1,
  controls: true,
  playsInline: true,
  preload: "metadata",
};

const IMG_KEY = "imageBlockDefaults:v1";
const VID_KEY = "videoBlockDefaults:v1";
const IMG_EVENT = "imageBlockDefaults:changed";
const VID_EVENT = "videoBlockDefaults:changed";

function readImg(): ImageBlockDefaults {
  if (typeof window === "undefined") return IMAGE_BLOCK_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(IMG_KEY);
    if (!raw) return IMAGE_BLOCK_DEFAULTS;
    return { ...IMAGE_BLOCK_DEFAULTS, ...(JSON.parse(raw) as Partial<ImageBlockDefaults>) };
  } catch { return IMAGE_BLOCK_DEFAULTS; }
}
function readVid(): VideoBlockDefaults {
  if (typeof window === "undefined") return VIDEO_BLOCK_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(VID_KEY);
    if (!raw) return VIDEO_BLOCK_DEFAULTS;
    return { ...VIDEO_BLOCK_DEFAULTS, ...(JSON.parse(raw) as Partial<VideoBlockDefaults>) };
  } catch { return VIDEO_BLOCK_DEFAULTS; }
}
function writeImg(d: ImageBlockDefaults) {
  try { window.localStorage.setItem(IMG_KEY, JSON.stringify(d)); window.dispatchEvent(new CustomEvent(IMG_EVENT)); } catch { /* ignore */ }
}
function writeVid(d: VideoBlockDefaults) {
  try { window.localStorage.setItem(VID_KEY, JSON.stringify(d)); window.dispatchEvent(new CustomEvent(VID_EVENT)); } catch { /* ignore */ }
}

export function getImageBlockDefaults(): ImageBlockDefaults { return readImg(); }
export function getVideoBlockDefaults(): VideoBlockDefaults { return readVid(); }

export function useImageBlockDefaults() {
  const [defaults, setDefaults] = useState<ImageBlockDefaults>(() => readImg());
  useEffect(() => {
    const on = () => setDefaults(readImg());
    window.addEventListener(IMG_EVENT, on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener(IMG_EVENT, on); window.removeEventListener("storage", on); };
  }, []);
  const update = useCallback((p: Partial<ImageBlockDefaults>) => { const n = { ...readImg(), ...p }; writeImg(n); setDefaults(n); }, []);
  const reset = useCallback(() => { writeImg(IMAGE_BLOCK_DEFAULTS); setDefaults(IMAGE_BLOCK_DEFAULTS); }, []);
  return { defaults, update, reset };
}

export function useVideoBlockDefaults() {
  const [defaults, setDefaults] = useState<VideoBlockDefaults>(() => readVid());
  useEffect(() => {
    const on = () => setDefaults(readVid());
    window.addEventListener(VID_EVENT, on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener(VID_EVENT, on); window.removeEventListener("storage", on); };
  }, []);
  const update = useCallback((p: Partial<VideoBlockDefaults>) => { const n = { ...readVid(), ...p }; writeVid(n); setDefaults(n); }, []);
  const reset = useCallback(() => { writeVid(VIDEO_BLOCK_DEFAULTS); setDefaults(VIDEO_BLOCK_DEFAULTS); }, []);
  return { defaults, update, reset };
}
