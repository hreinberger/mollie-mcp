import './loadEnv.js'; // This MUST be the very first import

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { mollieCreatePaymentLink, mollieGetPayments } from './mollie.js';

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
server.tool(
    'fetch-transactions',
    'Get a list of the last transactions from Mollie, up to a certain limit',
    { limit: z.number() },
    async ({ limit }) => {
        const response = await mollieGetPayments(limit);
        const data = JSON.stringify(response, null, 2);
        return {
            content: [{ type: 'text', text: data }],
        };
    }
);

server.tool(
    'create-payment-link',
    'Create a payment link with a specified amount',
    { amount: z.string().includes('.').min(3) }, // since regex fails, try to simplify
    async ({ amount }) => {
        const response = await mollieCreatePaymentLink(amount);
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
