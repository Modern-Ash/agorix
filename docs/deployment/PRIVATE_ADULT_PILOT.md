# Private adult account pilot on the Modern Ash host

This runbook prepares a one-adult trial of the existing Kids account and device-link flow. It does not enable Ori MIG-04. Keep the `adultLink` browser flag off until the mail and link checks pass.

## Server configuration

Set these values in the host's private Compose environment, never in Git, a command line, or a log:

- `AGORIX_LINK_SECRET`: a random secret of at least 32 characters.
- `AGORIX_MAIL_SMTP_URL`: a TLS-only SMTP URL with credentials stored in the host secret store.
- `AGORIX_MAIL_FROM`: the verified Agorix sender address.
- `AGORIX_ALLOWED_ADULT_EMAIL`: the one adult address authorized for this pilot.

`apps/server/src/main.ts` passes the last value to the Project API. Registration and subsequent email changes are denied for any other normalized address before an account or verification mail is created. The server refuses to start if an allowlist is supplied without the email service. The public error does not echo the address. Do not activate the link service on this private deployment without the allowlist.

The Compose projects service sets `AGORIX_PRIVATE_ADULT_PILOT=1`, so it also refuses to start if a link secret is configured without `AGORIX_ALLOWED_ADULT_EMAIL`.

## Release sequence

1. Run `docs/deployment/MAIL_STAGING_CHECK.md` against staging. Confirm actual delivery and one-use verification without recording tokens.
2. Back up the SQLite volume; build and start the projects service with the private environment; confirm the allowlist is present without printing its value. Test one denied registration and confirm no account row was added.
3. Enable the existing `adultLink` Kids flag in a controlled browser only. In Adultos, the adult creates their own password, verifies the mail, creates and redeems a six-digit code, sees the device summary, unlinks, and confirms the device token stops working. Check that a fresh anonymous Kids browser still works without an account.
4. Only after that evidence, approve and build the Web with `AGORIX_KIDS_ADULT_LINK_DEFAULT=1` so a new browser gets the adult entry point. The server allowlist must remain in force for the private pilot. Keep the prior Web image and projects image for rollback. The build switch defaults to `0`.

Rollback: restore the previous Web flag default or image, stop the link service if necessary, and revoke active link codes and device tokens. Do not clear Kids local projects. This rollback does not authorize any Ori program mutation; MIG-04 has its own policy and kill switch.
