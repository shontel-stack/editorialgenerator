import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { render } from "@testing-library/react";

// Mock the navigate hook + supabase so the gate's effect can't resolve
// synchronously during the first client render.
vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
    "@tanstack/react-router",
  );
  return {
    ...actual,
    createFileRoute: () => (config: unknown) => config,
    useNavigate: () => () => {},
    Outlet: () => null,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      // Never resolves during the synchronous first render — keeps the gate
      // in its "checking" state on the client, matching SSR output.
      getUser: () => new Promise(() => {}),
    },
  },
}));

import { Route } from "./route";

describe("AuthGate hydration parity", () => {
  it("renders identical markup on the server and on first client render", () => {
    const AuthGate = (Route as unknown as { component: React.ComponentType }).component;

    const serverHtml = renderToString(<AuthGate />);
    const { container } = render(<AuthGate />);
    const clientHtml = container.innerHTML;

    expect(clientHtml).toBe(serverHtml);
    // Sanity: it should actually render the loading shell, not an empty string.
    expect(serverHtml).toContain("Loading");
    expect(serverHtml).toContain('aria-busy="true"');
  });
});
