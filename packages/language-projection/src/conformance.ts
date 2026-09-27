import type { ProjectProgram } from "@agorix/program-model";
import type { LanguageProjection, LanguageProjectionResult } from "./index.js";

export interface LanguageProjectionConformanceCase {
  readonly name: string;
  readonly program: ProjectProgram;
  readonly requiredNodeIds: readonly string[];
  readonly unsupportedProgram?: ProjectProgram;
  readonly unsupportedNodeId?: string;
}

function fail(message: string): never {
  throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  if (actualText !== expectedText) {
    fail(`${label}: expected ${expectedText}, received ${actualText}`);
  }
}

export function assertProjectionResultShape(result: LanguageProjectionResult): void {
  if (result.projection.id.length === 0) {
    fail("projection id is required");
  }
  if (result.projection.version.length === 0) {
    fail("projection version is required");
  }

  for (const [nodeId, ranges] of Object.entries(result.mapping)) {
    if (ranges.length === 0) {
      fail(`${nodeId}: expected at least one text range`);
    }
    for (const range of ranges) {
      if (range.start < 0) {
        fail(`${nodeId}: range start must be non-negative`);
      }
      if (range.end < range.start) {
        fail(`${nodeId}: range end must be >= start`);
      }
      if (range.end > result.text.length) {
        fail(`${nodeId}: range end exceeds projected text length`);
      }
    }
  }
}

export function assertLanguageProjectionConformance(
  projection: LanguageProjection,
  testCase: LanguageProjectionConformanceCase,
): void {
  const first = projection.project(testCase.program);
  const second = projection.project(structuredClone(testCase.program));

  assertProjectionResultShape(first);
  assertDeepEqual(second, first, `${testCase.name}: deterministic output`);

  for (const nodeId of testCase.requiredNodeIds) {
    if (first.mapping[nodeId] === undefined) {
      fail(`${testCase.name}: missing mapping for ${nodeId}`);
    }
  }

  const before = JSON.stringify(testCase.program);
  projection.project(testCase.program);
  if (JSON.stringify(testCase.program) !== before) {
    fail(`${testCase.name}: projection mutated canonical program input`);
  }

  if (testCase.unsupportedProgram !== undefined) {
    const unsupported = projection.project(testCase.unsupportedProgram);
    if (!unsupported.diagnostics.some((diagnostic) => diagnostic.code === "unsupported-node")) {
      fail(`${testCase.name}: expected unsupported-node diagnostic`);
    }
    if (
      testCase.unsupportedNodeId !== undefined &&
      !unsupported.diagnostics.some(
        (diagnostic) => diagnostic.nodeId === testCase.unsupportedNodeId,
      )
    ) {
      fail(`${testCase.name}: expected diagnostic for ${testCase.unsupportedNodeId}`);
    }
  }
}
