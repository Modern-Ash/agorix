---
schema: "agora/rollback-procedure/v1"
id: "issue-32-agora-bootstrap"
work: "product-poc/product-foundation"
---

# Rollback procedure: Agora bootstrap confirmation

Rollback is a plain git revert of the commit that adds the `product-poc` swarm,
`issue-32` intent artifacts and the runtime declaration change.

1. `git revert <merge-commit>` on `main`.
2. Reverting `agora actor runtime --actor ai-primary --integration codex ...` returns
   that actor to its prior `generic/local` runtime; no other actor or swarm is
   affected.
3. The earlier `delivery` and `issue-10-delivery` swarms are untouched by this
   revert — they are independent governance history.
