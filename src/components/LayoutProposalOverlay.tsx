import { useEffect, useRef, useState } from "react";
import type { LayoutPlanOp } from "@/lib/proposeLayout.functions";

const PAGE_W = 3200;
const PAGE_H = 4267;

type Props = {
  ops: LayoutPlanOp[];
  pageId: string;
  dim: { w: number; h: number };
  /** Optional lookup: attachmentId → file name for image-block labels. */
  libraryLabels?: Record<string, string>;
  /** When provided, ghost rects become drag/resize-able and emit the updated ops array. */
  onOpsChange?: (next: LayoutPlanOp[]) => void;
};

type DragSnap = { idx: number; x: number; y: number; w: number; h: number };
type Drag = {
  mode: "move" | "resize";
  anchorIdx: number;
  startClientX: number;
  startClientY: number;
  snaps: DragSnap[];
};

const DEFAULTS = {
  image: { x: 160, y: 160, w: 1600, h: 1000 },
  text: { x: 160, y: 160, w: 1600, h: 600 },
};

function defaultsFor(op: LayoutPlanOp) {
  return op.kind === "add_image_block" ? DEFAULTS.image : DEFAULTS.text;
}

/**
 * Visual ghost overlay showing where proposed text/image blocks will land
 * on a given page. When `onOpsChange` is set, ghosts can be dragged (body)
 * and resized (bottom-right handle) to fine-tune placement before applying.
 * Supports multi-select (shift/cmd-click) to move/resize/nudge as a group.
 */
export function LayoutProposalOverlay({ ops, pageId, dim, libraryLabels, onOpsChange }: Props) {
  const interactive = typeof onOpsChange === "function";
  const dragRef = useRef<Drag | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const sx = dim.w / PAGE_W;
  const sy = dim.h / PAGE_H;

  // Filter to this page but keep original indices so edits write back correctly.
  const entries = ops
    .map((op, idx) => ({ op, idx }))
    .filter(
      ({ op }) =>
        op.pageId === pageId &&
        (op.kind === "add_image_block" || op.kind === "add_text_block"),
    );

  // Prune selection if ops change and indices disappear.
  useEffect(() => {
    setSelected((sel) => sel.filter((i) => entries.some((e) => e.idx === i)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ops.length, pageId]);

  if (entries.length === 0) return null;

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  const selectionFor = (idx: number, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    setSelected((prev) => {
      if (additive) {
        return prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx];
      }
      return prev.includes(idx) && prev.length > 1 ? prev : [idx];
    });
  };

  const activeGroup = (idx: number): number[] => {
    if (selected.includes(idx) && selected.length > 0) return selected;
    return [idx];
  };

  const snapshot = (group: number[]): DragSnap[] =>
    group.map((i) => {
      const op = ops[i];
      const d = defaultsFor(op);
      return {
        idx: i,
        x: op.x ?? d.x,
        y: op.y ?? d.y,
        w: op.w ?? d.w,
        h: op.h ?? d.h,
      };
    });

  const onPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    opIndex: number,
    mode: "move" | "resize",
  ) => {
    if (!interactive) return;
    e.stopPropagation();
    e.preventDefault();
    // Update selection on body-click; resize handle preserves current selection.
    if (mode === "move") selectionFor(opIndex, e);
    const group = mode === "move"
      ? (selected.includes(opIndex) && selected.length > 1
          ? selected
          : (e.shiftKey || e.metaKey || e.ctrlKey
              ? Array.from(new Set([...selected, opIndex]))
              : [opIndex]))
      : activeGroup(opIndex);
    dragRef.current = {
      mode,
      anchorIdx: opIndex,
      startClientX: e.clientX,
      startClientY: e.clientY,
      snaps: snapshot(group),
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !onOpsChange) return;
    const dxPage = (e.clientX - drag.startClientX) / sx;
    const dyPage = (e.clientY - drag.startClientY) / sy;
    const next = ops.slice();
    if (drag.mode === "move") {
      // Constrain so no block in group leaves the page.
      let cdx = dxPage;
      let cdy = dyPage;
      for (const s of drag.snaps) {
        cdx = clamp(cdx, -s.x, PAGE_W - s.w - s.x);
        cdy = clamp(cdy, -s.y, PAGE_H - s.h - s.y);
      }
      for (const s of drag.snaps) {
        next[s.idx] = {
          ...next[s.idx],
          x: Math.round(s.x + cdx),
          y: Math.round(s.y + cdy),
          w: s.w,
          h: s.h,
        };
      }
    } else {
      for (const s of drag.snaps) {
        const w = Math.round(clamp(s.w + dxPage, 80, PAGE_W - s.x));
        const h = Math.round(clamp(s.h + dyPage, 60, PAGE_H - s.y));
        next[s.idx] = { ...next[s.idx], x: s.x, y: s.y, w, h };
      }
    }
    onOpsChange(next);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
    dragRef.current = null;
  };

  // Selected entries restricted to ones currently visible on this page.
  const selectedEntries = entries.filter((e) => selected.includes(e.idx));
  const canAlign = interactive && selectedEntries.length >= 2;
  const canDistribute = interactive && selectedEntries.length >= 3;

  const snapsFromSelection = () =>
    selectedEntries.map(({ op, idx }) => {
      const d = defaultsFor(op);
      return {
        idx,
        x: op.x ?? d.x,
        y: op.y ?? d.y,
        w: op.w ?? d.w,
        h: op.h ?? d.h,
      };
    });

  const applyAlign = (mode: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => {
    if (!onOpsChange || selectedEntries.length < 2) return;
    const snaps = snapsFromSelection();
    const minX = Math.min(...snaps.map((s) => s.x));
    const maxR = Math.max(...snaps.map((s) => s.x + s.w));
    const minY = Math.min(...snaps.map((s) => s.y));
    const maxB = Math.max(...snaps.map((s) => s.y + s.h));
    const cx = (minX + maxR) / 2;
    const cy = (minY + maxB) / 2;
    const next = ops.slice();
    for (const s of snaps) {
      let nx = s.x;
      let ny = s.y;
      if (mode === "left") nx = minX;
      else if (mode === "right") nx = maxR - s.w;
      else if (mode === "hcenter") nx = Math.round(cx - s.w / 2);
      else if (mode === "top") ny = minY;
      else if (mode === "bottom") ny = maxB - s.h;
      else if (mode === "vcenter") ny = Math.round(cy - s.h / 2);
      next[s.idx] = { ...next[s.idx], x: Math.round(nx), y: Math.round(ny), w: s.w, h: s.h };
    }
    onOpsChange(next);
  };

  const applyDistribute = (axis: "h" | "v") => {
    if (!onOpsChange || selectedEntries.length < 3) return;
    const snaps = snapsFromSelection();
    const sorted = snaps.slice().sort((a, b) => (axis === "h" ? a.x - b.x : a.y - b.y));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSize = sorted.reduce((acc, s) => acc + (axis === "h" ? s.w : s.h), 0);
    const span =
      axis === "h" ? last.x + last.w - first.x : last.y + last.h - first.y;
    const gap = (span - totalSize) / (sorted.length - 1);
    const next = ops.slice();
    let cursor = axis === "h" ? first.x : first.y;
    for (const s of sorted) {
      if (axis === "h") {
        next[s.idx] = { ...next[s.idx], x: Math.round(cursor), y: s.y, w: s.w, h: s.h };
        cursor += s.w + gap;
      } else {
        next[s.idx] = { ...next[s.idx], x: s.x, y: Math.round(cursor), w: s.w, h: s.h };
        cursor += s.h + gap;
      }
    }
    onOpsChange(next);
  };

  const ToolbarBtn = ({
    title,
    onClick,
    disabled,
    children,
  }: {
    title: string;
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: 26,
        height: 24,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: disabled ? "rgba(255,255,255,0.5)" : "white",
        border: "1px solid rgba(15,23,42,0.15)",
        borderRadius: 4,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        fontSize: 12,
        lineHeight: 1,
        color: "rgb(15,23,42)",
      }}
    >
      {children}
    </button>
  );

  return (
    <div
      aria-hidden
      data-export-ignore="true"
      className="absolute inset-0 z-30"
      style={{ pointerEvents: "none" }}
    >
      {canAlign && (
        <div
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            display: "flex",
            gap: 4,
            padding: 6,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(15,23,42,0.15)",
            borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            pointerEvents: "auto",
            alignItems: "center",
            zIndex: 2,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span style={{ fontSize: 10, color: "rgb(71,85,105)", marginRight: 4 }}>
            {selectedEntries.length} selected
          </span>
          <ToolbarBtn title="Align left" onClick={() => applyAlign("left")}>⇤</ToolbarBtn>
          <ToolbarBtn title="Align horizontal center" onClick={() => applyAlign("hcenter")}>↔</ToolbarBtn>
          <ToolbarBtn title="Align right" onClick={() => applyAlign("right")}>⇥</ToolbarBtn>
          <span style={{ width: 1, height: 16, background: "rgba(15,23,42,0.15)" }} />
          <ToolbarBtn title="Align top" onClick={() => applyAlign("top")}>⤒</ToolbarBtn>
          <ToolbarBtn title="Align vertical middle" onClick={() => applyAlign("vcenter")}>↕</ToolbarBtn>
          <ToolbarBtn title="Align bottom" onClick={() => applyAlign("bottom")}>⤓</ToolbarBtn>
          <span style={{ width: 1, height: 16, background: "rgba(15,23,42,0.15)" }} />
          <ToolbarBtn
            title="Distribute horizontally (3+)"
            onClick={() => applyDistribute("h")}
            disabled={!canDistribute}
          >
            ⇿
          </ToolbarBtn>
          <ToolbarBtn
            title="Distribute vertically (3+)"
            onClick={() => applyDistribute("v")}
            disabled={!canDistribute}
          >
            ⇳
          </ToolbarBtn>
        </div>
      )}
      {entries.map(({ op, idx }) => {
        const d = defaultsFor(op);
        const px = (op.x ?? d.x) * sx;
        const py = (op.y ?? d.y) * sy;
        const pw = (op.w ?? d.w) * sx;
        const ph = (op.h ?? d.h) * sy;
        const isImage = op.kind === "add_image_block";
        const isSelected = selected.includes(idx);
        const tint = isImage ? "rgba(225, 29, 72, 0.14)" : "rgba(37, 99, 235, 0.12)";
        const border = isImage ? "rgb(225, 29, 72)" : "rgb(37, 99, 235)";
        const label = isImage
          ? `Image · ${libraryLabels?.[op.attachmentId ?? ""] ?? "library item"}`
          : `Text · ${(op.text ?? "").slice(0, 40)}${(op.text ?? "").length > 40 ? "…" : ""}`;
        return (
          <div
            key={idx}
            tabIndex={interactive ? 0 : -1}
            onPointerDown={(e) => onPointerDown(e, idx, "move")}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={(e) => {
              if (!interactive || !onOpsChange) return;
              const step = e.shiftKey ? 40 : 8;
              let dx = 0;
              let dy = 0;
              if (e.key === "ArrowLeft") dx = -step;
              else if (e.key === "ArrowRight") dx = step;
              else if (e.key === "ArrowUp") dy = -step;
              else if (e.key === "ArrowDown") dy = step;
              else return;
              e.preventDefault();
              e.stopPropagation();
              const group = activeGroup(idx);
              const snaps = snapshot(group);
              let cdx = dx;
              let cdy = dy;
              for (const s of snaps) {
                cdx = clamp(cdx, -s.x, PAGE_W - s.w - s.x);
                cdy = clamp(cdy, -s.y, PAGE_H - s.h - s.y);
              }
              const next = ops.slice();
              for (const s of snaps) {
                next[s.idx] = {
                  ...next[s.idx],
                  x: Math.round(s.x + cdx),
                  y: Math.round(s.y + cdy),
                  w: s.w,
                  h: s.h,
                };
              }
              onOpsChange(next);
            }}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: pw,
              height: ph,
              background: tint,
              border: `${isSelected ? 2.5 : 1.5}px ${isSelected ? "solid" : "dashed"} ${border}`,
              borderRadius: 4,
              boxShadow: isSelected
                ? `0 0 0 2px rgba(255,255,255,0.9) inset, 0 0 0 1px ${border}`
                : `0 0 0 1px rgba(255,255,255,0.6) inset`,
              pointerEvents: interactive ? "auto" : "none",
              cursor: interactive ? "move" : "default",
              touchAction: "none",
              outline: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -18,
                left: 0,
                fontSize: 10,
                lineHeight: "16px",
                padding: "0 6px",
                background: border,
                color: "white",
                borderRadius: 3,
                whiteSpace: "nowrap",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                pointerEvents: "none",
              }}
            >
              {isSelected && selected.length > 1 ? `◉ ${label}` : label}
            </div>
            {!isImage && op.text && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: 6,
                  color: "rgba(30, 64, 175, 0.85)",
                  fontFamily: "Georgia, serif",
                  fontSize: Math.max(8, Math.min(14, (op.fontSize ?? 28) * sx)),
                  textAlign: op.align ?? "left",
                  overflow: "hidden",
                  pointerEvents: "none",
                }}
              >
                {op.text}
              </div>
            )}
            {interactive && (
              <div
                onPointerDown={(e) => onPointerDown(e, idx, "resize")}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{
                  position: "absolute",
                  right: -6,
                  bottom: -6,
                  width: 14,
                  height: 14,
                  background: "white",
                  border: `1.5px solid ${border}`,
                  borderRadius: 2,
                  cursor: "nwse-resize",
                  touchAction: "none",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
