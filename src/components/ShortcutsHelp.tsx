import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";

type Row = { keys: string[]; desc: string };

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: "Selection",
    rows: [
      { keys: ["Click"], desc: "Select element" },
      { keys: ["Shift", "Click"], desc: "Add/remove from selection" },
      { keys: ["⌘/Ctrl", "G"], desc: "Group selected blocks" },
      { keys: ["⌘/Ctrl", "Shift", "G"], desc: "Ungroup" },
      { keys: ["Esc"], desc: "Deselect" },
    ],
  },
  {
    title: "Move & resize",
    rows: [
      { keys: ["↑", "↓", "←", "→"], desc: "Nudge 1px" },
      { keys: ["Shift", "↑/↓/←/→"], desc: "Nudge 10px" },
      { keys: ["Shift", "Drag handle"], desc: "Keep aspect ratio" },
      { keys: ["Drag"], desc: "Snap to edges & guides" },
    ],
  },
  {
    title: "Clipboard",
    rows: [
      { keys: ["⌘/Ctrl", "C"], desc: "Copy element" },
      { keys: ["⌘/Ctrl", "V"], desc: "Paste element" },
      { keys: ["⌘/Ctrl", "D"], desc: "Duplicate" },
      { keys: ["⌥/Alt", "Drag"], desc: "Duplicate while dragging" },
    ],
  },
  {
    title: "Order & visibility",
    rows: [
      { keys: ["⌘/Ctrl", "]"], desc: "Bring forward" },
      { keys: ["⌘/Ctrl", "["], desc: "Send backward" },
      { keys: ["⌘/Ctrl", "Shift", "]"], desc: "Bring to front" },
      { keys: ["⌘/Ctrl", "Shift", "["], desc: "Send to back" },
    ],
  },
  {
    title: "App",
    rows: [
      { keys: ["⌘/Ctrl", "Z"], desc: "Undo" },
      { keys: ["⌘/Ctrl", "Shift", "Z"], desc: "Redo" },
      { keys: ["?"], desc: "Open this help" },
    ],
  },
];

/**
 * Global keyboard-shortcut reference. Opens on `?` keypress or via the
 * floating button in the bottom-right corner. Designed to mirror the help
 * panels in Figma and Canva so new users discover power features quickly.
 */
export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
        onClick={() => setOpen(true)}
        data-export-ignore="true"
        className="fixed bottom-10 right-4 z-30 h-9 w-9 rounded-full border border-border bg-card/95 backdrop-blur shadow-md text-foreground/80 hover:text-foreground hover:bg-secondary flex items-center justify-center print:hidden"
      >
        <Keyboard className="h-4 w-4" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm print:hidden"
          data-export-ignore="true"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[min(720px,92vw)] max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-card shadow-xl"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                <h2 className="text-[13px] tracking-[0.2em] uppercase font-semibold">
                  Keyboard shortcuts
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded p-1 hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 px-5 py-4">
              {SECTIONS.map((s) => (
                <section key={s.title}>
                  <h3 className="mb-2 text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                    {s.title}
                  </h3>
                  <ul className="space-y-1.5">
                    {s.rows.map((r, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="text-foreground/80">{r.desc}</span>
                        <span className="flex items-center gap-1">
                          {r.keys.map((k, ki) => (
                            <kbd
                              key={ki}
                              className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 text-[10px] font-mono text-foreground/90"
                            >
                              {k}
                            </kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <div className="px-5 pb-4 pt-1 text-[11px] text-muted-foreground">
              Tip: press <kbd className="rounded border border-border bg-secondary/60 px-1 py-0.5 font-mono">?</kbd> anywhere to toggle this panel.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
