/**
 * Newsletter (HTML email) builder + types.
 * Client-safe — used by both the dialog UI and the PDF render path.
 */

export type NewsletterHighlight = {
  pageId: string;
  title: string;
  blurb: string;
  imageUrl?: string | null;
};

export type NewsletterData = {
  publication: string;
  issueLabel: string; // e.g. "vol 4.10"
  dateLabel: string;  // e.g. "JANUARY 28, 2026"
  tagline: string;    // e.g. "Your Source for Art Appreciation"
  subject: string;
  preheader: string;
  intro: string;
  highlights: NewsletterHighlight[];
  ctaLabel: string;
  ctaUrl: string;
  footer?: string;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Modernized, inbox-safe HTML email (single column, table-based, inline styles). */
export function buildNewsletterHtml(d: NewsletterData): string {
  const accent = "#b91c2c"; // ruby
  const ink = "#111111";
  const muted = "#6b6b6b";
  const bg = "#f5f3ee";
  const card = "#ffffff";

  const highlightRows = d.highlights
    .map((h) => {
      const img = h.imageUrl
        ? `<tr><td style="padding:0 0 16px 0;"><img src="${esc(h.imageUrl)}" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;border-radius:4px;" /></td></tr>`
        : "";
      return `
      <tr><td style="padding:0 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${img}
          <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.25;color:${ink};font-weight:700;padding:0 0 8px 0;">${esc(h.title)}</td></tr>
          <tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${ink};padding:0 0 20px 0;">${esc(h.blurb)}</td></tr>
          <tr><td style="border-bottom:1px solid #e5e1d8;padding:0 0 24px 0;"></td></tr>
          <tr><td style="height:24px;line-height:24px;">&nbsp;</td></tr>
        </table>
      </td></tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${esc(d.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(d.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${card};border-radius:6px;overflow:hidden;">
      <!-- Masthead -->
      <tr><td style="background:#0a0a0a;padding:20px 24px;">
        <table role="presentation" width="100%"><tr>
          <td style="font-family:Georgia,'Times New Roman',serif;font-style:italic;color:#ffffff;font-size:15px;">${esc(d.tagline)}</td>
          <td align="right" style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1.5px;color:#ffffff;text-transform:uppercase;">${esc(d.issueLabel)}<br/>${esc(d.dateLabel)}</td>
        </tr></table>
      </td></tr>
      <!-- Wordmark -->
      <tr><td align="center" style="padding:36px 24px 8px 24px;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:48px;line-height:1;color:${ink};letter-spacing:-1px;">
          <span style="color:${accent};font-style:italic;">${esc(d.publication.split(" ")[0] ?? d.publication)}</span><span style="font-weight:700;">${d.publication.split(" ").slice(1).join(" ") ? " " + esc(d.publication.split(" ").slice(1).join(" ")) : ""}</span>
        </div>
        <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:${muted};text-transform:uppercase;padding-top:6px;">Newsletter</div>
      </td></tr>
      <!-- In this issue -->
      <tr><td style="padding:24px 24px 8px 24px;">
        <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:3px;color:${accent};text-transform:uppercase;font-weight:700;">In this issue</div>
      </td></tr>
      <tr><td style="padding:8px 24px 28px 24px;">
        <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.55;color:${ink};">${esc(d.intro)}</p>
      </td></tr>
      <tr><td style="border-bottom:1px solid #e5e1d8;margin:0 24px;"></td></tr>
      <tr><td style="height:28px;line-height:28px;">&nbsp;</td></tr>
      <!-- Highlights -->
      ${highlightRows}
      <!-- CTA -->
      <tr><td align="center" style="padding:8px 24px 40px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${accent};border-radius:2px;">
          <a href="${esc(d.ctaUrl)}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:3px;color:#ffffff;text-decoration:none;text-transform:uppercase;font-weight:700;">${esc(d.ctaLabel)}</a>
        </td></tr></table>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#0a0a0a;padding:20px 24px;text-align:center;">
        <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#bdbdbd;">${esc(d.footer ?? `${d.publication} · ${d.dateLabel}`)}</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
