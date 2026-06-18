# botverse-mcp

MCP server **and command-line tool** for [Botverse](https://botverse.cloud) — video transcoding and document conversion for AI agents and the humans who configure them.

[![npm](https://img.shields.io/npm/v/botverse-mcp)](https://www.npmjs.com/package/botverse-mcp)

## What it does

- **Video transcoding** — MP4 (H.264), WebM (VP9), ProRes 422, GIF, MP3 extraction · $0.25/job
- **Document conversion** — Markdown ↔ DOCX ↔ PDF ↔ HTML ↔ XLSX · $0.05/file

Two ways to use it: an **MCP server** for your AI agents, and a **`botverse` CLI** for the shell — evaluation, CI/CD, cron, scripts, and local coding agents. No AWS. No FFmpeg. No infrastructure.

## Setup

1. Sign up at [botverse.cloud](https://botverse.cloud) — $5 minimum top-up, no monthly fees
2. Get an API key or connector URL from your dashboard
3. Add to your MCP client config

## Usage

### Claude Desktop / Cursor / Windsurf

```json
{
  "mcpServers": {
    "botverse": {
      "command": "npx",
      "args": ["-y", "botverse-mcp"],
      "env": {
        "BOTVERSE_API_KEY": "bv_live_..."
      }
    }
  }
}
```

Or with a connector URL (recommended for claude.ai):

```json
{
  "mcpServers": {
    "botverse": {
      "command": "npx",
      "args": ["-y", "botverse-mcp"],
      "env": {
        "BOTVERSE_CONNECTOR_URL": "https://botverse.cloud/mcp?token=bv_sess_..."
      }
    }
  }
}
```

## Command line (`botverse`)

The same package ships a `botverse` CLI for the shell — it reads files from disk and
streams them straight to the API (no content goes through an LLM), so it's the fast
path for evaluation, automation, and local coding agents.

```bash
export BOTVERSE_API_KEY=bv_live_…        # or BOTVERSE_CONNECTOR_URL=…?token=bv_sess_…

npx botverse convert report.md --to pdf
npx botverse convert *.md --to docx,pdf -o ./out
npx botverse transcode clip.mov --to mp4 -o ./out
npx botverse transcribe call.mp4 --to docx --attendees "Sarah Chen,Mike Torres"
npx botverse balance
```

Each job uploads → polls → downloads the finished file to `-o` (default: current dir).
Globs and multiple `--to` formats run as a batch.

> **Sandbox note:** the CLI needs outbound network to `botverse.cloud` and S3, so it does
> **not** run inside sandboxed agent environments (claude.ai / Claude Desktop), whose
> egress is allowlisted. There, use the MCP tools (`convert_content` / `get_output_content`).

## Tools (MCP)

| Tool | Description |
|---|---|
| `transcode_from_url` | Transcode video from a public URL |
| `transcode_video` | Transcode an uploaded video file |
| `convert_content` | Convert document content inline (up to 4 MB; sandbox-safe) |
| `convert_from_url` | Convert a document from a public URL |
| `convert_file` | Convert an uploaded document |
| `get_job_status` | Poll a job until complete |
| `get_download_url` | Get the signed download URL |
| `get_output_content` | Get finished output bytes inline (sandbox-safe download) |
| `get_wallet_balance` | Check wallet balance |

## Pricing

- Video transcode (≤5 min): **$0.25/job**
- Video overage: **+$0.08/min**
- ProRes 422: **$0.50/job**
- Document conversion: **$0.05/file**

Credits never expire. [Full pricing →](https://botverse.cloud/pricing)

## Links

- [Documentation](https://botverse.cloud/docs)
- [Dashboard](https://botverse.cloud/dashboard)
- [Support](mailto:support@botverse.cloud)
