import { Parser } from "htmlparser2";
import { renderToStaticMarkup } from "react-dom/server";
import { formatRelativeTime } from "@/client/lib/relative-time";
import { ReportRepository } from "@/server/features/reports/repositories/ReportRepository";
import {
  SHARE_TOKEN_PATTERN,
  sharesEnabled,
} from "@/server/features/reports/shareAccess";
import { REPORT_IFRAME_SANDBOX } from "@/shared/report-sandbox";
import { sharePath } from "@/shared/report-share";
import { domainField } from "@/types/schemas/domain";
import { BRAND } from "@/shared/brand";

// The public face of a shared report, `/s/<token>`: a slim bar and the
// document in the same sandboxed frame the in-app viewer uses. Rendered to a
// static string on the server rather than served as a React route, because the
// reader is usually someone who has never opened the app: its root shell
// renders only on the client, so a route inside it cost them the whole app
// bundle (~400 KB gzipped) downloaded, parsed and hydrated before the frame
// even existed. This page puts the frame in the first response and ships no
// JavaScript beyond the Share button's clipboard handler. JSX so every value
// from the row is escaped by React, not by hand.

const MARKETING_URL = BRAND.websiteUrl;

const MAX_DESCRIPTION_CHARS = 200;

/**
 * The link preview's description: the summary's first non-empty line, capped.
 * The summary is markdown, and no attempt is made to render it — a stray `##`
 * in a preview is a smaller problem than a stripper that eats a leading minus
 * sign off a number.
 */
function shareDescription(summary: string): string {
  const line = summary
    .split("\n")
    .map((raw) => raw.trim())
    .find((raw) => raw.length > 0);
  if (!line) return "";
  return line.length > MAX_DESCRIPTION_CHARS
    ? `${line.slice(0, MAX_DESCRIPTION_CHARS - 1).trimEnd()}…`
    : line;
}

const MAX_PERIOD_CHARS = 80;

/**
 * The reporting period a report declares in its head, as
 * `<meta name="report-period" content="1–31 October 2026">`. The BrightROI
 * monthly template asks for it; reports without one show no period line.
 * The head comes first, so the first 16 KB is enough and bounds the work.
 */
function reportPeriod(html: string): string | null {
  let period: string | null = null;
  const parser = new Parser({
    onopentag(name, attributes) {
      if (period !== null || name !== "meta") return;
      if (attributes.name?.toLowerCase() !== "report-period") return;
      const content = attributes.content?.trim();
      if (content) period = content.slice(0, MAX_PERIOD_CHARS);
    },
  });
  parser.end(html.slice(0, 16_384));
  return period;
}

// BrightROI's light and dark palettes (src/client/styles/brand.css), so the bar
// matches the portal without loading its stylesheet. Dark follows the OS: an
// anonymous reader has no stored preference. Narrow screens put the logo and
// buttons on one row and the client, title and period on the next.
const STYLES = `
@font-face{font-family:Inter;font-style:normal;font-display:swap;font-weight:100 900;src:url("/brand/fonts/inter-latin-wght-normal.woff2") format("woff2")}
:root{color-scheme:light dark;--bg:#f8fafc;--surface:#fff;--border:#e2e8f0;--text:#0b1220;--muted:#475569;--accent:#2563eb;--primary:#2563eb;--primary-text:#fff;--ghost-hover:rgb(11 18 32 / 8%)}
@media (prefers-color-scheme:dark){:root{--bg:#071329;--surface:#0e1e3b;--border:#2a3f66;--text:#f8fafc;--muted:#a9b8d0;--accent:#60a5fa;--primary:#60a5fa;--primary-text:#071329;--ghost-hover:rgb(248 250 252 / 10%)}}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{display:flex;flex-direction:column;background:var(--bg);color:var(--text);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--border)}
.brand{order:1;display:flex;flex-shrink:0}
.brand img{display:block;height:26px;width:auto}
.title{order:3;width:100%;min-width:0}
@media (min-width:768px){.title{order:2;width:auto;flex:1;padding-left:16px;border-left:1px solid var(--border)}}
.client{margin:0;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--accent)}
h1{margin:0;font-size:15px;font-weight:600;line-height:1.35}
@media (min-width:768px){h1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.meta{margin:0;font-size:12px;color:var(--muted)}
.actions{order:2;margin-left:auto;display:flex;flex-shrink:0;align-items:center;gap:8px}
@media (min-width:768px){.actions{order:3;margin-left:0}}
.btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid transparent;border-radius:6px;font:inherit;font-weight:600;color:inherit;background:transparent;cursor:pointer;text-decoration:none}
.btn:hover{background:var(--ghost-hover)}
.btn.primary{background:var(--primary);border-color:var(--primary);color:var(--primary-text)}
.btn.primary:hover{filter:brightness(.92)}
.btn svg{width:16px;height:16px}
iframe{flex:1;min-height:0;width:100%;border:0;background:var(--surface)}
main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center}
main h1{white-space:normal;font-size:18px}
main p{max-width:28rem;margin:0;color:var(--muted)}
main .brand img{height:32px;margin-bottom:8px}
`;

// Share sheet on touch devices; the clipboard elsewhere (desktop macOS anchors
// the sheet to the window, not the button). The label is the feedback.
const SHARE_SCRIPT = `
document.getElementById("share").addEventListener("click",async function(){
  var url=location.href,label=this.querySelector("span");
  if(matchMedia("(pointer: coarse)").matches&&navigator.share){
    try{await navigator.share({title:document.title,url:url})}catch(e){}
    return;
  }
  try{await navigator.clipboard.writeText(url);label.textContent="Link copied"}
  catch(e){label.textContent="Copy failed"}
  setTimeout(function(){label.textContent="Share"},2000);
});`;

function TryButton() {
  return (
    <a
      className="btn primary"
      href={MARKETING_URL}
      target="_blank"
      rel="noreferrer"
    >
      Visit {BRAND.companyName}
    </a>
  );
}

function BrandLogo() {
  return (
    <a className="brand" href={MARKETING_URL} target="_blank" rel="noreferrer">
      <picture>
        <source
          srcSet={BRAND.logo.fullOnDark}
          media="(prefers-color-scheme: dark)"
        />
        <img src={BRAND.logo.fullOnLight} alt={BRAND.companyName} />
      </picture>
    </a>
  );
}

function Document({
  title,
  head,
  children,
}: {
  title: string;
  head?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="robots" content="noindex, nofollow" />
        <title>{`${title} · ${BRAND.companyName}`}</title>
        {head}
        <link rel="icon" href="/favicon.ico" />
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

function htmlResponse(page: React.ReactElement, status: number): Response {
  return new Response(`<!doctype html>${renderToStaticMarkup(page)}`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // The page carries the title and summary in its head, so a revoked link
      // must not live on in an intermediary cache any longer than the document.
      "Cache-Control": "no-store",
    },
  });
}

/** The two dead ends — a link that was never shared or was revoked, and an archived project. */
function unavailable(heading: string, detail: string): Response {
  // Every dead end answers 404, so a crawler, a monitor or a browser's history
  // sees a page that is not there rather than a 200 with an apology. The
  // generic title keeps the report's own title out of it: that is content the
  // link no longer grants access to.
  return htmlResponse(
    <Document title="Report unavailable">
      <main>
        <BrandLogo />
        <h1>{heading}</h1>
        <p>{detail}</p>
        <TryButton />
      </main>
    </Document>,
    404,
  );
}

const missing = () =>
  unavailable(
    "This report isn't shared.",
    "The link may have been turned off, or the report may have been deleted.",
  );

/**
 * The public page. Reads the same row the raw endpoint reads and puts the frame
 * pointing at `/s/<token>/raw` straight into the HTML, so the browser requests
 * the document as soon as it has parsed the head.
 */
export async function renderSharePage(
  token: string,
  request: Request,
): Promise<Response> {
  if (!(await sharesEnabled())) return missing();
  if (!SHARE_TOKEN_PATTERN.test(token)) return missing();

  const report = await ReportRepository.getSharedReportByToken(token);
  if (!report) return missing();
  if (report.archived) {
    return unavailable(
      "This project has been archived.",
      "Its reports are hidden until the owner restores it.",
    );
  }

  const html = await ReportRepository.getReportHtml(
    report.projectId,
    report.id,
  );
  if (html === null) return missing();
  const period = reportPeriod(html);
  // The client's business name leads the preview, so a Slack channel that
  // gets several reports can tell them apart.
  const previewTitle = `${report.projectName} · ${report.title}`;
  const description = shareDescription(report.summary);
  const canonical = `${new URL(request.url).origin}${sharePath(token)}`;
  const domain = domainField.safeParse(report.projectDomain);
  // These parameters only version the URL; the image route reads its content
  // from the authorized report, never from query parameters.
  const imageVersion = new URLSearchParams({
    v: report.updatedAt,
    domain: domain.success ? domain.data : "",
    name: report.projectName,
  });
  const imageUrl = `${canonical}/og.png?${imageVersion}`;

  return htmlResponse(
    <Document
      title={previewTitle}
      head={
        <>
          <meta property="og:type" content="article" />
          <meta property="og:site_name" content={BRAND.companyName} />
          <meta property="og:title" content={previewTitle} />
          <meta name="twitter:title" content={previewTitle} />
          {description ? (
            <>
              <meta property="og:description" content={description} />
              <meta name="description" content={description} />
            </>
          ) : null}
          <meta property="og:url" content={canonical} />
          <meta property="og:image" content={imageUrl} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta
            property="og:image:alt"
            content={`${previewTitle} · ${BRAND.companyName}`}
          />
          <meta name="twitter:image" content={imageUrl} />
          <meta
            name="twitter:image:alt"
            content={`${previewTitle} · ${BRAND.companyName}`}
          />
          <meta name="twitter:card" content="summary_large_image" />
        </>
      }
    >
      <header>
        <BrandLogo />
        <div className="title">
          <p className="client">{report.projectName}</p>
          <h1>{report.title}</h1>
          <p className="meta">
            {period ? `Reporting period: ${period} · ` : ""}Updated{" "}
            {formatRelativeTime(report.updatedAt)}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn" id="share">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
              <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
            </svg>
            <span>Share</span>
          </button>
          <TryButton />
        </div>
      </header>
      <iframe
        src={`${sharePath(token)}/raw`}
        sandbox={REPORT_IFRAME_SANDBOX}
        referrerPolicy="no-referrer"
        title={report.title}
      />
      <script dangerouslySetInnerHTML={{ __html: SHARE_SCRIPT }} />
    </Document>,
    200,
  );
}
