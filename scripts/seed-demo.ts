/**
 * BrightROI: seed the local D1 database with one demo client, so every section
 * of the portal has something to show without a DataForSEO key. Fully
 * offline: it writes rows straight into the local database and calls no API.
 *
 * It creates the project "Demo Plumbing (demo)" (website demoplumbing.brightroi.co)
 * with:
 *   - rank tracking: 10 keywords, 12 weekly checks on desktop and mobile
 *   - Local SEO: one business, 2 keywords, a 5×5 map grid, 3 monthly checks
 *   - a completed 12-page site audit with a few issues
 *   - the BrightROI monthly report template and one demo report, shared
 * Every name, domain and report is labelled demo. Re-running replaces the
 * demo project and everything in it; nothing else is touched.
 *
 * Usage:
 *   pnpm db:migrate:local                  # once: creates the local D1
 *   pnpm seed:demo
 *   pnpm seed:demo --organizationId=<id>   # into another local organization
 *
 * Then view it:
 *   env AUTH_MODE=local_noauth pnpm dev
 *
 * Refuses to run when NODE_ENV is production.
 */

import process from "node:process";
import { getPlatformProxy } from "wrangler";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
// Import the sqlite schema files directly: the "../src/db/schema" barrel pulls
// in provider.ts, whose `cloudflare:workers` import Node can't resolve.
import * as appSchema from "../src/db/app.schema";
import { auditIssues, auditPages, audits } from "../src/db/audit.schema";
import * as localSeoSchema from "../src/db/local-seo.schema";
import * as reportSchema from "../src/db/reports.schema";
import * as reportTemplateSchema from "../src/db/report-templates.schema";
import { member, organization, user } from "../src/db/better-auth-schema";
import { AUDIT_ISSUE_TYPES } from "../src/shared/audit-issues";
import { LocalPointStatus, LocalScanStatus } from "../src/shared/local-seo";
import { BRIGHTROI_MONTHLY_TEMPLATE } from "../src/client/features/reports/brightroiMonthlyTemplate";
import { parseArgs } from "./cli-utils";

const schema = {
  ...appSchema,
  audits,
  auditPages,
  auditIssues,
  ...localSeoSchema,
  ...reportSchema,
  ...reportTemplateSchema,
  member,
  organization,
  user,
};
type SeedDb = ReturnType<typeof drizzle<typeof schema>>;

const LOCAL_ADMIN_USER_ID = "local-admin";
const LOCAL_ORG_ID = `delegated-${LOCAL_ADMIN_USER_ID}`;
const PROJECT_NAME = "Demo Plumbing (demo)";
const BUSINESS = "Demo Plumbing (demo)";
// A subdomain of BrightROI's own site: a valid address that is plainly ours.
const DOMAIN = "demoplumbing.brightroi.co";
const CREATED_BY = "BrightROI demo seed";
// Austin, TX: a real place, so the grid lands on a map, with made-up results.
const CENTER = { lat: 30.2672, lng: -97.7431 };

async function main() {
  if (process.env.NODE_ENV === "production") {
    exit(
      "seed:demo writes demo data and is for local development only. Refusing to run with NODE_ENV=production.",
    );
  }
  const args = parseArgs(process.argv.slice(2));
  console.log("Setting up local D1 connection...");
  const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>();
  const db = drizzle(env.DB, { schema });
  try {
    const organizationId = await resolveOrganization(db, args.organizationId);
    const userId = await ownerOf(db, organizationId);

    // Replace any earlier demo project; its rows go with it (cascades).
    const removed = await db
      .delete(schema.projects)
      .where(
        and(
          eq(schema.projects.organizationId, organizationId),
          eq(schema.projects.name, PROJECT_NAME),
        ),
      )
      .returning({ id: schema.projects.id });
    if (removed.length > 0) console.log("Replaced the earlier demo project.");

    const projectId = crypto.randomUUID();
    await db.insert(schema.projects).values({
      id: projectId,
      organizationId,
      name: PROJECT_NAME,
      domain: DOMAIN,
    });

    await seedRankTracking(db, projectId);
    await seedLocalGrid(db, projectId);
    await seedAudit(db, projectId, userId);
    const shareToken = await seedReport(db, projectId, userId);

    console.log(`\nDone. Seeded "${PROJECT_NAME}" (${projectId}).`);
    console.log(
      "View it:\n  env AUTH_MODE=local_noauth pnpm dev\n" +
        `Shared report (works when the app runs with AUTH_MODE=password):\n  /s/${shareToken}`,
    );
  } finally {
    await dispose();
  }
}

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

/** The given organization, or the local_noauth admin's, created if missing. */
async function resolveOrganization(
  db: SeedDb,
  organizationId: string | undefined,
): Promise<string> {
  if (organizationId) {
    const existing = await db.query.organization.findFirst({
      where: eq(schema.organization.id, organizationId),
    });
    if (!existing) exit(`Organization ${organizationId} not found.`);
    return organizationId;
  }
  await db
    .insert(schema.user)
    .values({
      id: LOCAL_ADMIN_USER_ID,
      name: "admin",
      email: "admin@localhost",
      emailVerified: true,
    })
    .onConflictDoNothing({ target: schema.user.id });
  await db
    .insert(schema.organization)
    .values({
      id: LOCAL_ORG_ID,
      name: "admin workspace",
      slug: `delegated-admin-${Buffer.from(LOCAL_ADMIN_USER_ID).toString("hex")}`,
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: schema.organization.id });
  return LOCAL_ORG_ID;
}

/** A member to credit the audit and report to: the organization's first one. */
async function ownerOf(db: SeedDb, organizationId: string): Promise<string> {
  if (organizationId === LOCAL_ORG_ID) return LOCAL_ADMIN_USER_ID;
  const member = await db.query.member.findFirst({
    where: eq(schema.member.organizationId, organizationId),
  });
  if (!member) exit(`Organization ${organizationId} has no members.`);
  return member.userId;
}

// ---------------------------------------------------------------------------
// Rank tracking
// ---------------------------------------------------------------------------

const RANK_KEYWORDS: Array<{
  keyword: string;
  volume: number;
  start: number;
  end: number;
}> = [
  { keyword: "plumber near me", volume: 9900, start: 14, end: 4 },
  { keyword: "emergency plumber", volume: 2400, start: 9, end: 3 },
  { keyword: "water heater repair", volume: 1300, start: 18, end: 9 },
  { keyword: "drain cleaning", volume: 880, start: 7, end: 6 },
  { keyword: "leak detection", volume: 590, start: 11, end: 8 },
  { keyword: "toilet repair", volume: 480, start: 6, end: 12 },
  { keyword: "sewer line repair", volume: 390, start: 20, end: 14 },
  { keyword: "garbage disposal installation", volume: 320, start: 5, end: 5 },
  { keyword: "tankless water heater install", volume: 260, start: 16, end: 7 },
  { keyword: "24 hour plumber", volume: 210, start: 12, end: 2 },
];
const RANK_RUNS = 12;
const SERP_DEPTH = 20;

async function seedRankTracking(db: SeedDb, projectId: string) {
  const runDates = weeklyDates(RANK_RUNS);
  const newest = runDates[runDates.length - 1];
  const configId = crypto.randomUUID();
  await db.insert(schema.rankTrackingConfigs).values({
    id: configId,
    projectId,
    domain: DOMAIN,
    locationCode: 2840,
    languageCode: "en",
    devices: "both",
    serpDepth: SERP_DEPTH,
    // Manual, so no scheduler ever runs a real (paid) check for the demo.
    scheduleInterval: "manual",
    isActive: true,
    lastCheckedAt: sqlTimestamp(newest),
    createdAt: sqlTimestamp(runDates[0]),
  });

  const keywords = RANK_KEYWORDS.map((k) => ({
    id: crypto.randomUUID(),
    configId,
    keyword: k.keyword,
    searchVolume: k.volume,
    keywordDifficulty: 20 + (k.volume % 40),
    cpc: 4 + (k.volume % 9),
    metricsFetchedAt: sqlTimestamp(newest),
  }));
  await inChunks(keywords, (rows) =>
    db.insert(schema.rankTrackingKeywords).values(rows),
  );

  const runs = runDates.map((date) => ({ id: crypto.randomUUID(), date }));
  await inChunks(
    runs.map((run) => ({
      id: run.id,
      configId,
      projectId,
      status: "completed" as const,
      keywordsTotal: keywords.length,
      keywordsChecked: keywords.length,
      startedAt: sqlTimestamp(run.date),
      completedAt: sqlTimestamp(run.date),
    })),
    (rows) => db.insert(schema.rankCheckRuns).values(rows),
  );

  const snapshots: (typeof schema.rankSnapshots.$inferInsert)[] = [];
  runs.forEach((run, runIndex) => {
    const t = runIndex / (RANK_RUNS - 1);
    keywords.forEach((keyword, index) => {
      const { start, end } = RANK_KEYWORDS[index];
      const wobble = Math.sin(runIndex * 1.7 + index) * 0.8;
      const desktop = clampRank(start + (end - start) * t + wobble);
      const mobile = desktop === null ? null : clampRank(desktop + 1);
      for (const [device, position] of [
        ["desktop", desktop],
        ["mobile", mobile],
      ] as const) {
        snapshots.push({
          runId: run.id,
          trackingKeywordId: keyword.id,
          keyword: keyword.keyword,
          device,
          position,
          url:
            position === null
              ? null
              : `https://${DOMAIN}/${slugify(keyword.keyword)}`,
          serpFeatures: null,
          checkedAt: sqlTimestamp(run.date),
        });
      }
    });
  });
  await inChunks(snapshots, (rows) =>
    db.insert(schema.rankSnapshots).values(rows),
  );
  console.log(
    `Rank tracking: ${keywords.length} keywords, ${RANK_RUNS} weekly checks.`,
  );
}

// ---------------------------------------------------------------------------
// Local SEO grid
// ---------------------------------------------------------------------------

const GRID_SIZE = 5;
const SPACING_KM = 1;
const LOCAL_KEYWORDS = ["emergency plumber", "water heater repair"];
const COMPETITORS = [
  { identity: "cid:demo-competitor-1", title: "Rival Rooter (demo)" },
  { identity: "cid:demo-competitor-2", title: "Example Pipe Co (demo)" },
];

async function seedLocalGrid(db: SeedDb, projectId: string) {
  const trackerId = crypto.randomUUID();
  const checkDates = monthlyDates(3);
  await db.insert(schema.localRankTrackers).values({
    id: trackerId,
    projectId,
    title: BUSINESS,
    address: "100 Demo Street, Austin, TX (demo)",
    cid: "demo-business",
    placeId: null,
    latitude: CENTER.lat,
    longitude: CENTER.lng,
    gridSize: GRID_SIZE,
    spacingKm: SPACING_KM,
    languageCode: "en",
    createdAt: checkDates[0].toISOString(),
  });
  const keywords = LOCAL_KEYWORDS.map((keyword) => ({
    id: crypto.randomUUID(),
    trackerId,
    keyword,
  }));
  await db.insert(schema.localRankKeywords).values(keywords);

  let pointCount = 0;
  for (const [checkIndex, date] of checkDates.entries()) {
    const at = date.toISOString();
    const checkId = crypto.randomUUID();
    await db.insert(schema.localRankChecks).values({
      id: checkId,
      projectId,
      trackerId,
      status: LocalScanStatus.Completed,
      createdAt: at,
      completedAt: at,
    });
    for (const [keywordIndex, keyword] of keywords.entries()) {
      const scanId = crypto.randomUUID();
      await db.insert(schema.localRankScans).values({
        id: scanId,
        checkId,
        projectId,
        trackerId,
        keywordId: keyword.id,
        status: LocalScanStatus.Completed,
        createdAt: at,
        completedAt: at,
      });
      const businesses = [
        {
          identity: "cid:demo-business",
          title: BUSINESS,
          cid: "demo-business",
        },
        ...COMPETITORS.map((c) => ({ ...c, cid: c.identity.slice(4) })),
      ].map((business) => ({
        id: `${scanId}:${business.identity}`,
        scanId,
        identity: business.identity,
        title: business.title,
        cid: business.cid,
        address: "Austin, TX (demo)",
        rating: 4.6,
        reviews: 120,
      }));
      await db.insert(schema.localRankBusinesses).values(businesses);

      const points: (typeof schema.localRankPoints.$inferInsert)[] = [];
      const results: (typeof schema.localRankResults.$inferInsert)[] = [];
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          const pointId = crypto.randomUUID();
          // Strong near the shop, weaker at the edges, better each month.
          const distance = Math.hypot(row - 2, col - 2);
          const rank = Math.max(
            1,
            Math.round(
              1 + distance * 2.2 + keywordIndex * 1.5 - checkIndex * 1.2,
            ),
          );
          points.push({
            id: pointId,
            scanId,
            row,
            col,
            ...gridPoint(row, col),
            status: LocalPointStatus.Completed,
            rank,
            resultsCount: 20,
            collectedAt: at,
          });
          // The tracked business plus two competitors around it.
          const ranks = [rank, rank === 1 ? 2 : 1, rank <= 2 ? 3 : rank - 1];
          businesses.forEach((business, index) =>
            results.push({
              id: crypto.randomUUID(),
              pointId,
              businessId: business.id,
              rank: ranks[index],
            }),
          );
        }
      }
      await inChunks(points, (rows) =>
        db.insert(schema.localRankPoints).values(rows),
      );
      await inChunks(results, (rows) =>
        db.insert(schema.localRankResults).values(rows),
      );
      pointCount += points.length;
    }
  }
  console.log(
    `Local SEO: ${keywords.length} keywords, ${checkDates.length} checks, ${pointCount} grid points.`,
  );
}

/** A grid point SPACING_KM apart, centred on CENTER. */
function gridPoint(row: number, col: number) {
  const offset = (GRID_SIZE - 1) / 2;
  const latStep = SPACING_KM / 111.32;
  const lngStep =
    SPACING_KM / (111.32 * Math.cos((CENTER.lat * Math.PI) / 180));
  return {
    latitude: CENTER.lat + (offset - row) * latStep,
    longitude: CENTER.lng + (col - offset) * lngStep,
  };
}

// ---------------------------------------------------------------------------
// Site audit
// ---------------------------------------------------------------------------

const AUDIT_PAGES = [
  "/",
  "/services",
  "/emergency-plumber",
  "/water-heater-repair",
  "/drain-cleaning",
  "/leak-detection",
  "/about",
  "/reviews",
  "/contact",
  "/blog",
  "/blog/frozen-pipes",
  "/blog/water-heater-signs",
];
const AUDIT_ISSUES: Array<{
  type: keyof typeof AUDIT_ISSUE_TYPES;
  paths: string[];
}> = [
  { type: "duplicate-title", paths: ["/blog", "/blog/frozen-pipes"] },
  { type: "missing-meta-description", paths: ["/reviews"] },
  { type: "images-missing-alt", paths: ["/", "/about"] },
  { type: "title-too-short", paths: ["/contact"] },
];

async function seedAudit(db: SeedDb, projectId: string, userId: string) {
  const auditId = crypto.randomUUID();
  const finished = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await db.insert(schema.audits).values({
    id: auditId,
    projectId,
    startedByUserId: userId,
    startUrl: `https://${DOMAIN}/`,
    status: "completed",
    config: JSON.stringify({ maxPages: 50, lighthouseStrategy: "none" }),
    pagesCrawled: AUDIT_PAGES.length,
    pagesTotal: AUDIT_PAGES.length,
    currentPhase: "completed",
    startedAt: sqlTimestamp(new Date(finished.getTime() - 60_000)),
    completedAt: sqlTimestamp(finished),
  });

  const pageIds = new Map<string, string>();
  const pages = AUDIT_PAGES.map((path, index) => {
    const id = crypto.randomUUID();
    pageIds.set(path, id);
    const name = path === "/" ? "Home" : titleCase(path.split("/").pop() ?? "");
    const isBlog = path.startsWith("/blog");
    return {
      id,
      auditId,
      url: `https://${DOMAIN}${path}`,
      statusCode: 200,
      title:
        path === "/contact"
          ? "Contact"
          : isBlog
            ? "Blog | Demo Plumbing (demo)"
            : `${name} | Demo Plumbing (demo)`,
      metaDescription:
        path === "/reviews"
          ? null
          : `${name} from Demo Plumbing, a demo business for BrightROI Portal.`,
      h1Count: 1,
      h2Count: 3,
      wordCount: 420 + index * 35,
      imagesTotal: 4,
      imagesMissingAlt: path === "/" || path === "/about" ? 2 : 0,
      internalLinkCount: 18,
      externalLinkCount: 2,
      isIndexable: true,
      crawlDepth: path === "/" ? 0 : isBlog && path !== "/blog" ? 2 : 1,
      inSitemap: true,
      responseTimeMs: 180 + index * 12,
    };
  });
  // 23 bound columns per page.
  await inChunks(pages, (rows) => db.insert(schema.auditPages).values(rows), 4);

  const issues = AUDIT_ISSUES.flatMap(({ type, paths }) =>
    paths.map((path) => ({
      id: crypto.randomUUID(),
      auditId,
      pageId: pageIds.get(path) ?? null,
      pageUrl: `https://${DOMAIN}${path}`,
      issueType: type,
      severity: AUDIT_ISSUE_TYPES[type].severity,
    })),
  );
  await db.insert(schema.auditIssues).values(issues);
  console.log(`Site audit: ${pages.length} pages, ${issues.length} issues.`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

async function seedReport(
  db: SeedDb,
  projectId: string,
  userId: string,
): Promise<string> {
  const now = new Date().toISOString();
  const templateId = crypto.randomUUID();
  await db.insert(schema.reportTemplates).values({
    id: templateId,
    projectId,
    ...BRIGHTROI_MONTHLY_TEMPLATE,
    createdBy: CREATED_BY,
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
  });

  const { label, range } = lastMonth();
  const title = `Monthly report: ${label} (demo)`;
  const html = demoReportHtml(title, range);
  const shareToken = Buffer.from(
    crypto.getRandomValues(new Uint8Array(24)),
  ).toString("base64url");
  await db.insert(schema.reports).values({
    id: crypto.randomUUID(),
    projectId,
    title,
    summary:
      "Demo data: calls from Google rose 27% last month, and the business now shows in the map's top 3 for emergency plumber across most of town.",
    html,
    skill: "seo-report",
    templateId,
    createdBy: CREATED_BY,
    createdByUserId: userId,
    sizeBytes: Buffer.byteLength(html),
    shareToken,
    sharedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`Report: "${title}", shared, with the BrightROI template.`);
  return shareToken;
}

function demoReportHtml(title: string, range: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="report-period" content="${range}">
<title>${title}</title>
<style>
:root{--fg:#0b1220;--fg-2:#475569;--rule:#e2e8f0;--accent:#2563eb}
*{box-sizing:border-box}
body{margin:0;padding:24px 20px 80px;font:17px/1.6 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:var(--fg);background:#fff}
.shell{max-width:720px;margin:0 auto}
h1{font-size:clamp(28px,6vw,44px);line-height:1.1;margin:0 0 8px}
h2{font-size:22px;margin:40px 0 8px;padding-top:16px;border-top:1px solid var(--rule);color:var(--accent)}
.byline,.note{color:var(--fg-2)}
.note{font-size:15px}
table{width:100%;border-collapse:collapse;font-size:15px}
th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--rule)}
.demo{display:inline-block;background:#fef3c7;color:#92400e;font-size:13px;font-weight:600;padding:2px 8px;border-radius:999px}
</style></head><body><div class="shell">
<p class="demo">DEMO DATA: not a real client</p>
<h1>${title}</h1>
<p class="byline">Demo Plumbing · ${range}, compared with the month before</p>
<h2>At a glance</h2>
<ul><li>Calls from Google rose from 41 to 52.</li><li>You now show in the map's top 3 for "emergency plumber" across most of town.</li><li>Next: new pages for water heaters and drain cleaning.</li></ul>
<h2>Local map rankings</h2>
<p>"Emergency plumber": average map position 2.8, up from 4.1. 18 of 25 grid points are in the top 3, up from 11.</p>
<h2>Keyword rankings</h2>
<table><tr><th>Search</th><th>Now</th><th>Last month</th></tr>
<tr><td>plumber near me</td><td>4</td><td>7</td></tr>
<tr><td>emergency plumber</td><td>3</td><td>5</td></tr>
<tr><td>water heater repair</td><td>9</td><td>12</td></tr></table>
<h2>Google search</h2>
<p>1,240 visits from Google search, up from 1,050. People found you most with "plumber near me".</p>
<h2>Website visitors</h2>
<p class="note">We're still setting this up; it will appear in a coming report.</p>
<h2>Website health</h2>
<p>We checked 12 pages. The main things to fix: two blog pages share a title, and two pages have images without descriptions.</p>
<h2>AI search</h2>
<p class="note">We're still setting this up; it will appear in a coming report.</p>
<h2>Next month</h2>
<ul><li>Write the water heater page.</li><li>Ask five recent customers for Google reviews.</li><li>Fix the duplicate page titles.</li></ul>
<h2 id="about-this-report">About this report</h2>
<p>Prepared by BrightROI. Demo data, made up for testing the portal.</p>
<p class="note">BrightROI · brightroi.co</p>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The last full calendar month, as "October 2026" and "1–31 October 2026". */
function lastMonth() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1));
  const lastDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0),
  ).getUTCDate();
  const month = first.toLocaleString("en-GB", {
    month: "long",
    timeZone: "UTC",
  });
  const label = `${month} ${first.getUTCFullYear()}`;
  return { label, range: `1–${lastDay} ${label}` };
}

/** Weekly dates, oldest first, at noon UTC. */
function weeklyDates(count: number): Date[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setUTCHours(12, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (count - 1 - index) * 7);
    return date;
  });
}

/** Monthly dates, oldest first, at noon UTC. */
function monthlyDates(count: number): Date[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setUTCHours(12, 0, 0, 0);
    date.setUTCMonth(date.getUTCMonth() - (count - 1 - index));
    return date;
  });
}

/** SQLite current_timestamp format (UTC): "YYYY-MM-DD HH:MM:SS". */
function sqlTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function clampRank(rank: number): number | null {
  const rounded = Math.max(1, Math.round(rank));
  return rounded > SERP_DEPTH ? null : rounded;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * D1 allows 100 bound parameters per statement, so insert in small batches:
 * `size` rows times the row's column count must stay at or under 100.
 */
async function inChunks<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
  size = 10,
): Promise<void> {
  for (let index = 0; index < rows.length; index += size) {
    await insert(rows.slice(index, index + size));
  }
}

function exit(message: string): never {
  console.error(message);
  process.exit(1);
}

void main();
