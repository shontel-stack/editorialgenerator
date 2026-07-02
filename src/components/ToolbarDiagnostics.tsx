import { useEffect, useState, useCallback } from "react";

/**
 * Floating diagnostics panel for verifying the +Add toolbar docking without
 * having to sign in. Reads:
 *   - `pageluxe:addPalette:dock` from localStorage
 *   - computed --rail-top / --rail-width / --top-dock-h from :root
 * and offers a "Take screenshot" button using the Screen Capture API (no deps).
 */
export function ToolbarDiagnostics() {
  // Dev-only widget. Never render in production builds.
  if (!import.meta.env.DEV) return null;
  const [open, setOpen] = useState(false);
  const [dock, setDock] = useState<string>("(unset)");
  const [railTop, setRailTop] = useState<string>("");
  const [railWidth, setRailWidth] = useState<string>("");
  const [topDockH, setTopDockH] = useState<string>("");
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [shotErr, setShotErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    try {
      const raw = localStorage.getItem("pageluxe:addPalette:dock");
      setDock(raw ?? "(unset — will default to 'top')");
    } catch {
      setDock("(unavailable)");
    }
    const cs = getComputedStyle(document.documentElement);
    setRailTop(cs.getPropertyValue("--rail-top").trim() || "(unset)");
    setRailWidth(cs.getPropertyValue("--rail-width").trim() || "(unset)");
    setTopDockH(cs.getPropertyValue("--top-dock-h").trim() || "(unset)");
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh();
    const id = window.setInterval(refresh, 1000);
    return () => window.clearInterval(id);
  }, [open, refresh]);

  const setDockMode = (mode: "top" | "right" | "left" | "float") => {
    try {
      localStorage.setItem("pageluxe:addPalette:dock", mode);
      refresh();
    } catch { /* noop */ }
  };

  const takeShot = async () => {
    setShotErr(null);
    setShotUrl(null);
    const md = navigator.mediaDevices as MediaDevices & {
      getDisplayMedia?: (c: DisplayMediaStreamOptions) => Promise<MediaStream>;
    };
    if (!md?.getDisplayMedia) {
      setShotErr("Screen Capture API unavailable in this browser.");
      return;
    }
    try {
      const stream = await md.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      // Prefer ImageCapture when present, fall back to a <video> frame draw.
      let blob: Blob | null = null;
      const ICtor = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { grabFrame: () => Promise<ImageBitmap> } }).ImageCapture;
      if (ICtor) {
        const cap = new ICtor(track);
        const bitmap = await cap.grabFrame();
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
        blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      } else {
        const video = document.createElement("video");
        video.srcObject = stream;
        await video.play();
        await new Promise((r) => setTimeout(r, 250));
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      }
      track.stop();
      if (!blob) { setShotErr("Could not encode PNG."); return; }
      const url = URL.createObjectURL(blob);
      setShotUrl(url);
      // Auto-download
      const a = document.createElement("a");
      a.href = url;
      a.download = `toolbar-diagnostics-${Date.now()}.png`;
      a.click();
    } catch (err) {
      setShotErr(err instanceof Error ? err.message : String(err));
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open toolbar diagnostics"
        style={{
          position: "fixed",
          bottom: 12,
          right: 12,
          zIndex: 9999,
          padding: "6px 10px",
          borderRadius: 6,
          background: "#111",
          color: "#fff",
          fontSize: 11,
          fontFamily: "system-ui, sans-serif",
          border: "1px solid #333",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}
      >
        🛠 Toolbar diagnostics
      </button>
    );
  }

  const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 };
  const key: React.CSSProperties = { color: "#aaa" };
  const val: React.CSSProperties = { color: "#fff", fontFamily: "ui-monospace, monospace" };

  return (
    <div
      role="dialog"
      aria-label="Toolbar diagnostics"
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 9999,
        width: 300,
        background: "#111",
        color: "#fff",
        border: "1px solid #333",
        borderRadius: 8,
        padding: 12,
        fontFamily: "system-ui, sans-serif",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 12 }}>Toolbar diagnostics</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ background: "transparent", color: "#aaa", border: "none", cursor: "pointer", fontSize: 14 }}>×</button>
      </div>

      <div style={{ display: "grid", gap: 4, marginBottom: 10 }}>
        <div style={row}><span style={key}>Dock mode</span><span style={val}>{dock}</span></div>
        <div style={row}><span style={key}>--rail-top</span><span style={val}>{railTop}</span></div>
        <div style={row}><span style={key}>--rail-width</span><span style={val}>{railWidth}</span></div>
        <div style={row}><span style={key}>--top-dock-h</span><span style={val}>{topDockH}</span></div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        {(["top", "right", "left", "float"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setDockMode(m)}
            style={{
              fontSize: 10,
              padding: "3px 7px",
              borderRadius: 4,
              border: "1px solid #444",
              background: "#222",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Set {m}
          </button>
        ))}
        <button
          type="button"
          onClick={refresh}
          style={{ fontSize: 10, padding: "3px 7px", borderRadius: 4, border: "1px solid #444", background: "#222", color: "#fff", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      <button
        type="button"
        onClick={takeShot}
        style={{
          width: "100%",
          padding: "6px 8px",
          borderRadius: 4,
          border: "1px solid #4a7",
          background: "#173",
          color: "#fff",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        📸 Take screenshot
      </button>
      <p style={{ fontSize: 10, color: "#888", margin: "6px 0 0" }}>
        Uses the browser's screen-capture prompt. Pick this tab/window; PNG downloads automatically.
      </p>
      {shotErr && <p style={{ fontSize: 10, color: "#f88", marginTop: 6 }}>{shotErr}</p>}
      {shotUrl && (
        <a href={shotUrl} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, fontSize: 10, color: "#8cf" }}>
          Open captured screenshot ↗
        </a>
      )}
      <p style={{ fontSize: 10, color: "#666", margin: "8px 0 0" }}>
        After changing dock mode, reload the app tab to apply.
      </p>
    </div>
  );
}
