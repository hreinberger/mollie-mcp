# Dual Docker Images: `mcpo` and `http` tags

## Problem

`mollie-mcp` has two Docker-servable transports:

- **stdio + mcpo** (`Dockerfile`): wraps the stdio MCP server with `mcpo`
  (MCP-to-OpenAPI proxy) and a static `MOLLIE_API_KEY`.
- **Streamable HTTP + OAuth** (`Dockerfile.http`): a native HTTP MCP server
  with per-request Mollie OAuth bearer tokens, added in PR #25 ("trustless
  OAuth"). No API key needed.

CI (`docker-publish.yml`) only ever built `Dockerfile` and published it as
`ghcr.io/hreinberger/mollie-mcp:latest`. `Dockerfile.http` was never wired
into CI — it's only reachable via `examples/openwebui-oauth`'s local
`build:` directive. As a result:

1. The user's real deployment (`~/git/openwebui/compose.yml`, a separate
   repo) still pulls `:latest`, i.e. the old mcpo image, so "trustless
   OAuth" was never actually running there.
2. The mcpo image is independently broken: its `Dockerfile` runs
   `pip install mcpo uv` (unpinned) then `uvx mcpo -- node build/index.js`
   at container start. `uvx` re-resolves `mcpo`'s dependencies fresh from
   PyPI on every start. `mcpo` (still, as of 0.0.20) declares only
   `mcp>=1.17.0` with no upper bound. `mcp` 2.0.0 renamed
   `streamablehttp_client` to `streamable_http_client`, so an unpinned
   resolve now pulls `mcp` 2.x and `mcpo`'s `from mcp.client.streamable_http
   import streamablehttp_client` throws `ImportError`, crash-looping the
   container.

## Goal

Publish two independently-tagged Docker images so both transports keep
working, are each pinned against upstream drift, and consumers pick
explicitly instead of relying on an ambiguous `:latest`.

## Design

### 1. Dockerfiles

- Rename `Dockerfile` → `Dockerfile.mcpo`. No unsuffixed `Dockerfile`
  remains — both variants are explicit.
- `Dockerfile.mcpo` changes:
  - Replace `RUN pip install mcpo uv` with a pinned
    `RUN pip install "mcpo==0.0.20" "mcp>=1.17.0,<2"`.
  - Replace `CMD ["uvx", "mcpo", "--host", "0.0.0.0", "--port", "3001", "--", "node", "/app/build/index.js"]`
    with a plain `CMD ["mcpo", "--host", "0.0.0.0", "--port", "3001", "--", "node", "/app/build/index.js"]`.
    Dropping `uvx` is the actual fix: `uvx` re-resolves dependencies fresh
    on every container start regardless of what was installed at build
    time, which is what let an unpinned `mcp` 2.x slip in. Installing with
    plain `pip install` at build time and invoking the installed console
    script directly makes the image's dependency set fixed at build time,
    matching how `Dockerfile.http` already behaves via `package-lock.json`.
- `Dockerfile.http`: unchanged, already pinned via `package-lock.json`.

### 2. CI (`.github/workflows/docker-publish.yml`)

- Build and push both images from the same workflow run. This means
  duplicating the existing `metadata-action` + `build-push-action` step
  pair into two full pairs (not a shared meta step), one per Dockerfile:
  - Pair 1: `docker/metadata-action` with `tags: type=raw,value=mcpo` /
    `type=sha,prefix=mcpo-`, feeding a `docker/build-push-action` with
    `file: ./Dockerfile.mcpo`.
  - Pair 2: `docker/metadata-action` with `tags: type=raw,value=http` /
    `type=sha,prefix=http-`, feeding a `docker/build-push-action` with
    `file: ./Dockerfile.http`.
- No bare `:latest` tag for either image — neither `metadata-action` config
  includes a `type=raw,value=latest` entry. Callers must pick `:mcpo` or
  `:http` explicitly.

### 3. Docs (`mollie-mcp` repo)

- `examples/openwebui/compose.yml`: pin `image:
  ghcr.io/hreinberger/mollie-mcp:mcpo` (was `:latest`).
- `examples/openwebui-oauth/compose.yml`: keep the local `build:` directive
  (this example is meant as a local walkthrough), but add a comment/note
  in its readme that a published `ghcr.io/hreinberger/mollie-mcp:http`
  image also exists as an alternative to building locally.
- `README.md`: there is currently no Docker section in `README.md` at all.
  Add a new `## Running with Docker` section, placed after "Alternative:
  HTTP + OAuth" and before "Available Tools", covering both tags
  (`:mcpo` for the stdio+API-key path, `:http` for the OAuth path) with
  links to `examples/openwebui` and `examples/openwebui-oauth`
  respectively.

### 4. Real deployment (`~/git/openwebui/compose.yml`, separate repo)

This directory is **not a git repository** — this is a manual, unversioned
edit, not a branch/PR. Back up `compose.yml` (e.g. copy to `compose.yml.bak`)
before editing, since there's no git history to fall back on here.

- Switch the `mollie-mcp` service to `image:
  ghcr.io/hreinberger/mollie-mcp:http`.
- Remove the commented-out `MOLLIE_API_KEY` line — unused by the HTTP/OAuth
  server.
- Fix `MCP_SERVER_URL` (do not drop it): it's read by `src/httpServer.ts`
  and embedded in the OAuth-protected-resource metadata that Open WebUI's
  backend fetches back over the `owui-network` docker network. It's
  currently set to `http://localhost:3001/mcp`, which is wrong — from
  inside the `open-webui` container, `localhost` means itself, not
  `mollie-mcp`. Change it to `http://mollie-mcp:3001/mcp`, matching the
  address Open WebUI actually uses to reach this server (per
  `examples/openwebui-oauth`'s readme).
- Leave `PORT=3001` as-is (matches `Dockerfile.http`'s default, harmless).
- Leave the existing `WEBUI_SECRET_KEY` (already present, hardcoded value)
  untouched — it already does its job; no need to convert it to the
  `${WEBUI_SECRET_KEY:?...}` env-var pattern used in the example.
- Add `WEBUI_URL=https://ai.hannesreinberger.de` to the `open-webui`
  service. This stack runs behind a Cloudflare tunnel
  (`cloudflared-tunnel-openwebui`), so the browser reaches Open WebUI at
  `ai.hannesreinberger.de`, not `localhost` — `WEBUI_URL` must match this
  so Mollie's login redirect resolves correctly, and so OAuth tokens
  survive container restarts (the vars work together: `WEBUI_SECRET_KEY`
  encrypts the token, `WEBUI_URL` is the redirect target).

## Out of scope

- `src/index.ts` (stdio mode) and its use via direct MCP client configs
  (VS Code/Copilot, Claude Desktop `mcp.json`) — unaffected, not
  Docker-related.
- Any change to the MCP tool set, OAuth flow, or Mollie API client code.

## Testing

- Build both Dockerfiles locally (`docker build -f Dockerfile.mcpo .` /
  `docker build -f Dockerfile.http .`) and confirm the `mcpo` container no
  longer crash-loops on the `ImportError`.
- Run `examples/openwebui/compose.yml` (mcpo path) and confirm Open WebUI
  can import the tool schema over HTTP.
- Run `examples/openwebui-oauth/compose.yml` (http path) and confirm the
  browser-based Mollie OAuth login still completes end-to-end.
