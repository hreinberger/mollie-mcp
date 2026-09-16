import './loadEnv.js'; // This MUST be the very first import

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClientFromApiKey } from './mollieClient.js';
import { registerMollieTools } from './tools.js';

// Create server instance
const server = new McpServer({
    name: 'mollie-mcp',
    version: '0.1.0',
});

// Stdio is a single-user, single-process transport: one API key from .env
// authenticates every tool call for the lifetime of the process.
const mollieClient = createClientFromApiKey();
registerMollieTools(server, () => mollieClient);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Mollie MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
});
