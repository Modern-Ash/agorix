# Spike: WebRTC data channels for same-room groups (issue #568, ADR 0010)

Status: **desktop part done; the real-device gate is NOT passed.** This spike is throwaway code under
`spikes/webrtc-lan/`. Nothing imports it and it ships nowhere. Recommendation in the last section.

## What ran

`node spikes/webrtc-lan/run.mjs --guests 3 --ticks 300` starts a local page server and one headless
Chromium (Playwright's bundled build). One page plays the organizer host and N pages play children.
Pairing is offline: `RTCPeerConnection({ iceServers: [] })`, so no STUN or TURN and only local host
candidates. Each child gets its own offer/answer pair, exactly as the in-person QR exchange would.
The game is a stand-in: a lockstep loop where the host numbers frames, collects one input per child,
broadcasts the ordered inputs, and every device folds them into a digest.

The signalling bundle is **not** the raw SDP. The spike rebuilds a data-channel-only SDP from a
template, so only ICE ufrag and pwd, the DTLS fingerprint and the candidates travel.

## Measured (Linux, headless Chromium, single machine, loopback and one LAN interface)

| Question                                         | Result                                                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw SDP size, offer / answer                     | about 560-590 characters each; gzip + base64 does not help (about the same size)                                                                                            |
| Compact bundle (template rebuild), offer/answer  | **244 / 243 characters** with mDNS candidates; **208 / 208** with plain IPs. The rebuilt SDP connected every time, so the template is sufficient for a data-channel session |
| QR frames per bundle                             | 1 frame at every payload size tried (300, 600, 1000, 2000 characters per frame)                                                                                             |
| Pairing time per child (answer accepted to open) | 126-149 ms; three children in about 0.6 s of machine time (excludes human scanning)                                                                                         |
| Lockstep, 300 ticks, 3 and 4 children            | all devices ended with the **same digest** in both runs; tick round trip p50 4.1 ms, p95 4.2 ms, max 8.4 ms on loopback                                                     |
| Host decides for an absent child                 | with a 150 ms per-tick wait, 60 of 60 ticks used the host's safe "no input"; the other devices still agreed on the digest                                                   |
| Browser notices a vanished child (tab killed)    | **about 5.7 s** after the close (ICE disconnect), not instant and not 30 s                                                                                                  |
| Recovery of that child                           | a fresh offer/answer pair connected in 126-142 ms. There is no silent resume, which matches the ADR                                                                         |
| mDNS host candidates (`xxxx.local`)              | present by default; both children and host connected anyway because they share one browser process (see limits). With obfuscation off the bundle carries plain IPs          |

## What this does not answer (still open for the real gate)

1. **Real devices.** No iOS Safari, no Android Chrome, no tablet. Candidate handling, `.local`
   resolution and data-channel behaviour differ by browser and OS version.
2. **mDNS across devices.** Here the `.local` names resolve inside one browser process. On a LAN they
   need working multicast between the devices; many school networks drop it. This is the highest
   risk to the ADR and only a cross-device run can settle it.
3. **Wi-Fi client isolation** and **hotspot**: not reproducible on one machine. Expect failure on
   isolated networks; the UI must say so (ADR) and the mailbox/TURN fallback stays optional.
4. **Camera and QR.** The bundle is small enough for one QR, but scanning quality, camera permission
   prompts and the denied-permission path were not measured. `deploy/web/security-headers.conf` sends
   `Permissions-Policy: camera=()`; scanning needs `camera=(self)` scoped to the scan route only
   (separate `location` in nginx), plus HTTPS. Pair by copy/paste of the same string as the supervised
   fallback.
5. **The real runtime.** The stand-in game proves ordering and digest agreement over the transport,
   not that `@agorix/runtime` produces identical worlds on tablets. The runtime still replays a
   finite event list; an incremental lockstep entry point is F3 implementation work.
6. **More than one candidate.** The test machine exposed one host candidate. Phones and tablets
   usually expose IPv4 and IPv6 and sometimes several interfaces, so real bundles will be larger. By
   estimate (not measured), ten candidates would stay near 1,100 characters, still one or two QR frames.

## Findings that change the F3 design

- Use the compact bundle, not raw SDP; it halves the size and fits one QR.
- A vanished child is only reported after about 5.7 s, so the host must not wait per tick that long.
  Mark a child absent after a few missed frames (for example 3 at 150 ms), apply the safe action, pause
  and tell the organizer, instead of stalling every tick.
- Keep reconnect as a new pairing (about 130 ms) with organizer approval; the spike confirms it is cheap.
- Digest agreement per frame is trivial to compute and detected no divergence; keep it as the resync
  trigger.

## Run it on real devices

1. On a laptop on the same Wi-Fi/hotspot: `node spikes/webrtc-lan/serve.mjs`.
2. Open `http://<laptop LAN address>:8787/` on the host (laptop) and each tablet.
3. Host: "I am the host", "New offer", copy the string to the tablet. Tablet: "I am a guest", paste,
   "Join", copy its answer back to the host, "Accept answer". Repeat per tablet.
4. Host: "Start 300-tick lockstep". The log shows every guest digest next to the host's.
5. Record per device: browser and version, network type (home Wi-Fi, hotspot, isolated school Wi-Fi),
   whether the offer shows `mDNS=true`, whether pairing opened, and the digest line. Repeat once with a
   tablet on cellular and once with Wi-Fi client isolation on, to see the failure.

## Recommendation

The ADR's transport is **viable at the protocol level**: offline pairing works, bundles fit one QR,
lockstep stays in agreement, loss and recovery are safe and cheap. It is **not proven** for the
product, because the decisive risks (cross-device mDNS, isolated networks, tablet browsers, camera)
need real devices. Do not start F3 implementation until the checklist above is run on at least one
iOS and one Android tablet. If `.local` candidates fail across devices on the target networks, the
fallback is the optional signalling mailbox with host candidates reported as plain IPs, which the
ADR already accepts behind a privacy review.
