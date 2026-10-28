import { startOriMig04PgCanonicalAuthenticatedRuntime } from "./oriMig04PgCanonicalAuthenticatedRuntime.js";
import {
  createOriMig04ActiveProjectResolver,
  type OriSessionProjectStore,
} from "./oriMig04TrustedSessionProject.js";

/**
 * Production integration boundary: requires a real server-side session-project
 * store. The canonical PostgreSQL runtime still owns project persistence.
 */
export function startOriMig04PgSessionProjectRuntime({
  projectStore,
  ...options
}: Omit<
  Parameters<typeof startOriMig04PgCanonicalAuthenticatedRuntime>[0],
  "ori"
> & {
  readonly projectStore: OriSessionProjectStore;
  readonly ori: Omit<
    Parameters<typeof startOriMig04PgCanonicalAuthenticatedRuntime>[0]["ori"],
    "activeProject"
  >;
}) {
  const activeProject = createOriMig04ActiveProjectResolver(projectStore);
  return startOriMig04PgCanonicalAuthenticatedRuntime({
    ...options,
    ori: { ...options.ori, activeProject },
  });
}
