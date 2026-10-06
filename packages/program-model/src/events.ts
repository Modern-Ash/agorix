import type { ProgramEvent, ProjectProgram, Trigger } from "./schema.js";

/** The event that starts scripts with this trigger. The legacy `onStart` hat is the green flag. */
export function eventForTrigger(trigger: Trigger): ProgramEvent {
  switch (trigger.type) {
    case "greenFlag":
    case "onStart":
      return "greenFlag";
  }
}

/** Rewrites legacy "When you press Run" hats as green-flag hats; everything else is untouched. */
export function migrateLegacyTriggers(program: ProjectProgram): ProjectProgram {
  if (!program.scripts.some((script) => script.trigger.type === "onStart")) {
    return program;
  }
  return {
    ...program,
    scripts: program.scripts.map((script) =>
      script.trigger.type === "onStart" ? { ...script, trigger: { type: "greenFlag" } } : script,
    ),
  };
}
