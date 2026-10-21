# Issue 340 Domain Model

- **Security header set**: the production header map from `webSecurityHeaders("production")`; single source of truth.
- **Static artifact**: `apps/web/dist`, the only content served.
- **Edge**: nginx container on loopback port 8470; Cloudflare tunnel (#341) is the sole ingress.
- No learner data, program model or runtime concepts are touched.
