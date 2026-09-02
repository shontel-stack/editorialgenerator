/**
 * autoLink — detect URLs, bare domains, emails and phone numbers inside plain
 * text block copy and turn them into real anchors at render time.
 *
 * The source text stays plain (nothing is rewritten in the document), so
 * exports, flow/threading and copyfit all keep working on the raw string.
 */

import type { ReactNode } from "react";

// Phone numbers only match when explicitly written as a dialable number:
// an international prefix (+1 555 …) or an area code in parentheses.
// Bare digit runs (dates, figure ranges) are intentionally NOT linked.
const PATTERN =
  /((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?"')\]]|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?:\+\d[\d\s().-]{6,}\d)|(?:\(\d{3}\)\s?\d{3}[\s.-]?\d{4}))/g;

export type AutoLinkMatch = { text: string; href: string };

/** Normalize a matched token into a usable href, or null if not linkable. */
export function hrefForToken(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^www\./i.test(t)) return `https://${t}`;
  if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(t)) return `mailto:${t}`;
  const digits = t.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length >= 9 && digits.replace(/\D/g, "").length <= 15) {
    return `tel:${digits}`;
  }
  return null;
}

/** Find every linkable token in a string (used for export/preflight). */
export function findLinks(text: string): AutoLinkMatch[] {
  const out: AutoLinkMatch[] = [];
  for (const m of text.matchAll(PATTERN)) {
    const href = hrefForToken(m[0]);
    if (href) out.push({ text: m[0], href });
  }
  return out;
}

/**
 * Render a plain string with detected links wrapped in <a> elements.
 * Returns the original string when nothing linkable is present.
 */
export function renderAutoLinked(
  text: string,
  opts?: { color?: string; keyPrefix?: string },
): ReactNode {
  if (!text) return text;
  const parts: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(PATTERN)) {
    const token = m[0];
    const href = hrefForToken(token);
    const start = m.index ?? 0;
    if (href == null) continue;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <a
        key={`${opts?.keyPrefix ?? "al"}-${i++}`}
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer noopener" : undefined}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          color: opts?.color ?? "inherit",
          textDecoration: "underline",
          textUnderlineOffset: "0.18em",
          cursor: "pointer",
        }}
      >
        {token}
      </a>,
    );
    last = start + token.length;
  }
  if (parts.length === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
