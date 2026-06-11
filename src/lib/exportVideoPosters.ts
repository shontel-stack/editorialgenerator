/**
 * html-to-image cannot rasterize <video> or <iframe> elements (videos appear
 * blank/black, cross-origin iframes are skipped). Before exporting a node to
 * an image we temporarily swap each video/iframe for a poster <img> (or a
 * black placeholder with a play glyph) so the PDF/PNG/JPEG captures
 * something meaningful. We also hide any element marked
 * `data-export-ignore="true"` (floating editor toolbars). Call the returned
 * `restore()` after rasterizing.
 */
export function swapMediaForPosters(root: HTMLElement): () => void {
  const swaps: Array<{ original: Element; replacement: HTMLElement; parent: Node; next: Node | null }> = [];
  const hidden: Array<{ el: HTMLElement; prev: string }> = [];

  // Hide editor-only chrome from the raster.
  const ignored = root.querySelectorAll<HTMLElement>('[data-export-ignore="true"]');
  ignored.forEach((el) => {
    hidden.push({ el, prev: el.style.visibility });
    el.style.visibility = "hidden";
  });

  const targets: Element[] = [
    ...Array.from(root.querySelectorAll("video")),
    ...Array.from(root.querySelectorAll("iframe")),
  ];


  for (const el of targets) {
    const rect = (el as HTMLElement).getBoundingClientRect();
    const cs = window.getComputedStyle(el as HTMLElement);
    const posterUrl = derivePosterUrl(el);

    const wrap = document.createElement("div");
    wrap.style.cssText = [
      `width:${(el as HTMLElement).style.width || "100%"}`,
      `height:${(el as HTMLElement).style.height || "100%"}`,
      "position:relative",
      "display:block",
      "overflow:hidden",
      `background:${cs.backgroundColor || "#000"}`,
    ].join(";");
    // Mirror element-level layout attributes that affect the parent flex/grid.
    wrap.style.objectFit = (cs.objectFit as string) || "cover";

    if (posterUrl) {
      const img = document.createElement("img");
      img.src = posterUrl;
      img.crossOrigin = "anonymous";
      img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
      wrap.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.style.cssText = "width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#fff;font:600 16px/1 system-ui,sans-serif;letter-spacing:2px;text-transform:uppercase";
      ph.textContent = "Video";
      wrap.appendChild(ph);
    }

    // Play glyph overlay
    const play = document.createElement("div");
    const size = Math.max(48, Math.min(rect.width, rect.height) * 0.18);
    play.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${size}px;height:${size}px;border-radius:9999px;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;color:#fff;font-size:${size * 0.5}px;line-height:1;pointer-events:none`;
    play.textContent = "▶";
    wrap.appendChild(play);

    const parent = el.parentNode;
    if (!parent) continue;
    const next = el.nextSibling;
    parent.replaceChild(wrap, el);
    swaps.push({ original: el, replacement: wrap, parent, next });
  }

  return () => {
    for (const s of swaps) {
      try {
        s.parent.replaceChild(s.original, s.replacement);
      } catch {
        // ignore — node may already be gone
      }
    }
    for (const h of hidden) {
      h.el.style.visibility = h.prev;
    }
  };
}

function derivePosterUrl(el: Element): string | null {
  if (el.tagName === "VIDEO") {
    const p = (el as HTMLVideoElement).getAttribute("poster");
    return p && p.trim() ? p : null;
  }
  if (el.tagName === "IFRAME") {
    const src = (el as HTMLIFrameElement).getAttribute("src") || "";
    try {
      const u = new URL(src);
      const host = u.hostname.replace(/^www\./, "");
      if (host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
        const m = u.pathname.match(/\/embed\/([^/?]+)/);
        if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
      }
      if (host === "youtu.be") {
        const id = u.pathname.replace(/^\//, "");
        if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      }
    } catch {
      /* noop */
    }
  }
  return null;
}
