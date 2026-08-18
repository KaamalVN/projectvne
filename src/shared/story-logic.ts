import type {
  ChoiceBlock,
  ChoiceOption,
  CompoundCondition,
  ConditionExpression,
  DialogueBlock,
  ProjectIR,
  ScriptBlock,
  StoryBlock,
  VariableCondition,
  VariableValue,
} from "./types/ir.ts";

export interface ConditionEvaluationResult {
  passed: boolean;
  explanation: string;
  referencedVariableIds: string[];
}

export interface ChoiceAvailability {
  option: ChoiceOption;
  available: boolean;
  explanation: string;
}

function compareValues(left: VariableValue, operator: VariableCondition["operator"], right: VariableValue): boolean {
  switch (operator) {
    case "equals":
      return left === right;
    case "notEquals":
      return left !== right;
    case "greaterThan":
      return Number(left) > Number(right);
    case "lessThan":
      return Number(left) < Number(right);
    case "greaterThanOrEqual":
      return Number(left) >= Number(right);
    case "lessThanOrEqual":
      return Number(left) <= Number(right);
    case "contains":
      return Array.isArray(left) ? left.includes(String(right)) : String(left).includes(String(right));
    case "notContains":
      return Array.isArray(left) ? !left.includes(String(right)) : !String(left).includes(String(right));
  }
}

function formatOperator(operator: VariableCondition["operator"]): string {
  const labels: Record<VariableCondition["operator"], string> = {
    equals: "equals",
    notEquals: "does not equal",
    greaterThan: "is greater than",
    lessThan: "is less than",
    greaterThanOrEqual: "is at least",
    lessThanOrEqual: "is at most",
    contains: "contains",
    notContains: "does not contain",
  };

  return labels[operator];
}

export function evaluateConditionExpression(
  expression: ConditionExpression,
  project: ProjectIR,
  variables: Record<string, VariableValue>,
): ConditionEvaluationResult {
  if (expression.type === "variable") {
    const variable = project.variables[expression.variableId];
    const currentValue = variables[expression.variableId];
    const label = variable?.displayName || variable?.name || expression.variableId;
    const passed = compareValues(currentValue, expression.operator, expression.value);

    return {
      passed,
      explanation: `${label} (${JSON.stringify(currentValue)}) ${formatOperator(expression.operator)} ${JSON.stringify(expression.value)}`,
      referencedVariableIds: [expression.variableId],
    };
  }

  return evaluateCompoundCondition(expression, project, variables);
}

function evaluateCompoundCondition(
  expression: CompoundCondition,
  project: ProjectIR,
  variables: Record<string, VariableValue>,
): ConditionEvaluationResult {
  const nested = expression.conditions.map((condition) => evaluateConditionExpression(condition, project, variables));
  const explanations = nested.map((item) => item.explanation);
  const referencedVariableIds = Array.from(new Set(nested.flatMap((item) => item.referencedVariableIds)));

  if (expression.operator === "not") {
    const first = nested[0];
    return {
      passed: !first?.passed,
      explanation: `not (${first?.explanation || "empty condition"})`,
      referencedVariableIds,
    };
  }

  const passed = expression.operator === "and"
    ? nested.every((item) => item.passed)
    : nested.some((item) => item.passed);

  return {
    passed,
    explanation: explanations.join(` ${expression.operator} `),
    referencedVariableIds,
  };
}

export function evaluateChoiceAvailability(
  option: ChoiceOption,
  project: ProjectIR,
  variables: Record<string, VariableValue>,
): ChoiceAvailability {
  if (option.conditionExpression?.trim()) {
    try {
      const evaluator = new Function("vars", `"use strict"; return (${option.conditionExpression});`);
      const available = Boolean(evaluator(variables));
      return {
        option,
        available,
        explanation: `Expression "${option.conditionExpression}" evaluated to ${String(available)}`,
      };
    } catch (error) {
      return {
        option,
        available: false,
        explanation: `Expression error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  if (!option.conditionId) {
    return {
      option,
      available: true,
      explanation: "No condition is attached to this choice.",
    };
  }

  const condition = project.conditions[option.conditionId];
  if (!condition) {
    return {
      option,
      available: false,
      explanation: `Condition "${option.conditionId}" is missing.`,
    };
  }

  const evaluation = evaluateConditionExpression(condition.expression, project, variables);
  return {
    option,
    available: evaluation.passed,
    explanation: evaluation.explanation,
  };
}

function blockToScriptLine(block: StoryBlock, project: ProjectIR): string[] {
  switch (block.type) {
    case "dialogue": {
      const dialogueBlock = block as DialogueBlock;
      const speaker = dialogueBlock.characterId ? project.characters[dialogueBlock.characterId]?.name || dialogueBlock.characterId : "Narrator";
      return [`say ${speaker}: "${dialogueBlock.text}"`];
    }
    case "showCharacter":
      return [`show ${project.characters[block.characterId]?.name || block.characterId} ${block.expression} at ${block.position}`];
    case "setVariable":
      return [`set ${project.variables[block.variableId]?.displayName || block.variableId} ${block.operation} ${JSON.stringify(block.value)}`];
    case "choice": {
      const choice = block as ChoiceBlock;
      return [
        `choice "${choice.prompt}"`,
        ...choice.options.map((option) => {
          const destination = option.destinationSceneId ? project.scenes[option.destinationSceneId]?.title || option.destinationSceneId : "continue";
          const rule = option.conditionExpression?.trim()
            ? ` when ${option.conditionExpression}`
            : option.conditionId
              ? ` when ${project.conditions[option.conditionId]?.name || option.conditionId}`
              : "";
          return `  - "${option.text}" -> ${destination}${rule}`;
        }),
      ];
    }
    case "script": {
      const scriptBlock = block as ScriptBlock;
      return [`script ${scriptBlock.label}`, ...scriptBlock.code.split("\n").map((line) => `  ${line}`)];
    }
    default:
      return [`${block.type}`];
  }
}

export function generateSceneTextView(project: ProjectIR, sceneId: string): string {
  const scene = project.scenes[sceneId];
  if (!scene) {
    return "// Scene not found";
  }

  const lines = [`scene ${scene.title}`, "{"];
  for (const block of scene.blocks) {
    lines.push(...blockToScriptLine(block, project).map((line) => `  ${line}`));
  }
  lines.push("}");
  return lines.join("\n");
}

export function buildDefaultVariableState(project: ProjectIR): Record<string, VariableValue> {
  return Object.fromEntries(
    Object.entries(project.variables).map(([id, variable]) => [id, variable.defaultValue]),
  );
}

export function findNeverSatisfiedConditions(project: ProjectIR): Array<{ conditionId: string; reason: string }> {
  const results: Array<{ conditionId: string; reason: string }> = [];
  const defaultState = buildDefaultVariableState(project);

  for (const [conditionId, condition] of Object.entries(project.conditions)) {
    const evaluation = evaluateConditionExpression(condition.expression, project, defaultState);
    if (evaluation.passed) {
      continue;
    }

    const canBeChanged = Object.values(project.scenes).some((scene) =>
      scene.blocks.some((block) => block.type === "setVariable" && evaluation.referencedVariableIds.includes(block.variableId)),
    );

    if (!canBeChanged) {
      results.push({
        conditionId,
        reason: `${condition.name} can never be true because ${evaluation.explanation} and none of its variables are changed anywhere in the project.`,
      });
    }
  }

  return results;
}
