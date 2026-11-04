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
