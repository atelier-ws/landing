---
title: "Five Kinds of Memory: How Atelier Remembers"
description: "Atelier uses the word memory for five distinct systems: named facts, archival recall, write-time arbitration, cross-vendor ingestion, and semantic file memory."
date: 2026-06-23
updated: 2026-06-23
author: "Atelier"
excerpt: "Memory is the most overloaded word in agent tooling. Atelier uses it for five genuinely different systems: curated facts, searchable history, write-time arbitration, read-only cross-vendor ingestion, and a content-addressed cache of code structure."
image: "/blog/five-kinds-of-memory-in-atelier.png"
imageAlt: "Diagram-style title card reading Five Kinds of Memory"
tags: ["Memory", "Code intelligence", "Coding agents"]
---

"Memory" is one of the most overloaded words in agent tooling. It can mean a vector store, a scratchpad, a fine-tune, a config file, or a chat history, and a product that promises "memory" rarely says which one it means. Atelier uses the word for five genuinely different systems, and conflating them is how teams end up with a feature nobody can reason about.

This post keeps them apart. [How Atelier works](/blog/how-atelier-works) introduces the runtime and the [full technical inventory](/blog/inside-atelier-technology-and-ideas) lists every subsystem; here we look only at memory: what each kind stores, when it runs, whether the model triggers it, and how it fails.

> **The five.** Named fact memory (curated facts the agent stores and recalls), archival recall (search over everything that happened), memory arbitration (deciding what is worth writing), cross-vendor memory (reading what other tools already know), and semantic file memory (a cache of code structure that, despite the name, holds no conversation at all).

## 1. Named fact memory: the thing you call "memory"

The first kind is the one the model calls directly. Atelier exposes a `memory` tool backed by a fact service that stores user-created facts as named blocks, recalls them by subject, and lets the agent vote them up or down. Every fact is scoped to either the repository or the user, so the runtime knows how far it should travel.

The service runs on one of three interchangeable backends: SQLite by default, or Letta or OpenMemory when configured. A repository fact ("this service deploys from the `release` branch") earns its place across every task in that repo; a user fact follows you between repositories. Up and down votes give the store a cheap, durable signal of which facts keep proving useful and which have gone stale.

## 2. Archival recall: search over everything that happened

The second kind is not facts but history. As a session runs, Atelier archives transcript passages and code chunks (split into a few hundred tokens with overlap, embedded, and dedup-hashed) so it can later search across everything that has happened, not just what is still inside the context window. Recall pulls a wide candidate window before it ranks.

Ranking is a hybrid. Atelier blends cosine similarity over embeddings with a BM25 lexical score, weighted sixty-forty toward the vector signal, so recall catches both "this means the same thing" and "this uses the exact identifier I typed." Exact brute-force cosine is the default; an approximate index is opt-in behind an environment flag.

Two safeguards keep the ranking honest. The newest handful of passages are always kept as exact candidates, so the most recent context is never missed. And a passage is eligible only if it was embedded by the current model at the current dimension, which means a model upgrade cannot silently poison the results with vectors that no longer mean the same thing.

## 3. Memory arbitration: deciding what is worth remembering

The third kind runs before a fact is written. Instead of appending every claim, an optional arbiter compares a candidate fact against similar existing ones and chooses among four operations: ADD a new fact, UPDATE an existing one, DELETE a contradicted one, or NOOP when the store already says enough. It is how named-fact memory avoids filling with near-duplicates.

Similar blocks are found by token-overlap similarity on each fact's label and value, and a local model ranks the candidates and picks the operation. An UPDATE merges into the existing block, a DELETE tombstones it, and a NOOP leaves the store untouched. The design choice that matters is the failure mode: if the arbiter is unavailable or returns anything malformed, it falls open to ADD. A write is never blocked by a missing arbiter, only refined by a present one.

## 4. Cross-vendor memory: reading what other tools already know

The fourth kind reaches outside Atelier entirely. Read-only adapters ingest the native memory files that Claude, Codex, and Gemini write and present them as one unified fact representation. If you have already curated memory in another assistant, Atelier can read it without you re-entering anything, and without a separate import step.

The emphasis is read-only, and it is load-bearing. Each adapter can check whether a vendor's files exist, list the facts it finds, and report which paths it read, and nothing else. Atelier never writes back into another tool's memory, so there is no way for one assistant to corrupt another's state. Each ingested fact gets a stable id derived from its content, so the same upstream note is never counted twice.

## 5. Semantic file memory: structure, not conversation

The fifth kind is the odd one out: despite the name, it stores no conversation at all. Semantic file memory caches what Atelier has learned about the *code* (AST-derived outlines, symbols, imports, complexity scores, and summaries) keyed by a SHA-256 hash of each file's contents rather than by path or timestamp.

Because the key is the content hash, the cache survives a git checkout, a container rebuild, or an rsync; only a file whose bytes actually changed is re-parsed. This is the memory that makes a smart read cheap: the outline the agent sees before it asks for a range, the first move of [context engineering](/blog/context-engineering-in-atelier), comes straight from here, and the same data feeds the dependency graph used for blast-radius analysis. A read cap stops a pathological file from exhausting memory, and an outline is substituted only when it saves at least a quarter of the file's tokens.

## Why keep them separate

These five could be marketed as a single "memory" feature, but keeping them distinct is exactly what makes each one safe to reason about. They disagree on every axis that matters: what they store, when they run, whether the model triggers them, and what they do when something goes wrong.

| Kind | Stores | Runs | When it fails |
|---|---|---|---|
| Named fact memory | curated facts | on a model `memory` call | needs a storage backend |
| Archival recall | session and code history | continuously, plus on recall | falls back to lexical-only |
| Memory arbitration | nothing — a decision | before each fact write | falls open to ADD |
| Cross-vendor memory | other tools' facts | on read | empty if files are absent |
| Semantic file memory | code structure | on read and indexing | re-parses the changed file |

A single abstraction would force one storage model, one trigger, and one failure policy onto all five, and most of those choices would be wrong for most of the jobs. Atelier's bet is that naming the five honestly is worth more than collapsing them into one word that quietly means five things.

## Sources and further reading

This article was checked against the current Atelier implementation on June 23, 2026.

- [Named fact memory service](https://github.com/atelier-ws/atelier/blob/main/src/atelier/core/capabilities/memory/service.py)
- [Archival recall](https://github.com/atelier-ws/atelier/tree/main/src/atelier/core/capabilities/archival_recall)
- [Memory arbitration](https://github.com/atelier-ws/atelier/blob/main/src/atelier/core/capabilities/memory_arbitration/arbiter.py)
- [Cross-vendor memory adapters](https://github.com/atelier-ws/atelier/tree/main/src/atelier/core/capabilities/cross_vendor_memory)
- [Semantic file memory](https://github.com/atelier-ws/atelier/blob/main/src/atelier/core/capabilities/semantic_file_memory/capability.py)
- [How Atelier works](/blog/how-atelier-works)
- [Context engineering: what Atelier shows the agent](/blog/context-engineering-in-atelier)
- [Inside Atelier: technology and design ideas](/blog/inside-atelier-technology-and-ideas)
