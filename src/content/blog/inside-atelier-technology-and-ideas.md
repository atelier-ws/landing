---
title: "Inside Atelier: technology and design ideas"
description: "A technical field guide to Atelier's MCP tools, code intelligence, context, memory, workflows, routing, safety, storage, and telemetry."
date: 2026-06-20
updated: 2026-06-20
author: "Atelier"
excerpt: "An inventory of Atelier's public tools, internal capabilities, technology stack, and the engineering ideas that connect them."
image: "/blog/inside-atelier-technology-and-ideas.png"
imageAlt: "Diagram-style title card reading Technology and Design Ideas"
tags: ["Architecture", "Technology", "MCP"]
---

Atelier is easy to describe badly.

Calling it "code intelligence" misses the editing, memory, verification, routing, and workflow systems. Calling it an "MCP server" describes the transport but not what the runtime does. Calling it an "agent framework" suggests that it replaces the coding agent, which it does not.

A more accurate description is this:

> Atelier is a host-neutral runtime that gives coding agents a structured, code-aware, cost-aware, and verifiable way to work on repositories.

This article is a technical inventory of that runtime. It covers [the public product surface](/blog/how-atelier-works), the hidden administrative tools, the internal capability packages, and the technologies used to build them.

Not every item below is enabled, installed, licensed, or shown to the language model by default. Atelier deliberately keeps its default tool menu small. Optional backends, internal analytics, Pro features, and experimental capabilities are identified as such.

This inventory was checked against Atelier 0.4.25 on June 23, 2026.

## Contents

- [The system in one diagram](#the-system-in-one-diagram)
- [The foundation](#the-foundation)
- [Public MCP tools](#the-public-mcp-tool-surface)
- [Hidden and administrative tools](#hidden-and-administrative-mcp-tools)
- [Code intelligence](#code-intelligence-how-atelier-understands-a-repository)
- [Progressive source reading](#progressive-source-reading)
- [Editing and code transformation](#editing-and-code-transformation)
- [Shell, SQL, and web execution](#shell-sql-and-web-execution)
- [Context engineering](#context-engineering)
- [Memory systems](#memory-is-five-different-systems)
- [Agents, roles, and workflows](#agents-roles-and-workflows)
- [Verification, safety, and governance](#verification-safety-and-governance)
- [Cost accounting and optimization](#cost-accounting-and-optimization)
- [Storage and process architecture](#storage-and-process-architecture)
- [Host integration](#host-integration)
- [Internal capability inventory](#the-long-tail-of-internal-capabilities)
- [Design principles](#the-ideas-that-connect-everything)

## The system in one diagram

```text
Claude Code / Codex / OpenCode / another host
                       |
                MCP JSON-RPC
                       |
             Atelier gateway layer
     schema validation, routing, isolation
                       |
   +-------------------+-------------------+
   |                   |                   |
code context       tool execution       memory/context
search/index       edit/bash/sql         facts/passages
symbols/graphs     verify/web fetch      reuse/compaction
   |                   |                   |
   +-------------------+-------------------+
                       |
       ledgers, savings, telemetry, policy
```

The coding model still plans and reasons. The host still owns the conversation, permissions, and user interface. Atelier owns the working surface between the model and the repository.

## The foundation

The core runtime is Python 3.12+ and is packaged with Hatch. Production wheels can compile the `src/atelier` package with mypyc, while development uses ordinary Python.

The main technology choices are:

| Area | Technology |
|---|---|
| Language and packaging | Python 3.12/3.13, Hatch, uv workspaces, optional PyInstaller |
| Protocol | Model Context Protocol, JSON-RPC 2.0, stdio transport, HTTP/SSE transport |
| Schemas and validation | Pydantic 2, Python type hints, runtime-generated JSON Schema |
| CLI | Click, Rich, prompt-toolkit |
| HTTP service | FastAPI and Uvicorn |
| Local persistence | SQLite, JSON/JSONL sidecars, filesystem artifacts |
| Optional persistence | PostgreSQL, pgvector |
| Parsing | Python AST, Tree-sitter, tree-sitter-language-pack |
| Code intelligence | SCIP, Zoekt, ast-grep, LSP adapters, Git history |
| Text and ranking | SQLite FTS, BM25, fuzzy matching with RapidFuzz, cosine/ANN retrieval |
| Token accounting | tiktoken plus model pricing tables |
| Editing | exact replacements, structured descriptors, diff-match-patch, AST rewrites |
| Git access | GitPython and pygit2 |
| Web extraction | urllib3, Beautiful Soup, trafilatura, markdownify |
| Resilience | Tenacity retries, circuit breakers, bounded worker pools |
| Security | cryptography, redaction policies, path guards, SSRF protection |
| Observability | OpenTelemetry, OTLP, Prometheus, optional Langfuse |
| Testing and quality | pytest, pytest-xdist, Ruff, Black, mypy, vulture |

There are optional integrations for Ollama, OpenAI embeddings, Letta, OpenMemory, LiteLLM, Langfuse, OR-Tools, Rope, PostgreSQL, and pgvector. The default local path does not require all of them.

## The public MCP tool surface

Atelier registers more capabilities than it advertises. The default language-model surface contains ten tools.

| Tool | What it does |
|---|---|
| `read` | Reads one or many files as an outline, exact range, projected body, or full file |
| `search` | Ranked code and documentation search, exact symbol lookup, and repository maps |
| `grep` | Regex, glob, file-type, and multiline search with bounded rendering |
| `explore` | Concept exploration or exact definition/caller/callee/usage lookup |
| `codemod` | AST-shaped search and rewrite through ast-grep, dry-run by default |
| `edit` | Deterministic file, line, notebook-cell, symbol, and projection-aware edits |
| `bash` | Managed command execution with timeouts, background sessions, polling, and cancellation |
| `sql` | Schema inspection, SQL linting, and bounded queries; writes require an explicit opt-in |
| `memory` | Fact storage, voting, archival recall, and symbol recall |
| `web_fetch` | Public URL retrieval with SSRF protection, caching, extraction, and Markdown conversion |

The public list is intentionally short. A smaller menu costs fewer schema tokens and gives the model fewer overlapping choices.

Tool definitions come from typed Python functions. Atelier inspects each function signature, generates a Pydantic argument model, derives JSON Schema, removes schema noise, and registers the validated wrapper. The same contract drives `tools/list` and `tools/call`.

The boundary also repairs common client mistakes: a whole argument object sent as a JSON string, integers and booleans serialized as strings, a single glob sent where an array was declared, or an old parameter name retained by a client. Repair is conservative and validation still happens before the handler runs.

## Hidden and administrative MCP tools

The following tools are registered and callable by internal code, tests, the CLI, or power users, but are not advertised to the model by default.

| Tool | Purpose |
|---|---|
| `context` | Retrieves playbooks, bootstrap context, symbols, or a token-bounded subtask context pack |
| `compact` | Compresses a run ledger, consolidates history, or retrieves spilled tool output |
| `rescue` | Suggests a different procedure after repeated failure |
| `trace` | Records structured task, command, tool, edit, test, and workflow events |
| `verify` | Runs a rubric or verification gate and returns structured evidence |
| `agent` | Runs an Atelier-owned sub-agent with provider, model, budget, and cache-affinity control |
| `workflow` | Runs, inspects, pauses, resumes, or stops durable workflows |
| `graph` | Blast radius, dead code, cycles, coupling, centrality, doc drift, PR risk, and history analytics |
| `scan` | Bounded ast-grep security rules plus intra-procedural Python taint analysis |
| `orient` | Returns the deterministic explore -> navigate -> edit -> verify playbook |
| `index` | Builds or refreshes the repository code index |
| `blame` | Returns Git blame and churn information for files or symbols |
| `cache` | Reports or invalidates code-intelligence caches |
| `statusline_segment` | Refreshes the active session's precomputed savings display |

A user can hide additional public tools with configuration. This is not only cosmetic: every removed schema reduces fixed prompt material and model tool-choice deliberation.

## Code intelligence: how Atelier understands a repository

Atelier does not depend on one universal parser or one universal search algorithm. It combines several sources of evidence and falls back when a richer source is unavailable.

### Language registry

The canonical language table recognizes:

- Python and Python stubs
- TypeScript and TSX
- JavaScript, JSX, MJS, and CJS
- Bash, shell, and Zsh files
- C and C++
- C#
- Go
- Rust
- Java
- Kotlin
- Scala
- Ruby
- Swift
- PHP
- SQL
- Markdown
- YAML
- TOML
- JSON
- HTML
- CSS
- Lua

The registry also records available SCIP indexers. Examples include `scip-python`, `scip-typescript`, `scip-go`, `scip-java`, `scip-ruby`, `scip-clang`, and Rust Analyzer.

### Parsing and symbol extraction

Atelier uses several parsing paths:

- Python's built-in AST for Python definitions, imports, calls, routes, and references.
- Tree-sitter and the language pack for multi-language parsing and source projection.
- SCIP artifacts for exact symbols, definitions, usages, and call edges.
- Language-specific tags as a fallback symbol index.
- LSP resolvers where language-server information is available.
- Cross-language reference adapters for boundaries that one language index cannot resolve alone.
- Markdown heading trees for opt-in design-document indexing.

SCIP artifacts can be generated by Atelier, discovered from external tools, read from cache, and watched for changes. The index has lineage metadata so cached data can be tied to the repository and embedder state that produced it.

### Text search

The search stack includes:

- exact symbol matching,
- identifier and camel-case matching,
- SQLite full-text search,
- substring search,
- fuzzy matching,
- native regex search,
- managed Zoekt search for large repositories,
- semantic symbol retrieval when an embedding backend is explicitly configured,
- Git-history search over commit chunks,
- deleted-code and historical adapters.

Code semantic search is off by default unless a code embedder is configured. Available backends are local embeddings, OpenAI, Letta, Ollama, or a null backend. Ollama availability is checked at call time and falls back locally when unavailable.

### Ranking and packing

Finding candidates is only half the problem. Atelier also has to decide which candidates deserve context.

Ranking signals include exactness, lexical score, fuzzy score, semantic similarity, file scope, symbol popularity, call-graph relationships, churn, imports, query intent, and whether the query appears to target tests.

Results are deduplicated, grouped, and fitted to a caller-specified token budget. Oversized candidates can be shortened to signatures, skeletons, or head snippets. Overflow can be written to an artifact rather than silently disappearing.

Search also carries an explicit verdict. A result can be found, missed, absent, or degraded because a search channel is unavailable. Reformulation history distinguishes "the first query missed" from "we have enough evidence that this symbol is absent." A soft breaker discourages repeated unproductive searches.

### Graph analysis

The code graph supports:

- definition, usage, caller, and callee navigation,
- transitive caller/callee expansion,
- reverse-dependency blast radius,
- affected-test discovery,
- dead-code candidates,
- import-cycle detection,
- afferent and efferent coupling,
- Martin instability,
- degree and eigenvector centrality,
- route and handler extraction,
- optional synthesized runtime-style edges,
- PageRank repository maps,
- doc-to-code drift,
- PR risk from blast radius, complexity, churn, and test gaps,
- heuristic commit provenance,
- symbol and file blame.

Heuristic results are labeled as heuristics rather than presented as compiler truth.

## Progressive source reading

Atelier treats source text as a hierarchy of views.

### Outline

Large code files default to a structural outline rather than a complete body. The outline contains imports, classes, functions, methods, and line numbers.

### Range

An exact line range returns only the requested source. Redundant language and projection metadata is removed from ranged responses.

### Full

Small files can be returned in full. `expand=true` requests an exact full read, subject to transport safety limits.

### Compact and minified projections

For supported languages, a projected view can remove comments, repeated blank lines, and other low-value detail. Atelier reparses minified output to ensure the transform remains structurally valid.

A projection includes a mapping between projected coordinates and original coordinates. An edit can therefore refer to the smaller view while still applying to the real file. If the mapping is ambiguous, Atelier can recommend the exact source range to reread.

### Large-file continuation

Moderately large files return a line-aligned prefix plus the exact continuation range. Extremely large files are bounded before they are fully materialized in memory.

### Batch reads

Independent files can be read in one request. Savings and errors are tracked per file rather than letting one failed batch item invalidate the whole response.

### Missing-path correction

When a file path is wrong, Atelier searches for nearby basename matches and reports candidates. If no such file exists under the workspace, it says so explicitly to prevent the model from retrying the same dead path.

## Editing and code transformation

The `edit` tool accepts several distinct descriptor families:

- exact text replacement,
- file creation or replacement,
- line-scoped replacement,
- notebook-cell insert, move, replace, or delete,
- symbol-body replace, prepend, or append,
- projection-aware replacement mapped from a compact read.

A batch must use one compatible descriptor family. That keeps the operation deterministic and makes errors attributable to a specific edit shape.

The edit pipeline includes:

- workspace path confinement,
- protected-path checks,
- per-path locks and deterministic lock ordering,
- pre-edit snapshots,
- fuzzy matching where exact context has drifted,
- source-projection coordinate resolution,
- change collection and unified diffs,
- formatter or linter hooks,
- optional verify gates,
- rollback from snapshots when verification fails,
- compact success receipts,
- grounding evidence that records which source was read before a target was edited,
- test-weakening checks for removed assertions, added skips, and similar changes,
- contract-literal review for stringly typed configuration and wire contracts,
- automatic reindexing of files changed by structural rewrites.

The separate `codemod` tool uses ast-grep patterns. It matches syntax rather than text, supports metavariables such as `$X` and `$$$`, previews a unified diff by default, and only writes when `dry_run=false`.

## Shell, SQL, and web execution

### Shell supervision

The shell surface supports synchronous commands and managed background processes. Background calls return a session handle that can be polled or cancelled.

The wrapper:

- applies a timeout,
- preserves useful head and tail output,
- keeps process-group cancellation under control,
- blocks destructive commands such as `rm -rf`, `git reset --hard`, and `git clean -fd`,
- prevents nested interactive shells,
- redirects file reads and text searches toward the structured Atelier tools,
- renders compact progress, status, duration, and exit information.

Long-running shell, workflow, agent, edit-verification, and web calls use a separate worker pool so they cannot starve cheap reads and searches.

### SQL supervision

The SQL tool can discover connections, list tables, inspect schemas and relationships, search schema names, lint SQL, and run bounded queries. It automatically limits result size, enforces timeouts, and keeps writes disabled unless the caller explicitly opts in. Batches report avoided calls.

### Web retrieval

The web fetcher accepts public HTTP and HTTPS URLs, blocks local and private targets, applies response and time bounds, caches results briefly, prefers Markdown when available, and can turn HTML into clean Markdown using extraction and conversion libraries.

## Context engineering

Context engineering is the part of Atelier that decides what the model should see now, what can wait, and what must survive later.

### Bootstrap context

A cold repository can enqueue background work that builds initial repository knowledge. Later calls reuse the bootstrap blocks rather than recomputing them.

### Scoped context

Given a subtask, affected paths, keywords, exclusions, and a token budget, the scoped-context capability assembles the smallest useful context pack. It can combine code search, prior procedures, and known dead ends.

### Prompt budgeting

The prompt budget optimizer selects context blocks under a token budget. It can use OR-Tools CP-SAT when installed and has a greedy fallback.

### Prompt compilation

The prompt compiler classifies blocks by kind and stability, assembles cache-safe prompts, enforces budgets, and lints ordering. Stable, branch-level, session-level, and turn-level material can be arranged to protect provider prefix caches.

### Prefix-cache planning

Atelier tracks stable-prefix hashes, cache-read tokens, invalidation reasons, input splits, and cache hit ratios. It can recommend cache-stable ordering and keep owned sub-agent spawns in a shared cache scope.

### Result deduplication

Byte-identical `read`, `search`, `grep`, and `explore` results can be replaced with a small session pointer. File reads can return a delta for a previously seen resource. Compaction advances the deduplication epoch so old pointers do not survive into a context that no longer contains their targets.

### Reversible output spilling

Large shell, SQL, web, and extreme file results are written to a spill store. The model receives a bounded head-and-tail summary and a reference. It can retrieve the full output or a slice later.

The order matters: Atelier stores the original before any lossy compaction. If the spill fails, it does not pretend the missing detail is recoverable.

### Session compaction and handover

The run ledger tracks token use and events. The current policy:

- advises at 60 percent context use,
- considers compaction at 80 percent,
- prepares a handover at 95 percent.

Automatic compaction also considers turn count and structured task boundaries. A passing test or successful command is evidence of a boundary; the model merely claiming success is not.

Compaction preserves recent turns, active errors, recently touched files, pinned memories, active playbooks, and repository instruction hashes. A handover packet lets a fresh agent continue without carrying the entire transcript.

## Memory is five different systems

Atelier uses the word "memory" for several related but distinct jobs.

### Named fact memory

The public memory service stores user-created facts as named blocks. Facts can be recalled and voted up or down. Storage can be SQLite, Letta, or OpenMemory.

### Archival recall

Session transcript passages and code chunks are archived, embedded, and ranked. Recall combines BM25 and cosine similarity.

### Memory arbitration

Before a fact write, an optional local arbiter compares similar memories and chooses ADD, UPDATE, DELETE, or NOOP. It fails open to ADD if the arbiter is unavailable.

### Cross-vendor memory

Read-only adapters ingest native memory files from Claude, Codex, and Gemini into a unified fact representation. They do not mutate the other tool's files.

### Semantic file memory

Despite the name, this is code structure rather than conversational memory. It caches AST-derived file outlines, symbols, imports, and summaries for smart reads and code intelligence.

Related capabilities include symbol recall, session recall, staleness checks, knowledge extraction, playbook retrieval, dead-end tracking, procedure clustering, and sleep-time consolidation of recent traces.

## Agents, roles, and workflows

Atelier packages role definitions separately from the host that runs them.

The standard roles are:

| Role | Intent |
|---|---|
| `code` | Main collaborative coding mode |
| `explore` | Read-only code investigation |
| `plan` | Read-only implementation planning |
| `execute` | Focused implementation of an accepted plan |
| `review` | Adversarial read-only verification |
| `research` | External research with citations |
| `solve` | Autonomous artifact-first problem solving |
| `auto` | Unattended end-to-end execution |
| `bare` | Lean autonomous execution without token-heavy tools |

The registry stores host-neutral tool policies. Host renderers translate those policies into Claude `disallowedTools`, OpenCode tool gates, or simpler host instructions. Read-only intent is declared once rather than being reimplemented independently for every host.

The packaged skills add benchmark runs, orchestration, performance review, durable recall, settings, multi-worktree swarms, and browser-based UX review.

### Durable workflows

The default execute-review workflow contains explicit phases:

```text
explore -> plan -> critique -> refine -> execute -> review -> fix
```

Each step has a role, effort level, read-mode hint, and fork relationship. Execution can require a reviewed plan. Review uses a fail-closed contract: missing evidence produces `NEEDS_FIX`, not an optimistic pass.

Workflow state is persisted. A run can be inspected, paused, resumed, or stopped. Spawn receipts record model, provider, cache scope, reuse eligibility, and honored or dropped routing fields.

### Owned execution and model routing

Atelier can run a sub-agent through configured provider APIs or installed host CLIs. Routing considers:

- requested quality/cost budget,
- configured vendors,
- task complexity,
- model availability,
- provider rate limits,
- high-risk domains and protected files,
- verifier requirements,
- cache-eviction cost,
- model stickiness,
- previous cache affinity,
- explicit provider/model overrides.

The route produces a receipt rather than silently pretending a requested model or cache policy was honored.

Cross-vendor routing, quality-aware routing, tier routing, and owned execution are separate layers. This lets the runtime recommend a model, enforce a configured route, or leave the host's current model untouched.

## Verification, safety, and governance

Atelier uses different failure policies for different classes of feature.

Optional analytics generally fail open: if PR-risk enrichment or cache diagnostics fail, the core tool result should still return.

Mutation and security boundaries are stricter.

### Verification

The verifier runs deterministic lint, typecheck, and test commands over touched files. Failures become structured counterexamples that a later turn can consume. Retry budgets prevent endless repair loops.

Rubric gates, proof gates, and quality-router verifiers add higher-level checks. The live reviewer is opt-in and non-blocking. Review roles are explicitly prevented from editing.

### Trajectory monitoring

Six monitors look for:

- semantic loops,
- skipped verification,
- contradictory claims,
- cyclic compression,
- late task sprawl,
- silent topic drift.

A difficulty finite-state machine combines those signals and controls when additional rescue context should be injected.

The dispatcher also detects identical repeated tool calls and can append a soft no-progress note.

### Security scanning

The hidden `scan` tool includes a small, high-signal ast-grep rule pack for patterns such as dangerous `eval`/`exec`, interpolated `shell=True`, SQL string construction, and hardcoded secrets. A bounded Python taint pass follows request, argument, environment, and input sources to selected execution and SQL sinks.

The scanner labels severity, confidence, rule ID, CWE, source, and whether a result is heuristic. It explicitly does not claim to be a complete SAST engine.

### Governance and audit

Governance policies define redaction and retention. Audit bundles can be exported and verified. Telemetry paths scrub sensitive arguments. Workspace and request paths are normalized and confined before mutation.

Team capabilities add roles, invites, shared-memory permissions, signed workspace state, audit events, Google OIDC, and usage attribution.

Licensing adds device registration, entitlement checks, local license state, and cryptographic verification.

## Cost accounting and optimization

Atelier tracks cost at several levels.

### Tool token ledger

Input and final emitted output are tokenized per tool. Accounting happens after compaction and spilling, so it measures the payload the host received rather than the hidden original.

### Conservative savings credit

[Read savings are credited against a full-file baseline](/blog/how-atelier-saves-money) once per file and context epoch. Errors receive no credit. Code-intelligence credit is deferred through an observation window and cancelled if the supposedly avoided files are later read.

### Session analytics

SQLite analytics store session, token, cache, and cost history. JSONL sidecars provide live savings updates and status-line summaries without injecting those analytics into the model's prompt.

### Pricing

Pricing tables distinguish input, output, cache reads, and cache writes by model. Unknown models are not assigned invented prices.

### Counterfactual and benchmark evidence

Counterfactual modules estimate alternative routing and pricing outcomes. Benchmark manifests, gates, and evidence records keep experimental results tied to exact configurations and artifacts.

### Optimization advisor

The optimizer works at three levels:

- real-time per-session budget guidance,
- cross-session policy analysis,
- static prompt and quality audits.

It can compare routing and compaction candidates, run non-inferiority checks, maintain optimization history, and prepare policy or pull-request proposals. It does not silently change policy just because a heuristic predicts lower cost.

### Reporting

Savings summaries, session reports, dashboards, leadership-facing weekly reports, and audit exports all consume the same underlying traces and ledgers.

## Storage and process architecture

Atelier is local-first.

The default store is SQLite plus filesystem artifacts under the Atelier root. PostgreSQL is available as an alternative store; pgvector is optional for vector workloads. Memory can stay in SQLite or bridge to Letta/OpenMemory.

Concurrency controls include:

- per-path edit locks,
- a global state lock for read-modify-write session state,
- thread-local request and project context,
- per-session HTTP ledgers with bounded LRU eviction,
- separate light and heavy request executors,
- a stdout lock for JSON-RPC frames,
- process pools for parallel indexing,
- file locks around shared indexes,
- bounded caches and retention policies,
- autosync workers for repository indexes.

The stdio server keeps initialization synchronous, then dispatches ordinary requests concurrently. The HTTP adapter exposes discovery plus request/response and SSE-compatible behavior with body limits and redacted errors.

## Host integration

Atelier's runtime detects and adapts to multiple coding hosts. The code contains host paths or projections for Claude Code, Codex, OpenCode, Antigravity, Cursor, Hermes, GitHub Copilot, and LangGraph-style integrations. The default MCP templates currently include Claude, Codex, and Antigravity.

Host integration includes:

- generated MCP configuration,
- generated agents and skills,
- session-start and stop hooks,
- post-tool verification hooks,
- status-line sidecars,
- workspace/session bridge files,
- host-specific tool-deny policies,
- model and session detection,
- local or remote MCP operation,
- zero-config workspace discovery from Git,
- background daemon and stack management.

The CLI covers project initialization, updates, host setup, MCP serving, tools, context, memory, recall, playbooks, routes, sessions, savings, benchmarks, swarms, telemetry, database inspection, licensing, services, and administrative operations.

## The long tail of internal capabilities

Some subsystems do not need a public tool of their own but are still part of Atelier's architecture.

| Capability | Role |
|---|---|
| Analytics | Persistent session, cost, and cache history |
| Archival recall | Hybrid passage and code recall |
| Audit export | Signed/exportable audit bundles |
| Auth and licensing | Devices, entitlements, license verification |
| Benchmark manifests and gates | Reproducible benchmark evidence |
| Budget optimizer | Token-budget selection with CP-SAT or greedy fallback |
| Code health | Doc drift, PR risk, commit provenance, design-doc recall |
| Consolidation | Sleep-time trace distillation |
| Context compression | Event scoring, retention, and dropped-context records |
| Context reuse | Ranked procedures and dead-end avoidance |
| Counterfactuals | Alternative cost and capability estimates |
| Cross-vendor memory | Read-only import from other agent ecosystems |
| Cross-vendor routing | Provider-aware route recommendations |
| Failure analysis | Clustering and rescue procedures |
| Governance | Retention and redaction policy |
| Grounded loop | Search-first behavior and evidence before editing |
| Knowledge extraction | Durable facts and procedures from traces |
| Lesson promotion | Drafting and proposing reusable lessons from failures |
| Live reviewer | Opt-in automated review |
| Memory arbitration | ADD/UPDATE/DELETE/NOOP fact decisions |
| Model routing | Complexity tiers, stickiness, and cache-cost awareness |
| Monitoring | Failure-pattern monitors and difficulty FSM |
| Optimization | Policy candidates and non-inferiority testing |
| Orientation | Static tool-selection playbook |
| Owned sessions | Phase execution, keepalive, cache, and receipts |
| Plugin runtime | Host plugin lifecycle support |
| Prefix cache | Stable-prefix planning and diagnostics |
| Prompt compiler | Budgeted, cache-safe prompt assembly |
| Proof gate | Cost-quality acceptance evidence |
| Provider registry | Model discovery and rate limiting |
| Quality router | Risk-aware tiers and verifier requirements |
| Registry | Capability dependency graph |
| Repository map | PageRank-based structural summaries |
| Reporting | Dashboards, session reports, weekly reports |
| Scoped context | Minimal context for one subtask |
| Security | Bounded SAST and taint analysis |
| Semantic file memory | AST outlines and symbol maps |
| Session optimizer | Real-time trace costs and budget guidance |
| Source projection | Compact/minified source plus reversible mappings |
| Style import | Markdown style-guide collection and chunking |
| Swarms | Multi-worktree children, waves, ranking, validation, and apply |
| Teams | RBAC, shared memory, audit, OIDC, attribution |
| Telemetry substrate | Shared event bus |
| Tool supervision | Anomalies, circuit breaking, and metrics |
| Verification | Checks, structured counterexamples, retry budgets |
| Workflow runtime | Schemas, durable state, spawn envelopes, pause/resume/stop |
| Workspace overrides | Per-host and per-request project isolation |

## The ideas that connect everything

The technology list is long, but the system is organized around a small number of ideas.

### 1. Progressive disclosure

Return the repository map before the files, the outline before the body, and the exact range before the whole module.

### 2. Preserve the source of truth

Compact views need mappings. Omitted output needs a spill reference. A handover needs the active errors and touched files. Compression should defer detail, not destroy it.

### 3. Prefer deterministic machinery

Use parsers, indexes, schemas, diffs, locks, budgets, and test commands for work that does not require an LLM. Save model reasoning for decisions that actually need it.

### 4. Ground before mutation

Search and read evidence should precede an edit. The edit result should record exact affected paths. Verification should run against the resulting artifact rather than the model's description of it.

### 5. Keep the public surface lean

A capability can exist without being advertised on every turn. Administrative tools, analytics, and advanced graph operations stay hidden until a CLI, workflow, or power user requests them.

### 6. Be tolerant at protocol edges and strict at safety edges

Repair stringified JSON and backward-compatible parameter names. Do not be equally permissive about path traversal, destructive shell commands, SQL writes, or unverified edits.

### 7. Fail open for enrichment, fail closed for proof

Missing cache diagnostics should not break a read. Missing evidence should prevent a review from passing.

### 8. Account conservatively

Do not count a failed read as a saving. Do not credit the same baseline twice. Do not claim a model price that is unknown. Keep gross context savings separate from net end-to-end benchmark cost.

### 9. Treat cache stability as a design constraint

Stable schemas, deterministic compaction, prompt-block ordering, model stickiness, and shared cache scopes all protect prefix reuse.

### 10. Separate host policy from runtime policy

Roles and tool policies are host-neutral. Claude, Codex, OpenCode, and other integrations receive projections of the same intent.

### 11. Make heuristics honest

PR risk, commit classification, inferred edges, and SAST findings carry confidence and provenance. They are useful signals, not facts disguised as compiler output.

### 12. Optimize for continuation

A good tool result should make the next decision cheaper. A good session compaction should let work continue. A good failure message should change the next attempt.

That is the unifying idea behind Atelier. It is not one clever index or one prompt. It is a collection of small, explicit controls around how an agent finds evidence, changes code, verifies work, spends context, and survives a long task.

## Primary implementation sources

- [Atelier source repository](https://github.com/atelier-ws/atelier)
- [MCP gateway and tool registry](https://github.com/atelier-ws/atelier/blob/main/src/atelier/gateway/adapters/mcp_server.py)
- [Core capability packages](https://github.com/atelier-ws/atelier/tree/main/src/atelier/core/capabilities)
- [Code-intelligence infrastructure](https://github.com/atelier-ws/atelier/tree/main/src/atelier/infra/code_intel)
- [Storage implementations](https://github.com/atelier-ws/atelier/tree/main/src/atelier/infra/storage)
- [Runtime roles and host integrations](https://github.com/atelier-ws/atelier/tree/main/integrations)
- [How Atelier works](/blog/how-atelier-works)
- [How Atelier saves money](/blog/how-atelier-saves-money)
