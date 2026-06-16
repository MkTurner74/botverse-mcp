#!/usr/bin/env node
/**
 * botverse-mcp — stdio bridge for the Botverse MCP server.
 *
 * Reads MCP JSON-RPC from stdin, forwards to botverse.cloud/mcp,
 * writes responses to stdout. Compatible with Claude Desktop, Cursor,
 * VS Code, Windsurf, Zed, and any MCP-compatible agent runtime.
 *
 * Auth (set one):
 *   BOTVERSE_API_KEY=bv_live_...      — API key, sent as Authorization: Bearer
 *   BOTVERSE_CONNECTOR_URL=https://...  — Full connector URL with ?token=bv_sess_...
 */

const { createInterface } = require("readline");
const https = require("https");
const { URL } = require("url");

const CONNECTOR_URL = process.env.BOTVERSE_CONNECTOR_URL;
const API_KEY = process.env.BOTVERSE_API_KEY;
const BASE_URL = "https://botverse.cloud/mcp";

if (!CONNECTOR_URL && !API_KEY) {
  process.stderr.write(
    "[botverse-mcp] Error: set BOTVERSE_API_KEY or BOTVERSE_CONNECTOR_URL.\n" +
    "  Get credentials at https://botverse.cloud/dashboard/api-keys\n"
  );
  process.exit(1);
}

function getTargetUrl() {
  return CONNECTOR_URL || BASE_URL;
}

function getHeaders(bodyLength) {
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": bodyLength,
    "User-Agent": "botverse-mcp/1.0.3",
  };
  if (!CONNECTOR_URL && API_KEY) {
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }
  return headers;
}

function post(body) {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(body);
    const target = new URL(getTargetUrl());
    const options = {
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method: "POST",
      headers: getHeaders(Buffer.byteLength(raw)),
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Non-JSON response (HTTP ${res.statusCode}): ${data.slice(0, 200)}`));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(60000, () => { req.destroy(new Error("Request timed out")); });
    req.write(raw);
    req.end();
  });
}

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return; // ignore malformed input
  }

  try {
    const response = await post(message);
    process.stdout.write(JSON.stringify(response) + "\n");
  } catch (err) {
    const errorResponse = {
      jsonrpc: "2.0",
      id: message.id ?? null,
      error: {
        code: -32603,
        message: err instanceof Error ? err.message : "Internal error",
      },
    };
    process.stdout.write(JSON.stringify(errorResponse) + "\n");
  }
});

rl.on("close", () => { process.exit(0); });
