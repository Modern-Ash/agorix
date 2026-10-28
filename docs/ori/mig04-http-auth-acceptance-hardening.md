# MIG-04 consolidated HTTP authentication acceptance

This PR strengthens the opt-in shared PostgreSQL AuthService HTTP surface: exact route matching, strict JSON media type validation, bodyless logout handling, HTTPS same-origin enforcement, and real PostgreSQL-backed HTTP registration/login with secure cookie assertions. Tests reject cross-origin mutations, malformed media types and unknown routes. Legacy TutorServer routes remain separate.

**Release status:** this validates a real HTTP authentication slice but does not switch `main.ts` to the integrated host or prove successful authorized Ori propose/decision/apply. The browser's deployed login and reverse-proxy origin contract must be checked before enabling any pilot. #1007 remains open.
