/**
 * Shared browser request queue for endpoints using the same rotating
 * HttpOnly session cookie. Failures never poison subsequent requests.
 */
let tail:Promise<unknown>=Promise.resolve();
export function withAgorixSessionQueue<T>(task:()=>Promise<T>):Promise<T> {
  const next=tail.then(task,task);
  tail=next.catch(()=>undefined);
  return next;
}
