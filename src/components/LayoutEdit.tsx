import {
  createContext,
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as RPointerEvent,
} from "react";

export type Overrides = Record<string, { dx: number; dy: number }>;

type Ctx = {
  editing: boolean;
  scale: number; // CSS px per intrinsic px
  overrides: Overrides;
  setOverride: (key: string, value: { dx: number; dy: number } | null) => void;
};

const LayoutEditContext = createContext<Ctx | null>(null);

export function LayoutEditProvider({
  editing,
  scale,
  overrides,
  setOverride,
  children,
}: Ctx & { children: ReactNode }) {
  return (
    <LayoutEditContext.Provider value={{ editing, scale, overrides, setOverride }}>
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

  const [local, setLocal] = useState<{ dx: number; dy: number } | null>(null);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);

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
          outline: "3px dashed rgba(107,19,32,0.7)",
          outlineOffset: 4,
          cursor: drag.current ? "grabbing" : "grab",
        }
      : {}),
  };

  return (
    <div
      data-block-key={blockKey}
      style={combined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children}
    </div>
  );
}
