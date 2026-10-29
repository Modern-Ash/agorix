import type { ProjectRepository } from "@agorix/project-repository";
import { validateProgram, type ProjectProgram } from "@agorix/program-model";
import { mapOriProposalToCanonicalStatement } from "./oriCanonicalProposalMapping.js";

/**
 * Server-only, explicit post-review mutation boundary.
 * The caller MUST obtain the approved ticket from a trusted, authenticated
 * review registry; browser-supplied proposals are never authorization.
 */
export async function applyApprovedOriProposal({
  repository,
  owner,
  projectId,
  expectedRevision,
  approved,
  proposal,
  allowedBlocks,
  scriptId,
  mayCommit,
  commitFence,
  atomicCommit,
}: {
  readonly repository: ProjectRepository;
  readonly owner: string;
  readonly projectId: string;
  readonly expectedRevision: number;
  readonly approved: boolean;
  readonly proposal: unknown;
  readonly allowedBlocks: readonly string[];
  readonly scriptId: string;
  /** Trusted synchronous policy check at the last boundary before repository CAS. */
  readonly mayCommit?: () => boolean;
  /** Optional host-owned atomic commit boundary, never controlled by HTTP input. */
  readonly commitFence?: (write: () => Promise<void>) => Promise<boolean>;
  /** Durable CAS + rollout policy epoch checked in one DB transaction. */
  readonly atomicCommit?: (
    storedProject: Awaited<ReturnType<ProjectRepository["get"]>>["storedProject"],
    expectedRevision: number,
  ) => Promise<"applied" | "denied" | "conflict">;
}): Promise<"applied" | "rejected" | "conflict"> {
  if (
    !approved ||
    !owner ||
    !projectId ||
    !scriptId ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1
  )
    return "rejected";

  const statement = mapOriProposalToCanonicalStatement(proposal, allowedBlocks);
  if (!statement) return "rejected";

  try {
    const record = await repository.get(owner, projectId);
    if (record.ownerId !== owner || record.projectId !== projectId) return "rejected";
    if (record.revision !== expectedRevision) return "conflict";
    const original = record.storedProject.program;
    if (original.scripts.filter((script) => script.id === scriptId).length !== 1) return "rejected";
    const program: ProjectProgram = {
      ...original,
      scripts: original.scripts.map((script) =>
        script.id === scriptId
          ? { ...script, statements: [...script.statements, statement] }
          : script,
      ),
    };
    validateProgram(program);
    if (mayCommit && mayCommit() !== true) return "rejected";
    if (atomicCommit) {
      const outcome = await atomicCommit({ ...record.storedProject, program }, expectedRevision);
      return outcome === "denied" ? "rejected" : outcome;
    }
    const write = async () => {
      await repository.update(owner, projectId, expectedRevision, {
        storedProject: { ...record.storedProject, program },
      });
    };
    if (commitFence) {
      if (!(await commitFence(write))) return "rejected";
    } else {
      await write();
    }
    return "applied";
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "CONFLICT")
      return "conflict";
    return "rejected";
  }
}
