import { useEffect, useState } from "react";
import { Check, CloudOff, Loader2, CircleDot, Cloud, CloudUpload, WifiOff } from "lucide-react";
import type { AutosaveStatus } from "@/hooks/useAutosave";
import type { CloudSyncStatus } from "@/hooks/useCloudSync";

export interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  lastSavedAt: number | null;
  onSaveNow?: () => void;
  /** Optional cloud sync status shown alongside local autosave. */
  cloudStatus?: CloudSyncStatus;
  cloudLastSyncedAt?: number | null;
  cloudError?: string | null;
  onSyncNow?: () => void;
  /** Number of offline-queued draft updates waiting to upload. */
  queuePending?: number;
  queueDraining?: boolean;
  onRetryQueue?: () => void;
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

export function AutosaveIndicator({
  status,
  lastSavedAt,
  onSaveNow,
  cloudStatus,
  cloudLastSyncedAt,
  cloudError,
  onSyncNow,
}: AutosaveIndicatorProps) {
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

  const local = (
    <span className={`inline-flex items-center gap-1.5 text-[10px] tracking-[0.25em] uppercase ${tone}`}>
      {icon}
      <span>{label}</span>
    </span>
  );

  const localBtn = onSaveNow ? (
    <button
      type="button"
      onClick={onSaveNow}
      title="Save now"
      className="inline-flex items-center rounded-sm px-2 py-1 hover:bg-secondary transition"
    >
      {local}
    </button>
  ) : (
    <span className="px-2 py-1">{local}</span>
  );

  if (!cloudStatus) return localBtn;

  let cIcon: React.ReactNode;
  let cLabel: string;
  let cTone: string;
  switch (cloudStatus) {
    case "syncing":
      cIcon = <CloudUpload className="h-3 w-3 animate-pulse" />;
      cLabel = "Syncing…";
      cTone = "text-muted-foreground";
      break;
    case "dirty":
      cIcon = <CloudUpload className="h-3 w-3" />;
      cLabel = "Pending sync";
      cTone = "text-amber-600 dark:text-amber-400";
      break;
    case "offline":
      cIcon = <WifiOff className="h-3 w-3" />;
      cLabel = "Offline";
      cTone = "text-amber-600 dark:text-amber-400";
      break;
    case "error":
      cIcon = <CloudOff className="h-3 w-3" />;
      cLabel = "Sync failed";
      cTone = "text-destructive";
      break;
    case "synced":
      cIcon = <Cloud className="h-3 w-3" />;
      cLabel = cloudLastSyncedAt
        ? `Synced · ${formatRelative(cloudLastSyncedAt, now)}`
        : "Synced";
      cTone = "text-muted-foreground";
      break;
    default:
      cIcon = <Cloud className="h-3 w-3 opacity-50" />;
      cLabel = "Cloud sync";
      cTone = "text-muted-foreground";
  }

  const cloudContent = (
    <span className={`inline-flex items-center gap-1.5 text-[10px] tracking-[0.25em] uppercase ${cTone}`}>
      {cIcon}
      <span>{cLabel}</span>
    </span>
  );

  const cloudBtn = onSyncNow ? (
    <button
      type="button"
      onClick={onSyncNow}
      title={cloudError ?? "Sync to cloud now"}
      className="inline-flex items-center rounded-sm px-2 py-1 hover:bg-secondary transition"
    >
      {cloudContent}
    </button>
  ) : (
    <span className="px-2 py-1" title={cloudError ?? undefined}>{cloudContent}</span>
  );

  return (
    <span className="inline-flex items-center gap-1">
      {localBtn}
      <span className="h-3 w-px bg-border" />
      {cloudBtn}
    </span>
  );
}
