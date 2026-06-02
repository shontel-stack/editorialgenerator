import { toJpeg, toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { PDFDocument, PDFName, PDFNumber, PDFString, PDFHexString, type PDFRef } from "pdf-lib";
import { COVER_INCHES, COVER_PX, type PageType } from "./coverDefaults";

/* -------- single-page exports (per-page) -------- */

async function renderNodeToPng(node: HTMLElement): Promise<string> {
  return toPng(node, {
    width: COVER_PX.w,
    height: COVER_PX.h,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: "#ffffff",
  });
}

async function renderNodeToJpeg(node: HTMLElement): Promise<string> {
  return toJpeg(node, {
    width: COVER_PX.w,
    height: COVER_PX.h,
    pixelRatio: 1,
    cacheBust: true,
    quality: 0.95,
    backgroundColor: "#ffffff",
  });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadBlob(bytes: Uint8Array, filename: string, mime: string) {
  // Copy into a plain ArrayBuffer to satisfy BlobPart typing (avoids SharedArrayBuffer union).
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

export async function exportPng(node: HTMLElement, filename: string) {
  const url = await renderNodeToPng(node);
  downloadDataUrl(url, filename);
}

export async function exportJpeg(node: HTMLElement, filename: string) {
  const url = await renderNodeToJpeg(node);
  downloadDataUrl(url, filename);
}

export async function exportPdf(node: HTMLElement, filename: string) {
  const url = await renderNodeToJpeg(node);
  const pdf = new jsPDF({
    unit: "in",
    format: [COVER_INCHES.w, COVER_INCHES.h],
    orientation: "portrait",
    compress: true,
  });
  pdf.addImage(url, "JPEG", 0, 0, COVER_INCHES.w, COVER_INCHES.h, undefined, "FAST");
  pdf.save(filename);
}

/* -------- multi-page INTERACTIVE issue PDF -------- */

const PT_PER_IN = 72;
const PAGE_W = COVER_INCHES.w * PT_PER_IN; // 768 pt
const PAGE_H = COVER_INCHES.h * PT_PER_IN; // 1024 pt

export type IssuePage = {
  pageType: PageType;
  node: HTMLElement;
  label: string;
};

export type IssueMeta = {
  title: string;
  author: string;
  subject?: string;
};

/**
 * Bundle pages into a single multi-page PDF with:
 *  - Document outline (bookmarks) for each page
 *  - Invisible Link annotations on Contents entries that jump to target pages
 *  - PDF metadata (title, author)
 *
 * Contents-page links are discovered by querying the contents node for
 *   [data-link-row][data-link-target="<pageType>"]
 * elements; their on-screen rect is converted to PDF coords (y-flipped).
 */
export async function exportIssuePdf(
  pages: IssuePage[],
  meta: IssueMeta,
  filename: string,
) {
  const doc = await PDFDocument.create();
  doc.setTitle(meta.title);
  doc.setAuthor(meta.author);
  if (meta.subject) doc.setSubject(meta.subject);
  doc.setProducer("The Arts Today — Page Generator");
  doc.setCreator("Pageluxe");

  const pageRefs: PDFRef[] = [];
  const pageByType: Partial<Record<PageType, { index: number; ref: PDFRef }>> = {};

  // 1. Render each node to JPEG, add as full-bleed page image
  for (let i = 0; i < pages.length; i++) {
    const { node, pageType } = pages[i];
    const jpegDataUrl = await renderNodeToJpeg(node);
    const jpegBytes = dataUrlToBytes(jpegDataUrl);
    const image = await doc.embedJpg(jpegBytes);
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawImage(image, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
    pageRefs.push(page.ref);
    pageByType[pageType] = { index: i, ref: page.ref };
  }

  // 2. Add invisible Link annotations on contents entries that have a target
  for (let i = 0; i < pages.length; i++) {
    const { node, pageType } = pages[i];
    if (pageType !== "contents") continue;
    const page = doc.getPages()[i];
    const nodeRect = node.getBoundingClientRect();
    const linkEls = node.querySelectorAll<HTMLElement>("[data-link-row][data-link-target]");
    linkEls.forEach((el) => {
      const targetType = el.dataset.linkTarget as PageType | undefined;
      if (!targetType || targetType === pageType) return;
      const targetPage = pageByType[targetType];
      if (!targetPage) return;
      const r = el.getBoundingClientRect();
      const sx = PAGE_W / nodeRect.width;
      const sy = PAGE_H / nodeRect.height;
      const x1 = (r.left - nodeRect.left) * sx;
      const x2 = (r.right - nodeRect.left) * sx;
      // PDF origin is bottom-left; flip Y from HTML's top-left.
      const y2 = PAGE_H - (r.top - nodeRect.top) * sy;
      const y1 = PAGE_H - (r.bottom - nodeRect.top) * sy;
      addInternalLink(doc, page.ref, targetPage.ref, [x1, y1, x2, y2]);
    });
  }

  // 3. Build document outline (bookmarks)
  buildOutline(
    doc,
    pages.map((p, i) => ({ title: p.label, ref: pageRefs[i] })),
  );

  // 4. Open with page-mode UseOutlines (sidebar visible by default)
  doc.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));

  const bytes = await doc.save();
  downloadBlob(bytes, filename, "application/pdf");
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
    Border: [0, 0, 0], // invisible border
    Dest: [targetPageRef, "Fit"],
  });
  const annotRef = doc.context.register(annot);
  const hostPage = doc.context.lookup(hostPageRef);
  // hostPage is a PDFPageLeaf dict; append to Annots array
  const existing = (hostPage as { get: (k: PDFName) => unknown }).get(PDFName.of("Annots"));
  const annotsArr = doc.context.obj(
    Array.isArray((existing as { array?: unknown[] })?.array)
      ? [...(existing as { array: unknown[] }).array, annotRef]
      : [annotRef],
  );
  (hostPage as { set: (k: PDFName, v: unknown) => void }).set(
    PDFName.of("Annots"),
    annotsArr,
  );
}

function buildOutline(
  doc: PDFDocument,
  items: Array<{ title: string; ref: PDFRef }>,
) {
  if (items.length === 0) return;

  // Pre-allocate refs for the outlines dict and each item so we can link them.
  const outlinesRef = doc.context.nextRef();
  const itemRefs = items.map(() => doc.context.nextRef());

  items.forEach((it, i) => {
    const itemDict: Record<string, unknown> = {
      Title: PDFHexString.fromText(it.title),
      Parent: outlinesRef,
      Dest: [it.ref, "Fit"],
    };
    if (i > 0) itemDict.Prev = itemRefs[i - 1];
    if (i < items.length - 1) itemDict.Next = itemRefs[i + 1];
    const obj = doc.context.obj(itemDict);
    doc.context.assign(itemRefs[i], obj);
  });

  const outlinesDict = doc.context.obj({
    Type: "Outlines",
    First: itemRefs[0],
    Last: itemRefs[itemRefs.length - 1],
    Count: PDFNumber.of(items.length),
  });
  doc.context.assign(outlinesRef, outlinesDict);
  doc.catalog.set(PDFName.of("Outlines"), outlinesRef);
}

// Silence unused-import warning if PDFString ever gets removed later.
void PDFString;
