FROM python:3.12-slim

# Install system dependencies: Node.js, npm
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
RUN pip install mcpo uv

# Copy application dependency manifests
# It's good practice to commit your package-lock.json or yarn.lock file.
COPY package.json package-lock.json* ./
# If package-lock.json doesn't exist, npm will proceed based on package.json.

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application source code
# This includes src/, tsconfig.json, etc.
COPY src ./src
COPY tsconfig.json .

# Build the application (compile TypeScript, etc.)
# This should generate files in a 'build' directory, e.g., /app/build/index.js
RUN npm run build
RUN npm prune --production

# Expose the port the application listens on (for documentation and `docker run -P`)
EXPOSE 3001

# Command to run the application
# Assumes npm run build creates ./build/index.js and mcpo is in PATH
CMD ["uvx", "mcpo", "--host", "0.0.0.0", "--port", "3001", "--", "node", "/app/build/index.js"]