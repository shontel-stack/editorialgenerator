const HTML_TO_IMAGE_URL = "https://esm.sh/html-to-image@1.11.13";
const JSPDF_URL = "https://esm.sh/jspdf@4.2.1";
const PDF_LIB_URL = "https://esm.sh/pdf-lib@1.17.1";

export function loadHtmlToImage(): Promise<typeof import("html-to-image")> {
  return import(/* @vite-ignore */ HTML_TO_IMAGE_URL) as Promise<
    typeof import("html-to-image")
  >;
}

export function loadJsPdf(): Promise<typeof import("jspdf")> {
  return import(/* @vite-ignore */ JSPDF_URL) as Promise<typeof import("jspdf")>;
}

export function loadPdfLib(): Promise<typeof import("pdf-lib")> {
  return import(/* @vite-ignore */ PDF_LIB_URL) as Promise<
    typeof import("pdf-lib")
  >;
}