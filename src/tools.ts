import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MollieClient } from '@mollie/api-client';
import { z } from 'zod';
import {
    mollieCreatePaymentLink,
    mollieGetPayments,
    mollieGetPayment,
    mollieGetMethods,
    mollieGetProfile,
} from './mollie.js';

// Builds the Mollie client for a single tool invocation. Stdio always
// returns the same apiKey-backed client; the HTTP transport builds a fresh
// client from the bearer token carried by that specific request.
export type ResolveMollieClient = (accessToken?: string) => MollieClient;

// Shared tool definitions used by both the stdio transport (src/index.ts)
// and the OAuth-protected HTTP transport (src/httpServer.ts), so the two
// stay in sync and the tool schemas/descriptions are defined once.
export function registerMollieTools(server: McpServer, resolveClient: ResolveMollieClient) {
    server.registerTool(
        'fetch-transactions',
        {
            description:
                'Get a list of the last transactions from Mollie, up to a certain limit.',
            inputSchema: {
                limit: z.number(),
            },
        },
        async ({ limit }, extra) => {
            const client = resolveClient(extra.authInfo?.token);
            const response = await mollieGetPayments(client, limit);
            const data = JSON.stringify(response, null, 2);
            return {
                content: [{ type: 'text', text: data }],
            };
        }
    );

    server.registerTool(
        'transaction-info',
        {
            description:
                'Get all info for a given payment transaction. The transaction ID must start with "tr_"',
            inputSchema: {
                paymentId: z.string().startsWith('tr_'),
            },
        },
        async ({ paymentId }, extra) => {
            const client = resolveClient(extra.authInfo?.token);
            const response = await mollieGetPayment(client, paymentId);
            const data = JSON.stringify(response, null, 2);
            return {
                content: [{ type: 'text', text: data }],
            };
        }
    );

    server.registerTool(
        'create-payment-link',
        {
            description:
                'Create a payment link with a specified amount. The amount must be a string with at least 4 characters, including a decimal point.',
            inputSchema: {
                amount: z.string().includes('.').min(4),
            },
        },
        async ({ amount }, extra) => {
            const client = resolveClient(extra.authInfo?.token);
            const response = await mollieCreatePaymentLink(client, amount);
            const data = JSON.stringify(response, null, 2);
            return {
                content: [{ type: 'text', text: data }],
            };
        }
    );

    server.registerTool(
        'fetch-methods',
        {
            description: 'Get a list of all available payment methods from Mollie.',
            inputSchema: {},
        },
        async (_args, extra) => {
            const client = resolveClient(extra.authInfo?.token);
            const response = await mollieGetMethods(client);
            const data = JSON.stringify(response, null, 2);
            return {
                content: [{ type: 'text', text: data }],
            };
        }
    );

    server.registerTool(
        'profile-info',
        {
            description: 'Get information about the currently used Mollie profile.',
            inputSchema: {},
        },
        async (_args, extra) => {
            const client = resolveClient(extra.authInfo?.token);
            const response = await mollieGetProfile(client);
            const data = JSON.stringify(response, null, 2);
            return {
                content: [{ type: 'text', text: data }],
            };
        }
    );
}
