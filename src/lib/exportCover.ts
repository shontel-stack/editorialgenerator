import { COVER_INCHES, COVER_PX, type PageType } from "./coverDefaults";
import type { PDFDocument, PDFRef, PDFDict } from "pdf-lib";

type PdfLib = typeof import("pdf-lib");

/* -------- dimension helpers -------- */

export type ExportDim = {
  inches: { w: number; h: number };
  px: { w: number; h: number };
};

const DEFAULT_DIM: ExportDim = {
  inches: { w: COVER_INCHES.w, h: COVER_INCHES.h },
  px: { w: COVER_PX.w, h: COVER_PX.h },
};

/* -------- single-page exports -------- */

async function renderNodeToPng(node: HTMLElement, dim: ExportDim): Promise<string> {
  const { toPng } = await import("html-to-image");
  return toPng(node, {
    width: dim.px.w,
    height: dim.px.h,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: "#ffffff",
  });
}

async function renderNodeToJpeg(node: HTMLElement, dim: ExportDim): Promise<string> {
  const { toJpeg } = await import("html-to-image");
  return toJpeg(node, {
    width: dim.px.w,
    height: dim.px.h,
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

export async function exportPng(node: HTMLElement, filename: string, dim: ExportDim = DEFAULT_DIM) {
  const url = await renderNodeToPng(node, dim);
  downloadDataUrl(url, filename);
}

export async function exportJpeg(node: HTMLElement, filename: string, dim: ExportDim = DEFAULT_DIM) {
  const url = await renderNodeToJpeg(node, dim);
  downloadDataUrl(url, filename);
}

export async function exportPdf(node: HTMLElement, filename: string, dim: ExportDim = DEFAULT_DIM) {
  const url = await renderNodeToJpeg(node, dim);
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    unit: "in",
    format: [dim.inches.w, dim.inches.h],
    orientation: dim.inches.w > dim.inches.h ? "landscape" : "portrait",
    compress: true,
  });
  pdf.addImage(url, "JPEG", 0, 0, dim.inches.w, dim.inches.h, undefined, "FAST");
  pdf.save(filename);
}

/* -------- multi-page INTERACTIVE publication PDF -------- */

const PT_PER_IN = 72;

export type IssuePage = {
  id: string;
  pageType: PageType;
  node: HTMLElement;
  label: string;
};

export type IssueMeta = {
  title: string;
  author: string;
  subject?: string;
};

export async function exportIssuePdf(
  pages: IssuePage[],
  meta: IssueMeta,
  filename: string,
  dim: ExportDim = DEFAULT_DIM,
) {
  const PAGE_W = dim.inches.w * PT_PER_IN;
  const PAGE_H = dim.inches.h * PT_PER_IN;

  const pdfLib = await import("pdf-lib");
  const { PDFDocument, PDFName } = pdfLib;
  const doc = await PDFDocument.create();
  doc.setTitle(meta.title);
  doc.setAuthor(meta.author);
  if (meta.subject) doc.setSubject(meta.subject);
  doc.setProducer("The Arts Today — Page Generator");
  doc.setCreator("Pageluxe");

  const pageRefs: PDFRef[] = [];
  const pageById = new Map<string, { index: number; ref: PDFRef }>();

  for (let i = 0; i < pages.length; i++) {
    const { node, id } = pages[i];
    const jpegDataUrl = await renderNodeToJpeg(node, dim);
    const jpegBytes = dataUrlToBytes(jpegDataUrl);
    const image = await doc.embedJpg(jpegBytes);
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawImage(image, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
    pageRefs.push(page.ref);
    pageById.set(id, { index: i, ref: page.ref });
  }


  // Contents links — match rows with data-link-target = target node id
  for (let i = 0; i < pages.length; i++) {
    const { node, pageType, id } = pages[i];
    if (pageType !== "contents") continue;
    const page = doc.getPages()[i];
    const nodeRect = node.getBoundingClientRect();
    const linkEls = node.querySelectorAll<HTMLElement>("[data-link-row][data-link-target]");
    linkEls.forEach((el) => {
      const targetId = el.dataset.linkTarget;
      if (!targetId || targetId === "none" || targetId === id) return;
      const targetPage = pageById.get(targetId);
      if (!targetPage) return;
      const r = el.getBoundingClientRect();
      const sx = PAGE_W / nodeRect.width;
      const sy = PAGE_H / nodeRect.height;
      const x1 = (r.left - nodeRect.left) * sx;
      const x2 = (r.right - nodeRect.left) * sx;
      const y2 = PAGE_H - (r.top - nodeRect.top) * sy;
      const y1 = PAGE_H - (r.bottom - nodeRect.top) * sy;
      addInternalLink(pdfLib, doc, page.ref, targetPage.ref, [x1, y1, x2, y2]);
    });
  }

  buildOutline(
    pdfLib,
    doc,
    pages.map((p, i) => ({ title: `${(i + 1).toString().padStart(2, "0")}  ${p.label}`, ref: pageRefs[i] })),
  );

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
  pdfLib: PdfLib,
  doc: PDFDocument,
  hostPageRef: PDFRef,
  targetPageRef: PDFRef,
  rect: [number, number, number, number],
) {
  const { PDFArray, PDFName } = pdfLib;
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
  pdfLib: PdfLib,
  doc: PDFDocument,
  items: Array<{ title: string; ref: PDFRef }>,
) {
  if (items.length === 0) return;
  const { PDFHexString, PDFName, PDFNumber } = pdfLib;

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
    const obj = doc.context.obj(fields as unknown as Parameters<typeof doc.context.obj>[0]);
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
