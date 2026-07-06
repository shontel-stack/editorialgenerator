import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listIssuesTool from "./tools/list-issues";
import listPublicationsTool from "./tools/list-publications";
import getIssueTool from "./tools/get-issue";
import createStaffNoteTool from "./tools/create-staff-note";

// Direct Supabase host is required for RFC 8414 issuer match. The published
// build inlines VITE_SUPABASE_PROJECT_ID as a literal; the fallback keeps the
// issuer well-formed during the manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "editorial-generator-mcp",
  title: "Editorial Generator",
  version: "0.1.0",
  instructions:
    "Tools for the Editorial Generator app. Use list_issues and list_publications to browse the signed-in user's content, get_issue to read a full draft document, and create_staff_note to file actionable inbox notes on an issue.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listIssuesTool, listPublicationsTool, getIssueTool, createStaffNoteTool],
});
