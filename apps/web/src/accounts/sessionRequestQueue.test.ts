import { describe,expect,it } from "vitest";
import { withAgorixSessionQueue } from "./sessionRequestQueue.js";

describe("shared rotating session request queue",()=>{
  it("serializes requests and preserves ordering",async()=>{
    const events:string[]=[];
    let release!:()=>void;
    const first=withAgorixSessionQueue(async()=>{
      events.push("first-start");
      await new Promise<void>(done=>{release=done;});
      events.push("first-end");
    });
    const second=withAgorixSessionQueue(async()=>{events.push("second");});
    await Promise.resolve();
    expect(events).toEqual(["first-start"]);
    release();
    await Promise.all([first,second]);
    expect(events).toEqual(["first-start","first-end","second"]);
  });
  it("continues after a rejected request",async()=>{
    await expect(withAgorixSessionQueue(async()=>{throw Error("network");})).rejects.toThrow("network");
    await expect(withAgorixSessionQueue(async()=>42)).resolves.toBe(42);
  });
});
