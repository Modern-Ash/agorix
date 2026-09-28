/** Versioned project storage abstraction; web starts with browser-local persistence. */
export {
  PACKAGE_NAME,
  PersistenceError,
  type PersistenceErrorCode,
  type StoredProject,
  type ProjectMetadata,
  type BrowserStorageAdapter,
  type MigrationFn,
  type MigrationStep,
  BrowserLocalStorageAdapter,
  ProjectStore,
} from "./store.js";
export {
  CROSS_SURFACE_CONTRACT_VERSION,
  FORBIDDEN_CANONICAL_UI_KEYS,
  assertCrossSurfaceCompatibleProject,
  assertNoUiSpecificProgramState,
  assertSemanticallyEquivalentProjects,
  semanticProjectHash,
  semanticProjectSnapshot,
  type SemanticProjectSnapshot,
} from "./compatibility.js";
