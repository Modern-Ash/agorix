import { describe, expect, it } from "vitest";
import {
  CUT_IDEAS,
  cutKindOf,
  cutSentence,
  forgetImportCuts,
  intentsForCuts,
  loadImportCuts,
  saveImportCuts,
} from "./kidsImportCuts.js";
import { convertScratchProject } from "./kidsScratchImport.js";
import { SCRATCH_CORPUS } from "./__fixtures__/scratch/corpus.js";

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

describe("what an import left out, said by Ori (#1312)", () => {
  it("gives every reason the importer reports a kind and a sentence in both languages", () => {
    for (const { name, project } of SCRATCH_CORPUS) {
      for (const item of convertScratchProject(project).report.dropped) {
        const kind = cutKindOf(item.what);
        expect(cutSentence(kind, "es"), `${name}: ${item.what}`).not.toBe("");
        expect(cutSentence(kind, "en"), `${name}: ${item.what}`).not.toBe("");
      }
    }
  });

  it("sorts the known reasons into their kinds", () => {
    expect(cutKindOf("another script of the sprite")).toBe("extraScript");
    expect(cutKindOf('variable "puntos" (more than three)')).toBe("moreVariables");
    expect(cutKindOf("motion_movesteps (value comes from another block)")).toBe("computedMove");
    expect(cutKindOf("motion_gotoxy (value comes from another block)")).toBe("computedValue");
    expect(cutKindOf("motion_glideto")).toBe("goto");
    expect(cutKindOf("looks_nextcostume")).toBe("costume");
    expect(cutKindOf("sensing_askandwait")).toBe("ask");
    expect(cutKindOf("data_deletealloflist")).toBe("lists");
    expect(cutKindOf('list "Compras" (more than three)')).toBe("lists");
    expect(cutKindOf("procedures_call")).toBe("customBlocks");
    expect(cutKindOf("sound_playuntildone")).toBe("sound");
    expect(cutKindOf("something_unknown")).toBe("other");
  });

  it("offers an idea only for the cuts that have a close block, once each", () => {
    expect(intentsForCuts(["goto", "goto", "computedMove", "sound", "lists"])).toEqual([
      "scratchGoTo",
      "scratchMove",
      "scratchSound",
    ]);
    expect(intentsForCuts(["extraScript", "other"])).toEqual([]);
    expect(Object.values(CUT_IDEAS).filter((item) => item.intent !== undefined)).toHaveLength(3);
  });

  it("never repeats a name from the file: the sentences are fixed", () => {
    expect(cutSentence(cutKindOf('word variable "Ana" (more than three)'), "es")).not.toContain(
      "Ana",
    );
  });

  it("keeps only closed kinds, per project, and forgets them with the project", () => {
    const store = memory();
    saveImportCuts("studio-3", ["goto", "goto", "sound"], store);
    expect(loadImportCuts("studio-3", store)).toEqual(["goto", "sound"]);
    expect(loadImportCuts("studio-4", store)).toEqual([]);
    store.setItem(
      "agorix.kids.importCuts.v1",
      JSON.stringify({ "studio-3": ["goto", "Ana's secret", 7], "bad id": ["goto"] }),
    );
    expect(loadImportCuts("studio-3", store)).toEqual(["goto"]);
    forgetImportCuts("studio-3", store);
    expect(loadImportCuts("studio-3", store)).toEqual([]);
    store.setItem("agorix.kids.importCuts.v1", "not json");
    expect(loadImportCuts("studio-3", store)).toEqual([]);
  });
});
