# Agora AI-SDLC setup for Agorix

Recommended installer choices once `agora-ai-sdlc install` is available:

- project id: agorix
- project name: Agorix
- mode: existing
- profile: starter
- depth: standard
- language: typescript
- framework: react-vite (Phaser for stage; Capacitor/PWA/VS Code are architecture targets, not installer language/framework values)
- pathway: new-product
- integrations: github, ci, security, observability
- swarm: product-poc
- initial work: product-foundation

Runtimes are intentionally not fixed in this repository. Configure the LLM/provider/model available in the development environment and assign architect/builder/operator explicitly.

The repository must remain buildable and testable without any LLM credentials.
