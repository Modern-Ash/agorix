<!-- agora-ai-sdlc:construction/v1 -->

# Deployment Unit — issue-91 (First Mission vertical slice)

No new deployment target. `apps/web` remains a static Vite build
(`pnpm --filter @agorix/web build`) served the same way as before this
change; no server-side component, secret, or environment variable was added.
`@agorix/tutor-contract`'s proposal generator is a pure, in-process, fake
implementation — it makes no network call, so this slice introduces no new
runtime dependency, provider credential, or CI requirement.
