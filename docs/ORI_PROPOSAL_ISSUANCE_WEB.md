# Ori proposal issuance browser contract

The Web client requests a proposal with an empty JSON body and same-origin credentials. It accepts only an opaque UUID, a strictly validated review-only move/turn proposal and appliedChanges=false. No owner, project, grants, revision or program content is transmitted as authority.

The API response does not yet include a server-verified canonical revision for browser display. The browser must not invent one. The learner review component remains unmounted until the server's trusted authentication, proposal issuance workflow and canonical revision presentation are wired. All acceptance decisions remain server-authorized.

This is a client contract and unit-test increment, not production activation. Related Ori #18 #20 #23 #28 #29. Target integration/ori.
