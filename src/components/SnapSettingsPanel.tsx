import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  DEFAULT_SNAP_SETTINGS,
  getSnapSettings,
  setSnapSettings,
  useSnapSettings,
  type SnapSettings,
} from "@/lib/snapSettings";

export type SnapPageRef = { id: string; label: string };

type PageOverrideProps = {
  /** Label shown for the per-page section (e.g. page type or folio). */
  pageLabel?: string;
  /** Current override stored on the page, if any. */
  override?: Partial<SnapSettings> | null;
  /** Persist override (pass null to clear). */
  onChangeOverride?: (next: Partial<SnapSettings> | null) => void;
  /** Other pages in the document, used for the "apply to selected pages" UI. */
  pages?: SnapPageRef[];
  /** Currently selected page id — excluded from the multi-select list. */
  currentPageId?: string;
  /** Bulk-apply the current override to a list of page ids. */
  onApplyOverrideToPages?: (ids: string[], override: Partial<SnapSettings> | null) => void;
  /** Undo the most recent snap-override apply/clear/edit across the document. */
  onUndoOverrides?: () => void;
  /** Redo the most recently undone snap-override change. */
  onRedoOverrides?: () => void;
  canUndoOverrides?: boolean;
  canRedoOverrides?: boolean;
  /** Bump to force the panel to re-evaluate undo/redo button state. */
  historyTick?: number;

};

/**
 * Editor sidebar panel for tuning snap behavior.
 *
 * - Top section: GLOBAL defaults (per-browser, localStorage).
 * - Bottom section: PER-PAGE override toggle. When enabled, the currently
 *   selected page uses its own rotation snap angles / tolerances regardless
 *   of the global defaults. When disabled, the page falls back to global.
 */
export function SnapSettingsPanel({
  pageLabel,
  override,
  onChangeOverride,
  pages,
  currentPageId,
  onApplyOverrideToPages,
  onUndoOverrides,
  onRedoOverrides,
  canUndoOverrides,
  canRedoOverrides,
}: PageOverrideProps = {}) {

  const global = useSnapSettings();
  const [open, setOpen] = useState(false);
  const [pageOpen, setPageOpen] = useState(Boolean(override));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<null | {
    mode: "apply" | "clear";
    ids: string[];
  }>(null);
  const otherPages = (pages ?? []).filter((p) => p.id !== currentPageId);
  const [anglesText, setAnglesText] = useState<string>(global.rotationAngles.join(", "));
  const overrideEnabled = Boolean(override);
  const effective: SnapSettings = {
    edgeTolerancePx: override?.edgeTolerancePx ?? global.edgeTolerancePx,
    rotationTolerance: override?.rotationTolerance ?? global.rotationTolerance,
    rotationAngles:
      override?.rotationAngles && override.rotationAngles.length > 0
        ? override.rotationAngles
        : global.rotationAngles,
    gridSizePx: override?.gridSizePx ?? global.gridSizePx,
    alignToObjects:
      typeof override?.alignToObjects === "boolean" ? override.alignToObjects : global.alignToObjects,
    baselineGridPx: global.baselineGridPx,
    baselineOffsetPx: global.baselineOffsetPx,
    showBaseline: global.showBaseline,
    snapToBaseline: global.snapToBaseline,
  };

  const [pageAnglesText, setPageAnglesText] = useState<string>(effective.rotationAngles.join(", "));

  const commitGlobal = (patch: Partial<SnapSettings>) => {
    setSnapSettings({ ...getSnapSettings(), ...patch });
  };
  const commitGlobalAngles = (text: string) => {
    const parsed = parseAngles(text);
    if (parsed.length > 0) commitGlobal({ rotationAngles: parsed });
  };

  const commitPage = (patch: Partial<SnapSettings>) => {
    if (!onChangeOverride) return;
    onChangeOverride({ ...(override ?? {}), ...patch });
  };
  const commitPageAngles = (text: string) => {
    const parsed = parseAngles(text);
    if (parsed.length > 0) commitPage({ rotationAngles: parsed });
  };

  const reset = () => {
    setSnapSettings(DEFAULT_SNAP_SETTINGS);
    setAnglesText(DEFAULT_SNAP_SETTINGS.rotationAngles.join(", "));
  };

  const inchEquiv = (n: number) => (n / 300).toFixed(3);

  return (
    <div className="border border-border bg-card rounded-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] tracking-[0.4em] uppercase text-muted-foreground hover:bg-secondary/40"
      >
        <span>Snap settings{overrideEnabled ? " · page override" : ""}</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-4">
          {(onUndoOverrides || onRedoOverrides) && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground flex-1">
                Override history
              </span>
              <button
                type="button"
                onClick={onUndoOverrides}
                disabled={!canUndoOverrides}
                className="px-2 py-1 text-[10px] tracking-[0.3em] uppercase border border-border rounded-sm hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                title="Undo last snap-override change"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={onRedoOverrides}
                disabled={!canRedoOverrides}
                className="px-2 py-1 text-[10px] tracking-[0.3em] uppercase border border-border rounded-sm hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                title="Redo last undone snap-override change"
              >
                Redo
              </button>
            </div>
          )}
          {/* GLOBAL DEFAULTS */}
          <fieldset className="space-y-3">
            <legend className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
              Global defaults
            </legend>
            <ToleranceSlider
              label={`Edge tolerance · ${global.edgeTolerancePx}px (${inchEquiv(global.edgeTolerancePx)}″)`}
              value={global.edgeTolerancePx}
              min={0}
              max={120}
              onChange={(v) => commitGlobal({ edgeTolerancePx: v })}
            />
            <ToleranceSlider
              label={`Rotation tolerance · ${global.rotationTolerance}°`}
              value={global.rotationTolerance}
              min={0}
              max={30}
              onChange={(v) => commitGlobal({ rotationTolerance: v })}
            />
            <AnglesInput
              label="Rotation snap angles (°)"
              text={anglesText}
              onText={setAnglesText}
              onCommit={() => commitGlobalAngles(anglesText)}
            />
            <ToleranceSlider
              label={
                global.gridSizePx > 0
                  ? `Grid · ${global.gridSizePx}px (${inchEquiv(global.gridSizePx)}″)`
                  : "Grid · off"
              }
              value={global.gridSizePx}
              min={0}
              max={300}
              onChange={(v) => commitGlobal({ gridSizePx: v })}
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={global.alignToObjects}
                onChange={(e) => commitGlobal({ alignToObjects: e.target.checked })}
              />
              <span>Snap to other objects (smart guides)</span>
            </label>

            {/* --- Baseline grid --- */}
            <div className="pt-2 border-t border-border space-y-2">
              <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                Baseline grid
              </span>
              <ToleranceSlider
                label={
                  global.baselineGridPx > 0
                    ? `Leading · ${global.baselineGridPx}px (${inchEquiv(global.baselineGridPx)}″)`
                    : "Baseline grid · off"
                }
                value={global.baselineGridPx}
                min={0}
                max={300}
                onChange={(v) => commitGlobal({ baselineGridPx: v })}
              />
              <ToleranceSlider
                label={`First baseline · ${global.baselineOffsetPx}px (${inchEquiv(global.baselineOffsetPx)}″)`}
                value={global.baselineOffsetPx}
                min={0}
                max={900}
                onChange={(v) => commitGlobal({ baselineOffsetPx: v })}
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={global.showBaseline}
                  onChange={(e) => commitGlobal({ showBaseline: e.target.checked })}
                />
                <span>Show baselines on the canvas</span>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={global.snapToBaseline}
                  onChange={(e) => commitGlobal({ snapToBaseline: e.target.checked })}
                />
                <span>Snap blocks to the baseline grid</span>
              </label>
            </div>
            <button
              type="button"
              onClick={reset}
              className="w-full px-2 py-1 text-[10px] tracking-[0.3em] uppercase border border-border rounded-sm hover:bg-secondary"
            >
              Reset global defaults
            </button>

          </fieldset>

          {/* PER-PAGE OVERRIDE */}
          {onChangeOverride && (
            <fieldset className="space-y-3 border-t border-border pt-3">
              <legend className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground flex items-center justify-between w-full">
                <span>Override for {pageLabel ?? "this page"}</span>
                <label className="inline-flex items-center gap-2 normal-case tracking-normal text-xs">
                  <input
                    type="checkbox"
                    checked={overrideEnabled}
                    onChange={(e) => {
                      if (e.target.checked) {
                        // Seed override with current effective values so the UI
                        // shows what the user was already getting.
                        onChangeOverride({
                          edgeTolerancePx: effective.edgeTolerancePx,
                          rotationTolerance: effective.rotationTolerance,
                          rotationAngles: effective.rotationAngles,
                        });
                        setPageAnglesText(effective.rotationAngles.join(", "));
                        setPageOpen(true);
                      } else {
                        onChangeOverride(null);
                        setPageOpen(false);
                      }
                    }}
                  />
                  Enable
                </label>
              </legend>
              {overrideEnabled && pageOpen && (
                <>
                  <ToleranceSlider
                    label={`Edge tolerance · ${effective.edgeTolerancePx}px (${inchEquiv(effective.edgeTolerancePx)}″)`}
                    value={effective.edgeTolerancePx}
                    min={0}
                    max={120}
                    onChange={(v) => commitPage({ edgeTolerancePx: v })}
                  />
                  <ToleranceSlider
                    label={`Rotation tolerance · ${effective.rotationTolerance}°`}
                    value={effective.rotationTolerance}
                    min={0}
                    max={30}
                    onChange={(v) => commitPage({ rotationTolerance: v })}
                  />
                  <AnglesInput
                    label="Rotation snap angles (°)"
                    text={pageAnglesText}
                    onText={setPageAnglesText}
                    onCommit={() => commitPageAngles(pageAnglesText)}
                  />
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Active only for this page. Other pages keep the global defaults (or their own overrides).
                  </p>

                  {onApplyOverrideToPages && otherPages.length > 0 && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                          Apply to other pages
                        </span>
                        <div className="flex gap-2 text-[10px] tracking-[0.2em] uppercase">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => setSelectedIds(new Set(otherPages.map((p) => p.id)))}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => setSelectedIds(new Set())}
                          >
                            None
                          </button>
                        </div>
                      </div>
                      <div className="max-h-40 overflow-y-auto border border-border rounded-sm divide-y divide-border">
                        {otherPages.map((p) => {
                          const checked = selectedIds.has(p.id);
                          return (
                            <label
                              key={p.id}
                              className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-secondary/40"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setSelectedIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(p.id);
                                    else next.delete(p.id);
                                    return next;
                                  });
                                }}
                              />
                              <span className="truncate">{p.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={selectedIds.size === 0}
                          onClick={() =>
                            setPending({ mode: "apply", ids: Array.from(selectedIds) })
                          }
                          className="flex-1 px-2 py-1 text-[10px] tracking-[0.3em] uppercase border border-border rounded-sm hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Apply override ({selectedIds.size})
                        </button>
                        <button
                          type="button"
                          disabled={selectedIds.size === 0}
                          onClick={() =>
                            setPending({ mode: "clear", ids: Array.from(selectedIds) })
                          }
                          className="px-2 py-1 text-[10px] tracking-[0.3em] uppercase border border-border rounded-sm hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Remove snap override from selected pages"
                        >
                          Clear
                        </button>
                      </div>

                    </div>
                  )}
                </>
              )}
            </fieldset>
          )}
        </div>
      )}
      <BulkConfirmDialog
        pending={pending}
        otherPages={otherPages}
        effective={effective}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending || !onApplyOverrideToPages) return setPending(null);
          if (pending.mode === "apply") {
            onApplyOverrideToPages(pending.ids, {
              edgeTolerancePx: effective.edgeTolerancePx,
              rotationTolerance: effective.rotationTolerance,
              rotationAngles: effective.rotationAngles,
            });
          } else {
            onApplyOverrideToPages(pending.ids, null);
          }
          setPending(null);
        }}
      />
    </div>
  );
}

function BulkConfirmDialog({
  pending,
  otherPages,
  effective,
  onCancel,
  onConfirm,
}: {
  pending: { mode: "apply" | "clear"; ids: string[] } | null;
  otherPages: SnapPageRef[];
  effective: SnapSettings;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const open = pending !== null;
  const idSet = new Set(pending?.ids ?? []);
  const targetPages = otherPages.filter((p) => idSet.has(p.id));
  const isApply = pending?.mode === "apply";
  const verb = isApply ? "Apply override" : "Clear override";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {verb} on {targetPages.length} page{targetPages.length === 1 ? "" : "s"}?
          </DialogTitle>
          <DialogDescription>
            {isApply
              ? "These pages will receive the current snap override, replacing any existing override they had."
              : "Snap overrides will be removed from these pages. They will fall back to the global defaults."}
          </DialogDescription>
        </DialogHeader>
        {isApply && (
          <div className="rounded-sm border border-border bg-secondary/30 px-3 py-2 text-xs space-y-1">
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
              Override to apply
            </div>
            <div>Edge tolerance: {effective.edgeTolerancePx}px</div>
            <div>Rotation tolerance: {effective.rotationTolerance}°</div>
            <div className="truncate">
              Angles: {effective.rotationAngles.join(", ")}
            </div>
          </div>
        )}
        <div className="max-h-56 overflow-y-auto border border-border rounded-sm divide-y divide-border">
          {targetPages.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">No pages selected.</div>
          ) : (
            targetPages.map((p) => (
              <div key={p.id} className="px-2 py-1 text-xs truncate">
                {p.label}
              </div>
            ))
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={onCancel}
            className="text-xs px-3 py-2 rounded-sm hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={targetPages.length === 0}
            className="bg-foreground text-background px-3 py-2 text-[10px] tracking-[0.3em] uppercase rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {verb}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* — small internal helpers — */

function parseAngles(text: string): number[] {
  return Array.from(
    new Set(
      text
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => Number(t))
        .filter((n) => Number.isFinite(n) && n >= -360 && n <= 360),
    ),
  ).sort((a, b) => a - b);
}

function ToleranceSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function AnglesInput({
  label,
  text,
  onText,
  onCommit,
}: {
  label: string;
  text: string;
  onText: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <label className="block">
      <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">{label}</div>
      <input
        type="text"
        value={text}
        onChange={(e) => onText(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit();
          }
        }}
        placeholder="0, 15, 30, 45, 90, 180, -45, -90"
        className="w-full border border-border rounded-sm px-2 py-1 text-xs bg-background"
      />
    </label>
  );
}
