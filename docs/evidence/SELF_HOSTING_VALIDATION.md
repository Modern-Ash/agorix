# Self-hosting validation evidence

Issue: #98 — Document self-hosting and open-source-first deployment for
schools and families.

Evidence date: 2026-10-03.

## Acceptance evidence

| Requirement                                                | Evidence                                                                                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public/static demo uses zero API keys or backend services  | [SELF_HOSTING.md](../deployment/SELF_HOSTING.md) Mode 1 documents `@agorix/web` build/preview, forbids `AGORIX_TUTOR_*` variables, and uses browser-local deterministic/fallback behavior. |
| Local intelligent mode works before generative inference   | Mode 2 documents the injected Laya `LayaBatchTransport`, compact decision state, confidence thresholds, abstention behavior, and System-0 authority.                                       |
| Local generative mode has zero service cost path           | Mode 3 documents Ollama and OpenAI-compatible localhost gateway setup with no browser credential and no remote fallback.                                                                   |
| Remote providers are optional and explicit                 | Mode 4 requires `AGORIX_TUTOR_ADAPTER=openai-compatible`, explicit base URL/model/capabilities, and server-side token storage only.                                                        |
| Raw learner free text is not sent to Laya Decision Plane   | Mode 2 lists the compact Laya state and excludes free text. Mode 4 records that `learnerIntent` is stripped unless explicitly enabled server-side for remote tutoring.                     |
| Source, adapter, model, and service licensing are distinct | The license boundary section separates Apache-2.0 source from model weights, datasets, hosted services, third-party assets, and provider trademarks.                                       |
| Unsupported hardware is documented honestly                | Mode 3 records CPU-only and GPU/latency caveats and treats model quality as deployment-specific evidence, not CI evidence.                                                                 |
| Fresh-install evidence is reproducible                     | The guide records `git clone`, `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm verify`, and web build commands.                                                                 |

## CI guard

`scripts/self-hosting-docs.test.mjs` checks that the guide keeps the four
deployment modes, ordering rule, privacy boundary, local-only fallback language,
license distinction, and secret-free examples.

The expected branch validation command is:

```bash
pnpm exec vitest run scripts/self-hosting-docs.test.mjs
```

Release validation should also run:

```bash
pnpm verify
```
