/**
 * End-to-end auth-gate tests.
 *
 * Guarantees exercised:
 *   1. logged-out page load never renders the sign-in FORM before we know
 *      whether the user is signed in (no flash); shows the neutral checking
 *      state instead, then transitions to the sign-in form exactly once.
 *   2. signed-in page load (valid Supabase token in localStorage) never
 *      renders the sign-in form at any point and never loops back to it,
 *      even when the async getUser() call returns transient errors.
 *   3. rate-limited getUser() (e.g. HTTP 429) does not knock a signed-in
 *      user out and never triggers the sign-in form.
 */
import * as React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, act, screen, waitFor } from "@testing-library/react";

// --- Mocks -----------------------------------------------------------------

// Track every mount of the sign-in form so we can prove it never renders when
// it shouldn't, and renders exactly once when it should.
const signInMountCount = { value: 0 };

vi.mock("@/components/AuthPageContent", () => ({
  AuthPageContent: (props: { onAuthenticated?: () => void }) => {
    React.useEffect(() => {
      signInMountCount.value += 1;
    }, []);
    return (
      <div data-testid="sign-in-form">
        Sign in
        <button
          type="button"
          onClick={() => props.onAuthenticated?.()}
        >
          fake-signin
        </button>
      </div>
    );
  },
}));

// Deferred promises so each test controls the resolve order.
type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
function defer<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let sessionDeferred: Deferred<{ data: { session: null | { user: unknown } } }>;
let userDeferred: Deferred<{ data: { user: null | { id: string } }; error?: unknown }>;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => sessionDeferred.promise,
      getUser: () => userDeferred.promise,
    },
  },
}));

// TanStack's <Outlet /> is fine to stub — we just need a marker for "the
// protected app rendered".
vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
    "@tanstack/react-router",
  );
  return {
    ...actual,
    Outlet: () => <div data-testid="protected-outlet">app</div>,
  };
});

// --- Helpers ---------------------------------------------------------------

const STORAGE_KEY = "sb-testproject-auth-token";

function seedValidSession() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      access_token: "tok",
      refresh_token: "r",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "user-1" },
    }),
  );
}

function seedExpiredSession() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      access_token: "tok",
      expires_at: Math.floor(Date.now() / 1000) - 60,
      user: { id: "user-1" },
    }),
  );
}

async function loadAuthGate() {
  // Import after mocks are set up.
  const mod = await import("@/routes/_authenticated/route");
  return mod.AuthGate;
}

// --- Setup / teardown ------------------------------------------------------

beforeEach(() => {
  signInMountCount.value = 0;
  sessionDeferred = defer();
  userDeferred = defer();
  window.localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// --- Tests -----------------------------------------------------------------

describe("AuthGate — logged out", () => {
  it("does not flash the sign-in form on initial render", async () => {
    const AuthGate = await loadAuthGate();

    render(<AuthGate />);

    // Synchronous first paint: must be the neutral checking state, never
    // the sign-in form.
    expect(screen.queryByTestId("sign-in-form")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/checking your session/i);
    expect(signInMountCount.value).toBe(0);

    // Resolve both auth checks with "no user".
    await act(async () => {
      sessionDeferred.resolve({ data: { session: null } });
      userDeferred.resolve({ data: { user: null } });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Now — and only now — the sign-in form should mount, exactly once.
    await waitFor(() => {
      expect(screen.getByTestId("sign-in-form")).toBeInTheDocument();
    });
    expect(signInMountCount.value).toBe(1);
    expect(screen.queryByTestId("protected-outlet")).toBeNull();
  });

  it("does not loop between sign-in form and checking state", async () => {
    const AuthGate = await loadAuthGate();
    render(<AuthGate />);

    await act(async () => {
      sessionDeferred.resolve({ data: { session: null } });
      userDeferred.resolve({ data: { user: null } });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId("sign-in-form")).toBeInTheDocument());

    // Give the effect a chance to re-run (it should not).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Still exactly one mount of the sign-in form — no oscillation.
    expect(signInMountCount.value).toBe(1);
  });

  it("treats an expired stored session as logged-out (no flash, no allow)", async () => {
    seedExpiredSession();
    const AuthGate = await loadAuthGate();
    render(<AuthGate />);

    // Expired token must not be treated as a live session, so we don't
    // render the protected outlet, and we still don't flash the form.
    expect(screen.queryByTestId("sign-in-form")).toBeNull();
    expect(screen.queryByTestId("protected-outlet")).toBeNull();

    await act(async () => {
      sessionDeferred.resolve({ data: { session: null } });
      userDeferred.resolve({ data: { user: null } });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId("sign-in-form")).toBeInTheDocument());
    expect(signInMountCount.value).toBe(1);
  });
});

describe("AuthGate — signed in", () => {
  it("renders the protected outlet immediately and never mounts the sign-in form", async () => {
    seedValidSession();
    const AuthGate = await loadAuthGate();

    render(<AuthGate />);

    // Synchronous seed from localStorage — protected content on first paint.
    expect(screen.getByTestId("protected-outlet")).toBeInTheDocument();
    expect(screen.queryByTestId("sign-in-form")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();

    // getSession confirms, then getUser confirms — no state change back.
    await act(async () => {
      sessionDeferred.resolve({
        data: { session: { user: { id: "user-1" } } },
      });
      userDeferred.resolve({ data: { user: { id: "user-1" } } });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("protected-outlet")).toBeInTheDocument();
    expect(signInMountCount.value).toBe(0);
  });

  it("does not kick the user out when getUser() fails transiently", async () => {
    seedValidSession();
    const AuthGate = await loadAuthGate();
    render(<AuthGate />);

    expect(screen.getByTestId("protected-outlet")).toBeInTheDocument();

    await act(async () => {
      sessionDeferred.resolve({
        data: { session: { user: { id: "user-1" } } },
      });
      // getUser() fails (e.g. network hiccup). Must not downgrade.
      userDeferred.reject(new Error("network"));
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(screen.getByTestId("protected-outlet")).toBeInTheDocument();
    expect(signInMountCount.value).toBe(0);
  });
});

describe("AuthGate — rate-limited (HTTP 429) getUser()", () => {
  it("keeps a signed-in user on the protected outlet and never flashes sign-in", async () => {
    seedValidSession();
    const AuthGate = await loadAuthGate();
    render(<AuthGate />);

    expect(screen.getByTestId("protected-outlet")).toBeInTheDocument();

    // Simulate the shape Supabase returns for a rate-limited request.
    await act(async () => {
      sessionDeferred.resolve({
        data: { session: { user: { id: "user-1" } } },
      });
      userDeferred.reject(Object.assign(new Error("rate limit"), { status: 429 }));
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(screen.getByTestId("protected-outlet")).toBeInTheDocument();
    expect(signInMountCount.value).toBe(0);
  });
});
