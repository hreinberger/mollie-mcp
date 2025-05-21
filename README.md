# Mollie MCP Server

This project implements a Model Context Protocol (MCP) server that interfaces with the Mollie API to provide information about Mollie payments.

![Mollie MCP Server Integration](/.github/assets/mollie-mcp.png)

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

    -   Create a `.env` file in the root of the project:
        ```
        MOLLIE_API_KEY=your_mollie_api_test_or_live_key
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
