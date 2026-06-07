import { useState } from "react";
import type { BrandSwatch } from "@/lib/brandAssets";
import { normalizeHex } from "@/lib/brandAssets";

/**
 * Compact swatch palette shown next to a color input. Click a swatch to
 * apply it, or click "+" to save the current value as a brand swatch.
 *
 * Keeps a tiny preview row so the toolbar stays single-line; the full grid
 * lives in the Brand Kit panel.
 */
export function SwatchPicker({
  swatches,
  currentHex,
  onPick,
  onSave,
  onRemove,
  size = 14,
  maxVisible = 8,
}: {
  swatches: BrandSwatch[];
  currentHex?: string;
  onPick: (hex: string) => void;
  onSave?: (hex: string) => Promise<void> | void;
  onRemove?: (id: string) => Promise<void> | void;
  size?: number;
  maxVisible?: number;
}) {
  const [busy, setBusy] = useState(false);
  const visible = swatches.slice(0, maxVisible);
  const overflow = swatches.length - visible.length;
  const normalizedCurrent = currentHex ? normalizeHex(currentHex) : null;
  const alreadySaved =
    normalizedCurrent != null &&
    swatches.some((s) => s.hex.toLowerCase() === normalizedCurrent.toLowerCase());

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 4px",
        border: "1px solid #eee",
        borderRadius: 3,
        background: "white",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {visible.length === 0 && (
        <span style={{ fontSize: 9, color: "#999", padding: "0 4px" }}>No swatches</span>
      )}
      {visible.map((s) => {
        const active =
          normalizedCurrent != null &&
          s.hex.toLowerCase() === normalizedCurrent.toLowerCase();
        return (
          <button
            key={s.id}
            type="button"
            title={`${s.name || s.hex}${onRemove ? " — right-click to remove" : ""}`}
            onClick={() => onPick(s.hex)}
            onContextMenu={(e) => {
              if (!onRemove) return;
              e.preventDefault();
              void onRemove(s.id);
            }}
            style={{
              width: size,
              height: size,
              background: s.hex,
              border: active ? "2px solid #2563eb" : "1px solid #ccc",
              borderRadius: 2,
              padding: 0,
              cursor: "pointer",
            }}
          />
        );
      })}
      {overflow > 0 && (
        <span style={{ fontSize: 9, color: "#666" }}>+{overflow}</span>
      )}
      {onSave && currentHex && !alreadySaved && (
        <button
          type="button"
          title="Save current color as a brand swatch"
          disabled={busy}
          onClick={async () => {
            const hex = normalizeHex(currentHex);
            if (!hex) return;
            setBusy(true);
            try {
              await onSave(hex);
            } finally {
              setBusy(false);
            }
          }}
          style={{
            fontSize: 10,
            lineHeight: 1,
            padding: "2px 5px",
            border: "1px solid #ddd",
            borderRadius: 2,
            background: "#fafafa",
            cursor: "pointer",
            color: "#333",
          }}
        >
          +
        </button>
      )}
    </div>
  );
}
