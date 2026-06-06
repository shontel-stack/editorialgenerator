/**
 * Per-page column-width + gutter tuning panel.
 *
 * Shown in the right-hand edit sidebar (and reusable elsewhere) whenever the
 * selected page uses a multi-column layout. Edits debounce to the database
 * via `setColumnTuning` from `useIssuePageStatus`. Users can also save the
 * current tuning as a named preset and apply any saved preset scoped to the
 * same layout family.
 */

import { useEffect, useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Save, RotateCcw } from "lucide-react";
import {
  DEFAULT_GUTTER_IN,
  evenColumnWidths,
  normalizeColumnWidths,
} from "@/lib/pageStatus";
import { PAGE_LAYOUT_COLUMNS, type PageLayout } from "@/lib/pageLayouts";
import type { LayoutPresetRow } from "@/lib/layoutPresets";
import { toast } from "sonner";

type Props = {
  layout: PageLayout;
  /** Current saved widths (ratios summing to 1). Length should match column count. */
  widths: number[];
  /** Current saved gutter in inches. */
  gutterIn: number;
  /** Persist new tuning to the page. */
  onChange: (patch: { column_widths?: number[]; gutter_in?: number }) => void | Promise<void>;
  /** Saved presets scoped to this layout. */
  presets: LayoutPresetRow[];
  /** Save current tuning as a new preset. */
  onSavePreset: (name: string) => void | Promise<void>;
  /** Remove a saved preset. */
  onDeletePreset: (id: string) => void | Promise<void>;
};

export function ColumnTuningControls({
  layout,
  widths,
  gutterIn,
  onChange,
  presets,
  onSavePreset,
  onDeletePreset,
}: Props) {
  const cols = Math.max(1, PAGE_LAYOUT_COLUMNS[layout] || 1);
  const safeWidths = useMemo(() => {
    if (widths.length === cols) return normalizeColumnWidths(widths);
    return evenColumnWidths(cols);
  }, [widths, cols]);

  // Local draft state so sliders feel responsive; commit on release.
  const [draft, setDraft] = useState<number[]>(safeWidths);
  const [gutter, setGutter] = useState<number>(gutterIn);
  const [presetName, setPresetName] = useState("");

  useEffect(() => setDraft(safeWidths), [safeWidths]);
  useEffect(() => setGutter(gutterIn), [gutterIn]);

  if (cols < 2) {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        This layout uses a single column — column width tuning is unavailable.
      </p>
    );
  }

  const commitWidths = (next: number[]) => {
    const normalized = normalizeColumnWidths(next);
    setDraft(normalized);
    void onChange({ column_widths: normalized });
  };

  /**
   * Adjust one column's ratio while compensating proportionally across the
   * other columns so the total still sums to 1.
   */
  const adjustColumn = (idx: number, nextRatio: number) => {
    const minR = 0.05;
    const clamped = Math.max(minR, Math.min(0.95, nextRatio));
    const otherSum = draft.reduce((a, b, i) => (i === idx ? a : a + b), 0);
    const remaining = Math.max(0, 1 - clamped);
    if (otherSum <= 0) {
      const evenOther = (1 - clamped) / Math.max(1, draft.length - 1);
      const next = draft.map((_, i) => (i === idx ? clamped : evenOther));
      setDraft(next);
      return;
    }
    const factor = remaining / otherSum;
    const next = draft.map((v, i) => (i === idx ? clamped : v * factor));
    setDraft(next);
  };

  const resetEven = () => {
    const even = evenColumnWidths(cols);
    setDraft(even);
    void onChange({ column_widths: even, gutter_in: DEFAULT_GUTTER_IN });
    setGutter(DEFAULT_GUTTER_IN);
  };

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    const normalized =
      p.column_widths.length === cols
        ? normalizeColumnWidths(p.column_widths)
        : evenColumnWidths(cols);
    setDraft(normalized);
    setGutter(p.gutter_in);
    void onChange({ column_widths: normalized, gutter_in: p.gutter_in });
  };

  const handleSavePreset = async () => {
    const name = presetName.trim();
    if (!name) {
      toast.error("Give the preset a name first.");
      return;
    }
    await onSavePreset(name);
    setPresetName("");
    toast.success(`Preset “${name}” saved.`);
  };

  return (
    <div className="space-y-4">
      {/* Column width sliders */}
      <div className="space-y-3">
        {draft.map((ratio, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium">Column {i + 1}</span>
              <span className="tabular-nums text-muted-foreground">
                {(ratio * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[Math.round(ratio * 100)]}
              min={5}
              max={95}
              step={1}
              onValueChange={(v) => adjustColumn(i, (v[0] ?? 0) / 100)}
              onValueCommit={() => commitWidths(draft)}
            />
          </div>
        ))}
      </div>

      {/* Gutter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium">Gutter</span>
          <span className="tabular-nums text-muted-foreground">{gutter.toFixed(3)}″</span>
        </div>
        <Slider
          value={[Math.round(gutter * 1000)]}
          min={0}
          max={1000}
          step={5}
          onValueChange={(v) => setGutter((v[0] ?? 0) / 1000)}
          onValueCommit={() => void onChange({ gutter_in: gutter })}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={resetEven}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to even
        </Button>
      </div>

      {/* Presets */}
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Presets
        </div>

        {presets.length > 0 ? (
          <div className="flex items-center gap-2">
            <Select onValueChange={applyPreset}>
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue placeholder="Apply saved preset…" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex flex-col">
                      <span className="text-xs">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {p.column_widths.map((r) => `${Math.round(r * 100)}%`).join(" · ")} ·
                        gutter {p.gutter_in.toFixed(3)}″
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No presets saved for this layout yet.</p>
        )}

        {presets.length > 0 && (
          <ul className="space-y-1">
            {presets.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate">{p.name}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => void onDeletePreset(p.id)}
                  aria-label={`Delete preset ${p.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-1.5 pt-1">
          <Input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name"
            className="h-8 text-xs"
          />
          <Button type="button" size="sm" className="gap-1.5" onClick={handleSavePreset}>
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
