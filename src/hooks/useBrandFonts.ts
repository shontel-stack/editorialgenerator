import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteBrandFont,
  getFontSlotOverrides,
  listBrandFonts,
  setFontSlotOverride,
  signFontUrl,
  updateBrandFont,
  uploadBrandFont,
  type BrandFont,
  type FontSlotOverrides,
} from "@/lib/brandAssets";

/**
 * Returns the CSS-safe family name we use to register a brand font. The
 * stored `family_name` is user-editable; we namespace by id so two fonts can
 * legitimately share a display name without colliding.
 */
function cssFamilyFor(font: BrandFont): string {
  return `bf_${font.id.replace(/-/g, "")}`;
}

async function loadFontFace(font: BrandFont, url: string): Promise<FontFace | null> {
  if (typeof FontFace === "undefined" || !document?.fonts) return null;
  try {
    const face = new FontFace(cssFamilyFor(font), `url(${url})`, {
      weight: String(font.weight ?? 400),
      style: font.style || "normal",
      display: "swap",
    });
    await face.load();
    document.fonts.add(face);
    return face;
  } catch (e) {
    console.warn("[useBrandFonts] failed to load", font.file_name, e);
    return null;
  }
}

/**
 * Loads every brand font for the active publication, registers @font-face
 * rules, and applies publication-level slot overrides as CSS variables on
 * <body>. Exposes CRUD helpers and a quick `resolveCssFamily(font)` so other
 * components (text-block toolbar, etc.) can reference the registered family.
 */
export function useBrandFonts(publicationId: string | null) {
  const [fonts, setFonts] = useState<BrandFont[]>([]);
  const [overrides, setOverrides] = useState<FontSlotOverrides>({
    display_font_custom_id: null,
    serif_font_custom_id: null,
    sans_font_custom_id: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track FontFace objects + the previous publication so we can clean up on switch.
  const facesRef = useRef<Map<string, FontFace>>(new Map());
  const lastPubRef = useRef<string | null>(null);

  const cleanupFaces = useCallback(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    for (const face of facesRef.current.values()) {
      try {
        document.fonts.delete(face);
      } catch {
        /* noop */
      }
    }
    facesRef.current.clear();
  }, []);

  const refresh = useCallback(async () => {
    if (!publicationId) {
      cleanupFaces();
      setFonts([]);
      setOverrides({
        display_font_custom_id: null,
        serif_font_custom_id: null,
        sans_font_custom_id: null,
      });
      return;
    }
    setLoading(true);
    try {
      const [rows, ov] = await Promise.all([
        listBrandFonts(publicationId),
        getFontSlotOverrides(publicationId),
      ]);
      setFonts(rows);
      setOverrides(ov);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [publicationId, cleanupFaces]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // (Re-)register @font-face entries whenever the font list changes.
  useEffect(() => {
    let cancelled = false;
    // Switching publications: wipe the old registry first.
    if (lastPubRef.current !== publicationId) {
      cleanupFaces();
      lastPubRef.current = publicationId;
    }
    (async () => {
      // Remove faces for fonts that disappeared.
      const liveIds = new Set(fonts.map((f) => f.id));
      for (const [id, face] of facesRef.current.entries()) {
        if (!liveIds.has(id)) {
          try {
            document.fonts.delete(face);
          } catch {
            /* noop */
          }
          facesRef.current.delete(id);
        }
      }
      // Add faces for new fonts.
      for (const font of fonts) {
        if (facesRef.current.has(font.id)) continue;
        const url = await signFontUrl(font.file_path);
        if (cancelled || !url) continue;
        const face = await loadFontFace(font, url);
        if (cancelled) return;
        if (face) facesRef.current.set(font.id, face);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fonts, publicationId, cleanupFaces]);

  // Apply slot overrides as CSS variables on <body>.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const slots: Array<["display" | "serif" | "sans", string | null]> = [
      ["display", overrides.display_font_custom_id],
      ["serif", overrides.serif_font_custom_id],
      ["sans", overrides.sans_font_custom_id],
    ];
    const cleanups: Array<() => void> = [];
    for (const [slot, fontId] of slots) {
      const cssVar = `--font-${slot}-brand`;
      const font = fontId ? fonts.find((f) => f.id === fontId) : null;
      if (font) {
        const stack = `'${cssFamilyFor(font)}', var(--font-${slot})`;
        const prev = body.style.getPropertyValue(`--font-${slot}`);
        body.style.setProperty(cssVar, stack);
        body.style.setProperty(`--font-${slot}`, stack);
        cleanups.push(() => {
          body.style.removeProperty(cssVar);
          if (prev) body.style.setProperty(`--font-${slot}`, prev);
          else body.style.removeProperty(`--font-${slot}`);
        });
      }
    }
    return () => {
      for (const c of cleanups) c();
    };
  }, [fonts, overrides]);

  const upload = useCallback(
    async (file: File, familyName?: string) => {
      if (!publicationId) throw new Error("Select a publication first.");
      await uploadBrandFont({ publicationId, file, familyName });
      await refresh();
    },
    [publicationId, refresh],
  );

  const remove = useCallback(
    async (font: BrandFont) => {
      await deleteBrandFont(font);
      await refresh();
    },
    [refresh],
  );

  const rename = useCallback(
    async (id: string, familyName: string) => {
      await updateBrandFont(id, { family_name: familyName });
      await refresh();
    },
    [refresh],
  );

  const assignSlot = useCallback(
    async (slot: "display" | "serif" | "sans", fontId: string | null) => {
      if (!publicationId) return;
      await setFontSlotOverride(publicationId, slot, fontId);
      await refresh();
    },
    [publicationId, refresh],
  );

  const resolveCssFamily = useCallback(
    (id: string): string | null => {
      const f = fonts.find((x) => x.id === id);
      return f ? cssFamilyFor(f) : null;
    },
    [fonts],
  );

  const exposed = useMemo(
    () => ({
      fonts,
      overrides,
      loading,
      error,
      refresh,
      upload,
      remove,
      rename,
      assignSlot,
      resolveCssFamily,
      cssFamilyFor,
    }),
    [fonts, overrides, loading, error, refresh, upload, remove, rename, assignSlot, resolveCssFamily],
  );

  return exposed;
}

export type BrandFontsApi = ReturnType<typeof useBrandFonts>;
