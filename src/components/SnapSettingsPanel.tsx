import { useState } from "react";
import {
  DEFAULT_SNAP_SETTINGS,
  getSnapSettings,
  setSnapSettings,
  useSnapSettings,
  type SnapSettings,
} from "@/lib/snapSettings";

/**
 * Compact editor sidebar panel for tuning snapping behavior:
 *  - Edge / guide tolerance (px @ 300 DPI ≈ 0.0033″ per 1 px)
 *  - Rotation tolerance (degrees)
 *  - The list of rotation snap angles (comma-separated, in degrees)
 *
 * Persists to localStorage and broadcasts changes to all editor surfaces.
 */
export function SnapSettingsPanel() {
  const s = useSnapSettings();
  const [open, setOpen] = useState(false);
  const [anglesText, setAnglesText] = useState<string>(s.rotationAngles.join(", "));

  const commit = (patch: Partial<SnapSettings>) => {
    setSnapSettings({ ...getSnapSettings(), ...patch });
  };

  const commitAngles = (text: string) => {
    const parsed = Array.from(
      new Set(
        text
          .split(/[,\s]+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => Number(t))
          .filter((n) => Number.isFinite(n) && n >= -360 && n <= 360),
      ),
    ).sort((a, b) => a - b);
    if (parsed.length > 0) commit({ rotationAngles: parsed });
  };

  const reset = () => {
    setSnapSettings(DEFAULT_SNAP_SETTINGS);
    setAnglesText(DEFAULT_SNAP_SETTINGS.rotationAngles.join(", "));
  };

  const inchEquiv = (s.edgeTolerancePx / 300).toFixed(3);

  return (
    <div className="border border-border bg-card rounded-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] tracking-[0.4em] uppercase text-muted-foreground hover:bg-secondary/40"
      >
        <span>Snap settings</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3">
          <label className="block">
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
              Edge tolerance · {s.edgeTolerancePx}px ({inchEquiv}″)
            </div>
            <input
              type="range"
              min={0}
              max={120}
              step={1}
              value={s.edgeTolerancePx}
              onChange={(e) => commit({ edgeTolerancePx: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-[10px] leading-relaxed text-muted-foreground mt-1">
              How close a block edge or center must come to a margin/bleed/trim guide before it snaps. 0 disables guide snap.
            </p>
          </label>

          <label className="block">
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
              Rotation tolerance · {s.rotationTolerance}°
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={s.rotationTolerance}
              onChange={(e) => commit({ rotationTolerance: Number(e.target.value) })}
              className="w-full"
            />
          </label>

          <label className="block">
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
              Rotation snap angles (°)
            </div>
            <input
              type="text"
              value={anglesText}
              onChange={(e) => setAnglesText(e.target.value)}
              onBlur={() => commitAngles(anglesText)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAngles(anglesText);
                }
              }}
              placeholder="0, 15, 30, 45, 90, 180, -45, -90"
              className="w-full border border-border rounded-sm px-2 py-1 text-xs bg-background"
            />
            <p className="text-[10px] leading-relaxed text-muted-foreground mt-1">
              Comma-separated degrees. Each rotation value snaps to the nearest one within tolerance.
            </p>
          </label>

          <button
            type="button"
            onClick={reset}
            className="w-full px-2 py-1 text-[10px] tracking-[0.3em] uppercase border border-border rounded-sm hover:bg-secondary"
          >
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
