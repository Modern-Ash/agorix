import { agorixCodeProjection } from "@agorix/agorix-code";
import { typescriptProjection } from "@agorix/code-generator";
import { createLanguageProjectionRegistry, firstRangeMapping } from "@agorix/language-projection";
import type { ProjectProgram } from "@agorix/program-model";
import { pythonProjection } from "@agorix/python-projection";

export type CodeProjectionId = "agorix-code" | "python" | "typescript";

export const CODE_PROJECTION_IDS: readonly CodeProjectionId[] = [
  "agorix-code",
  "python",
  "typescript",
];

const registry = createLanguageProjectionRegistry([
  agorixCodeProjection,
  pythonProjection,
  typescriptProjection,
]);

export interface CodeSurfaceProjection {
  readonly id: CodeProjectionId;
  readonly label: string;
  readonly code: string;
  readonly mapping: Readonly<Record<string, { readonly start: number; readonly end: number }>>;
}

export function projectCodeSurface(
  program: ProjectProgram,
  id: CodeProjectionId,
): CodeSurfaceProjection {
  const projection = registry.require(id);
  const result = projection.project(program);
  return {
    id,
    label: result.projection.label,
    code: result.text,
    mapping: firstRangeMapping(result.mapping),
  };
}

export function projectCodeComparison(
  program: ProjectProgram,
  primary: CodeProjectionId,
  secondary: CodeProjectionId,
): readonly [CodeSurfaceProjection, CodeSurfaceProjection] {
  return [projectCodeSurface(program, primary), projectCodeSurface(program, secondary)];
}
