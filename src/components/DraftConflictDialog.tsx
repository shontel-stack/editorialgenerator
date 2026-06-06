import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Cloud, Laptop, GitMerge } from "lucide-react";

function formatWhen(ms: number): string {
  if (!ms) return "unknown";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface DraftConflictDialogProps {
  open: boolean;
  localTs: number;
  remoteTs: number;
  localPageCount: number;
  remotePageCount: number;
  onResolve: (choice: "local" | "remote" | "merge") => void;
}

/**
 * Surfaced when both the local autosave and the cloud draft diverged from
 * the last-known-good baseline (typical scenario: edited on two devices /
 * tabs while offline). The user picks which side wins, or asks for a
 * page-level merge.
 */
export function DraftConflictDialog({
  open,
  localTs,
  remoteTs,
  localPageCount,
  remotePageCount,
  onResolve,
}: DraftConflictDialogProps) {
  const localIsNewer = localTs >= remoteTs;
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Sync conflict on this issue</AlertDialogTitle>
          <AlertDialogDescription>
            We found newer changes both on this device and in your cloud
            backup. Choose how to resolve them — the other side will be
            overwritten with your choice.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border border-border p-3">
            <div className="flex items-center gap-2 font-medium">
              <Laptop className="h-4 w-4" />
              This device
              {localIsNewer ? (
                <span className="ml-auto text-xs text-muted-foreground">
                  newer
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-muted-foreground">
              {localPageCount} page{localPageCount === 1 ? "" : "s"}
            </div>
            <div className="text-xs text-muted-foreground">
              Edited {formatWhen(localTs)}
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="flex items-center gap-2 font-medium">
              <Cloud className="h-4 w-4" />
              Cloud backup
              {!localIsNewer ? (
                <span className="ml-auto text-xs text-muted-foreground">
                  newer
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-muted-foreground">
              {remotePageCount} page{remotePageCount === 1 ? "" : "s"}
            </div>
            <div className="text-xs text-muted-foreground">
              Edited {formatWhen(remoteTs)}
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onResolve("local")}
            className="gap-2"
          >
            <Laptop className="h-4 w-4" />
            Keep this device
          </Button>
          <Button
            variant="outline"
            onClick={() => onResolve("remote")}
            className="gap-2"
          >
            <Cloud className="h-4 w-4" />
            Use cloud version
          </Button>
          <Button onClick={() => onResolve("merge")} className="gap-2">
            <GitMerge className="h-4 w-4" />
            Merge pages
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
