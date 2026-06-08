// Client-side PDF rendering using pdf.js. Worker is loaded via Vite ?url so it
// works in dev and in production builds without manual asset copying.
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure worker exactly once.
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
}

export type LoadedPdf = {
  numPages: number;
  /** Render a page to a PNG blob + intrinsic pixel size. */
  renderPage(opts: { pageIndex: number; targetWidth?: number }): Promise<{
    blob: Blob;
    width: number;
    height: number;
  }>;
  /** Render a small thumbnail data URL for the picker UI. */
  thumbnail(opts: { pageIndex: number; width?: number }): Promise<string>;
  destroy(): Promise<void>;
};

export async function loadPdf(file: File): Promise<LoadedPdf> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  return {
    numPages: doc.numPages,
    async renderPage({ pageIndex, targetWidth = 2400 }) {
      const page = await doc.getPage(pageIndex);
      const viewport0 = page.getViewport({ scale: 1 });
      const scale = targetWidth / viewport0.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");
      // pdf.js v6 requires `canvas` in addition to `canvasContext` for typing.
      await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/png",
          0.95,
        );
      });
      return { blob, width: canvas.width, height: canvas.height };
    },
    async thumbnail({ pageIndex, width = 180 }) {
      const page = await doc.getPage(pageIndex);
      const viewport0 = page.getViewport({ scale: 1 });
      const scale = width / viewport0.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");
      await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
      return canvas.toDataURL("image/jpeg", 0.7);
    },
    async destroy() {
      await doc.destroy();
    },
  };
}
