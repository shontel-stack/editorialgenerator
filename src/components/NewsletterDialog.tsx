import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, FileText, Link as LinkIcon, Loader2, Sparkles, X } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { IssueDoc, IssuePageNode } from "@/lib/coverDefaults";
import {
  buildNewsletterHtml,
  buildNewsletterInner,
  type NewsletterData,
  type NewsletterHighlight,
} from "@/lib/newsletter";
import { generateNewsletterHighlights } from "@/lib/newsletter.functions";
import { snapshotIssue } from "@/lib/issue-snapshot";
import type { ExportDim } from "@/lib/exportCover";
import { loadHtmlToImage, loadJsPdf } from "@/lib/browser-export-deps";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: IssueDoc;
  issueSlug: string;
  /** Live DOM nodes for each issue page, used to build the interactive PDF. */
  pageNodes?: Map<string, HTMLDivElement | null>;
  /** Issue page dimensions (inches + px) used for the interactive PDF. */
  pageDim?: ExportDim;
};

function imageForPage(p: IssuePageNode): string | null {
  const d = p.data as { imageUrl?: string | null };
  return d?.imageUrl ?? null;
}

function download(filename: string, mime: string, content: Blob | string) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function NewsletterDialog({
  open,
  onOpenChange,
  issue,
  issueSlug,
  pageNodes,
  pageDim,
}: Props) {
  const generate = useServerFn(generateNewsletterHighlights);
  const previewRef = useRef<HTMLDivElement>(null);

  const [busy, setBusy] = useState<"gen" | "pdf" | "ipdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<NewsletterData | null>(null);

  const issueLabel = useMemo(
    () => issue.meta.issue || "Newsletter",
    [issue.meta.issue],
  );
  const dateLabel = useMemo(() => issue.meta.date || "", [issue.meta.date]);

  // Auto-generate when first opened (and there's nothing yet).
  useEffect(() => {
    if (!open || data || busy) return;
    void doGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const doGenerate = async () => {
    setBusy("gen");
    setError(null);
    try {
      const snap = snapshotIssue(issue);
      const result = await generate({
        data: {
          publication: issue.master.publication || "The Arts Today",
          issueLabel,
          dateLabel,
          pages: snap.pages.map((p) => ({
            id: p.id,
            pageType: p.pageType,
            title: p.title,
          })),
        },
      });

      const highlights: NewsletterHighlight[] = result.highlights.map((h) => {
        const page = issue.pages.find((p) => p.id === h.pageId);
        return {
          pageId: h.pageId,
          title: h.title,
          blurb: h.blurb,
          imageUrl: page ? imageForPage(page) : null,
        };
      });

      setData({
        publication: issue.master.publication || "The Arts Today",
        issueLabel,
        dateLabel,
        tagline: "Your Source for Art Appreciation",
        subject: result.subject,
        preheader: result.preheader,
        intro: result.intro,
        highlights,
        ctaLabel: result.ctaLabel || "Read this issue",
        ctaUrl: "",
        footer: `${issue.master.publication || "The Arts Today"} · ${dateLabel}`,
      });
    } catch (e) {
      setError((e as Error).message || "Could not generate newsletter.");
    } finally {
      setBusy(null);
    }
  };

  const html = useMemo(() => (data ? buildNewsletterHtml(data) : ""), [data]);
  const inner = useMemo(() => (data ? buildNewsletterInner(data) : ""), [data]);

  const onCopy = async () => {
    if (!html) return;
    await navigator.clipboard.writeText(html);
  };

  const onDownloadHtml = () => {
    if (!html) return;
    download(`${issueSlug || "newsletter"}-email.html`, "text/html", html);
  };

  const onDownloadPdf = async () => {
    const node = previewRef.current;
    if (!node) return;
    setBusy("pdf");
    try {
      const rect = node.getBoundingClientRect();
      const widthPx = Math.max(600, Math.round(rect.width));
      const heightPx = Math.max(800, Math.round(rect.height));
      const [{ toJpeg }, { jsPDF }] = await Promise.all([
        loadHtmlToImage(),
        loadJsPdf(),
      ]);
      const jpeg = await toJpeg(node, {
        width: widthPx,
        height: heightPx,
        pixelRatio: 2,
        cacheBust: true,
        quality: 0.95,
        backgroundColor: "#f5f3ee",
      });
      const PT_PER_IN = 72;
      const widthIn = 8.5;
      const heightIn = (heightPx / widthPx) * widthIn;
      const pdf = new jsPDF({
        unit: "in",
        format: [widthIn, heightIn],
        orientation: widthIn > heightIn ? "landscape" : "portrait",
        compress: true,
      });
      pdf.addImage(jpeg, "JPEG", 0, 0, widthIn, heightIn, undefined, "FAST");
      pdf.save(`${issueSlug || "newsletter"}-email.pdf`);
      void PT_PER_IN;
    } catch (e) {
      setError((e as Error).message || "Could not export PDF.");
    } finally {
      setBusy(null);
    }
  };

  const onDownloadInteractivePdf = async () => {
    const node = previewRef.current;
    if (!node || !data) return;
    if (!pageNodes || !pageDim) {
      setError("Interactive PDF requires the issue pages to be mounted.");
      return;
    }
    setBusy("ipdf");
    setError(null);
    try {
      const map = new Map<string, HTMLElement>();
      pageNodes.forEach((el, id) => {
        if (el) map.set(id, el);
      });
      const { exportNewsletterInteractivePdf } = await import("@/lib/newsletter-pdf");
      await exportNewsletterInteractivePdf({
        newsletterNode: node,
        pageNodes: map,
        highlightPageIds: data.highlights.map((h) => h.pageId),
        pageDim,
        filename: `${issueSlug || "newsletter"}-interactive.pdf`,
        meta: {
          title: `${issue.master.publication || "Newsletter"} — ${issueLabel}`,
          author: issue.master.publication || "The Arts Today",
          subject: dateLabel,
        },
      });
    } catch (e) {
      setError((e as Error).message || "Could not export interactive PDF.");
    } finally {
      setBusy(null);
    }
  };

  const patch = (p: Partial<NewsletterData>) =>
    setData((d) => (d ? { ...d, ...p } : d));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-[11px] tracking-[0.3em] uppercase">
              Newsletter · {issueLabel}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={doGenerate}
                disabled={busy !== null}
              >
                {busy === "gen" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Regenerate
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] max-h-[80vh]">
          {/* Editor */}
          <aside className="border-r overflow-y-auto p-4 space-y-4 bg-muted/30">
            {error ? (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {error}
              </div>
            ) : null}

            {busy === "gen" && !data ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting highlights…
              </div>
            ) : null}

            {data ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[10px] tracking-[0.25em] uppercase">Subject</Label>
                  <Input
                    value={data.subject}
                    onChange={(e) => patch({ subject: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] tracking-[0.25em] uppercase">Preheader</Label>
                  <Input
                    value={data.preheader}
                    onChange={(e) => patch({ preheader: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] tracking-[0.25em] uppercase">Intro</Label>
                  <Textarea
                    rows={3}
                    value={data.intro}
                    onChange={(e) => patch({ intro: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] tracking-[0.25em] uppercase">CTA label</Label>
                    <Input
                      value={data.ctaLabel}
                      onChange={(e) => patch({ ctaLabel: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] tracking-[0.25em] uppercase">CTA URL</Label>
                    <Input
                      placeholder="https://…"
                      value={data.ctaUrl}
                      onChange={(e) => patch({ ctaUrl: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="text-[10px] tracking-[0.25em] uppercase">Highlights</Label>
                  {data.highlights.map((h, i) => (
                    <div key={h.pageId + i} className="rounded border bg-background p-2 space-y-1.5">
                      <Input
                        value={h.title}
                        onChange={(e) => {
                          const next = [...data.highlights];
                          next[i] = { ...h, title: e.target.value };
                          patch({ highlights: next });
                        }}
                      />
                      <Textarea
                        rows={2}
                        value={h.blurb}
                        onChange={(e) => {
                          const next = [...data.highlights];
                          next[i] = { ...h, blurb: e.target.value };
                          patch({ highlights: next });
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-2 pt-2 sticky bottom-0">
                  <Button onClick={onCopy} variant="outline" size="sm">
                    <Copy className="h-3.5 w-3.5" /> Copy HTML
                  </Button>
                  <Button onClick={onDownloadHtml} variant="outline" size="sm">
                    <Download className="h-3.5 w-3.5" /> Download .html
                  </Button>
                  <Button onClick={onDownloadPdf} variant="outline" size="sm" disabled={busy !== null}>
                    {busy === "pdf" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    Download .pdf
                  </Button>
                  <Button
                    onClick={onDownloadInteractivePdf}
                    size="sm"
                    disabled={busy !== null || !pageNodes || !pageDim}
                    title={
                      !pageNodes || !pageDim
                        ? "Open the issue editor to enable interactive PDF"
                        : "Newsletter + linked issue pages with clickable highlights"
                    }
                  >
                    {busy === "ipdf" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LinkIcon className="h-3.5 w-3.5" />
                    )}
                    Download interactive .pdf
                  </Button>
                </div>
              </>
            ) : null}
          </aside>

          {/* Preview */}
          <div className="overflow-y-auto p-6 bg-[#f5f3ee]">
            {data ? (
              <div
                ref={previewRef}
                style={{ width: 600, margin: "0 auto", background: "#f5f3ee" }}
                dangerouslySetInnerHTML={{ __html: inner }}
              />
            ) : (
              <div className="text-xs text-muted-foreground p-8 text-center">
                {busy === "gen" ? "Drafting…" : "Press Regenerate to draft a newsletter."}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
