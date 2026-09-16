# Dual Docker Images (`mcpo` / `http` tags) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish two independently-tagged Docker images (`:mcpo`, `:http`) from CI instead of one ambiguous `:latest`, fix the mcpo image's broken/unpinned Python dependencies, and repoint the real deployment at the working `:http` (trustless OAuth) image.

**Architecture:** Split the single `Dockerfile` into two explicit files (`Dockerfile.mcpo`, `Dockerfile.http`), pin `Dockerfile.mcpo`'s Python deps to stop resolving a broken `mcp` v2, and duplicate the CI workflow's build/push step pair so each Dockerfile gets its own tag set with no shared `:latest`. Docs and the real (non-git) deployment are updated to match.

**Tech Stack:** Docker, GitHub Actions (`docker/metadata-action`, `docker/build-push-action`), `mcpo`/`mcp` (Python), Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-16-dual-docker-images-design.md`

---

### Task 0: Create a feature branch

**Files:** none

- [ ] **Step 1: Create and switch to a feature branch**

Run: `cd ~/git/mollie-mcp && git checkout -b feature/dual-docker-images`
Expected: `Switched to a new branch 'feature/dual-docker-images'`

---

### Task 1: Rename `Dockerfile` → `Dockerfile.mcpo` and pin its Python deps

**Files:**
- Rename: `Dockerfile` → `Dockerfile.mcpo`
- Modify: `Dockerfile.mcpo`

**Context:** `mcpo` 0.0.20 (latest on PyPI as of this writing) declares only
`mcp>=1.17.0` with no upper bound. `mcp` 2.0.0 renamed
`streamablehttp_client` to `streamable_http_client`. The current
`Dockerfile` installs `mcpo`/`uv` unpinned at build time, then runs
`uvx mcpo -- ...` at container start — `uvx` re-resolves dependencies fresh
from PyPI on every start regardless of what was baked into the image, so it
now pulls `mcp` 2.x and crashes with:
```
ImportError: cannot import name 'streamablehttp_client' from 'mcp.client.streamable_http'
```
The fix: pin `mcpo==0.0.20` and `mcp>=1.17.0,<2` at build time, and drop
`uvx` in favor of invoking the `mcpo` console script installed by `pip`
directly, so the dependency set is fixed at build time (matching how
`Dockerfile.http` already behaves via `package-lock.json`).

- [ ] **Step 1: Reproduce the current failure**

Run:
```bash
cd ~/git/mollie-mcp
docker build -f Dockerfile -t mollie-mcp:mcpo-before .
docker run --rm -e MOLLIE_API_KEY=test_dummy mollie-mcp:mcpo-before
```
Expected: container exits non-zero, logs end with
`ImportError: cannot import name 'streamablehttp_client' from 'mcp.client.streamable_http'`
This confirms the bug reproduces locally before touching anything.

- [ ] **Step 2: Rename the file**

Run: `git mv Dockerfile Dockerfile.mcpo`

- [ ] **Step 3: Pin dependencies and drop `uvx`**

In `Dockerfile.mcpo`, replace:
```dockerfile
# Install Python dependencies
RUN pip install mcpo uv
```
with:
```dockerfile
# Install Python dependencies, pinned: mcpo 0.0.20 only declares
# mcp>=1.17.0 with no upper bound, and mcp 2.0.0 renamed
# streamablehttp_client -> streamable_http_client, which breaks mcpo's
# import. Installed at build time (not via `uvx`, which would re-resolve
# this unpinned on every container start).
RUN pip install "mcpo==0.0.20" "mcp>=1.17.0,<2"
```

And replace:
```dockerfile
# Command to run the application
# Assumes npm run build creates ./build/index.js and mcpo is in PATH
CMD ["uvx", "mcpo", "--host", "0.0.0.0", "--port", "3001", "--", "node", "/app/build/index.js"]
```
with:
```dockerfile
# Command to run the application
# Uses the mcpo installed above directly -- not `uvx`, which would
# re-resolve dependencies unpinned on every container start.
CMD ["mcpo", "--host", "0.0.0.0", "--port", "3001", "--", "node", "/app/build/index.js"]
```

- [ ] **Step 4: Build the fixed image and verify it starts cleanly**

Run:
```bash
docker build -f Dockerfile.mcpo -t mollie-mcp:mcpo-after .
docker run --rm -d --name mcpo-smoke -e MOLLIE_API_KEY=test_dummy -p 3001:3001 mollie-mcp:mcpo-after
sleep 3
docker logs mcpo-smoke
curl -sf http://localhost:3001/docs -o /dev/null && echo "docs endpoint OK"
docker stop mcpo-smoke
```
Expected: logs show `mcpo` starting up and proxying the stdio server (no
`ImportError`), and `docs endpoint OK` is printed. Note: the underlying
Mollie tool calls will still fail with a bad API key if you actually invoke
them — that's expected and out of scope here; this step only verifies the
container starts and serves.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile.mcpo
git commit -m "Pin mcpo/mcp versions, drop uvx to fix ImportError crash-loop"
```

---

### Task 2: Split CI into two build/push jobs (`:mcpo`, `:http`), drop `:latest`

**Files:**
- Modify: `.github/workflows/docker-publish.yml`

- [ ] **Step 1: Replace the single metadata+build/push step pair with two pairs**

Replace the file's `steps:` list (everything from `- name: Extract metadata...`
to the end) with:

```yaml
            - name: Extract metadata (mcpo image)
              id: meta_mcpo
              uses: docker/metadata-action@v5
              with:
                  images: ghcr.io/${{ github.repository_owner }}/mollie-mcp
                  flavor: |
                      latest=false
                  tags: |
                      type=raw,value=mcpo
                      type=sha,prefix=mcpo-

            - name: Build and push mcpo image
              uses: docker/build-push-action@v5
              with:
                  context: .
                  file: ./Dockerfile.mcpo
                  push: true
                  platforms: linux/amd64,linux/arm64
                  tags: ${{ steps.meta_mcpo.outputs.tags }}
                  labels: ${{ steps.meta_mcpo.outputs.labels }}

            - name: Extract metadata (http image)
              id: meta_http
              uses: docker/metadata-action@v5
              with:
                  images: ghcr.io/${{ github.repository_owner }}/mollie-mcp
                  flavor: |
                      latest=false
                  tags: |
                      type=raw,value=http
                      type=sha,prefix=http-

            - name: Build and push http image
              uses: docker/build-push-action@v5
              with:
                  context: .
                  file: ./Dockerfile.http
                  push: true
                  platforms: linux/amd64,linux/arm64
                  tags: ${{ steps.meta_http.outputs.tags }}
                  labels: ${{ steps.meta_http.outputs.labels }}
```

`flavor: latest=false` on both stops `metadata-action`'s own automatic
`latest` tag (which it otherwise adds by default on the default branch) in
addition to us not adding one manually.

- [ ] **Step 2: Validate the workflow YAML parses**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/docker-publish.yml'))" && echo "YAML OK"`
Expected: `YAML OK`. (This only checks syntax, not GitHub Actions
semantics — the real test is watching the first Actions run after pushing,
noted in Task 5.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/docker-publish.yml
git commit -m "Publish separate :mcpo and :http image tags, drop :latest"
```

---

### Task 3: Pin the mcpo example to the `:mcpo` tag

**Files:**
- Modify: `examples/openwebui/compose.yml`

- [ ] **Step 1: Update the image tag**

In `examples/openwebui/compose.yml`, change:
```yaml
        image: ghcr.io/hreinberger/mollie-mcp:latest
```
to:
```yaml
        image: ghcr.io/hreinberger/mollie-mcp:mcpo
```

- [ ] **Step 2: Validate compose syntax**

Run: `cd examples/openwebui && docker compose config -q && echo "compose OK" && cd -`
Expected: `compose OK`

- [ ] **Step 3: Commit**

```bash
git add examples/openwebui/compose.yml
git commit -m "Pin openwebui example to the :mcpo image tag"
```

---

### Task 4: Note the published `:http` image as an alternative in the OAuth example

**Files:**
- Modify: `examples/openwebui-oauth/readme.md`

- [ ] **Step 1: Add a note after the "Running it" code block**

In `examples/openwebui-oauth/readme.md`, after this existing block:
````markdown
```bash
cd examples/openwebui-oauth
export WEBUI_SECRET_KEY=$(openssl rand -hex 32)
docker compose up -d --build
```
````
add:
```markdown
`docker compose up -d --build` builds `mollie-mcp` from `Dockerfile.http`
locally. To skip the local build, swap the `mollie-mcp` service's `build:`
directive in `compose.yml` for `image: ghcr.io/hreinberger/mollie-mcp:http`
instead -- CI publishes this tag from the same `Dockerfile.http`.
```

- [ ] **Step 2: Commit**

```bash
git add examples/openwebui-oauth/readme.md
git commit -m "Document published :http image as alternative to local build"
```

---

### Task 5: Add a "Running with Docker" section to the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Insert the new section**

In `README.md`, immediately after this existing paragraph (end of the
"Alternative: HTTP + OAuth" section, just before `## Available Tools`):
```markdown
See [`examples/openwebui-oauth`](examples/openwebui-oauth) for a full local
walkthrough connecting this to Open WebUI's native MCP support (v0.6.31+),
including why this doesn't require hosting the server publicly.
```
insert:
```markdown

## Running with Docker

Two images are published to `ghcr.io/hreinberger/mollie-mcp`, one per
transport above -- there is no `:latest` tag, pick the one that matches how
you want to authenticate:

- **`:http`** -- the OAuth server (`src/httpServer.ts`), no API key needed.
  See [`examples/openwebui-oauth`](examples/openwebui-oauth) for a full
  Open WebUI walkthrough.
- **`:mcpo`** -- the stdio server (`src/index.ts`) fronted by
  [`mcpo`](https://github.com/open-webui/mcpo) as an OpenAPI HTTP API,
  using a static `MOLLIE_API_KEY`. See
  [`examples/openwebui`](examples/openwebui) for a full walkthrough.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Document the :http and :mcpo Docker image tags"
```

---

### Task 6: Push the branch and merge

**Files:** none

- [ ] **Step 1: Push and open a PR**

Run:
```bash
git push -u origin feature/dual-docker-images
```
Then open a PR from `feature/dual-docker-images` into `main` (e.g. via
`gh pr create --fill` if the `gh` CLI is authenticated, or via the GitHub
UI).

- [ ] **Step 2: Watch the first CI run after merge**

After merging to `main`, open the repo's Actions tab and watch the
`Docker Image CI` run. Expected: two `docker/build-push-action` steps both
succeed, and `ghcr.io/hreinberger/mollie-mcp:mcpo` and
`ghcr.io/hreinberger/mollie-mcp:http` both appear under the repo's
Packages. This is the real end-to-end test of Task 2 — local YAML
validation only catches syntax errors, not registry/permission issues.

---

### Task 7: Update the real deployment (`~/git/openwebui/compose.yml`)

**Files:**
- Modify (outside this git repo, unversioned): `~/git/openwebui/compose.yml`

**Context:** This directory is **not a git repository** — there is no
history to fall back on, so back it up first. This step also fixes a live
bug: `MCP_SERVER_URL` is currently `http://localhost:3001/mcp`, but from
inside the `open-webui` container `localhost` means itself, not
`mollie-mcp` — the OAuth-protected-resource metadata Open WebUI fetches
back over the `owui-network` docker network would 404. It needs to be
`http://mollie-mcp:3001/mcp` instead.

- [ ] **Step 1: Back up the compose file**

Run: `cp ~/git/openwebui/compose.yml ~/git/openwebui/compose.yml.bak`

- [ ] **Step 2: Wait for Task 6's CI run to complete**

Confirm `ghcr.io/hreinberger/mollie-mcp:http` exists in the repo's
Packages before proceeding (see Task 6, Step 2).

- [ ] **Step 3: Edit the compose file**

In `~/git/openwebui/compose.yml`, change the `mollie-mcp` service from:
```yaml
    mollie-mcp:
        image: ghcr.io/hreinberger/mollie-mcp:latest
        ports:
            - '3001:3001'
        environment:
#            - MOLLIE_API_KEY=test_NwEggqKJ3qqVK9hSMe7HdfNkFw8nwM
            - PORT=3001
            - MCP_SERVER_URL=http://localhost:3001/mcp
        container_name: mollie-mcp
        restart: unless-stopped
        networks:
            - owui-network
```
to:
```yaml
    mollie-mcp:
        image: ghcr.io/hreinberger/mollie-mcp:http
        ports:
            - '3001:3001'
        environment:
            - PORT=3001
            - MCP_SERVER_URL=http://mollie-mcp:3001/mcp
        container_name: mollie-mcp
        restart: unless-stopped
        networks:
            - owui-network
```

And add `WEBUI_URL` to the `open-webui` service's `environment` list
(leave the existing `WEBUI_SECRET_KEY` line untouched), changing:
```yaml
        environment:
            - WEBUI_SECRET_KEY=01976304-bccc-74e2-9cbf-530c9474c35e
```
to:
```yaml
        environment:
            - WEBUI_SECRET_KEY=01976304-bccc-74e2-9cbf-530c9474c35e
            - WEBUI_URL=https://ai.hannesreinberger.de
```

- [ ] **Step 4: Validate compose syntax**

Run: `cd ~/git/openwebui && docker compose config -q && echo "compose OK"`
Expected: `compose OK`

- [ ] **Step 5: Restart the stack and confirm the new image starts cleanly**

Run:
```bash
docker compose pull mollie-mcp
docker compose up -d
docker compose logs -f mollie-mcp
```
Expected: logs show
`Mollie MCP Server (HTTP + OAuth) listening on http://localhost:3001/mcp`
and `Authorization delegated to https://my.mollie.com`, with no crash-loop.
Press Ctrl-C to stop following logs once confirmed.

- [ ] **Step 6: Manually verify OAuth end-to-end (not automatable from here)**

In Open WebUI at `https://ai.hannesreinberger.de`: **Settings → Admin →
Integrations → External Tool Servers**, confirm the `mollie-mcp` connection
(URL `http://mollie-mcp:3001/mcp`) can complete the Mollie browser login and
a tool call (e.g. "fetch my last 5 transactions") succeeds. This requires a
real browser and a real Mollie account, so it can't be scripted here —
report back if the login or a tool call fails.

---

## Notes

- `src/index.ts` (stdio mode) and its use via direct MCP client configs
  (VS Code/Copilot, Claude Desktop `mcp.json`) are unaffected — out of
  scope, not Docker-related.
- No change to the MCP tool set, OAuth flow, or Mollie API client code.
