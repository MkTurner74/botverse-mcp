#!/usr/bin/env node
/**
 * botverse-mcp — stdio bridge for the Botverse MCP server.
 *
 * Answers `initialize` and `tools/list` locally from tools.json (no key,
 * no network — so the server is introspectable in any sandbox). Proxies
 * actual tool calls to botverse.cloud/mcp, which requires auth.
 *
 * Auth (set one — only needed to *call* tools, not to introspect):
 *   BOTVERSE_API_KEY=bv_live_...        — API key, sent as Authorization: Bearer
 *   BOTVERSE_CONNECTOR_URL=https://...  — Full connector URL with ?token=bv_sess_...
 *
 * Compatible with Claude Desktop, Cursor, VS Code, Windsurf, Zed, and any
 * MCP-compatible agent runtime.
 */

const { createInterface } = require("readline");
const { readFileSync } = require("fs");
const path = require("path");
const https = require("https");
const { URL } = require("url");

const CONNECTOR_URL = process.env.BOTVERSE_CONNECTOR_URL;
const API_KEY = process.env.BOTVERSE_API_KEY;
const BASE_URL = "https://botverse.cloud/mcp";
const VERSION = "1.0.4";

let TOOLS = [];
try {
  TOOLS = JSON.parse(readFileSync(path.join(__dirname, "tools.json"), "utf8"));
} catch {
  TOOLS = []; // introspection still responds, just with an empty tool list
}

const SERVER_INFO = {
  name: "Botverse",
  version: VERSION,
  description:
    "Offload compute-heavy tasks to Botverse — video transcoding and document " +
    "conversion run server-side and return download links. Video (MP4, WebM, " +
    "ProRes, MP3, GIF) and documents (Markdown/HTML/DOCX to DOCX, PDF, HTML, XLSX, TXT).",
};

function reply(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}
function ok(id, result) {
  reply({ jsonrpc: "2.0", id, result });
}
function err(id, message, code = -32603) {
  reply({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function getTargetUrl() {
  return CONNECTOR_URL || BASE_URL;
}
function getHeaders(bodyLength) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "Content-Length": bodyLength,
    "User-Agent": "botverse-mcp/" + VERSION,
  };
  if (!CONNECTOR_URL && API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;
  return headers;
}

// Proxy a request to the hosted Botverse MCP endpoint (used for tool calls).
function proxy(body) {
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
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Non-JSON response (HTTP ${res.statusCode}): ${data.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(120000, () => req.destroy(new Error("Request timed out")));
    req.write(raw);
    req.end();
  });
}

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return; // ignore malformed input
  }

  const { id, method } = msg;

  // Notifications (no id) — acknowledge silently per MCP.
  if (id === undefined || id === null) return;

  // Handle introspection locally — no key, no network.
  if (method === "initialize") {
    return ok(id, {
      protocolVersion: msg.params?.protocolVersion || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  }
  if (method === "tools/list") {
    return ok(id, { tools: TOOLS });
  }
  if (method === "ping") {
    return ok(id, {});
  }

  // Everything else (tools/call, etc.) needs auth and goes to the hosted server.
  if (!CONNECTOR_URL && !API_KEY) {
    return err(
      id,
      "Botverse needs credentials to run a job. Set BOTVERSE_API_KEY or " +
        "BOTVERSE_CONNECTOR_URL. Get one at https://botverse.cloud/dashboard/api-keys"
    );
  }
  try {
    const response = await proxy(msg);
    reply(response);
  } catch (e) {
    err(id, e instanceof Error ? e.message : "Internal error");
  }
});

rl.on("close", () => process.exit(0));
