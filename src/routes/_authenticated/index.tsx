import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Pageluxe Issue Builder" },
      {
        name: "description",
        content:
          "Build the whole monthly issue with Pageluxe: cover, contents, articles, ads, photo essays. Export print-ready PDFs for InDesign, Canva, and Fresco.",
      },
      { property: "og:title", content: "Pageluxe Issue Builder" },
      {
        property: "og:description",
        content:
          "Assemble articles, ads, photo essays and cover into a single interactive publication PDF — round-trips with Canva and InDesign.",
      },
    ],
  }),
});
