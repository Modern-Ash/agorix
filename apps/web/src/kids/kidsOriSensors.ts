import type { OriStudioIntent } from "@agorix/ori-agent";
import type { ProjectProgram } from "@agorix/program-model";
import { mainScripts } from "./kidsStudioModel.js";

/**
 * The sensor ideas Ori can put forward now: those whose sensor the program does not use yet, so
 * what it offers is a sensor the child has not tried. A touch idea also needs another character.
 */
export function sensorIdeasFor(program: ProjectProgram): readonly OriStudioIntent[] {
  const text = JSON.stringify(program.scripts);
  const uses = (type: string) => text.includes(`"type":"${type}"`);
  const ideas: OriStudioIntent[] = [];
  if (!uses("keyDown")) ideas.push("reactKey");
  if (!uses("mouseDown")) ideas.push("reactMouse");
  if (!uses("touchingStageEdge")) ideas.push("reactEdge");
  if (!uses("touchingActor") && mainScripts(program).length > 1) ideas.push("reactTouch");
  return ideas;
}

/**
 * The list and word ideas Ori can put forward now: the scene has what the idea uses (a list, and a
 * word or a number to keep things in) and the program does not do it yet. The words in a list
 * always come from the child, never from Ori.
 */
export function listIdeasFor(program: ProjectProgram): readonly OriStudioIntent[] {
  if (!program.lists?.length) return [];
  const text = JSON.stringify(program.scripts);
  const uses = (type: string) => text.includes(`"type":"${type}"`);
  const ideas: OriStudioIntent[] = [];
  if (program.textVariables?.length && !uses("askText")) ideas.push("listAsk");
  if (program.textVariables?.length && !uses("listItem")) ideas.push("listFirst");
  if (program.variables?.length && !uses("listLength")) ideas.push("listCount");
  return ideas;
}
