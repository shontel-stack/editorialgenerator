import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, Image as ImageIcon, Upload, X, Loader2 } from "lucide-react";
import { loadPdf, type LoadedPdf } from "@/lib/pdfRender";
import { parseIdml, suggestFieldsFromIdml, type IdmlExtract } from "@/lib/idmlParse";
import { uploadPageBackground, loadImageDimensions } from "@/lib/pageBackgrounds";
import { toast } from "sonner";

export type BackgroundAssignment = {
  pageId: string;
  url: string;
  sourceKind: "pdf" | "image" | "idml+pdf";
  sourcePath: string;
  sourceFileName: string;
  pdfPageIndex?: number;
  crop?: "left" | "right" | "full";
  mode: "overlay" | "replace";
  width: number;
  height: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  issueId: string;
  /** Single page id when assigning to one page. */
  pageId?: string;
  /** Spread context: verso + recto page ids (left, right). */
  spread?: { left: string; right: string };
  defaultMode?: "overlay" | "replace";
  onApply: (assignments: BackgroundAssignment[], idml?: ReturnType<typeof suggestFieldsFromIdml>) => void;
};

type Stage = "pick" | "pdf" | "idml" | "uploading";

export function PageBackgroundUploader({
  open, onClose, issueId, pageId, spread, defaultMode = "replace", onApply,
}: Props) {
  const [stage, setStage] = useState<Stage>("pick");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"overlay" | "replace">(defaultMode);
  // PDF state
  const pdfRef = useRef<LoadedPdf | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPage2, setPdfPage2] = useState(2);
  const [spreadStrategy, setSpreadStrategy] = useState<"split" | "two-pages">("split");
  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // IDML state
  const [idmlExtract, setIdmlExtract] = useState<IdmlExtract | null>(null);
  const [idmlCompanionPdf, setIdmlCompanionPdf] = useState<File | null>(null);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      void pdfRef.current?.destroy();
      pdfRef.current = null;
      setStage("pick"); setBusy(false);
      setPdfFile(null); setThumbs([]); setPdfPage(1); setPdfPage2(2);
      setImageFile(null); setImagePreview(null);
      setIdmlExtract(null); setIdmlCompanionPdf(null);
      setMode(defaultMode);
      setSpreadStrategy("split");
    }
  }, [open, defaultMode]);

  const isSpread = !!spread;

  async function handleFile(file: File) {
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (ext === "pdf" || file.type === "application/pdf") {
      await openPdf(file);
    } else if (ext === "idml") {
      await openIdml(file);
    } else if (file.type.startsWith("image/")) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setStage("pick");
    } else {
      toast.error("Unsupported file. Use PDF, JPG/PNG/WebP, or IDML.");
    }
  }

  async function openPdf(file: File) {
    setBusy(true);
    try {
      const pdf = await loadPdf(file);
      pdfRef.current = pdf;
      setPdfFile(file);
      const ts: string[] = [];
      const limit = Math.min(pdf.numPages, 20);
      for (let i = 1; i <= limit; i++) {
        ts.push(await pdf.thumbnail({ pageIndex: i, width: 110 }));
      }
      setThumbs(ts);
      setPdfPage(1);
      setPdfPage2(Math.min(2, pdf.numPages));
      setStage("pdf");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't open that PDF.");
    } finally { setBusy(false); }
  }

  async function openIdml(file: File) {
    setBusy(true);
    try {
      const x = await parseIdml(file);
      setIdmlExtract(x);
      setStage("idml");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't parse that IDML.");
    } finally { setBusy(false); }
  }

  async function applyImage() {
    if (!imageFile) return;
    setBusy(true); setStage("uploading");
    try {
      const dims = await loadImageDimensions(imageFile);
      const targets = isSpread ? [spread!.left, spread!.right] : [pageId!];
      const assigns: BackgroundAssignment[] = [];
      for (const pid of targets) {
        const up = await uploadPageBackground({
          issueId, pageId: pid, blob: imageFile, fileName: imageFile.name,
          width: dims.width, height: dims.height,
        });
        assigns.push({
          pageId: pid, url: up.url, sourceKind: "image",
          sourcePath: up.path, sourceFileName: imageFile.name,
          crop: "full", mode, width: up.width, height: up.height,
        });
      }
      onApply(assigns);
      toast.success(isSpread ? "Spread background set." : "Background set.");
      onClose();
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message);
      setStage("pick");
    } finally { setBusy(false); }
  }

  async function applyPdf() {
    if (!pdfRef.current || !pdfFile) return;
    setBusy(true); setStage("uploading");
    try {
      const assigns: BackgroundAssignment[] = [];
      if (isSpread && spreadStrategy === "split") {
        // Render once, assign to both pages with crop=left/right.
        const r = await pdfRef.current.renderPage({ pageIndex: pdfPage, targetWidth: 3200 });
        const baseName = `${pdfFile.name.replace(/\.pdf$/i, "")}-p${pdfPage}.png`;
        const upL = await uploadPageBackground({
          issueId, pageId: spread!.left, blob: r.blob,
          fileName: baseName, width: r.width, height: r.height,
        });
        assigns.push({
          pageId: spread!.left, url: upL.url, sourceKind: "pdf",
          sourcePath: upL.path, sourceFileName: pdfFile.name,
          pdfPageIndex: pdfPage, crop: "left", mode, width: r.width, height: r.height,
        });
        const upR = await uploadPageBackground({
          issueId, pageId: spread!.right, blob: r.blob,
          fileName: baseName, width: r.width, height: r.height,
        });
        assigns.push({
          pageId: spread!.right, url: upR.url, sourceKind: "pdf",
          sourcePath: upR.path, sourceFileName: pdfFile.name,
          pdfPageIndex: pdfPage, crop: "right", mode, width: r.width, height: r.height,
        });
      } else if (isSpread) {
        // Two-page strategy.
        for (const [pageNum, pid] of [[pdfPage, spread!.left], [pdfPage2, spread!.right]] as const) {
          const r = await pdfRef.current.renderPage({ pageIndex: pageNum, targetWidth: 2400 });
          const up = await uploadPageBackground({
            issueId, pageId: pid, blob: r.blob,
            fileName: `${pdfFile.name.replace(/\.pdf$/i, "")}-p${pageNum}.png`,
            width: r.width, height: r.height,
          });
          assigns.push({
            pageId: pid, url: up.url, sourceKind: "pdf",
            sourcePath: up.path, sourceFileName: pdfFile.name,
            pdfPageIndex: pageNum, crop: "full", mode, width: r.width, height: r.height,
          });
        }
      } else {
        const r = await pdfRef.current.renderPage({ pageIndex: pdfPage, targetWidth: 2400 });
        const up = await uploadPageBackground({
          issueId, pageId: pageId!, blob: r.blob,
          fileName: `${pdfFile.name.replace(/\.pdf$/i, "")}-p${pdfPage}.png`,
          width: r.width, height: r.height,
        });
        assigns.push({
          pageId: pageId!, url: up.url, sourceKind: "pdf",
          sourcePath: up.path, sourceFileName: pdfFile.name,
          pdfPageIndex: pdfPage, crop: "full", mode, width: r.width, height: r.height,
        });
      }
      onApply(assigns);
      toast.success("Background set from PDF.");
      onClose();
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message);
      setStage("pdf");
    } finally { setBusy(false); }
  }

  async function applyIdml() {
    if (!idmlExtract || !idmlCompanionPdf) {
      toast.error("Please also upload a companion PDF for the visual.");
      return;
    }
    setBusy(true); setStage("uploading");
    try {
      const pdf = await loadPdf(idmlCompanionPdf);
      const useSpread = isSpread && pdf.numPages >= 2;
      const targets = useSpread
        ? [{ pageNum: 1, pid: spread!.left }, { pageNum: 2, pid: spread!.right }]
        : isSpread
        ? [{ pageNum: 1, pid: spread!.left }, { pageNum: 1, pid: spread!.right, crop: "right" as const }]
        : [{ pageNum: 1, pid: pageId! }];
      // Adjust first entry crop for spread+single-page fallback.
      if (isSpread && !useSpread) {
        (targets[0] as { crop?: "left" | "right" | "full" }).crop = "left";
      }
      const assigns: BackgroundAssignment[] = [];
      for (const t of targets) {
        const r = await pdf.renderPage({ pageIndex: t.pageNum, targetWidth: 2400 });
        const up = await uploadPageBackground({
          issueId, pageId: t.pid, blob: r.blob,
          fileName: `${idmlCompanionPdf.name.replace(/\.pdf$/i, "")}-p${t.pageNum}.png`,
          width: r.width, height: r.height,
        });
        assigns.push({
          pageId: t.pid, url: up.url, sourceKind: "idml+pdf",
          sourcePath: up.path,
          sourceFileName: `${idmlExtract.fileName} + ${idmlCompanionPdf.name}`,
          pdfPageIndex: t.pageNum,
          crop: (t as { crop?: "left" | "right" | "full" }).crop ?? "full",
          mode, width: r.width, height: r.height,
        });
      }
      await pdf.destroy();
      onApply(assigns, suggestFieldsFromIdml(idmlExtract));
      toast.success("Background set from IDML + PDF.");
      onClose();
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message);
      setStage("idml");
    } finally { setBusy(false); }
  }

  const ModeToggle = (
    <div className="space-y-2">
      <Label className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground">Render mode</Label>
      <RadioGroup value={mode} onValueChange={(v) => setMode(v as "overlay" | "replace")} className="grid grid-cols-2 gap-2">
        <Label className="flex items-start gap-2 border border-border rounded-md px-3 py-2 cursor-pointer has-[:checked]:border-foreground">
          <RadioGroupItem value="replace" className="mt-1" />
          <div>
            <div className="text-sm font-medium">Replace page</div>
            <div className="text-[11px] text-muted-foreground">Hide template. Custom blocks render on top.</div>
          </div>
        </Label>
        <Label className="flex items-start gap-2 border border-border rounded-md px-3 py-2 cursor-pointer has-[:checked]:border-foreground">
          <RadioGroupItem value="overlay" className="mt-1" />
          <div>
            <div className="text-sm font-medium">Overlay template</div>
            <div className="text-[11px] text-muted-foreground">Show template + blocks on top of the artwork.</div>
          </div>
        </Label>
      </RadioGroup>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isSpread ? "Spread background artwork" : "Page background artwork"}
          </DialogTitle>
        </DialogHeader>

        {stage === "uploading" && (
          <div className="py-10 flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
          </div>
        )}

        {stage === "pick" && (
          <div className="space-y-4">
            <PickerArea onFile={handleFile} busy={busy} />
            {imageFile && imagePreview && (
              <div className="border border-border rounded-md p-3 flex gap-3">
                <img src={imagePreview} alt="" className="h-20 w-20 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{imageFile.name}</div>
                  <div className="text-[11px] text-muted-foreground">{(imageFile.size/1024).toFixed(0)} KB</div>
                  <div className="mt-2">{ModeToggle}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {stage === "pdf" && pdfFile && pdfRef.current && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="text-sm">
              <span className="font-medium">{pdfFile.name}</span>
              <span className="text-muted-foreground"> · {pdfRef.current.numPages} page(s)</span>
            </div>
            {isSpread && (
              <div className="space-y-2">
                <Label className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground">Spread strategy</Label>
                <RadioGroup value={spreadStrategy} onValueChange={(v) => setSpreadStrategy(v as "split" | "two-pages")} className="grid grid-cols-2 gap-2">
                  <Label className="flex items-start gap-2 border border-border rounded-md px-3 py-2 cursor-pointer has-[:checked]:border-foreground">
                    <RadioGroupItem value="split" className="mt-1" />
                    <div>
                      <div className="text-sm font-medium">Split one page</div>
                      <div className="text-[11px] text-muted-foreground">Left half → verso, right half → recto.</div>
                    </div>
                  </Label>
                  <Label className="flex items-start gap-2 border border-border rounded-md px-3 py-2 cursor-pointer has-[:checked]:border-foreground">
                    <RadioGroupItem value="two-pages" className="mt-1" />
                    <div>
                      <div className="text-sm font-medium">Two pages</div>
                      <div className="text-[11px] text-muted-foreground">Pick the verso and recto page numbers.</div>
                    </div>
                  </Label>
                </RadioGroup>
              </div>
            )}
            <div>
              <Label className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground">
                {isSpread && spreadStrategy === "two-pages" ? "Verso page" : "Page"}
              </Label>
              <ThumbGrid thumbs={thumbs} value={pdfPage} onChange={setPdfPage} />
            </div>
            {isSpread && spreadStrategy === "two-pages" && (
              <div>
                <Label className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground">Recto page</Label>
                <ThumbGrid thumbs={thumbs} value={pdfPage2} onChange={setPdfPage2} />
              </div>
            )}
            {ModeToggle}
          </div>
        )}

        {stage === "idml" && idmlExtract && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="text-sm">
              <span className="font-medium">{idmlExtract.fileName}</span>
              <span className="text-muted-foreground"> · {idmlExtract.stories.length} text story(ies) parsed</span>
            </div>
            <div className="border border-border rounded-md p-3 max-h-40 overflow-y-auto text-[12px] whitespace-pre-wrap">
              {idmlExtract.flat || "(no text content found)"}
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground">Companion PDF (required for the visual)</Label>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setIdmlCompanionPdf(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
              {idmlCompanionPdf && (
                <div className="text-[11px] text-muted-foreground">{idmlCompanionPdf.name}</div>
              )}
            </div>
            {ModeToggle}
            <div className="text-[11px] text-muted-foreground">
              Parsed text will be offered as suggestions to fill the page fields after the background is applied.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          {stage === "pick" && imageFile && (
            <Button onClick={applyImage} disabled={busy}>Use image</Button>
          )}
          {stage === "pdf" && (
            <Button onClick={applyPdf} disabled={busy}>Apply PDF page</Button>
          )}
          {stage === "idml" && (
            <Button onClick={applyIdml} disabled={busy || !idmlCompanionPdf}>Apply IDML + PDF</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PickerArea({ onFile, busy }: { onFile: (f: File) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-secondary/40 transition"
      onClick={() => inputRef.current?.click()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      onDragOver={(e) => e.preventDefault()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.idml,application/pdf,image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
      <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
      <div className="mt-2 text-sm">{busy ? "Reading…" : "Drop a file here, or click to choose"}</div>
      <div className="mt-1 text-[11px] text-muted-foreground flex items-center justify-center gap-3">
        <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> PDF</span>
        <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" /> JPG / PNG / WebP</span>
        <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> IDML (+ PDF)</span>
      </div>
    </div>
  );
}

function ThumbGrid({ thumbs, value, onChange }: { thumbs: string[]; value: number; onChange: (n: number) => void }) {
  return (
    <div className="mt-1 grid grid-cols-5 gap-2">
      {thumbs.map((src, i) => {
        const n = i + 1;
        const active = n === value;
        return (
          <button
            type="button"
            key={n}
            onClick={() => onChange(n)}
            className={`relative border rounded-md overflow-hidden transition ${active ? "border-foreground ring-2 ring-foreground" : "border-border hover:border-foreground/50"}`}
          >
            <img src={src} alt={`Page ${n}`} className="block w-full" />
            <span className="absolute bottom-1 right-1 text-[10px] bg-foreground/80 text-background px-1 rounded">{n}</span>
          </button>
        );
      })}
    </div>
  );
}

// Suppress unused import warning in some builds.
void X;
