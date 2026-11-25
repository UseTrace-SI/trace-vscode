# Trace — AI Code Provenance for VS Code

See which AI agent wrote each line of code, browse session history, and surface review findings — all inside VS Code.

## Features

**Inline provenance decorations** — each line shows the agent that wrote it and when, with color-coded backgrounds per agent (Claude, Copilot, Codex, Cursor).

**"Trace: Why?"** — place your cursor on any line and run the command to see which agent session and prompt produced it.

**Session history** — browse recent coding sessions and their turns in a quick-pick list.

**Review findings as diagnostics** — load findings from `trace review` directly into the Problems panel with correct severity mapping.

## Requirements

- The [Trace CLI](https://github.com/UseTrace-SI/trace-cli) must be installed and on your PATH (or configure `trace.cliPath`).
- A `.trace` directory in your workspace root (created by `trace init`).

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `trace.cliPath` | `trace` | Path to the trace CLI binary |
| `trace.autoDecorate` | `true` | Show provenance decorations automatically |
| `trace.decorationStyle` | `inline` | Display style: `inline`, `gutter`, or `both` |

## Commands

- **Trace: Why was this line written?** — look up provenance for the current line
- **Trace: Show Session History** — browse and inspect recent sessions
- **Trace: Show Review Findings** — load review findings into the Problems panel

## How it works

Trace records AI coding sessions locally. This extension reads that data via the CLI to annotate your editor with provenance information — which agent wrote which lines, when, and in response to what prompt.

All data stays local. The extension calls `trace` subcommands and parses their JSON output; no network requests are made by the extension itself.

## License

Apache-2.0
