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
