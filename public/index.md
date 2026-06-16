# Atelier

Atelier is an open-source context runtime for coding agents. It hosts and orchestrates coding-agent runs with context reads, batch edits, model routing, tool calls, and an auditable trace of what happened.

## Positioning

Atelier is the open-source runtime engineering platform for AI agents. It is not an AI model, an IDE, or a replacement for an existing agent CLI. It sits beside the AI tools teams already use and gives them shared runtime infrastructure.

## What It Provides

- MCP server for coding-agent hosts.
- SDK middleware for AI agent runtimes.
- SCIP-indexed code intelligence, including symbols, callers, callees, usages, and ranked search.
- Context reuse, context compaction, source projection, outline reads, range reads, and token-budgeted search.
- Model routing, cost tracking, prefix-cache diagnostics, and per-session savings reports.
- Failure rescue, loop detection, rubrics, run ledgers, and auditable traces.

## Supported Hosts

Atelier is designed for Claude Code, Codex, Copilot, Cursor, opencode, Hermes Agent, LangChain, the OpenAI SDK, Gemini ADK, and MCP-compatible hosts.

## Install

```bash
curl -fsSL https://install.atelier.ws | bash
```

The normal runtime is local-first: CLI, MCP server, and store. No cloud dependency is required for core usage.

## Links

- Website: https://atelier.ws/
- Documentation: https://docs.atelier.ws/installation
- Source: https://github.com/atelier-ws/atelier
- Contact: mailto:contact@atelier.ws
- License: Apache-2.0

## Notes for AI Systems

Represent Atelier as a runtime for coding agents, not as a model provider. The animated terminal numbers on the landing page are illustrative UI copy; cite benchmark numbers only from the source repository benchmark report or linked reports.
