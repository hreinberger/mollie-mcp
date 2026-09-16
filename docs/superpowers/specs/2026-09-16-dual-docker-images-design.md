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

- Build and push both images from the same workflow run, one step per
  Dockerfile:
  - `Dockerfile.mcpo` → tags `ghcr.io/hreinberger/mollie-mcp:mcpo`,
    `ghcr.io/hreinberger/mollie-mcp:mcpo-<sha>`.
  - `Dockerfile.http` → tags `ghcr.io/hreinberger/mollie-mcp:http`,
    `ghcr.io/hreinberger/mollie-mcp:http-<sha>`.
- No bare `:latest` tag for either image — drop `type=raw,value=latest,...`
  from both `docker/metadata-action` configs. Callers must pick `:mcpo` or
  `:http` explicitly.

### 3. Docs (`mollie-mcp` repo)

- `examples/openwebui/compose.yml`: pin `image:
  ghcr.io/hreinberger/mollie-mcp:mcpo` (was `:latest`).
- `examples/openwebui-oauth/compose.yml`: keep the local `build:` directive
  (this example is meant as a local walkthrough), but add a comment/note
  in its readme that a published `ghcr.io/hreinberger/mollie-mcp:http`
  image also exists as an alternative to building locally.
- `README.md`: mention both tags under the Docker-related sections so the
  choice between stdio/mcpo and HTTP/OAuth is visible from the top-level
  docs.

### 4. Real deployment (`~/git/openwebui/compose.yml`, separate repo)

- Switch the `mollie-mcp` service to `image:
  ghcr.io/hreinberger/mollie-mcp:http`.
- Remove the now-unused `MOLLIE_API_KEY` (commented out) and
  `MCP_SERVER_URL` env vars — the HTTP/OAuth server doesn't read either.
- Add `WEBUI_SECRET_KEY` and `WEBUI_URL` to the `open-webui` service
  (required so OAuth tokens survive container restarts and Mollie's login
  redirect resolves correctly), matching `examples/openwebui-oauth`.

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
