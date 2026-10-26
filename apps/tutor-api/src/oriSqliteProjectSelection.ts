import type { ProjectRepository } from "@agorix/project-repository";
import { openOriSqliteActiveProjectPersistence } from "./oriSqliteActiveProjectPersistence.js";
import { createOriExpiringActiveProjectStore } from "./oriExpiringActiveProjectStore.js";
import { createOriSessionProjectSelector } from "./oriSessionProjectSelector.js";
import { createOriActiveProjectSessionLifecycle } from "./oriActiveProjectSessionLifecycle.js";

/**
 * Single-host composition for authenticated active-project selection.
 * The caller owns closing this resource during graceful shutdown.
 */
export function openOriSqliteProjectSelection({
  path,repository,ttlMs
}:{
  readonly path:string;
  readonly repository:Pick<ProjectRepository,"get">;
  readonly ttlMs?:number;
}) {
  const persistence=openOriSqliteActiveProjectPersistence(path);
  try {
    const store=createOriExpiringActiveProjectStore({
      persistence,...(ttlMs===undefined?{}:{ttlMs})
    });
    const selector=createOriSessionProjectSelector({repository,store});
    const lifecycle=createOriActiveProjectSessionLifecycle(persistence);
    return Object.freeze({
      choose:selector.choose,
      activeProject:selector.activeProject,
      signedOut:lifecycle.signedOut,
      rotated:lifecycle.rotated,
      close:()=>persistence.close()
    });
  } catch(error) {
    persistence.close();
    throw error;
  }
}
