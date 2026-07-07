import { Link } from "@tanstack/react-router";
import { Monitor, ArrowLeft } from "lucide-react";

/**
 * Full-screen "best on desktop" state shown by the editor route on `<md` widths.
 * The editor's fixed rails and side panels don't fit on phones — instead of a
 * broken layout, we present a calm editorial card and route users back to the
 * dashboards, which remain accessible on mobile.
 */
export function EditorMobileGuard({
  issueLabel,
}: {
  issueLabel?: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-6 py-10 overflow-y-auto">
      <div className="max-w-md w-full text-center">
        <div
          className="mx-auto mb-6 grid place-items-center rounded-full border border-[color:var(--ruby)]/25 bg-[color:var(--ruby)]/5"
          style={{ width: 72, height: 72 }}
        >
          <Monitor className="h-8 w-8 text-[color:var(--ruby)]" strokeWidth={1.4} />
        </div>
        <div className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-2">
          Editor
        </div>
        <h1
          className="text-3xl md:text-4xl leading-tight text-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Best experienced on desktop
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          The layout tools, rails, and multi-panel workspace need room to
          breathe. Open{" "}
          <span className="italic">
            {issueLabel ? `“${issueLabel}”` : "this issue"}
          </span>{" "}
          on a laptop or larger screen to keep editing.
        </p>
        <div className="mt-6 h-px w-16 mx-auto bg-[color:var(--ruby)]/40" />
        <p className="mt-6 text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
          You can still use
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            to="/board"
            className="rounded-sm border border-border px-3 py-2 text-[10px] tracking-[0.3em] uppercase hover:bg-secondary transition"
          >
            Board
          </Link>
          <Link
            to="/calendar"
            className="rounded-sm border border-border px-3 py-2 text-[10px] tracking-[0.3em] uppercase hover:bg-secondary transition"
          >
            Calendar
          </Link>
        </div>
        <Link
          to="/board"
          className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to production
        </Link>
      </div>
    </div>
  );
}
