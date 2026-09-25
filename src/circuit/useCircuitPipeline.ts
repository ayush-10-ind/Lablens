/**
 * Integration pipeline connecting SceneGate (R9) -> CircuitBuilder -> RuleEngine -> UI State.
 *
 * Enforces the architecture boundary:
 * Tracked Detections
 *         │
 *         ▼
 *    SceneGate (R9)
 *         │
 *      ┌──┴──┐
 *    idle   lab
 *     │       │
 *     │       ▼
 *     │   gatedComponents
 *     │       │
 *     │       ▼
 *     │   buildCircuitModel (Layout-based series chain)
 *     │       │
 *     │       ▼
 *     │   evaluateRules (R1-R8 validation)
 *     ▼       │
 *   Zero labels, UI reflects gated circuit status
 */

import { useRef } from 'react';
import { SceneGate, SceneGateStatus } from './sceneGate';
import { buildCircuitModel } from './builder';
import { evaluateRules } from './engine';
import {
  CircuitModel,
  ComponentType,
  DetectedComponent,
  RuleEngineOutput,
} from './types';

/**
 * Maps component types to their CSS theme tokens defined in src/index.css.
 */
export const COMPONENT_THEME_TOKENS: Record<ComponentType, string> = {
  battery: 'var(--battery)',
  resistor: 'var(--resistor)',
  led: 'var(--led)',
  switch: 'var(--switch)',
  breadboard: 'var(--breadboard)',
};

export interface CircuitPipelineResult {
  gateStatus: SceneGateStatus;
  circuitModel: CircuitModel | null;
  ruleOutput: RuleEngineOutput | null;
  labels: DetectedComponent[];
  primaryHint?: string;
}

/**
 * Pure function that steps the full pipeline:
 * SceneGate -> (if lab) CircuitBuilder -> RuleEngine.
 */
export function processCircuitPipeline(
  gate: SceneGate,
  components: DetectedComponent[],
  timestampMs: number,
  mode: 'camera' | 'marker' | 'virtual' = 'camera'
): CircuitPipelineResult {
  const gateStatus = gate.update(components, timestampMs);

  if (gateStatus.state === 'idle') {
    return {
      gateStatus,
      circuitModel: null,
      ruleOutput: null,
      labels: [],
      primaryHint: gateStatus.hint,
    };
  }

  // Lab mode: build circuit model and evaluate rules
  const circuitModel = buildCircuitModel(gateStatus.gatedComponents, mode);
  const ruleOutput = evaluateRules(circuitModel);

  // Derive primary hint from top-priority rule issue (fail first, then warn)
  const primaryIssue =
    ruleOutput.results.find((r) => r.status === 'fail' && r.fix) ??
    ruleOutput.results.find((r) => r.status === 'warn' && r.fix);

  const primaryHint =
    primaryIssue?.fix ?? (ruleOutput.status === 'ok' ? 'Circuit complete and verified.' : undefined);

  return {
    gateStatus,
    circuitModel,
    ruleOutput,
    labels: gateStatus.gatedComponents,
    primaryHint,
  };
}

/**
 * React hook managing the SceneGate lifecycle and downstream circuit evaluation.
 */
export function useCircuitPipeline(
  components: DetectedComponent[],
  timestampMs?: number,
  mode: 'camera' | 'marker' | 'virtual' = 'camera'
): CircuitPipelineResult {
  const gateRef = useRef<SceneGate>(new SceneGate());

  const now =
    timestampMs ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());

  return processCircuitPipeline(gateRef.current, components, now, mode);
}
