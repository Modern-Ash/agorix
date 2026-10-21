# Agorix Kids: the prototype becomes the Web experience, with Ori as an active AI agent

Status: design approved in conversation with the product owner on 2026-10-21; implementation tracked in the epic and issues listed at the end (filled in when they are created). Written so that any engineer or LLM can plan from it without going back to the owner.

## Intent

The Web app is replaced by the **Agorix Kids** prototype (`prototipo/handoff/`, made with Claude Design for ages 6 to 8). It must feel familiar to a Scratch user: the product owner's daughter Mora (11, a Scratch user) is the first real tester and her suggestions drive iteration. The current capabilities (several actors, looks, sounds, variables, events, TypeScript and Python code view) are not deleted: they return later as an **advanced level**, which is the same prototype with changes for that level and keeps its look and feel.

The value Agorix adds is the AI: **Ori**, the character, is an *active agent* (a bot that speaks up, not a passive hint button). The AI is on by default from the first delivery, not an optional extra.

## Goals

1. The Web opens in the prototype flow: onboarding (language, avatar, meet Ori), world map with missions, editor, reflection, projects, free world ("Crear"), adults panel.
2. The UI follows the prototype: layout, colors, typography, 44px+ targets, worlds, avatars, copy in Spanish (default) and English.
3. The prototype is a **view** over the real authorities: canonical program (`program-model`), deterministic `runtime`, `curriculum`, `persistence`, `learning-evidence`. Nothing keeps program state outside them.
4. Ori suggests with a real model (Codex or OpenCode by default) through a fixed, versioned agent definition, validated before display, with silent deterministic fallback.
5. The app never tells the child that the AI is "not connected". AI status is visible only in the adults panel.
6. Mora can play from start to finish alone, in Spanish, on a tablet.

## Non-goals and anti-goals

- No migration of old projects (the product is not live for users yet).
- Agorix Studio (VS Code) does not change; it keeps using the shared packages.
- The AI never answers or suggests anything outside the app: moves and behaviours of the program, goals for the free world, and things about the app. Off-topic input gets a fixed friendly refusal.
- The AI never applies anything by itself: AI proposes, the child decides, the runtime proves, the child explains.
- No provider credentials, tokens or model calls in the browser. No child free text stored in projects or evidence.
- Failure even if it technically works: a child sees "AI not connected", a spinner that blocks play, or an off-topic or unsafe reply.

## Constraints

- Stack stays React 18 + Vite + TypeScript strict; tests with Vitest and Playwright; production behind the CSP in `apps/web/src/securityHeaders.ts` (`font-src 'self' data:`, `connect-src 'self'`). Fonts (Atkinson Hyperlegible, Epilogue, JetBrains Mono) must be self-hosted, never from Google.
- The app must work with no AI at all (offline, provider down). Ori then uses deterministic rules.
- Production is the container behind Cloudflare described in `docs/deployment/MODERN_ASH_HOST.md`; deploys go through `pnpm deploy:web` (gates: verify, health, smoke, automatic rollback).
- Existing invariants in `AGENTS.md` and `docs/FOUNDATIONS.md` still hold (canonical program, evidence without text, safety validator, no hidden mutation).

## Decisions made by the product owner

| Topic | Decision |
| --- | --- |
| Replace or add | The prototype **replaces** the current Web UI. |
| Old capabilities | Kept for an **advanced level** later; same look and feel. |
| Advanced level | The prototype itself with changes for that level. |
| Old projects | Do not matter. |
| AI by default | Yes, with **Codex or OpenCode** as the default providers. |
| AI scope | Suggest movements and behaviours of the program, **invent goals**, things about the app. Nothing else. A chat is allowed under the same constraints. |
| Ori | An **active agent**, behaves like a bot. Defined in advance (fixed prompt/agent). |
| Failure | Never say the AI is not connected. |
| Order | One project at a time, but the AI is integrated **from the start**. |
| Success | Mora, a Scratch user, finds it familiar and can play alone; her feedback drives iteration. |
| From earlier docs | Own touch editor over `program-model` with `block-editor` as adapter; own render over `stage` (no Phaser); character called Ori; Java as a new language pack (low priority). |

## Decisions made by the builder (not yet confirmed by the owner)

- **Ori's proactivity** reuses the existing System-0 / Learning Decision Plane rules so it speaks up at useful moments and goes quiet after repeated declines.
- **The agent is text-only:** Codex/OpenCode are used purely as text generators, with no file or command access (sandbox read-only, tools disabled), because they are tool-using agents and a child's chat text is untrusted input.
- **Where it runs:** the tutor service must run on the host (that is where the Codex/OpenCode CLIs and logins live); the web container proxies `/api/tutor/*` to it.
- **Output contract:** the agent returns JSON that is validated against the canonical program schema and a fixed allow-list of block types per level; anything else is dropped and Ori falls back to deterministic rules.
- **Chat safety:** input length cap and filter, scope check, fixed refusal phrase, `validateLearningCompanionSafety` on every output, nothing persisted (`localEphemeral`), rate limit.
- **Hint ladder:** pick one scale (the prototype's three levels map onto the existing 1 to 5 levels of `learning-evidence`); "Ver idea" is level 5 and stays locked until earlier levels were used.
- **Prediction before Play** stays mandatory for the kids missions (the prototype's behaviour); pedagogy docs call it optional, so this is confirmed with the owner when the first playtest happens.
- Sound is a single tone for now; per-world sounds come later.

## What is left to the builder

Store choice (`useReducer` or a small store), exact grid/pixel scale, mission authoring format details, how the host service is supervised (systemd user unit like the tunnel), the evaluation fixtures for the agent, and the order of screens inside project 1.

## Projects and order

1. **Kids experience with the AI in the loop** (this design's focus): domain additions, all screens, Ori active with deterministic provider, then the real agent with fallback.
2. **Rest of the AI**: chat with Ori, goal invention in the free world, evaluations.
3. **Advanced level**: the prototype with the current capabilities (actors, looks, sounds, variables, events, code). To be designed (brainstormed) when projects 1 and 2 are playable.

## Known facts from the prototype handoff (verified against the repo before the plan was written, partly stale)

- Real statements: `move(steps)`, `turn(degrees)`, `repeat(count, body)`, `if`; heading 0 = East, 90 = South, 270 = North, same as the prototype.
- The real runtime has no world borders (`move` always advances); the prototype stops at the edge with a "chocaste" result. Borders belong in the mission definition (curriculum), not in the runtime.
- The prototype moves by cells; the runtime uses pixels. A cell scale is needed in `stage`/curriculum.
- The three prototype missions (6x4 grid) are new `MissionDefinition`s with hint ladders and `en`/`es` copy. `first-mission.reach-goal` is a single horizontal row and stays as is.
- Since the plan was written, the repo gained actors, looks, sounds with volume, events, variables, watchers, Studio parity, the `/api/tutor/*` service, deploy scripts and a prod smoke. Re-read before relying on the plan's "Fase 1/2 results".
- The old "AI status badge", "Para adultos" explainer and four-step loop in the AI panel (#352, #354) are replaced by Ori; their server health reading (`/api/tutor/health`) is reused for the adults panel.

## Issue map

See the epic labelled `kids` in GitHub (title starts with "Epic: Agorix Kids"). Issues are written so an engineer or LLM can take one without the conversation.
