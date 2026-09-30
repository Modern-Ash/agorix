import type { ProjectProgram } from "@agorix/program-model";

export const PACKAGE_NAME = "@agorix/language-projection";

/** Stable identifier for a projection implementation, such as `typescript-like`. */
export type LanguageProjectionId = string;

/** Version of a projection's text/mapping contract, independent from package version. */
export type LanguageProjectionVersion = string;

/** Half-open text range into `LanguageProjectionResult.text` (start inclusive, end exclusive). */
export interface TextRange {
  readonly start: number;
  readonly end: number;
}

/** Canonical node id -> one or more text ranges in the projected text. */
export type NodeTextMapping = Readonly<Record<string, readonly TextRange[]>>;

export interface LanguageProjectionDescriptor {
  readonly id: LanguageProjectionId;
  readonly version: LanguageProjectionVersion;
  readonly label: string;
  readonly family?: string;
}

export type LanguageProjectionDiagnosticSeverity = "error" | "warning" | "info";
export type LanguageProjectionDiagnosticCode = "unsupported-node" | "invalid-output";

export interface LanguageProjectionDiagnostic {
  readonly code: LanguageProjectionDiagnosticCode;
  readonly severity: LanguageProjectionDiagnosticSeverity;
  readonly nodeId: string;
  readonly message: string;
  readonly nodeType?: string;
}

export interface LanguageProjectionMetadata {
  readonly structuralNodeIds?: readonly string[];
  readonly unsupportedNodeIds?: readonly string[];
  readonly [key: string]: unknown;
}

export interface LanguageProjectionResult {
  readonly projection: LanguageProjectionDescriptor;
  readonly text: string;
  readonly mapping: NodeTextMapping;
  readonly diagnostics: readonly LanguageProjectionDiagnostic[];
  readonly metadata?: LanguageProjectionMetadata;
}

export interface LanguageProjection {
  readonly descriptor: LanguageProjectionDescriptor;
  project(program: ProjectProgram): LanguageProjectionResult;
}

export class LanguageProjectionUnsupportedNodeError extends Error {
  readonly diagnostic: LanguageProjectionDiagnostic;

  constructor(diagnostic: LanguageProjectionDiagnostic) {
    super(diagnostic.message);
    this.name = "LanguageProjectionUnsupportedNodeError";
    this.diagnostic = diagnostic;
  }
}

export function createUnsupportedNodeDiagnostic(input: {
  readonly nodeId: string;
  readonly nodeType: string;
  readonly projectionId?: string;
}): LanguageProjectionDiagnostic {
  const prefix =
    input.projectionId === undefined ? "Projection" : `Projection ${input.projectionId}`;
  return {
    code: "unsupported-node",
    severity: "error",
    nodeId: input.nodeId,
    nodeType: input.nodeType,
    message: `${prefix} does not support node type ${JSON.stringify(input.nodeType)} at ${input.nodeId}`,
  };
}

export function throwUnsupportedNode(input: {
  readonly nodeId: string;
  readonly nodeType: string;
  readonly projectionId?: string;
}): never {
  throw new LanguageProjectionUnsupportedNodeError(createUnsupportedNodeDiagnostic(input));
}

export function singleRangeMapping(mapping: Readonly<Record<string, TextRange>>): NodeTextMapping {
  return Object.fromEntries(Object.entries(mapping).map(([nodeId, range]) => [nodeId, [range]]));
}

export function firstRangeMapping(mapping: NodeTextMapping): Readonly<Record<string, TextRange>> {
  const single: Record<string, TextRange> = {};
  for (const [nodeId, ranges] of Object.entries(mapping)) {
    const first = ranges[0];
    if (first !== undefined) {
      single[nodeId] = first;
    }
  }
  return single;
}

export class LanguageProjectionRegistry {
  readonly #projections = new Map<LanguageProjectionId, LanguageProjection>();

  constructor(projections: readonly LanguageProjection[] = []) {
    for (const projection of projections) {
      this.register(projection);
    }
  }

  register(projection: LanguageProjection): void {
    const existing = this.#projections.get(projection.descriptor.id);
    if (existing !== undefined && existing !== projection) {
      throw new Error(
        `Language projection ${JSON.stringify(projection.descriptor.id)} is already registered`,
      );
    }
    this.#projections.set(projection.descriptor.id, projection);
  }

  get(id: LanguageProjectionId): LanguageProjection | undefined {
    return this.#projections.get(id);
  }

  require(id: LanguageProjectionId): LanguageProjection {
    const projection = this.get(id);
    if (projection === undefined) {
      throw new Error(`Language projection ${JSON.stringify(id)} is not registered`);
    }
    return projection;
  }

  list(): readonly LanguageProjectionDescriptor[] {
    return [...this.#projections.values()].map((projection) => projection.descriptor);
  }
}

export function createLanguageProjectionRegistry(
  projections: readonly LanguageProjection[] = [],
): LanguageProjectionRegistry {
  return new LanguageProjectionRegistry(projections);
}

export type { ProjectProgram } from "@agorix/program-model";
export {
  assertLanguageProjectionConformance,
  assertProjectionResultShape,
  type LanguageProjectionConformanceCase,
} from "./conformance.js";
export * from "./languagePack.js";
