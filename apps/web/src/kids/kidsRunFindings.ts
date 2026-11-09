import type { Finding } from "@agorix/run-evidence";
import type { Locale } from "../i18n.js";
import type { AgeBand } from "./kidsAgeBand.js";

/**
 * The sentence for a finding, written here and never by a model: the finding is facts from the
 * run, this is the words for them, in the learner's language and age band. The youngest band gets
 * short sentences that say what to do; older bands get the precise counts and the cause.
 */
const KEY_NAMES: Record<Locale, Record<string, string>> = {
  es: {
    Space: "espacio",
    ArrowUp: "flecha ↑",
    ArrowDown: "flecha ↓",
    ArrowLeft: "flecha ←",
    ArrowRight: "flecha →",
  },
  en: {
    Space: "space",
    ArrowUp: "up arrow",
    ArrowDown: "down arrow",
    ArrowLeft: "left arrow",
    ArrowRight: "right arrow",
  },
};

const times = (count: number, locale: Locale): string =>
  locale === "es"
    ? count === 1
      ? "una vez"
      : `${count} veces`
    : count === 1
      ? "once"
      : `${count} times`;

export function findingSentence(finding: Finding, locale: Locale, band: AgeBand): string {
  const es = locale === "es";
  const young = band === "6-8";
  const name = finding.event?.name ?? "";
  const key = KEY_NAMES[locale][name] ?? name;
  const yes = finding.counts["yes"] ?? 0;
  const no = finding.counts["no"] ?? 0;
  switch (finding.kind) {
    case "neverStarted": {
      const event = finding.event;
      if (event?.type === "message") {
        const senders = finding.counts["senders"] ?? 0;
        if (senders === 0)
          return es
            ? young
              ? `Espera el mensaje «${name}», pero nadie lo manda. Mandalo con «Enviar mensaje».`
              : `Este programa empieza cuando llega el mensaje «${name}», pero ningún programa lo envía, así que nunca arrancó.`
            : young
              ? `It waits for the message “${name}”, but nobody sends it. Send it with “Broadcast message”.`
              : `This program starts when the message “${name}” arrives, but no program sends it, so it never started.`;
        return es
          ? young
            ? `Espera el mensaje «${name}». El bloque que lo manda no llegó a correr.`
            : `Espera el mensaje «${name}». Hay un bloque que lo envía, pero no se ejecutó en esta corrida.`
          : young
            ? `It waits for the message “${name}”. The block that sends it did not run.`
            : `It waits for the message “${name}”. A block sends it, but it did not run this time.`;
      }
      if (event?.type === "backdrop")
        return es
          ? young
            ? "Empieza cuando cambia el fondo a ese. Esta vez no cambió a ese."
            : "Este programa empieza cuando el fondo cambia a uno en particular. En esta corrida el fondo no cambió a ese."
          : young
            ? "It starts when the backdrop changes to that one. It did not change to it this time."
            : "This program starts when the backdrop changes to a particular one. The backdrop did not change to it this run.";
      if (event?.type === "key")
        return es
          ? young
            ? `Empieza al apretar ${key}. Esta vez nadie la apretó.`
            : `Este programa empieza al apretar la tecla ${key}. En esta corrida nadie la apretó.`
          : young
            ? `It starts when you press ${key}. Nobody pressed it this time.`
            : `This program starts when the ${key} key is pressed. Nobody pressed it this run.`;
      return es
        ? young
          ? "Empieza cuando lo tocás. Esta vez nadie lo tocó."
          : "Este programa empieza cuando tocás al personaje. En esta corrida nadie lo tocó."
        : young
          ? "It starts when you tap it. Nobody tapped it this time."
          : "This program starts when you tap the character. Nobody tapped it this run.";
    }
    case "messageUnheard": {
      const sent = finding.counts["sent"] ?? 1;
      return es
        ? young
          ? `Mandaste «${name}», pero nadie lo escucha. Hacé que un personaje lo reciba.`
          : `El mensaje «${name}» se mandó ${times(sent, locale)}, pero ningún personaje lo escucha.`
        : young
          ? `You sent “${name}”, but nobody listens. Make a character receive it.`
          : `The message “${name}” was sent ${times(sent, locale)}, but no character listens to it.`;
    }
    case "conditionNeverTrue":
      return es
        ? young
          ? no > 1
            ? `El «Si» preguntó ${times(no, locale)} y siempre dijo que no. Por eso no hizo lo de adentro.`
            : "El «Si» preguntó y dijo que no. Por eso no hizo lo de adentro."
          : `La condición del «Si» se revisó ${times(no, locale)} y nunca fue verdadera: los bloques de adentro no corrieron.`
        : young
          ? no > 1
            ? `The “If” asked ${times(no, locale)} and always said no. That is why it did not do what is inside.`
            : "The “If” asked and said no. That is why it did not do what is inside."
          : `The “If” condition was checked ${times(no, locale)} and was never true: the blocks inside did not run.`;
    case "conditionNeverFalse":
      return es
        ? young
          ? `El «Si» siempre dijo que sí (${times(yes, locale)}).`
          : `La condición del «Si» se revisó ${times(yes, locale)} y siempre fue verdadera.`
        : young
          ? `The “If” always said yes (${times(yes, locale)}).`
          : `The “If” condition was checked ${times(yes, locale)} and was always true.`;
    case "hiddenCharacter": {
      const actions = finding.counts["actions"] ?? 1;
      return es
        ? young
          ? "El personaje se escondió, por eso no se ve nada. Agregá «Mostrar»."
          : `El programa hizo ${actions} ${actions === 1 ? "cosa" : "cosas"} con el personaje, pero terminó escondido: por eso no se ve. Falta un «Mostrar».`
        : young
          ? "The character hid, so nothing shows. Add “Show”."
          : `The program did ${actions} ${actions === 1 ? "thing" : "things"} with the character, but it ended hidden, so nothing shows. A “Show” is missing.`;
    }
    case "soundSilent": {
      const played = finding.counts["played"] ?? 1;
      return es
        ? young
          ? "El sonido sonó con el volumen en 0, por eso no se oye."
          : `El sonido se reprodujo ${times(played, locale)} con el volumen en 0, así que no se escucha. Subí el volumen antes del sonido.`
        : young
          ? "The sound played with the volume at 0, so you cannot hear it."
          : `The sound played ${times(played, locale)} with the volume at 0, so it cannot be heard. Turn the volume up before the sound.`;
    }
    case "workingAgainstEachOther":
      return es
        ? young
          ? "Dos programas del personaje lo empujan para lados distintos, por eso queda en el mismo lugar."
          : "Dos programas de este personaje lo mueven en direcciones opuestas y se cancelan: termina donde empezó."
        : young
          ? "Two programs of the character push it in different directions, so it stays in the same place."
          : "Two programs of this character move it in opposite directions and cancel out: it ends where it began.";
    case "repeatedBlocks": {
      const period = finding.counts["period"] ?? 1;
      const times = finding.counts["times"] ?? 3;
      return es
        ? young
          ? period === 1
            ? `Escribiste el mismo bloque ${times} veces seguidas. Con «Repetir» alcanza uno solo.`
            : `Escribiste los mismos ${period} bloques ${times} veces seguidas. «Repetir» los hace por vos.`
          : period === 1
            ? `Hay un bloque escrito ${times} veces seguidas: un «Repetir» hace lo mismo con menos bloques.`
            : `Hay un grupo de ${period} bloques escrito ${times} veces seguidas: un «Repetir» lo deja con una sola copia.`
        : young
          ? period === 1
            ? `You wrote the same block ${times} times in a row. One “Repeat” is enough.`
            : `You wrote the same ${period} blocks ${times} times in a row. “Repeat” does it for you.`
          : period === 1
            ? `A block is written ${times} times in a row: a “Repeat” does the same with fewer blocks.`
            : `A group of ${period} blocks is written ${times} times in a row: a “Repeat” leaves a single copy.`;
    }
    case "repeatedApart": {
      const period = finding.counts["period"] ?? 2;
      const times = finding.counts["times"] ?? 3;
      return es
        ? young
          ? `Estos ${period} bloques vuelven una y otra vez. Podés hacer un bloque propio en «Mis bloques».`
          : `Un grupo de ${period} bloques aparece ${times} veces en tu programa. Un bloque propio, en «Mis bloques», lo deja escrito una sola vez.`
        : young
          ? `These ${period} blocks keep coming back. You can make a block of your own in “My blocks”.`
          : `A group of ${period} blocks appears ${times} times in your program. A block of your own, in “My blocks”, writes it once.`;
    }
    case "loopNeverEnds": {
      const passes = finding.counts["passes"] ?? 0;
      return es
        ? young
          ? "Este bucle no termina nunca. Dale una salida para que el programa pare."
          : `Este bucle no tiene un final: corrió ${passes} pasos y el programa tuvo que cortarlo.`
        : young
          ? "This loop never ends. Give it a way out so the program can stop."
          : `This loop has no end: it ran ${passes} steps and the program had to cut it off.`;
    }
    case "predictionMismatch":
      return es
        ? young
          ? "Lo que pensaste y lo que pasó no fueron iguales. Tocá Paso para ver qué hizo cada bloque."
          : "Tu idea y lo que pasó no coincidieron. Usá Paso para ver qué hizo cada bloque."
        : young
          ? "What you thought and what happened were not the same. Tap Step to see what each block did."
          : "Your idea and what happened did not match. Use Step to see what each block did.";
  }
}

/** The top-level block a finding is about, to point at it in the program. */
export function findingBlockIndex(finding: Finding): number | null {
  const match = /^scripts\[\d+\]\/statements\[(\d+)\]/.exec(finding.nodeIds[0] ?? "");
  return match ? Number(match[1]) : null;
}

export function findingScriptIndex(finding: Finding): number | null {
  const match = /^scripts\[(\d+)\]/.exec(finding.nodeIds[0] ?? "");
  return match ? Number(match[1]) : null;
}
