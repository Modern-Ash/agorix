import { useState } from "react";
import { getBlockDefinition, type BlockWorkspaceSnapshot } from "@agorix/block-editor";
import type { Intent } from "@agorix/interaction-core";
import type { StudioUiCopy } from "./i18n.js";

export function ProcedureTools({
  workspace,
  scriptIndex,
  copy,
  onIntent,
}: {
  readonly workspace: BlockWorkspaceSnapshot;
  readonly scriptIndex: number;
  readonly copy: StudioUiCopy;
  readonly onIntent: (intent: Intent) => void;
}) {
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);
  const [deleteCandidate, setDeleteCandidate] = useState<string | undefined>();
  const script = workspace.scripts[scriptIndex];
  if (script === undefined) return null;
  const procedures = script.procedures ?? [];
  const maxCount = Math.min(20, script.statements.length);
  return (
    <details className="procedure-tools">
      <summary>
        {copy.customBlocks} ({procedures.length})
      </summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (maxCount < 1 || !name.trim()) return;
          onIntent({ type: "createProcedure", scriptIndex, name: name.trim(), count });
        }}
      >
        <label>
          {copy.customBlockName}
          <input
            value={name}
            maxLength={20}
            pattern="[\p{L}\p{N}][\p{L}\p{N} _-]{0,19}"
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label>
          {copy.customBlockCount}
          <input
            type="number"
            min={1}
            max={Math.max(1, maxCount)}
            value={count}
            onChange={(event) => setCount(Number(event.currentTarget.value))}
          />
        </label>
        <button
          type="submit"
          disabled={
            maxCount < 1 ||
            count < 1 ||
            count > maxCount ||
            procedures.length >= 20 ||
            !name.trim() ||
            procedures.some(
              (procedure) => procedure.name.toLowerCase() === name.trim().toLowerCase(),
            )
          }
        >
          {copy.customBlockCreate}
        </button>
      </form>
      {maxCount < 1 ? null : (
        <div className="procedure-preview">
          <span>{copy.customBlockPreview}</span>
          <ol>
            {script.statements.slice(-Math.min(Math.max(count, 1), maxCount)).map((block) => (
              <li key={block.id}>
                {(copy.blockLabels as Readonly<Record<string, string>>)[block.type] ??
                  getBlockDefinition(block.type)?.label ??
                  block.type}
              </li>
            ))}
          </ol>
        </div>
      )}
      {procedures.length === 0 ? (
        <p>{copy.customBlockEmpty}</p>
      ) : (
        <ul>
          {procedures.map((procedure) => (
            <li key={procedure.id}>
              <label>
                {copy.customBlockName}
                <input
                  key={`${procedure.id}:${procedure.name}`}
                  defaultValue={procedure.name}
                  maxLength={20}
                  onBlur={(event) => {
                    const next = event.currentTarget.value.trim();
                    if (next && next !== procedure.name)
                      onIntent({
                        type: "renameProcedure",
                        scriptIndex,
                        procedureId: procedure.id,
                        name: next,
                      });
                    event.currentTarget.value = procedure.name;
                  }}
                />
              </label>
              <span>
                {procedure.body.length} {copy.customBlockSteps}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (deleteCandidate !== procedure.id) {
                    setDeleteCandidate(procedure.id);
                    return;
                  }
                  onIntent({
                    type: "deleteProcedure",
                    scriptIndex,
                    procedureId: procedure.id,
                    inlineCalls: true,
                  });
                  setDeleteCandidate(undefined);
                }}
              >
                {deleteCandidate === procedure.id
                  ? copy.customBlockConfirmInline
                  : copy.customBlockDelete}
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
