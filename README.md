# Mollie MCP Server

This project implements a Model Context Protocol (MCP) server that interfaces with the Mollie API to provide information about Mollie payments.

![Mollie MCP Server Integration](/.github/assets/mollie-mcp.png)

## What Is This Good For?

Currently, not much. Since Mollie expects customers to be available for a redirect, it doesn't really make sense to do payments over an LLM conversation (maybe with payment links though?). So for now I've implemented the "List Payments" Endpoint. Users can ask for the latest transactions on their mollie account and the LLM will receive all available info on them. Based on this, we could let the LLM do creative things like advanced BI or writing Haikus about the names of your customers.

The benefit of piping your payment data to an LLM is that you can now query the data in natural language without rigid UIs.

![Average Cart Values](/.github/assets/mollie-mcp-2.png)

## About MCP Servers

Model Context Protocol (MCP) servers act as bridges between language models and various data sources or tools. They expose capabilities (like fetching data or executing actions) that a language model can then utilize to fulfill user requests. This allows language models to interact with external systems and access real-time information or perform tasks beyond their inherent knowledge. This server, for example, allows a model to query Mollie payment information.

## Technology Used

-   **Node.js**: Runtime environment for executing JavaScript/TypeScript.
-   **TypeScript**: Superset of JavaScript that adds static typing.
-   **Mollie API Client**: Official Node.js library for interacting with the Mollie API.
-   **dotenv**: For loading environment variables from a `.env` file.
-   **@modelcontextprotocol/sdk**: For building the MCP server.

## Setup Instructions

1.  **Clone the repository:**

    ```bash
    git clone git@github.com:hreinberger/mollie-mcp.git
    cd mollie-mcp
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**

    -   copy the example to a `.env` file in the root of the project:
        ```
        cp .env.example .env
        nano .env
        ```
    -   Replace `your_mollie_api_test_or_live_key` with your actual Mollie API key. You can find your API keys in your [Mollie Dashboard](https://www.mollie.com/dashboard/developers/api-keys).

4.  **Build the project:**

    ```bash
    npm run build
    ```

    This will compile the TypeScript files from `src/` to JavaScript in the `build/` directory.

5.  **Run the MCP Server:**
    If you are using an MCP-compatible client (I'm using Github Copilot), you can add the config in `.vscode/mcp.json`.

    Example `mcp.json`:

    ```json
    {
        "servers": {
            "mollie-mcp": {
                "type": "stdio",
                "command": "node",
                "args": ["<absolute-path-to-repo>/build/index.js"]
            }
        }
    }
    ```

## Available Tools

The server exposes the following tools that can be called by an MCP client:

-   **`fetch-transactions`**:
    -   Description: Get a list of the last transactions from Mollie.
    -   Input: `limit` (number, optional, default: 5) - The number of transactions to retrieve.
    -   Output: A JSON string containing the list of payment objects from Mollie.

This MCP server is designed to be a simple example. It can be extended with more tools to interact further with the Mollie API or other services.

## Caveats

Currently, we're handing back the full payment objects to the LLM, which include lots of data and thus, tokens. Be mindful of your LLM's context window.
