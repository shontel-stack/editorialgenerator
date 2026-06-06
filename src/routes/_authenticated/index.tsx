import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "The Arts Today — Issue Builder" },
      {
        name: "description",
        content:
          "Build the whole monthly issue of The Arts Today: cover, contents, articles, ads, photo essays. Export print-ready PDFs at 10.6667 × 14.2222 in for InDesign, Canva, and Fresco.",
      },
      { property: "og:title", content: "The Arts Today — Issue Builder" },
      {
        property: "og:description",
        content:
          "Assemble articles, ads, photo essays and cover into a single interactive publication PDF — round-trips with Canva and InDesign.",
      },
    ],
  }),
});
