import type { SoundParameters } from "./kidsSoundLibrary.js";

export type KidsSoundCategory =
  "effects" | "music" | "nature" | "actions" | "animals" | "vehicles" | "magic" | "interface";

type Wave = SoundParameters["wave"];
/** id, Spanish name, English name, category, wave, start Hz, end Hz, seconds, gain. */
type Row = readonly [
  string,
  string,
  string,
  KidsSoundCategory,
  Wave,
  number,
  number,
  number,
  number,
];

/**
 * Original synthesized presets written for Agorix: no recordings, so there is no third-party
 * licence to audit and everything plays offline. Each one is a single bounded oscillator sweep.
 */
const ROWS: readonly Row[] = [
  ["rain", "Lluvia", "Rain", "nature", "sawtooth", 3000, 2400, 0.4, 0.012],
  ["wind", "Viento", "Wind", "nature", "sawtooth", 260, 180, 0.5, 0.02],
  ["thunder", "Trueno", "Thunder", "nature", "sawtooth", 90, 40, 0.5, 0.08],
  ["wave", "Ola", "Wave", "nature", "sine", 200, 520, 0.5, 0.04],
  ["bubble", "Burbuja", "Bubble", "nature", "sine", 400, 900, 0.12, 0.06],
  ["cricket", "Grillo", "Cricket", "nature", "square", 4200, 4200, 0.12, 0.015],
  ["leaf", "Hoja", "Leaf", "nature", "triangle", 1800, 900, 0.15, 0.025],
  ["fire", "Fuego", "Fire", "nature", "sawtooth", 700, 300, 0.4, 0.02],
  ["drip", "Gota", "Drip", "nature", "sine", 1200, 500, 0.1, 0.06],
  ["bird", "Pájaro", "Bird", "animals", "sine", 1500, 2300, 0.12, 0.05],
  ["cat", "Gato", "Cat", "animals", "triangle", 700, 450, 0.4, 0.06],
  ["dog", "Perro", "Dog", "animals", "square", 300, 180, 0.16, 0.04],
  ["frog", "Rana", "Frog", "animals", "square", 160, 240, 0.18, 0.04],
  ["duck", "Pato", "Duck", "animals", "sawtooth", 520, 380, 0.2, 0.035],
  ["cow", "Vaca", "Cow", "animals", "sawtooth", 140, 100, 0.5, 0.06],
  ["owl", "Búho", "Owl", "animals", "sine", 420, 360, 0.45, 0.06],
  ["mouse", "Ratón", "Mouse", "animals", "sine", 2600, 3200, 0.1, 0.04],
  ["bee", "Abeja", "Bee", "animals", "sawtooth", 230, 250, 0.45, 0.03],
  ["horse", "Caballo", "Horse", "animals", "sawtooth", 500, 900, 0.35, 0.04],
  ["car", "Auto", "Car", "vehicles", "sawtooth", 110, 220, 0.5, 0.05],
  ["horn", "Bocina", "Horn", "vehicles", "square", 380, 380, 0.3, 0.04],
  ["train", "Tren", "Train", "vehicles", "triangle", 330, 280, 0.5, 0.06],
  ["plane", "Avión", "Plane", "vehicles", "sawtooth", 150, 500, 0.5, 0.03],
  ["boat", "Barco", "Boat", "vehicles", "sine", 120, 90, 0.5, 0.08],
  ["bike", "Timbre de bici", "Bike bell", "vehicles", "sine", 2400, 2400, 0.3, 0.04],
  ["rocket", "Cohete", "Rocket", "vehicles", "sawtooth", 80, 700, 0.5, 0.04],
  ["siren", "Sirena", "Siren", "vehicles", "sine", 600, 900, 0.5, 0.05],
  ["engine", "Motor", "Engine", "vehicles", "square", 70, 120, 0.45, 0.04],
  ["magic", "Magia", "Magic", "magic", "sine", 800, 1800, 0.45, 0.05],
  ["wand", "Varita", "Wand", "magic", "triangle", 1000, 2000, 0.3, 0.05],
  ["potion", "Poción", "Potion", "magic", "sine", 300, 700, 0.45, 0.06],
  ["portal", "Portal", "Portal", "magic", "sine", 1400, 200, 0.5, 0.05],
  ["spell", "Hechizo", "Spell", "magic", "triangle", 500, 1500, 0.4, 0.05],
  ["twinkle", "Estrellita", "Twinkle", "magic", "sine", 2000, 2600, 0.2, 0.04],
  ["shrink", "Achicar", "Shrink", "magic", "sine", 900, 200, 0.3, 0.06],
  ["grow", "Agrandar", "Grow", "magic", "sine", 200, 900, 0.3, 0.06],
  ["ghost", "Fantasma", "Ghost", "magic", "sine", 500, 300, 0.5, 0.05],
  ["click", "Clic", "Click", "interface", "square", 1500, 900, 0.04, 0.04],
  ["tap", "Toque", "Tap", "interface", "sine", 800, 600, 0.06, 0.07],
  ["switch", "Interruptor", "Switch", "interface", "square", 600, 1200, 0.06, 0.04],
  ["ding", "Ding", "Ding", "interface", "sine", 1320, 1320, 0.3, 0.06],
  ["dong", "Dong", "Dong", "interface", "sine", 660, 660, 0.4, 0.07],
  ["notify", "Aviso", "Notice", "interface", "sine", 900, 1200, 0.2, 0.06],
  ["error", "Error", "Error", "interface", "square", 220, 160, 0.25, 0.04],
  ["success", "Logrado", "Success", "interface", "triangle", 520, 1040, 0.3, 0.06],
  ["coin", "Moneda", "Coin", "actions", "square", 990, 1480, 0.18, 0.04],
  ["bounce", "Rebote", "Bounce", "actions", "sine", 300, 600, 0.2, 0.07],
  ["spin", "Giro", "Spin", "actions", "triangle", 400, 1200, 0.3, 0.05],
  ["slide", "Deslizar", "Slide", "actions", "sawtooth", 800, 300, 0.3, 0.03],
  ["throw", "Lanzar", "Throw", "actions", "triangle", 250, 700, 0.2, 0.06],
  ["catch", "Atrapar", "Catch", "actions", "sine", 700, 350, 0.12, 0.07],
  ["land", "Aterrizar", "Land", "actions", "triangle", 180, 80, 0.15, 0.09],
  ["swing", "Balanceo", "Swing", "actions", "sine", 320, 480, 0.4, 0.06],
  ["clap", "Aplauso", "Clap", "effects", "square", 1800, 700, 0.06, 0.04],
  ["boom", "Boom", "Boom", "effects", "sawtooth", 120, 40, 0.45, 0.09],
  ["zap", "Chispa", "Zap", "effects", "sawtooth", 2400, 400, 0.15, 0.03],
  ["buzz", "Zumbido", "Buzz", "effects", "square", 180, 180, 0.4, 0.03],
  ["squeak", "Chirrido", "Squeak", "effects", "sine", 1800, 2800, 0.1, 0.05],
  ["robot", "Robot", "Robot", "effects", "square", 300, 450, 0.25, 0.04],
  ["alien", "Alienígena", "Alien", "effects", "sine", 900, 400, 0.45, 0.05],
  ["piano", "Piano", "Piano", "music", "triangle", 523, 523, 0.5, 0.08],
  ["flute", "Flauta", "Flute", "music", "sine", 880, 880, 0.5, 0.06],
  ["guitar", "Guitarra", "Guitar", "music", "triangle", 330, 320, 0.5, 0.08],
  ["xylophone", "Xilófono", "Xylophone", "music", "sine", 1047, 1040, 0.3, 0.07],
  ["trumpet", "Trompeta", "Trumpet", "music", "sawtooth", 466, 466, 0.4, 0.03],
  ["cymbal", "Platillo", "Cymbal", "music", "square", 5000, 4000, 0.5, 0.012],
  ["snare", "Redoblante", "Snare", "music", "square", 400, 200, 0.12, 0.05],
  ["tada", "Tada", "Ta-da", "music", "triangle", 392, 784, 0.45, 0.06],
];

export const KIDS_EXTRA_SOUNDS = ROWS.map(
  ([slug, es, en, category, wave, startHz, endHz, duration, gain]) => ({
    id: `kids:${slug}`,
    es,
    en,
    category,
    parameters: { wave, startHz, endHz, duration, gain } satisfies SoundParameters,
  }),
);
