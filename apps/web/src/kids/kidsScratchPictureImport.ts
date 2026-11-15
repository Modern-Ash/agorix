import type { Locale } from "../i18n.js";
import { ProjectStore } from "@agorix/persistence";
import { KidsImageError, processKidsImage } from "./kidsImage.js";
import type { ScratchImportResult } from "./kidsScratchImport.js";
import { addStudioArt, selectStudioArt, type StudioStorage } from "./kidsStudioProjects.js";
import { readScratchPictures, type ScratchPictureFile } from "./kidsScratchZip.js";

/** Turns a picture from the `.sb3` into the data URL the project keeps (PNG or WebP, small). */
export type PictureToDataUrl = (file: ScratchPictureFile) => Promise<string>;

/**
 * An SVG is drawn on a canvas on this device and the result goes through the same preparation as
 * any picture a child adds. It is shown through an image element, which never runs a script or
 * loads anything from outside.
 */
async function rasterizeSvg(bytes: Uint8Array): Promise<Blob> {
  const image = new Image();
  image.src = `data:image/svg+xml;base64,${btoa(String.fromCharCode(...bytes))}`;
  await image.decode();
  const side = 512;
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext("2d");
  if (!context) throw new KidsImageError("decodeFailed");
  const scale = Math.min(side / (image.naturalWidth || side), side / (image.naturalHeight || side));
  const width = (image.naturalWidth || side) * scale;
  const height = (image.naturalHeight || side) * scale;
  context.drawImage(image, (side - width) / 2, (side - height) / 2, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob === null) throw new KidsImageError("decodeFailed");
  return blob;
}

export const pictureToDataUrl: PictureToDataUrl = async (file) => {
  if (file.type === "image/svg+xml") return processKidsImage(await rasterizeSvg(file.bytes));
  if (file.type === "image/gif") throw new KidsImageError("unsupportedType");
  return processKidsImage(new Blob([file.bytes as BlobPart], { type: file.type }));
};

export interface PicturesBrought {
  /** Characters and the stage that now wear their Scratch picture. */
  readonly brought: number;
  /** Pictures the project named that could not be brought (missing, too big, or unreadable). */
  readonly left: number;
}

/**
 * Gives each imported character, and the stage, the picture it was wearing in Scratch. Only that
 * one costume per character is brought; the rest are not. Every picture is read from the file
 * with size caps, prepared on the device like any picture a child adds, and kept in the scene
 * as the child's own art. A picture that cannot be brought leaves the gallery character in place.
 */
export async function bringScratchPictures(options: {
  readonly buffer: ArrayBuffer;
  readonly imported: ScratchImportResult;
  readonly sceneId: string;
  readonly locale: Locale;
  readonly store?: ProjectStore;
  readonly storage?: StudioStorage;
  readonly toDataUrl?: PictureToDataUrl;
}): Promise<PicturesBrought> {
  const { imported, sceneId, locale, buffer } = options;
  const store = options.store ?? new ProjectStore();
  const toDataUrl = options.toDataUrl ?? pictureToDataUrl;
  const wanted = [
    ...Object.values(imported.pictures.costumes),
    ...(imported.pictures.backdrop === undefined ? [] : [imported.pictures.backdrop]),
  ];
  const files = new Map(
    (await readScratchPictures(buffer, wanted)).map((file) => [file.name, file] as const),
  );
  const assetOfFile = new Map<string, string>();
  const dataUrlOfFile = new Map<string, string | null>();
  const dataUrl = async (name: string): Promise<string | null> => {
    if (dataUrlOfFile.has(name)) return dataUrlOfFile.get(name)!;
    const file = files.get(name);
    let url: string | null = null;
    if (file !== undefined) {
      try {
        url = await toDataUrl(file);
      } catch {
        url = null;
      }
    }
    dataUrlOfFile.set(name, url);
    return url;
  };

  let brought = 0;
  let left = 0;
  const entries: [string, string, "costume" | "backdrop"][] = [
    ...Object.entries(imported.pictures.costumes).map(
      ([actorId, name]) => [actorId, name, "costume"] as [string, string, "costume" | "backdrop"],
    ),
  ];
  const firstActor = Object.keys(imported.pictures.costumes)[0];
  if (imported.pictures.backdrop !== undefined && firstActor !== undefined)
    entries.push([firstActor, imported.pictures.backdrop, "backdrop"]);
  for (const [actorId, name, kind] of entries) {
    const key = `${kind}:${name}`;
    try {
      let assetId = assetOfFile.get(key);
      if (assetId === undefined) {
        const url = await dataUrl(name);
        if (url === null) {
          left += 1;
          continue;
        }
        assetId = addStudioArt(sceneId, kind, actorId, url, locale, store, options.storage);
        assetOfFile.set(key, assetId);
      }
      selectStudioArt(sceneId, assetId, actorId, locale, store, options.storage);
      brought += 1;
    } catch {
      left += 1;
    }
  }
  return { brought, left };
}
