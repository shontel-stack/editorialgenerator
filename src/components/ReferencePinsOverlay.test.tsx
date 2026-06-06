import { describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { ReferencePinsOverlay } from "./ReferencePinsOverlay";
import type { AttachmentWithUrl } from "@/lib/attachments";

function pin(id: string, x: number, y: number): AttachmentWithUrl {
  return {
    id,
    issue_id: "i",
    page_id: "p",
    kind: "reference",
    file_path: `${id}.png`,
    file_name: `${id}.png`,
    mime_type: "image/png",
    size_bytes: 1,
    extracted_text: null,
    region: null,
    position_x: x,
    position_y: y,
    created_at: "",
    signedUrl: null,
  };
}

function pointer(
  el: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  init: PointerEventInit & { clientX: number; clientY: number },
) {
  const ev = new window.PointerEvent(type, { bubbles: true, button: 0, ...init });
  el.dispatchEvent(ev);
}

describe("ReferencePinsOverlay marquee → grouped nudging", () => {
  it("a single arrow press over a marquee-selected group emits one batchId", async () => {
    const refs = [pin("a", 0.2, 0.2), pin("b", 0.4, 0.2), pin("c", 0.9, 0.9)];
    const onAssign = vi.fn();

    const { container } = render(
      <div style={{ position: "relative", width: 1000, height: 1000 }}>
        <ReferencePinsOverlay
          references={refs}
          dim={{ w: 1000, h: 1000 }}
          scale={1}
          onAssign={onAssign}
        />
      </div>,
    );

    const host = container.firstChild!.firstChild as HTMLElement; // overlay root
    // Force a deterministic rect for the overlay so 0..1 math is predictable.
    const rect = { left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000, x: 0, y: 0, toJSON: () => ({}) };
    host.getBoundingClientRect = () => rect as DOMRect;

    const captureLayer = host.firstElementChild as HTMLElement; // marquee capture div

    // Drag a marquee that covers pins "a" (0.2,0.2) and "b" (0.4,0.2) but
    // excludes "c" (0.9,0.9).
    await act(async () => {
      pointer(captureLayer, "pointerdown", { clientX: 100, clientY: 100 });
    });
    await act(async () => {
      pointer(window as unknown as Element, "pointermove", { clientX: 500, clientY: 300 });
    });
    await act(async () => {
      pointer(window as unknown as Element, "pointerup", { clientX: 500, clientY: 300 });
    });

    onAssign.mockClear();

    // Fire a single ArrowRight; both selected pins should be nudged in one
    // shared batch, and the off-selection pin should not be touched.
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });

    expect(onAssign).toHaveBeenCalledTimes(2);
    const ids = onAssign.mock.calls.map((c) => c[0]).sort();
    expect(ids).toEqual(["a", "b"]);

    const batchIds = onAssign.mock.calls.map((c) => c[2]?.batchId);
    expect(batchIds[0]).toBeTruthy();
    expect(new Set(batchIds).size).toBe(1); // all share the same batchId

    // groupKey is per-id so per-id coalescing still works on follow-up presses.
    const groupKeys = onAssign.mock.calls.map((c) => c[2]?.groupKey).sort();
    expect(groupKeys).toEqual(["nudge:a", "nudge:b"]);
  });
});
