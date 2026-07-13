/**
 * Composite an ad image with headline / subhead / body / CTA text overlay.
 *
 * Runs entirely on a client canvas — deterministic, no external libraries —
 * so the on-screen preview and the exported PNG match pixel-for-pixel.
 */

export type AdPlacement =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type AdCopy = {
  headline: string;
  subhead?: string;
  body?: string;
  cta?: string;
  placement: AdPlacement;
  textPolarity: "light" | "dark";
  fontFamily?: "serif" | "sans";
  accent?: string; // hex, used for CTA background
};

const SERIF = '"Times New Roman", "Playfair Display", Georgia, serif';
const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for compositing"));
    img.src = src;
  });
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Render the image + text overlay into a PNG data URL. */
export async function renderAdComposite(
  imageSrc: string,
  copy: AdCopy,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d not supported");
  ctx.drawImage(img, 0, 0, W, H);

  const fam = copy.fontFamily === "sans" ? SANS : SERIF;
  const bodyFam = copy.fontFamily === "sans" ? SANS : SANS; // body always sans for legibility
  const text = copy.textPolarity === "light" ? "#ffffff" : "#111111";
  const dim = copy.textPolarity === "light" ? "rgba(255,255,255,0.85)" : "rgba(17,17,17,0.8)";
  const accent = copy.accent || (copy.textPolarity === "light" ? "#ffffff" : "#111111");
  const accentText = copy.textPolarity === "light" ? "#111111" : "#ffffff";

  const pad = Math.round(Math.min(W, H) * 0.06);
  const zoneW = Math.round(W * 0.44);

  // Anchor + text alignment
  const isTop = copy.placement.startsWith("top");
  const [_, hSide] = copy.placement.split("-");
  let anchorX: number;
  let align: CanvasTextAlign;
  if (hSide === "left") {
    anchorX = pad;
    align = "left";
  } else if (hSide === "right") {
    anchorX = W - pad;
    align = "right";
  } else {
    anchorX = W / 2;
    align = "center";
  }

  // Sizes scaled to image
  const hSize = Math.round(H * 0.06);
  const sSize = Math.round(H * 0.026);
  const bSize = Math.round(H * 0.02);
  const cSize = Math.round(H * 0.022);

  // Optional soft scrim behind the text zone for legibility
  const scrim = copy.textPolarity === "light" ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.32)";
  const scrimGrad = ctx.createLinearGradient(0, isTop ? 0 : H, 0, isTop ? H * 0.55 : H * 0.45);
  scrimGrad.addColorStop(0, scrim);
  scrimGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = scrimGrad;
  ctx.fillRect(0, isTop ? 0 : Math.round(H * 0.45), W, Math.round(H * 0.55));

  // Measure headline lines
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.font = `700 ${hSize}px ${fam}`;
  const hLines = copy.headline ? wrapLines(ctx, copy.headline.trim(), zoneW) : [];

  ctx.font = `400 ${sSize}px ${fam}`;
  const sLines = copy.subhead ? wrapLines(ctx, copy.subhead.trim(), zoneW) : [];

  ctx.font = `400 ${bSize}px ${bodyFam}`;
  const bLines = copy.body ? wrapLines(ctx, copy.body.trim(), zoneW) : [];

  const gapAfterHead = Math.round(hSize * 0.35);
  const gapAfterSub = Math.round(sSize * 1.0);
  const gapAfterBody = Math.round(bSize * 1.6);
  const ctaH = Math.round(cSize * 2.4);

  const hBlockH = hLines.length * Math.round(hSize * 1.05);
  const sBlockH = sLines.length ? sLines.length * Math.round(sSize * 1.3) + gapAfterHead : 0;
  const bBlockH = bLines.length
    ? bLines.length * Math.round(bSize * 1.45) + (sLines.length ? gapAfterSub : gapAfterHead)
    : 0;
  const cBlockH = copy.cta ? ctaH + gapAfterBody : 0;
  const totalH = hBlockH + sBlockH + bBlockH + cBlockH;

  let y = isTop ? pad : H - pad - totalH;

  // Headline
  ctx.fillStyle = text;
  ctx.font = `700 ${hSize}px ${fam}`;
  for (const line of hLines) {
    ctx.fillText(line, anchorX, y);
    y += Math.round(hSize * 1.05);
  }

  // Subhead
  if (sLines.length) {
    y += gapAfterHead;
    ctx.fillStyle = dim;
    ctx.font = `400 italic ${sSize}px ${fam}`;
    for (const line of sLines) {
      ctx.fillText(line, anchorX, y);
      y += Math.round(sSize * 1.3);
    }
  }

  // Body
  if (bLines.length) {
    y += sLines.length ? gapAfterSub : gapAfterHead;
    ctx.fillStyle = dim;
    ctx.font = `400 ${bSize}px ${bodyFam}`;
    for (const line of bLines) {
      ctx.fillText(line, anchorX, y);
      y += Math.round(bSize * 1.45);
    }
  }

  // CTA pill
  if (copy.cta) {
    y += gapAfterBody;
    ctx.font = `600 ${cSize}px ${bodyFam}`;
    const label = copy.cta.trim().toUpperCase();
    const labelW = ctx.measureText(label).width;
    const padX = Math.round(cSize * 1.4);
    const pillW = labelW + padX * 2;
    let pillX: number;
    if (align === "left") pillX = anchorX;
    else if (align === "right") pillX = anchorX - pillW;
    else pillX = anchorX - pillW / 2;
    ctx.fillStyle = accent;
    ctx.fillRect(pillX, y, pillW, ctaH);
    ctx.fillStyle = accentText;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, pillX + pillW / 2, y + ctaH / 2 + 1);
  }

  return canvas.toDataURL("image/png");
}
