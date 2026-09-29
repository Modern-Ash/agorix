# Deployment Unit - issue #78

Deployment unit is the web app bundle produced by `pnpm build`, specifically `apps/web/dist`. The change is frontend-only and uses existing workspace packages (`@agorix/proposals` and editor model helpers). No database migration, service rollout, external provider, or runtime secret is required.
