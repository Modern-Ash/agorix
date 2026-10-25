import {
  createUnsupportedNodeDiagnostic,
  type LanguageProjection,
  type LanguageProjectionDiagnostic,
  type LanguageProjectionResult,
  type NodeTextMapping,
  type TextRange,
} from "@agorix/language-projection";
import {
  validateProgram,
  type Expression,
  type ProjectProgram,
  type Statement,
  type Trigger,
} from "@agorix/program-model";

export const AGORIX_CODE_PROJECTION = {
  id: "agorix-code",
  version: "1",
  label: "Agorix Code",
  family: "educational",
} as const;

interface Writer {
  text: string;
  mapping: Record<string, TextRange[]>;
  diagnostics: LanguageProjectionDiagnostic[];
  variableLabels: ReadonlyMap<string, string>;
  listLabels: ReadonlyMap<string, string>;
  procedureNames?: ReadonlyMap<string, string>;
  /** Titles of the numbers of the custom block being written, by id. */
  paramNames?: ReadonlyMap<string, string> | undefined;
}

export function projectAgorixCode(program: ProjectProgram): LanguageProjectionResult {
  const validated = validateProgram(program);
  const writer: Writer = {
    text: "",
    mapping: {},
    diagnostics: [],
    variableLabels: variableDisplayNamesFor(validated.variables),
    listLabels: variableDisplayNamesFor(validated.lists),
  };
  for (const variable of validated.variables ?? []) {
    writeMapped(
      writer,
      "variables/" + variable.id,
      "variable " +
        variableName(writer, variable.id) +
        " = " +
        formatNumber(variable.initialValue) +
        "\n",
    );
    if (variable.visible) {
      writeMapped(
        writer,
        "variables/" + variable.id,
        "show " + variableName(writer, variable.id) + "\n",
      );
    }
  }
  for (const list of validated.lists ?? []) {
    writeMapped(
      writer,
      "lists/" + list.id,
      "list " +
        listName(writer, list.id) +
        " = " +
        list.initialItems.map(formatNumber).join(", ") +
        "\n",
    );
    if (list.visible) {
      writeMapped(writer, "lists/" + list.id, "show " + listName(writer, list.id) + "\n");
    }
  }
  if ((validated.variables?.length ?? 0) > 0 || (validated.lists?.length ?? 0) > 0) {
    writer.text += "\n";
  }
  validated.scripts.forEach((script, scriptIndex) => {
    const scriptId = "scripts[" + scriptIndex + "]";
    const procedures = script.procedures ?? [];
    writer.procedureNames = new Map(procedures.map((item) => [item.id, item.name]));
    procedures.forEach((procedure, procedureIndex) => {
      const procedureId = scriptId + "/procedures[" + procedureIndex + "]";
      const start = writer.text.length;
      const params = procedure.params ?? [];
      writer.paramNames = new Map(params.map((item) => [item.id, item.name]));
      writer.text +=
        "define " +
        procedure.name +
        (params.length === 0 ? "" : " with " + params.map((item) => item.name).join(", ")) +
        "\n";
      procedure.body.forEach((statement, index) =>
        writeStatement(writer, statement, procedureId + "/body[" + index + "]", 1),
      );
      writer.paramNames = undefined;
      addRange(writer, procedureId, start, writer.text.length);
    });
    writeMapped(writer, scriptId, triggerText(script.trigger));
    script.statements.forEach((statement, index) =>
      writeStatement(writer, statement, scriptId + "/statements[" + index + "]", 1),
    );
  });
  return {
    projection: AGORIX_CODE_PROJECTION,
    text: writer.text,
    mapping: writer.mapping as NodeTextMapping,
    diagnostics: writer.diagnostics,
    metadata: { structuralNodeIds: Object.keys(writer.mapping) },
  };
}

function triggerText(trigger: Trigger): string {
  switch (trigger.type) {
    case "greenFlag":
    case "onStart":
      return "when start\n";
    case "onActorClicked":
      return "when actor clicked\n";
    case "onKeyPressed":
      return `when key ${JSON.stringify(trigger.key)} pressed\n`;
    case "onMessage":
      return `when message ${JSON.stringify(trigger.message)} received\n`;
  }
}

export const agorixCodeProjection: LanguageProjection = {
  descriptor: AGORIX_CODE_PROJECTION,
  project: projectAgorixCode,
};

function writeStatement(writer: Writer, statement: Statement, nodeId: string, depth: number): void {
  const indent = "  ".repeat(depth);
  switch (statement.type) {
    case "move":
      writeMapped(
        writer,
        nodeId,
        indent +
          "move " +
          (statement.stepsFrom === undefined
            ? formatNumber(statement.steps)
            : paramText(writer, statement.stepsFrom)) +
          "\n",
      );
      return;
    case "glideTo":
      writeMapped(
        writer,
        nodeId,
        indent +
          "glide to " +
          formatNumber(statement.x) +
          ", " +
          formatNumber(statement.y) +
          " in " +
          formatNumber(statement.seconds) +
          " seconds\n",
      );
      return;
    case "goTo":
      writeMapped(
        writer,
        nodeId,
        indent + "go to " + formatNumber(statement.x) + ", " + formatNumber(statement.y) + "\n",
      );
      return;
    case "turn":
      writeMapped(
        writer,
        nodeId,
        indent +
          "turn " +
          (statement.degreesFrom === undefined
            ? formatNumber(statement.degrees)
            : paramText(writer, statement.degreesFrom)) +
          "\n",
      );
      return;
    case "pointInDirection":
      writeMapped(
        writer,
        nodeId,
        indent + "point in direction " + formatNumber(statement.degrees) + "\n",
      );
      return;
    case "pointTowards":
      writeMapped(
        writer,
        nodeId,
        indent + "point towards " + JSON.stringify(statement.actorId) + "\n",
      );
      return;
    case "setEffect":
      writeMapped(
        writer,
        nodeId,
        indent + "set " + statement.effect + " effect to " + formatNumber(statement.value) + "\n",
      );
      return;
    case "changeEffect":
      writeMapped(
        writer,
        nodeId,
        indent +
          "change " +
          statement.effect +
          " effect by " +
          formatNumber(statement.delta) +
          "\n",
      );
      return;
    case "clearEffects":
      writeMapped(writer, nodeId, indent + "clear graphic effects\n");
      return;
    case "goToLayer":
      writeMapped(writer, nodeId, indent + "go to " + statement.layer + " layer\n");
      return;
    case "callProcedure":
      writeMapped(
        writer,
        nodeId,
        indent +
          "call " +
          (writer.procedureNames?.get(statement.procedureId) ?? "?") +
          (statement.args === undefined
            ? ""
            : " with " +
              statement.args
                .map((arg, index) => expressionText(writer, arg, `${nodeId}/args[${index}]`))
                .join(", ")) +
          "\n",
      );
      return;
    case "bounceOnEdge":
      writeMapped(writer, nodeId, indent + "bounce on edge\n");
      return;
    case "say":
      writeMapped(writer, nodeId, indent + "say " + JSON.stringify(statement.text) + "\n");
      return;
    case "think":
      writeMapped(writer, nodeId, indent + "think " + JSON.stringify(statement.text) + "\n");
      return;
    case "show":
      writeMapped(writer, nodeId, indent + "show\n");
      return;
    case "hide":
      writeMapped(writer, nodeId, indent + "hide\n");
      return;
    case "listAdd":
      writeMapped(
        writer,
        nodeId,
        indent +
          "add " +
          expressionText(writer, statement.value, nodeId + "/value") +
          " to " +
          listName(writer, statement.listId) +
          "\n",
      );
      return;
    case "listRemoveAt":
      writeMapped(
        writer,
        nodeId,
        indent +
          "remove item " +
          expressionText(writer, statement.index, nodeId + "/index") +
          " of " +
          listName(writer, statement.listId) +
          "\n",
      );
      return;
    case "listInsertAt":
    case "listReplaceAt":
      writeMapped(
        writer,
        nodeId,
        indent +
          `${statement.type === "listInsertAt" ? "insert" : "replace"} item ` +
          expressionText(writer, statement.index, nodeId + "/index") +
          ` of ${listName(writer, statement.listId)} with ` +
          expressionText(writer, statement.value, nodeId + "/value") +
          "\n",
      );
      return;
    case "wait":
      writeMapped(
        writer,
        nodeId,
        indent +
          "wait " +
          (statement.secondsFrom === undefined
            ? formatNumber(statement.seconds)
            : paramText(writer, statement.secondsFrom)) +
          " seconds\n",
      );
      return;
    case "setSize":
      writeMapped(writer, nodeId, indent + "set size to " + formatNumber(statement.size) + "\n");
      return;
    case "changeSize":
      writeMapped(
        writer,
        nodeId,
        indent + "change size by " + formatNumber(statement.delta) + "\n",
      );
      return;
    case "switchCostume":
      writeMapped(
        writer,
        nodeId,
        indent + "switch costume to " + JSON.stringify(statement.costumeId) + "\n",
      );
      return;
    case "switchBackdrop":
      writeMapped(
        writer,
        nodeId,
        indent + "switch backdrop to " + JSON.stringify(statement.backdropId) + "\n",
      );
      return;
    case "playSound":
      writeMapped(
        writer,
        nodeId,
        indent + "play sound " + JSON.stringify(statement.soundId) + "\n",
      );
      return;
    case "stopSounds":
      writeMapped(writer, nodeId, indent + "stop all sounds\n");
      return;
    case "setVolume":
      writeMapped(
        writer,
        nodeId,
        indent + "set volume to " + formatNumber(statement.volume) + "\n",
      );
      return;
    case "changeVolume":
      writeMapped(
        writer,
        nodeId,
        indent + "change volume by " + formatNumber(statement.delta) + "\n",
      );
      return;
    case "setVariable":
      writeMapped(
        writer,
        nodeId,
        indent +
          "set " +
          variableName(writer, statement.variableId) +
          " to " +
          expressionText(writer, statement.value, nodeId + "/value") +
          "\n",
      );
      return;
    case "changeVariable":
      writeMapped(
        writer,
        nodeId,
        indent +
          "change " +
          variableName(writer, statement.variableId) +
          " by " +
          expressionText(writer, statement.delta, nodeId + "/delta") +
          "\n",
      );
      return;
    case "showVariable":
      writeMapped(
        writer,
        nodeId,
        indent + "show " + variableName(writer, statement.variableId) + "\n",
      );
      return;
    case "hideVariable":
      writeMapped(
        writer,
        nodeId,
        indent + "hide " + variableName(writer, statement.variableId) + "\n",
      );
      return;
    case "repeat": {
      const start = writer.text.length;
      writer.text +=
        indent +
        "repeat " +
        (statement.countFrom === undefined
          ? formatNumber(statement.count)
          : paramText(writer, statement.countFrom)) +
        " times\n";
      statement.body.forEach((child, index) =>
        writeStatement(writer, child, nodeId + "/body[" + index + "]", depth + 1),
      );
      addRange(writer, nodeId, start, writer.text.length);
      return;
    }
    case "repeatUntil": {
      const start = writer.text.length;
      writer.text +=
        indent +
        "repeat until " +
        expressionText(writer, statement.condition, nodeId + "/condition") +
        "\n";
      statement.body.forEach((child, index) =>
        writeStatement(writer, child, nodeId + "/body[" + index + "]", depth + 1),
      );
      addRange(writer, nodeId, start, writer.text.length);
      return;
    }
    case "if": {
      const start = writer.text.length;
      writer.text +=
        indent + "if " + expressionText(writer, statement.condition, nodeId + "/condition") + "\n";
      statement.then.forEach((child, index) =>
        writeStatement(writer, child, nodeId + "/then[" + index + "]", depth + 1),
      );
      if (statement.else !== undefined) {
        writer.text += indent + "else\n";
        statement.else.forEach((child, index) =>
          writeStatement(writer, child, nodeId + "/else[" + index + "]", depth + 1),
        );
      }
      addRange(writer, nodeId, start, writer.text.length);
      return;
    }
    default: {
      const unknown = statement as { type?: unknown };
      writer.diagnostics.push(
        createUnsupportedNodeDiagnostic({
          nodeId,
          nodeType: String(unknown.type),
          projectionId: AGORIX_CODE_PROJECTION.id,
        }),
      );
    }
  }
}

function expressionText(writer: Writer, expression: Expression, nodeId: string): string {
  switch (expression.type) {
    case "touchingGoal":
      return "touching goal";
    case "touchingActor":
      return "touching " + JSON.stringify(expression.actorId);
    case "touchingStageEdge":
      return `touching edge ${formatNumber(expression.minX)}..${formatNumber(expression.maxX)}, ${formatNumber(expression.minY)}..${formatNumber(expression.maxY)}`;
    case "distanceToActor":
      return "distance to " + JSON.stringify(expression.actorId);
    case "xPosition":
      return "x position";
    case "yPosition":
      return "y position";
    case "booleanLiteral":
      return expression.value ? "true" : "false";
    case "numericLiteral":
      return formatNumber(expression.value);
    case "variable":
      return variableName(writer, expression.variableId);
    case "add":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " + " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "subtract":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " - " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "multiply":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " * " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "divide":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " / " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "modulo":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " mod " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "lessThan":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " < " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "greaterThan":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " > " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "lessOrEqual":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " <= " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "greaterOrEqual":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " >= " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "equals":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " = " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "and":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " and " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "or":
      return (
        "(" +
        expressionText(writer, expression.left, nodeId + "/left") +
        " or " +
        expressionText(writer, expression.right, nodeId + "/right") +
        ")"
      );
    case "mathFunction":
      return (
        expression.function + " " + expressionText(writer, expression.value, nodeId + "/value")
      );
    case "not":
      return "not " + expressionText(writer, expression.value, nodeId + "/value");
    case "listItem":
      return (
        "item " +
        expressionText(writer, expression.index, nodeId + "/index") +
        " of " +
        listName(writer, expression.listId)
      );
    case "listLength":
      return "length of " + listName(writer, expression.listId);
    case "param":
      return paramText(writer, expression.paramId);
    case "randomInteger":
      return (
        "random whole number " +
        expressionText(writer, expression.min, nodeId + "/min") +
        " to " +
        expressionText(writer, expression.max, nodeId + "/max")
      );
    case "random":
      return (
        "random " +
        expressionText(writer, expression.min, nodeId + "/min") +
        " to " +
        expressionText(writer, expression.max, nodeId + "/max")
      );
    default: {
      const unknown = expression as { type?: unknown };
      writer.diagnostics.push(
        createUnsupportedNodeDiagnostic({
          nodeId,
          nodeType: String(unknown.type),
          projectionId: AGORIX_CODE_PROJECTION.id,
        }),
      );
      return "<?>";
    }
  }
}

function variableName(writer: Writer, variableId: string): string {
  return JSON.stringify(writer.variableLabels.get(variableId) ?? variableId);
}

function paramText(writer: Writer, id: string): string {
  return writer.paramNames?.get(id) ?? "?";
}

function listName(writer: Writer, listId: string): string {
  return JSON.stringify(writer.listLabels.get(listId) ?? listId);
}

function variableDisplayNamesFor(
  variables: readonly { id: string; name: string }[] | undefined,
): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  const used = new Set<string>();
  for (const variable of variables ?? []) {
    let name = variable.name;
    let suffix = 2;
    while (used.has(name)) {
      name = `${variable.name}${suffix}`;
      suffix += 1;
    }
    used.add(name);
    names.set(variable.id, name);
  }
  return names;
}

function writeMapped(writer: Writer, nodeId: string, text: string): void {
  const start = writer.text.length;
  writer.text += text;
  addRange(writer, nodeId, start, writer.text.length);
}

function addRange(writer: Writer, nodeId: string, start: number, end: number): void {
  (writer.mapping[nodeId] ??= []).push({ start, end });
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}
