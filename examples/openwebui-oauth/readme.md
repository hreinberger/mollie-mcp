# Mollie MCP via native MCP + browser-based OAuth (no API key)

This is the "trustless OAuth" setup: no `MOLLIE_API_KEY` anywhere. Each Open
WebUI user connects their own Mollie account with a browser login, and the
MCP server never stores or even sees a long-lived credential -- it only ever
holds the bearer token attached to the request it's currently handling.

This is a different, newer integration path than [`examples/openwebui`](../openwebui),
which fronts the stdio server with `mcpo` and a static API key. Requires Open
WebUI **v0.6.31+** for native MCP (Streamable HTTP) support.

## How it works

- `mollie-mcp` here runs `src/httpServer.ts`, not the stdio server -- a real
  HTTP MCP server that advertises itself as an OAuth-protected resource.
- It delegates authorization entirely to Mollie's own authorization server
  (`https://my.mollie.com`) -- the same one behind Mollie's official
  `mcp.mollie.com`. This server never registers as, or proxies, an OAuth
  authorization server itself.
- Open WebUI is the OAuth client: it discovers Mollie's authorization
  server from our `/.well-known/oauth-protected-resource` endpoint,
  registers itself (Dynamic Client Registration) or uses a pre-registered
  client (Static), and does the PKCE + browser-login dance directly against
  Mollie. The resulting access token is sent to `mollie-mcp` as a bearer
  token on every MCP call.

## Running it

```bash
cd examples/openwebui-oauth
export WEBUI_SECRET_KEY=$(openssl rand -hex 32)
docker compose up -d --build
```

`docker compose up -d --build` builds `mollie-mcp` from `Dockerfile.http`
locally. To skip the local build, swap the `mollie-mcp` service's `build:`
directive in `compose.yml` for `image: ghcr.io/hreinberger/mollie-mcp:http`
instead -- CI publishes this tag from the same `Dockerfile.http`.

This starts:

- **Open WebUI** at `http://localhost:3000`
- **Mollie MCP Server** at `http://mollie-mcp:3001/mcp` on the Docker network
  (no public hosting required -- see the note below)

## Connecting Mollie in Open WebUI

1. Sign in to Open WebUI, then go to **Settings → Admin → Integrations → External Tool Servers**.
2. Click **+ Add Connection**.
3. Set **Type** to `MCP (Streamable HTTP)`.
4. **URL**: `http://mollie-mcp:3001/mcp`
5. **Auth**: try `OAuth 2.1 (Dynamic)` first.
6. Save. Open WebUI should discover the Mollie authorization server and
   prompt you to connect an account -- this opens Mollie's real login page.

### If Dynamic Client Registration fails

Mollie's registration endpoint requires the registering client's `client_uri`
to be a real, publicly reachable URL (this is Mollie's anti-abuse check, not
an approval process -- confirmed by testing directly against
`https://api.mollie.com/oauth2/register`). If Open WebUI submits a
`client_uri` that isn't reachable from the internet (e.g. it derives one
from a local `WEBUI_URL`), registration will be rejected.

Fall back to `OAuth 2.1 (Static)`: register a client by hand once, using a
real reachable URL as `client_uri` (a GitHub repo works fine), then paste
the returned `client_id` into Open WebUI. No client secret is issued or
needed -- Mollie's authorization server supports public (PKCE-only) clients.

## Do we need to host this publicly?

No. Three separate network legs are involved, and only one of them needs to
be reachable by anything other than your own machine:

- **Open WebUI ↔ mollie-mcp**: server-to-server, over the Docker network
  (`http://mollie-mcp:3001`). Never needs to be public.
- **Your browser ↔ Open WebUI**: wherever `WEBUI_URL` points. For local use
  that's `http://localhost:3000` -- Mollie's login redirects back here, and
  Mollie is fine with loopback redirect URIs.
- **Open WebUI ↔ Mollie's authorization server**: needs normal outbound
  internet access from wherever Open WebUI runs.

`mollie-mcp` itself is never the target of a browser redirect and Mollie's
servers never call it -- it only needs to be reachable by Open WebUI's
backend. If your Open WebUI instance is itself tunneled to a public
hostname (so that `WEBUI_URL` is a real public URL), the DCR `client_uri`
check above is moot -- Open WebUI's own address already passes it.

## Notes

- Don't set this tool as always-enabled on a model: the OAuth login needs an
  interactive browser redirect, which can't happen mid-inference. Let users
  toggle it on manually in the chat instead.
- The MCP server holds no Mollie credentials, session state, or tokens on
  disk. Revoking access in a user's Mollie account takes effect on their
  very next tool call.
