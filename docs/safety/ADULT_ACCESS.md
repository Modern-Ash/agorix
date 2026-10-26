# Access to the grown-ups area (threat model)

Issue #599, epic #580. Applies to the **Adultos** screen of Agorix Kids.

## What the screen protects

Settings that shape a child's experience (Ori suggestions, read-aloud, daily limit, age band, which
images and sounds are allowed), the progress summary, the AI status, and the panels for linking a
device and for groups. It holds **no password, no account secret and no payment**; account actions
(linking a device, groups, sharing) always ask the adult's own account sign-in on the server.

## Who we defend against, and who we do not

| Person                                  | Goal we assume                | Defended?                                                    |
| --------------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| A young child tapping around            | Open the settings by accident | Yes                                                          |
| A child who watched an adult enter it   | Repeat what they saw          | Partly                                                       |
| An older child with the unlocked device | Change a limit on purpose     | Partly                                                       |
| Anyone with browser developer tools     | Clear the stored data         | **No**                                                       |
| A remote attacker                       | Reach the screen              | n/a: the screen is local and has no server action of its own |

This is a **speed bump kept on the device, not authentication**. Nothing that needs real trust relies
on it.

## How it works

- **First use.** A fresh calculation (a two-digit number times a one-digit number, different every
  time) must be solved; a wrong answer changes the question, so an answer cannot be learned. Then the
  adult chooses a PIN of 4 to 6 digits and repeats it. Obvious PINs (all the same digit, a straight
  run up or down) and short or non-numeric PINs are refused with a reason.
- **Storage.** Only a salted PBKDF2-SHA-256 hash (100,000 iterations, random 16-byte salt) is kept in
  `agorix.kids.adultpin.v1`, with a counter of wrong tries and a "locked until" time. The PIN itself is
  never stored, logged or sent anywhere. A browser that cannot hash (no secure context) keeps only the
  calculation and no PIN.
- **Wrong tries.** Five wrong tries in a row make the keys wait 30 seconds; each further wrong try
  doubles the wait up to 15 minutes. While waiting even the right PIN is not accepted. The counter
  resets on a correct PIN.
- **Forgotten PIN.** "Me olvidé el PIN" asks for a fresh calculation and a new PIN. It needs no
  network, so the device stays usable offline.
- **Leaving.** **Salir** returns to the door and forgets every step in memory.

## Residual risks, stated plainly

1. Clearing site data removes the PIN, after which the first-use calculation applies again. An older
   child can do that; the data is then lost for them too.
2. The forgotten-PIN path lets someone who can do the calculation set a new PIN. This is the price of
   working offline without an account. The calculation is random each time and is not shown to be
   guessable.
3. The wait only slows guessing on this device; an offline brute force of the stored hash needs access
   to the browser storage, which already defeats the purpose.
4. Over-the-shoulder observation of a PIN is possible; the adult can change it from the same flow.

## What changed from the old gate

The previous screen asked a fixed question ("¿Cuánto es 7 + 5?") with the answer in the page's own
test and copy: the same answer every time, for everyone, with no limit on tries. It was a puzzle,
not an access control, and it is gone. No page, test or document now treats a puzzle as authentication.

## Tests

`kidsAdultPin.test.ts` covers PIN validation, hashing without the PIN, wrong-try counting, the growing
wait, and a damaged record. `kids-adult-access.spec.ts` covers the first-use flow, refusals, reload,
wait with the right PIN, the forgotten-PIN reset, accessibility and 44 px keys. Every other Kids test
that opens the grown-ups area goes through the same flow (`passAdultGate`).
