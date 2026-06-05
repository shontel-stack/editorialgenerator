import type { CustomBlock } from "./coverDefaults";

/* Templates author blocks in the intrinsic 3200x4267 page space. */
const PAGE_W = 3200;
const PAGE_H = 4267;
const M = 200; // outer margin
const G = 40;  // gutter

const newId = () => `cb_${Math.random().toString(36).slice(2, 10)}`;
const withIds = (blocks: CustomBlock[]): CustomBlock[] =>
  blocks.map((b, i) => ({ ...b, id: newId(), z: (b.z ?? 50) + i } as CustomBlock));

function imageSlot(x: number, y: number, w: number, h: number, extra: Partial<Extract<CustomBlock, { kind: "image" }>> = {}): CustomBlock {
  return { id: "", kind: "image", x, y, w, h, imageUrl: "", imageFit: "cover", ...extra };
}
function videoSlot(x: number, y: number, w: number, h: number): CustomBlock {
  return { id: "", kind: "video", x, y, w, h, url: "", muted: true };
}
function textBlock(x: number, y: number, w: number, h: number, text: string, opts: Partial<Extract<CustomBlock, { kind: "text" }>> = {}): CustomBlock {
  return {
    id: "", kind: "text", x, y, w, h, text,
    fontFamily: "display", fontSize: 96, align: "left", color: "#0a0a0a",
    ...opts,
  };
}
function buttonBlock(x: number, y: number, w: number, h: number, label: string): CustomBlock {
  return { id: "", kind: "embed", x, y, w, h, embed: "button", url: "https://", label, color: "#ffffff", bg: "#6b1320" };
}
function rectBlock(x: number, y: number, w: number, h: number, fill: string): CustomBlock {
  return { id: "", kind: "shape", x, y, w, h, shape: "rect", fill, stroke: "transparent", strokeWidth: 0 };
}

export type LayoutTemplate = {
  id: string;
  label: string;
  category: "Collage" | "Ad" | "Video";
  build: () => CustomBlock[];
};

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  /* ---------- Collages ---------- */
  {
    id: "collage-2h",
    label: "2-up · side by side",
    category: "Collage",
    build: () => {
      const w = (PAGE_W - M * 2 - G) / 2;
      const h = PAGE_H - M * 2;
      return withIds([
        imageSlot(M, M, w, h),
        imageSlot(M + w + G, M, w, h),
      ]);
    },
  },
  {
    id: "collage-2v",
    label: "2-up · stacked",
    category: "Collage",
    build: () => {
      const w = PAGE_W - M * 2;
      const h = (PAGE_H - M * 2 - G) / 2;
      return withIds([
        imageSlot(M, M, w, h),
        imageSlot(M, M + h + G, w, h),
      ]);
    },
  },
  {
    id: "collage-3",
    label: "3-up · columns",
    category: "Collage",
    build: () => {
      const w = (PAGE_W - M * 2 - G * 2) / 3;
      const h = PAGE_H - M * 2;
      return withIds([
        imageSlot(M, M, w, h),
        imageSlot(M + w + G, M, w, h),
        imageSlot(M + (w + G) * 2, M, w, h),
      ]);
    },
  },
  {
    id: "collage-4",
    label: "4-up · 2×2 grid",
    category: "Collage",
    build: () => {
      const w = (PAGE_W - M * 2 - G) / 2;
      const h = (PAGE_H - M * 2 - G) / 2;
      return withIds([
        imageSlot(M, M, w, h),
        imageSlot(M + w + G, M, w, h),
        imageSlot(M, M + h + G, w, h),
        imageSlot(M + w + G, M + h + G, w, h),
      ]);
    },
  },
  {
    id: "collage-6",
    label: "6-up · 3×2 grid",
    category: "Collage",
    build: () => {
      const w = (PAGE_W - M * 2 - G * 2) / 3;
      const h = (PAGE_H - M * 2 - G) / 2;
      return withIds([
        imageSlot(M, M, w, h),
        imageSlot(M + w + G, M, w, h),
        imageSlot(M + (w + G) * 2, M, w, h),
        imageSlot(M, M + h + G, w, h),
        imageSlot(M + w + G, M + h + G, w, h),
        imageSlot(M + (w + G) * 2, M + h + G, w, h),
      ]);
    },
  },
  {
    id: "collage-mosaic",
    label: "Mosaic · 1 hero + 3",
    category: "Collage",
    build: () => {
      const heroW = (PAGE_W - M * 2) * 0.6;
      const sideW = PAGE_W - M * 2 - heroW - G;
      const fullH = PAGE_H - M * 2;
      const smallH = (fullH - G * 2) / 3;
      return withIds([
        imageSlot(M, M, heroW, fullH),
        imageSlot(M + heroW + G, M, sideW, smallH),
        imageSlot(M + heroW + G, M + smallH + G, sideW, smallH),
        imageSlot(M + heroW + G, M + (smallH + G) * 2, sideW, smallH),
      ]);
    },
  },
  {
    id: "collage-polaroid",
    label: "Polaroid stack",
    category: "Collage",
    build: () => {
      const w = 1100;
      const h = 1300;
      const cx = PAGE_W / 2 - w / 2;
      const cy = PAGE_H / 2 - h / 2;
      return withIds([
        imageSlot(cx - 420, cy - 120, w, h, { rotate: -8, borderWidth: 60, borderColor: "#ffffff", bg: "#ffffff" }),
        imageSlot(cx + 420, cy - 60, w, h, { rotate: 7, borderWidth: 60, borderColor: "#ffffff", bg: "#ffffff" }),
        imageSlot(cx, cy + 180, w, h, { rotate: -2, borderWidth: 60, borderColor: "#ffffff", bg: "#ffffff" }),
      ]);
    },
  },

  /* ---------- Ads ---------- */
  {
    id: "ad-fullbleed",
    label: "Full-bleed hero + CTA",
    category: "Ad",
    build: () => {
      return withIds([
        imageSlot(0, 0, PAGE_W, PAGE_H),
        rectBlock(0, PAGE_H - 900, PAGE_W, 900, "rgba(0,0,0,0.55)"),
        textBlock(M, PAGE_H - 820, PAGE_W - M * 2, 260, "YOUR HEADLINE HERE", { color: "#ffffff", fontSize: 140, fontFamily: "display" }),
        textBlock(M, PAGE_H - 540, PAGE_W - M * 2, 180, "A short supporting line that frames the offer.", { color: "#f4f4f4", fontSize: 56, fontFamily: "sans" }),
        buttonBlock(M, PAGE_H - 320, 900, 180, "Shop now"),
      ]);
    },
  },
  {
    id: "ad-split",
    label: "Split · product + copy",
    category: "Ad",
    build: () => {
      const half = PAGE_W / 2;
      return withIds([
        imageSlot(0, 0, half, PAGE_H),
        rectBlock(half, 0, half, PAGE_H, "#f4efe7"),
        textBlock(half + M, M + 200, half - M * 2, 200, "NEW", { fontSize: 72, color: "#6b1320", fontFamily: "sans", fontWeight: 700 }),
        textBlock(half + M, M + 380, half - M * 2, 600, "A product that\nspeaks for itself.", { fontSize: 160, fontFamily: "display", color: "#0a0a0a" }),
        textBlock(half + M, M + 1100, half - M * 2, 400, "Crafted in small batches. Available while supplies last.", { fontSize: 52, fontFamily: "serif", color: "#333333" }),
        buttonBlock(half + M, M + 1600, 800, 180, "Discover"),
      ]);
    },
  },
  {
    id: "ad-banner",
    label: "Banner · image strip",
    category: "Ad",
    build: () => {
      const stripH = 1800;
      return withIds([
        imageSlot(M, M, PAGE_W - M * 2, stripH),
        textBlock(M, M + stripH + 120, PAGE_W - M * 2, 260, "BIG ANNOUNCEMENT", { fontSize: 140, fontFamily: "display", align: "center" }),
        textBlock(M, M + stripH + 420, PAGE_W - M * 2, 200, "A subhead that gives the reader one reason to act.", { fontSize: 54, fontFamily: "sans", align: "center", color: "#444" }),
        buttonBlock(PAGE_W / 2 - 450, M + stripH + 720, 900, 200, "Learn more"),
      ]);
    },
  },

  /* ---------- Videos ---------- */
  {
    id: "video-hero",
    label: "Hero video",
    category: "Video",
    build: () => {
      const w = PAGE_W - M * 2;
      const h = Math.round(w * 9 / 16);
      const y = (PAGE_H - h) / 2 - 200;
      return withIds([
        videoSlot(M, y, w, h),
        textBlock(M, y + h + 120, w, 240, "Watch the film", { fontSize: 120, fontFamily: "display", align: "center" }),
      ]);
    },
  },
  {
    id: "video-thumbs",
    label: "Video + 3 thumbs",
    category: "Video",
    build: () => {
      const heroW = PAGE_W - M * 2;
      const heroH = Math.round(heroW * 9 / 16);
      const thumbW = (heroW - G * 2) / 3;
      const thumbH = Math.round(thumbW * 9 / 16);
      return withIds([
        videoSlot(M, M, heroW, heroH),
        videoSlot(M, M + heroH + G, thumbW, thumbH),
        videoSlot(M + thumbW + G, M + heroH + G, thumbW, thumbH),
        videoSlot(M + (thumbW + G) * 2, M + heroH + G, thumbW, thumbH),
      ]);
    },
  },
  {
    id: "video-reel",
    label: "Reel grid · 2×2",
    category: "Video",
    build: () => {
      const w = (PAGE_W - M * 2 - G) / 2;
      const h = Math.round(w * 16 / 9);
      const totalH = h * 2 + G;
      const y0 = (PAGE_H - totalH) / 2;
      return withIds([
        videoSlot(M, y0, w, h),
        videoSlot(M + w + G, y0, w, h),
        videoSlot(M, y0 + h + G, w, h),
        videoSlot(M + w + G, y0 + h + G, w, h),
      ]);
    },
  },
];

export const TEMPLATE_CATEGORIES: LayoutTemplate["category"][] = ["Collage", "Ad", "Video"];
