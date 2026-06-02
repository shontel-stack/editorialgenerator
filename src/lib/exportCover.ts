import { toPng, toJpeg } from "html-to-image";
import { jsPDF } from "jspdf";
import { COVER_INCHES, COVER_PX } from "./coverDefaults";

async function renderNodeToPng(node: HTMLElement): Promise<string> {
  // The node is rendered at intrinsic 3200x4267; we capture at 1x scale.
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
