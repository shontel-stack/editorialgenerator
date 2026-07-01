// Captures Retry-After (and related) headers from Supabase auth responses
// so the UI can show an exact backend-driven countdown after a 429.

type Captured = {
  retryAfterMs: number | null; // absolute epoch ms when retry is allowed
  capturedAt: number;
};

let last: Captured = { retryAfterMs: null, capturedAt: 0 };
let installed = false;

const AUTH_PATH_RX = /\/auth\/v1\//i;

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Delta seconds form
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const secs = parseFloat(trimmed);
    if (!Number.isFinite(secs)) return null;
    return Date.now() + Math.max(0, secs) * 1000;
  }
  // HTTP-date form
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) return dateMs;
  return null;
}

function parseResetHeader(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Could be delta seconds or unix seconds/ms
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = parseFloat(trimmed);
    if (!Number.isFinite(n)) return null;
    // Heuristic: values > 10^12 look like ms epoch, > 10^9 like s epoch
    if (n > 1e12) return n;
    if (n > 1e9) return n * 1000;
    return Date.now() + n * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) return dateMs;
  return null;
}

function captureFromResponse(res: Response) {
  try {
    if (res.status !== 429) return;
    const retryAfter =
      parseRetryAfter(res.headers.get("retry-after")) ??
      parseResetHeader(res.headers.get("x-ratelimit-reset")) ??
      parseResetHeader(res.headers.get("ratelimit-reset"));
    if (retryAfter != null) {
      last = { retryAfterMs: retryAfter, capturedAt: Date.now() };
    }
  } catch {
    // ignore
  }
}

export function installAuthRateLimitCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : "";
    const isAuth = AUTH_PATH_RX.test(url);
    const res = await originalFetch(input as RequestInfo, init);
    if (isAuth) captureFromResponse(res);
    return res;
  };
}

/**
 * Returns the absolute epoch-ms deadline for retry from the most recent
 * captured 429 response, but only if it's still fresh (captured in the last
 * 15s) and in the future. Otherwise null.
 */
export function consumeRetryAfterDeadline(): number | null {
  const { retryAfterMs, capturedAt } = last;
  last = { retryAfterMs: null, capturedAt: 0 };
  if (retryAfterMs == null) return null;
  if (Date.now() - capturedAt > 15_000) return null;
  if (retryAfterMs <= Date.now()) return null;
  return retryAfterMs;
}
