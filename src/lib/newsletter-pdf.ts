import { toJpeg } from "html-to-image";
import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFHexString,
  type PDFRef,
  type PDFDict,
} from "pdf-lib";

import type { ExportDim } from "./exportCover";

const PT_PER_IN = 72;

export type InteractiveNewsletterArgs = {
  newsletterNode: HTMLElement;
  /** Map of issue pageId -> DOM node for that page (rendered at full issue size). */
  pageNodes: Map<string, HTMLElement>;
  /** Ordered list of highlight target pageIds (links + appended pages). */
  highlightPageIds: string[];
  /** Issue page dimensions (used to size & render the appended issue pages). */
  pageDim: ExportDim;
  filename: string;
  meta?: { title?: string; author?: string; subject?: string };
};

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function downloadBlob(bytes: Uint8Array, filename: string, mime: string) {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const blob = new Blob([buf], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function addInternalLink(
  doc: PDFDocument,
  hostPageRef: PDFRef,
  targetPageRef: PDFRef,
  rect: [number, number, number, number],
) {
  const annot = doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: rect,
    Border: [0, 0, 0],
    Dest: [targetPageRef, "Fit"],
  });
  const annotRef = doc.context.register(annot);
  const hostPage = doc.context.lookup(hostPageRef) as PDFDict;
  const existing = hostPage.get(PDFName.of("Annots"));
  const annotsArr = PDFArray.withContext(doc.context);
  if (existing instanceof PDFArray) {
    existing.asArray().forEach((e) => annotsArr.push(e));
  }
  annotsArr.push(annotRef);
  hostPage.set(PDFName.of("Annots"), annotsArr);
}

function buildOutline(
  doc: PDFDocument,
  items: Array<{ title: string; ref: PDFRef }>,
) {
  if (items.length === 0) return;
  const outlinesRef = doc.context.nextRef();
  const itemRefs = items.map(() => doc.context.nextRef());
  items.forEach((it, i) => {
    const fields: Record<string, unknown> = {
      Title: PDFHexString.fromText(it.title),
      Parent: outlinesRef,
      Dest: [it.ref, "Fit"],
    };
    if (i > 0) fields.Prev = itemRefs[i - 1];
    if (i < items.length - 1) fields.Next = itemRefs[i + 1];
    const obj = doc.context.obj(
      fields as unknown as Parameters<typeof doc.context.obj>[0],
    );
    doc.context.assign(itemRefs[i], obj);
  });
  const outlinesDict = doc.context.obj({
    Type: "Outlines",
    First: itemRefs[0],
    Last: itemRefs[itemRefs.length - 1],
    Count: PDFNumber.of(items.length),
  } as unknown as Parameters<typeof doc.context.obj>[0]);
  doc.context.assign(outlinesRef, outlinesDict);
  doc.catalog.set(PDFName.of("Outlines"), outlinesRef);
}

/**
 * Build an interactive PDF whose first page is the newsletter and whose
 * subsequent pages are the issue pages targeted by each highlight. Each
 * highlight card on the newsletter page is a clickable link annotation
 * jumping to the matching article page.
 */
export async function exportNewsletterInteractivePdf(
  args: InteractiveNewsletterArgs,
): Promise<void> {
  const { newsletterNode, pageNodes, highlightPageIds, pageDim, filename, meta } = args;

  // 1) Render the newsletter preview to JPEG.
  const nlRect = newsletterNode.getBoundingClientRect();
  const nlW = Math.max(600, Math.round(nlRect.width));
  const nlH = Math.max(800, Math.round(nlRect.height));
  const newsletterJpeg = await toJpeg(newsletterNode, {
    width: nlW,
    height: nlH,
    pixelRatio: 2,
    cacheBust: true,
    quality: 0.95,
    backgroundColor: "#f5f3ee",
  });

  // 2) Render each highlight target page (de-duped, in order).
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  for (const id of highlightPageIds) {
    if (seen.has(id)) continue;
    if (!pageNodes.get(id)) continue;
    seen.add(id);
    orderedIds.push(id);
  }

  const pageJpegs: Array<{ id: string; jpeg: string }> = [];
  for (const id of orderedIds) {
    const node = pageNodes.get(id)!;
    const jpeg = await toJpeg(node, {
      width: pageDim.px.w,
      height: pageDim.px.h,
      pixelRatio: 1,
      cacheBust: true,
      quality: 0.95,
      backgroundColor: "#ffffff",
    });
    pageJpegs.push({ id, jpeg });
  }

  // 3) Build the PDF.
  const doc = await PDFDocument.create();
  if (meta?.title) doc.setTitle(meta.title);
  if (meta?.author) doc.setAuthor(meta.author);
  if (meta?.subject) doc.setSubject(meta.subject);
  doc.setProducer("The Arts Today — Newsletter");
  doc.setCreator("Pageluxe");

  // Newsletter page: scale width to 8" letter-like; height by aspect.
  const NL_W_IN = 8;
  const NL_H_IN = (nlH / nlW) * NL_W_IN;
  const NL_W_PT = NL_W_IN * PT_PER_IN;
  const NL_H_PT = NL_H_IN * PT_PER_IN;

  const nlImage = await doc.embedJpg(dataUrlToBytes(newsletterJpeg));
  const nlPage = doc.addPage([NL_W_PT, NL_H_PT]);
  nlPage.drawImage(nlImage, { x: 0, y: 0, width: NL_W_PT, height: NL_H_PT });

  // Issue pages.
  const PAGE_W_PT = pageDim.inches.w * PT_PER_IN;
  const PAGE_H_PT = pageDim.inches.h * PT_PER_IN;
  const pageRefById = new Map<string, PDFRef>();
  const outlineItems: Array<{ title: string; ref: PDFRef }> = [
    { title: "Newsletter", ref: nlPage.ref },
  ];

  for (const { id, jpeg } of pageJpegs) {
    const img = await doc.embedJpg(dataUrlToBytes(jpeg));
    const p = doc.addPage([PAGE_W_PT, PAGE_H_PT]);
    p.drawImage(img, { x: 0, y: 0, width: PAGE_W_PT, height: PAGE_H_PT });
    pageRefById.set(id, p.ref);
    outlineItems.push({ title: id, ref: p.ref });
  }

  // 4) Add link annotations on the newsletter page over each highlight row.
  const linkEls = newsletterNode.querySelectorAll<HTMLElement>(
    "[data-link-row][data-link-target]",
  );
  const sx = NL_W_PT / nlRect.width;
  const sy = NL_H_PT / nlRect.height;
  linkEls.forEach((el) => {
    const targetId = el.dataset.linkTarget;
    if (!targetId) return;
    const targetRef = pageRefById.get(targetId);
    if (!targetRef) return;
    const r = el.getBoundingClientRect();
    const x1 = (r.left - nlRect.left) * sx;
    const x2 = (r.right - nlRect.left) * sx;
    const y2 = NL_H_PT - (r.top - nlRect.top) * sy;
    const y1 = NL_H_PT - (r.bottom - nlRect.top) * sy;
    addInternalLink(doc, nlPage.ref, targetRef, [x1, y1, x2, y2]);
  });

  buildOutline(doc, outlineItems);
  doc.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));

  const bytes = await doc.save();
  downloadBlob(bytes, filename, "application/pdf");
}
