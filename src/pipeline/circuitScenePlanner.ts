/**
 * Circuit scene planner.
 *
 * Converts a CircuitSceneDescription into a ProceduralPlan for the 'led-circuit' scene.
 * Pure: no side effects, no DOM, no Three.js, no React.
 *
 * Architectural constraints:
 * - Only handles descriptions with domain === 'circuit'.
 * - Uses canPlan() as a type guard before plan() is called.
 * - Does not modify CircuitModel, RuleEngineOutput, or RuleEngine.
 * - Returns NullPlan when the circuit model or rule output is unavailable
 *   (e.g. SceneGate is idle and produced a null model).
 */

import type { ScenePlanner } from './providers';
import type {
  CircuitScenePayload,
  CircuitSceneDescription,
  VisualizationPlan,
  ProceduralPlan,
  NullPlan,
} from './types';
import type { SceneDescription } from './types';

export class CircuitScenePlanner implements ScenePlanner<CircuitScenePayload> {
  readonly domain = 'circuit';

  /**
   * Type guard: returns true when this planner can handle the given description.
   * Checks domain slug only — does not inspect payload shape.
   */
  canPlan(
    description: SceneDescription<unknown>
  ): description is CircuitSceneDescription {
    return description.domain === 'circuit';
  }

  /**
   * Converts a circuit description into a VisualizationPlan.
   *
   * Returns NullPlan when:
   * - circuitModel is null (SceneGate idle — no circuit yet built)
   * - ruleOutput is null (same condition)
   * - ruleOutput.status === 'empty' (gate idle, no active components)
   *
   * Otherwise returns a ProceduralPlan for 'led-circuit' with:
   * - initialStep = 3 when R3 (LED has no resistor) is failing, else 1
   * - circuitActive = true when overall status is 'ok'
   */
  plan(description: CircuitSceneDescription): VisualizationPlan {
    const { model, ruleOutput } = description.payload;

    if (!model || !ruleOutput || ruleOutput.status === 'empty') {
      const nullPlan: NullPlan = {
        strategy: 'none',
        reason: 'no circuit model available — SceneGate may be idle',
      };
      return nullPlan;
    }

    const hasR3Fail = ruleOutput.results.some(
      (r) => r.id === 'R3' && r.status === 'fail'
    );

    const proceduralPlan: ProceduralPlan = {
      strategy: 'procedural',
      sceneId: 'led-circuit',
      domain: 'circuit',
      initialStep: hasR3Fail ? 3 : 1,
      circuitActive: ruleOutput.status === 'ok',
    };

    return proceduralPlan;
  }
}
