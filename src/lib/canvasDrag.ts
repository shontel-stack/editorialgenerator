/**
 * Global flag marking that a block on the page canvas is being dragged /
 * resized / rotated. While set, the fixed top-docked toolbars (and any other
 * chrome that floats above the canvas) turn off pointer events so they can't
 * steal a pointerover/pointerup meant for the block underneath.
 *
 * A ref count keeps nested handlers (move + rotate) from clearing each other.
 */
let depth = 0;

const ATTR = "data-canvas-drag";

function root(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

export function beginCanvasDrag(): void {
  depth += 1;
  root()?.setAttribute(ATTR, "true");
  // Safety net: if a handler never calls endCanvasDrag (pointer lost, block
  // unmounted mid-drag), the dock would stay non-interactive forever.
  if (typeof window !== "undefined") {
    const clear = () => {
      resetCanvasDrag();
      window.removeEventListener("pointerup", clear);
      window.removeEventListener("pointercancel", clear);
      window.removeEventListener("blur", clear);
    };
    window.addEventListener("pointerup", clear);
    window.addEventListener("pointercancel", clear);
    window.addEventListener("blur", clear);
  }
}


export function endCanvasDrag(): void {
  depth = Math.max(0, depth - 1);
  if (depth === 0) root()?.removeAttribute(ATTR);
}

/** Hard reset — used on unmount / pointercancel edge cases. */
export function resetCanvasDrag(): void {
  depth = 0;
  root()?.removeAttribute(ATTR);
}
