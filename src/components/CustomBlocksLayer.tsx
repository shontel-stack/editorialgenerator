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
import { Plus, Type as TypeIcon, Image as ImageIcon, Square, Circle, Minus, Link2, Trash2, QrCode, LayoutGrid, Film, X, Settings2, RotateCw, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignStartVertical, AlignCenterVertical, AlignEndVertical, Layers, Eye, EyeOff, Undo2, Redo2 } from "lucide-react";
import type { CustomBlock, ContentsSlot, ContentsSlotField } from "@/lib/coverDefaults";
import { resolveTextTokens } from "@/lib/coverDefaults";
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

/** Resolve a text block's `fontFamily` to a CSS `font-family` value.
 *  Supports the 3 system slots and `custom:<brand-font-id>` tokens. */
function resolveFontFamily(
  value: string | undefined,
  resolveCustom: (id: string) => string | null,
): string {
  const v = value ?? "serif";
  if (v.startsWith("custom:")) {
    const id = v.slice("custom:".length);
    const css = resolveCustom(id);
    if (css) return `'${css}', var(--font-serif)`;
    return "var(--font-serif)";
  }
  if (v === "display" || v === "serif" || v === "sans") return FONT_VARS[v];
  return "var(--font-serif)";
}

type ShapeVariant = "rect" | "ellipse" | "line";

function defaultBlock(kind: CustomBlock["kind"], opts?: { shape?: ShapeVariant }): CustomBlock {
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
    case "shape": {
      const variant = opts?.shape ?? "rect";
      if (variant === "line") {
        return { ...base, kind: "shape", w: 1200, h: 40, shape: "line", fill: "transparent", stroke: "#6b1320", strokeWidth: 6 };
      }
      if (variant === "ellipse") {
        return { ...base, kind: "shape", w: 800, h: 800, shape: "ellipse", fill: "#6b1320", stroke: "transparent", strokeWidth: 0 };
      }
      return { ...base, kind: "shape", w: 1000, h: 700, shape: "rect", fill: "#6b1320", stroke: "transparent", strokeWidth: 0 };
    }
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
    (kind: CustomBlock["kind"], opts?: { shape?: ShapeVariant }) => {
      if (!setBlocks) return;
      if (!editing) requestEdit?.();
      const b = defaultBlock(kind, opts);
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

  // ----- Undo / Redo: debounced snapshots of the blocks array -----
  const undoStack = useRef<CustomBlock[][]>([]);
  const redoStack = useRef<CustomBlock[][]>([]);
  const lastSnapshot = useRef<CustomBlock[] | null>(null);
  const skipHistory = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  useEffect(() => {
    if (skipHistory.current) {
      skipHistory.current = false;
      lastSnapshot.current = blocks;
      return;
    }
    if (lastSnapshot.current === null) {
      lastSnapshot.current = blocks;
      return;
    }
    if (lastSnapshot.current === blocks) return;
    const prev = lastSnapshot.current;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      undoStack.current.push(prev);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
      lastSnapshot.current = blocks;
      setHistoryTick((t) => t + 1);
    }, 350);
  }, [blocks]);
  const undo = useCallback(() => {
    if (!setBlocks) return;
    // Flush any pending snapshot first so the latest edit is undoable.
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      if (lastSnapshot.current && lastSnapshot.current !== blocks) {
        undoStack.current.push(lastSnapshot.current);
        lastSnapshot.current = blocks;
      }
    }
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(blocks);
    skipHistory.current = true;
    setBlocks(prev);
    setHistoryTick((t) => t + 1);
  }, [blocks, setBlocks]);
  const redo = useCallback(() => {
    if (!setBlocks) return;
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(blocks);
    skipHistory.current = true;
    setBlocks(next);
    setHistoryTick((t) => t + 1);
  }, [blocks, setBlocks]);

  // Keyboard shortcuts: Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z (or Ctrl+Y) while editing.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName ?? "").toUpperCase();
      const editable = target?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (editable) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, undo, redo]);
  void historyTick;

  // ----- Layers panel state -----
  const [layersOpen, setLayersOpen] = useState(false);

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

      {blocks.map((b) => {
        // Hidden blocks: skip entirely outside edit mode (so they don't print).
        // While editing, keep them visible at reduced opacity so the user can find them via the Layers panel.
        if (b.hidden && !editing) return null;
        return (
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
        );
      })}

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
      {editing && setBlocks && (
        <HistoryToolbar
          canUndo={undoStack.current.length > 0}
          canRedo={redoStack.current.length > 0}
          onUndo={undo}
          onRedo={redo}
          layersOpen={layersOpen}
          onToggleLayers={() => setLayersOpen((v) => !v)}
        />
      )}
      {editing && setBlocks && layersOpen && (
        <LayersPanel
          blocks={blocks}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onRename={(id, name) => setBlocks(blocks.map((b) => (b.id === id ? ({ ...b, name } as CustomBlock) : b)))}
          onToggleHidden={(id) => setBlocks(blocks.map((b) => (b.id === id ? ({ ...b, hidden: !b.hidden } as CustomBlock) : b)))}
          onReorder={reorder}
          onRemove={remove}
          onClose={() => setLayersOpen(false)}
        />
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
  type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
  const dragRef = useRef<{ mode: "move" | "resize"; handle?: ResizeHandle; aspect: number; shift: boolean; x: number; y: number; box: { x: number; y: number; w: number; h: number } } | null>(null);
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

  const startDrag = (mode: "move" | "resize", e: RPointerEvent<HTMLDivElement>, handle?: ResizeHandle) => {
    if (!editing || editingText) return;
    e.preventDefault();
    e.stopPropagation();
    const box = { x: block.x, y: block.y, w: block.w, h: block.h };
    dragRef.current = {
      mode,
      handle,
      aspect: box.w / Math.max(1, box.h),
      shift: e.shiftKey,
      x: e.clientX,
      y: e.clientY,
      box,
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
    if (e.shiftKey) next = Math.round(next / 15) * 15;
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

  /** Compute a resized box given the active handle, pointer delta, and shift-lock state. */
  const computeResize = (handle: ResizeHandle | undefined, dx: number, dy: number, shift: boolean) => {
    const box = dragRef.current!.box;
    const aspect = dragRef.current!.aspect;
    const minW = 80;
    const minH = 40;
    const h = handle ?? "se";
    const east = h.includes("e");
    const west = h.includes("w");
    const south = h.includes("s");
    const north = h.includes("n");
    let nx = box.x;
    let ny = box.y;
    let nw = box.w;
    let nh = box.h;
    if (east) nw = Math.max(minW, box.w + dx);
    if (west) { nw = Math.max(minW, box.w - dx); nx = box.x + (box.w - nw); }
    if (south) nh = Math.max(minH, box.h + dy);
    if (north) { nh = Math.max(minH, box.h - dy); ny = box.y + (box.h - nh); }
    // Shift = preserve aspect ratio (corner = both axes; edge = lock the other axis)
    if (shift) {
      const isCorner = (east || west) && (north || south);
      if (isCorner) {
        // Use the larger relative change as the dominant axis
        const rw = nw / box.w;
        const rh = nh / box.h;
        if (Math.abs(rw - 1) >= Math.abs(rh - 1)) {
          nh = Math.max(minH, nw / aspect);
        } else {
          nw = Math.max(minW, nh * aspect);
        }
        if (west) nx = box.x + (box.w - nw);
        if (north) ny = box.y + (box.h - nh);
      } else if (east || west) {
        nh = Math.max(minH, nw / aspect);
        if (north) ny = box.y + (box.h - nh);
      } else if (north || south) {
        nw = Math.max(minW, nh * aspect);
        if (west) nx = box.x + (box.w - nw);
      }
    }
    return { x: nx, y: ny, w: nw, h: nh, east, west, north, south };
  };

  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current.shift = e.shiftKey;
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
      const r = computeResize(dragRef.current.handle, dx, dy, e.shiftKey);
      // Snap the moving edges to guides
      const rightEdge = r.x + r.w;
      const bottomEdge = r.y + r.h;
      const sxR = r.east ? snapX(rightEdge) : { delta: 0, match: null as number | null };
      const sxL = r.west ? snapX(r.x) : { delta: 0, match: null as number | null };
      const syB = r.south ? snapY(bottomEdge) : { delta: 0, match: null as number | null };
      const syT = r.north ? snapY(r.y) : { delta: 0, match: null as number | null };
      let nx = r.x, ny = r.y, nw = r.w, nh = r.h;
      if (sxR.delta) nw = Math.max(80, nw + sxR.delta);
      if (sxL.delta) { nw = Math.max(80, nw - sxL.delta); nx = nx + sxL.delta; }
      if (syB.delta) nh = Math.max(40, nh + syB.delta);
      if (syT.delta) { nh = Math.max(40, nh - syT.delta); ny = ny + syT.delta; }
      onChange({ x: nx, y: ny, w: nw, h: nh });
      const xs: number[] = [];
      const ys: number[] = [];
      if (sxR.match !== null) xs.push(sxR.match);
      if (sxL.match !== null) xs.push(sxL.match);
      if (syB.match !== null) ys.push(syB.match);
      if (syT.match !== null) ys.push(syT.match);
      onActiveLines?.({ xs, ys });
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
      const r = computeResize(dragRef.current.handle, dx, dy, e.shiftKey || dragRef.current.shift);
      onChange({ x: snap(r.x), y: snap(r.y), w: snap(r.w), h: snap(r.h) });
    }
    dragRef.current = null;
    onActiveLines?.({ xs: [], ys: [] });
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };


  const rotate = (block as { rotate?: number }).rotate ?? 0;
  const sx = block.kind === "image" ? (block.skewX ?? 0) : 0;
  const sy = block.kind === "image" ? (block.skewY ?? 0) : 0;
  const transformParts: string[] = [];
  if (rotate) transformParts.push(`rotate(${rotate}deg)`);
  if (sx || sy) transformParts.push(`skew(${sx}deg, ${sy}deg)`);
  const wrapper: CSSProperties = {
    position: "absolute",
    left: block.x,
    top: block.y,
    width: block.w,
    height: block.h,
    zIndex: block.z ?? 50,
    boxSizing: "border-box",
    transform: transformParts.length ? transformParts.join(" ") : undefined,
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
      onChange={onChange}
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
          {/* 8 resize handles (corners + edge midpoints). Hold Shift to keep aspect ratio. */}
          {([
            { h: "nw" as const, top: -6 as number | string | undefined, left: -6 as number | string | undefined, right: undefined as number | undefined, bottom: undefined as number | undefined, cursor: "nwse-resize", origin: "top left", center: "" as "" | "x" | "y" },
            { h: "ne" as const, top: -6, left: undefined, right: -6, bottom: undefined, cursor: "nesw-resize", origin: "top right", center: "" },
            { h: "sw" as const, top: undefined, left: -6, right: undefined, bottom: -6, cursor: "nesw-resize", origin: "bottom left", center: "" },
            { h: "se" as const, top: undefined, left: undefined, right: -6, bottom: -6, cursor: "nwse-resize", origin: "bottom right", center: "" },
            { h: "n" as const, top: -6, left: "50%", right: undefined, bottom: undefined, cursor: "ns-resize", origin: "top center", center: "x" as const },
            { h: "s" as const, top: undefined, left: "50%", right: undefined, bottom: -6, cursor: "ns-resize", origin: "bottom center", center: "x" as const },
            { h: "w" as const, top: "50%", left: -6, right: undefined, bottom: undefined, cursor: "ew-resize", origin: "center left", center: "y" as const },
            { h: "e" as const, top: "50%", left: undefined, right: -6, bottom: undefined, cursor: "ew-resize", origin: "center right", center: "y" as const },
          ]).map((hd) => (
            <div
              key={hd.h}
              title="Resize (Shift = keep aspect ratio)"
              onPointerDown={(e) => startDrag("resize", e, hd.h)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              style={{
                position: "absolute",
                top: hd.top,
                bottom: hd.bottom,
                left: hd.left,
                right: hd.right,
                width: 12,
                height: 12,
                background: "white",
                border: "2px solid #2563eb",
                borderRadius: 3,
                cursor: hd.cursor,
                zIndex: 200,
                transform: `${hd.center === "x" ? "translateX(-50%) " : hd.center === "y" ? "translateY(-50%) " : ""}scale(${inv})`,
                transformOrigin: hd.origin,
                touchAction: "none",
              }}
            />
          ))}
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
  onChange,
}: {
  block: CustomBlock;
  editingText: boolean;
  onTextChange: (text: string) => void;
  stopEditingText: () => void;
  onCaretParagraphChange?: (n: number | null) => void;
  onChange?: (patch: Partial<CustomBlock>) => void;
}) {
  const brandKit = useBrandKit();
  const editCtx = useLayoutEdit();
  const tokens = editCtx?.tokenContext;
  const slotResolved = editCtx?.contentsSlotResolved;
  // Resolve slot-bound text. Returns null when no binding, '' when binding
  // exists but the slot is empty (lets us still show the placeholder text
  // typed in the block while editing).
  const resolveSlotText = (binding: { slotId: string; field: "headline" | "byline" | "pageNumber" | "image" } | undefined): string | null => {
    if (!binding || !slotResolved) return null;
    const slot = slotResolved[binding.slotId];
    if (!slot) return "";
    if (binding.field === "headline") return slot.headline;
    if (binding.field === "byline") return slot.byline;
    if (binding.field === "pageNumber") return slot.pageNumber;
    return "";
  };
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
      fontFamily: resolveFontFamily(block.fontFamily, brandKit.resolveFontCssFamily),
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
    const slotText = resolveSlotText(block.slotBinding);
    const baseText = slotText != null ? slotText : block.text;
    const rawText = tokens ? resolveTextTokens(baseText, tokens) : baseText;
    const paragraphs = rawText.split("\n");
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
    // Resolve slot-bound image URL when applicable.
    const slotImg =
      block.slotBinding && block.slotBinding.field === "image" && slotResolved
        ? slotResolved[block.slotBinding.slotId]?.imageUrl ?? ""
        : null;
    const effectiveUrl = slotImg != null ? slotImg : block.imageUrl;
    const frame = block.frameShape ?? "rect";
    const clipPath = (() => {
      if (frame === "ellipse") return "ellipse(50% 50% at 50% 50%)";
      if (frame === "polygon") {
        const n = Math.max(3, Math.min(12, Math.round(block.polygonSides ?? 6)));
        const pts: string[] = [];
        for (let i = 0; i < n; i++) {
          const a = (Math.PI * 2 * i) / n - Math.PI / 2;
          const x = 50 + 50 * Math.cos(a);
          const y = 50 + 50 * Math.sin(a);
          pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
        }
        return `polygon(${pts.join(", ")})`;
      }
      if (frame === "path" && block.clipPath) {
        return `path('${block.clipPath.replace(/'/g, "\\'")}')`;
      }
      return undefined;
    })();
    const radiusStyle =
      frame === "rect" && block.cornerRadius
        ? { borderRadius: `${block.cornerRadius}px`, overflow: "hidden" as const }
        : {};
    if (!effectiveUrl) {
      return (
        <label
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: "repeating-linear-gradient(45deg, #eee 0 16px, #ddd 16px 32px)",
            color: "#555",
            fontFamily: "var(--font-sans)",
            fontSize: 18,
            letterSpacing: 2,
            textTransform: "uppercase",
            boxSizing: "border-box",
            cursor: onChange ? "pointer" : "default",
            clipPath,
            ...borderStyle,
            ...radiusStyle,
          }}
        >
          <ImageIcon size={28} />
          <span>{slotImg != null ? "Slot empty" : "Click to upload"}</span>
          {onChange && slotImg == null && (
            <input
              type="file"
              accept="image/*"
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const r = new FileReader();
                r.onload = () => onChange({ imageUrl: String(r.result) } as Partial<CustomBlock>);
                r.onerror = () => console.error("Failed to read image", r.error);
                r.readAsDataURL(f);
              }}
            />
          )}
        </label>
      );
    }
    return (
      <div style={{ width: "100%", height: "100%", boxSizing: "border-box", clipPath, ...borderStyle, ...radiusStyle }}>
        <img src={effectiveUrl} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: block.imageFit ?? "cover", display: "block" }} />
      </div>
    );
  }
  if (block.kind === "shape") {
    const opacity = block.opacity ?? 1;
    if (block.shape === "line") {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderTop: `${block.strokeWidth ?? 4}px solid ${block.stroke ?? "#0a0a0a"}`,
            opacity,
          }}
        />
      );
    }
    const radius =
      block.shape === "ellipse"
        ? "50%"
        : block.cornerRadius
          ? `${block.cornerRadius}px`
          : undefined;
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: block.fill ?? "transparent",
          border: block.strokeWidth ? `${block.strokeWidth}px solid ${block.stroke ?? "#0a0a0a"}` : "none",
          borderRadius: radius,
          opacity,
          boxSizing: "border-box",
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
  const linkUrl = (block.link ?? "").trim() || url;
  if (embed) {
    return (
      <iframe
        src={embed}
        title="Video"
        data-video-link={linkUrl}
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
      data-video-link={linkUrl}
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

function useDragOffset(inv: number, storageKey?: string) {
  const [offset, setOffset] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined" || !storageKey) return { x: 0, y: 0 };
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return { x: 0, y: 0 };
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      return { x: Number(parsed.x) || 0, y: Number(parsed.y) || 0 };
    } catch {
      return { x: 0, y: 0 };
    }
  });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const persist = (next: { x: number; y: number }) => {
    setOffset(next);
    if (storageKey && typeof window !== "undefined") {
      try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* noop */ }
    }
  };
  const onPointerDown = (e: RPointerEvent<HTMLElement>) => {
    e.stopPropagation();
    e.preventDefault();
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: RPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const dx = (e.clientX - drag.current.x) * inv;
    const dy = (e.clientY - drag.current.y) * inv;
    setOffset({ x: drag.current.ox + dx, y: drag.current.oy + dy });
  };
  const onPointerUp = (e: RPointerEvent<HTMLElement>) => {
    if (drag.current) persist({ x: offset.x, y: offset.y });
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };
  return { offset, dragHandleProps: { onPointerDown, onPointerMove, onPointerUp, style: { cursor: "grab", touchAction: "none" as const } } };
}


const DRAG_GRIP_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  paddingLeft: 4,
  paddingRight: 6,
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#666",
  userSelect: "none",
};

function AddElementPalette({ onAdd, onOpenTemplates }: { onAdd: (kind: CustomBlock["kind"], opts?: { shape?: ShapeVariant }) => void; onOpenTemplates: () => void }) {
  const ctx = useLayoutEdit();
  const inv = 1 / (ctx?.scale ?? 1);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const { offset, dragHandleProps } = useDragOffset(inv, "pageluxe:addPalette:offset");

  return (
    <>
      <div
        data-export-ignore="true"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${inv})`,
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
        <span {...dragHandleProps} title="Drag to move" style={{ ...DRAG_GRIP_STYLE, ...dragHandleProps.style }}>
          <Plus size={12} /> Add
        </span>
        <PaletteBtn label="Text" icon={<TypeIcon size={14} />} onClick={() => onAdd("text")} />
        <PaletteBtn label="Image" icon={<ImageIcon size={14} />} onClick={() => onAdd("image")} />
        <PaletteBtn label="Video" icon={<Film size={14} />} onClick={() => onAdd("video")} />
        <PaletteBtn label="Rectangle" icon={<Square size={14} />} onClick={() => onAdd("shape", { shape: "rect" })} />
        <PaletteBtn label="Ellipse" icon={<Circle size={14} />} onClick={() => onAdd("shape", { shape: "ellipse" })} />
        <PaletteBtn label="Line" icon={<Minus size={14} />} onClick={() => onAdd("shape", { shape: "line" })} />
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
  const { offset, dragHandleProps } = useDragOffset(inv, "pageluxe:blockToolbar:offset");
  return (
    <div
      data-export-ignore="true"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        bottom: 24,
        left: 24,
        maxWidth: "calc(100% - 48px)",
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${inv})`,
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
      <span {...dragHandleProps} title="Drag to move toolbar" style={{ ...DRAG_GRIP_STYLE, color: "#2563eb", ...dragHandleProps.style }}>⋮⋮ {block.kind}</span>

      {ctx?.contentsSlots && (block.kind === "text" || block.kind === "image") && (
        <SlotBindingControl block={block} onChange={onChange} slots={ctx.contentsSlots} />
      )}
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
  const brandKit = useBrandKit();
  return (
    <>
      <select
        value={block.fontFamily ?? "serif"}
        onChange={(e) => onChange({ fontFamily: e.target.value })}
        style={inputStyle}
      >
        <option value="display">Display</option>
        <option value="serif">Serif</option>
        <option value="sans">Sans</option>
        {brandKit.fonts.length > 0 && (
          <optgroup label="Brand fonts">
            {brandKit.fonts.map((f) => (
              <option key={f.id} value={`custom:${f.id}`}>{f.family_name}</option>
            ))}
          </optgroup>
        )}
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
      <SwatchPicker
        swatches={brandKit.swatches}
        currentHex={block.color ?? "#0a0a0a"}
        onPick={(hex) => onChange({ color: hex })}
        onSave={brandKit.saveSwatch}
        onRemove={brandKit.removeSwatch}
      />
      <label style={labelStyle}>
        BG
        <input type="color" value={block.bg && block.bg.startsWith("#") ? block.bg : "#ffffff"} onChange={(e) => onChange({ bg: e.target.value })} style={{ width: 28, height: 24, padding: 0, border: "1px solid #ddd" }} />
      </label>
      <SwatchPicker
        swatches={brandKit.swatches}
        currentHex={block.bg ?? undefined}
        onPick={(hex) => onChange({ bg: hex })}
        onSave={brandKit.saveSwatch}
        onRemove={brandKit.removeSwatch}
      />
      <button type="button" title="Clear background" onClick={() => onChange({ bg: undefined })} style={btnStyle("normal")}>×BG</button>
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
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <button
        type="button"
        style={btnStyle("normal")}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileRef.current?.click(); }}
      >
        Upload
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const r = new FileReader();
          r.onload = () => onChange({ imageUrl: String(r.result) });
          r.onerror = () => console.error("Failed to read image", r.error);
          r.readAsDataURL(f);
        }}
      />
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
      <div style={{ width: 1, alignSelf: "stretch", background: "#e5e5e5" }} />
      <label style={labelStyle}>
        Skew X
        <input type="number" min={-60} max={60} value={Math.round(block.skewX ?? 0)} onChange={(e) => onChange({ skewX: Number(e.target.value) })} style={{ ...inputStyle, width: 56 }} />
      </label>
      <label style={labelStyle}>
        Skew Y
        <input type="number" min={-60} max={60} value={Math.round(block.skewY ?? 0)} onChange={(e) => onChange({ skewY: Number(e.target.value) })} style={{ ...inputStyle, width: 56 }} />
      </label>
      <label style={labelStyle}>
        Shape
        <select
          value={block.frameShape ?? "rect"}
          onChange={(e) => onChange({ frameShape: e.target.value as "rect" | "ellipse" | "polygon" | "path" })}
          style={inputStyle}
        >
          <option value="rect">Rectangle</option>
          <option value="ellipse">Ellipse</option>
          <option value="polygon">Polygon</option>
          <option value="path">Custom path</option>
        </select>
      </label>
      {(block.frameShape ?? "rect") === "rect" && (
        <label style={labelStyle}>
          Radius
          <input type="number" min={0} max={2000} value={block.cornerRadius ?? 0} onChange={(e) => onChange({ cornerRadius: Number(e.target.value) })} style={{ ...inputStyle, width: 60 }} />
        </label>
      )}
      {block.frameShape === "polygon" && (
        <label style={labelStyle}>
          Sides
          <input type="number" min={3} max={12} value={block.polygonSides ?? 6} onChange={(e) => onChange({ polygonSides: Math.max(3, Math.min(12, Number(e.target.value) || 6)) })} style={{ ...inputStyle, width: 50 }} />
        </label>
      )}
      {block.frameShape === "path" && (
        <label style={labelStyle}>
          Path (0..100)
          <input
            type="text"
            value={block.clipPath ?? ""}
            placeholder="M 50 0 L 100 100 L 0 100 Z"
            onChange={(e) => onChange({ clipPath: e.target.value })}
            style={{ ...inputStyle, width: 200 }}
          />
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
  const ctx = useLayoutEdit();
  const global = useSnapSettings();
  const snap = ctx?.snapSettings ?? global;
  const fillOn = !!block.fill && block.fill !== "transparent";
  const strokeOn = (block.strokeWidth ?? 0) > 0;
  return (
    <>
      <select value={block.shape} onChange={(e) => onChange({ shape: e.target.value as "rect" | "line" | "ellipse" })} style={inputStyle}>
        <option value="rect">Rectangle</option>
        <option value="ellipse">Ellipse / circle</option>
        <option value="line">Line / divider</option>
      </select>
      {block.shape !== "line" && (
        <>
          <button
            type="button"
            onClick={() => onChange({ fill: fillOn ? "transparent" : "#6b1320" })}
            style={btnStyle(fillOn ? "active" : "normal")}
          >
            {fillOn ? "Fill on" : "No fill"}
          </button>
          {fillOn && (
            <label style={labelStyle}>
              Color
              <input type="color" value={block.fill ?? "#6b1320"} onChange={(e) => onChange({ fill: e.target.value })} style={{ width: 28, height: 24, padding: 0, border: "1px solid #ddd" }} />
            </label>
          )}
          {block.shape === "rect" && (
            <label style={labelStyle}>
              Radius
              <input type="number" min={0} max={2000} value={block.cornerRadius ?? 0} onChange={(e) => onChange({ cornerRadius: Math.max(0, Number(e.target.value)) })} style={{ ...inputStyle, width: 64 }} />
            </label>
          )}
        </>
      )}
      <button
        type="button"
        onClick={() => onChange({ strokeWidth: strokeOn ? 0 : (block.shape === "line" ? 6 : 8) })}
        style={btnStyle(strokeOn ? "active" : "normal")}
      >
        {strokeOn ? "Stroke on" : "No stroke"}
      </button>
      {strokeOn && (
        <>
          <label style={labelStyle}>
            Stroke
            <input type="color" value={block.stroke ?? "#0a0a0a"} onChange={(e) => onChange({ stroke: e.target.value })} style={{ width: 28, height: 24, padding: 0, border: "1px solid #ddd" }} />
          </label>
          <label style={labelStyle}>
            Width
            <input type="number" min={1} max={400} value={block.strokeWidth ?? 4} onChange={(e) => onChange({ strokeWidth: Math.max(1, Number(e.target.value)) })} style={{ ...inputStyle, width: 64 }} />
          </label>
        </>
      )}
      <label style={labelStyle}>
        Opacity
        <input
          type="number"
          min={0}
          max={100}
          value={Math.round((block.opacity ?? 1) * 100)}
          onChange={(e) => onChange({ opacity: Math.max(0, Math.min(1, Number(e.target.value) / 100)) })}
          style={{ ...inputStyle, width: 56 }}
        />
      </label>
      <label style={labelStyle}>
        Rotate
        <input type="number" min={-180} max={180} value={block.rotate ?? 0} onChange={(e) => onChange({ rotate: snapRotationWith(Number(e.target.value), snap) })} style={{ ...inputStyle, width: 56 }} />
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

/* — Slot binding picker — shown on text / image blocks when the parent page
   is a custom-contents page. Bound blocks render the slot's resolved value
   (overrides > linked article). */
function SlotBindingControl({
  block,
  onChange,
  slots,
}: {
  block: Extract<CustomBlock, { kind: "text" | "image" }>;
  onChange: (p: Partial<CustomBlock>) => void;
  slots: ContentsSlot[];
}) {
  const binding = block.slotBinding;
  const fields: { value: ContentsSlotField; label: string; for: "text" | "image" }[] = [
    { value: "headline", label: "Headline", for: "text" },
    { value: "byline", label: "Byline", for: "text" },
    { value: "pageNumber", label: "Page #", for: "text" },
    { value: "image", label: "Image", for: "image" },
  ];
  const allowed = fields.filter((f) => f.for === block.kind);
  const value = binding ? `${binding.slotId}::${binding.field}` : "";
  return (
    <label style={labelStyle}>
      Slot
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChange({ slotBinding: undefined } as Partial<CustomBlock>);
            return;
          }
          const [slotId, field] = v.split("::") as [string, ContentsSlotField];
          onChange({ slotBinding: { slotId, field } } as Partial<CustomBlock>);
        }}
        style={inputStyle}
      >
        <option value="">— none —</option>
        {slots.map((s) =>
          allowed.map((f) => (
            <option key={`${s.id}::${f.value}`} value={`${s.id}::${f.value}`}>
              {s.label} · {f.label}
            </option>
          )),
        )}
      </select>
    </label>
  );
}
