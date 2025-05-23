# Using the MCP Server with Docker and Open Web UI

This guide explains how to set up and use the Mollie MCP (Model Context Protocol) server in a dockerized environment, integrated with Open Web UI as a tool.

The provided `compose.yml` file simplifies the setup by orchestrating the Open Web UI frontend and the Mollie MCP server.

## Prerequisites

Before you begin, ensure you have the following installed and running on your local machine:

1.  **Docker Desktop:** To run the Docker containers defined in the `compose.yml` file.
2.  **Ollama:** Open Web UI requires Ollama to be running locally to interact with your large language models. Please ensure Ollama is installed, and you have pulled the models you intend to use (e.g., `ollama pull llama3`).

## Running the Docker Compose Setup

1.  **Navigate to the Docker example directory:**

    ```bash
    cd examples/docker
    ```

2.  **Configure your Mollie API Key:**
    Open the `compose.yml` file and replace `<YOUR_MOLLIE_API_KEY>` with your actual Mollie API key:

    ```yaml
    # ...
    services:
        # ...
        mollie-mcp:
            image: ghcr.io/hreinberger/mollie-mcp:latest
            ports:
                - '3001:3001'
            environment:
                - MOLLIE_API_KEY=your_actual_mollie_api_key_here # <-- IMPORTANT: Update this line
            container_name: mollie-mcp
            restart: unless-stopped
            networks:
                - owui-network
    # ...
    ```

3.  **Start the services:**
    Run the following command to build (if necessary) and start the Open Web UI and Mollie MCP server containers:
    ```bash
    docker compose up -d
    ```
    This will start:
    -   **Open Web UI:** Accessible at `http://localhost:3000`
    -   **Mollie MCP Server:** Running internally on port `3001` and accessible to Open Web UI via the Docker network at `http://mollie-mcp:3001`.

## Configuring Open Web UI to Use the Mollie MCP Server

Once Open Web UI is running, you need to configure it to use the Mollie MCP server as a tool. This will allow your chosen language model within Open Web UI to leverage the Mollie API functionalities.

1.  **Access Open Web UI:** Open your browser and go to `http://localhost:3000`.
2.  **Sign up or Log in** to Open Web UI.
3.  **Navigate to Settings:**
    -   Click on your profile/avatar in the bottom left.
    -   Select "Settings".
4.  **Go to "Tools":**
    -   In the settings menu, find and click on "Tools".
5.  **Add a New Tool:**

    -   Click the "Add a tool" or similar button.
    -   You will be prompted to enter the tool's schema.
    -   For the **Server URL**, enter: `http://mollie-mcp:3001`
    -   Click "Get Schema" or "Import". Open Web UI should fetch the schema from the running Mollie MCP server.
    -   Once the schema is loaded, you can give the tool a descriptive name (e.g., "Mollie Payments") and save it.

    ![Tool Setup](/.github/assets/owui-tool.png)

6.  **Using the Tool in a Chat:**
    -   Start a new chat session in Open Web UI.
    -   Select a model that supports tool usage.
    -   You should now be able to invoke the Mollie MCP tool by asking the model to perform actions related to Mollie, for example: "Create a payment link for 10 euros" or "Fetch my last 5 transactions."
    -   The model will then communicate with the `mollie-mcp` container to execute these actions.

## Stopping the Services

To stop the Open Web UI and Mollie MCP server containers, run the following command in the `examples/docker` directory:

```bash
docker compose down
```

This will stop and remove the containers. The data volume for Open Web UI (`open-webui`) will persist unless explicitly removed.

## Notes

-   The Mollie MCP server container (`mollie-mcp`) uses the image `ghcr.io/hreinberger/mollie-mcp:latest`. Ensure this image is up-to-date or specify a particular version if needed.
-   The Docker network `owui-network` is created to allow easy communication between the `open-webui` container and the `mollie-mcp` container using their service names as hostnames (e.g., `http://mollie-mcp:3001`).
