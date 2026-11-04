import { BRAND } from "@/shared/brand";

// BrightROI's monthly client report, offered on every project's Templates page
// so each client project can add it in one click. Agents follow it on top of
// the seo-report skill; the instructions must stay under
// REPORT_TEMPLATE_MAX_INSTRUCTIONS_CHARS (3,000).
export const BRIGHTROI_MONTHLY_TEMPLATE = {
  name: `${BRAND.companyName} monthly report`,
  description:
    "Plain-English monthly report for a local business client: map rankings, keyword rankings, Google search, website visitors, site health and AI search.",
  instructions: `Audience: the client, a local business owner reading on a phone. Plain English, no jargon; explain any SEO term in a few words. Calm and honest, no hype.

Period: the last full calendar month compared with the month before, unless the user names another period.
Title: "Monthly report: <Month YYYY>". In the HTML head, add <meta name="report-period" content="1–31 October 2026"> with the real dates; the share page shows it.
Summary: start with one plain sentence the client would be glad to read in a Slack link preview, with no markdown.

Sections, in this order. Use only this project's data.
1. At a glance: 3–5 bullets. The biggest win, what needs attention, what we will do next.
2. Local map rankings: the latest local rank grid for each keyword. Average position, share of grid points in the top 3, and the change since last month. Include the rank grid map when the local SEO data has one.
3. Keyword rankings: tracked keywords. How many rank in the top 3 and top 10, and the biggest moves up and down (one table, at most 10 rows).
4. Google search: Search Console clicks, impressions and average position against last month, and the top 5 searches that brought visitors.
5. Website visitors: Google Analytics organic visits and key actions (calls, forms, bookings) against last month, and the top 5 landing pages.
6. Website health: the latest site audit. Pages checked, issues fixed and new, and the top 3 issues explained simply.
7. AI search: how often the business is mentioned or cited in ChatGPT and other AI answers for its tracked prompts, and the change.
8. Next month: 3 bullets on what ${BRAND.companyName} will work on.

Missing data: when a section has no data yet, or a tool fails, keep the heading and write one friendly line instead, such as "We're still setting this up; it will appear in a coming report." Never show error messages or codes, provider or API names, credits, costs, or setup steps. Never guess a number.

Numbers: round sensibly, show each change as up or down with last month's value, and say when a change is too small to matter. Keep tables to 4 columns or fewer so they fit a phone.

Closing: instead of "How this report was made", end with "About this report": "Prepared by ${BRAND.companyName}. Data from Google Search Console, Google Analytics and our own ranking and website checks." Do not name or link any software, skills, AI agents or other companies.

Sign off as: ${BRAND.companyName} · ${BRAND.websiteUrl.replace("https://", "")}
Accent: #2563EB`,
};
