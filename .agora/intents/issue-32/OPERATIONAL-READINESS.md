---
schema: "agora/operational-readiness/v1"
id: "issue-32-agora-bootstrap"
work: "product-poc/product-foundation"
---

# Operational readiness: Agora bootstrap confirmation

Governance/configuration deliverable with no runtime, deploy target or service to
operate.

- **Availability**: the confirmation and the `.agora/` state it describes ship in the
  repo on merge to `main`.
- **Ownership**: product-owner and developer roles on the `product-poc` swarm are the
  maintainers of record for future bootstrap changes (e.g. adding runtimes, changing
  profile/depth).
- **Downstream consumers**: any future Agora-governed work in this repo depends on
  `.agora/` staying valid; `agora validate` is the ongoing health check, not a
  one-time gate.
