# botverse-mcp

MCP server **and command-line tool** for [Botverse](https://botverse.cloud): media and document jobs for AI agents and the people who set them up.

**Free to try — $1 credit, no card.** Transcode, conform and splice video, assemble image frames into video, convert documents, transcribe audio with AI speaker-naming, and chain any of these into a workflow. One key, prepaid wallet, no AWS.

[![npm](https://img.shields.io/npm/v/botverse-mcp)](https://www.npmjs.com/package/botverse-mcp)

## What it does

- **Video transcoding** — MP4 (H.264), WebM (VP9), ProRes 422, GIF, MP3 extraction, with optional trim, resize, bitrate and frame rate · $0.25/job
- **Video/audio conform** — mux a separate video and audio source into one output and reconcile frame-rate and duration mismatches, including pulldown-style speed conforms (e.g. 24→25fps) · $0.30/job
- **Splice** — join video and still-image segments into one output: head slates and bumpers, tail slates and end cards, mid-roll inserts, or clips back to back · from $0.30/job
- **Frames to video** — assemble an ordered sequence of PNG/JPG frames into MP4, WebM or GIF · $0.15/job
- **Document conversion** — Markdown, HTML, reStructuredText, TXT, Word (DOC/DOCX), Excel (XLSX) and PowerPoint (PPT/PPTX) to DOCX, PDF, HTML, TXT, MD, RST or XLSX. Office files render to PDF with full page layout, Excel PDFs honor the workbook's print areas, and PowerPoint converts to PDF only · $0.05/file
- **Transcription** — speaker-labelled transcripts with diarization and AI speaker-naming from your attendee list, as TXT, JSON, SRT, VTT, DOCX or PDF · $0.05/audio-min (~$3/hour)
- **Workflows** — chain transcode, conform, splice, convert and transcribe steps into one server-side job, with dependency ordering and parallel branches

Inputs can be a public HTTPS URL or a share link from Dropbox, Google Drive, OneDrive (personal or business), SharePoint or Box. Share links resolve to the file automatically.

Two ways to use it: an **MCP server** for your AI agents, and a **`botverse` CLI** for the shell (evaluation, CI/CD, cron, scripts and local coding agents). No FFmpeg and no infrastructure to run.

## Setup

1. Sign up at [botverse.cloud](https://botverse.cloud). **Free to try: $1 credit on signup, no card required.** A card and 2FA are needed only at your first top-up ($5 minimum). No monthly fees.
2. Get an API key or connector URL from your [dashboard](https://botverse.cloud/dashboard/api-keys).
3. Add Botverse to your MCP client.

## Usage

### Claude Desktop / Cursor / Windsurf / VS Code (stdio)

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

Or with a connector URL:

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

### Remote MCP (no install)

Clients that support remote MCP servers (claude.ai, ChatGPT Developer Mode, Codex and others) can connect straight to the hosted endpoint:

- **URL:** `https://botverse.cloud/mcp` (Streamable HTTP)
- **Auth:** OAuth sign-in, a `bv_live_...` API key as a Bearer token, or a connector URL (`https://botverse.cloud/mcp?token=bv_sess_...`)

Step-by-step instructions per client: [botverse.cloud/docs/connect](https://botverse.cloud/docs/connect).

## Command line (`botverse`)

The same package ships a `botverse` CLI. It reads files from disk and streams them
straight to the API (no content goes through an LLM), so it's the fast path for
evaluation, automation and local coding agents.

```bash
export BOTVERSE_API_KEY=bv_live_…        # or BOTVERSE_CONNECTOR_URL=…?token=bv_sess_…

npx -p botverse-mcp botverse convert report.md --to pdf
npx -p botverse-mcp botverse convert *.md --to docx,pdf -o ./out
npx -p botverse-mcp botverse transcode clip.mov --to mp4 -o ./out
npx -p botverse-mcp botverse transcribe call.mp4 --to docx --attendees "Sarah Chen,Mike Torres"
npx -p botverse-mcp botverse conform video.mp4 audio.wav --to mp4 --method speed_conform --target-framerate 25
npx -p botverse-mcp botverse balance
```

The package name is `botverse-mcp`, so `npx` needs `-p botverse-mcp`. After `npm i -g botverse-mcp`
the command is plain `botverse`. Each job uploads, polls, then downloads the finished file to `-o`
(default: current dir).
Globs and multiple `--to` formats run as a batch. Splice, frames-to-video and workflows
are available through the MCP tools.

> **Sandbox note:** the CLI needs outbound network to `botverse.cloud` and Botverse's file storage host, so it does
> **not** run inside sandboxed agent environments (claude.ai / Claude Desktop), whose
> egress is allowlisted. There, use the MCP tools (e.g. `convert_content`, `transcode_content`, `get_output_content`) instead.

## Tools (MCP)

21 tools. `tools.json` in this package mirrors the hosted server's `tools/list`.

| Tool | Description |
|---|---|
| `transcode_from_url` | Transcode video/audio from a public URL or share link |
| `transcode_video` | Transcode an uploaded video/audio file |
| `transcode_content` | Transcode a short clip passed inline as base64 (request under 4 MB; sandbox-safe) |
| `assemble_sequence` | Assemble ordered image frame URLs (PNG/JPG) into MP4, WebM or GIF |
| `conform_from_url` | Mux a separate video + audio source (public URLs) into one output |
| `conform_media` | Mux an uploaded video + audio source into one output |
| `conform_splice_from_url` | Join video/image segments (public URLs): slates, bumpers, end cards, inserts, joined clips |
| `conform_splice_media` | Join uploaded video/image segments, same use cases |
| `convert_content` | Convert document content passed inline (up to 4 MB; sandbox-safe) |
| `convert_from_url` | Convert a document from a public URL or share link |
| `convert_file` | Convert an uploaded document |
| `transcribe_from_url` | Transcribe audio/video from a public URL or share link, with speaker naming |
| `transcribe_media` | Transcribe an uploaded audio/video file |
| `submit_workflow` | Submit a multi-step BWDL workflow with dependency ordering and parallel branches |
| `get_workflow_status` | Poll a workflow and its per-step status until it reaches a terminal state |
| `cancel_workflow` | Cancel an in-progress workflow; only completed steps are billed |
| `get_upload_url` | Get a presigned upload form for the `_media` / `_file` / `_video` tools |
| `get_job_status` | Poll a job until complete |
| `get_download_url` | Get a time-limited download URL for a finished job |
| `get_output_content` | Return a finished job's output inline as base64 (up to 4 MB; sandbox-safe) |
| `get_wallet_balance` | Check wallet balance, funds held by running jobs, and auto-refill settings |

## Workflows

`submit_workflow` chains several Botverse tools (transcode, conform, splice, convert, transcribe) into
one server-side job (e.g. transcribe → clip extraction → delivery), so your agent doesn't make and
poll each call itself.

- Workflow definitions use **BWDL** (Botverse Workflow Definition Language): a JSON object with a
  `workflow_id` and a `steps` array. Each step has an `id`, a `tool` (any MCP tool name), an `inputs`
  object, and an optional `depends_on` array of prior step ids.
- Steps run in dependency order; steps that share the same `depends_on` run in parallel.
- A later step can reference an earlier step's output with `"$.steps.<step_id>.output_key"`, and a
  workflow-level parameter with `"$.params.<name>"`. No other template syntax is supported.
- Submit with `submit_workflow`, poll with `get_workflow_status` every 5–10 seconds until the status is
  `COMPLETED`, `FAILED`, `PARTIALLY_FAILED` or `CANCELLED`, and stop early with `cancel_workflow` if
  needed (you're billed only for steps that already completed).
- Billing: convert-only workflows run on wallet balance at $0.05/step. Workflows with a transcode
  or transcribe step require auto-refill (their cost scales with source duration).
- Schema: [botverse.cloud/schemas/workflow/v1.json](https://botverse.cloud/schemas/workflow/v1.json)

Example: a two-step conversion chain (URL → DOCX → PDF):

```json
{
  "workflow_id": "md-to-pdf-via-docx",
  "steps": [
    {
      "id": "to_docx",
      "tool": "convert_from_url",
      "inputs": {
        "source_url": "https://example.com/report.md",
        "output_format": "docx"
      }
    },
    {
      "id": "to_pdf",
      "tool": "convert_from_url",
      "depends_on": ["to_docx"],
      "inputs": {
        "source_url": "$.steps.to_docx.output_key",
        "output_format": "pdf"
      }
    }
  ]
}
```

## Pricing

| Service | Price |
|---|---|
| Video transcode (source up to 5 min) | $0.25/job |
| Video overage (transcode, conform, splice, frames-to-video) | +$0.08/min past 5 min |
| ProRes 422 output | $0.35/source-min ($0.50 minimum) |
| Video/audio conform | $0.30/job |
| Splice (up to 2 segments) | $0.30/job, +$0.05 per extra segment (max 8) |
| Frames to video | $0.15/job |
| Document conversion | $0.05/file |
| Transcription (diarization + AI speaker-naming included) | $0.05/audio-min (~$3/hour), $0.20 minimum |
| Transcript as formatted DOCX / PDF | +$0.10 / +$0.15 |

Start free with a $1 credit, no card (the trial credit expires 30 days after signup). Top up from $5
when you're ready. Paid balance never expires and there's no subscription. [Full pricing →](https://botverse.cloud/pricing)

## Links

- [Documentation](https://botverse.cloud/docs)
- [Connect a client](https://botverse.cloud/docs/connect)
- [Dashboard](https://botverse.cloud/dashboard)
- [Support](mailto:support@botverse.cloud)
