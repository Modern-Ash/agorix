import type { ColorZone, PenColor } from "@agorix/program-model";
import { KIDS_GALLERY_BACKDROPS } from "./kidsGallery.js";

/**
 * Which colour of the closed pen palette a hex colour is, by hue. Greys and near-blacks are the
 * "dark" ink; anything else is the nearest named colour. Pale tints still count as their hue, so a
 * light blue sky is blue.
 */
export function penColorOfHex(hex: string): PenColor | undefined {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (match === null) return undefined;
  const [r, g, b] = [match[1]!, match[2]!, match[3]!].map((part) => parseInt(part, 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  if (lightness < 0.18 || saturation < 0.12) return "dark";
  let hue: number;
  if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
  else if (max === g) hue = ((b - r) / delta + 2) * 60;
  else hue = ((r - g) / delta + 4) * 60;
  if (hue < 15 || hue >= 345) return "red";
  if (hue < 70) return "orange";
  if (hue < 165) return "green";
  if (hue < 255) return "blue";
  return "purple";
}

/** Where the bundled backdrops change from sky to ground, in stage coordinates (y down). */
const HORIZON_Y = 45;
const STAGE = { x: 0, width: 320, top: -100, bottom: 120 } as const;

/**
 * The colour zones of every bundled backdrop: its sky and its ground, each as the pen colour that
 * hex is. They are part of the scene the runtime is given, so "touching a colour" never reads
 * pixels. Backdrops a child imports have none, and touching a colour is false on them.
 */
export const BACKDROP_COLOR_ZONES: Readonly<Record<string, readonly ColorZone[]>> =
  Object.fromEntries(
    KIDS_GALLERY_BACKDROPS.map((backdrop) => {
      const zones: ColorZone[] = [];
      const sky = penColorOfHex(backdrop.sky);
      const ground = penColorOfHex(backdrop.ground);
      if (sky !== undefined)
        zones.push({
          color: sky,
          x: STAGE.x,
          y: STAGE.top,
          width: STAGE.width,
          height: HORIZON_Y - STAGE.top,
        });
      if (ground !== undefined)
        zones.push({
          color: ground,
          x: STAGE.x,
          y: HORIZON_Y,
          width: STAGE.width,
          height: STAGE.bottom - HORIZON_Y,
        });
      return [`backdrop:${backdrop.id}`, zones];
    }),
  );
