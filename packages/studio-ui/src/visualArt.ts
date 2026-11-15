import {
  galleryBackdropArt,
  galleryCharacterArt,
  isGalleryBackdropId,
  isGalleryCharacterId,
} from "@agorix/stage";
import type { AssetView } from "@agorix/studio-protocol";
import { validEmbeddedImageSource } from "@agorix/program-model";

/** Only bundled gallery art or bounded project PNG/WebP data may enter an image element. */
export function imageForAsset(asset: AssetView | undefined): string | undefined {
  if (asset === undefined) return undefined;
  const source = asset.source;
  if (source?.startsWith("builtin:kids-gallery-costume:")) {
    const id = source.slice("builtin:kids-gallery-costume:".length);
    return isGalleryCharacterId(id) ? galleryCharacterArt(id) : undefined;
  }
  if (source?.startsWith("builtin:kids-gallery-backdrop:")) {
    const id = source.slice("builtin:kids-gallery-backdrop:".length);
    return isGalleryBackdropId(id) ? galleryBackdropArt(id) : undefined;
  }
  if (source !== undefined && validEmbeddedImageSource(source)) {
    return source;
  }
  if (asset.id === "asset:costume.default") return galleryCharacterArt("nova");
  if (asset.id === "asset:costume.spark") return galleryCharacterArt("luma");
  if (asset.id === "asset:space.trailhead") return galleryBackdropArt("moon");
  if (asset.id === "asset:space.nebula") return galleryBackdropArt("galaxy");
  return undefined;
}

export function imageForId(
  id: string | undefined,
  assets: readonly AssetView[],
): string | undefined {
  if (id === undefined) return undefined;
  const asset = assets.find((item) => item.id === id);
  if (asset !== undefined) return imageForAsset(asset);
  if (id === "asset:costume.default") return galleryCharacterArt("nova");
  if (id === "asset:costume.spark") return galleryCharacterArt("luma");
  if (id === "asset:space.trailhead") return galleryBackdropArt("moon");
  if (id === "asset:space.nebula") return galleryBackdropArt("galaxy");
  if (id.startsWith("costume:")) {
    const character = id.slice("costume:".length);
    return isGalleryCharacterId(character) ? galleryCharacterArt(character) : undefined;
  }
  if (id.startsWith("backdrop:")) {
    const backdrop = id.slice("backdrop:".length);
    return isGalleryBackdropId(backdrop) ? galleryBackdropArt(backdrop) : undefined;
  }
  return undefined;
}
