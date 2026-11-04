import type { Statement } from "@agorix/program-model";
import type { Locale } from "../i18n.js";
import { KIDS_GALLERY_CHARACTERS } from "./kidsGallery.js";
import { KIDS_CUSTOM_SOUND_ID, KIDS_SOUNDS } from "./kidsSoundLibrary.js";
import {
  STUDIO_BUBBLE_MAX_LENGTH,
  STUDIO_REPEAT_COUNTS,
  STUDIO_SIZES,
  STUDIO_SIZE_DELTAS,
  STUDIO_TURN_AMOUNTS,
  STUDIO_WAIT_SECONDS,
} from "./kidsStudioChoices.js";

/**
 * What a child can change on a block already in the program (issue #1240): the same closed lists
 * the palette offers when the block is added, so a value is never on screen without being valid.
 * `setStudioStatementField` re-validates the whole program; this table only says what to show.
 */
export type BlockFieldKey =
  "steps" | "degrees" | "seconds" | "count" | "size" | "delta" | "soundId" | "costumeId" | "text";

export type BlockField =
  | {
      readonly key: BlockFieldKey;
      readonly kind: "choice";
      readonly label: string;
      readonly value: string;
      readonly options: readonly { readonly value: string; readonly label: string }[];
    }
  | {
      readonly key: BlockFieldKey;
      readonly kind: "text";
      readonly label: string;
      readonly value: string;
      readonly maxLength: number;
    };

/** Which field each editable block exposes (a block with none has no properties to edit). */
const FIELD_OF: Partial<Record<Statement["type"], readonly BlockFieldKey[]>> = {
  move: ["steps"],
  turn: ["degrees"],
  wait: ["seconds"],
  repeat: ["count"],
  setSize: ["size"],
  changeSize: ["delta"],
  playSound: ["soundId"],
  switchCostume: ["costumeId"],
  say: ["text"],
  think: ["text"],
};

const LABELS: Record<Locale, Record<BlockFieldKey, string>> = {
  es: {
    steps: "Casillas",
    degrees: "Grados",
    seconds: "Segundos",
    count: "Veces",
    size: "Tamaño (%)",
    delta: "Cambio (%)",
    soundId: "Sonido",
    costumeId: "Disfraz",
    text: "Texto",
  },
  en: {
    steps: "Cells",
    degrees: "Degrees",
    seconds: "Seconds",
    count: "Times",
    size: "Size (%)",
    delta: "Change (%)",
    soundId: "Sound",
    costumeId: "Costume",
    text: "Text",
  },
};

const numbers = (values: readonly number[]) =>
  values.map((value) => ({ value: String(value), label: String(value) }));

export function editableFields(statement: Statement, locale: Locale): readonly BlockField[] {
  const keys = FIELD_OF[statement.type] ?? [];
  const label = (key: BlockFieldKey) => LABELS[locale][key];
  return keys.flatMap((key): BlockField[] => {
    const current = (statement as unknown as Record<string, unknown>)[key];
    switch (key) {
      case "steps": {
        // The palette and the block read in cells of 40 steps; the model accepts any multiple of 20.
        const steps = Array.from({ length: 21 }, (_, index) => (index - 10) * 20).filter(
          (value) => value !== 0,
        );
        return [
          {
            key,
            kind: "choice",
            label: label(key),
            value: String(current),
            options: steps.map((value) => ({ value: String(value), label: String(value / 40) })),
          },
        ];
      }
      case "degrees":
        return [
          {
            key,
            kind: "choice",
            label: label(key),
            value: String(current),
            options: numbers(STUDIO_TURN_AMOUNTS.flatMap((amount) => [amount, -amount])),
          },
        ];
      case "seconds":
        return [
          {
            key,
            kind: "choice",
            label: label(key),
            value: String(current),
            options: numbers(STUDIO_WAIT_SECONDS),
          },
        ];
      case "count":
        return [
          {
            key,
            kind: "choice",
            label: label(key),
            value: String(current),
            options: numbers(STUDIO_REPEAT_COUNTS),
          },
        ];
      case "size":
        return [
          {
            key,
            kind: "choice",
            label: label(key),
            value: String(current),
            options: numbers(STUDIO_SIZES),
          },
        ];
      case "delta":
        return [
          {
            key,
            kind: "choice",
            label: label(key),
            value: String(current),
            options: numbers(STUDIO_SIZE_DELTAS),
          },
        ];
      case "soundId":
        return [
          {
            key,
            kind: "choice",
            label: label(key),
            value: String(current),
            options: KIDS_SOUNDS.filter((sound) => sound.id !== KIDS_CUSTOM_SOUND_ID).map(
              (sound) => ({
                value: sound.id,
                label: sound[locale],
              }),
            ),
          },
        ];
      case "costumeId":
        return [
          {
            key,
            kind: "choice",
            label: label(key),
            value: String(current),
            options: KIDS_GALLERY_CHARACTERS.map((item) => ({
              value: `costume:${item.id}`,
              label: item[locale],
            })),
          },
        ];
      case "text":
        return [
          {
            key,
            kind: "text",
            label: label(key),
            value: String(current),
            maxLength: STUDIO_BUBBLE_MAX_LENGTH,
          },
        ];
    }
  });
}

/** The value as the program stores it: numbers for the numeric fields, text for the others. */
export function parseFieldValue(key: BlockFieldKey, raw: string): number | string {
  return key === "soundId" || key === "costumeId" || key === "text" ? raw : Number(raw);
}
