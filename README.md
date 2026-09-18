# botverse-mcp

MCP server **and command-line tool** for [Botverse](https://botverse.cloud) — video transcoding and document conversion for AI agents and the humans who configure them.

[![npm](https://img.shields.io/npm/v/botverse-mcp)](https://www.npmjs.com/package/botverse-mcp)

## What it does

- **Video transcoding** — MP4 (H.264), WebM (VP9), ProRes 422, GIF, MP3 extraction · $0.25/job
- **Video/audio conform** — mux a separate video and audio source into one output, reconciling frame-rate and duration mismatches (including true pulldown-style speed conforms, e.g. 24→25fps) · $0.30/job
- **Conform splice** — concatenate video and/or still-image segments into one output: head slates/bumpers, tail slates/end cards, mid-roll inserts/cutaways, or joining clips together · from $0.30/job
- **Document conversion** — Markdown ↔ DOCX ↔ PDF ↔ HTML ↔ XLSX · $0.05/file
- **Transcription** — speaker-labelled transcripts (diarization + AI speaker naming) → txt/srt/vtt/docx/pdf · ~$3/hour
- **Workflows** — chain multiple Botverse operations (transcode, convert, transcribe, conform, splice) into a single multi-step job with automatic dependency ordering and parallel branches, instead of orchestrating each call yourself · convert-only steps run on wallet balance ($0.05/step); transcode/transcribe steps bill by source duration and require auto-refill

Two ways to use it: an **MCP server** for your AI agents, and a **`botverse` CLI** for the shell — evaluation, CI/CD, cron, scripts, and local coding agents. No AWS. No FFmpeg. No infrastructure.

## Setup

1. Sign up at [botverse.cloud](https://botverse.cloud) — **free to try: $1 credit on signup, no card required.** A card + 2FA are only needed at your first top-up ($5 min). No monthly fees.
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
npx botverse conform video.mp4 audio.wav --to mp4 --method speed_conform --target-framerate 25
npx botverse balance
```

Each job uploads → polls → downloads the finished file to `-o` (default: current dir).
Globs and multiple `--to` formats run as a batch.

> **Sandbox note:** the CLI needs outbound network to `botverse.cloud` and S3, so it does
> **not** run inside sandboxed agent environments (claude.ai / Claude Desktop), whose
> egress is allowlisted. There, use the MCP tools (e.g. `convert_content`) instead.

## Tools (MCP)

| Tool | Description |
|---|---|
| `get_upload_url` | Get a presigned URL to upload a file for use with the `_media`/`_file`/`_video` (object-key-based) tools |
| `transcode_from_url` | Transcode video from a public URL |
| `transcode_video` | Transcode an uploaded video file |
| `conform_from_url` | Mux a separate video + audio source (public URLs) into one output |
| `conform_media` | Mux an uploaded video + audio source into one output |
| `conform_splice_from_url` | Concatenate video/image segments (public URLs) — slates, bumpers, end cards, inserts, joined clips |
| `conform_splice_media` | Concatenate uploaded video/image segments — same use cases |
| `convert_content` | Convert document content inline (up to 4 MB; sandbox-safe) |
| `convert_from_url` | Convert a document from a public URL |
| `convert_file` | Convert an uploaded document |
| `submit_workflow` | Submit a multi-step BWDL workflow chaining several of the above tools together, with dependency ordering and parallel branches |
| `get_workflow_status` | Poll a workflow (and its per-step status) until it reaches a terminal state |
| `cancel_workflow` | Cancel an in-progress workflow; already-completed steps are billed, the rest are not |
| `get_job_status` | Poll a job until complete |
| `get_download_url` | Get the signed download URL |
| `get_wallet_balance` | Check wallet balance |

## Workflows

`submit_workflow` chains multiple Botverse tools (transcode, convert, transcribe, conform, splice) into
one server-side job — e.g. transcribe → clip extraction → delivery — instead of your agent making each
call and polling each one individually.

- Workflow definitions use **BWDL** (Botverse Workflow Definition Language): a JSON object with a
  `workflow_id` and a `steps` array. Each step has an `id`, a `tool` (any MCP tool name), an `inputs`
  object, and an optional `depends_on` array of prior step ids.
- Steps run in dependency order; steps that share the same `depends_on` run in parallel.
- A later step can reference an earlier step's output with `"$.steps.<step_id>.output_key"`, and a
  workflow-level parameter with `"$.params.<name>"` — no other template syntax is supported.
- Submit with `submit_workflow`, poll with `get_workflow_status` every 5–10 seconds until the status is
  `COMPLETED`, `FAILED`, `PARTIALLY_FAILED`, or `CANCELLED`, and stop early with `cancel_workflow` if
  needed (you're only billed for steps that already completed).
- Billing: convert-only workflows run on wallet balance at $0.05/step. Workflows containing a transcode
  or transcribe step require auto-refill to be enabled (billing scales with source duration).

Example — a two-step conversion chain (URL → DOCX → PDF):

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
      "tool": "convert_file",
      "depends_on": ["to_docx"],
      "inputs": {
        "object_key": "$.steps.to_docx.output_key",
        "output_format": "pdf"
      }
    }
  ]
}
```

## Pricing

- Video transcode (≤5 min): **$0.25/job**
- Video overage: **+$0.08/min**
- ProRes 422: **$0.35/source-min** ($0.50 min)
- Document conversion: **$0.05/file**

Credits never expire. [Full pricing →](https://botverse.cloud/pricing)

## Links

- [Documentation](https://botverse.cloud/docs)
- [Dashboard](https://botverse.cloud/dashboard)
- [Support](mailto:support@botverse.cloud)
