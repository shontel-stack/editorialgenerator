import { useEffect, useState } from "react";
import { Sparkles, Loader2, X, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import {
  proposeLibraryLayout,
  type LayoutPlan,
  type LayoutPlanOp,
} from "@/lib/proposeLayout.functions";
import type { AttachmentWithUrl } from "@/lib/attachments";
import type { IssueDoc } from "@/lib/coverDefaults";

export type LayoutProposalPanelProps = {
  open: boolean;
  onClose: () => void;
  issue: IssueDoc;
  publicationName: string | null;
  library: AttachmentWithUrl[];
  onApply: (ops: LayoutPlanOp[]) => { applied: number; skipped: number };
  /** Called whenever the visible (kept) plan operations change, so the editor can render a ghost overlay on pages. */
  onPlanChange?: (ops: LayoutPlanOp[]) => void;
};

const opLabel: Record<LayoutPlanOp["kind"], string> = {
  add_image_block: "Place image",
  add_text_block: "Add text block",
  set_field: "Set field",
};

export function LayoutProposalPanel({
  open,
  onClose,
  issue,
  publicationName,
  library,
  onApply,
  onPlanChange,
}: LayoutProposalPanelProps) {
  const propose = useServerFn(proposeLibraryLayout);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<LayoutPlan | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  // Publish the currently-kept ops to the editor so it can render a ghost overlay.
  useEffect(() => {
    if (!onPlanChange) return;
    if (!open || !plan) {
      onPlanChange([]);
      return;
    }
    onPlanChange(plan.operations.filter((_, i) => !excluded.has(i)));
  }, [open, plan, excluded, onPlanChange]);

  useEffect(() => {
    if (!open && onPlanChange) onPlanChange([]);
  }, [open, onPlanChange]);

  if (!open) return null;

  const pageMeta = (id: string) => {
    const idx = issue.pages.findIndex((p) => p.id === id);
    const p = issue.pages[idx];
    if (!p) return id.slice(0, 6);
    const title =
      (p.data as { title?: string; headline?: string })?.title ??
      (p.data as { headline?: string })?.headline ??
      "";
    return `p.${idx + 1} · ${p.pageType}${title ? ` · ${title.slice(0, 32)}` : ""}`;
  };
  const libName = (id?: string) =>
    library.find((l) => l.id === id)?.file_name ?? id ?? "—";

  async function handlePropose() {
    if (!instruction.trim()) return;
    setBusy(true);
    setPlan(null);
    setExcluded(new Set());
    try {
      const result = await propose({
        data: {
          instruction: instruction.trim(),
          publication: publicationName ?? "",
          pages: issue.pages.map((p, i) => ({
            id: p.id,
            index: i,
            pageType: p.pageType,
            title:
              (p.data as { title?: string; headline?: string })?.title ??
              (p.data as { headline?: string })?.headline ??
              "",
          })),
          library: library.map((a) => ({
            id: a.id,
            fileName: a.file_name,
            mimeType: a.mime_type,
            kind: a.kind,
            summary: (a.extracted_text ?? "").slice(0, 300),
          })),
        },
      });
      setPlan(result);
      if (result.operations.length === 0) {
        toast.info("No operations proposed — try a more specific instruction.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate plan.");
    } finally {
      setBusy(false);
    }
  }

  function handleApply() {
    if (!plan) return;
    const ops = plan.operations.filter((_, i) => !excluded.has(i));
    if (!ops.length) {
      toast.info("Nothing selected to apply.");
      return;
    }
    const r = onApply(ops);
    toast.success(
      `Applied ${r.applied} operation${r.applied === 1 ? "" : "s"}${
        r.skipped ? ` · ${r.skipped} skipped` : ""
      }.`,
    );
    setPlan(null);
    setInstruction("");
    setExcluded(new Set());
  }

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full max-w-[460px] border-l border-border bg-card shadow-xl flex flex-col"
      role="dialog"
      aria-label="AI layout proposal"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-[color:var(--ruby)]" />
          <span className="text-[11px] tracking-[0.3em] uppercase">
            AI Layout · Propose
          </span>
        </div>
        <button
          aria-label="Close"
          onClick={onClose}
          className="h-7 w-7 rounded hover:bg-secondary flex items-center justify-center"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-border space-y-2">
        <p className="text-xs text-muted-foreground">
          Describe what to lay out using items in your publication library
          ({library.length} item{library.length === 1 ? "" : "s"}). The AI
          returns a plan you can review before applying.
        </p>
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder='e.g. "Put the Smith interview on pages 4-5 with the hero image full-width on p.4; drop the Acme ad as a full-page on p.7."'
          rows={5}
          disabled={busy}
          className="text-sm"
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            onClick={handlePropose}
            disabled={busy || !instruction.trim() || library.length === 0}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            Propose plan
          </Button>
        </div>
        {library.length === 0 && (
          <p className="text-[11px] text-amber-600">
            Library is empty. Upload items via Files → Upload for Library.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!plan && !busy && (
          <div className="px-4 py-6 text-xs text-muted-foreground">
            No plan yet. Write an instruction and press Propose.
          </div>
        )}

        {plan && (
          <div className="px-4 py-3 space-y-3">
            <div className="text-xs leading-relaxed text-foreground/90 border-l-2 border-[color:var(--ruby)] pl-3">
              {plan.summary}
            </div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
              Operations · {plan.operations.length}
            </div>
            <ul className="space-y-1.5">
              {plan.operations.map((op, i) => {
                const skip = excluded.has(i);
                return (
                  <li
                    key={i}
                    className={`rounded border border-border p-2 text-xs space-y-1 transition ${
                      skip ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{opLabel[op.kind]}</span>
                          <span className="text-muted-foreground truncate">
                            {pageMeta(op.pageId)}
                          </span>
                        </div>
                        {op.kind === "add_image_block" && (
                          <div className="text-muted-foreground truncate">
                            {libName(op.attachmentId)}
                          </div>
                        )}
                        {op.kind === "add_text_block" && op.text && (
                          <div className="text-muted-foreground line-clamp-2">
                            "{op.text.slice(0, 120)}"
                          </div>
                        )}
                        {op.kind === "set_field" && (
                          <div className="text-muted-foreground truncate">
                            {op.field}: {op.value?.slice(0, 80)}
                          </div>
                        )}
                        {op.rationale && (
                          <div className="text-[11px] text-muted-foreground italic mt-0.5">
                            {op.rationale}
                          </div>
                        )}
                      </div>
                      <label className="text-[10px] flex items-center gap-1 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={!skip}
                          onChange={(e) => {
                            const next = new Set(excluded);
                            if (e.target.checked) next.delete(i);
                            else next.add(i);
                            setExcluded(next);
                          }}
                        />
                        keep
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {plan && plan.operations.length > 0 && (
        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPlan(null)}>
            Discard
          </Button>
          <Button size="sm" onClick={handleApply}>
            Apply {plan.operations.length - excluded.size} of {plan.operations.length}
          </Button>
        </div>
      )}
    </div>
  );
}
