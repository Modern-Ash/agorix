import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GroupOrganizerCard } from "./GroupOrganizerCard.js";
import { GroupThisDeviceCard } from "./GroupThisDeviceCard.js";
import { TeamProjectCard } from "./team/TeamProjectCard.js";
import type { GroupApi } from "./groupApi.js";
import { assertGroupCatalogComplete, groupError, groupText } from "./groupCopy.js";
import {
  KIDS_GROUP_DEVICE_KEY,
  clearGroupDevice,
  loadGroupDevice,
  saveGroupDevice,
  type GroupDeviceStorage,
} from "./groupDevice.js";

// Issue #566: static structure, copy and the on-device key. Behaviour runs in groupApi.test.ts.
const api = {} as GroupApi;
const TOKEN = `dev_${"a".repeat(32)}`;

function memoryStorage(): GroupDeviceStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("group copy", () => {
  it("has identical Spanish and English catalogs, including every error kind", () => {
    expect(() => assertGroupCatalogComplete()).not.toThrow();
    expect(groupError("es", "invalid-code")).toContain("código");
    expect(groupError("en", "group-full")).toContain("full");
  });

  it("fills placeholders and leaves none behind", () => {
    expect(groupText("es", "yourAlias", { alias: "Zorro Azul" })).toBe("Apodo: Zorro Azul");
    expect(groupText("en", "teamName", { n: 2 })).toBe("Team 2");
    expect(groupText("es", "expiresAt", { time: "14:05" })).not.toContain("{");
  });

  it("promises no names or messages from children", () => {
    expect(groupText("es", "intro")).toContain("Nadie escribe nombres ni mensajes");
    expect(groupText("en", "intro")).toContain("Nobody types names or messages");
  });
});

describe("group cards", () => {
  it("render a loading organizer card without data or controls", () => {
    const html = renderToStaticMarkup(<GroupOrganizerCard locale="es" api={api} />);
    expect(html).toContain("kids-group-organizer-title");
    expect(html).not.toContain("<input");
  });

  it("ask the device for a six-character join code and nothing else", () => {
    const html = renderToStaticMarkup(<GroupThisDeviceCard locale="en" api={api} />);
    expect(html).toContain('maxLength="6"');
    expect(html).toContain('autoComplete="off"');
    expect(html.match(/<input/g)).toHaveLength(1);
  });
});

describe("group device key", () => {
  it("round-trips a well-formed key and forgets it on clear", () => {
    const storage = memoryStorage();
    expect(saveGroupDevice(TOKEN, storage)).toBe(true);
    expect(loadGroupDevice(storage)).toBe(TOKEN);
    clearGroupDevice(storage);
    expect(loadGroupDevice(storage)).toBeNull();
  });

  it("rejects malformed keys and tampered storage", () => {
    const storage = memoryStorage();
    expect(saveGroupDevice("not a key", storage)).toBe(false);
    storage.data.set(KIDS_GROUP_DEVICE_KEY, "<script>");
    expect(loadGroupDevice(storage)).toBeNull();
  });

  it("reports blocked storage instead of pretending it saved", () => {
    expect(saveGroupDevice(TOKEN, undefined)).toBe(false);
    const throwing: GroupDeviceStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(saveGroupDevice(TOKEN, throwing)).toBe(false);
    expect(loadGroupDevice(throwing)).toBeNull();
    expect(() => clearGroupDevice(throwing)).not.toThrow();
  });
});

describe("TeamProjectCard", () => {
  const slot = (id: string, alias: string, status: "pending" | "approved") => ({
    slotId: id,
    alias,
    status,
    reconnects: 0,
  });

  it("asks for at least two approved children before offering a team", () => {
    const html = renderToStaticMarkup(
      <TeamProjectCard
        locale="es"
        slots={[slot("slt_a", "Zorro Azul", "approved"), slot("slt_b", "Gato Verde", "pending")]}
      />,
    );
    expect(html).toContain("Aprobá al menos 2 niños");
    expect(html).not.toContain("<select");
  });

  it("offers a mode and a fixed role per approved child, and never lists pending ones", () => {
    const html = renderToStaticMarkup(
      <TeamProjectCard
        locale="en"
        slots={[
          slot("slt_a", "Zorro Azul", "approved"),
          slot("slt_b", "Gato Verde", "approved"),
          slot("slt_c", "Búho Rojo", "pending"),
        ]}
      />,
    );
    expect(html).toContain("Role of Zorro Azul");
    expect(html).toContain("Role of Gato Verde");
    expect(html).not.toContain("Búho Rojo");
    expect(html.match(/<select/g)).toHaveLength(2);
    expect(html).toContain("Testing (does not edit)");
    expect(html).not.toContain('<input type="text"');
  });
});
