import { useState, type ChangeEvent } from "react";
import type { Locale } from "../../i18n.js";
import { KidsImageError, processKidsImage } from "../kidsImage.js";
import {
  KIDS_IMAGE_SLOTS,
  clearKidsImages,
  imageStorageBytes,
  loadKidsImages,
  updateKidsImage,
  type KidsImageSlot,
} from "../kidsImages.js";
import { kidsTable, type KidsText } from "../useKidsText.js";
import { deleteKidsCustom, loadKidsCustom } from "../kidsCustom.js";

interface Props {
  readonly locale: Locale;
  readonly t: KidsText;
}

export function KidsImagesPanel({ locale, t }: Props) {
  const [images, setImages] = useState(loadKidsImages);
  const [custom, setCustom] = useState(loadKidsCustom);
  const [message, setMessage] = useState("");
  const worlds = kidsTable(locale, "worlds");
  const used = Math.ceil(imageStorageBytes(images) / 1024);

  function label(slot: KidsImageSlot): string {
    if (slot === "ori") return "Ori";
    if (slot.startsWith("explorer:")) return t("explorerImage", { avatar: slot.slice(9) });
    return t("worldImage", { world: worlds[slot.slice(6)] ?? slot.slice(6) });
  }

  function showSaveFailure(
    reason: "invalidSlot" | "invalidImage" | "tooLarge" | "storageUnavailable",
  ) {
    setMessage(
      t(
        reason === "tooLarge"
          ? "imageErrorSize"
          : reason === "storageUnavailable"
            ? "imageErrorQuota"
            : "imageErrorType",
      ),
    );
  }

  async function choose(slot: KidsImageSlot, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processKidsImage(file);
      const saved = updateKidsImage(slot, dataUrl);
      if (!saved.ok) return showSaveFailure(saved.reason);
      setImages(saved.images);
      setMessage(t("imageSaved"));
    } catch (error) {
      const code = error instanceof KidsImageError ? error.code : "decodeFailed";
      setMessage(
        t(
          code === "unsupportedType"
            ? "imageErrorType"
            : code === "tooLarge"
              ? "imageErrorSize"
              : code === "outputTooLarge"
                ? "imageErrorOutput"
                : "imageErrorDecode",
        ),
      );
    } finally {
      event.target.value = "";
    }
  }

  function remove(slot: KidsImageSlot) {
    const saved = updateKidsImage(slot, null);
    if (!saved.ok) return showSaveFailure(saved.reason);
    setImages(saved.images);
    setMessage(t("imageRemoved"));
  }

  function removeAll() {
    const saved = clearKidsImages();
    if (!saved.ok) return showSaveFailure(saved.reason);
    setImages(saved.images);
    setMessage(t("imageRemoved"));
  }

  function removeCustom(id: string) {
    if (!deleteKidsCustom(id)) return setMessage(t("imageErrorQuota"));
    setCustom(loadKidsCustom());
    setMessage(t("imageRemoved"));
  }

  return (
    <section className="kids-adult-card kids-images-panel" aria-labelledby="kids-images-title">
      <h2 id="kids-images-title">{t("gameImages")}</h2>
      <p>{t("imagesStay")}</p>
      <p className="kids-note">{t("imagesUsed", { used, limit: 1024 })}</p>
      <div className="kids-images-list">
        {KIDS_IMAGE_SLOTS.map((slot) => (
          <div className="kids-image-row" key={slot}>
            <span
              className="kids-image-preview"
              role="img"
              aria-label={label(slot)}
              style={images[slot] ? { backgroundImage: `url("${images[slot]}")` } : undefined}
            >
              {images[slot]
                ? null
                : slot === "ori"
                  ? "✦"
                  : slot.startsWith("explorer:")
                    ? slot.slice(9)
                    : "▧"}
            </span>
            <strong>{label(slot)}</strong>
            <label className="kids-button kids-image-file">
              {t("chooseImage")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label={`${t("chooseImage")} ${label(slot)}`}
                onChange={(event) => void choose(slot, event)}
              />
            </label>
            {images[slot] ? (
              <button type="button" className="kids-button" onClick={() => remove(slot)}>
                {t("removeImage")} {label(slot)}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="kids-button"
        disabled={Object.keys(images).length === 0}
        onClick={removeAll}
      >
        {t("removeAllImages")}
      </button>
      <h3>
        {t("customExplorer")} / {t("customBackdrop")}
      </h3>
      <div className="kids-images-list">
        {custom.map((item) => (
          <div className="kids-image-row" key={item.id}>
            <span
              className="kids-image-preview"
              role="img"
              aria-label={t(item.kind === "explorer" ? "customExplorer" : "customBackdrop")}
              style={{ backgroundImage: `url("${item.dataUrl}")` }}
            />
            <strong>
              {t(item.kind === "explorer" ? "customExplorer" : "customBackdrop")} {item.id.slice(7)}
            </strong>
            <button type="button" className="kids-button" onClick={() => removeCustom(item.id)}>
              {t("removeImage")} {item.id.slice(7)}
            </button>
          </div>
        ))}
      </div>
      <p role="status" className="kids-note">
        {message}
      </p>
    </section>
  );
}
