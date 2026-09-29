/**
 * CoverLanding — the live cover as the app's front page.
 *
 * Shown when the app opens: the current issue's cover renders full-screen
 * with one action to enter the editor. Module-level state keeps it from
 * re-appearing during in-app navigation (Board → Editor etc.); a fresh page
 * load brings it back. A persistent opt-out lives in localStorage so users
 * who prefer to land straight in the editor can set that once.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PagePreview, type PageBackgroundProp } from "./PagePreview";
import type { CoverData } from "@/lib/coverDefaults";

const OFF_KEY = "pageluxe:coverLanding:off";

/** True once the user has entered the editor during this page load. */
let enteredThisLoad = false;

export function coverLandingInitiallyEnabled(): boolean {
  if (enteredThisLoad) return false;
  try {
    if (window.localStorage.getItem(OFF_KEY) === "1") return false;
  } catch {
    // localStorage unavailable (privacy mode) — show the landing anyway
  }
  return true;
}

type Props = {
  coverData: CoverData | null;
  background?: PageBackgroundProp;
  dim: { w: number; h: number };
  publicationName: string | null;
  issueLabel: string | null;
  issueDate: string | null;
  restoring: boolean;
  onEnter: () => void;
};

function setMeta(attr: "property" | "name", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function CoverLanding({
  coverData,
  background,
  dim,
  publicationName,
  issueLabel,
  issueDate,
  restoring,
  onEnter,
}: Props) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);

  // Scale the intrinsic page canvas (e.g. 3200x4267) to fit the viewport.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setScale(Math.min(rect.width / dim.w, rect.height / dim.h));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dim.w, dim.h]);

  const enter = useCallback(() => {
    enteredThisLoad = true;
    onEnter();
  }, [onEnter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") enter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enter]);

  // Best-effort: mirror the live cover into the document's share-preview
  // metadata so in-app link previews reflect the current issue.
  const imageUrl = coverData?.imageUrl ?? null;
  useEffect(() => {
    const title = publicationName
      ? `${publicationName}${issueLabel ? ` — ${issueLabel}` : ""}`
      : issueLabel || "Pageluxe";
    try {
      setMeta("property", "og:title", title);
      setMeta("name", "twitter:title", title);
      if (imageUrl && new URL(imageUrl).protocol.startsWith("http")) {
        setMeta("property", "og:image", imageUrl);
        setMeta("name", "twitter:image", imageUrl);
        setMeta("name", "twitter:card", "summary_large_image");
      }
    } catch {
      // relative or malformed URL — leave hosting defaults in place
    }
  }, [imageUrl, publicationName, issueLabel]);

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-background" data-cover-landing>
      {/* Masthead strip */}
      <div className="flex shrink-0 items-baseline justify-center gap-3 px-6 pt-6 pb-2 text-center">
        {publicationName ? (
          <span className="font-brand text-sm uppercase tracking-[0.35em] text-foreground">
            {publicationName}
          </span>
        ) : null}
        {issueLabel ? (
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {issueLabel}
          </span>
        ) : null}
        {issueDate ? (
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {issueDate}
          </span>
        ) : null}
      </div>

      {/* Cover stage */}
      <div
        ref={frameRef}
        className="relative flex min-h-0 flex-1 items-center justify-center px-6 pb-4"
      >
        {scale > 0 ? (
          <div
            style={{ width: dim.w * scale, height: dim.h * scale }}
            className="relative shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)] ring-1 ring-black/10"
          >
            {restoring || !coverData ? (
              <div className="skeleton h-full w-full" aria-label="Loading cover" />
            ) : (
              <div
                style={{
                  width: dim.w,
                  height: dim.h,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <PagePreview pageType="cover" data={coverData} dim={dim} background={background} />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col items-center gap-2 px-6 pb-8">
        <button
          type="button"
          onClick={enter}
          className="inline-flex items-center justify-center rounded-sm bg-primary px-8 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Open editor
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.setItem(OFF_KEY, "1");
            } catch {
              // ignore
            }
            enter();
          }}
          className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Always open in the editor
        </button>
      </div>
    </div>
  );
}
