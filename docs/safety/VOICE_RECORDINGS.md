# Supervised voice recordings

Issue #622 (SND-02). An adult can record a sound of up to five seconds for a character. This is the
only place the product touches the microphone, and it is the most sensitive data a child can leave in
it (a voice). The rules below are enforced by code and by tests, not by habit. Related:
[WEB_SECURITY_BASELINE.md](./WEB_SECURITY_BASELINE.md), [CHILD_SAFETY_PRIVACY.md](./CHILD_SAFETY_PRIVACY.md),
[ADULT_ACCESS.md](./ADULT_ACCESS.md), [PRIVACY_THREAT_MODEL.md](./PRIVACY_THREAT_MODEL.md).

## Who and when

- Only in the grown-ups area, behind the adult gate and PIN. There is no way to record from a child's
  screen.
- Off by default. An adult turns it on with an explicit switch ("Permitir grabar con el micrófono de
  este dispositivo"), stored on this device (`agorix.kids.microphone.v1`). Turning it off removes the
  Record buttons at once and stops a recording in progress.
- Each recording starts with the adult pressing "Grabar a ...". The browser then asks for its own
  microphone permission, which the adult can refuse or revoke in the browser at any time. A refusal is
  a calm message, never a retry loop.

## What is recorded

- Audio only (`{ audio: true }`), never video, never the screen.
- Five seconds at most. The recorder stops by itself at 5 s, and the adult can stop earlier.
- The microphone is released the moment recording ends, fails, or the adult leaves the panel
  (`track.stop()` on every track). A test proves the tracks end.

## What happens to it

- The recording stays in the page: it is decoded into samples and opened in the sound editor, where
  the adult listens to it and can trim or change it. It is saved only if the adult presses Save, as a
  clean mono WAV with no metadata, in the same on-device store as imported audio (IndexedDB
  `agorix.kids.audio.v1`), through the same checks (≤ 5 s, ≤ 500 KB).
- Cancelling, leaving the panel or a failure saves nothing.
- It is never sent to a server, to Ori or to any provider. The recorder module has no network, upload,
  storage or file API at all (a test reads its source), and an end-to-end test checks that every
  request of a recording session stays on this origin and none is a write.
- The adult removes a saved recording from the same panel ("Quitar audio de ..."). Clearing the
  browser's site data removes everything.

## Policy and enforcement

- `Permissions-Policy: microphone=(self)` replaces `microphone=()`. It opens the microphone to this
  origin only, never to a frame, in `securityHeaders.ts`, `public/_headers` and
  `deploy/web/security-headers.conf` (a test keeps them in step). Camera, geolocation and the rest stay
  closed.
- `scripts/security-baseline.mjs` allows `getUserMedia`, `MediaRecorder` and `mediaDevices` in exactly
  one file, `apps/web/src/kids/kidsRecorder.ts`, which carries an attributed file marker. The same code
  in any other file is a finding that no marker can suppress.

## Limits, and what this does not do

- A voice is personal data even in five seconds. Recordings live on one browser; there is no account
  copy, no backup and no sync of audio.
- The adult is responsible for whose voice is recorded and for deleting it. Nothing here can tell
  whose voice it is, or whether the child is the one speaking.
- The recording uses the browser's own encoder first (WebM or Ogg) before it is decoded and saved as
  WAV; browsers that cannot record from the page say so and offer nothing else.
- Sharing a project (export, groups) does not include audio unless the adult exports it on purpose
  through the existing adult-approved export.
