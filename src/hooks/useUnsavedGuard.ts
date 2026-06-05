import { useEffect, useRef } from "react";
import { registerUnsavedGuard, type SaverFn } from "@/lib/unsavedGuards";

/**
 * Register a function that reports whether this component has unsaved work.
 * Return a short reason string when dirty, or null when clean.
 *
 * Optionally pass a `save` callback to power the "Save draft and continue"
 * option in the unsaved-edits prompt.
 */
export function useUnsavedGuard(getReason: () => string | null, save?: SaverFn) {
  const reasonRef = useRef(getReason);
  reasonRef.current = getReason;
  const saveRef = useRef<SaverFn | undefined>(save);
  saveRef.current = save;

  useEffect(() => {
    const unregister = registerUnsavedGuard({
      getReason: () => reasonRef.current(),
      save: saveRef.current ? () => saveRef.current!() : undefined,
    });
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (reasonRef.current()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      unregister();
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);
}
