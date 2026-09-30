import type {
  LearningDecisionQuestion,
  LearningSystem1Answer,
  LearningSystem1Provider,
} from "./system1.js";

export interface LayaBatchTransport {
  decideMany(input: {
    readonly state: Readonly<Record<string, string | number | boolean>>;
    readonly questions: readonly {
      readonly id: string;
      readonly type: "choice";
      readonly choices: readonly (string | number)[];
    }[];
  }): Promise<
    readonly {
      readonly id: string;
      readonly value: string | number;
      readonly confidence: number;
    }[]
  >;
}

/**
 * Thin Laya adapter. Transport is injected so this domain package does not
 * depend on Python, a browser bridge, HTTP, or any provider/model runtime.
 */
export function createLayaLearningProvider(
  transport: LayaBatchTransport,
  id = "laya-local",
): LearningSystem1Provider {
  return {
    id,
    async decideMany(state, questions): Promise<readonly LearningSystem1Answer[]> {
      const response = await transport.decideMany({
        state,
        questions: questions.map(toLayaQuestion),
      });
      const requested = new Set(questions.map((question) => question.id));
      return response.flatMap((answer) =>
        requested.has(answer.id as LearningDecisionQuestion["id"])
          ? [
              {
                questionId: answer.id as LearningDecisionQuestion["id"],
                value: answer.value,
                confidence: answer.confidence,
              },
            ]
          : [],
      );
    },
  };
}

function toLayaQuestion(question: LearningDecisionQuestion): {
  readonly id: string;
  readonly type: "choice";
  readonly choices: readonly (string | number)[];
} {
  return {
    id: question.id,
    type: "choice",
    choices: question.choices,
  };
}
