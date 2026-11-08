import type { Locale } from "../i18n.js";
import type { BlockFieldKey } from "./kidsBlockProperties.js";

/**
 * What Ori says when the learner asks about the property being edited. Deterministic and local:
 * it names the property and what it does, never the learner's values or typed text, and it sends
 * nothing anywhere. The learner decides what to change; Ori only explains and challenges.
 */
export type PropertySubject =
  | { readonly kind: "block"; readonly fields: readonly BlockFieldKey[] }
  | { readonly kind: "backdrop" }
  | { readonly kind: "actor" };

const FIELD: Record<Locale, Record<BlockFieldKey, string>> = {
  es: {
    steps:
      "Casillas es cuánto avanza el objeto: cada casilla es un paso en el escenario. Probá un número distinto y fijate qué cambia al ejecutar.",
    degrees:
      "Grados es cuánto gira. 90 es un cuarto de vuelta y 360 es una vuelta entera. ¿Cuántos grados necesitás para mirar hacia donde querés?",
    seconds:
      "Segundos es cuánto espera el programa antes del próximo bloque. Un número chico es una pausa corta; uno grande, una pausa larga.",
    count:
      "Veces es cuántas veces se repite lo que está adentro del bloque. Cambialo y contá cuántas veces pasa en el escenario.",
    size: "Tamaño es qué tan grande se ve el objeto: 100 es el tamaño normal. ¿Qué pasa con 50 y con 200?",
    delta:
      "Cambio suma o resta tamaño cada vez que corre el bloque. Si lo repetís, el objeto va creciendo o achicándose de a poco.",
    soundId:
      "Sonido es el que suena cuando llega este bloque. Elegí uno y ejecutá el programa para escucharlo en el momento justo.",
    costumeId:
      "Disfraz es la apariencia que toma el objeto cuando llega este bloque. Elegí uno y mirá el cambio en el escenario.",
    text: "Texto es lo que dice o piensa el objeto en su globo. Escribí algo corto y ejecutá para verlo.",
  },
  en: {
    steps:
      "Cells is how far the sprite moves: each cell is one step on the stage. Try a different number and see what changes when you run.",
    degrees:
      "Degrees is how much it turns. 90 is a quarter turn and 360 is a full circle. How many degrees do you need to face where you want?",
    seconds:
      "Seconds is how long the program waits before the next block. A small number is a short pause; a big one, a long pause.",
    count:
      "Times is how many times the blocks inside repeat. Change it and count how many times it happens on the stage.",
    size: "Size is how big the sprite looks: 100 is normal size. What happens with 50 and with 200?",
    delta:
      "Change adds or removes size each time the block runs. If you repeat it, the sprite slowly grows or shrinks.",
    soundId:
      "Sound is what plays when this block runs. Pick one and run the program to hear it at the right moment.",
    costumeId:
      "Costume is the look the sprite takes when this block runs. Pick one and watch the change on the stage.",
    text: "Text is what the sprite says or thinks in its bubble. Write something short and run to see it.",
  },
};

const BACKDROP = {
  es: "El fondo es la imagen de toda la escena y no mueve a los personajes. Elegí uno que cuente dónde pasa tu historia.",
  en: "The backdrop is the picture behind the whole scene and does not move the characters. Pick one that tells where your story happens.",
};

const ACTOR = {
  es: "x e y dicen dónde está el objeto en el escenario, y Dirección y Tamaño cómo se ve. Cambiá un valor y fijate cuál se mueve.",
  en: "x and y say where the sprite is on the stage, and Direction and Size how it looks. Change one value and see which one moves.",
};

export function propertyHelp(subject: PropertySubject, locale: Locale): string {
  if (subject.kind === "backdrop") return BACKDROP[locale];
  if (subject.kind === "actor") return ACTOR[locale];
  return subject.fields.map((key) => FIELD[locale][key]).join(" ");
}
