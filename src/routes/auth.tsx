import { createFileRoute } from "@tanstack/react-router";
import { AuthPageContent } from "@/components/AuthPageContent";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthRoute,
});

function AuthRoute() {
  const { next } = Route.useSearch();
  return <AuthPageContent nextPath={next} />;
}
