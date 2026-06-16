# botverse-mcp

MCP server for [Botverse](https://botverse.cloud) — video transcoding and document conversion for AI agents.

[![npm](https://img.shields.io/npm/v/botverse-mcp)](https://www.npmjs.com/package/botverse-mcp)

## What it does

- **Video transcoding** — MP4 (H.264), WebM (VP9), ProRes 422, GIF, MP3 extraction · $0.25/job
- **Document conversion** — Markdown ↔ DOCX ↔ PDF ↔ HTML ↔ XLSX · $0.05/file

Three tool calls. No AWS. No FFmpeg. No infrastructure.

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

## Tools

| Tool | Description |
|---|---|
| `transcode_from_url` | Transcode video from a public URL |
| `transcode_video` | Transcode an uploaded video file |
| `convert_content` | Convert document content inline |
| `convert_from_url` | Convert a document from a public URL |
| `get_job_status` | Poll a job until complete |
| `get_download_url` | Get the signed download URL |
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
