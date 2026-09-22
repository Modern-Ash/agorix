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
