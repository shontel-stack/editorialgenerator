import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from "react";
import QRCode from "qrcode";
import { Plus, Type as TypeIcon, Image as ImageIcon, Square, Link2, Trash2, QrCode, LayoutGrid, Film, X, Settings2, RotateCw, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignStartVertical, AlignCenterVertical, AlignEndVertical } from "lucide-react";
import type { CustomBlock } from "@/lib/coverDefaults";
import { LAYOUT_TEMPLATES, TEMPLATE_CATEGORIES, type LayoutTemplate } from "@/lib/layoutTemplates";
import { useLayoutEdit } from "./LayoutEdit";
import { snapRotationWith, useSnapSettings } from "@/lib/snapSettings";
import { getTextBlockDefaults, useTextBlockDefaults, type TextBlockDefaults } from "@/lib/textBlockDefaults";
import {
  getImageBlockDefaults,
  getVideoBlockDefaults,
  useImageBlockDefaults,
  useVideoBlockDefaults,
  type ImageBlockDefaults,
  type VideoBlockDefaults,
} from "@/lib/mediaBlockDefaults";
import { useBrandKit } from "@/lib/brandKitContext";
import { SwatchPicker } from "@/components/SwatchPicker";

const SNAP = 20;
const snap = (n: number) => Math.round(n / SNAP) * SNAP;
const newId = () => `cb_${Math.random().toString(36).slice(2, 10)}`;

/** Snap a single coordinate to the nearest guide within threshold. Returns
 *  the delta to add (snapped - value), or 0 if no guide is close enough. */
function snapEdge(value: number, guides: number[] | undefined, threshold: number): number {
  if (!guides || guides.length === 0) return 0;
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

/** Snap a coordinate to its closest guide and return both the delta AND the
 *  matched guide value (page-px) — used to draw live alignment lines. */
function snapEdgeWithMatch(
  value: number,
  guides: number[] | undefined,
  threshold: number,
): { delta: number; match: number | null } {
  if (!guides || guides.length === 0) return { delta: 0, match: null };
  let best = 0;
  let match: number | null = null;
  let bestDist = threshold;
  for (const g of guides) {
    const d = g - value;
    const ad = Math.abs(d);
    if (ad < bestDist) {
      bestDist = ad;
      best = d;
      match = g;
    }
  }
  return { delta: best, match };
}

/** Snap a value to the nearest multiple of `step` if within `threshold`. */
function snapGrid(value: number, step: number, threshold: number): { delta: number; match: number | null } {
  if (!step || step <= 0) return { delta: 0, match: null };
  const nearest = Math.round(value / step) * step;
  const d = nearest - value;
  if (Math.abs(d) <= threshold) return { delta: d, match: nearest };
  return { delta: 0, match: null };
}


// Rotation snapping is now user-configurable via `useSnapSettings` —
// see src/lib/snapSettings.ts.

const FONT_VARS: Record<"display" | "serif" | "sans", string> = {
  display: "var(--font-display)",
  serif: "var(--font-serif)",
  sans: "var(--font-sans)",
};

function defaultBlock(kind: CustomBlock["kind"]): CustomBlock {
  const id = newId();
  const base = { id, x: 600, y: 600, z: 50 } as const;
  switch (kind) {
    case "text": {
      const d = getTextBlockDefaults();
      return {
        id,
        kind: "text",
        x: d.marginX,
        y: d.marginY,
        z: 50,
        w: d.w,
        h: d.h,
        text: "Double-click to edit",
        fontFamily: d.fontFamily,
        fontSize: d.fontSize,
        fontWeight: d.fontWeight,
        italic: d.italic,
        align: d.align,
        color: d.color,
      };
    }
    case "image": {
      const d = getImageBlockDefaults();
      return {
        id,
        kind: "image",
        x: d.marginX,
        y: d.marginY,
        z: 50,
        w: d.w,
        h: d.h,
        imageUrl: "",
        imageFit: d.imageFit,
        borderWidth: d.borderWidth,
        borderColor: d.borderColor,
        bg: d.bg,
      };
    }
    case "shape":
      return { ...base, kind: "shape", w: 1200, h: 40, shape: "line", fill: "transparent", stroke: "#6b1320", strokeWidth: 6 };
    case "embed":
      return { ...base, kind: "embed", w: 480, h: 160, embed: "button", url: "https://", label: "Read more", color: "#ffffff", bg: "#6b1320" };
    case "video": {
      const d = getVideoBlockDefaults();
      return {
        id,
        kind: "video",
        x: d.marginX,
        y: d.marginY,
        z: 50,
        w: d.w,
        h: d.h,
        url: "",
        muted: d.muted,
        loop: d.loop,
        autoplay: d.autoplay,
        poster: d.poster || undefined,
        volume: d.volume,
        controls: d.controls,
        playsInline: d.playsInline,
        preload: d.preload,
      };
    }
  }
}

export function CustomBlocksLayer() {
  const ctx = useLayoutEdit();
  const editing = ctx?.editing ?? false;
  const blocks = ctx?.customBlocks ?? [];
  const setBlocks = ctx?.setCustomBlocks;
  const globalSnap = useSnapSettings();
  const snapCfg = ctx?.snapSettings ?? globalSnap;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  // Index of the paragraph the caret is in while editing a text block, else null.
  const [caretParagraph, setCaretParagraph] = useState<number | null>(null);

  // Live alignment lines shown during a drag. Cleared on pointer up.
  const [activeLines, setActiveLines] = useState<{ xs: number[]; ys: number[] }>({ xs: [], ys: [] });

  // Measure the parent container (page surface) so the grid overlay can size
  // itself without the parent needing to pass pageDim explicitly.
  const probeRef = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = probeRef.current?.parentElement;
    if (!el) return;
    const update = () => setPageSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [editing]);

  // Clear selection when leaving edit mode
  useEffect(() => {
    if (!editing) {
      setSelectedId(null);
      setCaretParagraph(null);
    }
  }, [editing]);
  // Reset caret paragraph when switching selected block.
  useEffect(() => {
    setCaretParagraph(null);
  }, [selectedId]);
  // Clear any leftover alignment lines when leaving edit mode.
  useEffect(() => {
    if (!editing) setActiveLines({ xs: [], ys: [] });
  }, [editing]);

  /** Build sibling-block snap axes for a given drag target id. */
  const siblingAxesFor = useCallback(
    (dragId: string): { xs: number[]; ys: number[] } => {
      if (!snapCfg.alignToObjects) return { xs: [], ys: [] };
      const xs: number[] = [];
      const ys: number[] = [];
      for (const b of blocks) {
        if (b.id === dragId) continue;
        xs.push(b.x, b.x + b.w / 2, b.x + b.w);
        ys.push(b.y, b.y + b.h / 2, b.y + b.h);
      }
      return { xs, ys };
    },
    [blocks, snapCfg.alignToObjects],
  );

  const update = useCallback(
    (id: string, patch: Partial<CustomBlock>) => {
      if (!setBlocks) return;
      setBlocks(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as CustomBlock) : b)));
    },
    [blocks, setBlocks],
  );
  const remove = useCallback(
    (id: string) => {
      if (!setBlocks) return;
      setBlocks(blocks.filter((b) => b.id !== id));
      setSelectedId(null);
    },
    [blocks, setBlocks],
  );
  const requestEdit = ctx?.onRequestEdit;
  const add = useCallback(
    (kind: CustomBlock["kind"]) => {
      if (!setBlocks) return;
      if (!editing) requestEdit?.();
      const b = defaultBlock(kind);
      setBlocks([...blocks, b]);
      setSelectedId(b.id);
    },
    [blocks, setBlocks, editing, requestEdit],
  );
  const insertTemplate = useCallback(
    (tpl: LayoutTemplate) => {
      if (!setBlocks) return;
      if (!editing) requestEdit?.();
      const baseZ = blocks.reduce((m, b) => Math.max(m, b.z ?? 50), 50);
      const fresh = tpl.build().map((b, i) => ({ ...b, z: baseZ + 1 + i } as CustomBlock));
      setBlocks([...blocks, ...fresh]);
      setSelectedId(fresh[0]?.id ?? null);
    },
    [blocks, setBlocks, editing, requestEdit],
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const reorder = useCallback(
    (id: string, action: "front" | "back" | "forward" | "backward") => {
      if (!setBlocks) return;
      const zs = blocks.map((b) => b.z ?? 50);
      const maxZ = zs.length ? Math.max(...zs) : 50;
      const minZ = zs.length ? Math.min(...zs) : 50;
      setBlocks(
        blocks.map((b) => {
          if (b.id !== id) return b;
          const cur = b.z ?? 50;
          let next = cur;
          if (action === "front") next = maxZ + 1;
          else if (action === "back") next = minZ - 1;
          else if (action === "forward") next = cur + 1;
          else if (action === "backward") next = cur - 1;
          return { ...b, z: next } as CustomBlock;
        }),
      );
    },
    [blocks, setBlocks],
  );

  const grid = editing && snapCfg.gridSizePx > 0 && pageSize ? snapCfg.gridSizePx : 0;

  return (
    <>
      {/* Zero-size probe used to discover the page surface dimensions. */}
      <div ref={probeRef} style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }} />

      {/* Snap-to-grid overlay (non-printing). */}
      {grid > 0 && pageSize && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
            backgroundImage:
              `linear-gradient(to right, rgba(37,99,235,0.18) 1px, transparent 1px),` +
              `linear-gradient(to bottom, rgba(37,99,235,0.18) 1px, transparent 1px)`,
            backgroundSize: `${grid}px ${grid}px`,
            mixBlendMode: "multiply",
          }}
        />
      )}

      {blocks.map((b) => (
        <CustomBlockView
          key={b.id}
          block={b}
          editing={editing}
          selected={selectedId === b.id}
          onSelect={() => setSelectedId(b.id)}
          onChange={(p) => update(b.id, p)}
          onRemove={() => remove(b.id)}
          siblingAxesFor={siblingAxesFor}
          gridSize={snapCfg.gridSizePx}
          onActiveLines={setActiveLines}
          onCaretParagraphChange={selectedId === b.id ? setCaretParagraph : undefined}
        />
      ))}

      {/* Live alignment guide lines during drag. */}
      {editing && pageSize && (activeLines.xs.length > 0 || activeLines.ys.length > 0) && (
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 220 }}>
          {activeLines.xs.map((x, i) => (
            <div
              key={`gx-${i}-${x}`}
              style={{
                position: "absolute",
                left: x,
                top: 0,
                width: 1,
                height: pageSize.h,
                background: "#ec4899",
                boxShadow: "0 0 0 1px rgba(236,72,153,0.25)",
              }}
            />
          ))}
          {activeLines.ys.map((y, i) => (
            <div
              key={`gy-${i}-${y}`}
              style={{
                position: "absolute",
                top: y,
                left: 0,
                height: 1,
                width: pageSize.w,
                background: "#ec4899",
                boxShadow: "0 0 0 1px rgba(236,72,153,0.25)",
              }}
            />
          ))}
        </div>
      )}

      {setBlocks && <AddElementPalette onAdd={add} onOpenTemplates={() => { if (!editing) requestEdit?.(); setPickerOpen(true); }} />}
      {editing && selected && setBlocks && (
        <BlockToolbar
          block={selected}
          onChange={(p) => update(selected.id, p)}
          onRemove={() => remove(selected.id)}
          onReorder={(a) => reorder(selected.id, a)}
          caretParagraph={caretParagraph}
        />
      )}
      {editing && pickerOpen && setBlocks && (
        <TemplatePicker onPick={(t) => { insertTemplate(t); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />
      )}
    </>
  );
}



/* ------------------------------------------------------------------ */
/* Single block view (drag, resize, click-to-select, inline text edit) */
/* ------------------------------------------------------------------ */

function CustomBlockView({
  block,
  editing,
  selected,
  onSelect,
  onChange,
  onRemove,
  siblingAxesFor,
  gridSize,
  onActiveLines,
  onCaretParagraphChange,
}: {
  block: CustomBlock;
  editing: boolean;
  selected: boolean;
  onSelect: () => void;
  onChange: (p: Partial<CustomBlock>) => void;
  onRemove: () => void;
  siblingAxesFor?: (dragId: string) => { xs: number[]; ys: number[] };
  gridSize?: number;
  onActiveLines?: (lines: { xs: number[]; ys: number[] }) => void;
  onCaretParagraphChange?: (n: number | null) => void;
}) {
  const ctx = useLayoutEdit();
  const pageScale = ctx?.scale ?? 1;
  const global = useSnapSettings();
  const snapCfg = ctx?.snapSettings ?? global;
  const dragRef = useRef<{ mode: "move" | "resize"; x: number; y: number; box: { x: number; y: number; w: number; h: number } } | null>(null);
  const rotRef = useRef<{ cx: number; cy: number; startAngle: number; startRotate: number } | null>(null);
  const [editingText, setEditingText] = useState(false);

  /** Combined snap-axis pools — page guides ⊕ sibling-block edges/centers. */
  const combinedAxes = useCallback((): { xs: number[]; ys: number[]; threshold: number } => {
    const baseG = ctx?.guides;
    const sib = siblingAxesFor ? siblingAxesFor(block.id) : { xs: [], ys: [] };
    const xs = [...(baseG?.xs ?? []), ...sib.xs];
    const ys = [...(baseG?.ys ?? []), ...sib.ys];
    const threshold = baseG?.threshold ?? snapCfg.edgeTolerancePx;
    return { xs, ys, threshold };
  }, [ctx?.guides, siblingAxesFor, block.id, snapCfg.edgeTolerancePx]);

  /** Snap a horizontal coordinate against all axes + grid. Returns delta and
   *  matched guide (for line rendering). */
  const snapX = (v: number) => {
    const g = combinedAxes();
    const ax = snapEdgeWithMatch(v, g.xs, g.threshold);
    const gr = snapGrid(v, gridSize ?? 0, g.threshold);
    if (Math.abs(ax.delta) > 0 && Math.abs(ax.delta) <= Math.abs(gr.delta || g.threshold + 1)) return ax;
    return gr.delta !== 0 ? gr : ax;
  };
  const snapY = (v: number) => {
    const g = combinedAxes();
    const ay = snapEdgeWithMatch(v, g.ys, g.threshold);
    const gr = snapGrid(v, gridSize ?? 0, g.threshold);
    if (Math.abs(ay.delta) > 0 && Math.abs(ay.delta) <= Math.abs(gr.delta || g.threshold + 1)) return ay;
    return gr.delta !== 0 ? gr : ay;
  };

  const startDrag = (mode: "move" | "resize", e: RPointerEvent<HTMLDivElement>) => {
    if (!editing || editingText) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode,
      x: e.clientX,
      y: e.clientY,
      box: { x: block.x, y: block.y, w: block.w, h: block.h },
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onSelect();
  };

  const startRotate = (e: RPointerEvent<HTMLDivElement>) => {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    const target = (e.currentTarget as HTMLElement).parentElement as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    const curRotate = (block as { rotate?: number }).rotate ?? 0;
    rotRef.current = { cx, cy, startAngle, startRotate: curRotate };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onSelect();
  };
  const onRotateMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!rotRef.current) return;
    const { cx, cy, startAngle, startRotate } = rotRef.current;
    const a = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    let next = startRotate + (a - startAngle);
    while (next > 180) next -= 360;
    while (next < -180) next += 360;
    onChange({ rotate: snapRotationWith(next, snapCfg) } as Partial<CustomBlock>);
  };
  const onRotateUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!rotRef.current) return;
    rotRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  /** Apply snap to the move delta, choosing the best of leading/center/trailing
   *  edge per axis. Returns the snapped position + matched guide lines. */
  const computeMoveSnap = (nx: number, ny: number, w: number, h: number) => {
    const xCands = [nx, nx + w / 2, nx + w];
    const yCands = [ny, ny + h / 2, ny + h];
    let bestX: { delta: number; match: number | null } = { delta: 0, match: null };
    for (const c of xCands) {
      const s = snapX(c);
      if (Math.abs(s.delta) > 0 && (bestX.match === null || Math.abs(s.delta) < Math.abs(bestX.delta))) bestX = s;
    }
    let bestY: { delta: number; match: number | null } = { delta: 0, match: null };
    for (const c of yCands) {
      const s = snapY(c);
      if (Math.abs(s.delta) > 0 && (bestY.match === null || Math.abs(s.delta) < Math.abs(bestY.delta))) bestY = s;
    }
    return { nx: nx + bestX.delta, ny: ny + bestY.delta, matchX: bestX.match, matchY: bestY.match };
  };

  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const s = pageScale || 1;
    const dx = (e.clientX - dragRef.current.x) / s;
    const dy = (e.clientY - dragRef.current.y) / s;
    if (dragRef.current.mode === "move") {
      const w = dragRef.current.box.w;
      const h = dragRef.current.box.h;
      const r = computeMoveSnap(dragRef.current.box.x + dx, dragRef.current.box.y + dy, w, h);
      onChange({ x: r.nx, y: r.ny });
      onActiveLines?.({
        xs: r.matchX !== null ? [r.matchX] : [],
        ys: r.matchY !== null ? [r.matchY] : [],
      });
    } else {
      let nw = Math.max(80, dragRef.current.box.w + dx);
      let nh = Math.max(40, dragRef.current.box.h + dy);
      const right = dragRef.current.box.x + nw;
      const bottom = dragRef.current.box.y + nh;
      const rx = snapX(right);
      const ry = snapY(bottom);
      if (rx.delta !== 0) nw = Math.max(80, nw + rx.delta);
      if (ry.delta !== 0) nh = Math.max(40, nh + ry.delta);
      onChange({ w: nw, h: nh });
      onActiveLines?.({
        xs: rx.match !== null ? [rx.match] : [],
        ys: ry.match !== null ? [ry.match] : [],
      });
    }
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const s = pageScale || 1;
    const dx = (e.clientX - dragRef.current.x) / s;
    const dy = (e.clientY - dragRef.current.y) / s;
    if (dragRef.current.mode === "move") {
      const w = dragRef.current.box.w;
      const h = dragRef.current.box.h;
      const r = computeMoveSnap(dragRef.current.box.x + dx, dragRef.current.box.y + dy, w, h);
      onChange({
        x: r.matchX !== null ? Math.round(r.nx) : snap(r.nx),
        y: r.matchY !== null ? Math.round(r.ny) : snap(r.ny),
      });
    } else {
      let nw = Math.max(80, dragRef.current.box.w + dx);
      let nh = Math.max(40, dragRef.current.box.h + dy);
      const right = dragRef.current.box.x + nw;
      const bottom = dragRef.current.box.y + nh;
      const rx = snapX(right);
      const ry = snapY(bottom);
      let usedW = false;
      let usedH = false;
      if (rx.delta !== 0) { nw = Math.max(80, nw + rx.delta); usedW = true; }
      if (ry.delta !== 0) { nh = Math.max(40, nh + ry.delta); usedH = true; }
      onChange({
        w: usedW ? Math.round(nw) : snap(nw),
        h: usedH ? Math.round(nh) : snap(nh),
      });
    }
    dragRef.current = null;
    onActiveLines?.({ xs: [], ys: [] });
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };


  const rotate = (block as { rotate?: number }).rotate ?? 0;
  const wrapper: CSSProperties = {
    position: "absolute",
    left: block.x,
    top: block.y,
    width: block.w,
    height: block.h,
    zIndex: block.z ?? 50,
    boxSizing: "border-box",
    transform: rotate ? `rotate(${rotate}deg)` : undefined,
    transformOrigin: "center center",
    cursor: editing ? (editingText ? "text" : "move") : block.link ? "pointer" : "default",
    outline: editing
      ? selected
        ? "4px solid rgba(37,99,235,0.9)"
        : "3px dashed rgba(37,99,235,0.5)"
      : "none",
    outlineOffset: 2,
  };

  const inner = (
    <BlockContent
      block={block}
      editingText={editingText}
      onTextChange={(t) => onChange({ text: t } as Partial<CustomBlock>)}
      stopEditingText={() => {
        setEditingText(false);
        onCaretParagraphChange?.(null);
      }}
      onCaretParagraphChange={onCaretParagraphChange}
    />
  );

  const wrapped =
    block.link && !editing ? (
      <a href={block.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none", display: "block", width: "100%", height: "100%" }}>
        {inner}
      </a>
    ) : (
      inner
    );

  const inv = 1 / (pageScale || 1);

  return (
    <div
      style={wrapper}
      onPointerDown={(e) => startDrag("move", e)}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={(e) => {
        if (!editing) return;
        if (block.kind === "text") {
          e.stopPropagation();
          setEditingText(true);
          onSelect();
        }
      }}
    >
      {wrapped}
      {editing && selected && (
        <>
          {/* Resize handle (bottom-right) */}
          <div
            onPointerDown={(e) => startDrag("resize", e)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{
              position: "absolute",
              right: -10,
              bottom: -10,
              width: 28,
              height: 28,
              transform: `scale(${inv})`,
              transformOrigin: "bottom right",
              background: "#2563eb",
              border: "2px solid white",
              borderRadius: 4,
              cursor: "nwse-resize",
              zIndex: 200,
            }}
          />
          {/* Rotate handle (top-center, above the block) */}
          <div
            title="Drag to rotate"
            onPointerDown={startRotate}
            onPointerMove={onRotateMove}
            onPointerUp={onRotateUp}
            onPointerCancel={onRotateUp}
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              width: 28,
              height: 28,
              transform: `translate(-50%, -180%) scale(${inv})`,
              transformOrigin: "center center",
              background: "white",
              border: "2px solid #2563eb",
              color: "#2563eb",
              borderRadius: "50%",
              cursor: "grab",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 210,
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              touchAction: "none",
            }}
          >
            <RotateCw size={14} />
          </div>
          {/* Tether line from block top to rotate handle */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              width: 2,
              height: 28,
              transform: `translate(-50%, -100%) scaleY(${inv})`,
              transformOrigin: "bottom center",
              background: "#2563eb",
              opacity: 0.5,
              pointerEvents: "none",
              zIndex: 205,
            }}
          />
          {/* Quick delete */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Delete element"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              transform: `scale(${inv}) translate(110%, -10%)`,
              transformOrigin: "top right",
              background: "white",
              border: "1px solid #dc2626",
              color: "#dc2626",
              borderRadius: 4,
              padding: "4px 6px",
              fontSize: 12,
              cursor: "pointer",
              zIndex: 200,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Trash2 size={12} /> Delete
          </button>
        </>
      )}

    </div>
  );
}

/* ----------------------- per-kind rendering ----------------------- */

function BlockContent({
  block,
  editingText,
  onTextChange,
  stopEditingText,
  onCaretParagraphChange,
}: {
  block: CustomBlock;
  editingText: boolean;
  onTextChange: (text: string) => void;
  stopEditingText: () => void;
  onCaretParagraphChange?: (n: number | null) => void;
}) {
  if (block.kind === "text") {
    const cols = Math.max(1, Math.min(6, Math.floor(block.columns ?? 1)));
    const gap = Math.max(0, block.columnGap ?? 32);
    const blockAlign = block.align ?? "left";
    const pAligns = block.paragraphAligns ?? [];
    const style: CSSProperties = {
      width: "100%",
      height: "100%",
      padding: 8,
      boxSizing: "border-box",
      fontFamily: FONT_VARS[block.fontFamily ?? "serif"],
      fontSize: block.fontSize ?? 48,
      fontWeight: block.fontWeight ?? 400,
      fontStyle: block.italic ? "italic" : "normal",
      textAlign: blockAlign,
      color: block.color ?? "#0a0a0a",
      background: block.bg ?? "transparent",
      lineHeight: 1.25,
      overflow: "hidden",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      outline: "none",
      ...(cols > 1
        ? {
            columnCount: cols,
            columnGap: `${gap}px`,
            columnFill: "balance" as const,
          }
        : null),
    };
    if (editingText) {
      const reportCaret = (target: HTMLTextAreaElement) => {
        const pos = target.selectionStart ?? 0;
        const idx = target.value.slice(0, pos).split("\n").length - 1;
        onCaretParagraphChange?.(idx);
      };
      return (
        <textarea
          autoFocus
          value={block.text}
          onChange={(e) => {
            onTextChange(e.target.value);
            reportCaret(e.currentTarget);
          }}
          onSelect={(e) => reportCaret(e.currentTarget)}
          onClick={(e) => reportCaret(e.currentTarget)}
          onKeyUp={(e) => reportCaret(e.currentTarget)}
          onFocus={(e) => reportCaret(e.currentTarget)}
          onBlur={stopEditingText}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{ ...style, resize: "none", border: "none", background: block.bg ?? "rgba(255,255,255,0.4)" }}
        />
      );
    }
    // Render each line as its own paragraph so per-paragraph alignment works.
    const paragraphs = block.text.split("\n");
    const pBefore = block.paragraphSpaceBefore ?? [];
    const pAfter = block.paragraphSpaceAfter ?? [];
    const pLH = block.paragraphLineHeight ?? [];
    return (
      <div style={style}>
        {paragraphs.map((p, i) => {
          const a = pAligns[i] ?? blockAlign;
          const mt = pBefore[i] ?? 0;
          const mb = pAfter[i] ?? 0;
          const lh = pLH[i];
          return (
            <p
              key={i}
              style={{
                margin: 0,
                marginTop: mt || undefined,
                marginBottom: mb || undefined,
                textAlign: a,
                lineHeight: lh ?? undefined,
                breakInside: "avoid" as const,
                minHeight: p.length === 0 ? "1em" : undefined,
              }}
            >
              {p.length === 0 ? "\u00a0" : p}
            </p>
          );
        })}
      </div>
    );
  }
  if (block.kind === "image") {
    const borderStyle = block.borderWidth
      ? { border: `${block.borderWidth}px solid ${block.borderColor ?? "#ffffff"}`, background: block.bg ?? "#ffffff" }
      : {};
    if (!block.imageUrl) {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "repeating-linear-gradient(45deg, #eee 0 16px, #ddd 16px 32px)",
            color: "#666",
            fontFamily: "var(--font-sans)",
            fontSize: 18,
            letterSpacing: 2,
            textTransform: "uppercase",
            boxSizing: "border-box",
            ...borderStyle,
          }}
        >
          Select element → upload
        </div>
      );
    }
    return (
      <div style={{ width: "100%", height: "100%", boxSizing: "border-box", ...borderStyle }}>
        <img src={block.imageUrl} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: block.imageFit ?? "cover", display: "block" }} />
      </div>
    );
  }
  if (block.kind === "shape") {
    if (block.shape === "line") {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderTop: `${block.strokeWidth ?? 4}px solid ${block.stroke ?? "#0a0a0a"}`,
          }}
        />
      );
    }
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: block.fill ?? "transparent",
          border: block.strokeWidth ? `${block.strokeWidth}px solid ${block.stroke ?? "#0a0a0a"}` : "none",
        }}
      />
    );
  }
  if (block.kind === "video") {
    return <VideoPreview block={block} />;
  }
  // embed
  if (block.embed === "qr") return <QrPreview url={block.url} color={block.color ?? "#0a0a0a"} bg={block.bg ?? "#ffffff"} />;
  // button
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: block.bg ?? "#6b1320",
        color: block.color ?? "#ffffff",
        fontFamily: "var(--font-sans)",
        fontSize: Math.min(block.h * 0.35, 36),
        letterSpacing: 4,
        textTransform: "uppercase",
        fontWeight: 600,
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      {block.label || "Button"}
    </div>
  );
}

function VideoPreview({ block }: { block: Extract<CustomBlock, { kind: "video" }> }) {
  const url = (block.url ?? "").trim();
  if (!url) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#bbb",
          fontFamily: "var(--font-sans)",
          fontSize: 18,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        Select element → paste URL
      </div>
    );
  }
  const embed = toEmbedUrl(url);
  if (embed) {
    return (
      <iframe
        src={embed}
        title="Video"
        style={{ width: "100%", height: "100%", border: 0, display: "block", background: "#000" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  const showControls = block.controls ?? true;
  const playsInline = block.playsInline ?? true;
  return (
    <video
      src={url}
      poster={block.poster || undefined}
      controls={showControls}
      muted={block.muted}
      autoPlay={block.autoplay}
      loop={block.loop}
      playsInline={playsInline}
      preload={block.preload ?? "metadata"}
      ref={(el) => {
        if (el && typeof block.volume === "number") {
          el.volume = Math.max(0, Math.min(1, block.volume));
        }
      }}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }}
    />
  );
}

function toEmbedUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "youtube.com" && u.pathname.startsWith("/shorts/")) {
      return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    if (host === "player.vimeo.com") return raw;
    return null;
  } catch {
    return null;
  }
}


function QrPreview({ url, color, bg }: { url: string; color: string; bg: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!url?.trim()) {
      setSrc("");
      return;
    }
    QRCode.toDataURL(url.trim(), { errorCorrectionLevel: "H", margin: 1, width: 600, color: { dark: color, light: bg } })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [url, color, bg]);
  if (!src) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: bg, color, fontFamily: "var(--font-sans)", fontSize: 18, letterSpacing: 2, textTransform: "uppercase" }}>
        Set QR URL
      </div>
    );
  }
  return <img src={src} alt="QR" style={{ width: "100%", height: "100%", objectFit: "contain", background: bg, display: "block" }} />;
}

/* --------------------- floating toolbars --------------------- */

function AddElementPalette({ onAdd, onOpenTemplates }: { onAdd: (kind: CustomBlock["kind"]) => void; onOpenTemplates: () => void }) {
  const ctx = useLayoutEdit();
  const inv = 1 / (ctx?.scale ?? 1);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  return (
    <>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          transform: `scale(${inv})`,
          transformOrigin: "top right",
          background: "white",
          border: "2px solid #0a0a0a",
          borderRadius: 6,
          padding: 8,
          display: "flex",
          gap: 6,
          boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
          zIndex: 300,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <span style={{ alignSelf: "center", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#666", paddingLeft: 4, paddingRight: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Plus size={12} /> Add
        </span>
        <PaletteBtn label="Text" icon={<TypeIcon size={14} />} onClick={() => onAdd("text")} />
        <PaletteBtn label="Image" icon={<ImageIcon size={14} />} onClick={() => onAdd("image")} />
        <PaletteBtn label="Video" icon={<Film size={14} />} onClick={() => onAdd("video")} />
        <PaletteBtn label="Shape" icon={<Square size={14} />} onClick={() => onAdd("shape")} />
        <PaletteBtn label="QR" icon={<QrCode size={14} />} onClick={() => onAdd("embed")} />
        <div style={{ width: 1, background: "#ddd", margin: "0 2px" }} />
        <PaletteBtn label="Templates" icon={<LayoutGrid size={14} />} onClick={onOpenTemplates} />
        <div style={{ width: 1, background: "#ddd", margin: "0 2px" }} />
        <PaletteBtn label="Defaults" icon={<Settings2 size={14} />} onClick={() => setDefaultsOpen((v) => !v)} />
      </div>
      {defaultsOpen && <BlockDefaultsPanel onClose={() => setDefaultsOpen(false)} />}
    </>
  );
}

function BlockDefaultsPanel({ onClose }: { onClose: () => void }) {
  const ctx = useLayoutEdit();
  const inv = 1 / (ctx?.scale ?? 1);
  const [tab, setTab] = useState<"text" | "image" | "video">("text");
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 90,
        right: 24,
        transform: `scale(${inv})`,
        transformOrigin: "top right",
        background: "white",
        border: "2px solid #0a0a0a",
        borderRadius: 8,
        padding: 16,
        width: 360,
        boxShadow: "0 12px 36px rgba(0,0,0,0.25)",
        zIndex: 350,
        fontFamily: "system-ui, sans-serif",
        color: "#0a0a0a",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <strong style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>New block defaults</strong>
        <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#666" }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {(["text", "image", "video"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} style={{ ...btnStyle(tab === t ? "active" : "normal"), fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>{t}</button>
        ))}
      </div>
      {tab === "text" && <TextDefaultsForm />}
      {tab === "image" && <ImageDefaultsForm />}
      {tab === "video" && <VideoDefaultsForm />}
      <div style={{ marginTop: 10, color: "#888", fontSize: 10 }}>Page = 3200 × 4267 px (300 DPI).</div>
    </div>
  );
}

function num(v: string, fallback: number) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

function TextDefaultsForm() {
  const { defaults, update, reset } = useTextBlockDefaults();
  const set = <K extends keyof TextBlockDefaults>(k: K, v: TextBlockDefaults[K]) => update({ [k]: v } as Partial<TextBlockDefaults>);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Font family">
          <select value={defaults.fontFamily} onChange={(e) => set("fontFamily", e.target.value as TextBlockDefaults["fontFamily"])} style={defaultsInputStyle}>
            <option value="display">Display</option>
            <option value="serif">Serif</option>
            <option value="sans">Sans</option>
          </select>
        </Field>
        <Field label="Align">
          <select value={defaults.align} onChange={(e) => set("align", e.target.value as TextBlockDefaults["align"])} style={defaultsInputStyle}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </Field>
        <Field label="Font size (px)"><input type="number" min={8} value={defaults.fontSize} onChange={(e) => set("fontSize", num(e.target.value, defaults.fontSize))} style={defaultsInputStyle} /></Field>
        <Field label="Weight">
          <select value={defaults.fontWeight} onChange={(e) => set("fontWeight", Number(e.target.value))} style={defaultsInputStyle}>
            {[300, 400, 500, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>
        <Field label="Italic"><label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={defaults.italic} onChange={(e) => set("italic", e.target.checked)} /> Italic</label></Field>
        <Field label="Color"><input type="color" value={defaults.color} onChange={(e) => set("color", e.target.value)} style={{ ...defaultsInputStyle, padding: 0, height: 28 }} /></Field>
        <Field label="Box width (px)"><input type="number" min={40} value={defaults.w} onChange={(e) => set("w", num(e.target.value, defaults.w))} style={defaultsInputStyle} /></Field>
        <Field label="Box height (px)"><input type="number" min={40} value={defaults.h} onChange={(e) => set("h", num(e.target.value, defaults.h))} style={defaultsInputStyle} /></Field>
        <Field label="Margin X (px)"><input type="number" min={0} value={defaults.marginX} onChange={(e) => set("marginX", num(e.target.value, defaults.marginX))} style={defaultsInputStyle} /></Field>
        <Field label="Margin Y (px)"><input type="number" min={0} value={defaults.marginY} onChange={(e) => set("marginY", num(e.target.value, defaults.marginY))} style={defaultsInputStyle} /></Field>
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={reset} style={btnStyle("normal")}>Reset</button></div>
    </>
  );
}

function ImageDefaultsForm() {
  const { defaults, update, reset } = useImageBlockDefaults();
  const set = <K extends keyof ImageBlockDefaults>(k: K, v: ImageBlockDefaults[K]) => update({ [k]: v } as Partial<ImageBlockDefaults>);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Box width (px)"><input type="number" min={40} value={defaults.w} onChange={(e) => set("w", num(e.target.value, defaults.w))} style={defaultsInputStyle} /></Field>
        <Field label="Box height (px)"><input type="number" min={40} value={defaults.h} onChange={(e) => set("h", num(e.target.value, defaults.h))} style={defaultsInputStyle} /></Field>
        <Field label="Margin X (px)"><input type="number" min={0} value={defaults.marginX} onChange={(e) => set("marginX", num(e.target.value, defaults.marginX))} style={defaultsInputStyle} /></Field>
        <Field label="Margin Y (px)"><input type="number" min={0} value={defaults.marginY} onChange={(e) => set("marginY", num(e.target.value, defaults.marginY))} style={defaultsInputStyle} /></Field>
        <Field label="Fit">
          <select value={defaults.imageFit} onChange={(e) => set("imageFit", e.target.value as ImageBlockDefaults["imageFit"])} style={defaultsInputStyle}>
            <option value="cover">Cover (fill)</option>
            <option value="contain">Contain (letterbox)</option>
          </select>
        </Field>
        <Field label="Border width (px)"><input type="number" min={0} value={defaults.borderWidth} onChange={(e) => set("borderWidth", num(e.target.value, defaults.borderWidth))} style={defaultsInputStyle} /></Field>
        <Field label="Border color"><input type="color" value={defaults.borderColor} onChange={(e) => set("borderColor", e.target.value)} style={{ ...defaultsInputStyle, padding: 0, height: 28 }} /></Field>
        <Field label="Background"><input type="color" value={defaults.bg} onChange={(e) => set("bg", e.target.value)} style={{ ...defaultsInputStyle, padding: 0, height: 28 }} /></Field>
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={reset} style={btnStyle("normal")}>Reset</button></div>
    </>
  );
}

function VideoDefaultsForm() {
  const { defaults, update, reset } = useVideoBlockDefaults();
  const set = <K extends keyof VideoBlockDefaults>(k: K, v: VideoBlockDefaults[K]) => update({ [k]: v } as Partial<VideoBlockDefaults>);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Box width (px)"><input type="number" min={40} value={defaults.w} onChange={(e) => set("w", num(e.target.value, defaults.w))} style={defaultsInputStyle} /></Field>
        <Field label="Box height (px)"><input type="number" min={40} value={defaults.h} onChange={(e) => set("h", num(e.target.value, defaults.h))} style={defaultsInputStyle} /></Field>
        <Field label="Margin X (px)"><input type="number" min={0} value={defaults.marginX} onChange={(e) => set("marginX", num(e.target.value, defaults.marginX))} style={defaultsInputStyle} /></Field>
        <Field label="Margin Y (px)"><input type="number" min={0} value={defaults.marginY} onChange={(e) => set("marginY", num(e.target.value, defaults.marginY))} style={defaultsInputStyle} /></Field>
        <Field label="Poster URL">
          <input type="url" placeholder="https://…/thumb.jpg" value={defaults.poster} onChange={(e) => set("poster", e.target.value)} style={defaultsInputStyle} />
        </Field>
        <Field label={`Volume (${Math.round(defaults.volume * 100)}%)`}>
          <input type="range" min={0} max={1} step={0.05} value={defaults.volume} onChange={(e) => set("volume", Number(e.target.value))} style={{ width: "100%" }} />
        </Field>
        <Field label="Controls">
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={defaults.controls} onChange={(e) => set("controls", e.target.checked)} /> Show controls</label>
        </Field>
        <Field label="Playback">
          <select value={defaults.preload} onChange={(e) => set("preload", e.target.value as VideoBlockDefaults["preload"])} style={defaultsInputStyle}>
            <option value="none">Preload: none</option>
            <option value="metadata">Preload: metadata</option>
            <option value="auto">Preload: auto</option>
          </select>
        </Field>
        <Field label="Inline (iOS)">
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={defaults.playsInline} onChange={(e) => set("playsInline", e.target.checked)} /> Play inline</label>
        </Field>
        <Field label="Muted"><label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={defaults.muted} onChange={(e) => set("muted", e.target.checked)} /> Muted</label></Field>
        <Field label="Loop"><label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={defaults.loop} onChange={(e) => set("loop", e.target.checked)} /> Loop</label></Field>
        <Field label="Autoplay"><label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={defaults.autoplay} onChange={(e) => set("autoplay", e.target.checked)} /> Autoplay</label></Field>
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: "#888" }}>
        Browsers require <strong>Muted</strong> for autoplay to actually start. Volume and inline playback only apply to direct video files, not YouTube/Vimeo embeds.
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={reset} style={btnStyle("normal")}>Reset</button></div>
    </>
  );
}




const defaultsInputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #ccc",
  borderRadius: 4,
  padding: "4px 6px",
  fontSize: 12,
  background: "white",
  color: "#0a0a0a",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#666" }}>{label}</span>
      {children}
    </label>
  );
}

function TemplatePicker({ onPick, onClose }: { onPick: (tpl: LayoutTemplate) => void; onClose: () => void }) {
  const ctx = useLayoutEdit();
  const inv = 1 / (ctx?.scale ?? 1);
  const [cat, setCat] = useState<LayoutTemplate["category"]>("Collage");
  const visible = LAYOUT_TEMPLATES.filter((t) => t.category === cat);
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 90,
        right: 24,
        transform: `scale(${inv})`,
        transformOrigin: "top right",
        background: "white",
        border: "2px solid #0a0a0a",
        borderRadius: 8,
        padding: 16,
        width: 560,
        boxShadow: "0 12px 36px rgba(0,0,0,0.25)",
        zIndex: 350,
        fontFamily: "system-ui, sans-serif",
        color: "#0a0a0a",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <strong style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Layout templates</strong>
        <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#666" }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {TEMPLATE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            style={{
              ...btnStyle(cat === c ? "active" : "normal"),
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {visible.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onPick(tpl)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              gap: 6,
              padding: 8,
              border: "1px solid #ddd",
              borderRadius: 6,
              background: "white",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <TemplateThumb tpl={tpl} />
            <span style={{ fontSize: 11, color: "#0a0a0a" }}>{tpl.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TemplateThumb({ tpl }: { tpl: LayoutTemplate }) {
  const blocks = tpl.build();
  const PW = 3200;
  const PH = 4267;
  const TW = 160;
  const TH = (TW * PH) / PW;
  return (
    <div style={{ position: "relative", width: TW, height: TH, background: "#f4efe7", border: "1px solid #e5e5e5", overflow: "hidden" }}>
      {blocks.map((b) => {
        const fill =
          b.kind === "image" ? "#cbd2d9" :
          b.kind === "video" ? "#0a0a0a" :
          b.kind === "embed" ? "#6b1320" :
          b.kind === "shape" ? (b.shape === "line" ? "transparent" : "rgba(10,10,10,0.4)") :
          "transparent";
        const border =
          b.kind === "text" ? "1px dashed #999" :
          b.kind === "shape" && b.shape === "line" ? `2px solid ${b.stroke ?? "#0a0a0a"}` :
          "none";
        const rot = (b as { rotate?: number }).rotate ?? 0;
        return (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: (b.x / PW) * TW,
              top: (b.y / PH) * TH,
              width: (b.w / PW) * TW,
              height: (b.h / PH) * TH,
              background: fill,
              border,
              transform: rot ? `rotate(${rot}deg)` : undefined,
              transformOrigin: "center center",
              boxSizing: "border-box",
            }}
          />
        );
      })}
    </div>
  );
}

function PaletteBtn({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        border: "1px solid #ddd",
        borderRadius: 4,
        background: "white",
        color: "#0a0a0a",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function BlockToolbar({
  block,
  onChange,
  onRemove,
  onReorder,
  caretParagraph,
}: {
  block: CustomBlock;
  onChange: (p: Partial<CustomBlock>) => void;
  onRemove: () => void;
  onReorder: (action: "front" | "back" | "forward" | "backward") => void;
  caretParagraph?: number | null;
}) {
  const ctx = useLayoutEdit();
  const global = useSnapSettings();
  const snapCfg = ctx?.snapSettings ?? global;
  const inv = 1 / (ctx?.scale ?? 1);
  const rotate = (block as { rotate?: number }).rotate ?? 0;
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        bottom: 24,
        left: 24,
        right: 24,
        transform: `scale(${inv})`,
        transformOrigin: "bottom left",
        background: "white",
        border: "2px solid #2563eb",
        borderRadius: 6,
        padding: 10,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
        zIndex: 300,
        fontFamily: "system-ui, sans-serif",
        fontSize: 12,
        color: "#0a0a0a",
      }}
    >
      <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#666" }}>{block.kind}</span>
      {block.kind === "text" && <TextControls block={block} onChange={onChange} caretParagraph={caretParagraph ?? null} />}
      {block.kind === "image" && <ImageControls block={block} onChange={onChange} />}
      {block.kind === "shape" && <ShapeControls block={block} onChange={onChange} />}
      {block.kind === "embed" && <EmbedControls block={block} onChange={onChange} />}
      {block.kind === "video" && <VideoControls block={block} onChange={onChange} />}
      <div style={{ width: 1, alignSelf: "stretch", background: "#e5e5e5" }} />
      <label style={labelStyle}>
        Rotate
        <input
          type="number"
          min={-180}
          max={180}
          value={Math.round(rotate)}
          onChange={(e) => onChange({ rotate: snapRotationWith(Number(e.target.value), snapCfg) } as Partial<CustomBlock>)}
          style={{ ...inputStyle, width: 56 }}
        />
      </label>
      {rotate !== 0 && (
        <button type="button" title="Reset rotation" onClick={() => onChange({ rotate: 0 } as Partial<CustomBlock>)} style={btnStyle("normal")}>
          0°
        </button>
      )}
      <div style={{ width: 1, alignSelf: "stretch", background: "#e5e5e5" }} />
      <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#666" }}>Layer</span>
      <button type="button" title="Bring to front" onClick={() => onReorder("front")} style={btnStyle("normal")}><ChevronsUp size={12} /></button>
      <button type="button" title="Bring forward" onClick={() => onReorder("forward")} style={btnStyle("normal")}><ChevronUp size={12} /></button>
      <button type="button" title="Send backward" onClick={() => onReorder("backward")} style={btnStyle("normal")}><ChevronDown size={12} /></button>
      <button type="button" title="Send to back" onClick={() => onReorder("back")} style={btnStyle("normal")}><ChevronsDown size={12} /></button>
      <div style={{ width: 1, alignSelf: "stretch", background: "#e5e5e5" }} />
      <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#666" }}>Align page</span>
      <button type="button" title="Align left" onClick={() => onChange({ x: 0 } as Partial<CustomBlock>)} style={btnStyle("normal")}><AlignStartVertical size={12} /></button>
      <button type="button" title="Center horizontally" onClick={() => onChange({ x: Math.round((3200 - block.w) / 2) } as Partial<CustomBlock>)} style={btnStyle("normal")}><AlignCenterVertical size={12} /></button>
      <button type="button" title="Align right" onClick={() => onChange({ x: 3200 - block.w } as Partial<CustomBlock>)} style={btnStyle("normal")}><AlignEndVertical size={12} /></button>
      <button type="button" title="Align top" onClick={() => onChange({ y: 0 } as Partial<CustomBlock>)} style={btnStyle("normal")}><AlignStartHorizontal size={12} /></button>
      <button type="button" title="Center vertically" onClick={() => onChange({ y: Math.round((4267 - block.h) / 2) } as Partial<CustomBlock>)} style={btnStyle("normal")}><AlignCenterHorizontal size={12} /></button>
      <button type="button" title="Align bottom" onClick={() => onChange({ y: 4267 - block.h } as Partial<CustomBlock>)} style={btnStyle("normal")}><AlignEndHorizontal size={12} /></button>
      <LinkControl link={(block as { link?: string }).link} onChange={(v) => onChange({ link: v } as Partial<CustomBlock>)} />
      <button type="button" onClick={onRemove} style={btnStyle("danger")}>
        <Trash2 size={12} /> Delete
      </button>
    </div>
  );
}


function TextControls({
  block,
  onChange,
  caretParagraph,
}: {
  block: Extract<CustomBlock, { kind: "text" }>;
  onChange: (p: Partial<CustomBlock>) => void;
  caretParagraph?: number | null;
}) {
  const paragraphs = block.text.split("\n");
  const totalParas = paragraphs.length;
  const pIdx = caretParagraph != null && caretParagraph >= 0 && caretParagraph < totalParas ? caretParagraph : null;
  const pAligns = block.paragraphAligns ?? [];
  const pBefore = block.paragraphSpaceBefore ?? [];
  const pAfter = block.paragraphSpaceAfter ?? [];
  const pLH = block.paragraphLineHeight ?? [];
  const currentParaAlign = pIdx != null ? pAligns[pIdx] ?? null : null;
  const currentSpaceBefore = pIdx != null ? pBefore[pIdx] ?? 0 : 0;
  const currentSpaceAfter = pIdx != null ? pAfter[pIdx] ?? 0 : 0;
  const currentLineHeight = pIdx != null ? pLH[pIdx] ?? 0 : 0;
  const setParaAlign = (a: "left" | "center" | "right" | "justify" | null) => {
    if (pIdx == null) return;
    const next = pAligns.slice();
    while (next.length < totalParas) next.push(null);
    next[pIdx] = a;
    onChange({ paragraphAligns: next });
  };
  const setParaSpace = (key: "paragraphSpaceBefore" | "paragraphSpaceAfter", v: number | null) => {
    if (pIdx == null) return;
    const src = key === "paragraphSpaceBefore" ? pBefore : pAfter;
    const next = src.slice();
    while (next.length < totalParas) next.push(null);
    next[pIdx] = v;
    onChange({ [key]: next } as Partial<CustomBlock>);
  };
  const setParaLineHeight = (v: number | null) => {
    if (pIdx == null) return;
    const next = pLH.slice();
    while (next.length < totalParas) next.push(null);
    next[pIdx] = v;
    onChange({ paragraphLineHeight: next } as Partial<CustomBlock>);
  };
  return (
    <>
      <select value={block.fontFamily ?? "serif"} onChange={(e) => onChange({ fontFamily: e.target.value as "display" | "serif" | "sans" })} style={inputStyle}>
        <option value="display">Display</option>
        <option value="serif">Serif</option>
        <option value="sans">Sans</option>
      </select>
      <label style={labelStyle}>
        Size
        <input type="number" min={12} max={400} value={block.fontSize ?? 48} onChange={(e) => onChange({ fontSize: Number(e.target.value) })} style={{ ...inputStyle, width: 60 }} />
      </label>
      <select value={block.align ?? "left"} onChange={(e) => onChange({ align: e.target.value as "left" | "center" | "right" | "justify" })} style={inputStyle}>
        <option value="left">Left</option>
        <option value="center">Center</option>
        <option value="right">Right</option>
        <option value="justify">Justify</option>
      </select>
      <button type="button" onClick={() => onChange({ italic: !block.italic })} style={btnStyle(block.italic ? "active" : "normal")}>
        Italic
      </button>
      <button type="button" onClick={() => onChange({ fontWeight: (block.fontWeight ?? 400) >= 600 ? 400 : 700 })} style={btnStyle((block.fontWeight ?? 400) >= 600 ? "active" : "normal")}>
        Bold
      </button>
      <label style={labelStyle}>
        Color
        <input type="color" value={block.color ?? "#0a0a0a"} onChange={(e) => onChange({ color: e.target.value })} style={{ width: 28, height: 24, padding: 0, border: "1px solid #ddd" }} />
      </label>
      <label style={labelStyle}>
        Cols
        <input
          type="number"
          min={1}
          max={6}
          value={block.columns ?? 1}
          onChange={(e) => {
            const n = Math.max(1, Math.min(6, Math.floor(Number(e.target.value) || 1)));
            onChange({ columns: n });
          }}
          style={{ ...inputStyle, width: 50 }}
        />
      </label>
      <label style={labelStyle}>
        Gap
        <input
          type="number"
          min={0}
          max={400}
          value={block.columnGap ?? 32}
          onChange={(e) => {
            const v = Math.max(0, Math.min(400, Math.floor(Number(e.target.value) || 0)));
            onChange({ columnGap: v });
          }}
          style={{ ...inputStyle, width: 56 }}
        />
      </label>
      <div style={{ width: 1, alignSelf: "stretch", background: "#e5e5e5" }} />
      <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#666" }}>
        {pIdx != null ? `¶ ${pIdx + 1}/${totalParas}` : "¶ (click in text)"}
      </span>
      {(["left", "center", "right", "justify"] as const).map((a) => (
        <button
          key={a}
          type="button"
          title={`Paragraph: ${a}`}
          disabled={pIdx == null}
          onClick={() => setParaAlign(a)}
          style={{ ...btnStyle(currentParaAlign === a ? "active" : "normal"), opacity: pIdx == null ? 0.5 : 1 }}
        >
          {a === "left" ? "L" : a === "center" ? "C" : a === "right" ? "R" : "J"}
        </button>
      ))}
      {pIdx != null && currentParaAlign != null && (
        <button type="button" title="Clear paragraph alignment override" onClick={() => setParaAlign(null)} style={btnStyle("normal")}>
          ×
        </button>
      )}
      <label style={labelStyle}>
        ↑Space
        <input
          type="number"
          min={0}
          max={400}
          step={4}
          disabled={pIdx == null}
          value={currentSpaceBefore}
          onChange={(e) => {
            const v = Math.max(0, Math.min(400, Math.floor(Number(e.target.value) || 0)));
            setParaSpace("paragraphSpaceBefore", v || null);
          }}
          style={{ ...inputStyle, width: 56, opacity: pIdx == null ? 0.5 : 1 }}
          title="Space before this paragraph (px)"
        />
      </label>
      <label style={labelStyle}>
        ↓Space
        <input
          type="number"
          min={0}
          max={400}
          step={4}
          disabled={pIdx == null}
          value={currentSpaceAfter}
          onChange={(e) => {
            const v = Math.max(0, Math.min(400, Math.floor(Number(e.target.value) || 0)));
            setParaSpace("paragraphSpaceAfter", v || null);
          }}
          style={{ ...inputStyle, width: 56, opacity: pIdx == null ? 0.5 : 1 }}
          title="Space after this paragraph (px)"
        />
      </label>
      <label style={labelStyle}>
        Leading
        <input
          type="number"
          min={0}
          max={4}
          step={0.05}
          disabled={pIdx == null}
          value={currentLineHeight}
          onChange={(e) => {
            const raw = Number(e.target.value);
            const v = Number.isFinite(raw) ? Math.max(0, Math.min(4, raw)) : 0;
            setParaLineHeight(v > 0 ? v : null);
          }}
          style={{ ...inputStyle, width: 60, opacity: pIdx == null ? 0.5 : 1 }}
          title="Line-height multiplier for this paragraph (0 = inherit block default)"
        />
      </label>
    </>
  );
}

function ImageControls({ block, onChange }: { block: Extract<CustomBlock, { kind: "image" }>; onChange: (p: Partial<CustomBlock>) => void }) {
  const ctx = useLayoutEdit();
  const global = useSnapSettings();
  const snap = ctx?.snapSettings ?? global;
  return (
    <>
      <label style={btnStyle("normal")}>
        Upload
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => onChange({ imageUrl: String(r.result) });
            r.readAsDataURL(f);
          }}
        />
      </label>
      <select value={block.imageFit ?? "cover"} onChange={(e) => onChange({ imageFit: e.target.value as "cover" | "contain" })} style={inputStyle}>
        <option value="cover">Cover</option>
        <option value="contain">Contain</option>
      </select>
      <label style={labelStyle}>
        Rotate
        <input type="number" min={-180} max={180} value={block.rotate ?? 0} onChange={(e) => onChange({ rotate: snapRotationWith(Number(e.target.value), snap) })} style={{ ...inputStyle, width: 56 }} />
      </label>
      <label style={labelStyle}>
        Border
        <input type="number" min={0} max={200} value={block.borderWidth ?? 0} onChange={(e) => onChange({ borderWidth: Number(e.target.value) })} style={{ ...inputStyle, width: 56 }} />
      </label>
      {(block.borderWidth ?? 0) > 0 && (
        <label style={labelStyle}>
          Color
          <input type="color" value={block.borderColor ?? "#ffffff"} onChange={(e) => onChange({ borderColor: e.target.value })} style={{ width: 28, height: 24, padding: 0, border: "1px solid #ddd" }} />
        </label>
      )}
      {block.imageUrl && (
        <button type="button" onClick={() => onChange({ imageUrl: "" })} style={btnStyle("normal")}>
          Clear
        </button>
      )}
    </>
  );
}

function VideoControls({ block, onChange }: { block: Extract<CustomBlock, { kind: "video" }>; onChange: (p: Partial<CustomBlock>) => void }) {
  const ctx = useLayoutEdit();
  const global = useSnapSettings();
  const snap = ctx?.snapSettings ?? global;
  return (
    <>
      <label style={labelStyle}>
        URL
        <input
          type="text"
          placeholder="YouTube, Vimeo, or .mp4 link"
          value={block.url}
          onChange={(e) => onChange({ url: e.target.value })}
          style={{ ...inputStyle, width: 280 }}
        />
      </label>
      <button type="button" onClick={() => onChange({ muted: !block.muted })} style={btnStyle(block.muted ? "active" : "normal")}>
        {block.muted ? "Muted" : "Sound"}
      </button>
      <button type="button" onClick={() => onChange({ autoplay: !block.autoplay })} style={btnStyle(block.autoplay ? "active" : "normal")}>
        Autoplay
      </button>
      <button type="button" onClick={() => onChange({ loop: !block.loop })} style={btnStyle(block.loop ? "active" : "normal")}>
        Loop
      </button>
      <label style={labelStyle}>
        Rotate
        <input type="number" min={-180} max={180} value={block.rotate ?? 0} onChange={(e) => onChange({ rotate: snapRotationWith(Number(e.target.value), snap) })} style={{ ...inputStyle, width: 56 }} />
      </label>
    </>
  );
}

function ShapeControls({ block, onChange }: { block: Extract<CustomBlock, { kind: "shape" }>; onChange: (p: Partial<CustomBlock>) => void }) {
  return (
    <>
      <select value={block.shape} onChange={(e) => onChange({ shape: e.target.value as "rect" | "line" })} style={inputStyle}>
        <option value="rect">Rectangle</option>
        <option value="line">Line / divider</option>
      </select>
      {block.shape === "rect" && (
        <label style={labelStyle}>
          Fill
          <input type="color" value={block.fill && block.fill !== "transparent" ? block.fill : "#ffffff"} onChange={(e) => onChange({ fill: e.target.value })} style={{ width: 28, height: 24, padding: 0, border: "1px solid #ddd" }} />
        </label>
      )}
      <label style={labelStyle}>
        Stroke
        <input type="color" value={block.stroke ?? "#0a0a0a"} onChange={(e) => onChange({ stroke: e.target.value })} style={{ width: 28, height: 24, padding: 0, border: "1px solid #ddd" }} />
      </label>
      <label style={labelStyle}>
        Width
        <input type="number" min={0} max={40} value={block.strokeWidth ?? 4} onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })} style={{ ...inputStyle, width: 50 }} />
      </label>
    </>
  );
}

function EmbedControls({ block, onChange }: { block: Extract<CustomBlock, { kind: "embed" }>; onChange: (p: Partial<CustomBlock>) => void }) {
  return (
    <>
      <select value={block.embed} onChange={(e) => onChange({ embed: e.target.value as "qr" | "button" })} style={inputStyle}>
        <option value="qr">QR code</option>
        <option value="button">Link button</option>
      </select>
      <label style={labelStyle}>
        URL
        <input type="text" value={block.url} onChange={(e) => onChange({ url: e.target.value })} style={{ ...inputStyle, width: 220 }} />
      </label>
      {block.embed === "button" && (
        <label style={labelStyle}>
          Label
          <input type="text" value={block.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} style={{ ...inputStyle, width: 120 }} />
        </label>
      )}
      <label style={labelStyle}>
        Color
        <input type="color" value={block.color ?? "#0a0a0a"} onChange={(e) => onChange({ color: e.target.value })} style={{ width: 28, height: 24, padding: 0, border: "1px solid #ddd" }} />
      </label>
      <label style={labelStyle}>
        Bg
        <input type="color" value={block.bg ?? "#ffffff"} onChange={(e) => onChange({ bg: e.target.value })} style={{ width: 28, height: 24, padding: 0, border: "1px solid #ddd" }} />
      </label>
    </>
  );
}

function LinkControl({ link, onChange }: { link?: string; onChange: (v: string | null) => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        const next = window.prompt("Link URL (leave blank to remove):", link ?? "");
        if (next === null) return;
        const trimmed = next.trim();
        onChange(trimmed ? trimmed : null);
      }}
      style={btnStyle(link ? "active" : "normal")}
    >
      <Link2 size={12} />
      {link ? "Linked" : "Link"}
    </button>
  );
}

const inputStyle: CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 3,
  padding: "3px 6px",
  fontSize: 12,
  background: "white",
  color: "#0a0a0a",
};
const labelStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#444" };
function btnStyle(variant: "normal" | "active" | "danger"): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 8px",
    border: variant === "danger" ? "1px solid #dc2626" : variant === "active" ? "1px solid #2563eb" : "1px solid #ddd",
    background: variant === "danger" ? "white" : variant === "active" ? "#2563eb" : "white",
    color: variant === "danger" ? "#dc2626" : variant === "active" ? "white" : "#0a0a0a",
    borderRadius: 3,
    fontSize: 12,
    cursor: "pointer",
  };
}
