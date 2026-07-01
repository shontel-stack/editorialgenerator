/**
 * Magazine template picker: choose a preset layout style, tweak margins &
 * column widths, apply to the current issue, and optionally save as a
 * reusable template.
 */
import { useEffect, useMemo, useState } from "react";
import { LayoutTemplate, Save, Check } from "lucide-react";
import { toast } from "sonner";
import {
  MAGAZINE_LAYOUT_STYLES,
  DEFAULT_MAGAZINE_LAYOUT_STYLE,
  getMagazineLayoutStyle,
  layoutStyleMatches,
  type MagazineLayoutStyle,
  type MagazineLayoutStyleKey,
} from "@/lib/magazineLayoutStyles";
import { saveIssueTemplate } from "@/lib/issueTemplates";
import type { IssueDoc } from "@/lib/coverDefaults";

interface Props {
  userId: string | null;
  publicationId: string | null;
  issue: IssueDoc;
  onApply: (next: IssueDoc) => void;
}

function currentStyleOf(issue: IssueDoc): MagazineLayoutStyle {
  return issue.meta?.layoutStyle ?? DEFAULT_MAGAZINE_LAYOUT_STYLE;
}

function clampMargin(n: number): number {
  if (!isFinite(n) || n < 0) return 0;
  if (n > 3) return 3;
  return Math.round(n * 100) / 100;
}
function clampColumns(n: number): number {
  if (!isFinite(n) || n < 1) return 1;
  if (n > 6) return 6;
  return Math.round(n);
}
function clampGutter(n: number): number {
  if (!isFinite(n) || n < 0) return 0;
  if (n > 1) return 1;
  return Math.round(n * 100) / 100;
}

export function MagazineTemplatePicker({ userId, publicationId, issue, onApply }: Props) {
  const [style, setStyle] = useState<MagazineLayoutStyle>(() => currentStyleOf(issue));
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // If the issue changes underneath us (e.g. template loaded), resync.
  useEffect(() => {
    setStyle(currentStyleOf(issue));
  }, [issue.meta?.issueId]);

  // If any numeric value diverges from the selected preset, downgrade to "custom".
  const effectiveKey: MagazineLayoutStyleKey = useMemo(() => {
    if (style.key === "custom") return "custom";
    const preset = getMagazineLayoutStyle(style.key);
    if (!preset) return "custom";
    return layoutStyleMatches(preset, style) ? style.key : "custom";
  }, [style]);

  const choosePreset = (key: MagazineLayoutStyleKey) => {
    const preset = getMagazineLayoutStyle(key);
    if (!preset) return;
    setStyle({ ...preset });
  };

  const setMargin = (edge: "top" | "right" | "bottom" | "left", v: number) => {
    setStyle((prev) => ({
      ...prev,
      key: "custom",
      label: "Custom",
      margins: { ...prev.margins, [edge]: clampMargin(v) },
    }));
  };

  const apply = () => {
    const next: IssueDoc = {
      ...issue,
      meta: { ...issue.meta, layoutStyle: { ...style, key: effectiveKey } },
    };
    onApply(next);
    toast.success("Layout style applied");
  };

  const saveAsTemplate = async () => {
    if (!userId) {
      toast.error("Sign in to save templates");
      return;
    }
    const name = templateName.trim() || `${style.label} — ${new Date().toLocaleDateString()}`;
    setSaving(true);
    try {
      const snapshot: IssueDoc = {
        ...issue,
        meta: { ...issue.meta, layoutStyle: { ...style, key: effectiveKey } },
      };
      await saveIssueTemplate({
        userId,
        publicationId,
        name,
        description: `Layout style: ${style.label} · ${style.columns} col · margins ${style.margins.top}/${style.margins.right}/${style.margins.bottom}/${style.margins.left} in`,
        data: snapshot,
      });
      toast.success(`Saved template "${name}"`);
      setTemplateName("");
    } catch (e) {
      toast.error(`Could not save: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const numberInputCls =
    "w-full px-2 py-1 text-xs border border-border rounded-sm bg-background";

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-1.5">
        <LayoutTemplate className="h-3 w-3" /> Choose a layout style
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {MAGAZINE_LAYOUT_STYLES.map((s) => {
          const active = effectiveKey === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => choosePreset(s.key)}
              className={
                "text-left border rounded-sm px-2 py-1.5 text-[11px] transition " +
                (active
                  ? "border-[color:var(--ruby)] bg-secondary"
                  : "border-border hover:bg-secondary")
              }
            >
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{s.label}</span>
                {active ? <Check className="h-3 w-3 shrink-0" /> : null}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {s.columns} col · {s.margins.top}" margin
              </div>
            </button>
          );
        })}
        <div
          className={
            "col-span-2 text-[10px] px-2 py-1 border rounded-sm " +
            (effectiveKey === "custom"
              ? "border-[color:var(--ruby)] bg-secondary text-foreground"
              : "border-dashed border-border text-muted-foreground")
          }
        >
          {effectiveKey === "custom"
            ? "Custom — values diverged from any preset"
            : "Tweak values below to create a custom variant"}
        </div>
      </div>

      <div className="rounded-sm border border-border bg-secondary/40 p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Margins (inches)
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {(["top", "right", "bottom", "left"] as const).map((edge) => (
            <label key={edge} className="text-[10px] text-muted-foreground">
              <span className="block capitalize mb-0.5">{edge}</span>
              <input
                type="number"
                min={0}
                max={3}
                step={0.05}
                value={style.margins[edge]}
                onChange={(e) => setMargin(edge, parseFloat(e.target.value))}
                className={numberInputCls}
              />
            </label>
          ))}
        </div>

        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground pt-1">
          Columns
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="text-[10px] text-muted-foreground">
            <span className="block mb-0.5">Count (1–6)</span>
            <input
              type="number"
              min={1}
              max={6}
              step={1}
              value={style.columns}
              onChange={(e) =>
                setStyle((prev) => ({
                  ...prev,
                  key: "custom",
                  label: "Custom",
                  columns: clampColumns(parseFloat(e.target.value)),
                }))
              }
              className={numberInputCls}
            />
          </label>
          <label className="text-[10px] text-muted-foreground">
            <span className="block mb-0.5">Gutter (in)</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={style.gutter}
              onChange={(e) =>
                setStyle((prev) => ({
                  ...prev,
                  key: "custom",
                  label: "Custom",
                  gutter: clampGutter(parseFloat(e.target.value)),
                }))
              }
              className={numberInputCls}
            />
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={apply}
        className="w-full border border-border px-3 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-secondary rounded-sm"
      >
        Apply to current issue
      </button>

      <div className="rounded-sm border border-border bg-secondary/40 p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Save as reusable template
        </div>
        <input
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder={`${style.label} — ${new Date().toLocaleDateString()}`}
          className="w-full px-2 py-1.5 text-xs border border-border rounded-sm bg-background"
        />
        <button
          type="button"
          onClick={() => void saveAsTemplate()}
          disabled={saving || !userId}
          className="w-full border border-border px-3 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-secondary rounded-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <Save className="h-3 w-3" /> {saving ? "Saving…" : "Save layout template"}
        </button>
      </div>
    </div>
  );
}
