/** Runtime failures that are not execution outcomes. */
export class RuntimeExecutionError extends Error {
  readonly nodeId: string;
  readonly nodeType: string;

  constructor(nodeId: string, nodeType: string) {
    super(`Unsupported runtime node type ${JSON.stringify(nodeType)} at ${nodeId}`);
    this.name = "RuntimeExecutionError";
    this.nodeId = nodeId;
    this.nodeType = nodeType;
  }
}
