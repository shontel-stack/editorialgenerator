import { createFileRoute } from "@tanstack/react-router";
import { AuthPageContent } from "@/components/AuthPageContent";

export const Route = createFileRoute("/auth")({
  component: AuthPageContent,
});
