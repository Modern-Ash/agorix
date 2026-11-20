import { useState } from "react";
import { getBlockDefinition, type BlockWorkspaceSnapshot } from "@agorix/block-editor";
import type { Intent } from "@agorix/interaction-core";
import type { StudioUiCopy } from "./i18n.js";

export function ProcedureNavigator({
  workspace,
  copy,
  onOpen,
}: {
  readonly workspace: BlockWorkspaceSnapshot;
  readonly copy: StudioUiCopy;
  readonly onOpen: (scriptId: string, procedureId: string) => void;
}) {
  const definitions = workspace.scripts.flatMap((script, scriptIndex) =>
    (script.procedures ?? []).map((procedure) => ({
      scriptId: script.programId ?? script.id,
      scriptIndex,
      procedure,
    })),
  );
  if (definitions.length === 0) return null;
  return (
    <section className="procedure-navigator" aria-label={copy.customBlocks}>
      <strong>{copy.customBlocks}</strong>
      <ul>
        {definitions.map(({ scriptId, scriptIndex, procedure }) => (
          <li key={`${scriptId}:${procedure.id}`}>
            <button type="button" onClick={() => onOpen(scriptId, procedure.id)}>
              <span>{procedure.name}</span>
              <small>
                {copy.canvasScript} {scriptIndex + 1} · {procedure.body.length}{" "}
                {copy.customBlockSteps}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProcedureTools({
  workspace,
  scriptIndex,
  copy,
  onIntent,
  onEditBody,
  editingProcedureId,
}: {
  readonly workspace: BlockWorkspaceSnapshot;
  readonly scriptIndex: number;
  readonly copy: StudioUiCopy;
  readonly onIntent: (intent: Intent) => void;
  readonly onEditBody?: (procedureId: string) => void;
  readonly editingProcedureId?: string | undefined;
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
            pattern="[\p{L}\p{N}][\p{L}\p{N} _\-]{0,19}"
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
              <ul aria-label={`${procedure.name}: ${copy.customBlockArguments}`}>
                {(procedure.parameters ?? []).map((parameter) => (
                  <li key={parameter.id}>
                    <span>{parameter.name}</span>
                    <button
                      type="button"
                      aria-label={`${copy.customBlockRemoveParameter}: ${parameter.name}`}
                      onClick={() =>
                        onIntent({
                          type: "removeProcedureParameter",
                          scriptIndex,
                          procedureId: procedure.id,
                          parameterId: parameter.id,
                        })
                      }
                    >
                      {copy.customBlockRemoveParameter}
                    </button>
                  </li>
                ))}
              </ul>
              {(procedure.parameters?.length ?? 0) >= 4 ? null : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const input = event.currentTarget.elements.namedItem(
                      "parameterName",
                    ) as HTMLInputElement | null;
                    const next = input?.value.trim();
                    if (next)
                      onIntent({
                        type: "addProcedureParameter",
                        scriptIndex,
                        procedureId: procedure.id,
                        name: next,
                      });
                    if (input) input.value = "";
                  }}
                >
                  <label>
                    {copy.customBlockParameter}
                    <input
                      name="parameterName"
                      required
                      maxLength={20}
                      pattern="[\p{L}\p{N}][\p{L}\p{N} _\-]{0,19}"
                    />
                  </label>
                  <button type="submit">{copy.customBlockAddParameter}</button>
                </form>
              )}
              {onEditBody === undefined ? null : (
                <button
                  type="button"
                  aria-pressed={editingProcedureId === procedure.id}
                  onClick={() => onEditBody(procedure.id)}
                >
                  {copy.customBlockEditBody}
                </button>
              )}
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
