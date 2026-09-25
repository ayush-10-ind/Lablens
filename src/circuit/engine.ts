/**
 * Rule Engine for LabLens.
 * Derived strictly from docs/rules.md Part B.
 *
 * Runs all pure rules against a CircuitModel, sorts results by severity,
 * and derives the overall circuit status.
 *
 * Overall status severity rules:
 * - Any 'fail' -> 'error' (Red)
 * - Else any 'warn' -> 'warning' (Amber)
 * - Else -> 'ok' (Green)
 * - 'info' results never change the overall color.
 * - Empty circuit -> 'empty'
 */

import { CircuitModel, OverallCircuitStatus, RuleEngineOutput, RuleResult } from './types';
import {
  checkRuleR1,
  checkRuleR2,
  checkRuleR3,
  checkRuleR4,
  checkRuleR5,
  checkRuleR6,
  checkRuleR7,
  checkRuleR8,
} from './rules';

const SEVERITY_ORDER: Record<string, number> = {
  fail: 0,
  warn: 1,
  info: 2,
  pass: 3,
};

/**
 * Evaluates all rules against the provided CircuitModel.
 */
export function evaluateRules(circuit: CircuitModel): RuleEngineOutput {
  if (circuit.components.length === 0) {
    return {
      status: 'empty',
      results: [],
    };
  }

  const results: RuleResult[] = [
    checkRuleR1(circuit),
    checkRuleR2(circuit),
    checkRuleR3(circuit),
    checkRuleR4(circuit),
    checkRuleR5(circuit),
    checkRuleR6(circuit),
    checkRuleR7(circuit),
    checkRuleR8(circuit),
  ];

  // Derive overall status
  let overallStatus: OverallCircuitStatus = 'ok';

  const hasFail = results.some((r) => r.status === 'fail');
  const hasWarn = results.some((r) => r.status === 'warn');

  if (hasFail) {
    overallStatus = 'error';
  } else if (hasWarn) {
    overallStatus = 'warning';
  } else {
    overallStatus = 'ok';
  }

  // Sort results by severity priority: fail -> warn -> info -> pass
  const sortedResults = [...results].sort(
    (a, b) => (SEVERITY_ORDER[a.status] ?? 99) - (SEVERITY_ORDER[b.status] ?? 99)
  );

  return {
    status: overallStatus,
    results: sortedResults,
  };
}
