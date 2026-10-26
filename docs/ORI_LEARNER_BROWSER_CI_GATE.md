# Ori learner browser CI gate

The Ori integration workflow now runs `pnpm test:e2e:ori` as an independent Playwright job with Chromium installed in GitHub Actions. The suite starts the experimental Web feature flag and mocks only the Tutor API HTTP boundaries. Failures block the Ori integration workflow instead of leaving browser journeys as an optional local command.

Coverage includes proposal issuance, minimal request payloads, learner rejection, forged auto-apply response refusal and stale proposal feedback. This is browser contract testing, not a production authenticated end-to-end test.

Remaining release gates: production session identity resolver, authorized canonical project repository, verified learning context, deployment-safe ticket storage and unmocked browser-to-Ori journey. The server review endpoints remain disabled by default.

Related Ori issues #18 #20 #23 #28 #29. Target Agorix integration/ori.
