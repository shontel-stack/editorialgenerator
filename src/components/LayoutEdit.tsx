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

export type Overrides = Record<string, { dx: number; dy: number }>;
export type ScaleMap = Record<string, number>;
export type LinkMap = Record<string, string>;

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
};

const LayoutEditContext = createContext<Ctx | null>(null);

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
      }}
    >
      {children}
    </LayoutEditContext.Provider>
  );
}

const SNAP = 40;
const snap = (n: number) => Math.round(n / SNAP) * SNAP;

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

  const [local, setLocal] = useState<{ dx: number; dy: number } | null>(null);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [showSize, setShowSize] = useState(false);

  const dx = local?.dx ?? saved?.dx ?? 0;
  const dy = local?.dy ?? saved?.dy ?? 0;

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!editing || !ctx) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = { x: e.clientX, y: e.clientY, dx, dy };
    e.currentTarget.setPointerCapture(e.pointerId);
    setLocal({ dx, dy });
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !ctx) return;
    const s = ctx.scale || 1;
    const ndx = drag.current.dx + (e.clientX - drag.current.x) / s;
    const ndy = drag.current.dy + (e.clientY - drag.current.y) / s;
    setLocal({ dx: ndx, dy: ndy });
  };
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !ctx) return;
    const s = ctx.scale || 1;
    const ndx = drag.current.dx + (e.clientX - drag.current.x) / s;
    const ndy = drag.current.dy + (e.clientY - drag.current.y) / s;
    const snapped = { dx: snap(ndx), dy: snap(ndy) };
    drag.current = null;
    setLocal(null);
    if (snapped.dx === 0 && snapped.dy === 0) ctx.setOverride(blockKey, null);
    else ctx.setOverride(blockKey, snapped);
  };

  const existingTransform = (style.transform as string | undefined) ?? "";
  const moveTransform =
    dx === 0 && dy === 0 ? "" : `translate(${dx}px, ${dy}px)`;
  const combined: CSSProperties = {
    ...style,
    transform: [existingTransform, moveTransform].filter(Boolean).join(" ") || undefined,
    ...(editing
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
    textScale !== 1 ? (
      <div
        style={{
          transform: `scale(${textScale})`,
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
