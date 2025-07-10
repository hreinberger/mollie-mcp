import './loadEnv.js'; // This MUST be the very first import

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
    mollieCreatePaymentLink,
    mollieGetPayments,
    mollieGetPayment,
    mollieGetMethods,
    mollieGetProfile,
} from './mollie.js';

// Create server instance
const server = new McpServer({
    name: 'mollie-mcp',
    version: '0.1.0',
    capabilities: {
        resources: {},
        tools: {},
    },
});

// Define the tools our MCP server will provide
server.registerTool(
    'fetch-transactions',
    {
        description:
            'Get a list of the last transactions from Mollie, up to a certain limit.',
        inputSchema: {
            limit: z.number(),
        },
    },
    async ({ limit }) => {
        const response = await mollieGetPayments(limit);
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
    async ({ paymentId }) => {
        const response = await mollieGetPayment(paymentId);
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
    async ({ amount }) => {
        const response = await mollieCreatePaymentLink(amount);
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
    async () => {
        const response = await mollieGetMethods();
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
    async () => {
        const response = await mollieGetProfile();
        const data = JSON.stringify(response, null, 2);
        return {
            content: [{ type: 'text', text: data }],
        };
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Mollie MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
});
