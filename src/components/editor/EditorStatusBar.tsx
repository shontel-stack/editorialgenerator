import type { ReactNode } from "react";

export function EditorStatusBar({
  left,
  center,
  right,
}: {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 h-[var(--statusbar-h,2rem)] border-t border-border bg-card/95 backdrop-blur flex items-center gap-4 px-3 text-[10px] tracking-[0.25em] uppercase text-muted-foreground md:pl-16"
      style={{ ["--statusbar-h" as never]: "2rem" }}
    >
      <div className="flex items-center gap-3 min-w-0">{left}</div>
      <div className="flex-1 flex items-center justify-center gap-3 min-w-0 truncate">
        {center}
      </div>
      <div className="flex items-center gap-3 min-w-0">{right}</div>
    </div>
  );
}
