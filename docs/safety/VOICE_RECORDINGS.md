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

## Microphone level while a program plays (issue #1304)

A program can read how loud it is (the `loudness` value, a whole number from 0 to 100), so a child can
make a character react to a clap or a shout. This is a second, narrower use of the microphone, with
its own rules; it is not recording.

- **Its own adult switch**, in the grown-ups area, off by default, stored on this device
  (`agorix.kids.microphoneLevel.v1`). It is separate from the recording switch: allowing recordings
  does not allow measuring, and the other way round. Off, `loudness` is always 0 and the microphone is
  never asked for.
- **Only while it is needed.** The microphone opens when a child presses Play on a program that uses
  `loudness`, and is released (`track.stop()` on every track, audio context closed) the moment play
  ends. A visible "listening" marker is on screen the whole time. The browser's own permission prompt
  is the second gate and a refusal just means `loudness` stays 0.
- **Only a number.** The meter reduces each block of audio to one whole number and drops the audio at
  once: no samples are kept, no recording is made, no file, no storage, no network. The only thing
  that reaches the program, the run log or a replay is that number, so a replay needs no microphone.
  A test reads the module's source and refuses any network, storage, recording or file API.
- **Ori never sees it.** Findings and provider input carry kinds and counts, never the level.
- **Enforcement.** `scripts/security-baseline.mjs` allows user media in exactly two files,
  `kidsRecorder.ts` and `kidsLevelMeter.ts`, each with an attributed marker; anywhere else is a finding
  no marker can suppress.

## Recordings kept in a project (#1309)

The same adult switch that allows recording on this device also shows "Grabar un sonido" in the Studio's sound drawer. Nothing about the microphone changes: it is still opened only by `kidsRecorder.ts`, only after the adult's switch and the browser prompt, and released when the recording ends.

- **Where it is kept.** After trimming, the recording is stored as a `sound:recorded-N` asset of the project: a mono, 16-bit PCM WAV at 16 000 or 22 050 Hz, at most five seconds, at most eight per project. Anything else is rejected by the model (`validEmbeddedSoundSource`), by the project's own validator and by import.
- **Leaving the device.** A recording counts as child-added media. Exporting a project that holds one needs the same explicit adult opt-in as a drawing, and a file carrying a recording is re-validated on import. Without the opt-in the export is refused.
- **Never read by Ori or the provider.** A block plays a recording by its id. Findings and provider input carry kinds and counts only, never the audio and not its name's meaning.
- **Never executed.** The bytes are decoded for playback only; if they will not decode, the run stays quiet and its result is unchanged.
- **Deleting.** A child can delete a recording from the sound drawer. One a block still plays is kept and the child is told why; the program is never changed behind their back.
