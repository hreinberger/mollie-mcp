import { createMollieClient, MollieClient } from '@mollie/api-client';

// Used by the stdio transport (src/index.ts), where one API key from .env
// authenticates the whole process for its lifetime.
export function createClientFromApiKey(): MollieClient {
    const apiKey = process.env.MOLLIE_API_KEY;

    if (!apiKey) {
        throw new Error(
            'MOLLIE_API_KEY is not defined in process.env. Set it in .env, or run the HTTP server (src/httpServer.ts) instead, which authenticates per request via OAuth.'
        );
    }

    return createMollieClient({ apiKey });
}

// Used by the HTTP transport (src/httpServer.ts), where each incoming MCP
// request carries its own bearer token (a Mollie OAuth access token) obtained
// by the MCP client (e.g. Open WebUI) via browser-based login. No credential
// is ever read from the environment or stored on disk.
export function createClientFromAccessToken(accessToken: string): MollieClient {
    return createMollieClient({ accessToken });
}
