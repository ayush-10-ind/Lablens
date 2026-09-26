/**
 * Pipeline orchestrator for the domain-neutral LabLens pipeline.
 *
 * runPipeline() is a pure function:
 * - No side effects.
 * - No React.
 * - No DOM or Worker references.
 * - Fully unit-testable with mock providers.
 */

import type { SceneDescription, VisualizationPlan } from './types';
import type { UnderstandingProvider, ScenePlanner } from './providers';

/**
 * Runs the full understanding → planning pipeline for a given input and domain providers.
 *
 * @template TInput    The raw input type consumed by the understanding provider.
 * @template TPayload  The domain payload type produced by the understanding provider
 *                     and consumed by the scene planner.
 *
 * @returns An object containing the produced SceneDescription and VisualizationPlan.
 *          Both are plain data — no Three.js or React objects.
 */
export function runPipeline<TInput, TPayload>(
  input: TInput,
  providers: {
    understanding: UnderstandingProvider<TInput, TPayload>;
    planner: ScenePlanner<TPayload>;
  }
): { description: SceneDescription<TPayload>; plan: VisualizationPlan } {
  const description = providers.understanding.describe(input);
  const plan = providers.planner.plan(description);
  return { description, plan };
}
