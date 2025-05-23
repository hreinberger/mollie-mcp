# Using the Mollie MCP Server with VS Code and GitHub Copilot (Local Development)

This guide explains how to set up the Mollie MCP (Model Context Protocol) server for local development with Visual Studio Code and GitHub Copilot. This allows Copilot to leverage the Mollie API functionalities directly within your IDE.

## Prerequisites

Before you begin, ensure you have the following installed and configured:

1.  **Visual Studio Code:** The latest version is recommended.
2.  **Node.js:** Required to install dependencies and run the MCP server. You can download it from [nodejs.org](https://nodejs.org/).
3.  **GitHub Copilot Extension:** Installed and enabled in VS Code. You should be logged in to GitHub Copilot.
4.  **Mollie API Key:** You will need your Mollie API Key. The server expects this to be available as an environment variable (`MOLLIE_API_KEY`) or in a `.env` file at the root of this project.

## Setup Instructions

1.  **Clone the Repository (if you haven't already):**
    If you're working with this `readme.md` from within the `mollie-mcp` repository, you've likely already done this. If not, clone the repository to your local machine:

    ```bash
    git clone <repository_url>
    cd mollie-mcp # Or your repository's root directory
    ```

2.  **Install Dependencies:**
    Open a terminal in the root directory of the `mollie-mcp` project and run:

    ```bash
    npm install
    ```

    This command installs all necessary Node.js packages defined in `package.json`.

3.  **Build the Server:**
    Compile the TypeScript source code to JavaScript:

    ```bash
    npm run build
    ```

    This will create a `build` directory containing the compiled server files, including `build/index.js`.

4.  **Configure VS Code for the MCP Server:**
    a. **Create a `.vscode` folder:** If it doesn't already exist, create a folder named `.vscode` at the root of your `mollie-mcp` project directory.

    b. **Copy `mcp.json`:**
    Copy the `mcp.json` file from this example directory (`examples/vscode/mcp.json`) into the `.vscode` folder you just created (i.e., `.vscode/mcp.json`).

    c. **Update `mcp.json` with the correct path:**
    Open the `.vscode/mcp.json` file. You need to tell VS Code where to find the compiled MCP server.

    You **must** replace `"<absolute path to repo>/build/index.js"` with the actual absolute path to the `index.js` file within the `build` directory of _your_ cloned `mollie-mcp` repository.

    For example, if your repository is cloned at `/Users/yourname/projects/mollie-mcp`, the path would be `/Users/yourname/projects/mollie-mcp/build/index.js`.

5.  **Set your Mollie API Key:**
    The MCP server needs your Mollie API key to function. Create a file named `.env` in the root directory of the `mollie-mcp` project (alongside `package.json`) and add your API key:
    `    MOLLIE_API_KEY="your_actual_mollie_api_key_here"
   `

6.  **Restart VS Code:**
    After saving the `.vscode/mcp.json` file and ensuring your API key is set, fully restart VS Code to allow it to recognize the new MCP server configuration.

This setup allows for a powerful local development experience, enabling GitHub Copilot to directly assist with Mollie-related tasks within your editor.
