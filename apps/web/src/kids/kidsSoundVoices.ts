import type { SoundParameters } from "./kidsSoundLibrary.js";

/**
 * Synthesis recipes layered over the base oscillator sweep so each preset sounds like its name:
 * melodies, overtones, vibrato and filtered noise instead of one plain beep. Original synthesis,
 * no recordings. Anything listed here overrides the same field of the base parameters.
 */
export type SoundVoice = Partial<SoundParameters>;

const noise = (
  filter: BiquadFilterType,
  startHz: number,
  endHz: number,
  q: number,
  attack: number,
  gain: number,
): SoundVoice => ({ gain, noise: { filter, startHz, endHz, q, attack } });
const vib = (hz: number, depth: number): Pick<SoundParameters, "vibrato"> => ({
  vibrato: { hz, depth },
});
const BELL = [1, 2.76, 5.4];

export const KIDS_SOUND_VOICES: Readonly<Record<string, SoundVoice>> = {
  // Core
  bell: { startHz: 880, endHz: 880, duration: 0.5, partials: BELL },
  drum: { wave: "sine", startHz: 160, endHz: 45, duration: 0.22, gain: 0.14 },
  whoosh: { ...noise("bandpass", 250, 2200, 1.2, 0.18, 0.12), duration: 0.45 },
  win: { wave: "triangle", duration: 0.5, gain: 0.08, notes: [523, 659, 784, 1047] },
  oops: { wave: "triangle", duration: 0.45, gain: 0.09, notes: [392, 349, 311, 262] },
  chirp: { duration: 0.28, gain: 0.06, notes: [1400, 2000, 1600, 2300] },
  splash: { ...noise("highpass", 3500, 900, 0.7, 0, 0.14), duration: 0.4 },
  sparkle: { duration: 0.45, notes: [1319, 1568, 2093, 1760, 2637], partials: [1, 2] },
  jump: { wave: "sine", startHz: 180, endHz: 720, duration: 0.2, gain: 0.09 },
  step: { ...noise("lowpass", 700, 180, 0.8, 0, 0.22), duration: 0.09 },
  laser: { wave: "square", startHz: 1800, endHz: 180, duration: 0.25, gain: 0.03 },
  // Nature
  rain: noise("highpass", 4000, 3000, 0.5, 0.05, 0.05),
  wind: noise("bandpass", 300, 700, 1, 0.2, 0.12),
  thunder: noise("lowpass", 400, 60, 0.7, 0.02, 0.4),
  wave: noise("lowpass", 300, 1200, 0.8, 0.2, 0.25),
  bubble: { notes: [300, 600, 900], duration: 0.14 },
  cricket: { ...vib(40, 600), duration: 0.3 },
  leaf: noise("highpass", 2500, 1500, 0.6, 0.03, 0.08),
  fire: noise("bandpass", 900, 500, 0.8, 0.05, 0.2),
  drip: { notes: [1500, 800], duration: 0.12 },
  // Animals
  bird: { notes: [1500, 2200, 1700, 2400], duration: 0.24 },
  cat: { notes: [500, 800, 700, 450], duration: 0.45, partials: [1, 2], ...vib(6, 30) },
  dog: { startHz: 400, endHz: 200, partials: [1, 2] },
  frog: { ...vib(30, 120), duration: 0.3 },
  duck: { partials: [1, 1.5], ...vib(25, 60) },
  cow: { partials: [1, 2, 3], ...vib(5, 8) },
  owl: { notes: [420, 320, 420], duration: 0.5 },
  mouse: { ...vib(18, 300), duration: 0.14 },
  bee: { partials: [1, 2], ...vib(60, 20) },
  horse: { partials: [1, 2], ...vib(14, 120) },
  // Vehicles
  car: { partials: [1, 2, 3], ...vib(25, 8) },
  horn: { partials: [1, 1.26] },
  train: { notes: [330, 277], partials: [1, 1.26] },
  plane: noise("bandpass", 400, 1200, 0.5, 0.25, 0.14),
  boat: { partials: [1, 2, 3] },
  bike: { partials: BELL },
  rocket: noise("lowpass", 200, 2500, 0.6, 0.1, 0.3),
  siren: { notes: [600, 900, 600, 900] },
  engine: { partials: [1, 2], ...vib(30, 15) },
  // Magic
  magic: { notes: [800, 1000, 1300, 1800], partials: [1, 2] },
  wand: { notes: [1000, 1250, 1500, 2000] },
  potion: { notes: [300, 500, 400, 700], ...vib(12, 40) },
  portal: { partials: [1, 1.5], ...vib(20, 80) },
  spell: { notes: [500, 700, 900, 1500] },
  twinkle: { notes: [2000, 2600, 2300, 3000], duration: 0.3 },
  shrink: { partials: [1, 2] },
  grow: { partials: [1, 2] },
  ghost: { partials: [1, 1.5], ...vib(5, 40) },
  // Interface
  click: noise("highpass", 3000, 2000, 0.8, 0, 0.12),
  tap: noise("lowpass", 900, 300, 0.8, 0, 0.2),
  switch: { notes: [600, 1200] },
  ding: { partials: BELL },
  dong: { partials: [1, 2, 3] },
  notify: { notes: [900, 1200] },
  error: { notes: [220, 160] },
  success: { notes: [520, 660, 780, 1040] },
  // Actions
  coin: { notes: [990, 1480] },
  bounce: vib(25, 80),
  spin: vib(20, 60),
  slide: noise("bandpass", 1500, 400, 0.8, 0.05, 0.1),
  throw: noise("bandpass", 400, 1400, 0.8, 0.08, 0.18),
  catch: noise("lowpass", 900, 250, 0.8, 0, 0.2),
  land: noise("lowpass", 400, 80, 0.8, 0, 0.35),
  swing: noise("bandpass", 300, 900, 0.8, 0.15, 0.16),
  // Effects
  clap: noise("bandpass", 1500, 1200, 0.8, 0, 0.2),
  boom: noise("lowpass", 300, 50, 0.7, 0, 0.5),
  zap: vib(80, 200),
  buzz: { partials: [1, 2], ...vib(50, 10) },
  squeak: vib(15, 250),
  robot: { notes: [300, 450, 300, 380, 450] },
  alien: { partials: [1, 1.5], ...vib(12, 150) },
  // Music
  piano: { partials: [1, 2, 3, 4] },
  flute: { partials: [1, 2], ...vib(5, 10) },
  guitar: { partials: [1, 2, 3, 4] },
  xylophone: { partials: [1, 3.9] },
  trumpet: { partials: [1, 2, 3], ...vib(5, 5) },
  cymbal: noise("highpass", 6000, 5000, 0.5, 0, 0.1),
  snare: noise("bandpass", 2000, 1200, 0.8, 0, 0.2),
  tada: { notes: [392, 523, 784] },
};

export function voiced(id: string, base: SoundParameters): SoundParameters {
  return { ...base, ...KIDS_SOUND_VOICES[id.replace(/^kids:/, "")] };
}
