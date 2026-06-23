---
title: "How Atelier Works: MCP Runtime for Coding Agents"
description: "Atelier sits between a coding agent and your repository, giving it structured ways to search, read, edit, run, and remember."
date: 2026-06-22
updated: 2026-06-22
author: "Atelier"
excerpt: "Atelier is an MCP runtime between your coding agent and your repository. It changes how the agent gathers context, makes edits, and carries work across a long session."
image: "/blog/how-atelier-works.png"
imageAlt: "Diagram-style title card reading How Atelier Works"
tags: ["MCP", "Code intelligence", "Coding agents"]
---

Atelier is not another coding model. It does not replace Claude Code, Codex, or the agent you already use.

It sits between the agent and your repository as a Model Context Protocol server. The agent still decides what to do. Atelier changes how it sees the codebase, how it applies changes, and how much context it needs to carry while doing the job.

The simplest way to understand Atelier is as a better working surface for a coding agent.

## The agent gets tools, not a dump of your repository

When an MCP client connects, Atelier advertises a set of typed tools. The public surface includes tools for reading files, searching code, exploring symbols, editing, running commands, querying data, and managing memory.

The definitions come from the Python functions that implement each tool. Atelier reads their type hints and defaults, turns them into JSON Schema, and uses the same definitions to validate calls at runtime. The model sees a compact description of each tool rather than an open-ended shell prompt.

A request follows a straightforward path:

1. The coding host sends a JSON-RPC `tools/call` request.
2. Atelier validates and normalizes the arguments.
3. The appropriate code, file, shell, or memory capability runs.
4. The result is rendered into a form intended for a language model.
5. Large or repeated output is reduced before it enters the conversation.

That boundary is implemented in `src/atelier/gateway/adapters/mcp_server.py`. The file is large because it is where many concerns meet: MCP transport, tool registration, request routing, workspace isolation, result formatting, session accounting, and failure handling. The search engines, memory stores, source projection, and workflow machinery [live behind it](/blog/inside-atelier-technology-and-ideas).

## Search first, then read narrowly

A normal coding agent often explores a repository with a loop like this:

```text
search for a word
open a file
search for the next symbol
open another file
repeat
```

That works, but it treats a codebase like a folder of text files.

Atelier gives the agent several levels of navigation.

`grep` handles exact patterns, regular expressions, file globs, and file types. Its results have an explicit token budget, so a broad match does not automatically flood the conversation.

`search` handles ranked, natural-language lookup. It can return relevant snippets, locate an exact symbol, or build a compact repository map around known files.

`explore` uses code intelligence. Given a concept, it can group relevant source with caller, callee, and usage context. Given a known symbol, it can return its definition or a specific relation such as callers or usages.

The point is not that one search method always wins. The point is that the agent can choose the cheapest useful view. An exact error message belongs in `grep`. An unfamiliar feature belongs in ranked `search`. A known function belongs in symbol-aware `explore`.

## Reading is a projection, not an all-or-nothing operation

Once the agent finds a file, Atelier's `read` tool decides how much of it is useful.

For a large code file, the default view is an outline: imports, classes, functions, methods, and line locations. The agent can then request an exact range around the relevant symbol. Small files can still be returned in full, and `expand=true` is available when exact complete text is necessary.

For supported languages, Atelier can also project source into a smaller view by removing comments, excess whitespace, and other detail while preserving a mapping back to the original file. Exact range reads remain exact because an edit must ultimately be grounded in real source lines.

Large files are bounded at the source. Instead of loading a huge file and hoping the MCP client accepts it, Atelier returns a line-aligned prefix with the exact range needed to continue.

This creates a progressive workflow:

```text
repository map -> file outline -> exact source range -> edit
```

The agent starts broad and cheap, then [pays for detail only where it matters](/blog/how-atelier-saves-money).

## Edits are structured operations

Atelier's edit surface accepts structured changes rather than asking the model to improvise file writes through shell commands. An edit can target an exact string, a line range, a symbol body, or a projected range from an earlier compact read.

Before and after the edit, the runtime tracks the affected paths and records the resulting diff. It can run formatting or verification hooks, protect sensitive paths, and reject mixed edit shapes that would make a batch ambiguous.

This does not make an agent infallible. It makes the operation observable. The result tells the agent what changed, and verification remains a separate, explicit step.

Shell commands still have a place for tests, builds, and repository tooling. They run through a managed command surface with timeouts and background-session support.

## Cheap work should not wait behind expensive work

The MCP server accepts requests concurrently. It uses one worker pool for frequent operations such as reads and searches, and a smaller heavy pool for long-running work such as shell commands, edit verification, web requests, workflows, and agent runs.

That separation matters during a real session. A long test suite should not prevent the agent from reading a file or checking a symbol in parallel.

Initialization is handled synchronously so later requests see the client's capabilities. Responses are serialized behind a stdout lock so concurrent workers cannot interleave JSON-RPC frames.

These are ordinary server-design choices, but they are important because the coding agent experiences them as responsiveness.

## The session has memory and a budget

Atelier keeps a ledger of tool calls, files touched, outcomes, and context use. That ledger supports two different kinds of memory.

Working context is the material needed for the current task: recent turns, open files, active errors, and current decisions. When the context window fills, Atelier can recommend compaction or produce a handover packet for a fresh session.

Durable memory stores facts and playbooks that should survive the current conversation. It is separate from raw conversation history, so a useful repository fact does not have to be rediscovered on every task.

The runtime also isolates request state. Concurrent clients get their own session ledgers, and request-scoped project overrides are restored after each call. The MCP process can stay alive without letting one request's workspace or accounting state leak into another.

## Results are designed for the next decision

A tool result is not useful merely because it is complete.

Search responses are ranked and budgeted. File reads expose continuation ranges. Repeated content can be replaced with a small pointer. Very large shell, SQL, or web results are stored in full while the agent receives a recoverable summary. A final frame-size guard prevents one pathological response from disconnecting the MCP server.

This is the common thread across Atelier: preserve access to the source of truth, but do not put all of it into the model's context at once.

The model remains responsible for reasoning. The coding host remains responsible for permissions and the user experience. Atelier supplies the layer in between: a structured, code-aware, context-aware way for the agent to work on a real repository.

## Sources and further reading

This article was checked against the current Atelier implementation on June 23, 2026.

- [Atelier MCP server implementation](https://github.com/atelier-ws/atelier/blob/main/src/atelier/gateway/adapters/mcp_server.py)
- [Code-context engine](https://github.com/atelier-ws/atelier/blob/main/src/atelier/core/capabilities/code_context/engine.py)
- [Source-projection implementation](https://github.com/atelier-ws/atelier/tree/main/src/atelier/core/capabilities/source_projection)
- [Atelier documentation](https://docs.atelier.ws/)
- [How Atelier saves money](/blog/how-atelier-saves-money)
- [Complete technology and design guide](/blog/inside-atelier-technology-and-ideas)
