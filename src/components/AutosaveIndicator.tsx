import { useEffect, useState } from "react";
import { Check, CloudOff, Loader2, CircleDot } from "lucide-react";
import type { AutosaveStatus } from "@/hooks/useAutosave";

export interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  lastSavedAt: number | null;
  onSaveNow?: () => void;
}

function formatRelative(ts: number, now: number): string {
  const diff = Math.max(0, Math.floor((now - ts) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function AutosaveIndicator({ status, lastSavedAt, onSaveNow }: AutosaveIndicatorProps) {
  // Tick once a minute so "Saved Xm ago" stays fresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  let icon: React.ReactNode;
  let label: string;
  let tone: string;

  switch (status) {
    case "saving":
      icon = <Loader2 className="h-3 w-3 animate-spin" />;
      label = "Saving…";
      tone = "text-muted-foreground";
      break;
    case "dirty":
      icon = <CircleDot className="h-3 w-3" />;
      label = "Unsaved changes";
      tone = "text-amber-600 dark:text-amber-400";
      break;
    case "error":
      icon = <CloudOff className="h-3 w-3" />;
      label = "Autosave failed";
      tone = "text-destructive";
      break;
    case "saved":
      icon = <Check className="h-3 w-3" />;
      label = lastSavedAt ? `Saved · ${formatRelative(lastSavedAt, now)}` : "Saved";
      tone = "text-muted-foreground";
      break;
    default:
      icon = <Check className="h-3 w-3 opacity-50" />;
      label = lastSavedAt ? `Saved · ${formatRelative(lastSavedAt, now)}` : "Autosave on";
      tone = "text-muted-foreground";
  }

  const content = (
    <span className={`inline-flex items-center gap-1.5 text-[10px] tracking-[0.25em] uppercase ${tone}`}>
      {icon}
      <span>{label}</span>
    </span>
  );

  if (!onSaveNow) return content;
  return (
    <button
      type="button"
      onClick={onSaveNow}
      title="Save now"
      className="inline-flex items-center rounded-sm px-2 py-1 hover:bg-secondary transition"
    >
      {content}
    </button>
  );
}
