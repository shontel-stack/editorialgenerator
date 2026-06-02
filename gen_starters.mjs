// Generate two ready-to-edit starter cover PDFs for The Arts Today at
// exact Pageluxe spec: 10.6667 x 14.2222 inches.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs";

const IN = 72;
const W = 10.6667 * IN;
const H = 14.2222 * IN;

const palettes = {
  ivory: { bg: rgb(0.965, 0.945, 0.906), fg: rgb(0.105, 0.094, 0.078), rule: rgb(0.706, 0.541, 0.235), muted: rgb(0.478, 0.435, 0.361) },
  ink:   { bg: rgb(0.082, 0.075, 0.059), fg: rgb(0.945, 0.918, 0.847), rule: rgb(0.792, 0.635, 0.353), muted: rgb(0.608, 0.576, 0.498) },
};

function drawTracked(page, text, x, y, font, size, trackPct, color) {
  let cx = x;
  for (const c of text.split("")) {
    page.drawText(c, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(c, size) + (size * trackPct) / 10;
  }
}
function trackedWidth(text, font, size, trackPct) {
  return text.split("").reduce(
    (a, c) => a + font.widthOfTextAtSize(c, size) + (size * trackPct) / 10,
    0,
  );
}
function drawTrackedRight(page, text, xRight, y, font, size, trackPct, color) {
  const w = trackedWidth(text, font, size, trackPct);
  drawTracked(page, text, xRight - w, y, font, size, trackPct, color);
}
function drawWrapped(page, text, x, y, maxW, size, font, color, lh = 1.25) {
  const words = text.split(" ");
  let line = "", cy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(test, size) > maxW) {
      page.drawText(line, { x, y: cy, size, font, color });
      cy -= size * lh;
      line = w;
    } else line = test;
  }
  if (line) page.drawText(line, { x, y: cy, size, font, color });
}

async function buildCover({ palette, issue, date, headline, dek, feature, badge, outPath }) {
  const pal = palettes[palette];
  const doc = await PDFDocument.create();
  const page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: pal.bg });

  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifIt = await doc.embedFont(StandardFonts.TimesItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansB = await doc.embedFont(StandardFonts.HelveticaBold);

  const M = 0.45 * IN;
  const innerL = M + 0.1 * IN;
  const innerR = W - M - 0.1 * IN;

  const topY = H - M - 18;
  drawTracked(page, issue, innerL, topY, sans, 9, 3, pal.fg);
  drawTrackedRight(page, date, innerR, topY, sans, 9, 3, pal.fg);

  const titleSize = 90;
  const titleW = serif.widthOfTextAtSize("The Arts Today", titleSize);
  const titleY = H - M - 70;
  page.drawText("The Arts Today", {
    x: (W - titleW) / 2,
    y: titleY - titleSize * 0.75,
    size: titleSize, font: serif, color: pal.fg,
  });

  const tagline = "An ezine of contemporary art & culture";
  const tagSize = 12;
  const tagW = serifIt.widthOfTextAtSize(tagline, tagSize);
  const tagY = titleY - titleSize - 6;
  page.drawLine({
    start: { x: (W - tagW) / 2 - 14, y: tagY + tagSize + 6 },
    end: { x: (W + tagW) / 2 + 14, y: tagY + tagSize + 6 },
    thickness: 0.6, color: pal.rule,
  });
  page.drawText(tagline, { x: (W - tagW) / 2, y: tagY, size: tagSize, font: serifIt, color: pal.fg });

  // Hero placeholder frame
  const heroTop = tagY - 30;
  const heroBottom = M + 3.2 * IN;
  page.drawRectangle({
    x: M, y: heroBottom, width: W - 2 * M, height: heroTop - heroBottom,
    borderColor: pal.muted, borderWidth: 0.5,
  });
  page.drawLine({ start: { x: M, y: heroBottom }, end: { x: W - M, y: heroTop }, thickness: 0.3, color: pal.muted });
  page.drawLine({ start: { x: M, y: heroTop }, end: { x: W - M, y: heroBottom }, thickness: 0.3, color: pal.muted });
  const ph = "PLACE COVER IMAGE HERE";
  const phW = sans.widthOfTextAtSize(ph, 10);
  page.drawRectangle({
    x: (W - phW) / 2 - 10, y: (heroTop + heroBottom) / 2 - 6,
    width: phW + 20, height: 18, color: pal.bg,
  });
  page.drawText(ph, { x: (W - phW) / 2, y: (heroTop + heroBottom) / 2 - 2, size: 10, font: sans, color: pal.muted });

  drawTracked(page, "THE COVER STORY", innerL, heroBottom - 26, sans, 9, 3, pal.fg);

  const hlSize = 64;
  page.drawText(headline, { x: innerL, y: heroBottom - 26 - hlSize - 8, size: hlSize, font: serif, color: pal.fg });

  const dekY = heroBottom - 26 - hlSize - 8 - 22;
  drawWrapped(page, dek, innerL, dekY, innerR - innerL - 70, 14, serifIt, pal.fg, 1.3);

  const bottomRuleY = M + 0.95 * IN;
  page.drawLine({ start: { x: innerL, y: bottomRuleY }, end: { x: innerR, y: bottomRuleY }, thickness: 0.5, color: pal.rule });
  drawTracked(page, feature, innerL, bottomRuleY - 16, sans, 7.5, 3, pal.fg);
  drawTrackedRight(page, badge, innerR, bottomRuleY - 16, sansB, 8.5, 4, pal.rule);
  drawTracked(page, "COVER: UNTITLED, 2026 — COURTESY OF THE ARTIST", innerL, M + 0.3 * IN, sans, 6.5, 2, pal.muted);

  const bytes = await doc.save();
  fs.writeFileSync(outPath, bytes);
  console.log("wrote", outPath, bytes.length, "bytes");
}

await buildCover({
  palette: "ivory",
  issue: "VOL. IV  ·  NO. III",
  date: "JUNE  MMXXVI",
  headline: "Quiet Light",
  dek: "On stillness, the studio, and the slow return of figurative painting.",
  feature: "ATELIER NOTES   ·   PORTFOLIO   ·   IN CONVERSATION",
  badge: "ISSUE  No 03",
  outPath: "/mnt/documents/arts-today-cover-template-ivory.pdf",
});

await buildCover({
  palette: "ink",
  issue: "VOL. IV  ·  NO. III",
  date: "JUNE  MMXXVI",
  headline: "After Hours",
  dek: "Nightwork: three painters on the discipline of the late studio.",
  feature: "INTERVIEW   ·   PORTFOLIO   ·   ESSAY",
  badge: "ISSUE  No 03",
  outPath: "/mnt/documents/arts-today-cover-template-ink.pdf",
});
