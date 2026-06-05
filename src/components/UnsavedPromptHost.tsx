/**
 * Renders the custom unsaved-edits prompt triggered by
 * `confirmDiscardUnsaved()`. Mounted once at the root.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  setUnsavedPromptListener,
  type UnsavedPromptRequest,
} from "@/lib/unsavedGuards";

export function UnsavedPromptHost() {
  const [req, setReq] = useState<UnsavedPromptRequest | null>(null);

  useEffect(() => {
    setUnsavedPromptListener((r) => setReq(r));
    return () => setUnsavedPromptListener(null);
  }, []);

  const resolve = (choice: "cancel" | "discard" | "save") => {
    if (!req) return;
    req.resolve(choice);
    setReq(null);
  };

  const open = req !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resolve("cancel");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription>
            You have unsaved work. What would you like to do before you {req?.action ?? "continue"}?
          </DialogDescription>
        </DialogHeader>
        {req ? (
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1 max-h-40 overflow-auto">
            {req.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={() => resolve("cancel")}
            className="text-xs px-3 py-2 rounded-sm hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={() => resolve("discard")}
            className="text-xs px-3 py-2 rounded-sm border border-border hover:bg-secondary"
          >
            Discard &amp; {req?.action ?? "continue"}
          </button>
          {req?.canSave ? (
            <button
              onClick={() => resolve("save")}
              className="bg-foreground text-background px-3 py-2 text-[10px] tracking-[0.3em] uppercase rounded-sm"
            >
              Save draft &amp; {req?.action ?? "continue"}
            </button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
