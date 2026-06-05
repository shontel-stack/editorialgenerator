import { useEffect, useRef } from "react";
import { registerUnsavedGuard } from "@/lib/unsavedGuards";

/**
 * Register a function that reports whether this component has unsaved work.
 * Return a short reason string when dirty, or null when clean.
 */
export function useUnsavedGuard(getReason: () => string | null) {
  const ref = useRef(getReason);
  ref.current = getReason;

  useEffect(() => {
    const unregister = registerUnsavedGuard(() => ref.current());
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (ref.current()) {
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
