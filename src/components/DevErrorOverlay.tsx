import { useEffect, useState } from "react";

type ErrInfo = {
  message: string;
  file?: string;
  line?: number;
  col?: number;
  stack?: string;
  kind: "runtime" | "promise" | "vite";
};

// Match the first project source frame (.tsx/.ts/.jsx/.js) in a stack trace.
function parseStack(stack?: string): { file?: string; line?: number; col?: number } {
  if (!stack) return {};
  const lines = stack.split("\n");
  for (const raw of lines) {
    const m =
      raw.match(/\(?(\/?[^()\s]+\.(?:tsx?|jsx?))[?#][^):\s]*:(\d+):(\d+)\)?/) ||
      raw.match(/\(?(\/?[^()\s]+\.(?:tsx?|jsx?)):(\d+):(\d+)\)?/);
    if (!m) continue;
    const file = m[1];
    // Skip vendor / framework frames.
    if (/node_modules|@vite|@react-refresh|@fs\/.*node_modules/.test(file)) continue;
    return { file, line: Number(m[2]), col: Number(m[3]) };
  }
  return {};
}

export function DevErrorOverlay() {
  const [err, setErr] = useState<ErrInfo | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const onError = (e: ErrorEvent) => {
      const error = e.error as Error | undefined;
      const parsed = parseStack(error?.stack);
      setErr({
        kind: "runtime",
        message: error?.message || e.message || "Unknown error",
        stack: error?.stack,
        file: parsed.file || e.filename,
        line: parsed.line ?? e.lineno,
        col: parsed.col ?? e.colno,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const error = reason instanceof Error ? reason : new Error(String(reason));
      const parsed = parseStack(error.stack);
      setErr({
        kind: "promise",
        message: error.message,
        stack: error.stack,
        ...parsed,
      });
    };

    // Vite HMR errors (compile / transform) — these carry exact loc.
    const viteHandler = (payload: {
      err?: { message?: string; stack?: string; loc?: { file?: string; line?: number; column?: number } };
    }) => {
      const v = payload?.err;
      if (!v) return;
      setErr({
        kind: "vite",
        message: v.message || "Vite error",
        stack: v.stack,
        file: v.loc?.file,
        line: v.loc?.line,
        col: v.loc?.column,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    let dispose: (() => void) | undefined;
    if (import.meta.hot) {
      import.meta.hot.on("vite:error", viteHandler);
      import.meta.hot.on("vite:beforeUpdate", () => setErr(null));
      dispose = () => {
        import.meta.hot?.off("vite:error", viteHandler);
      };
    }

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      dispose?.();
    };
  }, []);

  if (!err) return null;

  const loc =
    err.file && err.line
      ? `${err.file}:${err.line}${err.col ? `:${err.col}` : ""}`
      : "Location unavailable";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "rgba(10,10,10,0.92)",
        color: "#fff",
        font: "13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
        padding: "2rem",
        overflow: "auto",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div
          style={{
            display: "inline-block",
            padding: "2px 8px",
            background: "#b00020",
            color: "#fff",
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          {err.kind === "vite" ? "Build error" : err.kind === "promise" ? "Unhandled rejection" : "Runtime error"}
        </div>
        <h1 style={{ fontSize: 18, margin: "0 0 12px", fontWeight: 600 }}>{err.message}</h1>
        <div
          style={{
            padding: "10px 12px",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 4,
            marginBottom: 16,
            wordBreak: "break-all",
          }}
        >
          <span style={{ color: "#888", marginRight: 8 }}>at</span>
          <span style={{ color: "#ffb74d" }}>{loc}</span>
        </div>
        {err.stack && (
          <pre
            style={{
              padding: 12,
              background: "#0d0d0d",
              border: "1px solid #222",
              borderRadius: 4,
              maxHeight: "50vh",
              overflow: "auto",
              fontSize: 12,
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {err.stack}
          </pre>
        )}
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button
            onClick={() => setErr(null)}
            style={{
              padding: "6px 12px",
              background: "#fff",
              color: "#000",
              border: 0,
              borderRadius: 4,
              cursor: "pointer",
              font: "inherit",
            }}
          >
            Dismiss
          </button>
          <button
            onClick={() => location.reload()}
            style={{
              padding: "6px 12px",
              background: "transparent",
              color: "#fff",
              border: "1px solid #555",
              borderRadius: 4,
              cursor: "pointer",
              font: "inherit",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
