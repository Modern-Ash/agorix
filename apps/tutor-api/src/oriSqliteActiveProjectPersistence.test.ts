import { describe,expect,it } from "vitest";
import { openOriSqliteActiveProjectPersistence } from "./oriSqliteActiveProjectPersistence.js";
import { createOriExpiringActiveProjectStore } from "./oriExpiringActiveProjectStore.js";
import { createOriSessionProjectSelector } from "./oriSessionProjectSelector.js";
import type { ProjectRepository } from "@agorix/project-repository";

describe("Ori SQLite active-project persistence",()=>{
  it("persists account/session selection and expires it",async()=>{
    const persistence=openOriSqliteActiveProjectPersistence(":memory:");
    try{
      let now=1000;
      const store=createOriExpiringActiveProjectStore({persistence,now:()=>now,ttlMs:2000});
      await store.set("learner","session-a","project-a");
      expect(await store.get("learner","session-a")).toBe("project-a");
      expect(await store.get("learner","session-b")).toBeNull();
      now=3000;
      expect(await store.get("learner","session-a")).toBeNull();
    }finally{persistence.close();}
  });
  it("integrates with the authorized multi-project selector",async()=>{
    const persistence=openOriSqliteActiveProjectPersistence(":memory:");
    try{
      const store=createOriExpiringActiveProjectStore({persistence});
      const repository={get:async(owner:string,id:string)=>({
        ownerId:owner,projectId:id
      })} as unknown as Pick<ProjectRepository,"get">;
      const selector=createOriSessionProjectSelector({repository,store});
      const session={accountId:"learner",sessionId:"session-a"};
      expect(await selector.choose(session,"project-b")).toBe(true);
      expect(await selector.activeProject(session)).toBe("project-b");
    }finally{persistence.close();}
  });
});
