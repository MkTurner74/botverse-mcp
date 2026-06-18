#!/usr/bin/env node
/**
 * botverse — command-line interface for Botverse.
 *
 * For humans and shell-capable automation (CI, cron, local coding agents) — it
 * reads files from disk and streams them to the API directly, so it never serializes
 * content through an LLM the way the in-chat MCP route must. Talks to the same
 * hosted endpoint (botverse.cloud/mcp) with a bv_live_ key.
 *
 *   export BOTVERSE_API_KEY=bv_live_xxx
 *   botverse convert report.md --to pdf
 *   botverse convert *.md --to docx,pdf -o ./out
 *   botverse transcode clip.mov --to mp4 -o ./out
 *   botverse transcribe call.mp4 --to docx --attendees "Sarah Chen,Mike Torres"
 *   botverse balance
 *
 * NOTE: this needs outbound network to botverse.cloud and S3. It does NOT work inside
 * sandboxed agent environments (claude.ai / Claude Desktop) whose egress is allowlisted —
 * there, use the MCP tools (convert_content / get_output_content) instead.
 */

"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");
const { URL } = require("url");

const VERSION = "1.1.0";
const BASE_URL = process.env.BOTVERSE_MCP_URL || "https://botverse.cloud/mcp";

// ── tiny ANSI helpers ─────────────────────────────────────────────────────────
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s) => c("2", s), bold = (s) => c("1", s), green = (s) => c("32", s), red = (s) => c("31", s), cyan = (s) => c("36", s);
const log = (...a) => process.stderr.write(a.join(" ") + "\n");

function die(msg) { log(red("error: ") + msg); process.exit(1); }

// ── format maps ───────────────────────────────────────────────────────────────
const CONTENT_TYPES = {
  md: "text/markdown", markdown: "text/markdown", html: "text/html", htm: "text/html",
  rst: "text/x-rst", txt: "text/plain", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", avi: "video/x-msvideo",
  mkv: "video/x-matroska", m4v: "video/x-m4v", wav: "audio/wav", m4a: "audio/mp4",
  mp3: "audio/mpeg", flac: "audio/flac", wma: "audio/x-ms-wma",
};
const TEXT_INPUTS = new Set(["md", "markdown", "html", "htm", "rst", "txt"]);
const EXT_OF = (f) => (path.extname(f).slice(1) || "").toLowerCase();
const MAX_INLINE = 4 * 1024 * 1024; // proxy inline ceiling

// ── HTTP / JSON-RPC ───────────────────────────────────────────────────────────
// Auth: either a bv_live_ API key (Authorization: Bearer) or a full connector URL
// containing ?token=bv_sess_… (BOTVERSE_CONNECTOR_URL). Returns the endpoint + headers.
function authTarget(contentLength) {
  const connector = argv.flags["connector-url"] || process.env.BOTVERSE_CONNECTOR_URL;
  const key = argv.flags["api-key"] || process.env.BOTVERSE_API_KEY;
  if (!connector && !key) {
    die("no credentials. Set BOTVERSE_API_KEY=bv_live_… (or BOTVERSE_CONNECTOR_URL=…?token=bv_sess_…). Get a key at https://botverse.cloud/dashboard/api-keys");
  }
  const headers = { "Content-Type": "application/json", "Content-Length": contentLength, "User-Agent": "botverse-cli/" + VERSION };
  if (!connector && key) headers["Authorization"] = `Bearer ${key}`;
  return { url: connector || BASE_URL, headers };
}

function request(urlStr, { method = "POST", headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      { hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method, headers },
      (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks) }));
      }
    );
    req.on("error", reject);
    req.setTimeout(180000, () => req.destroy(new Error("request timed out")));
    if (body) req.write(body);
    req.end();
  });
}

let RPC_ID = 0;
async function mcp(tool, args) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: ++RPC_ID, method: "tools/call", params: { name: tool, arguments: args } });
  const { url, headers } = authTarget(Buffer.byteLength(body));
  const { status, buffer } = await request(url, { headers, body });
  let json;
  try { json = JSON.parse(buffer.toString()); }
  catch { throw new Error(`HTTP ${status}: ${buffer.toString().slice(0, 200)}`); }
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  const text = json.result?.structuredContent ?? json.result?.content?.[0]?.text;
  if (text == null) throw new Error("unexpected response shape");
  return typeof text === "string" ? JSON.parse(text) : text;
}

// ── S3 multipart upload (presigned POST) ──────────────────────────────────────
async function uploadFile(filePath) {
  const filename = path.basename(filePath);
  const ext = EXT_OF(filename);
  const ct = CONTENT_TYPES[ext] || "application/octet-stream";
  const up = await mcp("get_upload_url", { filename, content_type: ct });
  const fields = up.upload_fields || {};
  const fileBuf = fs.readFileSync(filePath);

  const boundary = "----botverse" + Math.random().toString(16).slice(2);
  const pre = [];
  for (const [k, v] of Object.entries(fields)) {
    pre.push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  }
  pre.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${fields["Content-Type"] || ct}\r\n\r\n`);
  const body = Buffer.concat([Buffer.from(pre.join("")), fileBuf, Buffer.from(`\r\n--${boundary}--\r\n`)]);

  const { status, buffer } = await request(up.upload_url, {
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": body.length },
    body,
  });
  if (status !== 204 && status !== 201 && status !== 200) {
    throw new Error(`S3 upload failed (HTTP ${status}): ${buffer.toString().slice(0, 200)}`);
  }
  return up.object_key;
}

// ── job polling + download ────────────────────────────────────────────────────
async function poll(jobId) {
  const start = Date.now();
  for (;;) {
    const s = await mcp("get_job_status", { job_id: jobId });
    if (s.status === "complete") return s;
    if (s.status === "failed") throw new Error(s.error || "job failed");
    if (Date.now() - start > 30 * 60 * 1000) throw new Error("timed out waiting for job");
    if (s.stage_message) process.stderr.write("\r" + dim("  " + s.stage_message.padEnd(48)));
    await new Promise((r) => setTimeout(r, 3000));
  }
}

async function downloadOutput(jobId, outPath) {
  const dl = await mcp("get_download_url", { job_id: jobId });
  const { status, buffer } = await request(dl.download_url, { method: "GET" });
  if (status !== 200) throw new Error(`download failed (HTTP ${status})`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  return buffer.length;
}

// ── submit helpers ────────────────────────────────────────────────────────────
async function submitConvert(filePath, outFmt) {
  const ext = EXT_OF(filePath);
  const size = fs.statSync(filePath).size;
  // Small text files go inline (no upload round-trip); large or binary go via S3.
  if (TEXT_INPUTS.has(ext) && size <= MAX_INLINE) {
    const r = await mcp("convert_content", {
      content: fs.readFileSync(filePath, "utf8"),
      input_format: ext === "markdown" ? "md" : ext === "htm" ? "html" : ext,
      output_format: outFmt,
    });
    return r.job_id;
  }
  const key = await uploadFile(filePath);
  const r = await mcp("convert_file", { object_key: key, output_format: outFmt });
  return r.job_id;
}

async function submitTranscode(filePath, outFmt, opts) {
  const key = await uploadFile(filePath);
  const r = await mcp("transcode_video", { object_key: key, output_format: outFmt, ...(opts ? { options: opts } : {}) });
  return r.job_id;
}

async function submitTranscribe(filePath, outFmt, opts) {
  const key = await uploadFile(filePath);
  const r = await mcp("transcribe_media", { object_key: key, output_format: outFmt, ...(opts ? { options: opts } : {}) });
  return r.job_id;
}

// ── commands ──────────────────────────────────────────────────────────────────
async function runBatch(files, formats, submit, outDir) {
  if (!files.length) die("no input files");
  let failures = 0;
  for (const file of files) {
    if (!fs.existsSync(file)) { log(red("✗ ") + file + dim(" — not found")); failures++; continue; }
    for (const fmt of formats) {
      const t0 = Date.now();
      const base = path.basename(file, path.extname(file));
      const outPath = path.join(outDir, `${base}.${fmt}`);
      process.stderr.write(dim(`· ${path.basename(file)} → ${fmt} …`));
      try {
        const jobId = await submit(file, fmt);
        await poll(jobId);
        const bytes = await downloadOutput(jobId, outPath);
        process.stderr.write("\r" + green("✓ ") + outPath + dim(`  (${(bytes / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`).padEnd(20) + "\n");
      } catch (e) {
        process.stderr.write("\r" + red("✗ ") + `${path.basename(file)} → ${fmt}` + dim("  " + (e.message || e)) + "\n");
        failures++;
      }
    }
  }
  if (failures) process.exitCode = 1;
}

function parseFormats(flag, allowed, label) {
  if (!flag) die(`--to is required (${label}). e.g. --to ${allowed[0]}`);
  const fmts = String(flag).split(",").map((s) => s.trim()).filter(Boolean);
  for (const f of fmts) if (!allowed.includes(f)) die(`unsupported --to "${f}". Allowed: ${allowed.join(", ")}`);
  return fmts;
}

const COMMANDS = {
  async convert() {
    const fmts = parseFormats(argv.flags.to, ["docx", "pdf", "html", "txt", "md", "rst", "xlsx"], "convert");
    await runBatch(argv.files, fmts, (f, fmt) => submitConvert(f, fmt), argv.flags.o || argv.flags.out || ".");
  },
  async transcode() {
    const fmts = parseFormats(argv.flags.to, ["mp4", "webm", "mov_prores", "mp3", "gif"], "transcode");
    const opts = {};
    if (argv.flags.resolution) opts.height = ({ "4k": 2160, "1080p": 1080, "720p": 720, "480p": 480, "360p": 360 }[argv.flags.resolution]) || undefined;
    await runBatch(argv.files, fmts, (f, fmt) => submitTranscode(f, fmt, Object.keys(opts).length ? opts : null), argv.flags.o || argv.flags.out || ".");
  },
  async transcribe() {
    const fmts = parseFormats(argv.flags.to, ["txt", "json", "srt", "vtt", "docx", "pdf"], "transcribe");
    const opts = {};
    if (argv.flags.attendees) opts.attendees = String(argv.flags.attendees).split(",").map((n) => ({ name: n.trim() })).filter((a) => a.name);
    if (argv.flags.language) opts.language = argv.flags.language;
    await runBatch(argv.files, fmts, (f, fmt) => submitTranscribe(f, fmt, Object.keys(opts).length ? opts : null), argv.flags.o || argv.flags.out || ".");
  },
  async balance() {
    const r = await mcp("get_wallet_balance", {});
    log(bold("Wallet: ") + green(`$${Number(r.balance_usd).toFixed(2)}`) + (r.auto_refill_enabled ? dim("  (auto-refill on)") : ""));
  },
};

function usage() {
  log(`${bold("botverse")} ${dim("v" + VERSION)} — Botverse from the command line

${bold("Usage:")}
  botverse convert    <files…> --to <fmt[,fmt]> [-o dir]
  botverse transcode  <files…> --to <fmt> [--resolution 1080p] [-o dir]
  botverse transcribe <files…> --to <fmt> [--attendees "A,B"] [--language en-US] [-o dir]
  botverse balance

${bold("Auth:")}  export BOTVERSE_API_KEY=bv_live_…   (or --api-key)

${bold("Examples:")}
  ${cyan("botverse convert report.md --to pdf")}
  ${cyan("botverse convert *.md --to docx,pdf -o ./out")}
  ${cyan("botverse transcode clip.mov --to mp4 -o ./out")}
  ${cyan("botverse transcribe call.mp4 --to docx --attendees \"Sarah Chen,Mike Torres\"")}

Docs: https://botverse.cloud/docs/cli`);
}

// ── arg parsing ───────────────────────────────────────────────────────────────
function parseArgs(args) {
  const flags = {}; const files = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("-")) { flags[key] = next; i++; } else flags[key] = true;
    } else if (a.startsWith("-")) {
      const key = a.slice(1);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("-")) { flags[key] = next; i++; } else flags[key] = true;
    } else files.push(a);
  }
  return { flags, files };
}

const rawArgs = process.argv.slice(2);
const command = rawArgs[0];
const argv = parseArgs(rawArgs.slice(1));

(async () => {
  if (!command || command === "help" || argv.flags.help || argv.flags.h) return usage();
  if (command === "version" || argv.flags.version || argv.flags.v) return log("botverse " + VERSION);
  const fn = COMMANDS[command];
  if (!fn) { log(red(`unknown command: ${command}`)); usage(); process.exit(1); }
  try { await fn(); }
  catch (e) { die(e.message || String(e)); }
})();
