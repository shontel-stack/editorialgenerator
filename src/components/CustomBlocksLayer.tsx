import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
} from "react";
import QRCode from "qrcode";
import { Plus, Type as TypeIcon, Image as ImageIcon, Square, Link2, Trash2, QrCode, LayoutGrid, Film, X } from "lucide-react";
import type { CustomBlock } from "@/lib/coverDefaults";
import { LAYOUT_TEMPLATES, TEMPLATE_CATEGORIES, type LayoutTemplate } from "@/lib/layoutTemplates";
import { useLayoutEdit } from "./LayoutEdit";

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

/** Snap a rotation angle (degrees) to the nearest common angle when close. */
const ROTATION_SNAPS = [-180, -135, -90, -45, 0, 15, 30, 45, 60, 90, 120, 135, 180];
const ROTATION_THRESHOLD = 4; // degrees
function snapRotation(deg: number): number {
  for (const a of ROTATION_SNAPS) {
    if (Math.abs(deg - a) <= ROTATION_THRESHOLD) return a;
  }
  return deg;
}

const FONT_VARS: Record<"display" | "serif" | "sans", string> = {
  display: "var(--font-display)",
  serif: "var(--font-serif)",
  sans: "var(--font-sans)",
};

function defaultBlock(kind: CustomBlock["kind"]): CustomBlock {
  const id = newId();
  const base = { id, x: 600, y: 600, z: 50 } as const;
  switch (kind) {
    case "text":
      return { ...base, kind: "text", w: 1200, h: 240, text: "Double-click to edit", fontFamily: "serif", fontSize: 60, align: "left", color: "#0a0a0a" };
    case "image":
      return { ...base, kind: "image", w: 1200, h: 1200, imageUrl: "", imageFit: "cover" };
    case "shape":
      return { ...base, kind: "shape", w: 1200, h: 40, shape: "line", fill: "transparent", stroke: "#6b1320", strokeWidth: 6 };
    case "embed":
      return { ...base, kind: "embed", w: 480, h: 160, embed: "button", url: "https://", label: "Read more", color: "#ffffff", bg: "#6b1320" };
    case "video":
      return { ...base, kind: "video", w: 1600, h: 900, url: "", muted: true };
  }
}

export function CustomBlocksLayer() {
  const ctx = useLayoutEdit();
  const editing = ctx?.editing ?? false;
  const blocks = ctx?.customBlocks ?? [];
  const setBlocks = ctx?.setCustomBlocks;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  // Clear selection when leaving edit mode
  useEffect(() => {
    if (!editing) setSelectedId(null);
  }, [editing]);

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
  const add = useCallback(
    (kind: CustomBlock["kind"]) => {
      if (!setBlocks) return;
      const b = defaultBlock(kind);
      setBlocks([...blocks, b]);
      setSelectedId(b.id);
    },
    [blocks, setBlocks],
  );
  const insertTemplate = useCallback(
    (tpl: LayoutTemplate) => {
      if (!setBlocks) return;
      const baseZ = blocks.reduce((m, b) => Math.max(m, b.z ?? 50), 50);
      const fresh = tpl.build().map((b, i) => ({ ...b, z: baseZ + 1 + i } as CustomBlock));
      setBlocks([...blocks, ...fresh]);
      setSelectedId(fresh[0]?.id ?? null);
    },
    [blocks, setBlocks],
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      {blocks.map((b) => (
        <CustomBlockView
          key={b.id}
          block={b}
          editing={editing}
          selected={selectedId === b.id}
          onSelect={() => setSelectedId(b.id)}
          onChange={(p) => update(b.id, p)}
          onRemove={() => remove(b.id)}
        />
      ))}
      {editing && setBlocks && <AddElementPalette onAdd={add} onOpenTemplates={() => setPickerOpen(true)} />}
      {editing && selected && setBlocks && (
        <BlockToolbar block={selected} onChange={(p) => update(selected.id, p)} onRemove={() => remove(selected.id)} />
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
}: {
  block: CustomBlock;
  editing: boolean;
  selected: boolean;
  onSelect: () => void;
  onChange: (p: Partial<CustomBlock>) => void;
  onRemove: () => void;
}) {
  const ctx = useLayoutEdit();
  const pageScale = ctx?.scale ?? 1;
  const dragRef = useRef<{ mode: "move" | "resize"; x: number; y: number; box: { x: number; y: number; w: number; h: number } } | null>(null);
  const [editingText, setEditingText] = useState(false);

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
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const s = pageScale || 1;
    const dx = (e.clientX - dragRef.current.x) / s;
    const dy = (e.clientY - dragRef.current.y) / s;
    const g = ctx?.guides;
    if (dragRef.current.mode === "move") {
      let nx = dragRef.current.box.x + dx;
      let ny = dragRef.current.box.y + dy;
      if (g) {
        // Snap leading edge, center, or trailing edge — whichever is closest.
        const w = dragRef.current.box.w;
        const h = dragRef.current.box.h;
        const ax = [
          snapEdge(nx, g.xs, g.threshold),
          snapEdge(nx + w / 2, g.xs, g.threshold),
          snapEdge(nx + w, g.xs, g.threshold),
        ].reduce((a, b) => (Math.abs(b) > 0 && Math.abs(b) < Math.abs(a || g.threshold + 1) ? b : a), 0);
        const ay = [
          snapEdge(ny, g.ys, g.threshold),
          snapEdge(ny + h / 2, g.ys, g.threshold),
          snapEdge(ny + h, g.ys, g.threshold),
        ].reduce((a, b) => (Math.abs(b) > 0 && Math.abs(b) < Math.abs(a || g.threshold + 1) ? b : a), 0);
        nx += ax;
        ny += ay;
      }
      onChange({ x: nx, y: ny });
    } else {
      let nw = Math.max(80, dragRef.current.box.w + dx);
      let nh = Math.max(40, dragRef.current.box.h + dy);
      if (g) {
        // Bottom-right handle: snap the right & bottom edges.
        const right = dragRef.current.box.x + nw;
        const bottom = dragRef.current.box.y + nh;
        const ax = snapEdge(right, g.xs, g.threshold);
        const ay = snapEdge(bottom, g.ys, g.threshold);
        nw = Math.max(80, nw + ax);
        nh = Math.max(40, nh + ay);
      }
      onChange({ w: nw, h: nh });
    }
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const s = pageScale || 1;
    const dx = (e.clientX - dragRef.current.x) / s;
    const dy = (e.clientY - dragRef.current.y) / s;
    const g = ctx?.guides;
    if (dragRef.current.mode === "move") {
      let nx = dragRef.current.box.x + dx;
      let ny = dragRef.current.box.y + dy;
      let usedGuideX = false;
      let usedGuideY = false;
      if (g) {
        const w = dragRef.current.box.w;
        const h = dragRef.current.box.h;
        const ax = [
          snapEdge(nx, g.xs, g.threshold),
          snapEdge(nx + w / 2, g.xs, g.threshold),
          snapEdge(nx + w, g.xs, g.threshold),
        ].reduce((a, b) => (Math.abs(b) > 0 && Math.abs(b) < Math.abs(a || g.threshold + 1) ? b : a), 0);
        const ay = [
          snapEdge(ny, g.ys, g.threshold),
          snapEdge(ny + h / 2, g.ys, g.threshold),
          snapEdge(ny + h, g.ys, g.threshold),
        ].reduce((a, b) => (Math.abs(b) > 0 && Math.abs(b) < Math.abs(a || g.threshold + 1) ? b : a), 0);
        if (ax !== 0) { nx += ax; usedGuideX = true; }
        if (ay !== 0) { ny += ay; usedGuideY = true; }
      }
      onChange({
        x: usedGuideX ? Math.round(nx) : snap(nx),
        y: usedGuideY ? Math.round(ny) : snap(ny),
      });
    } else {
      let nw = Math.max(80, dragRef.current.box.w + dx);
      let nh = Math.max(40, dragRef.current.box.h + dy);
      let usedGuideW = false;
      let usedGuideH = false;
      if (g) {
        const ax = snapEdge(dragRef.current.box.x + nw, g.xs, g.threshold);
        const ay = snapEdge(dragRef.current.box.y + nh, g.ys, g.threshold);
        if (ax !== 0) { nw = Math.max(80, nw + ax); usedGuideW = true; }
        if (ay !== 0) { nh = Math.max(40, nh + ay); usedGuideH = true; }
      }
      onChange({
        w: usedGuideW ? Math.round(nw) : snap(nw),
        h: usedGuideH ? Math.round(nh) : snap(nh),
      });
    }
    dragRef.current = null;
  };

  const rotate = (block.kind === "image" || block.kind === "video") ? (block.rotate ?? 0) : 0;
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

  const inner = <BlockContent block={block} editingText={editingText} onTextChange={(t) => onChange({ text: t } as Partial<CustomBlock>)} stopEditingText={() => setEditingText(false)} />;

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
}: {
  block: CustomBlock;
  editingText: boolean;
  onTextChange: (text: string) => void;
  stopEditingText: () => void;
}) {
  if (block.kind === "text") {
    const style: CSSProperties = {
      width: "100%",
      height: "100%",
      padding: 8,
      boxSizing: "border-box",
      fontFamily: FONT_VARS[block.fontFamily ?? "serif"],
      fontSize: block.fontSize ?? 48,
      fontWeight: block.fontWeight ?? 400,
      fontStyle: block.italic ? "italic" : "normal",
      textAlign: block.align ?? "left",
      color: block.color ?? "#0a0a0a",
      background: block.bg ?? "transparent",
      lineHeight: 1.25,
      overflow: "hidden",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      outline: "none",
    };
    if (editingText) {
      return (
        <textarea
          autoFocus
          value={block.text}
          onChange={(e) => onTextChange(e.target.value)}
          onBlur={stopEditingText}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{ ...style, resize: "none", border: "none", background: block.bg ?? "rgba(255,255,255,0.4)" }}
        />
      );
    }
    return <div style={style}>{block.text}</div>;
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
  return (
    <video
      src={url}
      controls
      muted={block.muted}
      autoPlay={block.autoplay}
      loop={block.loop}
      playsInline
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
  return (
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
    </div>
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
        const rot = (b.kind === "image" || b.kind === "video") ? (b.rotate ?? 0) : 0;
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
}: {
  block: CustomBlock;
  onChange: (p: Partial<CustomBlock>) => void;
  onRemove: () => void;
}) {
  const ctx = useLayoutEdit();
  const inv = 1 / (ctx?.scale ?? 1);
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
      {block.kind === "text" && <TextControls block={block} onChange={onChange} />}
      {block.kind === "image" && <ImageControls block={block} onChange={onChange} />}
      {block.kind === "shape" && <ShapeControls block={block} onChange={onChange} />}
      {block.kind === "embed" && <EmbedControls block={block} onChange={onChange} />}
      {block.kind === "video" && <VideoControls block={block} onChange={onChange} />}
      <LinkControl link={(block as { link?: string }).link} onChange={(v) => onChange({ link: v } as Partial<CustomBlock>)} />
      <button type="button" onClick={onRemove} style={btnStyle("danger")}>
        <Trash2 size={12} /> Delete
      </button>
    </div>
  );
}

function TextControls({ block, onChange }: { block: Extract<CustomBlock, { kind: "text" }>; onChange: (p: Partial<CustomBlock>) => void }) {
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
      <select value={block.align ?? "left"} onChange={(e) => onChange({ align: e.target.value as "left" | "center" | "right" })} style={inputStyle}>
        <option value="left">Left</option>
        <option value="center">Center</option>
        <option value="right">Right</option>
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
    </>
  );
}

function ImageControls({ block, onChange }: { block: Extract<CustomBlock, { kind: "image" }>; onChange: (p: Partial<CustomBlock>) => void }) {
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
        <input type="number" min={-180} max={180} value={block.rotate ?? 0} onChange={(e) => onChange({ rotate: snapRotation(Number(e.target.value)) })} style={{ ...inputStyle, width: 56 }} />
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
        <input type="number" min={-180} max={180} value={block.rotate ?? 0} onChange={(e) => onChange({ rotate: snapRotation(Number(e.target.value)) })} style={{ ...inputStyle, width: 56 }} />
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
