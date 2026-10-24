# Adult verification mail: staging check

The automated test `packages/link-service/tests/mailJourney.test.ts` runs in CI with a loopback SMTP inbox. No message leaves the machine. It captures the bilingual verification message, follows its same-origin link through `LinkService`, checks one-time use and expiry, and checks generic answers and sanitized delivery errors.

Run locally with `pnpm exec vitest run packages/link-service/tests/mailJourney.test.ts`. The test needs permission to bind a loopback port. It uses only fixture addresses and an in-memory repository.

## Optional external staging check

Choose **one** transport for a staging environment, never a child or production account:

- [Ethereal Email](https://ethereal.email/) provides disposable SMTP credentials and a web inbox. It captures mail but does not deliver to a real recipient. Use it to inspect the rendered message and manually open the staging link. Its SMTP URL and credentials belong only in the host secret store.
- [Resend SMTP](https://resend.com/docs/send-with-smtp) can deliver to a real test inbox. Its free plan and limits can change; [check current pricing](https://resend.com/pricing) before use. Verify a staging sending domain first. Use `smtp.resend.com` with implicit TLS on port 465, username `resend` and an API key as password, as described in [Resend's SMTP instructions](https://resend.com/changelog/smtp-service). The `AGORIX_MAIL_FROM` domain must be verified.

Set `AGORIX_PROJECT_ORIGIN` to the staging HTTPS origin, `AGORIX_LINK_SECRET` in the host secret store, and both `AGORIX_MAIL_SMTP_URL` and `AGORIX_MAIL_FROM` as described in [PROJECT_HTTP_SERVER.md](../architecture/PROJECT_HTTP_SERVER.md). Percent-encode special characters in the SMTP URL credentials. Do not put a token, address, SMTP URL or API key in a command line, test fixture, PR, screenshot or log. Keep production mail disabled during this check.

1. Create a disposable adult staging account with an address you control. Request verification. The API answer must not disclose whether the address already exists.
2. Inspect the captured email. Check Spanish and English copy, the recipient, and exactly one `https://<staging-origin>/kids?verify=...` link. Open it in a staging browser and confirm the account becomes verified. Opening the link again must fail safely.
3. Try an address already owned by another staging account. The caller gets the same generic answer; only the owner receives the token-free “email in use” notice.
4. Request a new link, wait past the configured expiry in an isolated staging clock/test environment, and confirm it cannot verify. Automated CI covers this without a 24-hour wait.
5. Supply a deliberately invalid staging SMTP credential and confirm the HTTP answer stays generic. Inspect server logs for an error **kind** only; no address, token, server reply or credential may appear.
6. With a verified staging adult account, create and redeem a six-digit link code on a test child device, then unlink it. Do not use a real child's data.

The application has no password-recovery flow yet; this checklist validates email verification and device linking. Enabling production delivery and linking is a separate release decision after the staging check.
