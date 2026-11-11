import { validateProgram, type ProjectProgram } from "@agorix/program-model";
import { programSemanticHash, type ProgramProposal } from "@agorix/proposals";

/**
 * The program as Ori's service needs to see it, which is its shape and nothing a child wrote.
 *
 * A child's words live in a few places of a program: the text of a "say" or "think" block, a word
 * typed into a block, the names of variables, words, lists, custom blocks and their numbers, and
 * the starting words of a variable or list. They are replaced by neutral stand-ins here before the
 * program leaves the browser for an idea; ids, block kinds, numbers and closed choices (messages,
 * keys, costumes) are not child text and stay. The result is a valid program of the same shape, so
 * the service checks an idea against it exactly as it would against the original.
 *
 * What comes back is built on this program, so its `baseProgramHash` is the redacted one;
 * `rebaseRedactedProposal` puts the child's own program back as the base after checking that the
 * idea really was made for it. Add any new place a child can write text to this list.
 */
export function redactProgramForOri(program: ProjectProgram): ProjectProgram {
  const copy = JSON.parse(JSON.stringify(validateProgram(program))) as Record<string, unknown>;
  const list = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  list(copy["variables"]).forEach((item, at) => (item["name"] = `v${at + 1}`));
  list(copy["textVariables"]).forEach((item, at) => {
    item["name"] = `w${at + 1}`;
    item["initialValue"] = "";
  });
  list(copy["lists"]).forEach((item, at) => {
    item["name"] = `l${at + 1}`;
    if (Array.isArray(item["initialItems"]))
      item["initialItems"] = (item["initialItems"] as unknown[]).map((entry) =>
        typeof entry === "string" ? "x" : entry,
      );
  });
  let blocks = 0;
  const procedures = (value: unknown) =>
    list(value).forEach((item) => {
      blocks += 1;
      item["name"] = `b${blocks}`;
      list(item["params"]).forEach((param, at) => (param["name"] = `n${at + 1}`));
    });
  procedures(copy["sharedProcedures"]);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== "object" || value === null) return;
    const node = value as Record<string, unknown>;
    if (node["type"] === "textLiteral") node["value"] = "x";
    if ((node["type"] === "say" || node["type"] === "think") && typeof node["text"] === "string")
      node["text"] = "x";
    Object.values(node).forEach(visit);
  };
  for (const script of list(copy["scripts"])) procedures(script["procedures"]);
  visit(copy["scripts"]);
  visit(copy["sharedProcedures"]);
  return validateProgram(copy as unknown as ProjectProgram);
}

/**
 * An idea made for the redacted program, as an idea for the child's own program. It is refused
 * unless it was made for exactly the redacted form of this program, and the caller still checks it
 * against the real program like any idea.
 */
export function rebaseRedactedProposal(
  program: ProjectProgram,
  offered: ProgramProposal,
): ProgramProposal {
  if (offered.baseProgramHash !== programSemanticHash(redactProgramForOri(program)))
    throw new Error("the idea was not made for this program");
  return { ...offered, baseProgramHash: programSemanticHash(program) };
}
