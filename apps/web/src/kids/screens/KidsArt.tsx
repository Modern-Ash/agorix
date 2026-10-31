import type { CSSProperties, PointerEventHandler, ReactNode } from "react";
import { useKidsFlag } from "../kidsFlags.js";
import { loadKidsImages, type KidsImageSlot } from "../kidsImages.js";
import { resolveKidsCustom } from "../kidsCustom.js";
import type { KidsAvatar, KidsWorld } from "../kidsState.js";
import type { KidsAvatarRef, KidsWorldRef } from "../kidsProjects.js";
import { KIDS_WORLD_STYLES } from "../worlds.js";
import { galleryBackdropArt, galleryCharacterArt } from "../kidsGallery.js";
import type { OriExpression } from "../kidsOriExpression.js";
import { OriFace } from "./OriFace.js";

export type KidsSpriteSlot = "ori" | KidsAvatarRef;

export function spriteImage(slot: KidsSpriteSlot, enabled: boolean): string | undefined {
  if (slot !== "ori" && slot.kind === "gallery") return galleryCharacterArt(slot.id);
  if (!enabled) return undefined;
  if (slot === "ori") return loadKidsImages().ori;
  if (slot.kind === "custom") return resolveKidsCustom(slot.id, "explorer");
  return loadKidsImages()[`explorer:${slot.value}` as KidsImageSlot];
}

export function backdropImage(world: KidsWorldRef, enabled: boolean): string | undefined {
  if (world.kind === "gallery") return galleryBackdropArt(world.id);
  if (!enabled) return undefined;
  return world.kind === "custom"
    ? resolveKidsCustom(world.id, "backdrop")
    : loadKidsImages()[`world:${world.value}` as KidsImageSlot];
}

export function KidsSprite({
  slot,
  className,
  fallback,
  label,
  imageOverride,
  expression,
  talking,
  children,
}: {
  readonly slot: KidsSpriteSlot;
  /** Ori only: show a face for this expression instead of the star glyph (a custom image wins). */
  readonly expression?: OriExpression | undefined;
  /** Ori only: move the mouth, while Ori has something to say. */
  readonly talking?: boolean | undefined;
  readonly className?: string;
  readonly fallback?: string;
  readonly label?: string | undefined;
  readonly imageOverride?: string | undefined;
  readonly children?: ReactNode;
}) {
  const enabled = useKidsFlag("customImages");
  const image = imageOverride ?? spriteImage(slot, enabled);
  const glyph = fallback ?? (slot === "ori" ? "✦" : slot.kind === "emoji" ? slot.value : "🦊");
  // Only fixed character keys can become accessible names; files never supply alt text.
  const imageLabel = image
    ? (label ?? (slot === "ori" ? "Ori" : slot.kind === "emoji" ? slot.value : "explorer"))
    : label;
  return (
    <span
      className={`${className ?? ""}${image ? " kids-art-image" : ""}`.trim()}
      data-ori-expression={slot === "ori" ? expression : undefined}
      role={imageLabel ? "img" : undefined}
      aria-label={imageLabel}
      aria-hidden={imageLabel ? undefined : true}
      style={image ? { backgroundImage: `url("${image}")` } : undefined}
    >
      {image
        ? null
        : (children ??
          (slot === "ori" && expression ? (
            <OriFace expression={expression} talking={talking === true} />
          ) : (
            glyph
          )))}
    </span>
  );
}

export function KidsBackdrop({
  world,
  baseWorld,
  className,
  children,
  style,
  label,
  role,
  tabIndex,
  fallbackBackground,
  imageOverride,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  readonly world: KidsWorldRef;
  readonly baseWorld?: KidsWorld;
  readonly className?: string;
  readonly children?: ReactNode;
  readonly style?: CSSProperties;
  readonly label?: string;
  readonly role?: "img" | "group";
  readonly tabIndex?: number;
  readonly fallbackBackground?: string;
  readonly imageOverride?: string | undefined;
  readonly onPointerDown?: PointerEventHandler<HTMLDivElement>;
  readonly onPointerMove?: PointerEventHandler<HTMLDivElement>;
  readonly onPointerUp?: PointerEventHandler<HTMLDivElement>;
  readonly onPointerCancel?: PointerEventHandler<HTMLDivElement>;
}) {
  const enabled = useKidsFlag("customImages");
  const image = imageOverride ?? backdropImage(world, enabled);
  const fallbackWorld = world.kind === "builtin" ? world.value : (baseWorld ?? "space");
  return (
    <div
      className={`${className ?? ""}${image ? " kids-art-backdrop" : ""}`.trim()}
      role={role}
      tabIndex={tabIndex}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{
        background: fallbackBackground ?? KIDS_WORLD_STYLES[fallbackWorld].bg,
        ...style,
        ...(image ? { backgroundImage: `url("${image}")` } : {}),
      }}
    >
      {children}
    </div>
  );
}

export function emojiSlot(avatar: KidsAvatar): KidsAvatarRef {
  return { kind: "emoji", value: avatar };
}

export function builtinWorld(world: KidsWorld): KidsWorldRef {
  return { kind: "builtin", value: world };
}
