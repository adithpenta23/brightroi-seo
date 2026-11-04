# BrightROI Portal setup

How BrightROI runs its copy of OpenSEO. This file covers running it on a
Windows PC for review. Server deployment, backups and updates are added in a
later phase.

The portal runs as the Docker standalone edition (`deploy/standalone`) with
`AUTH_MODE=password`, built from this repository rather than pulled from the
published OpenSEO image. [`SELF_HOSTING_DOCKER.md`](./SELF_HOSTING_DOCKER.md)
is the upstream reference; this file adds what is specific to BrightROI.

## Run it on your PC

You need Git, Docker Desktop (with at least 4 GiB of memory for Docker) and
Node.js 22. Run every command from the repository root in Git Bash.

### One-time setup

1. Clone with Linux line endings. Git for Windows converts them by default,
   and the container's shell scripts then fail to run:

   ```bash
   git clone -c core.autocrlf=false https://github.com/adithpenta23/brightroi-seo.git
   ```

   For an existing clone, run `git config core.autocrlf false`, then
   `git rm -rq --cached . && git reset -q --hard` with no uncommitted work.

2. Create the settings file and give it a storage password:

   ```bash
   cp deploy/standalone/.env.example deploy/standalone/.env
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Paste the printed value after `STORAGE_SECRET_KEY=` in
   `deploy/standalone/.env`. The app creates its other secrets itself on the
   first start and keeps them in its `config` volume. `.env` is git-ignored;
   never commit it.

3. Leave every API key empty until you have the real one. Any non-empty value
   switches its features on, and a placeholder then fails on every call.

### Start, stop and check

Build from this checkout and start (the first build takes several minutes):

```bash
docker compose -f deploy/standalone/compose.yaml -f deploy/standalone/compose.build.yaml up -d --build
```

Open <http://localhost:3001>. On a new installation the first visitor creates
the administrator's account, and sign-up closes after that. Check health with:

```bash
curl http://localhost:3001/api/health
```

It answers HTTP 200 with `"status":"ok"`. The `dataforseo` check shows `warn`
until the key is set; that is expected.

Stop it, keeping all data:

```bash
docker compose -f deploy/standalone/compose.yaml stop
```

Start it again later without rebuilding by running the `up -d` command above
without `--build`. `docker compose down -v` deletes all data and secrets; do
not run it unless you mean to start over.

After adding or changing a key in `deploy/standalone/.env`, apply it without
rebuilding:

```bash
docker compose -f deploy/standalone/compose.yaml -f deploy/standalone/compose.build.yaml up -d --force-recreate init web crawl-gateway
```

## What works without DataForSEO

Tested on a local installation with every API key empty.

| Area                                                        | Without DataForSEO                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Sign-in, admin account, inviting teammates                  | Works                                                                                                    |
| Projects and project settings                               | Works                                                                                                    |
| Site audit: crawl, page list and issue checks               | Works. A 23-page crawl finished in about a minute with no key.                                           |
| Site audit: "Include Lighthouse"                            | Does not work. The crawl still finishes, but every Lighthouse row says "failed".                         |
| Site audit: "Render JavaScript"                             | Switched off; needs `CONTEXT_API_KEY`, not DataForSEO                                                    |
| Reports list, report viewer, templates, share links         | Pages work. Reports are written by an AI agent (SAM with OpenRouter, or Claude Code connected over MCP). |
| Project Context (business overview, competitors, key pages) | Works; filled in by hand or by an agent                                                                  |
| Saved Keywords                                              | Page works, but keywords are saved from Keyword Research and refreshed through DataForSEO                |
| Agent setup and the MCP endpoint (`/mcp`)                   | Works                                                                                                    |
| Keyword Research                                            | Does not work. Searches show "Something went wrong".                                                     |
| Domain Overview, Backlinks                                  | Do not work. Pages load, searches need DataForSEO.                                                       |
| Rank Tracking                                               | Does not work. The setup form opens with cost estimates; checks need DataForSEO.                         |
| Local SEO (map rank grid)                                   | Does not work. You cannot add a business: the city list comes from DataForSEO.                           |
| AI visibility, prompt research, prompt explorer             | Does not work. Needs OpenRouter first, then DataForSEO for results.                                      |
| Dashboard keyword and backlink cards                        | Do not work                                                                                              |
| Search Console and Google Analytics 4                       | Need `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, not DataForSEO                                       |
| SAM, the in-app AI assistant                                | Needs `OPENROUTER_API_KEY`                                                                               |

Without the key, the app stops before contacting DataForSEO, so nothing is
charged. Every page also shows a "Setup needed" banner and a DataForSEO pop-up
until the key is set.

## Client reports

Clients never sign in. BrightROI keeps one organization with one project per
client, and sends each client a link to their report in Slack.

### Set up a client

1. Create a project named after the client's business, written the way the
   client should see it ("Smith Plumbing"). The name is printed on the shared
   report and in its Slack preview, so keep internal notes out of it.
2. Open **Reports → Templates** in that project, click **Add BrightROI monthly
   report**, then **Create template**. Do this once per client.

### Write the monthly report

Reports are written by an AI agent connected to the portal: Claude Code (see
**Agent setup** in the sidebar), or SAM inside the portal once
`OPENROUTER_API_KEY` is set. Ask, for example:

> Write the BrightROI monthly report for the Smith Plumbing project for
> October 2026.

The template covers local map rankings, keyword rankings, Google Search
Console, Google Analytics, the site audit and AI search. A section with no data
gets a short friendly line instead of numbers, and errors from data providers
are never shown. Read the report in **Reports** before sharing it.

### Share, copy and revoke a link

- **Share:** open the report, click **Share** and turn on **Public link**.
- **Copy:** click **Copy link** and paste it in the client's Slack channel.
  Anyone with the link can read that one report, without signing in.
- **Update:** saving the report again keeps the same link; the client sees the
  latest version.
- **Revoke:** click **Share** and turn **Public link** off. The link stops
  working straight away. Turning it on again creates a new link, and the old one
  stays dead.

A link opens only its own report. It never shows other reports, the project's
other data or the portal itself. Shared pages are hidden from search engines,
and opening one makes no paid API calls: a local map grid shows as a drawing
rather than a live Google map.

### What the Slack preview shows

Slack shows "BrightROI", the client's business name and the report title, the
first sentence of the report's summary, and a picture with the BrightROI logo,
the client's name, the report title and the client's website. Everyone in the
channel can see the preview and open the link. Slack keeps a preview once it is
posted, so revoking the link stops the report opening but does not remove the
preview text already in the channel; delete the Slack message too if that
matters. Previews only work once the portal is online at its public address.

### PDF

On the report's page in the portal, click **Export PDF**. The browser's print
window opens; choose **Save as PDF**. The shared link has no PDF button, so send
the PDF yourself when a client asks for one.

## Branding

Everything BrightROI-specific lives in a few files, so upstream updates rarely
touch it:

| What                                                                      | Where                                                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Product name, tagline, support email, website, setup-guide links, crawler | `src/shared/brand.ts`                                                                            |
| Colours and font, light and dark theme                                    | `src/client/styles/brand.css` (loaded by `app.css`)                                              |
| Logos and the link-preview fallback card                                  | `src/public/brand/`                                                                              |
| Browser and home-screen icons                                             | `src/public/favicon*`, `apple-touch-icon.png`, `android-chrome-*.png` (upstream names, replaced) |
| Inter font and its licence                                                | `src/public/brand/fonts/`                                                                        |
| Source logo files                                                         | `brand-assets/`                                                                                  |

To change the logo, replace the files in `brand-assets/` (same names), then
regenerate the icons and logos. This needs Python 3 with Pillow
(`pip install pillow`):

```bash
python scripts/brightroi/make_brand_images.py
```

The site audit crawler identifies itself as `BrightROI-Audit/1.0`. A client
site that blocks bots must allow that user agent for audits to see every page.

When an upstream update conflicts with these files, keep the BrightROI version.

## Setup notes and fixes

Problems met while setting this up on Windows, and what fixed them.

**Docker Desktop shows "An unexpected error occurred" on start.** The log
mentions a `.sock` file that "cannot be accessed by the system". Docker left
empty connection files behind when it last stopped, and Windows cannot rename
or delete them. Do not press **Reset to factory defaults**: that deletes every
image and volume. Quit Docker Desktop, run this in PowerShell, then start
Docker Desktop again:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
foreach ($d in @("$env:LOCALAPPDATA\Docker\run", "$env:LOCALAPPDATA\docker-secrets-engine")) {
  if (Test-Path -LiteralPath $d) { Rename-Item -LiteralPath $d -NewName ((Split-Path $d -Leaf) + ".stale-$stamp") }
}
```

On this PC it happens after every restart, so run it before starting Docker
Desktop. The renamed folders hold only empty files and are safe to keep.

**Site audits stall after a PC restart.** Docker Desktop brings back most
containers but not always `crawl-gateway`, which audits need. Run the start
command from "Start, stop and check" (`up -d` without `--build`) after every
restart; it starts whatever is missing.

**502 Bad Gateway after a rebuild.** `up -d --build` replaces the app
container but leaves the `web` proxy running, and the proxy keeps sending
requests to the old container's address. Restart the proxy:

```bash
docker compose -f deploy/standalone/compose.yaml restart web
```

**`COMPOSE_FILE` uses a different separator on Windows.** The upstream docs
join two Compose files with `:`, which works on Linux and macOS. On Windows the
separator is `;`. The commands above pass each file with `-f` instead, which
works everywhere.

**`pnpm` is not installed.** Commands such as `pnpm standalone:admin` need it.
Run `corepack enable` once, or call the admin tool directly:
`docker compose -f deploy/standalone/compose.yaml exec -T runtime node /opt/standalone/admin.mjs ...`

**The local build uses the published image's name.** Building from this
checkout tags the result `ghcr.io/every-app/open-seo-standalone:latest`.
Running `docker compose pull` without the build file replaces it with
upstream's unbranded image. Always include `compose.build.yaml`.

**Saving a project's website starts an audit.** It crawls up to 50 pages
straight away. On Docker without `CONTEXT_API_KEY` this crawl is free; the
settings page's note about rendering credits applies only where rendering is
available.

**`GOOGLE_MAPS_API_KEY` was missing from `.env.example`**, although Compose
already passes it to the app. It is now listed with the other optional keys.
