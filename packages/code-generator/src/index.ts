/** Projects canonical program state into readable TypeScript/JavaScript-like code and node-to-text mappings. */
export const PACKAGE_NAME = "@agorix/code-generator";

export type { NodeTextMapping, ProjectionResult, TextRange } from "./project.js";
export {
  TYPESCRIPT_LIKE_PROJECTION,
  TYPESCRIPT_PROJECTION,
  UnsupportedNodeError,
  formatNumber,
  projectProgram,
  projectProgramLanguage,
  typescriptLikeProjection,
  typescriptProjection,
} from "./project.js";
