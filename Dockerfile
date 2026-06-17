# Dockerfile for Glama (and any container-based MCP host).
# Builds the thin stdio bridge. No dependencies, no build step.
# Glama starts the container and sends an introspection request
# (initialize / tools/list) — both answered locally from tools.json,
# so the check passes with no API key and no network access.
FROM node:20-alpine
WORKDIR /app
COPY package.json index.js tools.json ./
ENTRYPOINT ["node", "index.js"]
