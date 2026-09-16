import './loadEnv.js'; // This MUST be the very first import

import { randomUUID } from 'node:crypto';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import {
    mcpAuthMetadataRouter,
    getOAuthProtectedResourceMetadataUrl,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { discoverAuthorizationServerMetadata } from '@modelcontextprotocol/sdk/client/auth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import { createClientFromAccessToken } from './mollieClient.js';
import { registerMollieTools } from './tools.js';

// This is Mollie's real OAuth authorization server -- the same one that
// backs mcp.mollie.com. We never issue or store Mollie credentials
// ourselves; we act purely as a resource server that trusts tokens minted
// by this authorization server, exactly the way mcp.mollie.com does.
const MOLLIE_AUTHORIZATION_SERVER = 'https://my.mollie.com';

const PORT = Number(process.env.PORT ?? 3001);
// Must match the URL the MCP client (e.g. Open WebUI) actually uses to reach
// this server. It does not need to be publicly reachable -- Mollie's
// authorization server never calls back into it. See docs/README for why.
const SERVER_URL = new URL(process.env.MCP_SERVER_URL ?? `http://localhost:${PORT}/mcp`);

async function verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
        // We hold no session state and no Mollie credentials of our own, so
        // "verifying" a token means using it for real -- exactly what the
        // tool call that follows will do anyway. A side effect of this: a
        // revoked token stops working immediately, with nothing to expire.
        await createClientFromAccessToken(token).profiles.getCurrent();
    } catch {
        // requireBearerAuth only maps InvalidTokenError to a 401; any other
        // thrown error becomes a 500, which would be the wrong signal for
        // an MCP client trying to detect "you need to (re-)authenticate".
        throw new InvalidTokenError('Invalid or expired Mollie access token');
    }

    return {
        token,
        clientId: 'mollie-oauth-client',
        scopes: [],
        // We re-verify on every request instead of caching, so this value
        // only needs to satisfy the SDK's "is this expired" check for the
        // current request -- it is not a real cache TTL.
        expiresAt: Math.floor(Date.now() / 1000) + 300,
    };
}

async function main() {
    const oauthMetadata = await discoverAuthorizationServerMetadata(MOLLIE_AUTHORIZATION_SERVER);
    if (!oauthMetadata) {
        throw new Error(
            `Could not discover OAuth authorization server metadata at ${MOLLIE_AUTHORIZATION_SERVER}`
        );
    }

    const app = express();
    app.use(express.json());

    // Advertises /.well-known/oauth-protected-resource, telling MCP clients
    // that Mollie's authorization server (not us) issues the tokens this
    // server accepts.
    app.use(
        mcpAuthMetadataRouter({
            // Mollie's endpoint returns genuine RFC 8414 metadata (confirmed
            // live), so this always resolves via the OAuth branch of the
            // SDK's discovery fallback, not the OIDC one.
            oauthMetadata: oauthMetadata as OAuthMetadata,
            resourceServerUrl: SERVER_URL,
            resourceName: 'Mollie MCP Server',
        })
    );

    const bearerAuth = requireBearerAuth({
        verifier: { verifyAccessToken },
        resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(SERVER_URL),
    });

    const server = new McpServer({ name: 'mollie-mcp', version: '0.1.0' });
    registerMollieTools(server, (accessToken) => {
        if (!accessToken) {
            // Should be unreachable: bearerAuth rejects the request before
            // a tool handler ever runs without a verified token.
            throw new Error('No Mollie access token available for this request');
        }
        return createClientFromAccessToken(accessToken);
    });

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
    });
    await server.connect(transport);

    app.all(SERVER_URL.pathname, bearerAuth, async (req, res) => {
        await transport.handleRequest(req, res, req.body);
    });

    app.listen(PORT, () => {
        console.log(
            `Mollie MCP Server (HTTP + OAuth) listening on http://localhost:${PORT}${SERVER_URL.pathname}`
        );
        console.log(`Authorization delegated to ${MOLLIE_AUTHORIZATION_SERVER}`);
    });
}

main().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
});
