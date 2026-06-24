---
title: "Context Engineering: What Atelier Shows the Agent"
description: "How Atelier decides what a coding agent sees now, what can wait, and what must survive: projection, output budgets, deduplication, and compaction."
date: 2026-06-23
updated: 2026-06-23
author: "Atelier"
excerpt: "A coding agent is only as good as the context it carries. Atelier treats that context as an engineering problem: progressive disclosure, bounded results, deduplication, budgeted selection, cache-stable ordering, and boundary-aware compaction."
image: "/blog/context-engineering-in-atelier.png"
imageAlt: "Diagram-style title card reading Context Engineering"
tags: ["Context engineering", "Code intelligence", "Coding agents"]
category: "Context & Memory"
difficulty: "Intermediate"
summary: >-
  A coding agent can reason only about what survives in its current
  conversation, so Atelier treats context as a finite engineering budget. It
  first shows compact source projections, caps every tool result, replaces
  duplicate content with references, and selects the most useful blocks under
  an explicit token ceiling. Stable material is ordered to protect provider
  caches, while large outputs are spilled without losing their source. When a
  session becomes crowded, compaction happens at a real task boundary and keeps
  active errors, touched files, decisions, and other evidence needed to resume.
---

A language model does not see your repository. It sees a conversation: a sequence of messages, tool results, and instructions that has to fit inside a finite context window. Whatever made it into that window is the entire world the agent can reason about on a given turn.

Context engineering is the discipline of deciding what belongs there. It is the part of Atelier that chooses what the model should see now, what can wait, and what must survive into a later session. [How Atelier works](/blog/how-atelier-works) covers the tools the agent calls; this post is about the layer that decides how much of their output the model actually has to carry.

> **In short.** Atelier engineers context in six moves: show a projection before the whole file, put a ceiling on every result, never send the same bytes twice, select blocks under an explicit token budget, order them so the provider's cache stays warm, and compact at a real task boundary. Each move is deterministic code, not a model guess.

## Context is a budget problem, not a search problem

Every token in the window costs money and crowds out something else. A coding agent spends most of its turns finding code, reading it, and re-reading it, so the cheapest path to a verified change is the one that puts the least unnecessary text in front of the model. Context is therefore a budget to be managed, not just a pile to be filled.

Atelier treats the window as a scarce resource with an explicit ledger of tool calls, tokens, and touched files. This is the same idea that drives [how Atelier saves money](/blog/how-atelier-saves-money), seen from the inside: end-to-end cost is mostly a function of what enters context, so the runtime works to keep that quantity small without ever losing access to the source of truth.

## Progressive disclosure: a projection before the whole file

Atelier almost never hands the model a whole file first. Its source-projection layer can return six views of the same file (`summary`, `exact`, `range`, `outline`, `compact`, and `minified`) and it picks the smallest one that still answers the question. For a large file the default is an outline: imports, classes, functions, methods, and their line numbers.

The outline is elected by savings, not by a fixed line count. Atelier compares the outline's token cost against the full file and only substitutes it when it clears a savings guard of roughly a quarter of the file's tokens, so a small file is still returned whole. From an outline the agent requests an exact line range, and a `compact` or `minified` projection can strip comments and blank-line noise while keeping a mapping back to the real source. Because an edit must be grounded in real lines, range reads stay exact.

The shape of a session becomes a funnel: repository map, then file outline, then exact range, then edit. The agent starts broad and cheap and pays for detail only where it matters.

## Every result has a ceiling

No single tool call is allowed to flood the window. Atelier's search surface carries a default budget of 2,000 tokens; a broad match is ranked, summarized, or returned as file pointers rather than as an unbounded wall of source. Structured output is capped near 80,000 characters, and a file-paths-only listing is capped at 200 paths.

Other guards bound the work itself. A user-supplied regular expression gets a five-second deadline, files larger than five megabytes are skipped during search, and per-line character caps stop one pathological minified line from stalling the engine. These limits are configurable through environment variables, but they exist so that a single query cannot silently consume the whole turn.

When a result is genuinely large (a long build log, a wide query, a fetched page) Atelier does not truncate it and lose the evidence. It spills the full output to a store on disk, hands the model a head-and-tail summary plus a `spill:` reference, and lets a later call retrieve the whole thing or a specific slice. Spilled output is retained for about a day and swept on a file-count cap, so the evidence lives exactly as long as it is useful.

## The cheapest duplicate is the one never sent

Agents reopen files "to be safe" even when the exact bytes are already in the prompt. Atelier keeps a within-session registry of read-style results, and when a tool would return content byte-identical to something already present in the current context epoch, it substitutes a small pointer instead of the duplicate.

Two thresholds keep this honest. Only results of at least four kilobytes are eligible, so the bookkeeping never costs more than the saving. For a file that changed since its last read, Atelier can emit a delta rather than the whole body, but only when the diff is at most half the file's size; past that, repeating the full content is cheaper and clearer. The registry tracks a bounded set of recent resources and evicts the oldest, and a compaction advances the epoch so a pointer can never refer to context that no longer exists. The [full technical inventory](/blog/inside-atelier-technology-and-ideas) lists this alongside the rest of the deduplication and spilling machinery.

## Selecting what fits under a budget

When several useful blocks compete for one budget, Atelier solves a knapsack rather than guessing. Each candidate block carries a token cost and a utility score in the zero-to-one range, and the budget optimizer chooses the subset that maximizes total utility without exceeding the limit. With OR-Tools installed it solves this exactly, as a CP-SAT model.

The exact solver runs under a two-second time limit and on problems up to a few hundred blocks. Beyond that, or when OR-Tools is absent, Atelier falls back to a greedy selection that ranks blocks by utility per token and adds a small bonus for drawing from a source it has not used yet. The diversity bonus matters: it stops the optimizer from filling the window with ten near-identical snippets from one file when a more varied pack would serve the next decision better.

## Order for the cache, not just for the reader

Where a block sits in the prompt decides whether the provider can reuse its cache. Atelier classifies every block by a stability tier (static, session, branch, turn, or volatile) and by kind, from tool schemas and coding policy down to git diffs and scratchpads. Stable material goes first; volatile material goes last.

The prefix-cache planner splits the compiled prompt into a static prefix (the static and session tiers) and a dynamic tail (branch, turn, and volatile), hashes the prefix with SHA-256, and compares that hash across turns to detect exactly what invalidated the cache. Keeping the stable schema and policy blocks in a fixed order protects the provider's prefix cache, so cache reads stay cheap turn after turn instead of paying full price for a prompt that barely changed.

## Scoped context: assemble the smallest useful pack

Given a subtask, Atelier can build a context pack from scratch instead of waiting for the agent to discover everything by hand. The scoped-context capability takes a description, keywords, and affected paths, then seeds candidates from several channels at once: hybrid search on the description, lexical search on the keywords, in-file symbols for the affected paths, and commit history when the task looks historical.

Candidates are ranked by position, keyword overlap, and whether they touch an affected path, deduplicated by file and symbol so the same code is not packed twice, and then fitted to the subtask's token budget. When the pack runs over budget, the packer drops the least essential fields first (snippets and signatures before paths) so the result degrades gracefully rather than dropping a whole file.

## Compaction: shrink at a boundary, keep what continues

Eventually a long session fills its window, and Atelier compacts. The policy fires on a single fill threshold that depends on the chosen preset (around 72 percent on the balanced default, lower on the savings-focused presets) and it preserves a protected list of material: recent turns, active errors, recently touched files, and pinned memory.

Compaction is not just deletion. It advances the deduplication epoch so stale pointers cannot survive into a context that no longer holds their targets, and at the far end it can write a handover packet that a fresh session reads to continue the work. The goal is never the smallest possible context; it is the smallest context that still lets the agent finish correctly.

## The ideas underneath

These mechanisms are different expressions of one stance: compression should defer detail, not destroy it. A projection keeps a mapping back to the file. A spill keeps a reference to the full output. A handover keeps the active errors and touched files. Nothing load-bearing is thrown away; it is only moved out of the window until it is needed again.

A few principles follow from that:

- **Progressive disclosure.** Return the repository map before the files, the outline before the body, and the exact range before the whole module.
- **Prefer deterministic machinery.** Parsers, budgets, hashes, and solvers do the work that does not require a model, so model reasoning is spent on decisions that actually need it.
- **Account conservatively.** An errored read earns no saving, and the same full-file baseline is never credited twice.
- **Treat cache stability as a design constraint.** A predictable block order that protects the prefix cache is often worth more than a marginally better selection that breaks it.

Atelier does not make the model smarter. It makes the model's view of the repository smaller, truer, and cheaper to carry, which is most of what a long agent session actually spends its budget on.

## Sources and further reading

This article was checked against the current Atelier implementation on June 23, 2026.

- [Source-projection implementation](https://github.com/atelier-ws/atelier/tree/main/src/atelier/core/capabilities/source_projection)
- [Result deduplication](https://github.com/atelier-ws/atelier/blob/main/src/atelier/core/capabilities/context_dedup.py)
- [Reversible output spilling](https://github.com/atelier-ws/atelier/blob/main/src/atelier/core/capabilities/tool_supervision/tool_output_spill.py)
- [Search output budgets](https://github.com/atelier-ws/atelier/blob/main/src/atelier/core/capabilities/tool_supervision/native_search.py)
- [Prompt budget optimizer](https://github.com/atelier-ws/atelier/blob/main/src/atelier/core/capabilities/budget_optimizer/optimizer.py)
- [Prompt compilation and prefix-cache planning](https://github.com/atelier-ws/atelier/tree/main/src/atelier/core/capabilities/prompt_compilation)
- [Scoped context](https://github.com/atelier-ws/atelier/tree/main/src/atelier/core/capabilities/scoped_context)
- [How Atelier works](/blog/how-atelier-works)
- [How Atelier saves money](/blog/how-atelier-saves-money)
- [Inside Atelier: technology and design ideas](/blog/inside-atelier-technology-and-ideas)
