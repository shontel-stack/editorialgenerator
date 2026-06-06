import {
  createContext,
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as RPointerEvent,
} from "react";
import { Link2, Type } from "lucide-react";
import type { CustomBlock } from "@/lib/coverDefaults";
import type { SnapSettings } from "@/lib/snapSettings";

export type Overrides = Record<string, { dx: number; dy: number }>;
export type ScaleMap = Record<string, number>;
export type LinkMap = Record<string, string>;

/**
 * Snap guides for the editor — lists of page-px coordinates that block edges
 * (and centers) snap to while dragging. Threshold is in page-px (300 DPI).
 */
export type SnapGuides = {
  xs: number[];
  ys: number[];
  threshold: number;
};

type Ctx = {
  editing: boolean;
  scale: number;
  overrides: Overrides;
  setOverride: (key: string, value: { dx: number; dy: number } | null) => void;
  textScales: ScaleMap;
  setTextScale: (key: string, value: number | null) => void;
  blockLinks: LinkMap;
  setBlockLink: (key: string, value: string | null) => void;
  /** Pending (un-applied) assistant move proposals for this page. */
  previewOverrides?: Overrides;
  /** Pending scale proposals. */
  previewScales?: ScaleMap;
  /** Custom (user-added) blocks for this page. */
  customBlocks?: CustomBlock[];
  setCustomBlocks?: (next: CustomBlock[]) => void;
  /** Optional snap targets (margin / bleed / trim / center). */
  guides?: SnapGuides;
  /** Effective snap settings for this page (global merged with page override). */
  snapSettings?: SnapSettings;
};

const LayoutEditContext = createContext<Ctx | null>(null);

export function useLayoutEdit() {
  return useContext(LayoutEditContext);
}

export function LayoutEditProvider({
  editing,
  scale,
  overrides,
  setOverride,
  textScales,
  setTextScale,
  blockLinks,
  setBlockLink,
  previewOverrides,
  previewScales,
  customBlocks,
  setCustomBlocks,
  guides,
  snapSettings,
  children,
}: Ctx & { children: ReactNode }) {
  return (
    <LayoutEditContext.Provider
      value={{
        editing,
        scale,
        overrides,
        setOverride,
        textScales,
        setTextScale,
        blockLinks,
        setBlockLink,
        previewOverrides,
        previewScales,
        customBlocks,
        setCustomBlocks,
        guides,
        snapSettings,
      }}
    >
      {children}
    </LayoutEditContext.Provider>
  );
}

const SNAP = 40;
const snap = (n: number) => Math.round(n / SNAP) * SNAP;

/** Snap a single coord to the nearest guide within threshold. Returns the
 *  adjustment delta (snapped - value) or 0 if no guide is close enough. */
function snapDelta(value: number, guides: number[], threshold: number): number {
  let best = 0;
  let bestDist = threshold;
  for (const g of guides) {
    const d = g - value;
    const ad = Math.abs(d);
    if (ad < bestDist) {
      bestDist = ad;
      best = d;
    }
  }
  return best;
}

/** Try snapping a block (with left/top/width/height after move) to guides.
 *  Considers the block's leading edge, center, and trailing edge on each axis,
 *  and returns the adjustments to apply to dx,dy. */
function snapToGuides(
  left: number,
  top: number,
  width: number,
  height: number,
  guides: SnapGuides,
): { ax: number; ay: number } {
  const candX = [left, left + width / 2, left + width];
  const candY = [top, top + height / 2, top + height];
  let ax = 0;
  let axBest = guides.threshold;
  for (const c of candX) {
    const d = snapDelta(c, guides.xs, guides.threshold);
    if (d !== 0 && Math.abs(d) < axBest) {
      axBest = Math.abs(d);
      ax = d;
    }
  }
  let ay = 0;
  let ayBest = guides.threshold;
  for (const c of candY) {
    const d = snapDelta(c, guides.ys, guides.threshold);
    if (d !== 0 && Math.abs(d) < ayBest) {
      ayBest = Math.abs(d);
      ay = d;
    }
  }
  return { ax, ay };
}

export function Draggable({
  blockKey,
  style,
  children,
}: {
  blockKey: string;
  style: CSSProperties;
  children?: ReactNode;
}) {
  const ctx = useContext(LayoutEditContext);
  const editing = ctx?.editing ?? false;
  const saved = ctx?.overrides[blockKey];
  const textScale = ctx?.textScales?.[blockKey] ?? 1;
  const link = ctx?.blockLinks?.[blockKey] ?? "";

  const preview = ctx?.previewOverrides?.[blockKey];
  const previewScale = ctx?.previewScales?.[blockKey];
  const hasPreview = Boolean(preview) || typeof previewScale === "number";

  const [local, setLocal] = useState<{ dx: number; dy: number } | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    dx: number;
    dy: number;
    /** Untranslated origin (top-left) of this block on the page canvas, in page-px. */
    originLeft: number;
    originTop: number;
    width: number;
    height: number;
  } | null>(null);
  const [showSize, setShowSize] = useState(false);

  // Preview position wins over saved/local while a pending proposal exists.
  const dx = preview?.dx ?? local?.dx ?? saved?.dx ?? 0;
  const dy = preview?.dy ?? local?.dy ?? saved?.dy ?? 0;
  const effectiveScale = previewScale ?? textScale;

  /** Apply guide snapping on top of a raw dx/dy delta. */
  const applySnap = (ndx: number, ndy: number): { dx: number; dy: number; snappedX: boolean; snappedY: boolean } => {
    const d = drag.current;
    if (!d || !ctx?.guides) return { dx: ndx, dy: ndy, snappedX: false, snappedY: false };
    const left = d.originLeft + ndx;
    const top = d.originTop + ndy;
    const { ax, ay } = snapToGuides(left, top, d.width, d.height, ctx.guides);
    return { dx: ndx + ax, dy: ndy + ay, snappedX: ax !== 0, snappedY: ay !== 0 };
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!editing || !ctx) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    const root = el.closest("[data-cover-root]") as HTMLElement | null;
    const s = ctx.scale || 1;
    const elRect = el.getBoundingClientRect();
    const rootRect = root?.getBoundingClientRect() ?? { left: elRect.left, top: elRect.top };
    const curLeft = (elRect.left - rootRect.left) / s;
    const curTop = (elRect.top - rootRect.top) / s;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      dx,
      dy,
      originLeft: curLeft - dx,
      originTop: curTop - dy,
      width: elRect.width / s,
      height: elRect.height / s,
    };
    el.setPointerCapture(e.pointerId);
    setLocal({ dx, dy });
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !ctx) return;
    const s = ctx.scale || 1;
    const rawDx = drag.current.dx + (e.clientX - drag.current.x) / s;
    const rawDy = drag.current.dy + (e.clientY - drag.current.y) / s;
    const snapped = applySnap(rawDx, rawDy);
    setLocal({ dx: snapped.dx, dy: snapped.dy });
  };
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !ctx) return;
    const s = ctx.scale || 1;
    const rawDx = drag.current.dx + (e.clientX - drag.current.x) / s;
    const rawDy = drag.current.dy + (e.clientY - drag.current.y) / s;
    const snapped = applySnap(rawDx, rawDy);
    // If a guide engaged on an axis, keep the exact snapped value; otherwise
    // fall back to the 40-px coarse grid so legacy snapping still applies.
    const finalDx = snapped.snappedX ? Math.round(snapped.dx) : snap(snapped.dx);
    const finalDy = snapped.snappedY ? Math.round(snapped.dy) : snap(snapped.dy);
    drag.current = null;
    setLocal(null);
    if (finalDx === 0 && finalDy === 0) ctx.setOverride(blockKey, null);
    else ctx.setOverride(blockKey, { dx: finalDx, dy: finalDy });
  };

  const existingTransform = (style.transform as string | undefined) ?? "";
  const moveTransform =
    dx === 0 && dy === 0 ? "" : `translate(${dx}px, ${dy}px)`;
  const combined: CSSProperties = {
    ...style,
    transform: [existingTransform, moveTransform].filter(Boolean).join(" ") || undefined,
    ...(hasPreview
      ? {
          outline: "6px solid rgba(245,158,11,0.95)",
          outlineOffset: 4,
          boxShadow: "0 0 0 12px rgba(245,158,11,0.18)",
          animation: "lovable-pending-pulse 1.4s ease-in-out infinite",
        }
      : editing
        ? {
            outline: link
              ? "3px solid rgba(37,99,235,0.7)"
              : "3px dashed rgba(107,19,32,0.7)",
            outlineOffset: 4,
            cursor: drag.current ? "grabbing" : "grab",
          }
        : link
          ? { cursor: "pointer" }
          : {}),
  };

  const scaledContent =
    effectiveScale !== 1 ? (
      <div
        style={{
          transform: `scale(${effectiveScale})`,
          transformOrigin: "top left",
          width: "100%",
          height: "100%",
        }}
      >
        {children}
      </div>
    ) : (
      children
    );

  const wrapped =
    link && !editing ? (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "inherit",
          textDecoration: "none",
          display: "block",
          width: "100%",
          height: "100%",
        }}
      >
        {scaledContent}
      </a>
    ) : (
      scaledContent
    );

  const inv = ctx ? 1 / (ctx.scale || 1) : 1;

  return (
    <div
      data-block-key={blockKey}
      style={combined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {hasPreview && ctx && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: `scale(${inv}) translate(0, -110%)`,
            transformOrigin: "top left",
            background: "rgb(245,158,11)",
            color: "#1a1200",
            border: "1px solid rgba(0,0,0,0.2)",
            borderRadius: 4,
            padding: "3px 8px",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "system-ui, sans-serif",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            zIndex: 60,
            pointerEvents: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          Pending · {blockKey}
          {preview ? ` · ${preview.dx >= 0 ? "+" : ""}${preview.dx}, ${preview.dy >= 0 ? "+" : ""}${preview.dy}` : ""}
          {typeof previewScale === "number" ? ` · ${Math.round(previewScale * 100)}%` : ""}
        </div>
      )}
      {editing && ctx && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: `scale(${inv}) translate(0, -110%)`,
            transformOrigin: "top left",
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "white",
            color: "#0a0a0a",
            border: "1px solid #6b1320",
            borderRadius: 4,
            padding: "4px 6px",
            fontSize: 11,
            fontFamily: "system-ui, sans-serif",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            whiteSpace: "nowrap",
            zIndex: 50,
            pointerEvents: "auto",
          }}
        >
          <button
            type="button"
            title="Resize text"
            onClick={() => setShowSize((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 4px",
              border: "1px solid #ddd",
              borderRadius: 3,
              background: showSize ? "#0a0a0a" : "white",
              color: showSize ? "white" : "#0a0a0a",
              cursor: "pointer",
            }}
          >
            <Type size={12} />
            <span>{Math.round(textScale * 100)}%</span>
          </button>
          {showSize && (
            <>
              <input
                type="range"
                min={50}
                max={200}
                step={5}
                value={Math.round(textScale * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  ctx.setTextScale(blockKey, v === 1 ? null : v);
                }}
                style={{ width: 120 }}
              />
              <button
                type="button"
                title="Reset size"
                onClick={() => ctx.setTextScale(blockKey, null)}
                style={{
                  padding: "2px 6px",
                  border: "1px solid #ddd",
                  borderRadius: 3,
                  background: "white",
                  cursor: "pointer",
                }}
              >
                ↺
              </button>
            </>
          )}
          <button
            type="button"
            title={link ? `Linked: ${link}` : "Add link"}
            onClick={() => {
              const next = window.prompt(
                "Link URL (leave empty to remove):",
                link,
              );
              if (next === null) return;
              const trimmed = next.trim();
              ctx.setBlockLink(blockKey, trimmed ? trimmed : null);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 4px",
              border: "1px solid #ddd",
              borderRadius: 3,
              background: link ? "#2563eb" : "white",
              color: link ? "white" : "#0a0a0a",
              cursor: "pointer",
            }}
          >
            <Link2 size={12} />
            {link && <span style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis" }}>{link.replace(/^https?:\/\//, "")}</span>}
          </button>
        </div>
      )}
      {wrapped}
    </div>
  );
}
